# Lessons Learned

> Append-only. Never delete entries. Read-only for all agents — Chef writes only.
> Copy this file to `.superpowers/team/lessons-learned.md` at project start.
> All agents read this at session start and apply known patterns.

---

## Project: {{PROJECT_NAME}}
## Date: {{DATE}}
## Tech Stack: {{TECH_STACK}}
## Team: MVP (4) / Core (7) / Full (11)

---

## Bugs Found

| # | Phase | Agent | Bug | Root Cause | Fix | Severity |
|---|-------|-------|-----|------------|-----|---------|
| — | — | — | — | — | — | — |

---

## Contract Gaps Found

> Gaps discovered during Phase 5 that required the Contract-Change Protocol.
> Use these to improve future contracts from the start.

| # | Contract Gap | Found In Phase | Contract Version | Breaking? |
|---|-------------|----------------|-----------------|-----------|
| — | — | — | — | — |

---

## What Slowed Us Down

| # | Description | Phase | Impact | Suggestion |
|---|-------------|-------|--------|-----------|
| — | — | — | — | — |

---

## What Worked Well

| # | Description | Phase | Why It Worked |
|---|-------------|-------|--------------|
| — | — | — | — |

---

## Best Practices Confirmed

- *(Examples: "TDD prevented 3 bugs in Phase 5", "Cross-review caught 2 contract mismatches")*

---

## Proposed Rule Changes (Pending Client Review)

> Chef proposes these based on project findings. Client must approve before applying to prompt templates.
> Mark each as pending/approved/rejected.

### Proposal {{N}}

**Proposed change to:** {{AGENT}} prompt / {{PHASE}} workflow / {{TEMPLATE}} template
**Current behavior:** {{CURRENT}}
**Proposed behavior:** {{PROPOSED}}
**Reason:** {{WHY — specific incident or finding that motivated this}}
**Status:** [ ] Pending · [ ] Approved · [ ] Rejected · [ ] Modified by client

---

## Prompt Update Drafts (Human Review Required)

> Filled in by Chef after project completion. Client reviews and decides. Approved drafts are applied to prompt templates in `skills/dev-team/prompts/`. Rejected drafts stay here as reference.

### Draft {{N}} — {{AGENT}} prompt

**Change type:** Addition / Removal / Modification

**Before:**
```
{{CURRENT_TEXT}}
```

**After:**
```
{{PROPOSED_TEXT}}
```

**Motivated by:** {{SPECIFIC_FINDING — phase, agent, what happened}}

**Status:** [ ] Pending · [ ] Approved · [ ] Rejected · [ ] Modified

---

## Previous Projects

> Links or references to prior lessons-learned files for historical context.
