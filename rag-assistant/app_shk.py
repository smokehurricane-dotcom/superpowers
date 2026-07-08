"""
app_shk.py — Deutscher "Handbuch-Assistent" (SHK-Demo) auf Basis des agentic RAG.

Start:
    streamlit run app_shk.py
(Index vorher bauen: python rag.py --build --corpus shk-corpus)

Das ist die KUNDEN-DEMO-Version (deutsch, dunkel, gebrandet) — getrennt von der
englischen Portfolio-App app.py, damit beide unabhängig bleiben.
"""
import json
import os

import streamlit as st

import agentic_rag
import rag

st.set_page_config(page_title="Handbuch-Assistent", page_icon="📘", layout="centered")

# --- etwas Politur: Premium Styling & Menüs ausblenden ---
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

# Hübsche Namen für die geladenen Handbücher (Dateiname -> Klartext)
PRETTY_SOURCES = {
    "broetje-wgb-m-evo.pdf": "Brötje WGB-M EVO — Betriebsanleitung",
    "vaillant-ecotec-plus.pdf": "Vaillant ecoTEC plus — Betriebsanleitung",
}


def pretty_source(name: str) -> str:
    if name in PRETTY_SOURCES:
        return PRETTY_SOURCES[name]
    return name.replace(".pdf", "").replace("-", " ").replace("_", " ").title()


st.title("📘 Handbuch-Assistent")
st.caption(
    "Stellen Sie eine Frage — die Antwort kommt **direkt aus Ihren Handbüchern**, "
    "wörtlich und mit Quelle. Findet der Assistent nichts, sagt er das ehrlich "
    "(keine erfundenen Angaben)."
)

# --- Seitenleiste ---
with st.sidebar:
    st.header("Status")
    if os.path.exists(rag.META_PATH):
        chunks = json.load(open(rag.META_PATH, encoding="utf-8"))
        n = len(chunks)
        st.success(f"Handbücher geladen · {n} Abschnitte")
        sources = sorted({c.get("title", "") for c in chunks if c.get("title")})
        if sources:
            st.caption("Geladene Handbücher:")
            for s in sources:
                st.markdown(f"• {pretty_source(s)}")
    else:
        st.error("Kein Index — bitte `python rag.py --build --corpus shk-corpus` ausführen")
    
    st.divider()

    # Modell-Auswahl
    st.subheader("Modell-Einstellungen")
    model_options = {
        "Claude 3.5 Haiku": "claude-3-5-haiku-20241022",
        "Claude 3.5 Sonnet": "claude-3-5-sonnet-20241022",
        "Claude 4.5 Haiku (Standard)": "claude-haiku-4-5-20251001"
    }
    selected_model_label = st.selectbox(
        "LLM Modell",
        options=list(model_options.keys()),
        index=2
    )
    st.session_state["selected_model"] = model_options[selected_model_label]

    st.divider()
    st.subheader("So arbeitet der Assistent")
    st.markdown(
        "1. 🔍 **Durchsucht** Ihre Handbücher\n"
        "2. 🧪 **Prüft** jede Fundstelle auf Relevanz\n"
        "3. 🔁 **Formuliert um & sucht erneut**, falls nichts passt\n"
        "4. ✍️ **Antwortet** — nur aus den Quellen\n"
        "5. ✅ **Prüft die eigene Antwort** (gedeckt? passend?)"
    )
    st.caption("Läuft lokal · Antworten mit Quellenangabe")


# --- Chatverlauf ---
if "history" not in st.session_state:
    st.session_state.history = []

for m in st.session_state.history:
    with st.chat_message(m["role"]):
        st.markdown(m["content"])
        if m["role"] == "assistant":
            docs_m = m.get("docs", [])
            retries_m = m.get("retries", 0)
            final_q_m = m.get("final_q", "")
            
            # Denk-Trace expander
            if docs_m or retries_m > 0:
                with st.expander("🧠 Wie der Assistent zur Antwort kam"):
                    st.markdown("- 🔍 Ihre Handbücher durchsucht")
                    if retries_m > 0:
                        st.markdown(f"- 🔁 Zuerst nichts Passendes → **{retries_m}×** umformuliert und erneut gesucht")
                        st.caption(f"Umformuliert zu: _{final_q_m}_")
                    if docs_m:
                        st.markdown(f"- 🧪 **{len(docs_m)}** relevante Stelle(n) als brauchbar bewertet")
                        st.markdown("- ✍️ Antwort **nur aus diesen Stellen** formuliert (nichts erfunden)")
                        st.markdown("- ✅ Selbst-Check: Antwort ist durch die Quellen gedeckt")
                    else:
                        st.markdown("- 🧪 Keine relevante Stelle bestätigt")
                        st.markdown("- 🛑 Ehrliche Absage statt einer erfundenen Antwort")
            
            # Quellen expander
            if docs_m:
                with st.expander(f"📄 {len(docs_m)} verwendete Handbuch-Stelle(n) anzeigen"):
                    for idx, doc in enumerate(docs_m, 1):
                        src_title = doc.get("title", "Handbuch")
                        src_url = doc.get("url", "")
                        src_name = pretty_source(src_title)
                        
                        if src_url:
                            st.markdown(f"**[{idx}] [{src_name}]({src_url})**")
                        else:
                            st.markdown(f"**[{idx}] {src_name}**")
                        st.markdown(f"_{doc['text'][:400]}..._")
                        st.divider()

# --- Benutzereingabe ---
q = st.chat_input("Frage zum Handbuch stellen … z. B. „Was bedeutet Fehlercode F.28?“")
if q:
    st.session_state.history.append({"role": "user", "content": q})
    st.rerun()

# --- Antwortgenerierung ---
if st.session_state.history and st.session_state.history[-1]["role"] == "user":
    user_q = st.session_state.history[-1]["content"]
    with st.chat_message("assistant"):
        with st.spinner("Assistent sucht, prüft und kontrolliert die Antwort …"):
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
                st.error(f"Fehler: {e}")
            st.rerun()
