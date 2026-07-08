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
      
      /* Global Page Background & Text Color - Warm Dark Espresso */
      .stApp {
        background-color: #1E1A16 !important;
        color: #F4ECE1 !important;
      }
      
      .block-container {
        padding-top: 2rem;
        max-width: 780px;
      }
      
      /* Sidebar Warm Dark Sepia */
      [data-testid="stSidebar"] {
        background-color: #15120F !important;
        border-right: 1px solid rgba(220, 208, 192, 0.1) !important;
      }
      
      /* Hide default streamlit decoration lines */
      #MainMenu {visibility: hidden;}
      footer {visibility: hidden;}
      [data-testid="stToolbar"] {visibility: hidden;}
      [data-testid="stDecoration"] {display: none;}
      
      /* Headings Color - Soft warm cream */
      h1, h2, h3, .stMarkdown h1, .stMarkdown h2, .stMarkdown h3 {
        color: #FAF6F0 !important;
        font-weight: 600 !important;
      }
      
      /* Warm Amber Link Styling */
      a {
        color: #E58F44 !important;
        text-decoration: none !important;
        border-bottom: 1px dashed #E58F44 !important;
        transition: all 0.2s ease !important;
        font-weight: 500 !important;
      }
      a:hover {
        color: #FFB066 !important;
        border-bottom-style: solid !important;
      }
      
      /* Chat Message Overrides - Dark Chocolate Cards */
      [data-testid="stChatMessage"] {
        background-color: #28221D !important;
        border: 1px solid rgba(220, 208, 192, 0.12) !important;
        border-radius: 14px !important;
        padding: 1.25rem !important;
        margin-bottom: 1rem !important;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2) !important;
      }
      
      /* Force text inside chat messages to be warm cream */
      [data-testid="stChatMessage"] p, [data-testid="stChatMessage"] li, [data-testid="stChatMessage"] span {
        color: #F4ECE1 !important;
      }
      
      /* Highlight User message slightly differently with a warm copper accent */
      [data-testid="stChatMessage"][data-testid$="user"] {
        background-color: #2D2621 !important;
        border-left: 4px solid #E58F44 !important;
      }
      
      /* Expanders (Traces & Sources) styling to look like premium dark cards */
      .conda-expander, [data-testid="stExpander"] {
        background-color: #231E1A !important;
        border: 1px solid rgba(220, 208, 192, 0.1) !important;
        border-radius: 10px !important;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important;
        margin-top: 0.5rem !important;
      }
      [data-testid="stExpander"] p, [data-testid="stExpander"] span, [data-testid="stExpander"] summary {
        color: #FAF6F0 !important;
      }
      
      /* Citation Badge Styling inside the text */
      .citation-badge {
        background-color: #3E322A !important;
        color: #FFB066 !important;
        padding: 2px 6px !important;
        border-radius: 6px !important;
        font-weight: 600 !important;
        font-size: 0.85em !important;
        border: 1px solid rgba(229, 143, 68, 0.3) !important;
        display: inline-block !important;
        margin: 0 2px !important;
        vertical-align: middle !important;
      }
      
      /* Source items dividers */
      hr {
        border: 0 !important;
        height: 1px !important;
        background: rgba(220, 208, 192, 0.1) !important;
        margin: 1rem 0 !important;
      }
      
      /* Text input fields custom warm dark border */
      [data-testid="stChatInput"] textarea {
        border: 1px solid rgba(220, 208, 192, 0.2) !important;
        background-color: #28221D !important;
        border-radius: 10px !important;
        color: #FAF6F0 !important;
      }
      [data-testid="stChatInput"] textarea:focus {
        border-color: #E58F44 !important;
        box-shadow: 0 0 0 1px #E58F44 !important;
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
