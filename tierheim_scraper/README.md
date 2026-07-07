# Tierheim Gütersloh – Hunde-Scraper

Teil eines Adoptions-Aggregators. Sammelt öffentlich sichtbare Hunde-Daten von
https://tierheim-guetersloh.de/hunde/ und speichert sie in `hunde.db`.

## Start

```bash
pip install -r requirements.txt
python scraper.py
```

## Wichtig: User-Agent anpassen

Öffne `scraper.py` und ersetze im `USER_AGENT` die Platzhalter-E-Mail durch deine
Kontaktadresse, damit das Tierheim bei Fragen dich erreichen kann.

## Was passiert?

1. `robots.txt` wird geprüft und respektiert.
2. Die Übersichtsseite(n) werden mit `requests` geladen (Playwright-Fallback,
   falls JavaScript nötig wird).
3. Jede gefundene Hunde-Detailseite wird besucht (2,5 s Pause zwischen Requests).
4. Daten werden in `hunde.db` / Tabelle `hunde` gespeichert.
5. Bestehende Einträge werden über `quelle_url` aktualisiert (Upsert).
6. Am Ende wird die Anzahl gefundener Hunde und die ersten 3 Namen ausgegeben.

## Felder

`name`, `rasse`, `alter_text` (berechnet aus "Geboren" oder Beschreibung), `geschlecht`, `groesse`,
`foto_url`, `beschreibung`, `vertraeglichkeit`, `quelle_url`, `heim`,
`scraped_at`.
