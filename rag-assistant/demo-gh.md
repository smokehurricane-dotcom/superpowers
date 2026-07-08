# Demo-Video + Mail — Betrieb #3: G&H Heizungs- und Sanitärtechnik (Wolf)

**Ansprechpartner:** Herr Gehrmann (Tobias Gehrmann, Inhaber). **E-Mail: info@gundh-technik.de**
**Marke:** Wolf → Demo läuft auf **Wolf CGB-2**.

## Setup (wie bei Knapmeier, sauber)
1. **Index auf Wolf bauen:** `python rag.py --build --corpus shk-corpus-wolf`
   (Bei mpnet-Hängern: `HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1` davorsetzen.)
2. **Streamlit starten:** `Start RAG Assistant.cmd`
3. **`F11`** → Browser-Vollbild (Tabs/URL/Lesezeichen weg) — diesmal von Anfang an!
4. **Eine** Fenstergröße durchhalten.
5. **Probelauf** der Frage, damit du die Antwort kennst.

---

## 🎬 Skript (faceless, ~85 Sek, zum Ablesen)

### Szene 1 — Hook / Problem (0–15s)
*[Bildschirm: das offene dunkle Dashboard, Vollbild]*

> „Hallo Herr Gehrmann. Sie kennen das bestimmt: Die Heizung beim Kunden wird nicht mehr richtig warm, der Wasserdruck ist abgesackt — und der Azubi ist sich nicht mal sicher, wie hoch der Druck überhaupt sein muss."

*[1 Sek Dashboard stehen lassen → Schnitt]*

### Szene 2 — Demo (15–50s)
*[tippst die Frage ein]*

> „Ich tippe hier ein, was bei Ihnen wahrscheinlich täglich vorkommt: ‚Wie hoch muss der Wasserdruck bei der Wolf CGB-2 sein und was muss ich beim Nachfüllen beachten?'"

*[Antwort erscheint]*

> „Und da kommt's auf den Punkt: Der Druck muss zwischen 2,0 und 2,5 bar liegen, die Anlage vollständig gefüllt, keine Zusatzmittel ins Heizwasser. Wörtlich aus dem Wolf-Handbuch, mit Quelle. Und findet der Assistent etwas nicht, erfindet er nichts — er sagt's ehrlich."

*[1 Sek Antwort stehen lassen → Schnitt]*

### Szene 3 — Wert + Handy + Datenschutz + CTA (50–85s)

> „Der eigentliche Nutzen: Das läuft auf Ihren Unterlagen — und nicht nur bei einem Gerät, sondern bei allem, was in Ihren Handbüchern, Datenblättern und Anleitungen steht. Ihr Monteur holt sich die Antwort beim Kunden direkt aufs Handy: Frage eintippen, Antwort vor Ort, kein Anruf in die Werkstatt oder Nachschlagen. Das richte ich so ein, wie's zu Ihnen passt. Und beim Datenschutz: Das lässt sich komplett bei Ihnen im Haus betreiben — dann verlassen Ihre Daten Ihre Firma nicht, voll DSGVO-konform. Wenn das interessant ist, antworten Sie einfach kurz auf meine Mail — dann richte ich's Ihnen unverbindlich mit einem Dokument Ihrer Wahl ein, und Sie sehen's an Ihrem eigenen Gerät. Viele Grüße aus Bielefeld, Daniel."

**Demo-Frage (zum Reinkopieren):**
`Wie hoch muss der Wasserdruck bei der Wolf CGB-2 sein und was muss ich beim Nachfüllen beachten?`

> ⚠️ **Vor dem Dreh: Frage einmal im Dashboard testen.** Falls die Antwort dünn ausfällt, weichen wir auf eine Wolf-**Störung/Fehlercode**-Frage aus (Tabelle ist im Handbuch, S. 7).

---

## ✉️ Begleit-Mail

**Betreff:** Kurze Idee für Ihre Monteure — 90-Sek-Video

> Hallo Herr Gehrmann,
>
> ich bin Daniel, Entwickler aus Bielefeld. Ich hab am Wochenende einen kleinen Assistenten gebaut, der Fragen direkt aus technischen Unterlagen beantwortet — wörtlich und mit Quellenangabe. Im 90-Sekunden-Video sehen Sie's an einem Wolf-Handbuch: Ich frage, wie hoch der Wasserdruck bei der CGB-2 sein muss und was beim Nachfüllen zu beachten ist — und der Assistent gibt die genaue Antwort, direkt aus dem Handbuch. [Video-Link]
>
> Gedacht vor allem für Azubis und Monteure vor Ort — Frage eintippen, Antwort sofort aufs Handy, ohne Anruf in die Werkstatt oder langes Blättern.
>
> Und das geht weit über ein Gerät hinaus: In so einen Assistenten lässt sich praktisch alles laden, was bei Ihnen an Papier herumliegt — die Anleitungen Ihrer Geräte und Werkzeuge, Datenblätter, Wartungs- und Ersatzteil-Infos, oder auch Sicherheitsdatenblätter und Betriebsanweisungen für Reiniger und Chemikalien. Gerade Letzteres kenne ich aus eigener Erfahrung: Im Ernstfall will man die richtigen Schritte sofort haben, statt erst das passende Heft zu suchen.
>
> Wenn's Sie interessiert, baue ich's unverbindlich einmal mit einem Dokument Ihrer Wahl auf — Handbuch, Datenblatt oder Anleitung. Eine kurze Antwort genügt.
>
> Viele Grüße aus Bielefeld
> Daniel [Nachname]

---

## Workflow (wie #2)
F11-Vollbild → Probelauf → Szene für Szene (`Win+Alt+R`) → Clipchamp (Wartezeit rausschneiden) → YouTube „nicht gelistet" (Titel „Handbuch-Assistent – Demo G&H") → Inkognito-Test → Link in die Mail an **info@gundh-technik.de**.
