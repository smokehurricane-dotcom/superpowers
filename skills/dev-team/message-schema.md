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

## Beispiele

```json
{"from": "researcher-1", "to": "chef", "timestamp": "2026-06-22T10:00:00Z", "type": "COMPLETION", "severity": "INFO", "phase": 1, "msg": "Research-Report fertig. 8 Quellen, 3 Technologie-Optionen analysiert."}
{"from": "builder-1", "to": "chef", "timestamp": "2026-06-22T14:30:00Z", "type": "BLOCKER", "severity": "WARNING", "phase": 5, "msg": "Contract-Lücke: POST /api/users hat keinen Fehlerfall für duplicate email definiert"}
{"from": "reviewer-1", "to": "chef", "timestamp": "2026-06-22T16:00:00Z", "type": "FINDING", "severity": "WARNING", "phase": 7, "msg": "Fehlende Eingabevalidierung in /api/users POST — SQL Injection möglich"}
{"from": "chef", "to": "all", "timestamp": "2026-06-22T14:35:00Z", "type": "STATUS", "severity": "WARNING", "phase": 5, "msg": "Contract v1.1: POST /api/users hat jetzt 409 Conflict bei duplicate email. Alle Builder bitte re-syncen."}
```
