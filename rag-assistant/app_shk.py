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

# --- etwas Politur: Streamlit-Menü & Footer ausblenden (saubere Demo-Optik) ---
st.markdown(
    """
    <style>
      #MainMenu {visibility: hidden;}
      footer {visibility: hidden;}
      [data-testid="stToolbar"] {visibility: hidden;}
      [data-testid="stDecoration"] {display: none;}
      .block-container {padding-top: 2.5rem;}
      h1 {letter-spacing: -0.5px;}
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
    st.chat_message(m["role"]).markdown(m["content"])

q = st.chat_input("Frage zum Handbuch stellen … z. B. „Was bedeutet Fehlercode F.28?“")
if q:
    st.session_state.history.append({"role": "user", "content": q})
    st.chat_message("user").markdown(q)
    with st.chat_message("assistant"):
        with st.spinner("Assistent sucht, prüft und kontrolliert die Antwort …"):
            try:
                result = agentic_rag.app.invoke(
                    {"question": q, "documents": [], "generation": "", "retries": 0}
                )
            except Exception as e:
                st.error(f"Fehler: {e}")
                st.stop()

        answer = result["generation"]
        docs = result["documents"]
        retries = result["retries"]
        final_q = result["question"]

        st.markdown(answer)

        # --- Optionaler Denk-Trace (für Neugierige, standardmäßig EINGEKLAPPT) ---
        with st.expander("🧠 Wie der Assistent zur Antwort kam"):
            st.markdown("- 🔍 Ihre Handbücher durchsucht")
            if retries > 0:
                st.markdown(
                    f"- 🔁 Zuerst nichts Passendes → **{retries}×** umformuliert und erneut gesucht"
                )
                if final_q != q:
                    st.caption(f"Umformuliert zu: _{final_q}_")
            if docs:
                st.markdown(f"- 🧪 **{len(docs)}** relevante Stelle(n) als brauchbar bewertet")
                st.markdown("- ✍️ Antwort **nur aus diesen Stellen** formuliert (nichts erfunden)")
                st.markdown("- ✅ Selbst-Check: Antwort ist durch die Quellen gedeckt")
            else:
                st.markdown("- 🧪 Keine relevante Stelle bestätigt")
                st.markdown("- 🛑 Ehrliche Absage statt einer erfundenen Antwort")

        # --- Quellen (der Vertrauens-Beweis) ---
        if docs:
            with st.expander(f"📄 {len(docs)} verwendete Handbuch-Stelle(n) anzeigen"):
                for i, d in enumerate(docs, 1):
                    st.markdown(f"**[{i}]** {d[:300]}…")
        else:
            st.caption(
                "Keine passende Stelle gefunden → ehrliches „Dazu habe ich keine "
                "Information“ statt einer erfundenen Antwort."
            )

        st.session_state.history.append({"role": "assistant", "content": answer})
