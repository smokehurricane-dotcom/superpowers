---
name: shadow-resume-design
description: "Design für das „Shadow-Resume\" (Always-On Equity-Curve-Gate) des Up/Down-Paper-Bots — entworfen 18.06.2026; STEHT 19.06.2026 (Daniel selbst getippt, Coaching-Modus); offen: Schwellen-Tuning auf Forward-Daten"
metadata: 
  node_type: memory
  type: project
  originSessionId: 588a28a4-2c22-4acf-8911-2520f5d6c108
---

**Shadow-Resume** = Always-On „Equity-Curve-Gate" für den Up/Down-Paper-Bot (übertragbar). Entworfen 18.06.2026 mit Daniel, **noch zu bauen** — das nächste „du tippst, ich coache"-Projekt ([[teach-coding-not-just-build]]), Ultra für Gate-/Validierungs-Logik.

**Was es löst:** Der Up/Down-Bot ist ein Münzwurf mit mechanischer TP-Edge; in schlechten Regimes (z.B. 15.–17.06.) explodiert der Deep-SL-Schwanz → Account crasht (war: $100→Peak $362→$26). Ein *blinder* Daily-Stop pausiert, weiß aber nicht, **wann er wieder anfangen** soll. Shadow-Resume erkennt die Erholung **empirisch** statt sie vorherzusagen (Richtung ist Münzwurf = nicht vorhersagbar).

**Daniels Verfeinerung (wichtig):** Der Gate läuft **von Anfang an durch** (always-on), nicht erst *nach* einem Stop-Loss → voll automatisiert.

