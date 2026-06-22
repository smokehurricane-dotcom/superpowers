# Dev-Team Skill — Design Specification

**Date:** 2026-06-22
**Status:** Approved
**Author:** Chef-Orchestrator + Auftraggeber (Petra)

---

## Übersicht

Ein wiederverwendbarer Superpowers-Skill namens `dev-team`, der ein 12-köpfiges virtuelles Software-Entwicklungsteam orchestriert. Das Team arbeitet in 9 klar definierten Phasen mit strikter Hierarchie, Kreuz-Reviews, und einem persistenten Lern-System.

## Ziel

Eigenständige Entwicklung vollfunktionsfähiger Software durch ein spezialisiertes Agenten-Team, bei dem:
- Ein Chef alle Arbeit überwacht und genehmigt
- Brainstorming und Using-Superpowers immer genutzt werden
- Informationen umfassend gesammelt und faktengeprüft werden
- Code parallel entwickelt, kreuz-reviewed und integrationsgetestet wird
- Alle Agenten aus Fehlern lernen

---

## Team-Zusammensetzung

### Rollen-Übersicht

| # | Rolle | Agent-Typ | Modell-Empfehlung | Zugriff |
|---|-------|-----------|-------------------|---------|
| 🎩 | **Chef** (Manager) | custom (`coordinator`) | Most capable | Lesen + Schreiben + Subagents |
| #1 | **Informationsbeschaffer** (Researcher) | research | Standard | Nur Lesen + Web |
| #2 | **Fakten-Prüfer** (Fact-Checker) | research | Standard | Nur Lesen + Web |
| #3 | **Planer** (Architect) | custom (`planner`) | Most capable | Lesen + Schreiben (nur Docs) |
| #4 | **Technischer Entwickler** (Backend Builder) | self | Most capable | Lesen + Schreiben + Commands |
| #5 | **Visueller Entwickler** (Frontend Builder) | self | Most capable | Lesen + Schreiben + Commands |
| #6 | **Datenbank-Architekt** (DB Architect) | self | Most capable | Lesen + Schreiben + Commands |
| #7 | **QA/Test-Schreiber** (QA Tester) | self | Standard | Lesen + Schreiben + Commands |
| #8 | **Security-Spezialist** (Security) | research | Standard | Nur Lesen |
| #9 | **Code-Reviewer A** | custom (`reviewer`) | Standard | Lesen + Schreiben (nur Code-Fixes) |
| #10 | **Code-Reviewer B** | custom (`reviewer`) | Standard | Lesen + Schreiben (nur Code-Fixes) |
| #11 | **Integrations-Tester** | self | Standard | Lesen + Schreiben + Commands |

### Rollen-Details

#### 🎩 Chef (Manager/Genehmiger)
- **Verantwortung:** Überwacht den gesamten Workflow, genehmigt jede Phase, kommuniziert mit dem Auftraggeber
- **Besonderheiten:**
  - Einziger Agent mit direktem Kontakt zum Auftraggeber
  - Liest alle Messages und Taskboard-Updates
  - Genehmigt Phasenübergänge
  - Aktualisiert Lessons-Learned und Agent-Prompts nach Projektabschluss
  - Nutzt immer brainstorming und using-superpowers Skills
  - **Ideen-Kurator:** Bewertet vom Researcher gesammelte Software-Ideen, filtert die vielversprechendsten heraus und präsentiert sie dem Auftraggeber als Vorschläge für zukünftige Projekte
- **Scope:** Keine eigene Code-Arbeit, nur Koordination und Genehmigung

#### #1 Informationsbeschaffer (Researcher + Ideen-Scout)
- **Verantwortung:** Umfassende Recherche zum Projekt-Thema + Sammlung neuer Software-Ideen
- **Output:**
  - `.superpowers/team/research-report.md` — detaillierter Bericht mit allen gesammelten Infos
  - `.superpowers/team/idea-pipeline.md` — gesammelte Software-Ideen für zukünftige Projekte
- **Anforderungen Recherche:**
  - Möglichst umfangreich recherchieren
  - Quellen dokumentieren
  - Technologie-Optionen auflisten
  - Best Practices zusammenfassen
  - Alles für alle zugänglich notieren
