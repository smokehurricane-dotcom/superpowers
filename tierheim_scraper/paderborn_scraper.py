#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Web-Scraper für vermittelbare Hunde des Tierheims Paderborn.

Speichert öffentliche Tierdaten in dieselbe SQLite-Datenbank (hunde.db),
die auch der Gütersloh-Scraper verwendet. heim = "Tierheim Paderborn".

Start:
    python paderborn_scraper.py

Benötigte Pakete:
    pip install requests beautifulsoup4 lxml
    (Optional, nur falls JavaScript nötig wäre: playwright)
"""

import re
import sys
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

import scraper_common as common

# ---------------------------------------------------------------------------
# Konfiguration
# ---------------------------------------------------------------------------

BASE_URL = "https://www.tierheim-paderborn.de"
OVERVIEW_PATHS = [
    "/tiervermittlung/hunde/aus-dem-tierheim.html",
    "/tiervermittlung/hunde/aus-pflegestellen.html",
]
USER_AGENT = (
    "AdoptionsAggregator/1.0 "
    "(Kontakt: DEINE_EMAIL@example.com; +https://www.tierheim-paderborn.de)"
)
HEIM_NAME = "Tierheim Paderborn"
DB_NAME = common.DB_NAME


# ---------------------------------------------------------------------------
# Seiten laden (requests + Playwright-Fallback)
# ---------------------------------------------------------------------------

def fetch_page(session: requests.Session, url: str) -> BeautifulSoup:
    """Lädt eine Seite mit requests; bei wenig Inhalt Playwright-Fallback."""
    resp = common.polite_get(session, url, USER_AGENT)
    soup = BeautifulSoup(resp.text, "html.parser")
    body_text = soup.body.get_text(strip=True) if soup.body else ""
    if len(body_text) < 200:
        print(f"    Wenig Inhalt via requests, versuche Playwright: {url}")
        return fetch_page_with_playwright(url)
    return soup


def fetch_page_with_playwright(url: str) -> BeautifulSoup:
    """Fallback für JavaScript-lastige Seiten."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError as exc:
        raise RuntimeError(
            "Playwright ist nicht installiert. "
            "Installiere es mit: pip install playwright && playwright install"
        ) from exc

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)
        page.goto(url, wait_until="networkidle", timeout=30000)
        html = page.content()
        browser.close()
    return BeautifulSoup(html, "html.parser")


# ---------------------------------------------------------------------------
# Übersicht: Hunde-Links sammeln
# ---------------------------------------------------------------------------

def fetch_overview_pages(session: requests.Session) -> list[dict]:
    """Sammelt alle Hunde-Einträge von den Übersichtsseiten samt Pagination."""
    dogs: list[dict] = []
    for path in OVERVIEW_PATHS:
        start = 0
        while True:
            url = urljoin(BASE_URL, path)
            if start:
                url += f"?start={start}"

            print(f"  Lade Übersicht: {url}")
            soup = fetch_page(session, url)
            items = soup.find_all(class_="frodopaw-grid-item")
            print(f"    {len(items)} Hunde auf dieser Seite")
            if not items:
                break

            for item in items:
                dog = parse_overview_item(item)
                if dog:
                    dogs.append(dog)

            # Pagination: gibt es einen Link zur nächsten Seite?
            pagination = soup.find("ul", class_=lambda c: c and "pagination" in c)
            next_link = None
            if pagination:
                next_link = pagination.find("a", href=lambda h: h and f"start={start + 12}" in h)
            if not next_link:
                break
            start += 12

            if start > 200:  # Sicherheitsabbruch
                print("  Abbruch: zu viele Seiten durchsucht.")
                break

    return dogs


