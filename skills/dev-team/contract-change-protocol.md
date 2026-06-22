# Contract-Change Protocol

> Contracts evolve during development — that is normal. Gaps surface in Phase 5 (this always happens). This protocol handles changes without causing integration drift.

---

## When to Use

Use this protocol whenever:
- A Builder (#4 or #5) finds a gap or contradiction in `api-contract.md`
- A new requirement surfaces that changes an existing endpoint
- DB schema changes affect the contract
- Either builder cannot proceed without a contract clarification

---

## Step 1 — Builder Discovers Gap

Builder sends BLOCKER to Chef and **stops work on the affected endpoint**. Work on unrelated endpoints continues.

```json
{
  "from": "tech-dev-4",
  "to": "chef",
  "timestamp": "{{ISO_TIMESTAMP}}",
  "type": "BLOCKER",
  "severity": "WARNING",
  "phase": 5,
  "msg": "Contract gap: GET /users/:id response missing 'role' field — needed for auth middleware. Cannot implement auth without contract update."
}
```

---

## Step 2 — Chef + Planner Evaluate

Chef dispatches #3 Planner (or decides directly for simple gaps) to classify the change:

| Change Type | Breaking? | Approver |
|-------------|-----------|----------|
| Add optional field to response | No | Chef autonomous |
| Add optional query parameter | No | Chef autonomous |
| Add new endpoint | No | Chef autonomous |
| Make optional field required | **Yes** | Client involvement |
| Remove field from response | **Yes** | Client involvement |
| Change field type or name | **Yes** | Client involvement |
| Rename or remove endpoint | **Yes** | Client involvement |
| Change authentication scheme | **Yes** | Client involvement |

---

## Step 3 — Update the Contract

Planner (or Chef for simple changes) updates `api-contract.md`:

1. Increment version number:
   - Non-breaking: v1.0 → v1.1
   - Breaking: v1.0 → v2.0
2. Add entry to the Changelog table in `api-contract.md`
3. Append entry to `api-contract-changelog.md`
4. Commit immediately:

```bash
git add .superpowers/team/api-contract.md .superpowers/team/api-contract-changelog.md
git commit -m "contract: update to v1.1 — add 'role' field to GET /users/:id response"
```

---

## Step 4 — Notify Both Builders

Chef sends STATUS to both #4 AND #5 regardless of which builder triggered the change:

```json
{
  "from": "chef",
  "to": "all-builders",
  "timestamp": "{{ISO_TIMESTAMP}}",
  "type": "STATUS",
  "severity": "WARNING",
  "phase": 5,
  "msg": "Contract updated to v1.1. Change: GET /users/:id now includes 'role: string' in response. Non-breaking. #4: add role to response serializer. #5: update UserHeader component to read role from user object."
}
```

---

## Step 5 — Builders Re-Sync

Both builders:
1. Read the updated `api-contract.md`
2. Update their code for affected endpoints
3. Re-run tests for affected endpoints

**On Breaking Changes:** Affected builder STOPS all work and waits for Chef confirmation that the updated contract is committed before proceeding.

---

## api-contract-changelog.md Format

Maintain this file separately for a clean change history:

```markdown
# API Contract Changelog

## v1.2 — {{DATE}}
**Breaking:** No
**Change:** Added `POST /auth/refresh` endpoint for token refresh
**Affects:** Frontend (#5) — add token refresh logic to API client

## v1.1 — {{DATE}}
**Breaking:** No
**Change:** GET /users/:id response now includes `role: "admin" | "user"` field
**Affects:** Backend (#4) — include role in serializer; Frontend (#5) — read role in UserHeader

## v1.0 — {{DATE}}
**Initial contract**
```

---

## Why This Matters

Without this protocol, integration drift re-enters through the back door:
- Backend builds `/users/:id` returning `{ id, name, email }`
- Frontend expects `{ id, name, email, role }` (found this in a related endpoint)
- Integration test fails in Phase 8
- Both builders have to change code that was "done"

With the protocol, the drift is caught in Phase 5 and resolved in minutes with a version increment and a two-builder notification.
