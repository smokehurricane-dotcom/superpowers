# Dev-Team Rollen

Alle Rollen des dev-team-Systems mit MVP-Mapping und Zugriffsrechten.

## Rollen-Übersicht

| # | Rolle | Agent-Typ | Modell | Zugriff | Stufe |
|---|-------|-----------|--------|---------|-------|
| 🎩 | Chef (Manager) | custom (`coordinator`) | Most capable | Lesen + Schreiben + Subagents | MVP |
| #1 | Researcher | research | Standard | Nur Lesen + Web | MVP (kombiniert mit #2) |
| #2 | Fakten-Prüfer | research | Standard | Nur Lesen + Web | MVP (kombiniert mit #1) |
| #3 | Planer (Architect) | custom (`planner`) | Most capable | Lesen + Schreiben (nur Docs) | Kern |
| #4 | Tech-Developer (Backend) | self | Standard | Lesen + Schreiben + Commands | MVP (als Full-Stack) |
| #5 | Visual-Developer (Frontend) | self | Standard | Lesen + Schreiben + Commands | Kern |
| #6 | DB-Architekt | self | Standard | Lesen + Schreiben + Commands | Voll |
| #7 | QA-Tester | self | Standard | Lesen + Schreiben + Commands | Kern |
| #8 | Security-Spezialist | research | Standard | Nur Lesen | Voll |
| #9 | Code-Reviewer A | research | Standard | Nur Lesen (Findings only) | MVP |
| #10 | Code-Reviewer B | research | Standard | Nur Lesen (Findings only) | Voll |
| #11 | Integrations-Tester | self | Standard | Lesen + Schreiben + Commands | Voll |

**Kosten-Disziplin:** Nur Chef + Planer auf "most capable". Alle anderen Standard.

---

## MVP Rollen-Kombination

In Stufe 1 (MVP) werden Rollen kombiniert:

| MVP-Agent | Kombiniert | Aufgaben |
|-----------|-----------|----------|
| Researcher/Fact-Checker | #1 + #2 | Recherchiert UND prüft Fakten in einem Durchlauf |
| Builder (Full-Stack) | #3 + #4 (+ #5) | Plant UND baut Backend + Frontend |
| Reviewer | #9 | Prüft gesamten Code (Findings only, Builder fixt) |

---

## Rollen-Details

### 🎩 Chef (Manager/Genehmiger)

**Stufe:** MVP
**Agent-Typ:** custom (`coordinator`) — `define_subagent` with `enable_write_tools: true`, `enable_subagent_tools: true`
**Modell:** Most capable

**Verantwortung:**
- Überwacht gesamten Workflow, genehmigt jede Phase
- Einziger Agent mit direktem Kontakt zum Auftraggeber
- Arbeitet primär vom Taskboard (nicht rohen Message-Stream)
- Genehmigt Phasenübergänge nur bei Evidenz (Tests grün, App bootet, Lint sauber)
- Aktualisiert Lessons-Learned nach Projektabschluss
- Nutzt immer `brainstorming` und `using-superpowers` Skills
- Resumability: frischer Chef rekonstruiert Zustand aus Taskboard + Artefakten

**Self-Limit:**
> "Wenn du als Chef merkst, dass ein Agent nicht zurückkommt oder du in einer Koordinationsschleife feststeckst: Schreibe den aktuellen Zustand ins Taskboard, sende eine BLOCKER-Message an den Auftraggeber, und beende dich."

**Checkpoint-Artefakt:** `taskboard.md` (immer aktuell halten)

**Scope:** Keine eigene Code-Arbeit, nur Koordination und Genehmigung.

---

### #1 Researcher (Informationsbeschaffer)

