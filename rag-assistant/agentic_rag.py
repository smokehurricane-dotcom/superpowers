from typing import List, TypedDict
from ddgs import DDGS
import rag  # dein bestehendes rag.py (gleicher Ordner)
from langchain_anthropic import ChatAnthropic
from langgraph.graph import END, START, StateGraph


class GraphState(TypedDict):
    question: str
    documents: List[str]
    generation: str
    retries: int


def retrieve(state: GraphState) -> dict:
    question = state["question"]
    hits = rag.retrieve_hybrid(question, k=5)
    documents = [chunk["text"] for score, chunk in hits]
    return {"documents": documents}


rag.load_env()
llm = ChatAnthropic(model="claude-haiku-4-5-20251001", max_tokens=600)


def generate(state: GraphState) -> dict:
    question = state["question"]
    documents = state["documents"]
    context = "\n\n".join(documents)
    prompt = f"Du bist ein präziser Handbuch-Assistent. Beantworte die Frage NUR anhand des Kontexts (ein technisches Handbuch). Nenne konkrete Schritte, Codes und Ursachen GENAU so, wie sie im Kontext stehen — erfinde KEINE Begriffe und KEINE Schritte, die nicht wörtlich im Kontext vorkommen. Antworte knapp, in der Sprache der Frage. Wenn der Kontext die Antwort nicht enthält, sage in EINEM Satz, dass du dazu keine Information hast.\n\nKontext:\n{context}\n\nFrage: {question}"
    answer = llm.invoke(prompt)
    return {"generation": answer.content}


def grade_documents(state: GraphState) -> dict:
    question = state["question"]
    documents = state["documents"]
    keep = []
    for doc in documents:
        prompt = f"Frage: {question}\n\nText: {doc}\n\nIst dieser Text relevant für die Frage? Antworte nur mit 'ja' oder 'nein'."
        antwort = llm.invoke(prompt)
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
    antwort = llm.invoke(prompt)
    return {"question": antwort.content, "retries": state["retries"] + 1}


def grade_generation(state: GraphState) -> str:
    if len(state["documents"]) == 0 or state["retries"] >= 2:
        return "useful"
    question = state["question"]
    generation = state["generation"]
    context = "\n\n".join(state["documents"])
    prompt = f"Frage: {question}\n\nQuellen:\n{context}\n\nAntwort: {generation}\n\nIst die Antwort durch die Quellen gedeckt UND beantwortet sie die Frage? Antworte nur mit 'ja' oder 'nein'."
    antwort = llm.invoke(prompt)
    if "ja" in antwort.content.lower():
        return "useful"
    return "not useful"

def web_search(state: GraphState) -> dict:
    question = state["question"]
    results = DDGS().text(question, max_results=5)
    documents = [r["body"] for r in results]
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
        {"question": question, "documents": [], "generation": "", "retries": 0}
    )
    return result["generation"]


if __name__ == "__main__":
    start = {
        "question": "What did the US military do?",
        "documents": [],
        "generation": "",
        "retries": 0,
    }
    result = app.invoke(start)
    print(result["generation"])
