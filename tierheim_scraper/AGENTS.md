# Agenten-Gedächtnis: Tierheim-Scraper

Diese Datei hält wichtige Learnings aus der Entwicklung des Scrapers fest,
sodass zukünftige Agenten schneller orientiert sind.

## Datenbank-Schema

- Die SQLite-Spalte für das Alter darf **nicht** `alter` heißen, da `ALTER`
  ein SQL-Schlüsselwort ist. Verwende stattdessen **`alter_text`**.
- `quelle_url` ist der eindeutige Schlüssel für das Upsert.

## Alter berechnen

1. Primär aus dem Biografie-Block der Detailseite (Label "Geboren:").
2. Fallback: Im Beschreibungstext nach Geburtsdaten suchen, z. B.:
   - `am 13.03.2012 geboren`
   - `geboren am 13.03.2012`
   - `geb. 13.03.2012`
   - `... geboren`
3. Aus dem gefundenen Datum mit `calculate_age()` ein menschenlesbares Alter
   generieren.

## Scraping-Konventionen

- `robots.txt` vor dem Scrapen prüfen und respektieren.
- Ehrlichen User-Agent verwenden (E-Mail-Adresse im Skript anpassen).
- 2–3 Sekunden Pause zwischen Requests.
- Nur öffentliche Tierdaten scrapen, keine personenbezogenen Daten.
- Pro Hund die Original-URL (`quelle_url`) speichern, um zurückzuverlinken.
- `try/except` pro Hund, damit einzelne Fehler den Lauf nicht abbrechen.

## Technik

- Requests + BeautifulSoup4 für statisches HTML.
- Playwright-Fallback vorbereiten, falls Inhalte per JavaScript nachgeladen werden.
- Pagination über `/hunde/page/{n}/` abarbeiten, bis keine neuen Hunde-Links
  mehr gefunden werden.

## Zielseite

- Übersicht: https://tierheim-guetersloh.de/hunde/
- Detailseiten: https://tierheim-guetersloh.de/pets/{slug}/
- Der Name steht im `<title>` oder in der ersten H1/H2.
- Der Biografie-Block ist ein Elementor-Container, der Label-/Value-Paare
  enthält (z. B. Rasse, Geschlecht, Größe/Gewicht, Geboren).
