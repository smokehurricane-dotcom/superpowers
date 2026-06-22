# Dev-Team Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `dev-team` Superpowers skill — a thin orchestrator that coordinates a virtual software development team using existing Superpowers primitives (team-orchestration, subagent-driven-development, dispatching-parallel-agents, etc.).

**Architecture:** The skill is a collection of Markdown files: one SKILL.md orchestrator, a roles reference, templates for taskboard/contract/messages, a lessons-learned template, and individual agent prompt templates in a `prompts/` subdirectory. The SKILL.md acts as the main entry point, referencing all other files. It builds on top of `team-orchestration` patterns (taskboard, messages.jsonl, wave-based dispatch) and adds the dev-team-specific 9-phase workflow, human-checkpoint policy, contract-change protocol, and resumability system.

**Tech Stack:** Markdown (skill files), YAML frontmatter (skill metadata), JSON (message schema), Git (version control)

**Spec:** [2026-06-22-dev-team-design.md](file:///c:/Users/petra/Neuer%20Ordner/docs/superpowers/specs/2026-06-22-dev-team-design.md) (v3)

## Global Constraints

- Skill lives at `skills/dev-team/` in the project root (same level as existing skills like `using-superpowers/`, `brainstorming/`)
- YAML frontmatter: `name` uses only letters, numbers, hyphens; `description` starts with "Use when...", max 1024 chars, no workflow summary
- Follows Superpowers conventions: SKILL.md as entry point, flat namespace, cross-references via `**REQUIRED SUB-SKILL:**` not `@` links
- Language: German for user-facing content (matching spec), English for YAML metadata and technical identifiers
- MVP first: initial implementation targets Stufe 1 (4 agents: Chef, Researcher/Fact-Checker, Builder, Reviewer). Full team files are created but clearly marked as "Stufe 2/3"
- All templates must produce valid Markdown that agents can parse
- No placeholder content — every file must be complete and functional

---

### Task 1: SKILL.md — Main Orchestrator Entry Point

**Files:**
- Create: `skills/dev-team/SKILL.md`

**Interfaces:**
- Consumes: Nothing (this is the root file)
- Produces: The main skill entry point that all other tasks' files are referenced from. Defines the frontmatter (`name: dev-team`, `description: Use when...`), the phase workflow checklist, human-checkpoint policy, and cross-references to `roles.md`, `taskboard-template.md`, `api-contract-template.md`, `contract-change-protocol.md`, `lessons-learned-template.md`, `message-schema.md`, and `prompts/*.md`.

- [ ] **Step 1: Create `skills/dev-team/SKILL.md` with frontmatter and overview**

```markdown
---
name: dev-team
description: Use when building complete software projects requiring research, planning, development, testing, and review — orchestrates a virtual development team with phased workflow, evidence-based quality gates, and human checkpoints
---

# Dev-Team

Orchestrate a virtual software development team through a phased workflow. Builds on `team-orchestration` primitives with dev-specific additions: phased workflow, API contract management, evidence-based gates, and a learning system.

**Core principles:**
1. **Compose, don't rebuild** — uses existing Superpowers skills as building blocks
2. **Resumability** — every state reconstructable from files; sessions die, files survive
3. **Single-Owner** — exactly one writer per file scope, always

**Relationship to other skills:**
- `team-orchestration` — provides taskboard, messaging, wave-based dispatch primitives
- `subagent-driven-development` — used for sequential task execution within phases
- `dispatching-parallel-agents` — used for parallel Builder dispatch in Phase 5
- `using-git-worktrees` — required for parallel Builder isolation

## When to Use

**Use when:**
- Building a complete software project from scratch
- Project needs research + architecture + implementation + testing + review
- You want a structured, multi-agent development workflow
- Project scope justifies multi-agent coordination overhead

**Don't use when:**
- Simple bug fix or small feature (use `subagent-driven-development`)
- Pure research task (use `team-orchestration` with research agents)
- Task has < 3 components (overhead not worth it)
```

- [ ] **Step 2: Add the scaling model section**

Append to `SKILL.md`:

```markdown
## Scaling Model

Start with MVP (4 agents). Scale up only after MVP runs successfully on a throwaway project.

| Stufe | Agenten | Wann aktivieren |
|-------|---------|-----------------|
| 1 (MVP) | Chef + Researcher/Fact-Checker + Builder + Reviewer | Sofort — erster Einsatz |
| 2 (Kern) | + separater Planer, Frontend-Builder, QA-Tester | Wenn Projekte zu groß für einen Builder |
| 3 (Voll) | + DB-Architekt, Security, Reviewer B, Integrations-Tester | Enterprise-Projekte |

> **Erster Lauf = Wegwerf-Projekt.** Teste den MVP an einem winzigen Projekt (CLI-Todo, 1-Endpoint-API + 1 Seite), an dem du jeden Schritt debuggen kannst. Erst danach an echte Projekte.

See [roles.md](roles.md) for all role definitions and their MVP/Kern/Voll mapping.
```

- [ ] **Step 3: Add the phase workflow checklist**

Append to `SKILL.md`:

```markdown
## Workflow Checklist

You MUST complete these steps in order. Each phase has an evidence gate.

### Phase 1: Informationsbeschaffung
- [ ] Dispatch Researcher agent (or combined Researcher/Fact-Checker in MVP)
- [ ] Agent writes `research-report.md` to `.superpowers/team/`
- [ ] Chef prüft Vollständigkeit
- [ ] **Evidence gate:** Report exists with sources documented

### Phase 2: Fakten-Check
- [ ] Dispatch Fact-Checker agent (in MVP: same agent as Phase 1)
- [ ] Agent writes `verified-research.md` to `.superpowers/team/`
- [ ] Chef prüft, keine "kritisch" markierten Claims offen
- [ ] **Evidence gate:** verified-research.md exists, no unresolved critical claims

### Phase 3: Planung + Contract-Design
- [ ] **REQUIRED SUB-SKILL:** Use superpowers:writing-plans
- [ ] Planer creates `architecture-plan.md` and `api-contract.md` (v1.0)
- [ ] **✋ HUMAN CHECKPOINT:** Auftraggeber genehmigt Plan + Contract
- [ ] **Evidence gate:** Plan + Contract approved by human

### Phase 4: Datenbank-Design (Bedingt)
- [ ] Only for data-heavy projects — skip if Planer defined schema inline
- [ ] DB-Architekt creates schema files
- [ ] Chef genehmigt Schema
- [ ] **Evidence gate:** Schema migrations run without error

### Phase 5: Entwicklung (Parallel)
- [ ] **REQUIRED SUB-SKILL:** Use superpowers:dispatching-parallel-agents
- [ ] **REQUIRED SUB-SKILL:** Use superpowers:using-git-worktrees
- [ ] Create worktrees: `worktree-backend/` + `worktree-frontend/` (Stufe 2+)
- [ ] Dispatch Builder(s) with TDD (superpowers:test-driven-development)
- [ ] Builders read api-contract.md as binding reference
- [ ] If contract gaps found → Contract-Change-Protocol (see below)
- [ ] Dependency-Order Merge: backend first, then frontend rebase
- [ ] **Evidence gate:** `npm test` / `pytest` green in all worktrees

### Phase 6: QA + Security (Parallel)
- [ ] Dispatch QA-Tester (writes tests, runs them)
- [ ] Dispatch Security-Spezialist (read-only analysis)
- [ ] **Evidence gate:** All tests GREEN + no Critical security findings + app boots

### Phase 7: Code-Review (Kreuz-Review — Findings Only)
- [ ] **REQUIRED SUB-SKILL:** Use superpowers:requesting-code-review
- [ ] Dispatch Reviewer A + B (both READ-ONLY)
- [ ] Single-Owner invariant: Reviewer delivers findings, original Builder fixes
- [ ] Max 2 Review→Fix cycles, then remaining findings = tech debt or blocker
- [ ] **Evidence gate:** All tests still green after fixes

### Phase 8: Integrations-Test
- [ ] Dispatch Integrations-Tester (E2E tests)
- [ ] **Evidence gate:** E2E tests green + app boots + health-check responds

### Phase 9: Abnahme + Wissenstransfer
- [ ] **✋ HUMAN CHECKPOINT:** Auftraggeber genehmigt fertigen Code
- [ ] Chef updates lessons-learned.md (append-only)
- [ ] Chef PROPOSES prompt template changes as draft
- [ ] **✋ HUMAN CHECKPOINT:** Auftraggeber reviews/approves prompt changes
```

- [ ] **Step 4: Add Human-Checkpoint-Policy, Contract-Change-Protocol, Resumability sections**

Append to `SKILL.md`:

```markdown
## Human-Checkpoint-Policy

**Auftraggeber wird einbezogen bei:**
- ✋ Phase 3: Plan + Contract-Genehmigung
- ✋ Phase 9: Abnahme des fertigen Codes
- ✋ Jede BLOCKER-Eskalation
- ✋ Contract-Changes mit Breaking Impact

**Chef entscheidet autonom bei:**
- ✅ Phase 1→2, 2→3: Recherche/Fakten-Check-Qualität
- ✅ Phase 4→5, 5→6, 6→7, 7→8: Alle Evidenz-Gates
- ✅ Non-Breaking Contract-Updates
- ✅ Review→Fix→Re-Test-Loops

## Contract-Change-Protocol

During Phase 5, Builders will discover gaps in the API contract. This is normal.

1. Builder sends `BLOCKER` message: gap/contradiction found
2. Chef + Planer evaluate → contract update with **version number** (v1.1, v1.2, ...)
3. Updated `api-contract.md` committed with changelog entry in `api-contract-changelog.md`
4. **Both Builders** notified of contract change → re-sync their code
5. Breaking changes: affected Builder stops, waits for new contract version

## Resumability

**Lange Multi-Agenten-Läufe WERDEN abbrechen.** The file-based design makes recovery possible:

1. New Chef agent started
2. Chef reads: `taskboard.md` → "Where are we?"
3. Chef reads: `messages.jsonl` (current phase) → "What happened?"
4. Chef reads: All artifacts (verified-research, architecture-plan, api-contract)
5. Chef verifies: git status, test results, open worktrees
6. Chef resumes from last checkpoint

**Taskboard must always reflect current state:**
```
## Aktueller Zustand
- **Aktuelle Phase:** {N}
- **Aktueller Slice:** {Feature X/Y}
- **Zuletzt abgeschlossen:** {Phase, Slice} — {evidence}
- **Als Nächstes:** {next actions}
- **Offene Blocker:** {list or "Keine"}
- **Contract-Version:** api-contract v{X.Y}
```

## Self-Limits

Agents self-limit via prompt instructions, not external watchers:
> "Wenn du merkst, dass du dich im Kreis drehst: Schreibe sofort ein Zwischenartefakt, sende eine BLOCKER-Message, und beende dich. Liefere lieber 80% als gar nichts."

Every agent writes checkpoint artifacts (even incomplete) before complex work.

## Integration

**Required Skills:**
- **REQUIRED SUB-SKILL:** superpowers:team-orchestration (taskboard, messaging, waves)
- **REQUIRED SUB-SKILL:** superpowers:using-superpowers (skill checks)
- **REQUIRED SUB-SKILL:** superpowers:brainstorming (before creative work)
- **REQUIRED SUB-SKILL:** superpowers:verification-before-completion (evidence gates)

**Situational Skills:**
- superpowers:writing-plans (Phase 3)
- superpowers:dispatching-parallel-agents (Phase 5)
- superpowers:using-git-worktrees (Phase 5)
- superpowers:test-driven-development (Phase 5)
- superpowers:requesting-code-review (Phase 7)
- superpowers:receiving-code-review (Phase 7)
- superpowers:systematic-debugging (any phase, on failure)
```

- [ ] **Step 5: Verify SKILL.md is complete and self-consistent**

Read the file back. Check:
- Frontmatter valid YAML with `name` and `description`
- Description starts with "Use when...", no workflow summary, < 1024 chars
- All cross-references point to files created in later tasks
- Phase checklist covers all 9 phases from spec
- Human-Checkpoint-Policy matches spec exactly
- No placeholders, no "TBD"

- [ ] **Step 6: Commit**

```bash
git add skills/dev-team/SKILL.md
git commit -m "feat(dev-team): add main SKILL.md orchestrator with phase workflow"
```

---

### Task 2: roles.md — Role Definitions with MVP Mapping

**Files:**
- Create: `skills/dev-team/roles.md`

**Interfaces:**
- Consumes: Referenced from `SKILL.md` via `[roles.md](roles.md)`
- Produces: Complete role definitions for all 11 agents + Chef. Each role includes: responsibility, agent type, model tier, access level, Stufe (MVP/Kern/Voll), self-limit instructions, and checkpoint artifact. Used by `SKILL.md` and all `prompts/*.md` files.

- [ ] **Step 1: Create `skills/dev-team/roles.md` with header and role table**

```markdown
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
```

- [ ] **Step 2: Add detailed role definitions for each agent**

Append each role definition following this pattern (repeat for all 12 roles — showing Chef and one representative role here, ALL must be written in full in the actual file):

```markdown
## 🎩 Chef (Manager/Genehmiger)

**Stufe:** MVP
**Agent-Typ:** custom (`coordinator`) — `define_subagent` with `enable_write_tools: true`, `enable_subagent_tools: true`
**Modell:** Most capable

**Verantwortung:**
- Überwacht gesamten Workflow, genehmigt jede Phase
- Einziger Agent mit direktem Kontakt zum Auftraggeber
- Arbeitet primär vom Taskboard (nicht rohen Message-Stream)
- Genehmigt Phasenübergänge nur bei Evidenz
- Resumability: frischer Chef rekonstruiert Zustand aus Taskboard + Artefakten

**Self-Limit:**
> "Wenn du als Chef merkst, dass ein Agent nicht zurückkommt oder du in einer Koordinationsschleife feststeckst: Schreibe den aktuellen Zustand ins Taskboard, sende eine BLOCKER-Message an den Auftraggeber, und beende dich."

**Checkpoint-Artefakt:** `taskboard.md` (immer aktuell halten)

---

## #9 Code-Reviewer A

**Stufe:** MVP
**Agent-Typ:** research (built-in, read-only)
**Modell:** Standard

**Verantwortung:**
- Runde 1: Prüft Backend-Code → liefert Findings (keine Direkt-Edits!)
- Runde 2: Prüft Frontend nach Fixes → liefert Findings
- Single-Owner-Invariante: Reviewer schreibt KEINEN Code. Builder fixt.

**Self-Limit:**
> "Wenn du merkst, dass du dich im Kreis drehst: Schreibe deine bisherigen Findings in messages.jsonl, sende eine BLOCKER-Message, und beende dich."

**Checkpoint-Artefakt:** Findings in `messages.jsonl`
```

Write out ALL 12 roles in full — no "similar to" references. Each engineer reads tasks independently.

- [ ] **Step 3: Add MVP role-combination note**

```markdown
## MVP Rollen-Kombination

In Stufe 1 (MVP) werden Rollen kombiniert:

| MVP-Agent | Kombiniert | Aufgaben |
|-----------|-----------|----------|
| Researcher/Fact-Checker | #1 + #2 | Recherchiert UND prüft Fakten in einem Durchlauf |
| Builder (Full-Stack) | #3 + #4 (+ #5) | Plant UND baut Backend + Frontend |
| Reviewer | #9 | Prüft gesamten Code (Findings only, Builder fixt) |
```

- [ ] **Step 4: Verify all 12 roles are complete**

Read `roles.md` back. Check:
- All 12 roles present with full details
- No "similar to" shortcuts
- Every role has: Stufe, Agent-Typ, Modell, Verantwortung, Self-Limit, Checkpoint-Artefakt
- Reviewer roles are read-only (Findings only)
- Security-Spezialist is read-only

- [ ] **Step 5: Commit**

```bash
git add skills/dev-team/roles.md
git commit -m "feat(dev-team): add roles.md with all 12 agent definitions and MVP mapping"
```

---

### Task 3: taskboard-template.md — Resumable Taskboard with Evidence Gates

**Files:**
- Create: `skills/dev-team/taskboard-template.md`

**Interfaces:**
- Consumes: Referenced from `SKILL.md` via workflow checklist
- Produces: A ready-to-use Markdown template that the Chef fills in at project start. Extends `team-orchestration`'s taskboard template with: "Aktueller Zustand" resume block, evidence gates per phase, contract version tracking, and dev-team-specific task structure.

- [ ] **Step 1: Create `skills/dev-team/taskboard-template.md`**

```markdown
# Dev-Team Taskboard

## Projekt: {PROJECT_NAME}
## Erstellt: {DATE}
## Chef-Session: {AGENT_SESSION}
## Stufe: {MVP|Kern|Voll}

---

## Aktueller Zustand (Resumability-Anker)

- **Aktuelle Phase:** {1-9}
- **Aktueller Slice:** {Feature X/Y (beschreibung)}
- **Zuletzt abgeschlossen:** {Phase N, Slice M} — {Evidenz: z.B. "alle Tests grün"}
- **Als Nächstes:** {nächste Aktion(en)}
- **Offene Blocker:** {Liste oder "Keine"}
- **Contract-Version:** api-contract v{X.Y}

---

## Team Members

| Rolle | Agent-Name | Agent-Typ | Status |
|-------|-----------|-----------|--------|
| 🎩 Chef | chef-1 | coordinator | active |
| #1+2 Researcher/Fact-Checker | researcher-1 | research | idle |
| #3+4 Builder | builder-1 | self | idle |
| #9 Reviewer | reviewer-1 | research | idle |

---

## Phasen-Status

| Phase | Name | Status | Evidenz-Gate | Bestanden |
|-------|------|--------|-------------|-----------|
| 1 | Informationsbeschaffung | pending | research-report.md existiert mit Quellen | ⬜ |
| 2 | Fakten-Check | blocked | verified-research.md, keine kritischen Claims offen | ⬜ |
| 3 | Planung + Contract | blocked | Plan + Contract genehmigt (✋ Human) | ⬜ |
| 4 | DB-Design (bedingt) | blocked | Schema-Migrations fehlerfrei | ⬜ |
| 5 | Entwicklung | blocked | Tests grün in allen Worktrees | ⬜ |
| 6 | QA + Security | blocked | Alle Tests GRÜN + keine Critical Findings + App bootet | ⬜ |
| 7 | Code-Review | blocked | Tests grün nach Review-Fixes | ⬜ |
| 8 | Integrations-Test | blocked | E2E grün + App bootet + Health-Check | ⬜ |
| 9 | Abnahme | blocked | Auftraggeber genehmigt (✋ Human) | ⬜ |

---

## Tasks

| ID | Phase | Name | Rolle | Status | Blocked By | Result |
|----|-------|------|-------|--------|------------|--------|
| T1 | 1 | Recherche | Researcher | pending | - | - |
| T2 | 2 | Fakten-Check | Fact-Checker | blocked | T1 | - |
| T3 | 3 | Architektur + Contract | Planer | blocked | T2 | - |
| T4 | 5 | Entwicklung | Builder | blocked | T3 | - |
| T5 | 6 | QA-Tests | QA-Tester | blocked | T4 | - |
| T6 | 7 | Code-Review | Reviewer | blocked | T5 | - |
| T7 | 9 | Abnahme | Chef | blocked | T6 | - |

---

## Execution Log

| Wave | Phase | Tasks | Gestartet | Abgeschlossen | Evidenz | Notizen |
|------|-------|-------|-----------|--------------|---------|---------|
| | | | | | | |

---

## Messages

See `.superpowers/team/messages.jsonl` for inter-agent communication.
See [message-schema.md](message-schema.md) for the structured format.
```

- [ ] **Step 2: Verify template is valid Markdown and parseable**

Read back. Check:
- "Aktueller Zustand" block has all 6 fields from spec
- Phasen-Status matches all 9 phases
- Evidence gates match spec exactly
- Tasks section shows MVP workflow (7 tasks)
- No placeholders except `{VARIABLE}` patterns intended for fill-in

- [ ] **Step 3: Commit**

```bash
git add skills/dev-team/taskboard-template.md
git commit -m "feat(dev-team): add taskboard template with resumability anchor and evidence gates"
```

---

### Task 4: message-schema.md + api-contract-template.md + contract-change-protocol.md

**Files:**
- Create: `skills/dev-team/message-schema.md`
- Create: `skills/dev-team/api-contract-template.md`
- Create: `skills/dev-team/contract-change-protocol.md`

**Interfaces:**
- Consumes: Referenced from `SKILL.md` and `taskboard-template.md`
- Produces:
  - `message-schema.md`: Structured JSON schema for `messages.jsonl` with all message types
  - `api-contract-template.md`: Versioned interface contract template for Backend↔Frontend
  - `contract-change-protocol.md`: Step-by-step protocol for updating the contract during builds

- [ ] **Step 1: Create `skills/dev-team/message-schema.md`**

```markdown
# Message Schema

Jede Zeile in `.superpowers/team/messages.jsonl` ist ein eigenständiges JSON-Objekt:

```json
{
  "from": "tech-dev-4",
  "to": "chef",
  "timestamp": "2026-06-22T15:30:00Z",
  "type": "STATUS",
  "severity": "INFO",
  "phase": 5,
  "msg": "Backend API /users/* implementiert, Tests grün (14/14)"
}
```

## Felder

| Feld | Typ | Pflicht | Werte |
|------|-----|---------|-------|
| `from` | string | ja | Agent-Identifier (z.B. `chef`, `researcher-1`, `builder-1`) |
| `to` | string | ja | Empfänger: `chef`, `all`, oder Agent-Identifier |
| `timestamp` | string | ja | ISO-8601 |
| `type` | string | ja | `STATUS`, `QUESTION`, `BLOCKER`, `COMPLETION`, `FINDING` |
| `severity` | string | ja | `INFO`, `WARNING`, `CRITICAL` |
| `phase` | number | ja | Aktuelle Phase (1-9) |
| `msg` | string | ja | Nachrichteninhalt |

## Message-Typen

- **STATUS** — Fortschrittsmeldung ("Feature X implementiert")
- **QUESTION** — Frage an Chef ("Soll ich REST oder GraphQL?")
- **BLOCKER** — Kann nicht weiterarbeiten ("Contract-Lücke bei /api/users")
- **COMPLETION** — Task abgeschlossen mit Evidenz ("Tests 14/14 grün")
- **FINDING** — Bug, Security-Issue, Review-Finding

## Concurrency

- **Append-only:** Mehrere Agenten können gleichzeitig schreiben, aber NUR anhängen
- Nie bestehende Zeilen ändern
- Chef komprimiert nach jeder Phase zu `messages-archive-phase-N.jsonl`
```

- [ ] **Step 2: Create `skills/dev-team/api-contract-template.md`**

```markdown
# API Contract

## Version: v1.0
## Projekt: {PROJECT_NAME}
## Erstellt: {DATE}
## Status: Draft | Approved | Updated

---

## Endpoints

| Method | Path | Request Body | Response | Auth | Builder |
|--------|------|-------------|----------|------|---------|
| GET | /api/example | - | `{ items: Item[] }` | JWT | #4 |
| POST | /api/example | `{ name: string }` | `{ id: string }` | JWT | #4 |

## Datentypen

```typescript
interface Item {
  id: string;
  name: string;
  createdAt: string; // ISO-8601
}
```

## Frontend-Konsumenten

| Seite/Komponente | Nutzt Endpoints | Builder |
|-----------------|-----------------|---------|
| ItemList | GET /api/example | #5 |
| CreateForm | POST /api/example | #5 |

## Regeln
- Dieser Contract ist **verbindlich** für #4 (Backend) und #5 (Frontend)
- Änderungen nur über das Contract-Change-Protocol
- Jede Änderung erhöht die Versionsnummer

---

## Änderungslog

| Version | Datum | Änderung | Grund | Breaking? |
|---------|-------|----------|-------|-----------|
| v1.0 | {DATE} | Initial | Erstellung | - |
```

- [ ] **Step 3: Create `skills/dev-team/contract-change-protocol.md`**

```markdown
# Contract-Change-Protocol

Der API-Contract ändert sich während des Builds — das ist normal. Builder entdecken Lücken erst beim Implementieren.

## Ablauf

1. **Builder entdeckt Lücke:** Endpoint fehlt, Datentyp passt nicht, Verhalten unklar
2. **Builder sendet BLOCKER-Message:**
   ```json
   {"from": "builder-1", "to": "chef", "type": "BLOCKER", "severity": "WARNING", "phase": 5, "msg": "Contract-Lücke: POST /api/users hat keinen Fehlerfall für duplicate email definiert"}
   ```
3. **Chef evaluiert** (ggf. mit Planer):
   - Non-Breaking → Chef aktualisiert Contract direkt (v1.1, v1.2, ...)
   - Breaking → **✋ HUMAN CHECKPOINT:** Auftraggeber entscheidet
4. **Contract-Update committen:**
   - Versionsnummer in `api-contract.md` erhöhen
   - Änderung im Änderungslog dokumentieren
5. **Beide Builder informieren** via Message:
   ```json
   {"from": "chef", "to": "all", "type": "STATUS", "severity": "WARNING", "phase": 5, "msg": "Contract v1.1: POST /api/users hat jetzt 409 Conflict bei duplicate email. Alle Builder bitte re-syncen."}
   ```
6. **Builder re-syncen** ihren Code auf die neue Contract-Version

## Breaking vs. Non-Breaking

| Breaking | Non-Breaking |
|----------|-------------|
| Endpoint entfernt | Neuer Endpoint hinzugefügt |
| Response-Format geändert | Optionales Feld hinzugefügt |
| Auth-Methode geändert | Fehlerfälle dokumentiert |
| Datentyp geändert | Enum-Wert hinzugefügt |
```

- [ ] **Step 4: Verify all three files**

Read back each file. Check:
- Message schema matches spec exactly (all 5 types, all 3 severities)
- API contract template has version tracking and changelog
- Contract-change-protocol has the 6-step process and breaking/non-breaking table
- No placeholders except `{VARIABLE}` patterns

- [ ] **Step 5: Commit**

```bash
git add skills/dev-team/message-schema.md skills/dev-team/api-contract-template.md skills/dev-team/contract-change-protocol.md
git commit -m "feat(dev-team): add message schema, api-contract template, and contract-change protocol"
```

---

### Task 5: lessons-learned-template.md — Human-Gated Learning System

**Files:**
- Create: `skills/dev-team/lessons-learned-template.md`

**Interfaces:**
- Consumes: Referenced from `SKILL.md` Phase 9 workflow
- Produces: Template for `.superpowers/team/lessons-learned.md` with the table structure (Phase, Agent, Fehler, Root Cause, Lösung, Schwere), pending rules section, and best practices. Read-only for agents, append-only for Chef.

- [ ] **Step 1: Create `skills/dev-team/lessons-learned-template.md`**

```markdown
# Lessons Learned

> **Read-Only für Agenten.** Nur der Chef schreibt in diese Datei (append-only).
> Prompt-Änderungen aus Lessons werden dem Auftraggeber als Draft vorgelegt — nie automatisch übernommen.

## Projekt: {PROJECT_NAME}
## Datum: {DATE}

---

### Fehler gefunden

| # | Phase | Agent | Fehler | Root Cause | Lösung | Schwere |
|---|-------|-------|--------|------------|--------|---------|
| | | | | | | |

**Schwere-Stufen:** Kritisch / Hoch / Mittel / Niedrig

---

### Neue Regeln (Vorschläge — pending Auftraggeber-Review)

- [ ] {Regel 1}
- [ ] {Regel 2}

> Auftraggeber reviewed diese Liste und genehmigt/verwirft/modifiziert.
> Nur genehmigte Regeln werden in Prompt-Templates übernommen.

---

### Best Practices bestätigt

- {Was hat gut funktioniert und warum}

---

### Prompt-Update-Vorschläge (Draft)

Folgende Änderungen an Prompt-Templates werden vorgeschlagen:

| Datei | Änderung | Begründung | Status |
|-------|----------|------------|--------|
| prompts/tech-developer.md | {Änderung} | {Begründung} | ⬜ Pending |

**Status:** ⬜ Pending | ✅ Genehmigt | ❌ Verworfen | ✏️ Modifiziert
```

- [ ] **Step 2: Commit**

```bash
git add skills/dev-team/lessons-learned-template.md
git commit -m "feat(dev-team): add lessons-learned template with human-gated prompt update workflow"
```

---

### Task 6: Agent Prompt Templates (prompts/*.md)

**Files:**
- Create: `skills/dev-team/prompts/chef.md`
- Create: `skills/dev-team/prompts/researcher.md`
- Create: `skills/dev-team/prompts/fact-checker.md`
- Create: `skills/dev-team/prompts/planner.md`
- Create: `skills/dev-team/prompts/tech-developer.md`
- Create: `skills/dev-team/prompts/visual-developer.md`
- Create: `skills/dev-team/prompts/db-architect.md`
- Create: `skills/dev-team/prompts/qa-tester.md`
- Create: `skills/dev-team/prompts/security-specialist.md`
- Create: `skills/dev-team/prompts/code-reviewer-a.md`
- Create: `skills/dev-team/prompts/code-reviewer-b.md`
- Create: `skills/dev-team/prompts/integration-tester.md`

**Interfaces:**
- Consumes: Role definitions from `roles.md` (Task 2), message schema from `message-schema.md` (Task 4)
- Produces: Ready-to-paste system prompts for `define_subagent` or dispatch prompt inclusion. Each prompt contains: role statement, responsibilities, file paths, self-limit instructions, checkpoint requirements, message format, and completion contract.

- [ ] **Step 1: Create `skills/dev-team/prompts/chef.md`**

```markdown
# Chef (Manager/Genehmiger) — System Prompt

Du bist der Chef eines dev-team Projekts. Du koordinierst, genehmigst und kommunizierst — du schreibst KEINEN Code.

## Deine Aufgaben
1. Taskboard aktuell halten (`.superpowers/team/taskboard.md`) — du bist der EINZIGE Schreiber
2. Phasenübergänge nur bei Evidenz genehmigen
3. Sub-Agenten dispatchen und deren Ergebnisse prüfen
4. Einziger Kontakt zum Auftraggeber — alle Agenten melden an dich
5. Messages lesen bei Phase-Übergängen und Eskalationen

## Human-Checkpoint-Policy
Du entscheidest autonom bei Evidenz-Gates (Tests grün, App bootet).
Du eskalierst an den Auftraggeber bei:
- Phase 3: Plan + Contract-Genehmigung
- Phase 9: Abnahme
- BLOCKER die du nicht selbst lösen kannst
- Breaking Contract-Changes

## Dateien
- Taskboard: `.superpowers/team/taskboard.md` (dein Hauptwerkzeug)
- Messages: `.superpowers/team/messages.jsonl` (lesen bei Übergängen)
- Lessons: `.superpowers/team/lessons-learned.md` (append-only nach Projekt)

## Self-Limit
Wenn du in einer Koordinationsschleife feststeckst oder ein Agent nicht zurückkommt:
1. Schreibe den aktuellen Zustand ins Taskboard
2. Sende eine BLOCKER-Message an den Auftraggeber
3. Beende dich — ein frischer Chef kann aus dem Taskboard weitermachen

## Resumability
Wenn du als frischer Chef gestartet wirst:
1. Lies `taskboard.md` → "Wo stehen wir?"
2. Lies `messages.jsonl` (letzte Phase) → "Was ist passiert?"
3. Lies alle Artefakte → Kontext aufbauen
4. Setze Arbeit fort ab dem letzten Checkpoint
```

- [ ] **Step 2: Create `skills/dev-team/prompts/researcher.md`**

```markdown
# Researcher (Informationsbeschaffer) — System Prompt

Du bist ein Research-Agent im dev-team. Deine Aufgabe ist umfassende Informationsbeschaffung.

## Deine Aufgaben
1. Zum Projekt-Thema recherchieren: Technologien, Best Practices, Patterns
2. Quellen dokumentieren
3. Technologie-Optionen auflisten mit Vor-/Nachteilen
4. Ergebnisse strukturiert in `research-report.md` schreiben

## BEVOR du startest
1. Lies `taskboard.md` → Verstehe deine Aufgabe
2. Lies `messages.jsonl` → Kontext von anderen Agenten

## Output
Schreibe deinen Report nach: `.superpowers/team/research-report.md`

## Self-Limit
Wenn du merkst, dass die Recherche zu komplex wird oder du dich im Kreis drehst:
1. Schreibe sofort einen Zwischenstand in `research-report.md` (auch unvollständig!)
2. Sende eine BLOCKER-Message an den Chef
3. Beende dich — liefere lieber 80% als gar nichts

## Completion
Wenn fertig:
1. Update Taskboard: deine Task auf "completed"
2. Sende COMPLETION-Message an Chef:
   ```json
   {"from": "researcher-1", "to": "chef", "type": "COMPLETION", "severity": "INFO", "phase": 1, "msg": "Research-Report fertig. X Quellen, Y Technologie-Optionen analysiert."}
   ```
```

- [ ] **Step 3: Create `skills/dev-team/prompts/fact-checker.md`**

```markdown
# Fakten-Prüfer — System Prompt

Du bist ein Fact-Checker-Agent im dev-team. Deine Aufgabe ist die kritische Verifizierung aller Recherche-Ergebnisse.

## Deine Aufgaben
1. `research-report.md` von Researcher lesen
2. Jede Behauptung prüfen (verschiedene Quellen)
3. Halluzinationen identifizieren und markieren
4. Bei Unsicherheit: als "unbestätigt" markieren (lieber zu vorsichtig)
5. Aufgeräumten, faktengeprüften Report erstellen

## BEVOR du startest
1. Lies `taskboard.md` → Verstehe deine Aufgabe
2. Lies `.superpowers/team/research-report.md` → Das prüfst du

## Output
Schreibe deinen Report nach: `.superpowers/team/verified-research.md`

Für jede Behauptung im Research-Report:
- ✅ Bestätigt (Quelle angeben)
- ⚠️ Unbestätigt (Grund angeben)
- ❌ Falsch (Korrektur + Quelle)

## Self-Limit
Max 3 Prüfungsversuche pro Behauptung. Danach als "nicht verifizierbar" markieren.
Wenn du merkst, dass du dich im Kreis drehst: Zwischenstand schreiben, BLOCKER-Message.

## Completion
Wenn fertig:
1. Update Taskboard: deine Task auf "completed"
2. Sende COMPLETION-Message an Chef
```

- [ ] **Step 4: Create `skills/dev-team/prompts/planner.md`**

```markdown
# Planer (Architect) — System Prompt

Du bist der Planer/Architekt im dev-team. Du entwirfst die Software-Architektur und den API-Contract.

## Deine Aufgaben
1. `verified-research.md` lesen → Architektur ableiten
2. API-Contract erstellen (`api-contract.md` v1.0) — DER zentrale Vertrag
3. Aufgaben in vertikale Slices aufteilen (je ein Feature komplett durch)
4. Rollen für Builder definieren

## BEVOR du startest
1. Lies `taskboard.md`
2. Lies `.superpowers/team/verified-research.md`
3. Lies `.superpowers/team/lessons-learned.md` (wenn vorhanden)

## REQUIRED SUB-SKILL: superpowers:writing-plans

## Output
- `.superpowers/team/architecture-plan.md`
- `.superpowers/team/api-contract.md` (v1.0)

## Self-Limit
Der Contract muss VOLLSTÄNDIG sein bevor die Builder starten. Lieber mehr Endpoints definieren als zu wenige — fehlende Endpoints erzeugen teure BLOCKER in Phase 5.

## Completion
1. Update Taskboard
2. COMPLETION-Message mit Zusammenfassung der Architektur-Entscheidungen
3. **Hinweis:** Phase 3 ist ein ✋ HUMAN CHECKPOINT — Auftraggeber muss Plan + Contract genehmigen
```

- [ ] **Step 5: Create `skills/dev-team/prompts/tech-developer.md`**

```markdown
# Technischer Entwickler (Backend Builder) — System Prompt

Du bist ein Backend-Builder im dev-team. Du implementierst die Serverseite.

## Deine Aufgaben
1. Backend-Code, APIs, Logik, Datenverarbeitung implementieren
2. KEIN UI — nur technischer/funktionaler Code
3. TDD: Test ZUERST schreiben, dann implementieren

## BEVOR du startest
1. Lies `taskboard.md` → Deine zugewiesene Aufgabe
2. Lies `.superpowers/team/api-contract.md` → VERBINDLICH. Deine API muss exakt diesen Contract erfüllen
3. Lies `messages.jsonl` → Kontext von anderen Agenten
4. Lies `.superpowers/team/lessons-learned.md` (wenn vorhanden)

## REQUIRED SUB-SKILL: superpowers:test-driven-development

## Isolation
- Du arbeitest in deinem eigenen Git Worktree (`worktree-backend/`)
- Berühre NIEMALS den Frontend-Worktree
- Committe regelmäßig (auch WIP)

## Contract-Lücken
Wenn du eine Lücke im API-Contract findest:
1. STOPP — nicht raten oder erfinden
2. Sende BLOCKER-Message an Chef:
   ```json
   {"from": "builder-1", "to": "chef", "type": "BLOCKER", "severity": "WARNING", "phase": 5, "msg": "Contract-Lücke: [beschreibung]"}
   ```
3. Warte auf Contract-Update oder arbeite an einem anderen Slice weiter

## Self-Limit
Pro Feature-Slice: ein abgeschlossenes, commitbares Artefakt liefern.
Bei Überforderung: committen was da ist, BLOCKER-Message an Chef.

## Completion
1. Alle Tests grün
2. Code committet
3. Update Taskboard + COMPLETION-Message
```

- [ ] **Step 6: Create `skills/dev-team/prompts/visual-developer.md`**

```markdown
# Visueller Entwickler (Frontend Builder) — System Prompt

Du bist ein Frontend-Builder im dev-team. Du implementierst die Benutzeroberfläche.

## Deine Aufgaben
1. UI/UX, Frontend-Code, visuelle Gestaltung implementieren
2. NUR visueller/interaktiver Teil
3. TDD: Test ZUERST, dann implementieren

## BEVOR du startest
1. Lies `taskboard.md`
2. Lies `.superpowers/team/api-contract.md` → VERBINDLICH. Deine Frontend-Calls müssen exakt den Contract nutzen
3. Lies `messages.jsonl`
4. Lies `.superpowers/team/lessons-learned.md` (wenn vorhanden)

## REQUIRED SUB-SKILL: superpowers:test-driven-development

## Isolation
- Du arbeitest in deinem eigenen Git Worktree (`worktree-frontend/`)
- Berühre NIEMALS den Backend-Worktree
- Committe regelmäßig (auch WIP)

## Contract-Lücken
Gleicher Ablauf wie Backend: STOPP → BLOCKER-Message → warten oder anderer Slice.

## Self-Limit
Pro Feature-Slice: ein abgeschlossenes, commitbares Artefakt liefern.
Bei Überforderung: committen was da ist, BLOCKER-Message an Chef.

## Completion
1. Alle Tests grün
2. Code committet
3. Update Taskboard + COMPLETION-Message
```

- [ ] **Step 7: Create remaining prompts (`db-architect.md`, `qa-tester.md`, `security-specialist.md`, `code-reviewer-a.md`, `code-reviewer-b.md`, `integration-tester.md`)**

Create each file following the same pattern. Key differences:

**`prompts/db-architect.md`** — Stufe Voll. Reads architecture-plan + api-contract. Writes schema + migrations. Must run before Builders. Chef-Genehmigung required.

**`prompts/qa-tester.md`** — Stufe Kern. Writes test files ONLY, no production code. Output: test-report.md with binary Pass/Fail. Runs AFTER development.

**`prompts/security-specialist.md`** — Stufe Voll. READ-ONLY. Writes security-report.md. Does NOT fix code. Critical findings block Phase 7.

**`prompts/code-reviewer-a.md`** — Stufe MVP. READ-ONLY. Delivers Findings list in messages.jsonl. Does NOT edit code. Runde 1: Backend, Runde 2: Frontend (kreuz). Single-Owner invariant.

**`prompts/code-reviewer-b.md`** — Stufe Voll. READ-ONLY. Same as Reviewer A but reversed: Runde 1: Frontend, Runde 2: Backend.

**`prompts/integration-tester.md`** — Stufe Voll. E2E tests on merged codebase. Output: integration-report.md. Evidence gate: E2E green + app boots.

Write out ALL files in full — no shortcuts. Each prompt must be complete and self-contained.

- [ ] **Step 8: Verify all 12 prompt files exist and are consistent**

Check:
- All 12 files in `skills/dev-team/prompts/`
- Each has: role statement, tasks, "BEVOR du startest", output, self-limit, completion
- Reviewer prompts explicitly state READ-ONLY and Single-Owner
- Builder prompts reference api-contract as VERBINDLICH
- Message format matches `message-schema.md`
- No file references incorrect paths

- [ ] **Step 9: Commit**

```bash
git add skills/dev-team/prompts/
git commit -m "feat(dev-team): add all 12 agent prompt templates"
```

---

### Task 7: Integration Test — Verify Complete Skill

**Files:**
- Verify: All files in `skills/dev-team/`

**Interfaces:**
- Consumes: All files from Tasks 1-6
- Produces: Verification that the skill is complete, internally consistent, and ready for deployment

- [ ] **Step 1: Verify file structure matches spec**

Expected:
```
skills/dev-team/
├── SKILL.md
├── roles.md
├── taskboard-template.md
├── api-contract-template.md
├── contract-change-protocol.md
├── lessons-learned-template.md
├── message-schema.md
└── prompts/
    ├── chef.md
    ├── researcher.md
    ├── fact-checker.md
    ├── planner.md
    ├── tech-developer.md
    ├── visual-developer.md
    ├── db-architect.md
    ├── qa-tester.md
    ├── security-specialist.md
    ├── code-reviewer-a.md
    ├── code-reviewer-b.md
    └── integration-tester.md
```

Run: `Get-ChildItem -Recurse skills/dev-team/ | Select-Object FullName`
Expected: All 19 files listed above

- [ ] **Step 2: Cross-reference check**

Verify all cross-references in SKILL.md point to files that exist:
- `[roles.md](roles.md)` → `skills/dev-team/roles.md` ✓
- `[taskboard-template.md](taskboard-template.md)` → exists ✓
- `[message-schema.md](message-schema.md)` → exists ✓
- `[api-contract-template.md](api-contract-template.md)` → exists ✓
- `[contract-change-protocol.md](contract-change-protocol.md)` → exists ✓
- `[lessons-learned-template.md](lessons-learned-template.md)` → exists ✓

- [ ] **Step 3: Spec coverage check**

Compare against [v3 spec](file:///c:/Users/petra/Neuer%20Ordner/docs/superpowers/specs/2026-06-22-dev-team-design.md):

| Spec Section | Implemented In | Status |
|-------------|---------------|--------|
| Team-Zusammensetzung | roles.md | ⬜ |
| Skalierungsmodell | SKILL.md (Scaling Model) | ⬜ |
| Phasen-Workflow | SKILL.md (Workflow Checklist) | ⬜ |
| Human-Checkpoint-Policy | SKILL.md | ⬜ |
| Contract-Change-Protocol | contract-change-protocol.md | ⬜ |
| Resumability | SKILL.md + taskboard-template.md | ⬜ |
| Kommunikations-System | message-schema.md | ⬜ |
| Git Worktree Isolation | SKILL.md (Phase 5) + prompts | ⬜ |
| Evidenz-basierte Quality Gates | taskboard-template.md | ⬜ |
| Lern-System (Human-Gated) | lessons-learned-template.md | ⬜ |
| Selbst-Limitierung | All prompts (self-limit section) | ⬜ |
| Anti-Patterns | SKILL.md (Red Flags) | ⬜ |
| Skill-Komposition | SKILL.md (Integration) | ⬜ |

- [ ] **Step 4: Add Anti-Patterns/Red Flags section to SKILL.md if missing**

Check if SKILL.md has a Red Flags or Anti-Patterns section matching the spec's 21 anti-patterns. If missing, add it.

- [ ] **Step 5: Final commit**

```bash
git add skills/dev-team/
git commit -m "feat(dev-team): complete skill — all files verified against v3 spec"
```

---

## Self-Review Results

**1. Spec coverage:** All sections of the v3 spec are mapped to implementation tasks. The only item deferred is the `idea-scout` skill (explicitly out of scope per spec: "Wird als separater Skill implementiert nach erfolgreichem MVP").

**2. Placeholder scan:** No "TBD", "TODO", "implement later", "similar to Task N" found. All code blocks contain actual content. Template variables use `{VARIABLE}` syntax which is intentional fill-in.

**3. Type consistency:**
- `messages.jsonl` format: consistent across message-schema.md, all prompts, contract-change-protocol.md
- File paths: consistent `.superpowers/team/` prefix across all files
- Agent identifiers: consistent `researcher-1`, `builder-1`, `reviewer-1` naming
- Taskboard path: consistent `.superpowers/team/taskboard.md` across all references