- **Anforderungen Ideen-Scout:**
  - Neue lukrative, sinnvolle Software-Ideen sammeln (Marktlücken, Trends, Nutzerprobleme)
  - Für jede Idee bewerten: Marktpotenzial, technische Machbarkeit, Wettbewerb, Monetarisierung
  - Ideen nach Potenzial-Score sortieren (🔥 Hit / ⭐ Vielversprechend / 💡 Interessant)
  - Nur Ideen mit echtem Hit-Potenzial als 🔥 markieren

#### #2 Fakten-Prüfer (Fact-Checker)
- **Verantwortung:** Verifizierung aller gesammelten Informationen + Ideen-Validierung
- **Prozess Recherche:**
  1. Research-Report von #1 lesen
  2. Jede Behauptung auf Fakten prüfen
  3. Halluzinationen identifizieren und markieren
  4. Bei Unsicherheit: mehrfach prüfen (verschiedene Quellen)
  5. Aufgeräumten, faktengeprüften Report erstellen
- **Prozess Ideen-Validierung:**
  1. Ideen-Pipeline von #1 lesen
  2. Marktbehauptungen prüfen (gibt es echte Nachfrage?)
  3. Wettbewerbs-Check (existiert das schon? wie erfolgreich?)
  4. Technische Machbarkeit einschätzen
  5. Hit-Potenzial realistisch bewerten — übertriebene Bewertungen korrigieren
  6. Validierte Ideen-Liste erstellen mit Fakten-Status
- **Output:**
  - `.superpowers/team/verified-research.md`
  - `.superpowers/team/verified-ideas.md` — faktengeprüfte Ideen-Liste
- **Anforderungen:** Lieber zu vorsichtig als zu locker, im Zweifel als "unbestätigt" markieren

#### #3 Planer (Architect)
- **Verantwortung:** Architektur und Aufgabenverteilung planen
- **Input:** Verifizierter Research-Report
- **Prozess:**
  1. Aus verifizierten Infos die Architektur ableiten
  2. Mit Chef: Rollen für #4 und #5 definieren
  3. Mit Chef + Auftraggeber: Technologie-Stack abstimmen
  4. Aufgaben für #4, #5, #6 definieren
  5. DB-Schema-Anforderungen für #6 definieren
- **Output:** `.superpowers/team/architecture-plan.md`
- **Interaktion:** Chef leitet Fragen an Auftraggeber weiter bezüglich:
  - Verwendete Sprachen/Frameworks
  - Genaues Coding-Vorgehen
  - Weitere Ideen/Anforderungen

#### #4 Technischer Entwickler (Backend Builder)
- **Verantwortung:** Backend-Code, Logik, APIs, Datenverarbeitung
- **Scope:** Nur technischer/funktionaler Code, kein UI
- **Kommunikation:**
  - Meldet Unklarheiten an Chef via messages.jsonl
  - Chef entscheidet ob Auftraggeber informiert wird
  - Liest DB-Schema von #6 als Grundlage
- **Constraints:** Arbeitet nur in zugewiesenen Dateien/Verzeichnissen

#### #5 Visueller Entwickler (Frontend Builder)
- **Verantwortung:** UI/UX, Frontend-Code, visuelle Gestaltung
- **Scope:** Nur visueller/interaktiver Teil
- **Parallel zu:** #4 (gleichzeitig, verschiedene Dateien)
- **Liest:** DB-Schema von #6, API-Definitionen von #4 (via messages)

#### #6 Datenbank-Architekt
- **Verantwortung:** Datenbankschema, Migrationen, Query-Optimierung
- **Timing:** Arbeitet VOR #4 und #5
- **Output:** Schema-Definition, Migrations-Dateien, Datenbank-Setup
- **Chef-Genehmigung:** Schema muss vom Chef genehmigt werden bevor Entwickler starten

