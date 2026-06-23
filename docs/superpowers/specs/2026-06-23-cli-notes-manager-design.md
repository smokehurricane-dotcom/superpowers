# CLI Notes / Knowledge Base Manager — Design Specification

Design specification for Phase B Option 1: CLI Notes / Knowledge Base Manager. Focuses on Slice 1: Core CRUD with individual Markdown file storage and a custom YAML state-machine parser.

## 1. Goal & Context
Build a CLI-based notes manager using Node.js stdlib only. Notes are stored as individual Markdown files inside a `notes/` directory, rather than a single database file. Metadata (such as title, creation date, and future tags) is embedded as YAML frontmatter within the `.md` files.

## 2. Directory Structure & Files
We will create a separate folder `notes_app` in the workspace to contain this application:
```
notes_app/
  notes/             # Runtime storage folder for notes (gitignored)
  notes.js           # Core business logic and CLI entry point
  notes.test.js      # Complete test suite
  package.json       # Configured with test commands
```

Filenames follow the format `<id>-<slug>.md` (e.g. `1-shopping-list.md`).

## 3. YAML State-Machine Parser Specification
Since the application runs on standard Node.js libraries, we implement a state-machine parser to process the frontmatter.

### States
* `INIT`: Looking for the opening `---`. If the file does not start with `---`, the entire content is treated as the body.
* `FRONTMATTER`: Inside the metadata block. Parses keys and values.
  * Transitions to `BODY` on the closing `---`.
  * Matches `^([^:]+):\s*(.*)` for basic `key: value` pairs.
  * Matches `^\s*-\s+(.*)` to collect list array elements under the last key.
* `BODY`: Collects all remaining lines of the file.

### Serializer
Writes the metadata block and body back into a Markdown file:
```markdown
---
title: My Title
created: 2026-06-23
---
Body text goes here.
```

## 4. CLI Commands
* `add "<title>" "<content>"`: Increment max ID from folder, slugify title, write file, print success.
* `list`: Read folder, parse all files, print `[<id>] <title> (Created: <date>) - <snippet>...` in ID order.
* `show <id>`: Parse and display the note's details. Exit 1 if not found.
* `delete <id>`: Remove note file, print success. Exit 1 if not found.

## 5. Test Isolation
* Storage folder resolved via `process.env.NOTES_DIR || path.join(__dirname, 'notes')`.
* Tests dynamically provision a unique temporary folder in `beforeEach` and clean it up in `afterEach`.
* Describe blocks set `concurrency: false` to ensure sequential execution.
