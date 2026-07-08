"""
app.py — Streamlit UI for the agentic RAG assistant (Corrective RAG / Self-RAG).

Run:
    streamlit run app.py
(Build the index first: python rag.py --build)
"""
import json
import os

import streamlit as st

import agentic_rag
import rag

st.set_page_config(page_title="Agentic RAG — Ask Your Data", page_icon="🧠", layout="centered")

st.title("🧠 Agentic RAG")
st.caption(
    "A **self-correcting** assistant: it searches your documents, **judges its own results**, "
    "**reformulates** the question when nothing fits, answers **only from the sources**, and "
    "**checks its own answer** — no hallucination. Built with LangGraph + Claude."
)

# --- sidebar ---
with st.sidebar:
    st.header("Status")
    if os.path.exists(rag.META_PATH):
        n = len(json.load(open(rag.META_PATH, encoding="utf-8")))
        st.success(f"Index ready · {n} passages")
    else:
        st.error("No index yet — run `python rag.py --build`")
    st.divider()
    st.subheader("How the agent thinks")
    st.markdown(
        "1. 🔍 **Search** your documents\n"
        "2. 🧪 **Grade** each hit (relevant?)\n"
        "3. 🔁 **Reformulate & retry** if nothing fits\n"
        "4. ✍️ **Answer** — from the sources only\n"
        "5. ✅ **Self-check** (grounded? on-point?)"
    )
    st.caption("Embeddings: MiniLM (local, free) · LLM: Claude Haiku · Orchestration: LangGraph")


# --- chat history ---
if "history" not in st.session_state:
    st.session_state.history = []
for m in st.session_state.history:
    st.chat_message(m["role"]).markdown(m["content"])

q = st.chat_input("Ask a question about your documents…")
if q:
    st.session_state.history.append({"role": "user", "content": q})
    st.chat_message("user").markdown(q)
    with st.chat_message("assistant"):
        with st.spinner("Agent is searching, grading, self-checking…"):
            try:
                result = agentic_rag.app.invoke(
                    {"question": q, "documents": [], "generation": "", "retries": 0}
                )
            except Exception as e:
                st.error(f"Error: {e}")
                st.stop()

        answer = result["generation"]
        docs = result["documents"]
        retries = result["retries"]
        final_q = result["question"]

        st.markdown(answer)

        # --- agent trace (what makes this "agentic" visible) ---
        if retries > 0:
            st.info(f"🔁 The agent found nothing relevant at first and **reformulated {retries}×**.")
            if final_q != q:
                st.caption(f"Reformulated to: _{final_q}_")
        if docs:
            with st.expander(f"📄 Show {len(docs)} passage(s) used"):
                for i, d in enumerate(docs, 1):
                    st.markdown(f"**[{i}]** {d[:300]}…")
        else:
            st.caption("No relevant passage found → honest “I don't know” instead of a hallucination.")

        st.session_state.history.append({"role": "assistant", "content": answer})
