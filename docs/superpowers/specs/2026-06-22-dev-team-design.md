# Dev-Team Skill — Design Specification (v3)

**Date:** 2026-06-22
**Revision:** v3 — v2 + Claude Opus Praxis-Feedback (Mechanik, Resumability, Ownership)
**Status:** Approved (pending final review)
**Author:** Chef-Orchestrator + Auftraggeber (Petra)

---

## Übersicht

Ein wiederverwendbarer Superpowers-Skill namens `dev-team`, der als **dünner Orchestrator über erprobten Superpowers-Primitiven** ein virtuelles Software-Entwicklungsteam koordiniert. Der Skill skaliert von einer MVP-Version mit 4 Agenten bis zum vollständigen 11-köpfigen Team.

> [!IMPORTANT]
> **Kernprinzipien v3:**
> 1. Vorhandene Superpowers-Skills **komponieren**, nicht nachbauen
> 2. **Resumability:** Jeder Zustand muss aus Dateien rekonstruierbar sein — Sessions sterben, Dateien überleben
> 3. **Single-Owner:** Pro Dateibereich gibt es genau einen Schreiber — immer

## Ziel

Eigenständige Entwicklung vollfunktionsfähiger Software durch ein spezialisiertes Agenten-Team, bei dem:
- Ein Chef alle Arbeit überwacht und genehmigt
- Brainstorming und Using-Superpowers immer genutzt werden
- Informationen umfassend gesammelt und faktengeprüft werden
- Code parallel in **isolierten Git Worktrees** entwickelt wird
- Qualitäts-Gates auf **Evidenz** basieren (Tests grün, App bootet, Lint sauber)
- Das Team iterativ in **vertikalen Slices** arbeitet statt im strikten Wasserfall
- Fehler in einer **read-only Wissensdatenbank** festgehalten werden (Prompt-Änderungen nur mit menschlichem Review)

---

## Skalierungsmodell: MVP → Full Team

> [!IMPORTANT]
> **"Make it work with 4 before 12."** Das vollständige Team wird erst aktiviert, nachdem die MVP-Version an einem echten Projekt erfolgreich durchgelaufen ist.

> [!CAUTION]
> **Erster Lauf = Wegwerf-Projekt.** Den MVP NICHT an einem Projekt testen, das dir wichtig ist. Nimm ein bewusst winziges Wegwerf-Projekt (CLI-Todo-App, 1-Endpoint-API + 1 Seite), an dem du jeden Schritt mit eigenen Augen debuggen und die Orchestrierung selbst validieren kannst. Erst danach an echte Projekte.

### Stufe 1: MVP (4 Agenten) — Einstieg

| # | Rolle | Agent-Typ | Modell |
|---|-------|-----------|--------|
| 🎩 | **Chef** | custom (`coordinator`) | Most capable |
| #1+2 | **Researcher/Fact-Checker** (kombiniert) | research | Standard |
| #3+4 | **Builder** (Full-Stack, plant + baut) | self | Most capable |
| #9 | **Reviewer** | research | Standard |

**Workflow MVP:** Recherche → Planung + Build → Review → Abnahme
**Wann skalieren:** Wenn MVP stabil läuft und Projekte zu groß für einen Builder werden.
**Kosten-Realität:** Auch optimiert: 11 Agenten × mehrere Slices × Review-Loops = viele Tokens. Realistisch lebst du lange in der 4-Agenten-MVP — das volle Team ist eher Nordstern als Alltag.

### Stufe 2: Kern-Team (7 Agenten) — Parallelisierung

