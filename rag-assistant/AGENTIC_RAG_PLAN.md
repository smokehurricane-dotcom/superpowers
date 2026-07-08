# Agentic RAG — Bauplan (Coaching-Session: du tippst, ich coache)

## Ziel
Den bestehenden `rag-assistant` (sentence-transformers + numpy-Cosine + Claude) zu einem
**agentic RAG** aufwerten. Muster: **Corrective RAG (CRAG) / Self-RAG**.
Statt linear "retrieve → generate" baust du einen **Graphen**, der prüft, ob die gefundenen
Texte taugen, ggf. die Frage umformuliert und neu sucht, und die Antwort am Ende **selbst checkt**.

## Strategie (wichtig — nichts wegwerfen)
Dein funktionierender Retriever (numpy-Cosine) **bleibt** als normale Python-Funktion.
LangGraph kommt NUR als Orchestrierung obendrauf, `langchain-anthropic` nur für die LLM-Aufrufe.
→ Du lernst LangGraph, ohne das Bestehende zu zerstören.

## Der Graph (die Knoten = deine Funktionen)
1. **retrieve** — ruft deinen bestehenden Retriever (top-k Chunks).
2. **grade_documents** — LLM bewertet jeden Chunk: relevant ja/nein → filtert.
3. **[Kante] decide** — genug relevante Chunks? ja → `generate` / nein → `transform_query`.
4. **transform_query** — Frage umformulieren, dann zurück zu `retrieve`.
5. **generate** — Antwort aus den gefilterten Chunks mit Claude (dein jetziger Schritt).
6. **grade_generation** — Self-Check: ist die Antwort durch die Quellen gedeckt + beantwortet
   sie die Frage? ja → END / nein → (max N retries) zurück zu `generate` bzw. `transform_query`.

## State (fließt durch den Graphen)
```python
from typing import TypedDict, List
class GraphState(TypedDict):
    question: str
    documents: List[str]
    generation: str
    retries: int
```

## Beispiel-Funktionsbauplan: EINE Node (grade_documents)
So sieht jede Node aus — du füllst die TODOs (das ist der Coaching-Teil):
```python
def grade_documents(state: GraphState) -> dict:
    question = state["question"]
    docs = state["documents"]
    keep = []
    for d in docs:
        # TODO: LLM fragen -> "Ist dieser Text relevant fuer die Frage? Antworte nur ja/nein."
        # TODO: Antwort parsen; wenn relevant -> keep.append(d)
        ...
    return {"documents": keep}   # eine Node gibt NUR das geaenderte State-Feld zurueck
```
Lerneffekt dieser Node: strukturierter LLM-Output + wie eine LangGraph-Node den State teil-aktualisiert.

## Vorbereiten / Installieren (vor der Session)
```
pip install langgraph langchain-core langchain-anthropic
```
(numpy-Retriever + sentence-transformers behältst du unverändert.)
LLM-Anbindung in LangGraph:
```python
from langchain_anthropic import ChatAnthropic
llm = ChatAnthropic(model="claude-haiku-4-5-20251001")  # fuers Graden reicht haiku
```
(ANTHROPIC_API_KEY liegt schon in deiner `.env`.)

## Quellen (vorher 10 Min überfliegen — nicht auswendig lernen)
- Build a custom RAG agent (LangGraph, Python): https://docs.langchain.com/oss/python/langgraph/agentic-rag
- Self-Reflective RAG (Blog, Muster-Überblick): https://blog.langchain.com/agentic-rag-with-langgraph/
- Adaptive RAG (Python, Routing + Doc-Grading): https://langchain-ai.github.io/langgraph/tutorials/rag/langgraph_adaptive_rag/
- Self-RAG (Tutorial, Self-Check-Muster): https://langchain-ai.github.io/langgraphjs/tutorials/rag/langgraph_self_rag/
- LangChain Academy — Intro to LangGraph (Gratis-Kurs): https://academy.langchain.com/courses/intro-to-langgraph

## Vor der nächsten Session
- [x] `pip install langgraph langchain-core langchain-anthropic` — **erledigt + verifiziert** (langgraph 1.2.6, langchain-core 1.4.8, langchain-anthropic 1.4.6; Key gesetzt, Index gebaut).
- [ ] Den "Build a custom RAG agent"-Guide kurz überfliegen (nur Gefühl fürs Muster).
- [ ] `rag.py` offen haben — wir wrappen die bestehende `retrieve()` daraus.

---

## Bau in 6 unterbrechbaren Schritten
Jeder Schritt endet **lauffähig + getestet** → du kannst nach jedem ✅ aufhören und später weitermachen.
Du tippst, ich coache. (Code steht NICHT hier vorgeschrieben — nur Ziel + Test.)

