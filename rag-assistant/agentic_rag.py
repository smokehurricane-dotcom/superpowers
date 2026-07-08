from typing import List, TypedDict
from ddgs import DDGS
import rag  # dein bestehendes rag.py (gleicher Ordner)
from langchain_anthropic import ChatAnthropic
from langgraph.graph import END, START, StateGraph


class GraphState(TypedDict):
    question: str
    documents: List[dict]  # Changed from List[str] to List[dict]
    generation: str
    retries: int
    model: str  # Dynamic LLM model key


def retrieve(state: GraphState) -> dict:
    question = state["question"]
    hits = rag.retrieve_hybrid(question, k=5)
    documents = [chunk for score, chunk in hits]  # Keep full chunk dictionary
    return {"documents": documents}


rag.load_env()

def get_llm(state: GraphState):
    model_name = state.get("model") or "claude-haiku-4-5-20251001"
    return ChatAnthropic(model=model_name, max_tokens=600)


def generate(state: GraphState) -> dict:
    question = state["question"]
    documents = state["documents"]
    
    # Build formatted context with citations
    context_parts = []
    for i, doc in enumerate(documents, 1):
        title = doc.get("title", "Unbekannt")
        context_parts.append(f"[{i}] Quelle: {title}\n{doc['text']}")
    context = "\n\n".join(context_parts)
    
    prompt = (
        "Du bist ein präziser Handbuch-Assistent. Beantworte die Frage NUR anhand des Kontexts (ein technisches Handbuch).\n"
        "Nenne konkrete Schritte, Codes und Ursachen GENAU so, wie sie im Kontext stehen.\n"
        "Zitiere die genutzten Quellen im Text am Satzende mit ihren Nummern wie z. B. [1] oder [2].\n"
        "Erfinde KEINE Begriffe und KEINE Schritte, die nicht wörtlich im Kontext vorkommen.\n"
        "Antworte knapp, in der Sprache der Frage.\n"
        "Wenn der Kontext die Antwort nicht enthält, sage in EINEM Satz, dass du dazu keine Information hast.\n\n"
        f"Kontext:\n{context}\n\n"
        f"Frage: {question}"
    )
    model = get_llm(state)
    answer = model.invoke(prompt)
    return {"generation": answer.content}


def grade_documents(state: GraphState) -> dict:
    question = state["question"]
    documents = state["documents"]
    keep = []
    model = get_llm(state)
    for doc in documents:
        text = doc["text"]
        prompt = f"Frage: {question}\n\nText: {text}\n\nIst dieser Text relevant für die Frage? Antworte nur mit 'ja' oder 'nein'."
        antwort = model.invoke(prompt)
        if "ja" in antwort.content.lower():
            keep.append(doc)
    return {"documents": keep}


def decide_to_generate(state: GraphState) -> str:
    if len(state["documents"]) > 0:
        return "generate"
    if state["retries"] < 2:
        return "transform_query"
    return "web_search"


def transform_query(state: GraphState) -> dict:
    question = state["question"]
    prompt = f"Formuliere diese Suchfrage um, damit sie andere/bessere Treffer findet. Gib NUR die neue Frage zurück, ohne Erklärung.\n\nFrage: {question}"
    model = get_llm(state)
    antwort = model.invoke(prompt)
    return {"question": antwort.content, "retries": state["retries"] + 1}


def grade_generation(state: GraphState) -> str:
    if len(state["documents"]) == 0 or state["retries"] >= 2:
        return "useful"
    question = state["question"]
    generation = state["generation"]
    context = "\n\n".join(doc["text"] for doc in state["documents"])
    prompt = f"Frage: {question}\n\nQuellen:\n{context}\n\nAntwort: {generation}\n\nIst die Antwort durch die Quellen gedeckt UND beantwortet sie die Frage? Antworte nur mit 'ja' oder 'nein'."
    model = get_llm(state)
    antwort = model.invoke(prompt)
    if "ja" in antwort.content.lower():
        return "useful"
    return "not useful"


def web_search(state: GraphState) -> dict:
    question = state["question"]
    try:
        results = DDGS().text(question, max_results=5)
        documents = [{
            "text": r["body"],
            "title": r["title"],
            "source": "Web Suche (DuckDuckGo)",
            "url": r["href"]
        } for r in results]
    except Exception as e:
        print(f"Web search error: {e}")
        documents = [{
            "text": f"Die Websuche schlug fehl mit Fehler: {e}",
            "title": "Fehler bei Websuche",
            "source": "System",
            "url": ""
        }]
    return {"documents": documents}


graph = StateGraph(GraphState)
graph.add_node("retrieve", retrieve)
graph.add_node("grade_documents", grade_documents)
graph.add_node("generate", generate)
graph.add_node("transform_query", transform_query)
graph.add_node("web_search", web_search)
graph.add_edge(START, "retrieve")
graph.add_edge("retrieve", "grade_documents")
graph.add_conditional_edges("grade_documents", decide_to_generate, {"generate": "generate", "transform_query": "transform_query", "web_search": "web_search"})
graph.add_edge("transform_query", "retrieve")
graph.add_edge("web_search", "generate")
graph.add_conditional_edges("generate", grade_generation, {"useful": END, "not useful": "transform_query"})
app = graph.compile()


def ask(question: str) -> str:
    result = app.invoke(
        {"question": question, "documents": [], "generation": "", "retries": 0, "model": ""}
    )
    return result["generation"]


if __name__ == "__main__":
    start = {
        "question": "What did the US military do?",
        "documents": [],
        "generation": "",
        "retries": 0,
        "model": ""
    }
    result = app.invoke(start)
    print(result["generation"])