def parse_overview_item(item: BeautifulSoup) -> Optional[dict]:
    """Extrahiert aus einem Kachel-Element Name, Link, Foto und Kurzbeschreibung."""
    name_a = item.find(class_="paw_name")
    if not name_a:
        return None
    name_a = name_a.find("a")
    if not name_a or not name_a.get("href"):
        return None

    name = name_a.get_text(strip=True)
    link = urljoin(BASE_URL, name_a["href"])

    img_div = item.find(class_="paw_grid_img")
    img_src = None
    if img_div and img_div.find("img"):
        img_src = urljoin(BASE_URL, img_div.find("img")["src"])

    short_div = item.find(class_="paw_short_desc")
    short_text = short_div.get_text(strip=True) if short_div else ""
    # Präfix "Kurzbeschreibung:" entfernen
    short_text = re.sub(r"^Kurzbeschreibung:\s*", "", short_text, flags=re.I)

    position_div = item.find(class_="paw_position")
    position = position_div.get_text(strip=True) if position_div else ""

    return {
        "name": name,
        "quelle_url": link,
        "foto_url": img_src,
        "short_text": short_text,
        "position": position,
    }


# ---------------------------------------------------------------------------
# Detailseite parsen
# ---------------------------------------------------------------------------

def extract_rasse(short_text: str, name: str) -> Optional[str]:
    """Versucht, die Rasse aus der Kurzbeschreibung zu ermitteln."""
    if not short_text or not name:
        return None

    # Name normalisieren für Suche
    name_lower = name.lower()
    text_lower = short_text.lower()

    # Fall 1: "Rasse Name, ..." oder "Rasse-Name Name, ..."
    # Wir suchen den Namen und nehmen alles davor bis zum Satzanfang.
    idx = text_lower.find(name_lower)
    if idx > 0:
        rasse = short_text[:idx].strip()
        # Geschlechtsbezeichnungen entfernen
        rasse = re.sub(r"\b(Hündin|Rüde)\b", "", rasse, flags=re.I).strip(" ,")
        if rasse:
            return rasse

    # Fall 2: "Name, Rasse, ..." (Name steht am Anfang)
    if text_lower.startswith(name_lower):
        rest = short_text[len(name):].lstrip(", ")
        # Nimm alles bis zum ersten Komma oder bis zum ersten Datum/Maß
        match = re.match(r"([^,]+?)(?:,\s*(?:ca\.|\d{1,2}\.|\d{4}|geb\.))", rest, re.I)
        if match:
            rasse = match.group(1).strip()
            rasse = re.sub(r"\b(Hündin|Rüde)\b", "", rasse, flags=re.I).strip(" ,")
            if rasse:
                return rasse

    return None


def extract_geschlecht(text: str) -> Optional[str]:
    """Sucht nach Hündin/Rüde im Text (als ganze Wörter)."""
    if not text:
        return None
    lower = text.lower()
    if re.search(r"\bhündin\b", lower):
        return "Hündin"
    if re.search(r"\brüde\b", lower):
        return "Rüde"
    return None


def extract_groesse(text: str) -> Optional[str]:
    """Sucht nach Schulterhöhe-Angaben im Text."""
    if not text:
        return None
    # "Schulterhöhe ca. 45 cm" oder "ca. 45 cm"
    match = re.search(r"Schulterhöhe\s*ca\.?\s*(\d+)\s*cm", text, re.I)
    if match:
        return f"Schulterhöhe ca. {match.group(1)} cm"
    match = re.search(r"ca\.?\s*(\d+)\s*cm", text, re.I)
    if match:
        return f"ca. {match.group(1)} cm"
    return None


