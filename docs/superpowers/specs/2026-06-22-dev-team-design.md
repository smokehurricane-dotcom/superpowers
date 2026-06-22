# Dev-Team Skill — Design Specification (v2)

**Date:** 2026-06-22
**Revision:** v2 — überarbeitet nach Gemini Deep Research + Claude Opus Expert-Review
**Status:** Approved (pending final review)
**Author:** Chef-Orchestrator + Auftraggeber (Petra)

---

## Übersicht

Ein wiederverwendbarer Superpowers-Skill namens `dev-team`, der als **dünner Orchestrator über erprobten Superpowers-Primitiven** ein virtuelles Software-Entwicklungsteam koordiniert. Der Skill skaliert von einer MVP-Version mit 4 Agenten bis zum vollständigen 11-köpfigen Team.

> [!IMPORTANT]
> **Kernprinzip v2:** Vorhandene Superpowers-Skills **komponieren**, nicht nachbauen. Der dev-team-Skill ist ein Orchestrator, kein Monolith.

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

### Stufe 1: MVP (4 Agenten) — Einstieg

| # | Rolle | Agent-Typ | Modell |
|---|-------|-----------|--------|
| 🎩 | **Chef** | custom (`coordinator`) | Most capable |
| #1+2 | **Researcher/Fact-Checker** (kombiniert) | research | Standard |
| #3+4 | **Builder** (Full-Stack, plant + baut) | self | Most capable |
| #9 | **Reviewer** | research | Standard |

