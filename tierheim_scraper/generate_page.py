#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Generiert eine statische index.html aus hunde.db.

Start:
    python generate_page.py
"""

import sqlite3
from urllib.parse import quote

DB_NAME = "hunde.db"
OUTPUT = "index.html"


def encode_image_url(url: str) -> str:
    """Kodiert Leerzeichen und andere Sonderzeichen im Bild-Pfad korrekt."""
    if not url:
        return ""
    # Nur den Pfad kodieren, Schema/Domain unverändert lassen.
    # Wir splitten bei :// und kodieren den Rest.
    if "://" in url:
        scheme, rest = url.split("://", 1)
        return f"{scheme}://{quote(rest, safe='/:')}"  # : und / nicht kodieren
    return quote(url, safe='/:')


def escape_html(text: str) -> str:
    """Escaping für sichere HTML-Ausgabe."""
    return (
        str(text)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def bucket_geschlecht(value: str) -> str:
    """Ordnet Geschlechtsangaben in männlich/weiblich/leer ein."""
    if not value:
        return ""
    lower = value.lower()
    if "männlich" in lower or "rüde" in lower:
        return "maennlich"
    if "weiblich" in lower or "hündin" in lower:
        return "weiblich"
    return ""


def normalize_size(text: str) -> str:
    """Leitet aus dem Freitext-Feld groesse eine Kategorie ab."""
    if not text:
        return ""

    import re

    lower = text.lower()

    # 1. Explizite Wörter
    if "klein" in lower:
        return "klein"
    if "mittel" in lower:
        return "mittel"
    if "groß" in lower or "gross" in lower:
        return "gross"

    # 2. cm / Schulterhöhe
    match = re.search(r"(\d+)\s*cm", text)
    if match:
        cm = int(match.group(1))
        if cm < 40:
            return "klein"
        if cm <= 55:
            return "mittel"
        return "gross"

    # 3. kg / Gewicht
    match = re.search(r"(\d+)\s*kg", text)
    if match:
        kg = int(match.group(1))
        if kg < 12:
            return "klein"
        if kg <= 25:
            return "mittel"
        return "gross"

    return ""


def render_card(dog: dict) -> str:
    """Rendert eine einzelne Hunde-Karte."""
    name = escape_html(dog["name"] or "Unbekannt")
    heim = escape_html(dog["heim"] or "")
    quelle = escape_html(dog["quelle_url"] or "#")
    foto = encode_image_url(dog["foto_url"] or "")
    beschreibung = escape_html(dog["beschreibung"] or "")
    vertraeglichkeit = (dog.get("vertraeglichkeit") or "").strip()
    geschlecht_bucket = bucket_geschlecht(dog.get("geschlecht"))
    groesse_kat = normalize_size(dog.get("groesse") or "")
    search_text = " ".join(
        str(x) for x in [dog.get("name"), dog.get("rasse"), dog.get("beschreibung")] if x
    ).lower()

    # Pills aus vorhandenen Feldern bilden
    pills = []
    for label, value in [
        ("Rasse", dog.get("rasse")),
        ("Alter", dog.get("alter_text")),
        ("Größe", dog.get("groesse")),
        ("Geschlecht", dog.get("geschlecht")),
    ]:
        if value and str(value).strip():
            pills.append(f'<span class="pill">{escape_html(value)}</span>')
    if not groesse_kat and not (dog.get("groesse") and str(dog.get("groesse")).strip()):
        pills.append('<span class="pill pill--unknown">Größe unbekannt</span>')
    pills_html = "\n".join(pills)

    foto_html = (
        f'<img src="{escape_html(foto)}" alt="Foto von {name}" loading="lazy">'
        if foto
        else f'<div class="photo-placeholder" aria-label="Kein Foto von {name}"></div>'
    )

    if vertraeglichkeit:
        vertraeglich_html = (
            f'<p class="compatibility"><span>Verträglich:</span> {escape_html(vertraeglichkeit)}</p>'
        )
    else:
        vertraeglich_html = '<p class="compatibility compatibility--empty">Verträglichkeit: beim Tierheim erfragen.</p>'

    return f"""<article class="card" role="listitem" data-heim="{escape_html(heim)}" data-geschlecht="{geschlecht_bucket}" data-groesse-kat="{groesse_kat}" data-search="{escape_html(search_text)}">
  <a class="photo-link" href="{quelle}" target="_blank" rel="noopener" aria-label="{name} beim {heim} ansehen">
    <div class="photo-wrap">{foto_html}</div>
  </a>
  <div class="card-body">
    <p class="eyebrow">{heim}</p>
    <h2 class="dog-name">{name}</h2>
    <div class="pills">{pills_html}</div>
    <p class="description">{beschreibung}</p>
    {vertraeglich_html}
    <a class="btn" href="{quelle}" target="_blank" rel="noopener">Zum Tierheim →</a>
  </div>