def parse_detail_page(soup: BeautifulSoup, overview_dog: dict) -> dict:
    """Kombiniert Übersichtsdaten mit den Details der Tierprofil-Seite."""
    wrapper = soup.find(class_="frodopaw_pet_wrapper") or soup

    # Name: aus der Übersicht oder der H2 auf der Detailseite
    name = overview_dog.get("name")
    h2 = wrapper.find("h2")
    if h2:
        name = h2.get_text(strip=True)

    # Hauptbild aus der Galerie
    foto_url = overview_dog.get("foto_url")
    gallery = wrapper.find(class_="paw_gallery")
    if gallery and gallery.find("img"):
        foto_url = urljoin(BASE_URL, gallery.find("img")["src"])

    # Vollständige Beschreibung: alle Text-Knoten außer Kontakt/Status/Position
    description = ""
    # Wir nehmen den Text des Wrappers, entfernen aber bekannte Metadaten-Blöcke
    for meta in wrapper.find_all(class_=["paw_state", "paw_position", "paw_contact_btn"]):
        meta.decompose()
    description = wrapper.get_text(strip=True, separator="\n")
    # Mehrfache Leerzeilen reduzieren
    description = re.sub(r"\n{2,}", "\n", description).strip()

    # Kurzbeschreibung mit einbeziehen
    short_text = overview_dog.get("short_text", "")
    full_text = f"{short_text}\n{description}".strip()

    # Alter berechnen
    alter_text = common.calculate_age_from_text(short_text) or common.calculate_age_from_text(description)

    # Rasse aus Kurzbeschreibung
    rasse = extract_rasse(short_text, name)

    # Geschlecht aus Kurzbeschreibung oder Beschreibung
    geschlecht = extract_geschlecht(short_text) or extract_geschlecht(description)

    # Größe aus Kurzbeschreibung oder Beschreibung
    groesse = extract_groesse(short_text) or extract_groesse(description)

    # Verträglichkeit
    vertraeglichkeit = common.extract_compatibility(description)

    return {
        "name": name,
        "rasse": rasse,
        "alter_text": alter_text,
        "geschlecht": geschlecht,
        "groesse": groesse,
        "foto_url": foto_url,
        "beschreibung": description or None,
        "vertraeglichkeit": vertraeglichkeit or None,
        "quelle_url": overview_dog["quelle_url"],
        "heim": HEIM_NAME,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }


def scrape_one_dog(session: requests.Session, overview_dog: dict) -> Optional[dict]:
    """Scrapt einen einzelnen Hund; Fehler führen nicht zum Abbruch des Laufs."""
    try:
        soup = fetch_page(session, overview_dog["quelle_url"])
        return parse_detail_page(soup, overview_dog)
    except Exception as exc:  # noqa: BLE001
        print(f"  FEHLER bei {overview_dog['quelle_url']}: {exc}")
        return None


# ---------------------------------------------------------------------------
# Hauptprogramm
# ---------------------------------------------------------------------------

def main() -> int:
    print("Tierheim Paderborn – Hunde-Scraper gestartet")
    print("=" * 50)

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    # 1) robots.txt prüfen
    try:
        common.check_robots_txt(BASE_URL, USER_AGENT)
    except Exception as exc:  # noqa: BLE001
        print(f"Warnung: robots.txt konnte nicht geprüft werden: {exc}")

    # 2) Übersichtsseiten parsen
    print("\nSammle Hunde-Links von den Übersichten...")
    overview_dogs = fetch_overview_pages(session)
    print(f"  {len(overview_dogs)} Detailseiten gefunden.")

    if not overview_dogs:
        print("Keine Hunde gefunden – beende.")
        return 1

    # 3) Detailseiten scrapen
    print("\nScrape Detailseiten (mit Pause zwischen den Requests)...")
    dogs: list[dict] = []
    for idx, overview_dog in enumerate(overview_dogs, start=1):
        print(f"  [{idx}/{len(overview_dogs)}] {overview_dog['quelle_url']}")
        dog = scrape_one_dog(session, overview_dog)
        if dog:
            dogs.append(dog)

    # 4) Datenbank speichern
    print("\nSpeichere in SQLite...")
    conn = common.init_db(DB_NAME)
    common.upsert_dogs(conn, dogs)

    # 5) Ergebnis ausgeben
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM hunde WHERE heim = ?", (HEIM_NAME,))
    paderborn_in_db = cursor.fetchone()[0]

    cursor.execute(
        "SELECT COUNT(*) FROM hunde WHERE heim = ? AND alter_text IS NOT NULL",
        (HEIM_NAME,),
    )
    with_age = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM hunde")
    total_in_db = cursor.fetchone()[0]

    cursor.execute(
        "SELECT name FROM hunde WHERE heim = ? ORDER BY scraped_at DESC LIMIT 3",
        (HEIM_NAME,),
    )
    first_three = [row[0] for row in cursor.fetchall()]
    conn.close()

    print("\n" + "=" * 50)
    print(f"Paderborn-Hunde in DB: {paderborn_in_db}")
    print(f"Paderborn-Hunde mit Alter: {with_age}")
    print(f"Erste 3 Paderborn-Namen: {', '.join(first_three) if first_three else '–'}")
    print(f"Gesamtzahl Hunde in DB (Gütersloh + Paderborn): {total_in_db}")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    sys.exit(main())
