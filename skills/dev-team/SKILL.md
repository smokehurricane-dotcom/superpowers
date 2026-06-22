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

## Scaling Model

Start with MVP (4 agents). Scale up only after MVP runs successfully on a throwaway project.

| Stufe | Agenten | Wann aktivieren |
|-------|---------|-----------------|
| 1 (MVP) | Chef + Researcher/Fact-Checker + Builder + Reviewer | Sofort — erster Einsatz |
| 2 (Kern) | + separater Planer, Frontend-Builder, QA-Tester | Wenn Projekte zu groß für einen Builder |
| 3 (Voll) | + DB-Architekt, Security, Reviewer B, Integrations-Tester | Enterprise-Projekte |

> **Erster Lauf = Wegwerf-Projekt.** Teste den MVP an einem winzigen Projekt (CLI-Todo, 1-Endpoint-API + 1 Seite), an dem du jeden Schritt debuggen kannst. Erst danach an echte Projekte.

See [roles.md](roles.md) for all role definitions and their MVP/Kern/Voll mapping.

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

See [contract-change-protocol.md](contract-change-protocol.md) for details.

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

Every agent writes checkpoint artifacts (even incomplete) before complex work. See individual agent prompts in [prompts/](prompts/) for details.

## Red Flags

| ❌ Nicht tun | ✅ Stattdessen |
|-------------|---------------|
| Mit vollem Team starten | MVP mit 4 Agenten, dann skalieren |
| MVP an wichtigem Projekt testen | Wegwerf-Projekt zum Debuggen |
| Parallele Builder ohne Worktrees | Git Worktree pro Builder |
| Phase-Gates auf "Report geschrieben" | Evidenz: Tests grün, App bootet |
| Entwickler ohne API-Contract starten | Contract-First |
| Contract als unveränderlich behandeln | Contract-Change-Protokoll |
| Reviewer editieren Code direkt | Findings-Only, Builder fixt (Single-Owner) |
| Prompt-Templates automatisch ändern | Human-Gated: Auftraggeber reviewed |
| "Most capable" für alle Agenten | Nur Chef + Planer auf teuerstem Modell |
| Chef liest rohen Message-Stream | Taskboard + komprimierte Summaries |
| Auftraggeber bei jeder Phase fragen | Human-Checkpoint-Policy beachten |
| Session-Crash = alles verloren | Resumability: Taskboard + Artefakte |

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
