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

st.set_page_config(page_title="Hunde-Wissens-Assistent", page_icon="🐕", layout="centered")

# --- etwas Politur: Premium Styling & Menüs ausblenden ---
st.markdown(
    """
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
      
      html, body, [data-testid="stWidgetLabel"] {
        font-family: 'Outfit', sans-serif !important;
      }
      
      /* Global Page Background & Text Color */
      .stApp {
        background-color: #FAF6F0 !important;
        color: #3C332A !important;
      }
      
      .block-container {
        padding-top: 2rem;
        max-width: 780px;
      }
      
      /* Sidebar Oatmeal/Sand Warm Background */
      [data-testid="stSidebar"] {
        background-color: #F4ECE1 !important;
        border-right: 1px solid rgba(139, 115, 85, 0.15) !important;
      }
      
      /* Hide default streamlit decoration lines */
      #MainMenu {visibility: hidden;}
      footer {visibility: hidden;}
      [data-testid="stToolbar"] {visibility: hidden;}
      [data-testid="stDecoration"] {display: none;}
      
      /* Headings Color */
      h1, h2, h3, .stMarkdown h1, .stMarkdown h2, .stMarkdown h3 {
        color: #4A3B32 !important;
        font-weight: 600 !important;
      }
      
      /* Warm Link Styling */
      a {
        color: #B85A1C !important;
        text-decoration: none !important;
        border-bottom: 1px dashed #B85A1C !important;
        transition: all 0.2s ease !important;
        font-weight: 500 !important;
      }
      a:hover {
        color: #D27D2D !important;
        border-bottom-style: solid !important;
      }
      
      /* Chat Message Overrides */
      [data-testid="stChatMessage"] {
        background-color: #FFFFFF !important;
        border: 1px solid rgba(220, 208, 192, 0.5) !important;
        border-radius: 14px !important;
        padding: 1.25rem !important;
        margin-bottom: 1rem !important;
        box-shadow: 0 3px 10px rgba(139, 115, 85, 0.04) !important;
      }
      
      /* Highlight User message slightly differently with a warm tint */
      [data-testid="stChatMessage"][data-testid$="user"] {
        background-color: #FDFBF8 !important;
        border-left: 4px solid #D27D2D !important;
      }
      
      /* Expanders (Traces & Sources) styling to look like premium cards */
      .conda-expander, [data-testid="stExpander"] {
        background-color: #FFFFFF !important;
        border: 1px solid rgba(220, 208, 192, 0.4) !important;
        border-radius: 10px !important;
        box-shadow: 0 2px 6px rgba(139, 115, 85, 0.02) !important;
        margin-top: 0.5rem !important;
      }
      
      /* Citation Badge Styling inside the text */
      .citation-badge {
        background-color: #F4E8DB !important;
        color: #B85A1C !important;
        padding: 2px 6px !important;
        border-radius: 6px !important;
        font-weight: 600 !important;
        font-size: 0.85em !important;
        border: 1px solid rgba(184, 90, 28, 0.2) !important;
        display: inline-block !important;
        margin: 0 2px !important;
        vertical-align: middle !important;
      }
      
      /* Source items dividers */
      hr {
        border: 0 !important;
        height: 1px !important;
        background: rgba(220, 208, 192, 0.4) !important;
        margin: 1rem 0 !important;
      }
      
      /* Text input fields custom warm border */
      [data-testid="stChatInput"] textarea {
        border: 1px solid rgba(220, 208, 192, 0.8) !important;
        background-color: #FFFFFF !important;
        border-radius: 10px !important;
        color: #3C332A !important;
      }
      [data-testid="stChatInput"] textarea:focus {
        border-color: #B85A1C !important;
        box-shadow: 0 0 0 1px #B85A1C !important;
      }
    </style>
    """,
    unsafe_allow_html=True,
)

import re

def format_citations(text: str) -> str:
    pattern = r'\[(\d+)\]'
    replacement = r'<span class="citation-badge">[\1]</span>'
    return re.sub(pattern, replacement, text)

# Hübsche Namen für die geladenen Wissensbausteine (Dateiname -> Klartext)
PRETTY_SOURCES = {
    "augen_ohrenpflege.md": "Augen- & Ohrenpflege",
    "ernaehrung_futter.md": "Ernährung & Futter",
    "erste_hilfe.md": "Erste Hilfe",
    "fellpflege.md": "Fellpflege",
    "giftige_lebensmittel.md": "Giftige Lebensmittel",
    "hitze_kaelte.md": "Hitze & Kälte im Alltag",
    "hundepsychologie.md": "Hundepsychologie & Verhalten",
    "hygiene_intim_after.md": "Hygiene & Intimpflege",
    "krallenpflege.md": "Krallenpflege",
    "lebensqualitaet_senioren.md": "Lebensqualität bei Senioren",
    "notfaelle_warnzeichen.md": "Notfälle & Warnzeichen",
    "pyometra.md": "Gebärmutterentzündung (Pyometra)",
    "senioren_gelenke.md": "Senioren- & Gelenkgesundheit",
    "zusatz.md": "Zusatzwissen",
}


