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

> Anpassen je nach Stufe (Kern/Voll: mehr Team Members hinzufügen, siehe roles.md)

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
| T3 | 3 | Architektur + Contract | Planer/Builder | blocked | T2 | - |
| T4 | 5 | Entwicklung | Builder | blocked | T3 | - |
| T5 | 6 | QA-Tests | QA-Tester/Builder | blocked | T4 | - |
| T6 | 7 | Code-Review | Reviewer | blocked | T5 | - |
| T7 | 9 | Abnahme | Chef | blocked | T6 | - |

> Bei Stufe Kern/Voll: Tasks aufteilen (z.B. T4a Backend, T4b Frontend, T5a QA, T5b Security)

---

## Execution Log

| Wave | Phase | Tasks | Gestartet | Abgeschlossen | Evidenz | Notizen |
|------|-------|-------|-----------|--------------|---------|---------|
| | | | | | | |

---

## Blocker-History

| # | Phase | Agent | Beschreibung | Lösung | Gelöst |
|---|-------|-------|-------------|--------|--------|
| | | | | | |

---

## Status-Legende

- **pending** — Bereit zum Dispatchen, alle Blocker aufgelöst
- **in-progress** — Agent arbeitet aktuell daran
- **completed** — Erfolgreich abgeschlossen, Ergebnis dokumentiert
- **blocked** — Wartet auf Abhängigkeit (siehe Blocked By)
- **failed** — Braucht Intervention oder Re-Dispatch mit Änderungen

---

## Messages

See `.superpowers/team/messages.jsonl` for inter-agent communication.
See [message-schema.md](message-schema.md) for the structured format.
