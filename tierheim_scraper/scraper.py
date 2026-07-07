#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Web-Scraper für vermittelbare Hunde des Tierheims Gütersloh.

Speichert öffentliche Tierdaten in eine SQLite-Datenbank (hunde.db).
Es werden ausschließlich Daten verwendet, die auf der öffentlichen
WordPress-Seite des Heims angezeigt werden. Pro Hund wird die
Original-URL (quelle_url) gespeichert, damit der Adoptions-Aggregator
zurück auf das Tierheim verlinken kann.

Start:
    python scraper.py

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

BASE_URL = "https://tierheim-guetersloh.de"
LIST_PATH = "/hunde/"
USER_AGENT = (
    "AdoptionsAggregator/1.0 "
    "(Kontakt: DEINE_EMAIL@example.com; +https://tierheim-guetersloh.de/hunde/)"
)
HEIM_NAME = "Tierheim Gütersloh"
DB_NAME = common.DB_NAME

# Wir scrapen ausschließlich öffentliche Seiten (/hunde/, /pets/),
# robots.txt wird vorab geprüft.


# ---------------------------------------------------------------------------
# Netzwerk-, Hilfs- und DB-Funktionen werden aus scraper_common importiert.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Scraping-Logik
# ---------------------------------------------------------------------------
# ---------------------------------------------------------------------------

def fetch_overview_pages(session: requests.Session) -> list[str]:
    """Sammelt alle Links zu Hunde-Detailseiten von der Übersicht samt Pagination."""
    pet_urls: set[str] = set()
    page = 1

    while True:
        if page == 1:
            url = urljoin(BASE_URL, LIST_PATH)
        else:
            url = urljoin(BASE_URL, f"/hunde/page/{page}/")

        print(f"  Lade Übersicht: {url}")
        if page == 1:
            # Bevorzugt requests; Playwright-Fallback falls JavaScript nötig.
            soup = fetch_page(session, url)
        else:
            soup = fetch_page(session, url)

        # Alle Links zum Custom Post Type 'pets'
        page_pets = {
            urljoin(BASE_URL, a["href"])
            for a in soup.find_all("a", href=True)
            if "/pets/" in a["href"]
        }

        new_pets = page_pets - pet_urls
        if not new_pets:
            # Keine neuen Hunde mehr -> Pagination zu Ende
            break

        pet_urls.update(new_pets)
        page += 1

        # Sicherheitsabbruch, falls etwas unerwartetes passiert
        if page > 50:
            print("  Abbruch: zu viele Seiten durchsucht.")
            break

    return sorted(pet_urls)


def fetch_page_with_playwright(url: str) -> BeautifulSoup:
    """Fallback: Lädt die Seite mit Playwright, falls JavaScript nötig ist."""
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


def fetch_page(session: requests.Session, url: str) -> BeautifulSoup:
    """Lädt eine Seite bevorzugt mit requests, sonst per Playwright."""
    resp = common.polite_get(session, url, USER_AGENT)
    soup = BeautifulSoup(resp.text, "html.parser")
    # Sanity-Check: Wenn der Body praktisch leer ist oder kein sichtbarer
    # Hauptinhalt vorhanden ist, vermuten wir JavaScript-Nachladen.
    body_text = soup.body.get_text(strip=True) if soup.body else ""
    if len(body_text) < 200:
        print(f"    Wenig Inhalt via requests, versuche Playwright: {url}")
        return fetch_page_with_playwright(url)
    return soup





