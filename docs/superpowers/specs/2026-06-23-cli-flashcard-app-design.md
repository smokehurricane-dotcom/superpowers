# CLI Flashcard App — Design Specification

Design specification for Phase B Option 3: CLI Flashcard App.

## 1. Goal & Context
Build a CLI-based study flashcard manager using Node.js stdlib only. Flashcards are stored in a single JSON file (`flashcards.json`) in the app directory. Each flashcard has an ID, question, answer, and review history (spaced repetition Leitner box, score).

## 2. Directory Structure & Files
We will create a directory `flashcard_app` in the workspace:
```
flashcard_app/
  flashcards.json      # JSON storage file (created dynamically, gitignored)
  flashcards.js        # Core logic and CLI entry point
  flashcards.test.js   # Comprehensive test suite
  package.json         # Configured with test commands
```

## 3. CLI Commands & Slices

### Slice 1: Card Management & Basic Study Mode
* `add "<question>" "<answer>"`:
  * Rejects empty questions or answers.
  * Auto-assigns incremental ID.
  * Defaults Leitner box to `1` (initial learning box).
* `list`: Prints all flashcards in the format `[<id>] Q: <question> | A: <answer> (Box: <box>)`.
* `delete <id>`: Deletes card by ID. Exits 1 if not found.
* `study`: Interactive study session.
  * Sequentially prompts user with each card's question.
  * User presses Enter to reveal the answer.
  * User is prompted: `Correct? (y/n): `.
  * Logs success rate at the end of the session.

### Slice 2: Spaced Repetition (Leitner Leitner-Box System)
* Leitner System logic:
  * A card starts in Box 1.
  * If reviewed correctly: promoted to next box (Box 1 -> Box 2 -> Box 3). Max box is 3.
  * If reviewed incorrectly: demoted back to Box 1.
* Filtered Study:
  * `study --box <number>`: Only quiz cards currently in the specified Leitner box.
* Stats command:
  * `stats`: Prints count of cards in each box, and overall success rate history.