def pretty_source(name: str) -> str:
    if name in PRETTY_SOURCES:
        return PRETTY_SOURCES[name]
    return name.replace(".md", "").replace("-", " ").replace("_", " ").title()


st.title("🐕 Hunde-Wissens-Assistent")
st.caption(
    "Stellen Sie eine Frage zu Hundegesundheit, Pflege, Verhalten oder Notfällen — die Antwort kommt **direkt aus Ihrem verifizierten Hunde-Wissenskorpus**. "
    "Findet der Assistent keine Informationen, sagt er das ehrlich."
)

# --- Seitenleiste ---
with st.sidebar:
    st.header("Status")
    if os.path.exists(rag.META_PATH):
        chunks = json.load(open(rag.META_PATH, encoding="utf-8"))
        n = len(chunks)
        st.success(f"Wissenskorpus geladen · {n} Einträge")
        sources = sorted({c.get("title", "") for c in chunks if c.get("title")})
        # Wait, the title of the chunk inside our parsed markdown is the FAQ question heading.
        # But we actually want to show the list of markdown files that were loaded!
        # Let's extract the list of unique markdown filenames from the chunks "source" field instead of "title"!
        loaded_sources = sorted({c.get("source", "") for c in chunks if c.get("source")})
        if loaded_sources:
            st.caption("Geladene Wissensbereiche:")
            for s in loaded_sources:
                st.markdown(f"• {pretty_source(s)}")
    else:
        st.error("Kein Index — bitte `python rag.py --build --corpus ../docs` ausführen")
    
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
        "1. 🔍 **Durchsucht** den Hunde-Wissenskorpus\n"
        "2. 🧪 **Prüft** jeden Eintrag auf Relevanz\n"
        "3. 🔁 **Formuliert um & sucht erneut**, falls nichts passt\n"
        "4. ✍️ **Antwortet** — nur aus den verifizierten Quellen\n"
        "5. ✅ **Prüft die eigene Antwort** (gedeckt? passend?)"
    )
    st.caption("Läuft lokal · Antworten mit Quellenangabe")


# --- Chatverlauf ---
if "history" not in st.session_state:
    st.session_state.history = []

for m in st.session_state.history:
    with st.chat_message(m["role"]):
        if m["role"] == "user":
            st.markdown(m["content"])
        else:
            st.markdown(format_citations(m["content"]), unsafe_allow_html=True)
            
        if m["role"] == "assistant":
            docs_m = m.get("docs", [])
            retries_m = m.get("retries", 0)
            final_q_m = m.get("final_q", "")
            
            # Denk-Trace expander
            if docs_m or retries_m > 0:
                with st.expander("🧠 Wie der Assistent zur Antwort kam"):
                    st.markdown("- 🔍 den Hunde-Wissenskorpus durchsucht")
                    if retries_m > 0:
                        st.markdown(f"- 🔁 Zuerst nichts Passendes → **{retries_m}×** umformuliert und erneut gesucht")
                        st.caption(f"Umformuliert zu: _{final_q_m}_")
                    if docs_m:
                        st.markdown(f"- 🧪 **{len(docs_m)}** relevante(r) Wissenseintrag/-einträge als brauchbar bewertet")
                        st.markdown("- ✍️ Antwort **nur aus diesen Einträgen** formuliert (nichts erfunden)")
                        st.markdown("- ✅ Selbst-Check: Antwort ist durch die Quellen gedeckt")
                    else:
                        st.markdown("- 🧪 Keine relevante Stelle bestätigt")
                        st.markdown("- 🛑 Ehrliche Absage statt einer erfundenen Antwort")
            
            # Quellen expander
            if docs_m:
                with st.expander(f"📄 {len(docs_m)} verwendete(r) Quelleneintrag/-einträge anzeigen"):
                    for idx, doc in enumerate(docs_m, 1):
                        src_title = doc.get("title", "Wissensbaustein")
                        src_source = doc.get("source", "")
                        src_url = doc.get("url", "")
                        src_name = pretty_source(src_source) if src_source else pretty_source(src_title)
                        
                        # Replace local file paths with relative paths for display link compatibility
                        clean_url = src_url
                        if clean_url and clean_url.startswith("../"):
                            clean_url = clean_url.replace("../", "")
                        
                        if clean_url:
                            st.markdown(f"**[{idx}] [{src_name}]({clean_url})** — *{src_title}*")
                        else:
                            st.markdown(f"**[{idx}] {src_name}** — *{src_title}*")
                        st.markdown(f"_{doc['text'][:400]}..._")
                        st.divider()

# --- Benutzereingabe ---
q = st.chat_input("Frage zu Ihrem Hund stellen … z. B. „Wie verabreiche ich Augentropfen?“ oder „Was ist giftig für Hunde?“")
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