def parse_detail_page(soup: BeautifulSoup, url: str) -> Optional[dict]:
    """Extrahiert die Hunde-Daten aus einer Detailseite."""
    # Name aus dem <title> oder der ersten H1/H2
    name = None
    title_tag = soup.find("title")
    if title_tag:
        name = title_tag.get_text().split("–")[0].split("|")[0].strip()

    # Fallback: größte Überschrift im Inhalt
    if not name:
        for h in soup.find_all(["h1", "h2"]):
            txt = h.get_text(strip=True)
            if txt:
                name = txt
                break

    # Biografie-Block mit Label-Wert-Paaren finden
    bio_heading = soup.find(["h2", "h3"], string=re.compile(r"Biografie", re.I))
    bio_container = None
    if bio_heading:
        bio_container = bio_heading.find_parent(
            class_=lambda c: bool(c) and "e-con" in c and "e-child" in c
        )

    data = {
        "name": name,
        "rasse": None,
        "alter_text": None,
        "geschlecht": None,
        "groesse": None,
        "foto_url": None,
        "beschreibung": None,
        "vertraeglichkeit": None,
        "quelle_url": url,
        "heim": HEIM_NAME,
        "scraped_at": datetime.now(timezone.utc).isoformat(),
    }

    if bio_container:
        widgets = bio_container.find_all(class_="elementor-widget", recursive=False)
        last_label: Optional[str] = None
        for widget in widgets:
            txt = widget.get_text(strip=True)
            if not txt:
                continue
            classes = " ".join(widget.get("class", []))

            # Labels enden mit Doppelpunkt
            if "elementor-widget-heading" in classes and txt.endswith(":"):
                last_label = txt.rstrip(":").strip()
                continue

            # Werte kommen im Meta-Data-Widget
            if "elementor-widget-cmsmasters-meta-data" in classes and last_label:
                value = txt
                if last_label == "Rasse":
                    data["rasse"] = value
                elif last_label == "Geschlecht":
                    data["geschlecht"] = value
                elif last_label == "Größe/Gewicht":
                    data["groesse"] = value
                elif last_label == "Geboren":
                    data["alter_text"] = common.calculate_age(value)
                last_label = None

    # Hauptbild: erstes Bild mit Upload-Pfad
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src")
        if src and "wp-content/uploads" in src:
            data["foto_url"] = urljoin(BASE_URL, src)
            break

    # Beschreibung aus dem Text-Editor-Widget mit den meisten sinnvollen Zeichen
    description = ""
    for editor in soup.find_all(class_="elementor-widget-text-editor"):
        txt = editor.get_text(strip=True, separator="\n")
        # Header/Footer-Widgets ausschließen: wir nehmen den längsten sinnvollen Block
        if len(txt) > len(description):
            description = txt

    if description:
        data["beschreibung"] = description
        data["vertraeglichkeit"] = common.extract_compatibility(description)

        # Fallback: Wenn der Biografie-Block kein Geburtsdatum hatte, versuchen
        # wir, das Alter aus dem Fließtext zu ermitteln.
        if data["alter_text"] is None:
            birth_from_text = common.extract_birth_date_from_text(description)
            if birth_from_text:
                data["alter_text"] = common.calculate_age(birth_from_text)

    return data


def scrape_one_dog(session: requests.Session, url: str) -> Optional[dict]:
    """Scrapt einen einzelnen Hund; Fehler führen nicht zum Abbruch des Laufs."""
    try:
        soup = fetch_page(session, url)
        return parse_detail_page(soup, url)
    except Exception as exc:  # noqa: BLE001
        print(f"  FEHLER bei {url}: {exc}")
        return None




def main() -> int:
    print("Tierheim Gütersloh – Hunde-Scraper gestartet")
    print("=" * 50)

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    # 1) robots.txt respektieren / prüfen
    try:
        common.check_robots_txt(BASE_URL, USER_AGENT)
    except Exception as exc:  # noqa: BLE001
        print(f"Warnung: robots.txt konnte nicht geprüft werden: {exc}")

    # 2) Übersichtsseiten parsen
    print("\nSammle Hunde-Links von der Übersicht...")
    pet_urls = fetch_overview_pages(session)
    print(f"  {len(pet_urls)} Detailseiten gefunden.")

    if not pet_urls:
        print("Keine Hunde gefunden – beende.")
        return 1

    # 3) Detailseiten scrapen
    print("\nScrape Detailseiten (mit Pause zwischen den Requests)...")
    dogs: list[dict] = []
    for idx, url in enumerate(pet_urls, start=1):
        print(f"  [{idx}/{len(pet_urls)}] {url}")
        dog = scrape_one_dog(session, url)
        if dog:
            dogs.append(dog)

    # 4) Datenbank speichern
    print("\nSpeichere in SQLite...")
    conn = common.init_db(DB_NAME)
    common.upsert_dogs(conn, dogs)

    # 5) Ergebnis ausgeben
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM hunde WHERE heim = ?", (HEIM_NAME,))
    total_in_db = cursor.fetchone()[0]

    cursor.execute(
        "SELECT name FROM hunde WHERE heim = ? ORDER BY scraped_at DESC LIMIT 3",
        (HEIM_NAME,),
    )
    first_three = [row[0] for row in cursor.fetchall()]

    cursor.execute(
        "SELECT COUNT(*) FROM hunde WHERE heim = ? AND alter_text IS NOT NULL",
        (HEIM_NAME,),
    )
    with_age = cursor.fetchone()[0]
    conn.close()

    print("\n" + "=" * 50)
    print(f"Gefundene Hunde in DB: {total_in_db}")
    print(f"Hunde mit Alter: {with_age}")
    print(f"Erste 3 Namen: {', '.join(first_three) if first_three else '–'}")
    print("=" * 50)
    return 0


if __name__ == "__main__":
    sys.exit(main())
