# CLI Notes / Knowledge Base Manager — Slice 2 Design Specification

Design specification for Phase B Option 1: CLI Notes / Knowledge Base Manager. Focuses on Slice 2: Interactive Tagging & Category Filters.

## 1. Goal & Context
Extend the CLI Notes Manager to allow users to categorize and tag notes. When adding a note, the user is prompted interactively to enter an optional category and optional tags. The `list` command is updated to support filtering by category, tags, or both.

## 2. Interactive Prompt Design
When adding a note via `node notes.js add "<title>" "<content>"`, the CLI runs the following prompts:
1. `Category (optional): `
2. `Tags (comma-separated, optional): `

### Implementation Details:
* Use Node.js `node:readline` module to capture terminal input.
* Ask the questions sequentially.
* Split tags by `,` and clean whitespace (`map(t => t.trim())`). Remove empty tags.
* Save the metadata inside the note Markdown file:
  * Single string value for `category` (if provided).
  * YAML array list for `tags` (if provided).

## 3. CLI List Filtering
* `list --category <name>`: Filter notes to only show those matching the category (case-insensitive).
* `list --tag <name>`: Filter notes to only show those containing the tag (case-insensitive).
* The filters can be combined using AND logic.
* If a filter option is missing a value, print an error and exit 1.

## 4. Test Strategy
* Interactive input is tested by passing the `input` string parameter to `spawnSync` (e.g., `input: "work\nurgent, chore\n"`).
* Test cases:
  * Add note with both category and tags.
  * Add note with only category.
  * Add note with only tags.
  * Add note with neither (pressing enter twice).
  * Filter list by category, by tag, and combined.
  * Verify validation errors for malformed CLI list options.
