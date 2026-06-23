# CLI Expense Tracker — Design Specification

Design specification for Phase B Option 2: CLI Expense Tracker.

## 1. Goal & Context
Build a CLI-based expense tracker using Node.js stdlib only. Expenses are stored in a single JSON file (`expenses.json`) in the app directory. Each expense record has a unique ID, description, amount, category, date, and timestamp.

## 2. Directory Structure & Files
We will create a directory `expense_tracker` in the workspace:
```
expense_tracker/
  expenses.json        # JSON storage file (created dynamically, gitignored)
  tracker.js           # Core logic and CLI entry point
  tracker.test.js      # Comprehensive test suite
  package.json         # Configured with test commands
```

## 3. CLI Commands & Slices

### Slice 1: Core CRUD & Storage
* `add <amount> "<description>" "<category>"`:
  * Rejects empty descriptions or categories.
  * Validates that amount is a positive number.
  * Automatically sets the date to `YYYY-MM-DD` (today local time).
  * Persists to `expenses.json` with an auto-incremented ID.
* `list`: Prints all expenses in the format `[<id>] <date> - <description> (<category>): $<amount>`.
* `delete <id>`: Deletes the expense by ID. Exits 1 if not found.
* `summary`: Prints total expenses sum (e.g. `Total Expenses: $120.50`).

### Slice 2: Filtering, Dates & Budgets
* Filtering:
  * `list --category <category>`: Filter expenses by category (case-insensitive).
  * `list --month <YYYY-MM>`: Filter expenses to a specific month (e.g. `2026-06`).
  * Combined filters: `list --category food --month 2026-06`.
* Budgets:
  * `budget <category> <limit>`: Sets a monthly budget limit for a category in a config file `.budgetconfig.json`.
  * When `add` is run, if the category has a budget and the total expenses in the current month for that category exceed the limit (including the new expense), print a warning to `stdout`: `[WARNING] Budget limit for <category> ($<limit>) exceeded! Current month total: $<total>`.

## 4. Test Strategy & Isolation
* Environment variables: `EXPENSES_STORE` dynamically redirects the target JSON storage file.
* Environment variables: `BUDGET_STORE` redirects the target budget config file.
* Test suite uses `beforeEach` and `afterEach` hooks to create and clean up temporary paths for both stores.
* Tests run sequentially under `{ concurrency: false }` to avoid resource race conditions.