## Zustandsmaschine
- Zustände: **SHADOW** (rechnet mit, bucht „Schatten-Trades", riskiert nichts) und **LIVE** (handelt echt).
- **Cold Start:** beginnt in **SHADOW** (kein Sonderfall mehr — einfach der Startzustand).
- **Metrik:** rollender **Netto-PnL der letzten N** Trades (~15–20). **NICHT** Anzahl positiver Trades! (Strategie gewinnt eh ~66 % über kleine TPs; das Problem sind die wenigen großen `sl_deep`-Verluste → nur der Netto-PnL fängt die ein.)
- **SHADOW → LIVE:** Netto-PnL der letzten N ≥ **ON-Schwelle** (z.B. > +X).
- **LIVE → SHADOW:** Netto-PnL ≤ **OFF-Schwelle** (z.B. < −Y).
- **Hysterese (zwei Schwellen!):** ON > OFF (Totband) → verhindert Whipsaw/ständiges Flippen an einer Schwelle.

## Ehrliche Leitplanken (Kern!)
- Equity-Curve-Gating hilft **nur, wenn schlechte Phasen *persistent* sind** (autokorreliert). **Echter Kandidat:** Vola-Clustering (Hoch-Vol-Phasen ballen sich → mehr sl_deep). **Falls Tage unabhängig** (reiner Münzwurf) → Gate = Curve-Fit-Illusion + whipsawt.
- **Overfit-anfälligste Technik überhaupt** — sieht im Rückblick *immer* toll aus (die In-Sample-+245 **nicht trauen**).
- **Einziger ehrlicher Test:** das Shadow-System trackt **beides** (was real lief + was der Gate getan hätte) → **gated vs. ungated VORWÄRTS (out-of-sample)** über Wochen vergleichen. Erst wenn's vorwärts hält → glauben.
- N + Schwellen auf Paper tunen, nicht festklopfen.

## Bau-Reihenfolge (nach Wochen-Reset, frische Session)
1. **Shadow-Resume** (dieses Design, Coaching/Ultra)
2. **Launcher/Video-Pass:** Doppelklick-Starter für alle 6 Tools (`.cmd`/Mini-Launcher; RAG+Streamlit = **Launcher statt Monster-.exe**), alle live laufen lassen + **Demo-Videos/GIFs** + neue Bilder + saubere Ordnerstruktur (dient Conversion/Gig-Galerie — der eigentliche Engpass ist Klicks/Reviews, nicht Tool-Breite).
3. **LangGraph-Agent lernen** (kleiner Agent → öffnet den AI-Agent-Debugging-Jobmarkt $30–60/h; ehrlich: Daniel hat noch keine LangGraph-Erfahrung → lernen statt blind auf „Expert"-Jobs bewerben).

## Stand 2026-06-19 (Coaching-Session, Schritt 1 FERTIG)
- **Schritt 1 (Zustandsmaschine) gebaut & getestet:** `shadow_gate.py`, Klasse `ShadowGate` — `__init__(n=20, on=10.0, off=-10.0, state="SHADOW")`, `assert on>off`, Fenster `deque(maxlen=n)`; Properties `rolling` (Netto-PnL der letzten n) + `is_live`; `record(pnl)`: append → wenn `len<n` bleib SHADOW; sonst Hysterese per `if/elif` (SHADOW→LIVE bei `rolling>=on`, LIVE→SHADOW bei `rolling<=off`), gibt `state` zurück. Selbsttest (n=3, on=2, off=-2) kippt sauber SHADOW→LIVE→SHADOW. **Daniel hat selbst getippt** ([[teach-coding-not-just-build]]), inkl. 3 Editor-/Syntax-Hürden gemeistert.
- **★ ZWEI-KOPIEN-WARNUNG (wichtig für ALLE künftige Bot-Arbeit):** Der Bot existiert doppelt. **Ubuntu `/home/k9l0v3r/polymarket-bot` = die ECHTE, laufende Kopie** (`updown_paper.py --loop` + `dashboard.py` laufen via `~/kronos-venv/bin/python` von dort; neuer). `C:\Users\petra\polymarket-bot` (= `/c/...` im Git-Bash-Tool, HOME dort) ist eine **ÄLTERE Dublette** (Stand 13.06.). Andere Inodes, kein Symlink. → IMMER in der Ubuntu-Kopie arbeiten: `wsl.exe -- bash -lc "..."` bzw. Daniels WSL-Terminal. `shadow_gate.py` liegt korrekt in Ubuntu.
- **Editor-Lehren:** Windows-Editor (Notepad) hängt `.txt` an + erzeugt CRLF (`^M`) → in WSL **`nano`** nutzen. Datei muss exakt `shadow_gate.py` heißen (kein `.txt`), sonst kein `import`.
- **Schritt 2 (NÄCHSTE Session, volles Budget):** `ShadowGate` an die echten Trade-Abschlüsse hängen — `record(realized_pnl)` bei jedem geschlossenen Trade in `resolve_finished()` (updown_paper.py:149) + `take_profit_positions()` (:239). DABEI **beide Equity-Kurven** mitschreiben: `gated` (nur Trades, die in LIVE liefen) vs. `ungated` (alle) → der ehrliche Out-of-Sample-Vergleich (siehe „Ehrliche Leitplanken"). Optional vorab die Doppel-Buchhaltung noch isoliert in `shadow_gate.py` ergänzen, dann verdrahten. ACHTUNG: `updown_paper.py --loop` läuft live → vorsichtig/atomar einbauen.

**★ Update 2026-06-19 — Schritt 2a + 2b FERTIG & LIVE.** **2a:** `shadow_gate.py` erweitert um `ungated`/`gated`-Zähler + `record(pnl, live)` + `to_dict/from_dict` (Persistenz); Roundtrip- + Dual-Curve-Test grün. **2b:** in `updown_paper.py` verdrahtet — Helfer `load_gate/save_gate/update_gate` (Datei `shadow_gate_state.json`, atomar). `update_gate(acc)` füttert pro Zyklus nur die NEUEN Einträge aus `acc.state['closed']` (Zeiger `seen` → fängt ALLE Exit-Typen automatisch) und **überspringt beim 1. Lauf die Historie** (`default_seen=len(closed)` = Vorwärts-Test ab jetzt, kein In-Sample-Fit). `scan_and_trade(acc, only=, live=gate.is_live)` taggt jede neue Position mit `meta['live']`; eingehängt in `tick()` + `--loop` nach `take_profit`. Loop via Supervisor `run_updown.sh` neu gestartet, läuft mit neuem Code (kein Crash), State-Datei wird live geschrieben. Apply lief über atomares Python-Replace-Skript (Quoting über WSL-Grenze) mit Safe-Abort. **Bot seit 19.06. AN** (`{on:true}`), sammelt Vorwärts-Daten (erste Trades geschlossen). **Paper-Kapital auf $250 erhöht** (State-Datei start/cash=250; race-frei via Stop→Rewrite→Respawn; `START`-Konstante in updown_paper.py bleibt 100 für Neuanlage). **Kapital ab jetzt KONSTANT lassen** — Ändern verschiebt die $-Skala, an der die Schwellen kalibriert werden. Stakes sind auf $5 gedeckelt + Kelly-gegen-Equity (bei $100 waren manche <$5, z.B. $1.76 → $250 = gleichmäßiger). Flag-`base`=100 ist harmlos (`AUTO_OFF=False` → `check_session` No-op). Schwellen N=20/ON=10/OFF=-10 = **PLATZHALTER**, auf Paper-Daten tunen (TODO im Code). **Offen (2c):** Dashboard-Anzeige gated vs. ungated, dann Schwellen-Tuning + Wochen-Vorwärtsvergleich. Editor-Lehre bestätigt: VS Code + WSL-Extension löste die Notepad-Probleme (CRLF/.txt/verlorene Zeilen). **★ TUNING-HÜRDE (19.06. geprüft):** Aktueller Account `closed=0` (frischer Reset) → nichts zum Tunen. Historie (alte Windows-Kopie, 2290 Trades: mean +0.09, win +2.38/n1520, loss −4.72/n724, 20-Trade-Swing min/p10/p50/p90/max = −72/−22/+2/+25/+83) ist UNBRAUCHBAR zum Tunen: falsches Regime (held-to-resolution, nicht 5m+TP40) + darauf optimieren = die Overfit-Falle. → **Schwellen N/ON/OFF NUR auf FORWARD-Daten der aktuellen Config tunen; Platzhalter 20/10/−10 stehen lassen, bis echte Daten da sind. Nächster echter Schritt: Bot AN (`python updown_paper.py --on`)**, sonst sammelt das Gate nie Daten. 2c (Dashboard) zeigt bis dahin nur 0/0.

**★★ STAND 2026-06-19 (Folge-Session) — SHADOW-RESUME „STEHT".** Daniel meldet das Feature als im Kern **fertig** — Zustandsmaschine + Verdrahtung + Dual-Curve-Buchhaltung gebaut, läuft. **Daniel hat den Code selbst getippt** (Coaching-Modus [[teach-coding-not-just-build]] = erster voller Eigenbau-Erfolg, nicht nur Schritt 1). Damit ist der Bau-Punkt 1 der Reihenfolge **erledigt** → als nächstes Launcher/Video-Pass bzw. agentic-RAG (siehe Roadmap [[freelance-income-project]]). **Weiterhin offen (kein Bau mehr, sondern Betrieb):** Schwellen N/ON/OFF (Platzhalter 20/10/−10) **auf echten Forward-Daten tunen** (NICHT auf Historie — Overfit-Falle, siehe oben) + gated-vs-ungated über Wochen vergleichen, bevor man dem Gate glaubt. Substep-Details (2c Dashboard-Anzeige) bei Bedarf gegen aktuellen Code/Daniel verifizieren statt aus dieser Notiz als Fakt zu zitieren.

Verwandt: [[polymarket-strategy-2026-06]] (0.40-Sperre, Reset, FV-Erkenntnis), [[freelance-income-project]].