</article>"""


def generate_html(dogs: list[dict]) -> str:
    """Baut die komplette HTML-Seite."""
    total = len(dogs)
    shelters = sorted(set(d["heim"] for d in dogs if d.get("heim")))
    shelter_count = len(shelters)

    cards_html = "\n".join(render_card(dog) for dog in dogs)

    return f"""<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zuhause gesucht · OWL</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=Mulish:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {{
      --bg: #F6F2E9;
      --ink: #223B30;
      --ink-soft: #5C6B60;
      --accent: #DE9A47;
      --accent-deep: #C47F2E;
      --sage: #E4E7DC;
      --card: #FFFFFF;
      --line: #E6E1D4;
      --radius: 14px;
      --shadow: 0 4px 18px rgba(34, 59, 48, 0.08);
      --shadow-hover: 0 12px 32px rgba(34, 59, 48, 0.14);
    }}

    *, *::before, *::after {{
      box-sizing: border-box;
    }}

    html {{
      scroll-behavior: smooth;
    }}

    body {{
      margin: 0;
      font-family: 'Mulish', system-ui, sans-serif;
      background: var(--bg);
      color: var(--ink);
      line-height: 1.55;
    }}

    a {{
      color: var(--accent-deep);
    }}

    a:focus-visible,
    button:focus-visible {{
      outline: 3px solid var(--accent);
      outline-offset: 3px;
      border-radius: 4px;
    }}

    /* Header */
    .site-header {{
      background: var(--card);
      border-bottom: 1px solid var(--line);
      padding: 1rem 4vw;
    }}

    .site-header__inner {{
      max-width: 1200px;
      margin: 0 auto;
    }}

    .logo {{
      font-family: 'Fraunces', serif;
      font-size: 1.25rem;
      font-weight: 700;
      color: var(--ink);
      text-decoration: none;
      letter-spacing: -0.02em;
    }}

    /* Hero */
    .hero {{
      background: linear-gradient(180deg, #EDE8DC 0%, var(--bg) 100%);
      padding: 3rem 4vw 2.5rem;
      text-align: center;
    }}

    .hero__inner {{
      max-width: 760px;
      margin: 0 auto;
    }}

    .hero h1 {{
      font-family: 'Fraunces', serif;
      font-size: clamp(1.8rem, 5vw, 2.75rem);
      font-weight: 700;
      color: var(--ink);
      line-height: 1.15;
      margin: 0 0 1rem;
    }}

    .hero p {{
      margin: 0 auto 0.75rem;
      color: var(--ink-soft);
      font-size: clamp(1rem, 2vw, 1.125rem);
      max-width: 640px;
    }}

    .hero__meta {{
      display: inline-block;
      margin-top: 0.75rem;
      padding: 0.5rem 1rem;
      background: var(--sage);
      border-radius: 999px;
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--ink);
    }}

    /* Filter bar */
    .filters {{
      position: sticky;
      top: 0;
      z-index: 10;
      background: linear-gradient(180deg, #EDE8DC 0%, var(--bg) 100%);
      border-bottom: 1px solid var(--line);
      padding: 1rem 4vw;
    }}

    .filters__inner {{
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 1rem;
    }}

    .filter-field {{
      display: flex;
      flex-direction: column;
      gap: 0.35rem;
      flex: 1 1 180px;
      min-width: 160px;
    }}

    .filter-field label {{
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--ink-soft);
    }}

    .filter-field input,
    .filter-field select {{
      padding: 0.6rem 0.85rem;
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--card);
      color: var(--ink);
      font-family: inherit;
      font-size: 0.95rem;
    }}

    .filter-field input:focus-visible,
    .filter-field select:focus-visible {{
      outline: 3px solid var(--accent);
      outline-offset: 2px;
    }}

    .filter-reset {{
      padding: 0.6rem 1rem;
      border: 1px solid var(--accent);
      border-radius: 10px;
      background: transparent;
      color: var(--accent-deep);
      font-family: inherit;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease;
    }}

    .filter-reset:hover {{
      background: var(--accent);
      color: #fff;
    }}

    .filter-count {{
      width: 100%;
      margin: 0;
      font-size: 0.9rem;
      color: var(--ink-soft);
    }}

    .empty-state {{
      display: none;
      grid-column: 1 / -1;
      text-align: center;
      padding: 3rem 1rem;
      color: var(--ink-soft);
      background: var(--card);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }}

    .empty-state.is-visible {{
      display: block;
    }}

    /* Grid */
    .container {{
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 4vw 4rem;
    }}

    .grid {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.75rem;
    }}

    @media (max-width: 640px) {{
      .grid {{
        grid-template-columns: 1fr;
      }}
    }}

    /* Card */
    .card {{
      background: var(--card);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      transition: transform 0.25s ease, box-shadow 0.25s ease;
    }}

    @media (prefers-reduced-motion: reduce) {{
      .card {{
        transition: none;
      }}
    }}

    .card:hover {{
      transform: translateY(-6px);
      box-shadow: var(--shadow-hover);
    }}

    .photo-link {{
      display: block;
      text-decoration: none;
    }}

    .photo-wrap {{
      aspect-ratio: 4 / 3;
      overflow: hidden;
      background: var(--sage);
    }}

    .photo-wrap img,
    .photo-placeholder {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }}

    .photo-placeholder {{
      background: repeating-linear-gradient(
        45deg,
        var(--sage),
        var(--sage) 10px,
        var(--line) 10px,
        var(--line) 20px
      );
    }}

    .card-body {{
      padding: 1.25rem;
      display: flex;
      flex-direction: column;
      flex-grow: 1;
    }}

    .eyebrow {{
      margin: 0 0 0.5rem;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--accent-deep);
    }}

    .dog-name {{
      font-family: 'Fraunces', serif;
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--ink);
      margin: 0 0 0.75rem;
      position: relative;
      display: inline-block;
    }}

    .dog-name::after {{
      content: '';
      display: block;
      width: 2.5rem;
      height: 3px;
      background: var(--accent);
      border-radius: 2px;
      margin-top: 0.35rem;
    }}

    .pills {{
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin-bottom: 0.85rem;
    }}

    .pill {{
      display: inline-block;
      padding: 0.25rem 0.65rem;
      background: var(--sage);
      border-radius: 999px;
      font-size: 0.78rem;
      font-weight: 600;
      color: var(--ink-soft);
    }}

    .pill--unknown {{
      background: transparent;
      border: 1px dashed var(--line);
      color: var(--ink-soft);
      font-style: italic;
      font-weight: 400;
    }}

    .description {{
      margin: 0 0 0.75rem;
      color: var(--ink-soft);
      font-size: 0.95rem;
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }}

    .compatibility {{
      margin: 0 0 1.25rem;
      font-size: 0.85rem;
      color: var(--ink-soft);
      line-height: 1.45;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }}

    .compatibility span {{
      font-weight: 700;
      color: var(--ink);
    }}

    .compatibility--empty {{
      font-style: italic;
    }}

    .btn {{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.35rem;
      padding: 0.7rem 1.1rem;
      background: var(--accent);
      color: #fff;
      text-decoration: none;
      font-weight: 700;
      border-radius: 10px;
      transition: background 0.2s ease, transform 0.15s ease;
    }}

    .btn:hover {{
      background: var(--accent-deep);
    }}

    .btn:active {{
      transform: scale(0.98);
    }}

    /* Footer */
    .site-footer {{
      background: var(--card);
      border-top: 1px solid var(--line);
      padding: 2.5rem 4vw;
      text-align: center;
      color: var(--ink-soft);
      font-size: 0.95rem;
    }}

    .site-footer__inner {{
      max-width: 760px;
      margin: 0 auto;
    }}

    .site-footer strong {{
      display: block;
      color: var(--ink);
      font-weight: 700;
      margin-bottom: 0.5rem;
    }}
  </style>
