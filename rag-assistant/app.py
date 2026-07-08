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

# --- UI Premium Styling ---
st.markdown(
    """
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600&display=swap');
      html, body, [data-testid="stWidgetLabel"] {
        font-family: 'Outfit', sans-serif;
      }
      .block-container {
        padding-top: 2rem;
        max-width: 780px;
      }
      /* Sidebar Glassmorphism */
      [data-testid="stSidebar"] {
        background-color: rgba(245, 247, 250, 0.9);
        backdrop-filter: blur(10px);
        border-right: 1px solid rgba(0,0,0,0.05);
      }
      #MainMenu {visibility: hidden;}
      footer {visibility: hidden;}
      [data-testid="stToolbar"] {visibility: hidden;}
      [data-testid="stDecoration"] {display: none;}
    </style>
    """,
    unsafe_allow_html=True,
)

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
    
    # Model selector
    st.subheader("Model Settings")
    model_options = {
        "Claude 3.5 Haiku": "claude-3-5-haiku-20241022",
        "Claude 3.5 Sonnet": "claude-3-5-sonnet-20241022",
        "Claude 4.5 Haiku (Standard)": "claude-haiku-4-5-20251001"
    }
    selected_model_label = st.selectbox(
        "LLM Model",
        options=list(model_options.keys()),
        index=2
    )
    st.session_state["selected_model"] = model_options[selected_model_label]
    
    st.divider()
    st.subheader("How the agent thinks")
    st.markdown(
        "1. 🔍 **Search** your documents\n"
        "2. 🧪 **Grade** each hit (relevant?)\n"
        "3. 🔁 **Reformulate & retry** if nothing fits\n"
        "4. ✍️ **Answer** — from the sources only\n"
        "5. ✅ **Self-check** (grounded? on-point?)"
    )
    st.caption("Embeddings: MiniLM (local, free) · Orchestration: LangGraph")


# --- chat history ---
if "history" not in st.session_state:
    st.session_state.history = []

for m in st.session_state.history:
    with st.chat_message(m["role"]):
        st.markdown(m["content"])
        if m["role"] == "assistant":
            docs_m = m.get("docs", [])
            retries_m = m.get("retries", 0)
            final_q_m = m.get("final_q", "")
            
            # Trace expander
            if docs_m or retries_m > 0:
                with st.expander("🧠 How the agent solved it"):
                    if retries_m > 0:
                        st.markdown(f"- 🔁 Reformulated and searched again ({retries_m}×)")
                        st.caption(f"Last query: _{final_q_m}_")
                    if docs_m:
                        st.markdown(f"- 🧪 {len(docs_m)} relevant passage(s) used")
                        st.markdown("- ✅ Answer verified by self-check")
                    else:
                        st.markdown("- 🛑 No relevant passages found")
            
            # Sources expander
            if docs_m:
                with st.expander(f"📄 Show {len(docs_m)} passage(s) used"):
                    for idx, doc in enumerate(docs_m, 1):
                        src_title = doc.get("title", "Document")
                        src_url = doc.get("url", "")
                        if src_url:
                            st.markdown(f"**[{idx}] [{src_title}]({src_url})**")
                        else:
                            st.markdown(f"**[{idx}] {src_title}**")
                        st.markdown(f"_{doc['text'][:400]}..._")
                        st.divider()

# --- user input ---
q = st.chat_input("Ask a question about your documents…")
if q:
    st.session_state.history.append({"role": "user", "content": q})
    st.rerun()

# --- response generation ---
if st.session_state.history and st.session_state.history[-1]["role"] == "user":
    user_q = st.session_state.history[-1]["content"]
    with st.chat_message("assistant"):
        with st.spinner("Agent is searching, grading, self-checking…"):
            try:
                result = agentic_rag.app.invoke({
                    "question": user_q,
                    "documents": [],
                    "generation": "",
                    "retries": 0,
                    "model": st.session_state.get("selected_model", "claude-haiku-4-5-20251001")
                })
                st.session_state.history.append({
                    "role": "assistant",
                    "content": result["generation"],
                    "docs": result["documents"],
                    "retries": result["retries"],
                    "final_q": result["question"]
                })
            except Exception as e:
                st.error(f"Error: {e}")
            st.rerun()