Adds: Separater Planer (#3), Frontend-Builder (#5), QA-Tester (#7)

### Stufe 3: Vollständiges Team (11 Agenten) — Enterprise

Adds: DB-Architekt (#6), Security (#8), Reviewer B (#10), Integrations-Tester (#11)

---

## Skill-Komposition: Vorhandene Superpowers nutzen

> [!IMPORTANT]
> Der dev-team-Skill baut auf diesen existierenden Skills auf und **ersetzt sie nicht**:

| Existierender Skill | Wird genutzt für | Phase |
|---------------------|------------------|-------|
| `brainstorming` | Initiales Projektverständnis, Design-Exploration | Vor Phase 1 |
| `writing-plans` | Architekturplan erstellen (Phase 3) | Phase 3 |
| `executing-plans` | Plan-Ausführung mit Checkpoints | Phase 4–5 |
| `subagent-driven-development` | Builder-Agenten dispatchen + reviewen | Phase 4–5 |
| `dispatching-parallel-agents` | Parallele Builder (#4 + #5) starten | Phase 5 |
| `using-git-worktrees` | **Isolation** für parallele Builder | Phase 5 |
| `test-driven-development` | Builder folgen TDD (Red-Green-Refactor) | Phase 4–5 |
| `requesting-code-review` | Diszipliniertes Review-Pattern | Phase 7 |
| `receiving-code-review` | Review-Feedback verarbeiten | Phase 7 |
| `systematic-debugging` | Fehlersuche bei Problemen | Jederzeit |
| `verification-before-completion` | **Evidenz-basierte Gates** | Jede Phase |
| `using-superpowers` | Skill-Checks bei jeder Aktion | Immer |

---

## Team-Zusammensetzung (Vollständiges Team)

### Rollen-Übersicht

| # | Rolle | Agent-Typ | Modell | Zugriff |
|---|-------|-----------|--------|---------|
| 🎩 | **Chef** (Manager) | custom (`coordinator`) | Most capable | Lesen + Schreiben + Subagents |
| #1 | **Researcher** | research | Standard | Nur Lesen + Web |
| #2 | **Fakten-Prüfer** | research | Standard | Nur Lesen + Web |
| #3 | **Planer** (Architect) | custom (`planner`) | Most capable | Lesen + Schreiben (nur Docs) |
| #4 | **Tech-Developer** (Backend) | self | Standard | Lesen + Schreiben + Commands |
| #5 | **Visual-Developer** (Frontend) | self | Standard | Lesen + Schreiben + Commands |
| #6 | **DB-Architekt** | self | Standard | Lesen + Schreiben + Commands |
| #7 | **QA-Tester** | self | Standard | Lesen + Schreiben + Commands |
| #8 | **Security-Spezialist** | research | Standard | Nur Lesen |
| #9 | **Code-Reviewer A** | research | Standard | **Nur Lesen** (Findings only) |
| #10 | **Code-Reviewer B** | research | Standard | **Nur Lesen** (Findings only) |
| #11 | **Integrations-Tester** | self | Standard | Lesen + Schreiben + Commands |

> [!TIP]
> **Kosten-Disziplin:** Nur **Chef + Planer** nutzen das teuerste Modell. Alle anderen arbeiten auf Standard-Modellen. Ein vollständiger Durchlauf mit 6+ "most capable" Agenten wäre unverhältnismäßig teuer.

### Rollen-Details

#### 🎩 Chef (Manager/Genehmiger)
- **Verantwortung:** Überwacht den gesamten Workflow, genehmigt jede Phase, kommuniziert mit dem Auftraggeber
- **Besonderheiten:**
  - Einziger Agent mit direktem Kontakt zum Auftraggeber
  - Arbeitet primär vom **Taskboard** (nicht den rohen Message-Stream lesen — Kontext läuft sonst voll)
  - Genehmigt Phasenübergänge nur bei **Evidenz** (Tests grün, App bootet, Lint sauber)
  - Aktualisiert Lessons-Learned nach Projektabschluss
  - Nutzt immer `brainstorming` und `using-superpowers` Skills
  - **Resumability:** Chef-Session kann jederzeit sterben — ein frischer Chef rekonstruiert den Zustand vollständig aus Taskboard + Artefakten
- **Scope:** Keine eigene Code-Arbeit, nur Koordination und Genehmigung

#### #1 Researcher (Informationsbeschaffer)
- **Verantwortung:** Umfassende Recherche zum Projekt-Thema
- **Output:** `.superpowers/team/research-report.md`
- **Anforderungen:**
  - Möglichst umfangreich recherchieren
  - Quellen dokumentieren
  - Technologie-Optionen auflisten
  - Best Practices zusammenfassen
  - Alles für alle zugänglich notieren
- **Self-Limit:** Agent instruiert sich selbst, nach ~50k Tokens ein Zwischenartefakt zu schreiben. Echte Sicherheit kommt durch kleinen Task-Scope + gecheckpointete Artefakte, nicht durch externe Laufzeit-Wächter

#### #2 Fakten-Prüfer (Fact-Checker)
- **Verantwortung:** Verifizierung aller gesammelten Informationen
- **Prozess:**
  1. Research-Report von #1 lesen
  2. Jede Behauptung auf Fakten prüfen
  3. Halluzinationen identifizieren und markieren
  4. Bei Unsicherheit: mehrfach prüfen (verschiedene Quellen)
  5. Aufgeräumten, faktengeprüften Report erstellen
- **Output:** `.superpowers/team/verified-research.md`
- **Anforderungen:** Lieber zu vorsichtig als zu locker, im Zweifel als "unbestätigt" markieren
- **Retry-Limit:** Max 3 Durchgänge pro Behauptung. Danach als "nicht verifizierbar" markieren

#### #3 Planer (Architect)
- **Verantwortung:** Architektur, Aufgabenverteilung und **API-/Interface-Contract** planen
- **Nutzt:** `writing-plans` Skill
- **Input:** Verifizierter Research-Report
- **Prozess:**
  1. Aus verifizierten Infos die Architektur ableiten
  2. **API-Contract erstellen** — explizites Interface-Dokument, das #4 und #5 BEIDE als Vertrag lesen
  3. Mit Chef: Rollen für #4 und #5 definieren
  4. Mit Chef + Auftraggeber: Technologie-Stack abstimmen
  5. Aufgaben in **vertikale Slices** aufteilen (je ein Feature komplett durch: DB → Backend → Frontend → Test)
  6. DB-Schema-Anforderungen für #6 definieren (nur bei datenlastigen Projekten)
- **Output:**
  - `.superpowers/team/architecture-plan.md`
  - `.superpowers/team/api-contract.md` — **der zentrale Vertrag zwischen Backend und Frontend**
- **Interaktion:** Chef leitet Fragen an Auftraggeber weiter bezüglich:
  - Verwendete Sprachen/Frameworks
  - Genaues Coding-Vorgehen
  - Weitere Ideen/Anforderungen

#### #4 Technischer Entwickler (Backend Builder)
- **Verantwortung:** Backend-Code, Logik, APIs, Datenverarbeitung
- **Scope:** Nur technischer/funktionaler Code, kein UI
- **Nutzt:** `test-driven-development` Skill (Red-Green-Refactor)
- **Isolation:** Arbeitet in **eigenem Git Worktree** (`feature-backend` Branch)
- **Kommunikation:**
  - Meldet Unklarheiten an Chef via messages.jsonl
  - Chef entscheidet ob Auftraggeber informiert wird
  - Liest API-Contract und DB-Schema als verbindliche Grundlage
- **Constraints:** Arbeitet nur in zugewiesenen Dateien/Verzeichnissen
- **Self-Limit:** Pro Feature-Slice ein abgeschlossenes, commitbares Artefakt liefern. Bei Überforderung: committen was da ist, BLOCKER-Message an Chef

#### #5 Visueller Entwickler (Frontend Builder)
- **Verantwortung:** UI/UX, Frontend-Code, visuelle Gestaltung
- **Scope:** Nur visueller/interaktiver Teil
- **Nutzt:** `test-driven-development` Skill
- **Isolation:** Arbeitet in **eigenem Git Worktree** (`feature-frontend` Branch)
- **Parallel zu:** #4 (gleichzeitig, physisch getrennte Arbeitsverzeichnisse)
- **Liest:** API-Contract (verbindlich), DB-Schema von #6

#### #6 Datenbank-Architekt (Bedingt)
- **Verantwortung:** Datenbankschema, Migrationen, Query-Optimierung
- **Timing:** Arbeitet VOR #4 und #5
- **Output:** Schema-Definition, Migrations-Dateien, Datenbank-Setup
- **Chef-Genehmigung:** Schema muss vom Chef genehmigt werden bevor Entwickler starten

> [!NOTE]
> **DB-First nur bei datenlastigen Projekten.** Bei einfachen Apps ohne komplexes Datenmodell kann der Planer (#3) das Schema inline im architecture-plan.md definieren und Phase 4 entfällt.

#### #7 QA/Test-Schreiber
- **Verantwortung:** Automatisierte Tests (Unit, Integration)
- **Timing:** Nach Entwicklung (#4, #5), vor Code-Review
- **Scope:** Nur Test-Dateien schreiben, keinen Production-Code ändern
- **Output:** Test-Suite mit **binärem Pass/Fail-Report** (keine subjektiven LLM-Bewertungen)
- **Evidenz-Gate:** Alle Tests müssen in CI/CD ausführbar sein

#### #8 Security-Spezialist
- **Verantwortung:** Sicherheitsanalyse des gesamten Codes
- **Parallel zu:** #7 (gleichzeitig)
- **Prüft:**
  - Eingabevalidierung, SQL Injection, XSS/CSRF
  - Authentifizierung/Autorisierung
  - Dependency-Sicherheit, Geheimnisse im Code
- **Output:** `.superpowers/team/security-report.md`
- **Read-only:** Ändert keinen Code, nur Bericht. Fixes gehen an Builder zurück.

#### #9 Code-Reviewer A
- **Nutzt:** `requesting-code-review` + `receiving-code-review` Skills
- **Verantwortung:**
  - Runde 1: Prüft Backend-Code (#4) → **liefert Findings** (keine Direkt-Edits!)
  - Runde 2: Prüft Frontend nach #5s Fixes → **liefert Findings**
- **Read-Only:** Reviewer schreiben KEINEN Code. Findings gehen an den ursprünglichen Builder.
- **Invariante:** Single-Owner pro Dateibereich — wer den Code geschrieben hat, fixt ihn auch

#### #10 Code-Reviewer B
- **Nutzt:** `requesting-code-review` + `receiving-code-review` Skills
- **Verantwortung:**
  - Runde 1: Prüft Frontend-Code (#5) → **liefert Findings** (keine Direkt-Edits!)
  - Runde 2: Prüft Backend nach #4s Fixes → **liefert Findings**
- **Read-Only:** Reviewer schreiben KEINEN Code. Findings gehen an den ursprünglichen Builder.
- **Invariante:** Single-Owner pro Dateibereich — wer den Code geschrieben hat, fixt ihn auch

#### #11 Integrations-Tester
- **Verantwortung:** End-to-End-Test des Gesamtsystems
- **Timing:** Nach allen Reviews abgeschlossen
- **Prüft:** Zusammenspiel aller Komponenten als Ganzes
- **Output:** `.superpowers/team/integration-report.md`
- **Evidenz-Gate:** App muss booten und E2E-Tests bestehen

---

## Phasen-Workflow (Iterativ statt Wasserfall)

> [!IMPORTANT]
> **Vertikale Slices:** Statt alle Phasen einmal linear durchzulaufen, arbeitet das Team in **Feature-Slices**. Jedes Feature durchläuft den Zyklus Research → Plan → Build → Test → Review. Erst wenn ein Slice fertig und verifiziert ist, beginnt der nächste.

> [!WARNING]
> **Robustheit durch Selbst-Limitierung und Checkpoints:**
> - **Self-Limits:** Agenten instruieren sich selbst, bei Komplexität Zwischenartefakte zu schreiben. Externe Laufzeit-Wächter gibt es nicht — die echte Sicherheit kommt durch **kleinen Task-Scope** + **gecheckpointete Artefakte**.
> - **Retry-Limit:** Max 3 Versuche pro Phase-Aufgabe. Agent liefert Teilergebnis ab, sendet BLOCKER-Message. Chef eskaliert an Auftraggeber.
> - **Resumability:** Wenn eine Session abstürzt (Kontextlimit, API-Fehler, User geht weg), rekonstruiert ein frischer Chef den Zustand aus Taskboard + Artefakten und macht weiter.

### Phase 1: Informationsbeschaffung
```
Trigger: Neues Projekt vom Auftraggeber
Agent: #1 Researcher
Status: Chef überwacht

#1 → Recherchiert umfassend (Self-Limit: Zwischenartefakt bei Komplexität)
#1 → Schreibt research-report.md
#1 → Meldet Fertigstellung via messages.jsonl
Chef → Prüft Vollständigkeit, gibt Phase 2 frei
```

### Phase 2: Fakten-Check
```
Voraussetzung: Phase 1 abgeschlossen, Chef genehmigt
Agent: #2 Fact-Checker

#2 → Liest research-report.md
#2 → Prüft jede Behauptung (max 3 Retries pro Claim)
#2 → Entfernt/markiert Halluzinationen
#2 → Schreibt verified-research.md
Chef → Prüft, gibt Phase 3 frei
```

### Phase 3: Planung + Contract-Design (Interaktiv)
```
Voraussetzung: Phase 2 abgeschlossen, Chef genehmigt
Agenten: #3 Planer + Chef + Auftraggeber
Nutzt: writing-plans Skill

#3 → Liest verified-research.md
#3 → Entwirft Architektur in vertikalen Slices
#3 → Erstellt API-Contract (api-contract.md) ← KRITISCH
#3 + Chef → Stimmen Rollen für #4, #5 ab
Chef → Leitet Fragen an Auftraggeber weiter
Chef → Genehmigt finalen Plan + Contract
#3 → Schreibt architecture-plan.md + api-contract.md
```

> [!IMPORTANT]
> **API-Contract ZUERST.** Der Contract definiert alle Schnittstellen zwischen Backend und Frontend als verbindlichen Vertrag. Ohne Contract kein paralleles Development. Sonst baut Backend eine API, die das Frontend anders erwartet.

> [!WARNING]
> **Der Contract ändert sich während des Builds — das ist normal.** Builder entdecken Lücken im Contract erst in Phase 5 (das passiert immer). Daher gibt es ein **Contract-Change-Protokoll:**
>
> 1. Builder stößt auf Lücke/Widerspruch im Contract → `BLOCKER`-Message an Chef
> 2. Chef + Planer (#3) evaluieren → Contract-Update mit **Versionsnummer** (v1.1, v1.2, ...)
> 3. Aktualisierter `api-contract.md` wird committet mit Änderungslog
> 4. **Beide Builder** werden über Contract-Änderung informiert → re-syncen ihren Code
> 5. Bei Breaking Changes: betroffener Builder stoppt, wartet auf neue Contract-Version
>
> Ohne dieses Protokoll kommt die Integrations-Drift durch die Hintertür zurück.

### Phase 4: Datenbank-Design (Bedingt)
```
Voraussetzung: Phase 3 abgeschlossen, Chef genehmigt
Agent: #6 DB-Architekt (nur bei datenlastigen Projekten)

#6 → Liest architecture-plan.md + api-contract.md
#6 → Entwirft Schema, Migrationen, Queries
#6 → Schreibt Schema-Dateien
Chef → Prüft und genehmigt Schema

EVIDENZ-GATE: Schema-Migrations laufen fehlerfrei durch
     → Erst nach Genehmigung + Evidenz: Phase 5 freigeben
```

### Phase 5: Entwicklung (Parallel, Isoliert)
```
Voraussetzung: Phase 3/4 abgeschlossen, API-Contract + Schema genehmigt
Agenten: #4 Tech-Dev + #5 Visual-Dev (PARALLEL)
Nutzt: dispatching-parallel-agents + using-git-worktrees + test-driven-development

SETUP:
  Chef → Erstellt Git Worktrees:
    - worktree-backend/ (Branch: feature-backend) → für #4
    - worktree-frontend/ (Branch: feature-frontend) → für #5
  Beide Worktrees teilen: Git-Historie, DB-Schema, API-Contract

DEVELOPMENT (pro Slice):
  #4 → Entwickelt Backend in worktree-backend/ (TDD: Test first!)
  #5 → Entwickelt Frontend in worktree-frontend/ (TDD: Test first!)

  Beide lesen: api-contract.md als verbindliche Referenz
  Beide melden: Unklarheiten → messages.jsonl → Chef

MERGE (nach jedem Slice):
  Chef → Dependency-Order Merge:
    1. Backend-Branch zuerst in main mergen
    2. Frontend-Branch auf neuen main rebasen
    3. Schnittstellenkonflikte lösen
    4. Merge Frontend

EVIDENZ-GATE: Tests grün in beiden Worktrees VOR Merge
```

### Phase 6: QA + Security (Parallel)
```
Voraussetzung: Phase 5 abgeschlossen, Merge erfolgreich
Agenten: #7 QA-Tester + #8 Security-Spezialist (PARALLEL)
Nutzt: verification-before-completion

#7 → Schreibt Tests (Unit, Integration), führt sie aus
#8 → Analysiert Code auf Sicherheitslücken (Read-Only)

#7 → test-report.md (BINÄR: Pass/Fail, keine subjektiven Bewertungen)
#8 → security-report.md

EVIDENZ-GATE:
  - Alle Tests GRÜN
  - Keine kritischen Security-Findings (High/Critical)
  - App bootet und antwortet auf Health-Check

Chef → Prüft Evidenz (nicht nur Reports!)
     → Bei Failures: Review→Fix→Re-Test LOOP (max 3 Iterationen)
     → Sonst: Phase 7 freigeben
```

### Phase 7: Code-Review (Kreuz-Review — Findings Only)
```
Voraussetzung: Phase 6 Evidenz-Gates bestanden
Agenten: #9 Reviewer A + #10 Reviewer B (beide READ-ONLY)
Nutzt: requesting-code-review + receiving-code-review Skills

INVARIANTE: Single-Owner pro Dateibereich.
  Reviewer liefern Findings → der URSPRÜNGLICHE BUILDER fixt.
  Reviewer editieren KEINEN Code direkt.

--- Runde 1 (PARALLEL) ---
#9 → Prüft Backend-Code → liefert Findings-Liste
#10 → Prüft Frontend-Code → liefert Findings-Liste

--- Fix-Runde 1 ---
#4 (Backend-Builder) → fixt #9s Backend-Findings
#5 (Frontend-Builder) → fixt #10s Frontend-Findings
QA (#7) → Re-Test nach Fixes

--- Runde 2 (PARALLEL, Kreuz-Check) ---
#9 → Prüft Frontend (nach #5s Fixes) → liefert Findings
#10 → Prüft Backend (nach #4s Fixes) → liefert Findings

--- Fix-Runde 2 (falls nötig) ---
#4 → fixt verbleibende Backend-Findings
#5 → fixt verbleibende Frontend-Findings

Max 2 Review→Fix-Zyklen. Danach: verbleibende Findings dokumentieren,
Chef entscheidet ob sie blockierend sind oder als Tech-Debt akzeptiert werden.

EVIDENZ-GATE: Alle Tests WEITERHIN grün nach Fixes

Chef → Prüft alle Änderungen + Evidenz, gibt Phase 8 frei
```

### Phase 8: Integrations-Test
```
Voraussetzung: Phase 7 abgeschlossen, Evidenz-Gates bestanden
Agent: #11 Integrations-Tester
Nutzt: verification-before-completion

#11 → Testet Gesamtsystem End-to-End
#11 → Prüft Zusammenspiel aller Komponenten
#11 → integration-report.md

EVIDENZ-GATE:
  - E2E-Tests grün
  - App läuft vollständig
  - Kein Regression in Unit-Tests

Chef → Prüft Evidenz
     → Bei Problemen: Review→Fix→Re-Test LOOP zurück an zuständigen Agent
     → Max 3 Iterationen, dann Eskalation an Auftraggeber
     → Bei Erfolg: Phase 9 freigeben
```

### Phase 9: Abnahme + Wissenstransfer (Interaktiv)
```
Voraussetzung: Phase 8 Evidenz-Gates bestanden
Agenten: Chef + Auftraggeber

Chef → Präsentiert fertigen Code dem Auftraggeber
Chef → Zeigt Evidenz: Test-Reports, Security-Report, E2E-Ergebnisse
Auftraggeber → Genehmigt oder fordert Änderungen

Nach Genehmigung:
Chef → Aktualisiert lessons-learned.md (append-only)
Chef → SCHLÄGT Prompt-Template-Änderungen VOR (erstellt Draft)
Auftraggeber → Reviewed und genehmigt/verwirft Prompt-Änderungen
     → Nur genehmigte Änderungen werden in Prompt-Templates übernommen
```

---

## Resumability (Crash-Recovery)

> [!IMPORTANT]
> **Lange Multi-Agenten-Läufe WERDEN abbrechen** — Kontextlimit, API-Fehler, Rate-Limits, User geht mit dem Hund raus. Das datei-basierte Design macht Recovery möglich, aber nur wenn der Zustand **vollständig aus Dateien rekonstruierbar** ist.

### Designprinzip

Jeder Agent (besonders der Chef) muss jederzeit von einem **frischen Agenten** ersetzt werden können, der aus Taskboard + Artefakten den Zustand rekonstruiert und weitermacht.

### Taskboard als Resumability-Anker

Das Taskboard muss **jederzeit** präzise festhalten:

```markdown
## Aktueller Zustand
- **Aktuelle Phase:** 5 (Entwicklung)
- **Aktueller Slice:** Feature 2/4 (User-Profil)
- **Zuletzt abgeschlossen:** Phase 5, Slice 1 (Auth) — alle Tests grün
- **Als Nächstes:** #4 implementiert GET /users/:id, #5 baut Profil-Seite
- **Offene Blocker:** Keine
- **Contract-Version:** api-contract v1.2
```

### Recovery-Prozess

```
1. Neuer Chef-Agent gestartet
2. Chef liest: taskboard.md → "Wo stehen wir?"
3. Chef liest: messages.jsonl (letzte Phase) → "Was ist passiert?"
4. Chef liest: Alle Artefakte (verified-research, architecture-plan, api-contract)
5. Chef verifiziert: Git-Status, Test-Ergebnisse, offene Worktrees
6. Chef setzt Arbeit fort ab dem letzten Checkpoint
```

> [!TIP]
> **Das ist wichtiger als Token-Budgets.** Token-Limits sind Wunsch, Resumability ist Überlebensnotwendigkeit.

---

## Kommunikations-System

### Hierarchie (Streng)

```
Auftraggeber (Du)
      ↕ (einziger direkter Kanal)
   🎩 Chef
      ↕ (alle Agenten)
#1 #2 #3 #4 #5 #6 #7 #8 #9 #10 #11
```

### Human-Checkpoint-Policy

> [!IMPORTANT]
> **Spannung:** "Chef genehmigt jede Phase" × "vertikale Slices" = N Slices × 9 Phasen = viele Genehmigungspunkte. Du wirst entweder mit Approvals zugespammt oder das System läuft zu lange autonom. Deshalb klare Regeln:

**Auftraggeber wird einbezogen bei:**
- ✋ **Phase 3:** Plan + Contract-Genehmigung (architektonische Entscheidungen)
- ✋ **Phase 9:** Abnahme des fertigen Codes
- ✋ **Jede BLOCKER-Eskalation:** Chef kann nicht selbst lösen
- ✋ **Contract-Changes mit Breaking Impact**

**Chef entscheidet autonom bei:**
- ✅ Phase 1→2, 2→3: Recherche/Fakten-Check-Qualität (Chef prüft auf Evidenz)
- ✅ Phase 4→5, 5→6, 6→7, 7→8: Alle Evidenz-Gates (Tests grün, App bootet)
- ✅ Non-Breaking Contract-Updates (Lücken füllen, keine Schnittstelle brechen)
- ✅ Review→Fix→Re-Test-Loops innerhalb einer Phase

**Begründung:** Der Mensch entscheidet WAS gebaut wird (Strategie). Der Chef entscheidet OB es korrekt gebaut wurde (Evidenz). So bleibt das System autonom genug für lange Läufe, aber der Mensch hat die Kontrolle über die wichtigen Entscheidungen.

### Regeln
1. **Nur der Chef** kommuniziert mit dem Auftraggeber
2. Agenten melden alles an den Chef via `messages.jsonl`
3. Chef entscheidet, was an den Auftraggeber weitergeleitet wird
4. Auftraggeber-Antworten werden vom Chef an relevante Agenten verteilt
5. Agenten können untereinander via `messages.jsonl` kommunizieren
6. Chef arbeitet primär vom **Taskboard** — liest nur messages bei Phase-Übergängen oder Eskalationen (verhindert Context-Overflow)

### Strukturiertes Message-Schema

> [!IMPORTANT]
> Messages sind nicht unstrukturierter Freitext. Jede Zeile in `messages.jsonl` folgt einem strikten Schema:

```json
{
  "from": "tech-dev-4",
  "to": "chef",
  "timestamp": "2026-06-22T15:30:00Z",
  "type": "STATUS|QUESTION|BLOCKER|COMPLETION|FINDING",
  "severity": "INFO|WARNING|CRITICAL",
  "phase": 5,
  "msg": "Backend API /users/* implementiert, Tests grün (14/14)"
}
```

**Message-Typen:**
- `STATUS` — Fortschrittsmeldung
- `QUESTION` — Frage an Chef (oder indirekt an Auftraggeber)
- `BLOCKER` — Kann nicht weiterarbeiten, braucht Hilfe
- `COMPLETION` — Task abgeschlossen mit Evidenz
- `FINDING` — Bug, Security-Issue, oder anderes Finding

### Concurrency-Regeln für Dateizugriff

> [!WARNING]
> **Append-Only für messages.jsonl** — mehrere Agenten können gleichzeitig schreiben, aber NUR anhängen, nie bestehende Zeilen ändern.
> **Single-Writer für taskboard.md** — nur der Chef schreibt das Taskboard. Agenten melden ihren Status via messages.jsonl, Chef aktualisiert das Board.

### Kontext-Kompression

> [!TIP]
> Bei umfangreichen Projekten wird der messages.jsonl-Bus für den Chef zu groß. Der Chef komprimiert **nach jeder abgeschlossenen Phase** ältere Messages zu einer Zusammenfassung und archiviert die Rohdaten in `messages-archive-phase-N.jsonl`. Nur die aktuelle Phase + Zusammenfassungen bleiben im aktiven Bus.

### Datei-basierte Kommunikation

```
.superpowers/team/
├── taskboard.md            # Status aller Tasks (Single Source of Truth, nur Chef schreibt)
├── messages.jsonl           # Inter-Agent-Kommunikation (append-only)
├── messages-archive-*.jsonl # Archivierte Messages nach Kompression
├── research-report.md       # Output von #1
├── verified-research.md     # Output von #2
├── architecture-plan.md     # Output von #3
├── api-contract.md          # Interface-Vertrag zwischen Backend/Frontend (VERSIONIERT: v1.0, v1.1, ...)
├── api-contract-changelog.md # Änderungslog des Contracts
├── security-report.md       # Output von #8
├── test-report.md           # Output von #7 (binär: Pass/Fail)
├── integration-report.md    # Output von #11
└── lessons-learned.md       # Persistentes Wissen (append-only, read-only für Agenten)
```

---

## Git Worktree Isolation (Parallele Builder)

> [!IMPORTANT]
> **Keine parallelen Builder ohne Worktree-Isolation.** Zwei `self`-Agenten im selben Verzeichnis mit Schreib+Command-Zugriff treten sich auf die Füße.

### Setup

```bash
# Chef erstellt Worktrees vor Phase 5
git worktree add worktree-backend feature-backend
git worktree add worktree-frontend feature-frontend
```

### Regeln
- **#4 (Backend)** arbeitet ausschließlich in `worktree-backend/`
- **#5 (Frontend)** arbeitet ausschließlich in `worktree-frontend/`
- Beide teilen: Git-Historie, DB-Schema, API-Contract
- Jeder Worktree hat eigene `.env.local` (separate DB-Instanzen für Tests)
- **Kein Agent berührt den Worktree des anderen**

### Merge-Strategie (Dependency-Order)

```
1. Backend-Branch → main mergen (Foundation first)
2. Frontend-Branch auf neuen main rebasen
3. Schnittstellenkonflikte auflösen (API-Contract als Referenz)
4. Frontend → main mergen
5. Integrations-Tests auf main ausführen
```

---

## Evidenz-basierte Quality Gates

> [!IMPORTANT]
> **Reports können hohl sein.** Phasen-Übergänge basieren auf **binärer Evidenz**, nicht auf subjektiven Agent-Einschätzungen.

| Phase-Übergang | Evidenz erforderlich |
|----------------|---------------------|
| Phase 2 → 3 | Fact-Check abgeschlossen, keine offenen "kritisch" markierten Claims |
| Phase 3 → 4/5 | API-Contract erstellt + vom Chef genehmigt |
| Phase 4 → 5 | Schema-Migrationen laufen fehlerfrei (bei DB-lastigen Projekten) |
| Phase 5 → 6 | `npm test` / `pytest` grün in BEIDEN Worktrees |
| Phase 6 → 7 | ALLE Unit-Tests grün + keine Critical Security-Findings |
| Phase 7 → 8 | Tests WEITERHIN grün nach Review-Fixes |
| Phase 8 → 9 | E2E-Tests grün + App bootet + Health-Check antwortet |

---

## Lern-System (Human-Gated)

> [!WARNING]
> **Agenten dürfen ihre eigenen Prompts NICHT automatisch ändern.** Automatische Prompt-Updates führen zu Prompt-Drift (widersprüchliche Regeln, schleichender Qualitätsverlust). Der Auftraggeber ist der ultimative Gatekeeper.

### 1. Lessons-Learned-Datei (Read-Only für Agenten)
Pfad: `.superpowers/team/lessons-learned.md`

```markdown
# Lessons Learned

## Projekt: {Name}
## Datum: {Datum}

### Fehler gefunden
| # | Phase | Agent | Fehler | Root Cause | Lösung | Schwere |
|---|-------|-------|--------|------------|--------|---------|
| 1 | Review | #9 | Fehlende Eingabevalidierung | Kein Input-Check im API-Contract spezifiziert | Contract + Code ergänzt | Hoch |

### Neue Regeln (Vorschläge — pending Auftraggeber-Review)
- [ ] Immer Eingabevalidierung vor DB-Queries
- [ ] CSS-Variablen statt hardcoded Farben

### Best Practices bestätigt
- TDD hat 3 Bugs verhindert
- Kreuz-Review hat Inkonsistenzen gefunden
```

### 2. Prompt-Update-Workflow (Human-in-the-Loop)

```
1. Chef sammelt Fehler und Lösungen aus Reviews + Tests
2. Chef schreibt Lessons-Learned (append-only)
3. Chef SCHLÄGT Prompt-Änderungen VOR als Draft
4. Auftraggeber reviewed den Draft:
   - Genehmigt → Änderungen werden in Prompt-Templates übernommen
   - Verwirft → Bleiben nur in Lessons-Learned als Referenz
   - Modifiziert → Auftraggeber passt an, dann übernehmen
5. Nur genehmigte Änderungen werden committet
```

> [!CAUTION]
> **Gaming the Benchmark verhindern:** Wenn Agenten ihre eigenen Evaluierungsregeln aufweichen, sinkt die Code-Qualität. Der Auftraggeber als ultimativer Arbiter verhindert das.

### 3. Wissenstransfer
- Alle Agenten lesen beim Start die `lessons-learned.md` als **read-only Referenz**
- Gefundene Fehler werden via strukturierte Messages an Chef gemeldet
- Chef erstellt Zusammenfassung für den Auftraggeber

---

## Selbst-Limitierung und Artefakt-Checkpoints

> [!IMPORTANT]
> **Realität:** Token-Budgets und Timer sind im Subagent-Dispatch nicht von außen erzwingbar. Der Chef wartet auf das Ergebnis eines Sub-Agenten und kann ihn nicht mit einem Timer mittendrin unterbrechen. Die echte Sicherheit kommt durch **drei Mechanismen:**

### 1. Kleiner Task-Scope
Jeder Agent bekommt einen **eng definierten** Auftrag pro Dispatch. Lieber 3 kleine Dispatches als 1 großen. Je kleiner der Scope, desto unwahrscheinlicher die Endlosschleife.

### 2. Self-Limits (Agent instruiert sich selbst)
Jeder Agent-Prompt enthält die Anweisung:
> "Wenn du merkst, dass du dich im Kreis drehst oder das Problem zu komplex wird: Schreibe sofort ein Zwischenartefakt mit dem bisherigen Stand, sende eine BLOCKER-Message an den Chef, und beende dich. Liefere lieber 80% als gar nichts."

### 3. Gecheckpointete Artefakte (die eigentliche Sicherheit)
Jeder Agent **muss** sein Zwischenergebnis als Datei schreiben, bevor er komplex wird:

| Agent | Checkpoint-Artefakt | Wann schreiben |
|-------|--------------------|-----------------|
| #1 Researcher | `research-report.md` (auch unvollständig) | Sobald erste Ergebnisse da sind |
| #2 Fact-Checker | `verified-research.md` (auch teilweise) | Nach jedem geprüften Abschnitt |
| #4/#5 Builder | Git-Commit (auch WIP) | Nach jedem Feature/Funktion |
| #7 QA-Tester | Test-Dateien committet | Nach jeder Test-Gruppe |
| #9/#10 Reviewer | Findings in messages.jsonl | Nach jedem geprüften Bereich |
| #11 Integration | `integration-report.md` (auch teilweise) | Nach jedem E2E-Szenario |

> [!TIP]
> **Wenn ein Agent abstürzt:** Der Zustand ist im letzten Checkpoint gesichert. Chef dispatcht einen neuen Agenten, der ab dem Checkpoint weitermacht. Deshalb ist Resumability wichtiger als Token-Budgets.

---

## Ideen-Scout (Separater Skill)

> [!NOTE]
> **Scope-Trennung:** Die Ideen-Pipeline (Marktlücken, Trends, lukrative Software-Ideen) wird als **eigener Skill** (`idea-scout`) ausgelagert, nicht in den dev-team-Skill integriert. Dev-Team fokussiert auf Software-Entwicklung. Ideen-Scouting ist ein eigenständiges Anliegen.

Der `idea-scout` Skill kann:
- Unabhängig vom dev-team laufen (z.B. als wöchentliche Recherche)
- Vom dev-team in Phase 1 optional eingebunden werden
- Eigenen Researcher + Fact-Checker nutzen
- Output: `idea-pipeline.md` → `verified-ideas.md` → Chef präsentiert Top-Hits

**Wird als separater Skill implementiert nach erfolgreichem MVP des dev-team Skills.**

---

## Skill-Komposition (Pflicht vs. Empfohlen)

### Pflicht-Skills (immer aktiv)
| Skill | Wer nutzt es | Warum |
|-------|-------------|-------|
| `using-superpowers` | Alle | Skill-Checks bei jeder Aktion |
| `brainstorming` | Chef, #3 | Vor kreativer Arbeit |
| `verification-before-completion` | Chef, alle Tester | Evidenz vor Erfolgs-Claims |
| `test-driven-development` | #4, #5 | Red-Green-Refactor |

### Empfohlene Skills (situativ)
| Skill | Wann |
|-------|------|
| `writing-plans` | Phase 3 (Planer erstellt Architekturplan) |
| `executing-plans` | Phase 4–5 (Plan-Ausführung mit Checkpoints) |
| `subagent-driven-development` | Phase 5 (Builder dispatchen) |
| `dispatching-parallel-agents` | Phase 5 (parallele Builder) |
| `using-git-worktrees` | Phase 5 (Worktree-Isolation) |
| `requesting-code-review` | Phase 7 |
| `receiving-code-review` | Phase 7 |
| `systematic-debugging` | Bei Fehlersuche |

---

## Datei-Struktur des Skills

```
skills/dev-team/
├── SKILL.md                    # Haupt-Skill: Workflow, Checklist, Phasen, Skalierung
├── roles.md                    # Alle Rollen mit Details + MVP-Mapping
├── taskboard-template.md       # Vorgefertigtes Taskboard mit Evidenz-Gates
├── api-contract-template.md    # Vorlage für den Interface-Vertrag (versioniert)
├── contract-change-protocol.md # Protokoll für Contract-Änderungen während des Builds
├── lessons-learned-template.md # Vorlage für Wissens-Datenbank
├── message-schema.md           # Strukturiertes Message-Format
└── prompts/                    # Individuelle Agent-Prompt-Templates
    ├── chef.md                 # Chef/Manager Prompt
    ├── researcher.md           # #1 Informationsbeschaffer
    ├── fact-checker.md         # #2 Fakten-Prüfer
    ├── planner.md              # #3 Planer/Architekt
    ├── tech-developer.md       # #4 Technischer Entwickler
    ├── visual-developer.md     # #5 Visueller Entwickler
    ├── db-architect.md         # #6 Datenbank-Architekt
    ├── qa-tester.md            # #7 QA/Test-Schreiber
    ├── security-specialist.md  # #8 Security-Spezialist
    ├── code-reviewer-a.md      # #9 Code-Reviewer A
    ├── code-reviewer-b.md      # #10 Code-Reviewer B
    └── integration-tester.md   # #11 Integrations-Tester
```

---

## Anti-Patterns

| ❌ Nicht tun | ✅ Stattdessen |
|-------------|---------------|
| Mit 12 Agenten starten | **MVP mit 4 Agenten**, dann skalieren |
| MVP an wichtigem Projekt testen | **Wegwerf-Projekt** (CLI-Todo, 1-Endpoint-API) zum Debuggen der Orchestrierung |
| Parallele Builder ohne Worktrees | **Git Worktree pro Builder**, Dependency-Order Merge |
| Phase-Gates auf "Report geschrieben" | **Evidenz:** Tests grün, App bootet, Lint sauber |
| Agenten direkt mit Auftraggeber reden | Alles über den Chef leiten |
| Entwickler ohne API-Contract starten | **Contract-First:** api-contract.md vor parallelem Build |
| Contract als unveränderlich behandeln | **Contract-Change-Protokoll:** versioniert, mit Re-Sync |
| Entwickler ohne DB-Schema starten | Phase 4 abwarten (bei datenlastigen Projekten) |
| Strikter Wasserfall ohne Schleifen | **Review→Fix→Re-Test LOOPS** (max 2 Zyklen) |
| Reviewer editieren Code direkt | **Findings-Only:** Reviewer liefern Findings, **Builder fixt** (Single-Owner) |
| Prompt-Templates automatisch ändern | **Human-Gated:** Auftraggeber reviewed und genehmigt |
| "Most capable" für alle Agenten | **Nur Chef + Planer** auf teuerstem Modell |
| Kreuz-Review überspringen | Immer beide Runden durchlaufen (aber Findings-Only!) |
| Zwei Agenten dieselbe Datei bearbeiten | **Single-Owner-Invariante** + Worktree-Isolation |
| Ideen-Scout in dev-team reinquetschen | **Separater Skill** `idea-scout` |
| Chef liest rohen Message-Stream | Chef arbeitet vom **Taskboard** + komprimierten Summaries |
| Token-Budgets als externe Laufzeit-Wächter | **Self-Limits** + **gecheckpointete Artefakte** + kleiner Task-Scope |
| Auftraggeber bei jeder Phase-Transition fragen | **Human-Checkpoint-Policy:** Mensch nur bei Strategie + Blocker, Chef autonom bei Evidenz |
| Subjektive LLM-Code-Bewertung als Gate | **Binäre Evidenz** (Pass/Fail Tests, Boot-Check) |
| Security-Agent/Reviewer mit Schreibrechten | **Read-Only** — Findings gehen an Builder zurück |
| Session-Crash = alles verloren | **Resumability:** Taskboard + Artefakte = vollständig rekonstruierbarer Zustand |

---

## Änderungshistorie

| Version | Datum | Änderungen |
|---------|-------|------------|
| v1 | 2026-06-22 | Initiales Design: 12 Agenten, 10 Phasen, Wasserfall |
| v2 | 2026-06-22 | **Major Revision** nach Gemini Deep Research + Claude Opus Expert-Review. MVP-Skalierung, Skill-Komposition, Git Worktrees, Contract-First, Evidenz-Gates, iterative Loops, Human-Gated Prompts, Token-Budgets, Ideen-Scout als separater Skill, Kosten-Optimierung, strukturiertes Message-Schema, Kontext-Kompression |
| v3 | 2026-06-22 | **Praxis-Härtung** nach Claude Opus v2-Feedback. (A) Escape-Hatches → Self-Limits + Checkpoint-Artefakte statt externer Wächter. (B) Resumability als Kern-Designziel — Taskboard als Recovery-Anker. (C) Contract-Change-Protokoll — versionierte Updates während des Builds. (D) Reviewer = Findings-Only, Single-Owner-Invariante — Builder fixt, Reviewer schreibt keinen Code. (E) Human-Checkpoint-Policy — Mensch bei Strategie + Blocker, Chef autonom bei Evidenz. (F) Wegwerf-Erstprojekt + Kosten-Realität |