</head>
<body>
  <header class="site-header">
    <div class="site-header__inner">
      <a class="logo" href="./">Zuhause gesucht · OWL</a>
    </div>
  </header>

  <section class="hero" aria-labelledby="hero-headline">
    <div class="hero__inner">
      <h1 id="hero-headline">Jeder von ihnen wartet auf ein Zuhause.</h1>
      <p>Vermittelbare Hunde aus Tierheimen in Ostwestfalen-Lippe – gebündelt an einem Ort. Adoptiert wird immer direkt beim Tierheim.</p>
      <p class="hero__meta" aria-live="polite">Aktuell {total} Hunde aus {shelter_count} Tierheimen</p>
    </div>
  </section>

  <section class="filters" aria-label="Hunde filtern">
    <div class="filters__inner">
      <div class="filter-field">
        <label for="filter-search">Suche</label>
        <input type="search" id="filter-search" placeholder="Name, Rasse, Beschreibung…" autocomplete="off">
      </div>
      <div class="filter-field">
        <label for="filter-heim">Tierheim</label>
        <select id="filter-heim">
          <option value="">Alle</option>
          <option value="Tierheim Gütersloh">Tierheim Gütersloh</option>
          <option value="Tierheim Paderborn">Tierheim Paderborn</option>
        </select>
      </div>
      <div class="filter-field">
        <label for="filter-geschlecht">Geschlecht</label>
        <select id="filter-geschlecht">
          <option value="">Alle</option>
          <option value="maennlich">Männlich</option>
          <option value="weiblich">Weiblich</option>
        </select>
      </div>
      <div class="filter-field">
        <label for="filter-groesse">Größe</label>
        <select id="filter-groesse">
          <option value="">Alle</option>
          <option value="klein">Klein</option>
          <option value="mittel">Mittel</option>
          <option value="gross">Groß</option>
        </select>
      </div>
      <button type="button" class="filter-reset" id="filter-reset">Filter zurücksetzen</button>
      <p class="filter-count" id="filter-count" aria-live="polite">{total} von {total} Hunden</p>
    </div>
  </section>

  <main class="container">
    <div class="grid" role="list">
      <div class="empty-state" id="empty-state">
        <p>Keine Hunde gefunden. Versuch's mit anderen Filtern oder setz sie zurück.</p>
      </div>
{cards_html}
    </div>
  </main>

  <footer class="site-footer">
    <div class="site-footer__inner">
      <strong>Mission</strong>
      <p>Wir verlinken direkt zu den Tierheimen – die Vermittlung läuft immer über das jeweilige Heim.</p>
    </div>
  </footer>
  <script>
    (function () {{
      const cards = Array.from(document.querySelectorAll('.card'));
      const searchInput = document.getElementById('filter-search');
      const heimSelect = document.getElementById('filter-heim');
      const geschlechtSelect = document.getElementById('filter-geschlecht');
      const groesseSelect = document.getElementById('filter-groesse');
      const resetBtn = document.getElementById('filter-reset');
      const countLabel = document.getElementById('filter-count');
      const emptyState = document.getElementById('empty-state');
      const total = cards.length;

      function filterCards() {{
        const search = searchInput.value.trim().toLowerCase();
        const heim = heimSelect.value;
        const geschlecht = geschlechtSelect.value;
        const groesse = groesseSelect.value;

        let visible = 0;
        cards.forEach(function (card) {{
          const cardHeim = card.dataset.heim || '';
          const cardGeschlecht = card.dataset.geschlecht || '';
          const cardGroesse = card.dataset.groesseKat || '';
          const cardSearch = card.dataset.search || '';

          const matchesSearch = !search || cardSearch.includes(search);
          const matchesHeim = !heim || cardHeim === heim;
          const matchesGeschlecht = !geschlecht || cardGeschlecht === geschlecht;
          const matchesGroesse = !groesse || cardGroesse === groesse;

          if (matchesSearch && matchesHeim && matchesGeschlecht && matchesGroesse) {{
            card.style.display = '';
            visible += 1;
          }} else {{
            card.style.display = 'none';
          }}
        }});

        countLabel.textContent = visible + ' von ' + total + ' Hunden';
        emptyState.classList.toggle('is-visible', visible === 0);
      }}

      function resetFilters() {{
        searchInput.value = '';
        heimSelect.value = '';
        geschlechtSelect.value = '';
        groesseSelect.value = '';
        filterCards();
        searchInput.focus();
      }}

      searchInput.addEventListener('input', filterCards);
      heimSelect.addEventListener('change', filterCards);
      geschlechtSelect.addEventListener('change', filterCards);
      groesseSelect.addEventListener('change', filterCards);
      resetBtn.addEventListener('click', resetFilters);

      filterCards();
    }})();
  </script>
</body>
</html>"""


def main() -> None:
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT name, rasse, alter_text, geschlecht, groesse, foto_url,
               beschreibung, vertraeglichkeit, quelle_url, heim
        FROM hunde
        ORDER BY heim, name
        """
    )
    dogs = [dict(row) for row in cursor.fetchall()]
    conn.close()

    html = generate_html(dogs)
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(html)

    stats = {"klein": 0, "mittel": 0, "gross": 0, "": 0}
    for dog in dogs:
        kat = normalize_size(dog.get("groesse") or "")
        stats[kat] += 1

    print(f"Seite mit Filter erstellt, {len(dogs)} Hunden.")
    print(f"  Klein: {stats['klein']}, Mittel: {stats['mittel']}, Groß: {stats['gross']}, Unbekannt: {stats['']}")


if __name__ == "__main__":
    main()