### Schritt 1 — Grundgerüst + erster lauffähiger Graph (`retrieve → generate`)  ✅ ERLEDIGT 19.06. (Daniel selbst getippt + via `python agentic_rag.py` gestartet; echte grounded Claude-Antwort)
- **Ziel:** deine bestehende RAG-Logik als minimalen LangGraph nachbauen — sofort lauffähig.
- **Du baust:** `agentic_rag.py`; `GraphState` (TypedDict); Node `retrieve` (ruft `rag.retrieve()`, Texte in `documents`); Node `generate` (Kontext bauen, Claude via `ChatAnthropic` → `generation`); `StateGraph`: START → retrieve → generate → END; `app = graph.compile()`.
- **✅ Stopp-Test:** `app.invoke({"question":"...","retries":0})` gibt eine Antwort. Läuft wie dein jetziges RAG, nur als Graph. *Sauberster Stopp-Punkt — hier hast du LangGraph-Grundlagen drin.*

### Schritt 2 — Dokumente bewerten (`grade_documents`)  ✅ ERLEDIGT 19.06. (Filter getestet: off-topic→0, on-topic→2 von 5)
- **Ziel:** der Agent prüft, ob die Treffer überhaupt zur Frage passen.
- **Du baust:** Node `grade_documents` (pro Doc: LLM "relevant ja/nein", behalte nur ja → `documents`). Einhängen: retrieve → grade_documents → generate.
- **✅ Stopp-Test:** Frage MIT Antwort im Korpus vs. Frage OHNE → beim zweiten werden Docs rausgefiltert (weniger/keine).

