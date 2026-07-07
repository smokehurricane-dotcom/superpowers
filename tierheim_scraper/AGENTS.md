# Agenten-Gedächtnis: Tierheim-Scraper

Diese Datei hält wichtige Learnings aus der Entwicklung der Scraper fest,
sodass zukünftige Agenten schneller orientiert sind.

## Projektstruktur

- `scraper_common.py` – Gemeinsame Funktionen für alle Heim-Scraper:
  - Höfliche Requests (`polite_get`)
  - robots.txt-Prüfung
  - Altersberechnung (`calculate_age`, `calculate_age_from_text`)
  - Verträglichkeits-Extraktion
  - SQLite-DB (`init_db`, `upsert_dogs`)
- `scraper.py` – Gütersloh-Scraper (WordPress/Elementor)
- `paderborn_scraper.py` – Paderborn-Scraper (Joomla/com_frodopaw)
- `hunde.db` – Gemeinsame SQLite-Datenbank

## Datenbank-Schema

- Die SQLite-Spalte für das Alter heißt **`alter_text`** (nicht `alter`,
  da `ALTER` ein SQL-Schlüsselwort ist).
- `quelle_url` ist der eindeutige Schlüssel für das Upsert.
- `heim` unterscheidet die Quellen (z. B. "Tierheim Gütersloh",
  "Tierheim Paderborn").

## Alter berechnen

1. Primär aus strukturierten Feldern (z. B. "Geboren:" bei Gütersloh).
2. Fallback: Im Text nach Geburtsdaten suchen:
   - `am 13.03.2012 geboren`
   - `geboren am 13.03.2012`
   - `geb. 13.03.2012`
   - `... geboren`
   - `ca. 01/2025 geb.`
   - `2011 geb.`
   - `ca. 1,5 Jahre alt`
3. Verwende `calculate_age_from_text(text)` aus `scraper_common.py`.

## Joomla/com_frodopaw (Paderborn)

- Übersicht: `.frodopaw_category_pets` → `.frodopaw-grid-item`
- Name + Link: `.paw_name a`
- Bild: `.paw_grid_img img`
- Kurzbeschreibung: `.paw_short_desc .paw_text`
- Detailseite: `.frodopaw_pet_wrapper`
- Detailbild: `.paw_gallery img`
- Pagination: `?start=12`, `?start=24`, ...
- Rasse/Geschlecht/Größe stehen meist in der Kurzbeschreibung und müssen
  per Regex extrahiert werden.

## WordPress/Elementor (Gütersloh)

- Übersicht: `/hunde/` mit Links zu `/pets/{slug}/`
- Detailseite: Biografie-Block mit Label-Value-Paaren
  (Rasse, Geschlecht, Größe/Gewicht, Geboren)
- Hauptbild: erstes `img` mit `wp-content/uploads`
- Beschreibung: `elementor-widget-text-editor`

## Scraping-Konventionen

- `robots.txt` vor dem Scrapen prüfen und respektieren.
- Ehrlichen User-Agent verwenden (E-Mail-Adresse im Skript anpassen).
- 2–3 Sekunden Pause zwischen Requests.
- Nur öffentliche Tierdaten scrapen, keine personenbezogenen Daten.
- Pro Hund die Original-URL (`quelle_url`) speichern, um zurückzuverlinken.
- `try/except` pro Hund, damit einzelne Fehler den Lauf nicht abbrechen.
- Playwright-Fallback vorbereiten, falls Inhalte per JavaScript nachgeladen werden.
