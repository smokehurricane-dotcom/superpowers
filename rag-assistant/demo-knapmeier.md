# Demo-Video + Mail — Betrieb #2: H. Knapmeier GmbH (Vaillant)

**Ansprechpartner:** Herr Knapmeier (Jürgen Knapmeier, 3. Generation). Aussprache: **KNAP-mai-er** (wie geschrieben).
**Marke:** Vaillant (+ Viessmann) → Demo läuft auf **Vaillant ecoTEC plus**.

## Setup (diesmal sauber von Anfang an)
1. **Optional, für „nur Vaillant" in der Sidebar (max. tailored):**
   `python rag.py --build --corpus shk-corpus-vaillant`
   (Sonst läuft die kombinierte Demo auch gut — Vaillant-Frage zeigt Vaillant-Antwort.)
2. **Streamlit starten:** `Start RAG Assistant.cmd` (Deploy-Button ist jetzt ausgeblendet).
3. **`F11` drücken** → Browser-Vollbild → Tabs, „localhost"-URL, Lesezeichen WEG. ← **wichtigster Fix vom 1. Video.**
4. **Eine** Fenstergröße durchhalten, kein Größensprung.
5. **Probelauf** der Frage einmal, damit du die Antwort kennst.

---

## 🎬 Skript (faceless, ~85 Sek, zum Ablesen)

### Szene 1 — Hook / Problem (0–15s)
*[Bildschirm: das offene dunkle Dashboard, Vollbild]*

> „Hallo Herr Knapmeier. Sie kennen das bestimmt: Die Heizung beim Kunden wird nicht mehr richtig warm, der Wasserdruck ist abgesackt — und der Azubi ist sich nicht sicher, wie er sauber nachfüllt."

*[1 Sek Dashboard stehen lassen → Schnitt]*

### Szene 2 — Demo (15–50s)
*[tippst die Frage ein]*

> „Ich tippe hier ein, was bei Ihnen wahrscheinlich täglich vorkommt: ‚Wie fülle ich bei der Vaillant ecoTEC plus Heizwasser nach, wenn der Wasserdruck zu niedrig ist?'"

*[Antwort erscheint]*

> „Und da kommt die genaue Anleitung Schritt für Schritt: Füllhahn, Heizkörperventile öffnen, nachfüllen bis zum richtigen Druck, entlüften, prüfen. Wörtlich aus dem Vaillant-Handbuch, mit Quelle. Und findet der Assistent etwas nicht, erfindet er nichts — er sagt's ehrlich."

*[1 Sek Antwort stehen lassen → Schnitt]*

### Szene 3 — Wert + Handy + Datenschutz + CTA (50–85s)

> „Der eigentliche Nutzen: Das läuft auf Ihren Unterlagen — und nicht nur bei einem Gerät, sondern bei allem, was in Ihren Handbüchern, Datenblättern und Anleitungen steht. Ihr Monteur holt sich die Antwort beim Kunden direkt aufs Handy: Frage eintippen, Antwort vor Ort, kein Anruf in die Werkstatt oder Nachschlagen. Das richte ich so ein, wie's zu Ihnen passt. Und beim Datenschutz: Das lässt sich komplett bei Ihnen im Haus betreiben — dann verlassen Ihre Daten Ihre Firma nicht, voll DSGVO-konform. Wenn das interessant ist, antworten Sie einfach kurz auf meine Mail — dann richte ich's Ihnen unverbindlich mit einem Dokument Ihrer Wahl ein, und Sie sehen's an Ihrem eigenen Gerät. Viele Grüße aus Bielefeld, Daniel."

**Demo-Frage (zum Reinkopieren):**
`Wie fülle ich bei der Vaillant ecoTEC plus Heizwasser nach, wenn der Wasserdruck zu niedrig ist?`

---

## ✉️ Begleit-Mail

**Betreff:** Kurze Idee für Ihre Monteure — 90-Sek-Video

> Hallo Herr Knapmeier,
>
> ich bin Daniel, Entwickler aus Bielefeld. Ich hab am Wochenende einen kleinen Assistenten gebaut, der Fragen direkt aus technischen Unterlagen beantwortet — wörtlich und mit Quellenangabe. Im 90-Sekunden-Video sehen Sie's an einem Vaillant-Handbuch: Ich frage, wie man bei der ecoTEC plus Heizwasser nachfüllt, wenn der Druck abgesackt ist — und der Assistent gibt die genaue Schritt-für-Schritt-Anleitung, direkt aus dem Handbuch. [Video-Link]
>
> Gedacht vor allem für Azubis und Monteure vor Ort — Frage eintippen, Antwort sofort aufs Handy, ohne Anruf in die Werkstatt oder langes Blättern.
>
> Und das geht weit über ein Gerät hinaus: In so einen Assistenten lässt sich praktisch alles laden, was bei Ihnen an Papier herumliegt — die Anleitungen Ihrer Geräte und Werkzeuge, Datenblätter, Wartungs- und Ersatzteil-Infos, oder auch Sicherheitsdatenblätter und Betriebsanweisungen für Reiniger und Chemikalien. Gerade Letzteres kenne ich aus eigener Erfahrung: Im Ernstfall will man die richtigen Schritte sofort haben, statt erst das passende Heft zu suchen — wenn es überhaupt noch auffindbar ist.
>
> Wenn's Sie interessiert, baue ich's unverbindlich einmal mit einem Dokument Ihrer Wahl auf — Handbuch, Datenblatt oder Anleitung. Eine kurze Antwort genügt.
>
> Viele Grüße aus Bielefeld
> Daniel [Nachname]

---

## Aufnahme-Workflow (mit den Lehren aus Video #1)
1. Index ggf. auf Vaillant-only bauen, Streamlit starten, **F11-Vollbild**.
2. Demo-Frage einmal zur Probe.
3. Szene für Szene (`Win+Alt+R` Start/Stop), zwischen den Clips sammeln.
4. **In Clipchamp: die „Assistent sucht…"-Wartezeit rausschneiden** (totes Bild → kürzer, ~90 Sek).
5. Export → YouTube **„nicht gelistet"** (Titel z.B. „Handbuch-Assistent – Demo Knapmeier") → Link in die Mail.
6. **Vor dem Versenden:** Link im Inkognito-Fenster testen (sieht ein Fremder das Video?).
