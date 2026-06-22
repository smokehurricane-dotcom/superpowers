# Agent Teams — Prompt-Bibliothek

> Feature aktiviert via `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` in ~/.claude/settings.json

---

## Schnellstart

### 1. Einfaches 2-Agenten-Team
```
Create a team of 2 agents:
- Agent A: List all files in this directory
- Agent B: Count how many are Python files

Have them share their findings.
```

### 2. Builder + Validator (empfohlenes Grundmuster)
```
Create a team:
- Builder (Sonnet): Add a hello_world() function to utils.py
- Validator (Haiku): Test the function and verify it works
```

### 3. Parallele Doku-Updates
```
Build a team of 3 agents to update documentation:
- Agent 1: Update the Installation section
- Agent 2: Update the Usage section
- Agent 3: Update the API Reference section

Each agent should work on README.md independently.
```

---

## Mittlere Komplexität

### 4. Code Review + Fix Pipeline
```
Create an agent team for code review:
- Agent A (Reviewer): Scan all Python files and identify bugs, security issues,
  and style problems. Prioritize by severity (critical, medium, low).
- Agent B (Fixer): As Agent A finds issues, fix them immediately.
  Communicate back when each fix is complete.

Use real-time messaging between agents. Start with critical issues first.
```
*Kosten: ~$0.50 | Zeit: 5-8 Min*

### 5. Multi-Perspektiv-Debugging
```
I'm getting an error: [FEHLER HIER EINFÜGEN]

Create a team of 4 agents to debug from different perspectives:
- Frontend Agent: Check React/UI code
- Backend Agent: Analyze API endpoints
- Database Agent: Review queries and data flow
- Network Agent: Inspect requests/responses

Have all agents share findings and converge on root cause.
```
*Kosten: ~$3.60 | Zeit: 3-5 Min*

### 6. Feature-Implementation mit Abhängigkeiten
```
Build a team to implement a new "user profile" feature:
- Research Agent: Find best practices for user profiles
- Setup Agent: Create necessary files and structure (blocked until research done)
- Frontend Builder: Create profile UI component
- Backend Builder: Create profile API endpoints
- Validator: Test all components work together
- Docs Agent: Document the new feature

Use Opus for research and validation, Sonnet for builders.
```
*Kosten: ~$15 | Zeit: 10-15 Min*

---

## Fortgeschritten

### 7. Vollständige App bauen
```
Create a task management web app from scratch:

Team structure:
- 2 Research Agents (UI patterns, tech stack)
- 1 Setup Agent (project structure, dependencies) - BLOCKED by research
- 3 Frontend Builders (dashboard, task list, settings pages)
- 2 Backend Builders (auth endpoints, CRUD endpoints)
- 1 Testing Agent (unit tests for all endpoints)
- 1 Documentation Agent (README, API docs)

Requirements:
- Use React for frontend, Express for backend
- Include user authentication
- All agents should communicate progress
- Frontend agents coordinate on shared components

Use Opus for research and setup, Sonnet for builders, Haiku for testing.
```
*Kosten: ~$150-200k tokens | Zeit: 15-25 Min*

### 8. Codebase-Modernisierung
```
Modernize this legacy codebase:

Create a team of 8 agents:
- 1 Analysis Agent: Identify all outdated patterns and dependencies
- 6 Modernization Agents: Each updates one module/directory
- 1 Integration Agent: Ensure all updates work together

For each module:
1. Update dependencies to latest versions
2. Refactor to modern patterns
3. Add type hints / update tests / update docs

Agents should communicate about shared dependencies.
```
*Zeit: 20-30 Min*

### 9. Parallele Multi-Codebase-Analyse
```
I have 8 different projects in subdirectories.

Create a team of 8 agents (one per project):
- Each agent analyzes their assigned codebase
- Identify: tech stack, architecture, dependencies, potential issues
- Summarize how to set up and run the project
- Share findings with coordinator agent

Then have a coordinator agent compile all findings into a comparison report.

Use Haiku for analysis (cost-effective), Sonnet for coordinator.
```
*Kosten: ~$1.50 | Zeit: 5-10 Min*

---

## Spezialfälle

### Paralleles Code-Review (verschiedene Perspektiven)
```
Spawn three teammates to review PR #[NUMMER]:
- One focused on security implications
- One checking performance impact
- One validating test coverage
Have them each review and report findings.
```

### Hypothesen-basiertes Debugging (wissenschaftlicher Ansatz)
```
Users report: [PROBLEM BESCHREIBEN]

Spawn 5 agent teammates to investigate different hypotheses.
Have them talk to each other to try to disprove each other's theories,
like a scientific debate. Update the findings doc with whatever consensus emerges.
```

### API-Integration
```
Integrate [SERVICE] [z.B. Stripe payment processing]:

Team:
- Research Agent: Read docs and identify best practices
- Backend Builder: Implement webhook handlers
- Frontend Builder: Create UI components
- Security Validator: Review for security issues
- Testing Agent: Create test cases with test mode
- Docs Agent: Document the integration
```

### Performance-Optimierung
```
Optimize application performance:

Team:
- Profiler Agent: Identify performance bottlenecks
- Database Agent: Optimize queries and add indexes
- Frontend Agent: Implement code splitting and lazy loading
- Caching Agent: Add Redis caching where appropriate
- Validator Agent: Benchmark before/after performance

Target: 50% improvement in load times.
```

---

## Modell-Auswahl (Kostenoptimierung)

| Aufgabe | Modell | Kosten |
|---------|--------|--------|
| Team Lead, komplexe Entscheidungen | claude-opus-4-8 | $$$ |
| Standard-Implementierung | claude-sonnet-4-6 | $$ |
| Validierung, einfache Checks | claude-haiku-4-5 | $ |

**Faustregel:** Opus für Planung → Sonnet für Umsetzung → Haiku für Überprüfung  
**Einsparung:** ~60% vs. All-Opus-Team

---

## Häufige Fallstricke

| Problem | Lösung |
|---------|--------|
| Zwei Agenten editieren dieselbe Datei | Dateibereiche klar trennen: "Agent A: nur /frontend" |
| Team Lead macht Arbeit selbst statt zu warten | Prompt: "Wait for teammates. Do NOT start working yourself." |
| Tasks zu klein (Overhead > Nutzen) | Tasks bündeln: "Alle Variablen in auth module" statt einzeln |
| Tasks zu groß | In mittelgroße Einheiten aufteilen |
| Keine klare Scope-Definition | Explizit Files, Tasks, No-Go-Zones definieren |

---

## Kosten-Schnellreferenz

| Team-Größe | Kosten (ca.) |
|------------|--------------|
| 2 Agenten | $0.50–2 |
| 4 Agenten | $2–5 |
| 8 Agenten | $15–25 |
| Tägliche Nutzung (intensiv) | $50–100 |
