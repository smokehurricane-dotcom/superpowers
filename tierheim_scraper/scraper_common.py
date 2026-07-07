#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Gemeinsame Funktionen für die Tierheim-Hunde-Scraper.

Dieses Modul enthält Code, der von mehreren Heim-Scrapern verwendet wird:
- Höfliche Netzwerk-Requests
- Altersberechnung aus Geburtsdaten
- Verträglichkeits-Extraktion
- SQLite-Datenbank (hunde.db) mit Upsert-Logik
"""

import re
import sqlite3
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin

import requests

REQUEST_DELAY_SECONDS = 2.5  # Höfliche Pause zwischen Requests
DB_NAME = "hunde.db"


def polite_get(session: requests.Session, url: str, user_agent: str) -> requests.Response:
    """Führt einen einzelnen GET-Request mit ehrlichem User-Agent aus."""
    resp = session.get(url, headers={"User-Agent": user_agent}, timeout=30)
    resp.raise_for_status()
    time.sleep(REQUEST_DELAY_SECONDS)
    return resp


def check_robots_txt(base_url: str, user_agent: str) -> None:
    """Prüft robots.txt des Zielservers. Wir respektieren die Regeln."""
    url = urljoin(base_url, "/robots.txt")
    resp = requests.get(url, headers={"User-Agent": user_agent}, timeout=20)
    resp.raise_for_status()
    text = resp.text
    # Generische Prüfung: /wp-admin/ ist bei WordPress üblich, bei Joomla etc.
    # gibt es oft ähnliche Disallow-Einträge. Wir zeigen den Inhalt an.
    print("robots.txt OK – geprüft:", url)
    if "Disallow:" in text:
        for line in text.splitlines():
            if line.strip().startswith("Disallow:"):
                print("  Gesperrt:", line.strip())


def parse_date(value: str) -> Optional[datetime]:
    """Versucht, ein deutsches Datum (z.B. 10.05.2022) zu parsen."""
    value = value.strip().replace("unbekannt", "").strip()
    if not value:
        return None
    for fmt in ("%d.%m.%Y", "%d.%m.%y", "%Y-%m-%d"):
        try:
            return datetime.strptime(value, fmt)
        except ValueError:
            continue
    return None


def calculate_age(birth_text: str) -> Optional[str]:
    """Berechnet aus dem Geburtsdatum ein menschenlesbares Alter."""
    birth_date = parse_date(birth_text)
    if not birth_date:
        return None
    now = datetime.now(timezone.utc)
    # Naives Datum mit aktuellem Jahr vergleichen (Seite gibt kein UTC)
    years = now.year - birth_date.year
    months = now.month - birth_date.month
    if now.day < birth_date.day:
        months -= 1
    if months < 0:
        years -= 1
        months += 12
    if years > 0 and months > 0:
        return f"{years} Jahre, {months} Monate"
    if years > 0:
        return f"{years} Jahre"
    if months > 0:
        return f"{months} Monate"
    return "weniger als 1 Monat"


def extract_birth_date_from_text(text: str) -> Optional[str]:
    """Versucht, ein Geburtsdatum aus dem Beschreibungstext zu extrahieren.

    Erkennt Formulierungen wie "am 13.03.2012 geboren", "geboren am ...",
    "geb. ..." oder "... geboren".
    """
    if not text:
        return None

    date_pattern = r"(\d{1,2})\.(\d{1,2})\.(\d{2,4})"
    patterns = [
        r"am\s+" + date_pattern + r"\s+geboren",
        r"geboren\s+(?:am\s+)?" + date_pattern,
        r"geb\.?\s*:?\s*" + date_pattern,
        r"geboren\s*:?\s*" + date_pattern,
        date_pattern + r"\s+geboren",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            day, month, year = match.groups()
            # Zweistellige Jahre vernünftig interpretieren
            year_int = int(year)
            if year_int < 100:
                year_int += 2000 if year_int <= int(str(datetime.now().year)[-2:]) else 1900
            return f"{int(day):02d}.{int(month):02d}.{year_int}"
    return None


def extract_birth_year_from_text(text: str) -> Optional[str]:
    """Versucht, ein Geburtsjahr/Monat aus dem Beschreibungstext zu extrahieren.

    Erkennt Formulierungen wie "2011 geb.", "ca. 01/2025 geb.",
    "ca. Januar 2025 geboren" oder "ca. 1,5 Jahre alt".
    Gibt einen String zurück, der an calculate_age() übergeben werden kann,
    oder None, wenn keine verwertbare Angabe gefunden wurde.
    """
    if not text:
        return None

    text_lower = text.lower()

    # Monat/Jahr-Notation: 01/2025, 06/2024, auch "geb. ca. 8/2020"
    match = re.search(r"(?:ca\.?\s*)?(\d{1,2})/(\d{4})\s*geb", text_lower)
    if match:
        month, year = match.groups()
        return f"01.{int(month):02d}.{year}"
    match = re.search(r"geb\.?\s*(?:ca\.?\s*)?(\d{1,2})/(\d{4})", text_lower)
    if match:
        month, year = match.groups()
        return f"01.{int(month):02d}.{year}"

    # "Januar 2025 geboren"
    months_de = {
        "januar": 1, "februar": 2, "märz": 3, "april": 4, "mai": 5, "juni": 6,
        "juli": 7, "august": 8, "september": 9, "oktober": 10, "november": 11, "dezember": 12,
    }
    match = re.search(r"ca\.?\s*([a-zä]+)\s+(\d{4})\s*geb", text_lower)
    if match:
        month_name, year = match.groups()
        month = months_de.get(month_name)
        if month:
            return f"01.{month:02d}.{year}"

    # Jahreszahl mit "geb." / "geboren"
    match = re.search(r"(\d{4})\s*geb\.?", text_lower)
    if match:
        year = match.group(1)
        return f"01.01.{year}"

    # "ca. X Jahre alt"
    match = re.search(r"ca\.?\s*([\d,]+)\s*jahre?\s*alt", text_lower)
    if match:
        years_str = match.group(1).replace(",", ".")
        years = float(years_str)
        now = datetime.now(timezone.utc)
        approx_year = now.year - int(years)
        return f"01.01.{approx_year}"

    return None


def extract_compatibility(text: str) -> str:
    """Hebt Sätze zur Verträglichkeit aus dem Fließtext heraus.

    Berücksichtigt explizite Verträglichkeitsaussagen sowie Sätze, die
    Katzen, Hunde oder Kinder zusammen mit einer Bewertung erwähnen.
    """
    sentences = re.split(r"(?<=[.!?])\s+", text)
    relevant = []
    animals_or_kids = ["katze", "katzen", "hund", "hunden", "hunde", "kind", "kinder", "artgenossen"]
    judgement = [
        "verträglich", "vertragen", "nicht vertragen", "kein problem", "keine problem",
        "problemlos", "unklar", "unbekannt", "gut", "schlecht", "ablehnend", "freundlich",
    ]
    for sentence in sentences:
        lower = sentence.lower()
        explicit = "verträglich" in lower or "vertragen" in lower
        mentions_target = any(kw in lower for kw in animals_or_kids)
        mentions_judgement = any(j in lower for j in judgement)
        if explicit or (mentions_target and mentions_judgement):
            relevant.append(sentence.strip())
    return " ".join(relevant)


def calculate_age_from_text(text: str) -> Optional[str]:
    """Versucht, aus einem beliebigen Text ein Alter zu berechnen."""
    birth_date = extract_birth_date_from_text(text)
    if birth_date:
        return calculate_age(birth_date)
    birth_year = extract_birth_year_from_text(text)
    if birth_year:
        return calculate_age(birth_year)
    return None


# ---------------------------------------------------------------------------
# Datenbank
# ---------------------------------------------------------------------------


def init_db(db_path: str = DB_NAME) -> sqlite3.Connection:
    """Erstellt die SQLite-Datenbank und Tabelle, falls sie noch nicht existiert."""
    conn = sqlite3.connect(db_path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS hunde (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            rasse TEXT,
            alter_text TEXT,
            geschlecht TEXT,
            groesse TEXT,
            foto_url TEXT,
            beschreibung TEXT,
            vertraeglichkeit TEXT,
            quelle_url TEXT UNIQUE NOT NULL,
            heim TEXT,
            scraped_at TEXT
        )
    """)
    conn.commit()
    return conn


def upsert_dogs(conn: sqlite3.Connection, dogs: list[dict]) -> int:
    """Fügt Hunde ein oder aktualisiert sie anhand der quelle_url."""
    inserted = 0
    cursor = conn.cursor()
    for dog in dogs:
        cursor.execute("""
            INSERT INTO hunde (
                name, rasse, alter_text, geschlecht, groesse, foto_url,
                beschreibung, vertraeglichkeit, quelle_url, heim, scraped_at
            ) VALUES (
                :name, :rasse, :alter_text, :geschlecht, :groesse, :foto_url,
                :beschreibung, :vertraeglichkeit, :quelle_url, :heim, :scraped_at
            )
            ON CONFLICT(quelle_url) DO UPDATE SET
                name = excluded.name,
                rasse = excluded.rasse,
                alter_text = excluded.alter_text,
                geschlecht = excluded.geschlecht,
                groesse = excluded.groesse,
                foto_url = excluded.foto_url,
                beschreibung = excluded.beschreibung,
                vertraeglichkeit = excluded.vertraeglichkeit,
                heim = excluded.heim,
                scraped_at = excluded.scraped_at
        """, dog)
        inserted += cursor.rowcount
    conn.commit()
    return inserted