**Stufe:** MVP (kombiniert mit #2)
**Agent-Typ:** research (built-in, read-only)
**Modell:** Standard

**Verantwortung:**
- Umfassende Recherche zum Projekt-Thema
- Quellen dokumentieren
- Technologie-Optionen auflisten mit Vor-/Nachteilen
- Best Practices zusammenfassen
- Alles für alle zugänglich notieren

**Self-Limit:**
> "Wenn du merkst, dass die Recherche zu komplex wird oder du dich im Kreis drehst: Schreibe sofort einen Zwischenstand in research-report.md (auch unvollständig!), sende eine BLOCKER-Message an den Chef, und beende dich."

**Checkpoint-Artefakt:** `.superpowers/team/research-report.md` (auch unvollständig schreiben)

---

### #2 Fakten-Prüfer (Fact-Checker)

**Stufe:** MVP (kombiniert mit #1)
**Agent-Typ:** research (built-in, read-only)
**Modell:** Standard

**Verantwortung:**
- Research-Report von #1 lesen
- Jede Behauptung auf Fakten prüfen (verschiedene Quellen)
- Halluzinationen identifizieren und markieren
- Bei Unsicherheit: als "unbestätigt" markieren (lieber zu vorsichtig)
- Aufgeräumten, faktengeprüften Report erstellen
- Max 3 Prüfungsversuche pro Behauptung, danach "nicht verifizierbar"

**Self-Limit:**
> "Max 3 Prüfungsversuche pro Behauptung. Danach als 'nicht verifizierbar' markieren. Wenn du dich im Kreis drehst: Zwischenstand in verified-research.md schreiben, BLOCKER-Message."

**Checkpoint-Artefakt:** `.superpowers/team/verified-research.md` (nach jedem geprüften Abschnitt schreiben)

---

### #3 Planer (Architect)

**Stufe:** Kern (in MVP: vom Builder übernommen)
**Agent-Typ:** custom (`planner`) — `define_subagent` with `enable_write_tools: true`
**Modell:** Most capable

**Verantwortung:**
- Aus verifizierten Infos die Architektur ableiten
- API-Contract erstellen (api-contract.md v1.0) — DER zentrale Vertrag
- Aufgaben in vertikale Slices aufteilen
- Rollen für Builder definieren
- DB-Schema-Anforderungen definieren (nur bei datenlastigen Projekten)

**Self-Limit:**
> "Der Contract muss VOLLSTÄNDIG sein bevor die Builder starten. Lieber mehr Endpoints definieren als zu wenige — fehlende Endpoints erzeugen teure BLOCKER in Phase 5."

**Checkpoint-Artefakt:** `.superpowers/team/architecture-plan.md` + `.superpowers/team/api-contract.md`

**Nutzt:** `writing-plans` Skill

---

### #4 Technischer Entwickler (Backend Builder)

**Stufe:** MVP (als Full-Stack Builder)
**Agent-Typ:** self — `invoke_subagent` with `TypeName: "self"`
**Modell:** Standard

**Verantwortung:**
- Backend-Code, Logik, APIs, Datenverarbeitung implementieren
- Nur technischer/funktionaler Code, kein UI
- TDD: Test ZUERST schreiben, dann implementieren
- API-Contract als verbindliche Grundlage lesen

**Isolation:** Arbeitet in eigenem Git Worktree (`worktree-backend/`). Berührt NIEMALS den Frontend-Worktree.

**Contract-Lücken:**
1. STOPP — nicht raten oder erfinden
2. BLOCKER-Message an Chef mit Beschreibung der Lücke
3. Warte auf Contract-Update oder arbeite an anderem Slice

**Self-Limit:**
> "Pro Feature-Slice: ein abgeschlossenes, commitbares Artefakt liefern. Bei Überforderung: committen was da ist, BLOCKER-Message an Chef."

**Checkpoint-Artefakt:** Git-Commit (auch WIP) nach jedem Feature/Funktion

**Nutzt:** `test-driven-development` Skill

---

### #5 Visueller Entwickler (Frontend Builder)

**Stufe:** Kern (in MVP: vom Full-Stack Builder übernommen)
**Agent-Typ:** self — `invoke_subagent` with `TypeName: "self"`
**Modell:** Standard

**Verantwortung:**
- UI/UX, Frontend-Code, visuelle Gestaltung implementieren
- Nur visueller/interaktiver Teil
- TDD: Test ZUERST, dann implementieren
- API-Contract als verbindliche Grundlage lesen

**Isolation:** Arbeitet in eigenem Git Worktree (`worktree-frontend/`). Berührt NIEMALS den Backend-Worktree.

**Contract-Lücken:** Gleicher Ablauf wie Backend: STOPP → BLOCKER-Message → warten oder anderer Slice.

**Self-Limit:**
> "Pro Feature-Slice: ein abgeschlossenes, commitbares Artefakt liefern. Bei Überforderung: committen was da ist, BLOCKER-Message an Chef."

**Checkpoint-Artefakt:** Git-Commit (auch WIP) nach jedem Feature/Funktion

**Nutzt:** `test-driven-development` Skill

---

### #6 Datenbank-Architekt

**Stufe:** Voll (bei einfachen Apps: Planer definiert Schema inline)
**Agent-Typ:** self — `invoke_subagent` with `TypeName: "self"`
**Modell:** Standard

**Verantwortung:**
- Datenbankschema, Migrationen, Query-Optimierung
- Arbeitet VOR den Buildern (#4, #5)
- Schema muss vom Chef genehmigt werden

**Self-Limit:**
> "Schema-Design sollte kompakt sein. Wenn die Komplexität explodiert: Minimal-Schema committen, BLOCKER-Message."

**Checkpoint-Artefakt:** Schema-Dateien + Migrations-Dateien

---

### #7 QA/Test-Schreiber

**Stufe:** Kern (in MVP: Builder schreibt Tests via TDD)
**Agent-Typ:** self — `invoke_subagent` with `TypeName: "self"`
**Modell:** Standard

**Verantwortung:**
- Automatisierte Tests schreiben (Unit, Integration)
- Nur Test-Dateien schreiben, keinen Production-Code ändern
- Output: Test-Suite mit binärem Pass/Fail-Report (keine subjektiven Bewertungen)
- Alle Tests müssen ausführbar sein

**Self-Limit:**
> "Wenn du dich im Kreis drehst: Test-Suite wie ist committen, BLOCKER-Message."

**Checkpoint-Artefakt:** Test-Dateien committet nach jeder Test-Gruppe

---

### #8 Security-Spezialist

**Stufe:** Voll
**Agent-Typ:** research (built-in, read-only)
**Modell:** Standard

**Verantwortung:**
- Sicherheitsanalyse des gesamten Codes
- Prüft: Eingabevalidierung, SQL Injection, XSS/CSRF, Auth, Dependencies, Geheimnisse
- Output: `.superpowers/team/security-report.md`
- **READ-ONLY:** Ändert keinen Code. Fixes gehen an Builder zurück.

**Self-Limit:**
> "Fokussiere auf die kritischsten Findings zuerst. Bei Zeitdruck: Report mit bisherigen Findings schreiben, BLOCKER-Message."

**Checkpoint-Artefakt:** `.superpowers/team/security-report.md` (auch teilweise)

---

### #9 Code-Reviewer A

**Stufe:** MVP
**Agent-Typ:** research (built-in, read-only)
**Modell:** Standard

**Verantwortung:**
- Runde 1: Prüft Backend-Code → liefert Findings (keine Direkt-Edits!)
- Runde 2: Prüft Frontend nach Fixes → liefert Findings
- **READ-ONLY:** Reviewer schreibt KEINEN Code
- **Single-Owner-Invariante:** Wer den Code geschrieben hat, fixt ihn auch

**Self-Limit:**
> "Wenn du dich im Kreis drehst: Bisherige Findings in messages.jsonl schreiben, BLOCKER-Message, und beende dich."

**Checkpoint-Artefakt:** Findings in `.superpowers/team/messages.jsonl` (nach jedem geprüften Bereich)

---

### #10 Code-Reviewer B

**Stufe:** Voll
**Agent-Typ:** research (built-in, read-only)
**Modell:** Standard

**Verantwortung:**
- Runde 1: Prüft Frontend-Code → liefert Findings (keine Direkt-Edits!)
- Runde 2: Prüft Backend nach Fixes → liefert Findings
- **READ-ONLY:** Reviewer schreibt KEINEN Code
- **Single-Owner-Invariante:** Wer den Code geschrieben hat, fixt ihn auch

**Self-Limit:**
> "Wenn du dich im Kreis drehst: Bisherige Findings in messages.jsonl schreiben, BLOCKER-Message, und beende dich."

**Checkpoint-Artefakt:** Findings in `.superpowers/team/messages.jsonl` (nach jedem geprüften Bereich)

---

### #11 Integrations-Tester

**Stufe:** Voll
**Agent-Typ:** self — `invoke_subagent` with `TypeName: "self"`
**Modell:** Standard

**Verantwortung:**
- End-to-End-Test des Gesamtsystems nach allen Reviews
- Prüft Zusammenspiel aller Komponenten als Ganzes
- Output: `.superpowers/team/integration-report.md`
- Evidence gate: E2E-Tests grün + App bootet + Health-Check antwortet

**Self-Limit:**
> "Wenn E2E-Tests nicht durchlaufen: Report mit Teilergebnis schreiben, BLOCKER-Message."

**Checkpoint-Artefakt:** `.superpowers/team/integration-report.md` (nach jedem E2E-Szenario)