### Schritt 3 — Entscheidung: antworten oder nachbessern? (Conditional Edge)  ✅ ERLEDIGT 19.06. (`decide_to_generate`; off-topic→transform_query→END, on-topic→generate; transform_query zeigt noch auf END)
- **Ziel:** wenn nach dem Filtern zu wenig Gutes übrig ist, NICHT blind antworten.
- **Du baust:** Funktion `decide_to_generate(state)` → `"generate"` oder `"transform_query"` (je nach `documents`-Menge); via `add_conditional_edges` nach grade_documents. (transform_query gibt's noch nicht → vorerst Platzhalter/auf END.)
- **✅ Stopp-Test:** bei der "nicht im Korpus"-Frage landest du sichtbar (print) im anderen Zweig.

### Schritt 4 — Frage umformulieren + neu suchen (`transform_query`)  ✅ ERLEDIGT 19.06. (Schleife + Retry-Bremse, off-topic retries=2)
- **Ziel:** statt aufzugeben die Frage anders stellen und erneut suchen.
- **Du baust:** Node `transform_query` (LLM formuliert `question` um, `retries += 1`); Kante transform_query → retrieve (**die Schleife!**).
- **✅ Stopp-Test:** vage Frage → im Log siehst du Umformulierung + neue Suche. (Schleifen-Limit folgt sauber in Schritt 5.)

### Schritt 5 — Antwort selbst prüfen (`grade_generation`, Self-RAG) + Schleifen-Limit  ✅ ERLEDIGT 19.06. (Self-Check nach generate, useful=END / not useful=zurück)
- **Ziel:** nach dem Antworten checken: durch Quellen gedeckt + beantwortet die Frage? sonst nochmal — aber begrenzt.
- **Du baust:** `grade_generation(state)` → `"useful"` (→END) / `"not_grounded"` (→generate) / `"not_useful"` (→transform_query); Conditional Edge nach generate; **`retries`-Obergrenze** (z.B. max 2) → sonst END mit ehrlichem "weiß ich nicht".
- **✅ Stopp-Test:** voller agentic Durchlauf: gute Frage → direkte Antwort; schlechte → Schleife greift, endet sauber statt endlos.

### Schritt 6 — Anschluss + Politur + Dashboard  ✅ ERLEDIGT 19.06. (ask()-Einstieg, Prompt geglättet, app.py auf agentic + aufgehübscht, Loop-Trace sichtbar)
- **Ziel:** nutzbar machen + vorzeigbar.
- **6a (Logik-Politur):** kleine `ask(question)`-Funktion als sauberer Einstieg; **`generate`-Prompt glätten** (knappe, saubere Absage „Dazu habe ich keine Information" statt geschwätzig); aufräumen (Ruff).
- **6b (Dashboard aufhübschen):** Streamlit-UI `app.py` auf den **agentic Graph** umstellen (statt altes lineares RAG) + **aufhübschen** — Antwort + zitierte Quellen + ggf. Anzeige „🔁 Agent hat X× nachgesucht". → **demo-fähiges Portfolio-Stück** (CRAG-Eigenprojekt mit schicker UI).
- **✅ Stopp-Test:** `python agentic_rag.py --ask "..."` läuft end-to-end UND `streamlit run app.py` zeigt den agentic Loop hübsch. **Fertig = aufgewertetes Flaggschiff + Demo.**

> Faustregel wie beim Shadow-Resume: **nie mitten in einem Schritt aufhören** — immer bis zum nächsten ✅-Stopp-Test, dann ist der Stand sauber und du weißt, es läuft.

---

### Schritt 7 (Erweiterung — Daniels Idee 19.06.) — Web-Search-Fallback (= CRAG-Muster)  ✅ ERLEDIGT 19.06. (`web_search`-Knoten via `ddgs`; 3-Wege-Weiche lokal→umformulieren→Web; off-topic zieht jetzt Web-Treffer)
- **Ziel:** wenn der lokale Korpus NICHTS Relevantes hat (0 nach Grading), nicht aufgeben → stattdessen das **Web** durchsuchen und damit antworten. Genau das macht Corrective RAG (CRAG).
- **Du baust:** Node `web_search` (nimmt `question`, ruft eine Web-Suche, packt Treffer in `documents`); Routing erweitern: 0 Docs (ggf. nach 1× `transform_query`) → `web_search` → `generate`. Die Conditional Edge aus Schritt 3 ist die Andock-Stelle.
- **Such-Tool (gratis-freundlich):** DuckDuckGo (`pip install duckduckgo-search`, **kein API-Key, kostenlos**) zum Start; alternativ Tavily (`langchain-tavily`, Free-Tier 1000/Monat, der Agenten-Standard).
- **✅ Stopp-Test:** Schokokuchen-Frage (nicht im News-Korpus) → Agent holt sich Web-Treffer und antwortet *trotzdem* sinnvoll statt leer.
- **Warum stark:** Agent nicht mehr auf den Korpus begrenzt + Top-Verkaufsargument („antwortet aus deinen Dokumenten UND dem Web") + reines CRAG = direkt auf dem LangGraph-Lernpfad. Zahlt doppelt (Skill + Gig-Feature).
- **Reihenfolge:** ERST den Kern-Loop fertig (Schritte 4–6), DANN Schritt 7 draufsetzen — den aktuellen Bau nicht verzetteln.

---

### Schritt 8 (Idee — Daniel 19.06.) — CRAG auf das Polymarket-Research-Korpus setzen  ✅ ERLEDIGT 19.06. (multilinguales Embedding `paraphrase-multilingual-mpnet-base-v2` 768-dim → Recall exzellent: AUC/sl_deep/echter-Edge/Vola alle korrekt & reich beantwortet)
- **Ziel (nach Schritt 7):** den fertigen agentic RAG vom News-Korpus auf **Daniels eigene Trading-Forschung** umstellen → „**frag deine eigene Quant-Forschung**".
- **Korpus:** die `_analyze_*.py`-Befunde, `backtest_result.txt`, Strategie-/Memory-Notizen, daily reports aus `/home/k9l0v3r/polymarket-bot` (read-only kopieren/indexieren).
- **Wert:** Recall-Tool für sein längstes Projekt (nichts mehr neu herleiten) UND **Portfolio-Demo** „agentic RAG über eine reale Quant-Research-Codebase". Zahlt doppelt.
- **Ehrlich:** CRAG *organisiert/erinnert* die Forschung — es *erzeugt keinen Trading-Edge* (der bleibt in numpy, z.B. `_feature_test.py`).
- **Reihenfolge:** nach Schritt 7. Kein Vorziehen.

---

## Production-Polish (optional, nächste Sessions — macht den CRAG „MVP → production-grade")
- **Structured Outputs fürs Grading:** `"ja" in antwort` → `llm.with_structured_output(Grade)` mit Pydantic-Boolean (`class Grade(BaseModel): relevant: bool`). Robuster (kein „Ja, aber nein"-Fehlinterpret), für `grade_documents` + `grade_generation`. = verkaufbarer Skill „zuverlässiges LLM-Grading".
- **Volltext-Scrape statt DDG-Snippets:** `web_search` zieht die `href` jedes Treffers → `trafilatura.extract(trafilatura.fetch_url(url))` → echter Haupttext in die Pipeline (statt fragmentarischer Snippets, die die Schokokuchen-Antwort vage machten). Nur Top-2–3 scrapen, bei Fehler auf Snippet zurückfallen. **`trafilatura`** (leicht, requests-basiert) statt Selenium (nur bei JS-gerenderten Seiten nötig). Error-Handling = Gig-Skill.