**Workflow MVP:** Recherche → Planung + Build → Review → Abnahme
**Wann skalieren:** Wenn MVP stabil läuft und Projekte zu groß für einen Builder werden.

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
| #9 | **Code-Reviewer A** | custom (`reviewer`) | Standard | Lesen + Schreiben (nur Fixes) |
| #10 | **Code-Reviewer B** | custom (`reviewer`) | Standard | Lesen + Schreiben (nur Fixes) |
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
  - Überwacht **Token-Budgets** und bricht Agenten bei Endlosschleifen ab
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
- **Token-Budget:** Max 50.000 Tokens pro Recherche-Lauf. Bei Überschreitung: Zwischenergebnis speichern, an Chef melden

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
- **Token-Budget:** Max 100.000 Tokens pro Feature-Slice

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
  - Runde 1: Prüft Backend-Code (#4) → verbessert
  - Runde 2: Prüft #10s Verbesserungen am Frontend
- **Darf:** Code-Fixes durchführen basierend auf Findings

#### #10 Code-Reviewer B
- **Nutzt:** `requesting-code-review` + `receiving-code-review` Skills
- **Verantwortung:**
  - Runde 1: Prüft Frontend-Code (#5) → verbessert
  - Runde 2: Prüft #9s Verbesserungen am Backend
- **Darf:** Code-Fixes durchführen basierend auf Findings

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
> **Escape-Hatches bei jeder Phase:**
> - **Token-Budget:** Jeder Agent hat ein max. Token-Budget pro Phase. Bei Überschreitung: Zwischenergebnis speichern, an Chef melden.
> - **Retry-Limit:** Max 3 Versuche pro Phase-Aufgabe. Danach: Eskalation an Auftraggeber.
> - **Stillstand-Erkennung:** Wenn ein Agent >5 Minuten keine Fortschritte macht → Chef bricht ab und eskaliert.

### Phase 1: Informationsbeschaffung
```
Trigger: Neues Projekt vom Auftraggeber
Agent: #1 Researcher
Status: Chef überwacht

#1 → Recherchiert umfassend (Token-Budget: 50k)
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

### Phase 7: Code-Review (Kreuz-Review)
```
Voraussetzung: Phase 6 Evidenz-Gates bestanden
Agenten: #9 Reviewer A + #10 Reviewer B
Nutzt: requesting-code-review + receiving-code-review Skills

--- Runde 1 (PARALLEL) ---
#9 → Prüft Backend (#4) → verbessert Code
#10 → Prüft Frontend (#5) → verbessert Code

--- Runde 2 (PARALLEL, nach Runde 1) ---
#9 → Prüft #10s Frontend-Verbesserungen
#10 → Prüft #9s Backend-Verbesserungen

Review→Fix→Re-Test LOOP:
  Bei Findings → Builder (#4/#5) fixen → QA re-testet → Reviewer prüft erneut
  Max 3 Iterationen pro Finding

EVIDENZ-GATE: Alle Tests WEITERHIN grün nach Code-Änderungen

Beide → Melden Findings via messages.jsonl
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

## Kommunikations-System

### Hierarchie (Streng)

```
Auftraggeber (Du)
      ↕ (einziger direkter Kanal)
   🎩 Chef
      ↕ (alle Agenten)
#1 #2 #3 #4 #5 #6 #7 #8 #9 #10 #11
```

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
├── api-contract.md          # Interface-Vertrag zwischen Backend/Frontend
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

## Token-Budgets und Abbruchbedingungen

> [!WARNING]
> Ohne harte Limits drehen explorative Agenten (#1 Researcher, #9/#10 Reviewer) in Fehlerfällen in Endlosschleifen und verbrennen Tokens.

| Agent | Max Tokens pro Durchlauf | Max Retries | Bei Überschreitung |
|-------|-------------------------|-------------|-------------------|
| #1 Researcher | 50.000 | 1 | Zwischenergebnis speichern, Chef melden |
| #2 Fact-Checker | 30.000 | 3 pro Claim | Als "nicht verifizierbar" markieren |
| #4/#5 Builder | 100.000 pro Slice | 2 | Unvollständigen Code committen, Chef melden |
| #7 QA-Tester | 50.000 | 2 | Test-Suite wie ist speichern |
| #9/#10 Reviewer | 50.000 | 3 pro Finding | Finding dokumentieren, weiter zum nächsten |
| #11 Integration | 50.000 | 2 | Report mit Teilergebnis |

**Stillstand-Erkennung:** Wenn ein Agent >5 Minuten keine Datei schreibt und keine Message sendet → Chef bricht ab, loggt Zustand, eskaliert.

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
├── api-contract-template.md    # Vorlage für den Interface-Vertrag
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
| Parallele Builder ohne Worktrees | **Git Worktree pro Builder**, Dependency-Order Merge |
| Phase-Gates auf "Report geschrieben" | **Evidenz:** Tests grün, App bootet, Lint sauber |
| Agenten direkt mit Auftraggeber reden | Alles über den Chef leiten |
| Entwickler ohne API-Contract starten | **Contract-First:** api-contract.md vor parallelem Build |
| Entwickler ohne DB-Schema starten | Phase 4 abwarten (bei datenlastigen Projekten) |
| Strikter Wasserfall ohne Schleifen | **Review→Fix→Re-Test LOOPS** (max 3 Iterationen) |
| Prompt-Templates automatisch ändern | **Human-Gated:** Auftraggeber reviewed und genehmigt |
| "Most capable" für alle Agenten | **Nur Chef + Planer** auf teuerstem Modell |
| Kreuz-Review überspringen | Immer beide Runden durchlaufen |
| Zwei Agenten dieselbe Datei bearbeiten | Scope-Trennung + Worktree-Isolation |
| Ideen-Scout in dev-team reinquetschen | **Separater Skill** `idea-scout` |
| Chef liest rohen Message-Stream | Chef arbeitet vom **Taskboard** + komprimierten Summaries |
| Keine Token-Limits | **Harte Budgets** pro Agent und Phase |
| Agenten ohne Retry-Limits | **Max 3 Retries**, dann Eskalation |
| Subjektive LLM-Code-Bewertung als Gate | **Binäre Evidenz** (Pass/Fail Tests, Boot-Check) |
| Security-Agent mit Schreibrechten | **Read-Only** — Findings gehen an Builder zurück |

---

## Änderungshistorie

| Version | Datum | Änderungen |
|---------|-------|------------|
| v1 | 2026-06-22 | Initiales Design: 12 Agenten, 10 Phasen, Wasserfall |
| v2 | 2026-06-22 | **Major Revision** nach Gemini Deep Research + Claude Opus Expert-Review. MVP-Skalierung, Skill-Komposition, Git Worktrees, Contract-First, Evidenz-Gates, iterative Loops, Human-Gated Prompts, Token-Budgets, Ideen-Scout als separater Skill, Kosten-Optimierung, strukturiertes Message-Schema, Kontext-Kompression |