#### #7 QA/Test-Schreiber
- **Verantwortung:** Automatisierte Tests (Unit, Integration)
- **Timing:** Nach Entwicklung (#4, #5), vor Code-Review
- **Scope:** Nur Test-Dateien schreiben, keinen Production-Code ändern
- **Output:** Test-Suite mit Pass/Fail-Report

#### #8 Security-Spezialist
- **Verantwortung:** Sicherheitsanalyse des gesamten Codes
- **Parallel zu:** #7 (gleichzeitig)
- **Prüft:**
  - Eingabevalidierung
  - SQL Injection
  - XSS/CSRF
  - Authentifizierung/Autorisierung
  - Dependency-Sicherheit
  - Geheimnisse im Code
- **Output:** `.superpowers/team/security-report.md`
- **Read-only:** Ändert keinen Code, nur Bericht

#### #9 Code-Reviewer A
- **Verantwortung:**
  - Runde 1: Prüft Backend-Code (#4) → verbessert
  - Runde 2: Prüft #10s Verbesserungen am Frontend
- **Darf:** Code-Fixes durchführen basierend auf Findings

#### #10 Code-Reviewer B
- **Verantwortung:**
  - Runde 1: Prüft Frontend-Code (#5) → verbessert
  - Runde 2: Prüft #9s Verbesserungen am Backend
- **Darf:** Code-Fixes durchführen basierend auf Findings

#### #11 Integrations-Tester
- **Verantwortung:** End-to-End-Test des Gesamtsystems
- **Timing:** Nach allen Reviews abgeschlossen
- **Prüft:** Zusammenspiel aller Komponenten als Ganzes
- **Output:** `.superpowers/team/integration-report.md`

---

## Phasen-Workflow

### Phase 1: Informationsbeschaffung
```
Trigger: Neues Projekt vom Auftraggeber
Agent: #1 Researcher
Status: Chef überwacht

#1 → Recherchiert umfassend
#1 → Schreibt research-report.md
#1 → Meldet Fertigstellung via messages.jsonl
Chef → Prüft Vollständigkeit, gibt Phase 2 frei
```

### Phase 2: Fakten-Check
```
Voraussetzung: Phase 1 abgeschlossen, Chef genehmigt
Agent: #2 Fact-Checker

#2 → Liest research-report.md
#2 → Prüft jede Behauptung (mehrfach bei Unsicherheit)
#2 → Entfernt/markiert Halluzinationen
#2 → Schreibt verified-research.md
Chef → Prüft, gibt Phase 3 frei
```

### Phase 3: Planung (Interaktiv)
```
Voraussetzung: Phase 2 abgeschlossen, Chef genehmigt
Agenten: #3 Planer + Chef + Auftraggeber

#3 → Liest verified-research.md
#3 → Entwirft Architektur und Aufgabenverteilung
#3 + Chef → Stimmen Rollen für #4, #5, #6 ab
Chef → Leitet Fragen an Auftraggeber weiter:
  - Technologie-Stack
  - Coding-Vorgehen
  - Weitere Ideen
Chef → Genehmigt finalen Plan
#3 → Schreibt architecture-plan.md
```

### Phase 4: Datenbank-Design
```
Voraussetzung: Phase 3 abgeschlossen, Chef genehmigt
Agent: #6 DB-Architekt

#6 → Liest architecture-plan.md
#6 → Entwirft Schema, Migrationen, Queries
#6 → Schreibt Schema-Dateien
Chef → Prüft und genehmigt Schema
     → Erst nach Genehmigung: Phase 5 freigeben
```

### Phase 5: Entwicklung (Parallel)
```
Voraussetzung: Phase 4 abgeschlossen, Chef genehmigt DB-Schema
Agenten: #4 Tech-Dev + #5 Visual-Dev (PARALLEL)

#4 → Entwickelt Backend/Logik (liest Schema von #6)
#5 → Entwickelt Frontend/UI (liest Schema von #6, API-Defs von #4)

Während Entwicklung:
  - #4/#5 melden Unklarheiten → messages.jsonl → Chef
  - Chef entscheidet: selbst klären oder Auftraggeber fragen
  - Chef leitet Antworten zurück

#4 + #5 → Melden Fertigstellung
Chef → Prüft, gibt Phase 6 frei
```

### Phase 6: QA + Security (Parallel)
```
Voraussetzung: Phase 5 abgeschlossen, Chef genehmigt
Agenten: #7 QA-Tester + #8 Security-Spezialist (PARALLEL)

#7 → Schreibt Tests (Unit, Integration), führt sie aus
#8 → Analysiert Code auf Sicherheitslücken

#7 → test-report.md
#8 → security-report.md

Chef → Prüft beide Reports
     → Bei kritischen Findings: zurück an Entwickler
     → Sonst: Phase 7 freigeben
```

### Phase 7: Code-Review (Kreuz-Review)
```
Voraussetzung: Phase 6 abgeschlossen, Chef genehmigt
Agenten: #9 Reviewer A + #10 Reviewer B

--- Runde 1 (PARALLEL) ---
#9 → Prüft Backend (#4) → verbessert Code
#10 → Prüft Frontend (#5) → verbessert Code

--- Runde 2 (PARALLEL, nach Runde 1) ---
#9 → Prüft #10s Frontend-Verbesserungen
#10 → Prüft #9s Backend-Verbesserungen

Beide → Melden Findings via messages.jsonl
Chef → Prüft alle Änderungen, gibt Phase 8 frei
```

### Phase 8: Integrations-Test
```
Voraussetzung: Phase 7 abgeschlossen, Chef genehmigt
Agent: #11 Integrations-Tester

#11 → Testet Gesamtsystem End-to-End
#11 → Prüft Zusammenspiel aller Komponenten
#11 → integration-report.md

Chef → Prüft Report
     → Bei Problemen: zurück an zuständigen Agent
     → Sonst: Phase 9 freigeben
```

### Phase 9: Abnahme + Wissenstransfer (Interaktiv)
```
Voraussetzung: Phase 8 abgeschlossen
Agenten: Chef + Auftraggeber

Chef → Präsentiert fertigen Code dem Auftraggeber
Chef → Bespricht Ergebnisse, offene Punkte
Auftraggeber → Genehmigt oder fordert Änderungen

Nach Genehmigung:
Chef → Aktualisiert lessons-learned.md
Chef → Aktualisiert Agent-Prompt-Templates mit neuen Regeln
Chef → Informiert alle Agenten über gefundene Fehler und Lösungen
```

### Phase 10: Ideen-Präsentation (Optional, nach Projektabschluss)
```
Voraussetzung: Phase 9 abgeschlossen
Agenten: Chef + Auftraggeber

Chef → Liest verified-ideas.md (faktengeprüfte Ideen von #1 + #2)
Chef → Filtert die Top-Ideen (🔥 Hits) heraus
Chef → Präsentiert dem Auftraggeber:
  - Ideen-Name und Kurzbeschreibung
  - Warum es ein Hit sein könnte (Marktlücke, Trend, Nachfrage)
  - Geschätzter Aufwand und Komplexität
  - Monetarisierungs-Möglichkeiten
  - Wettbewerbslage

Auftraggeber → Wählt Ideen für zukünftige Projekte aus
Chef → Speichert ausgewählte Ideen in project-backlog.md
```

---

## Kommunikations-System

### Hierarchie (Streng)

```
Auftraggeber (Du)
      ↕ (einziger direkter Kanal)
   🎩 Chef
      ↕ (alle Agenten)
#1 #2 #3 #4 #5 #6 #7 #8 #9 #10 #11
```

### Regeln
1. **Nur der Chef** kommuniziert mit dem Auftraggeber
2. Agenten melden alles an den Chef via `messages.jsonl`
3. Chef entscheidet, was an den Auftraggeber weitergeleitet wird
4. Auftraggeber-Antworten werden vom Chef an relevante Agenten verteilt
5. Agenten können untereinander via `messages.jsonl` kommunizieren
6. Chef liest ALLE Messages

### Datei-basierte Kommunikation

```
.superpowers/team/
├── taskboard.md        # Status aller Tasks (Single Source of Truth)
├── messages.jsonl      # Inter-Agent-Kommunikation
├── research-report.md  # Output von #1 (Recherche)
├── idea-pipeline.md    # Output von #1 (Software-Ideen)
├── verified-research.md # Output von #2 (geprüfte Recherche)
├── verified-ideas.md   # Output von #2 (geprüfte Ideen)
├── architecture-plan.md # Output von #3
├── security-report.md  # Output von #8
├── test-report.md      # Output von #7
├── integration-report.md # Output von #11
├── lessons-learned.md  # Persistentes Wissen
└── project-backlog.md  # Ausgewählte Ideen für zukünftige Projekte
```

---

## Lern-System

### 1. Lessons-Learned-Datei
Pfad: `.superpowers/team/lessons-learned.md`

```markdown
# Lessons Learned

## Projekt: {Name}
## Datum: {Datum}

### Fehler gefunden
| # | Phase | Agent | Fehler | Lösung | Schwere |
|---|-------|-------|--------|--------|---------|
| 1 | Review | #9 | Fehlende Eingabevalidierung | Input-Sanitizing hinzugefügt | Hoch |

### Neue Regeln
- Immer Eingabevalidierung vor DB-Queries
- CSS-Variablen statt hardcoded Farben

### Best Practices bestätigt
- TDD hat 3 Bugs verhindert
- Kreuz-Review hat Inkonsistenzen gefunden
```

### 2. Agent-Prompt-Updates
Nach jedem Projekt aktualisiert der Chef die Prompt-Templates:
- Neue Regeln aus Lessons-Learned werden eingebaut
- Wiederkehrende Fehler werden als explizite Warnungen hinzugefügt
- Erfolgreiche Patterns werden als Best Practices verankert

### 3. Wissenstransfer
- Alle Agenten lesen beim Start die `lessons-learned.md`
- Gefundene Fehler werden in Messages an alle geteilt
- Chef erstellt Zusammenfassung für den Auftraggeber

---

## Skill-Integration

### Pflicht-Skills
- **brainstorming** — wird immer vor kreativer Arbeit aktiviert
- **using-superpowers** — wird immer beachtet, Skills werden geprüft

### Empfohlene Skills
- **test-driven-development** — für #4, #5 (Red-Green-Refactor)
- **systematic-debugging** — bei Fehlersuche
- **verification-before-completion** — bevor Code als fertig deklariert wird

---

## Datei-Struktur des Skills

```
skills/dev-team/
├── SKILL.md                    # Haupt-Skill: Workflow, Checklist, Phasen
├── roles.md                    # Alle 12 Rollen mit Details
├── taskboard-template.md       # Vorgefertigtes 9-Phasen-Taskboard
├── lessons-learned-template.md # Vorlage für Wissens-Datenbank
└── prompts/                    # Individuelle Agent-Prompt-Templates
    ├── chef.md                 # Chef/Manager Prompt
    ├── researcher.md           # #1 Informationsbeschaffer
    ├── fact-checker.md         # #2 Fakten-Prüfer
    ├── planner.md              # #3 Planer
    ├── tech-developer.md       # #4 Technischer Entwickler
    ├── visual-developer.md     # #5 Visueller Entwickler
    ├── db-architect.md         # #6 Datenbank-Architekt
    ├── qa-tester.md            # #7 QA/Test-Schreiber
    ├── security-specialist.md  # #8 Security-Spezialist
    ├── code-reviewer-a.md      # #9 Code-Reviewer A
    ├── code-reviewer-b.md      # #10 Code-Reviewer B
    └── integration-tester.md   # #11 Integrations-Tester
```

---

## Anti-Patterns

| ❌ Nicht tun | ✅ Stattdessen |
|-------------|---------------|
| Agenten direkt mit Auftraggeber reden lassen | Alles über den Chef leiten |
| Entwickler ohne fertiges DB-Schema starten | Phase 4 abwarten |
| Kreuz-Review überspringen | Immer beide Runden durchlaufen |
| Lessons-Learned nicht aktualisieren | Nach jedem Projekt pflichtmäßig updaten |
| Zwei Agenten dieselbe Datei bearbeiten | Klare Scope-Trennung (Backend vs. Frontend) |
| Fakten-Check überspringen | Immer Phase 2 durchlaufen, mehrfach prüfen |
| Security-Report ignorieren | Kritische Findings blockieren Weiterarbeit |
