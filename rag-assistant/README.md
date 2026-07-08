# Ask Your Data — RAG Assistant

A retrieval-augmented (RAG) assistant: it searches **your documents** semantically
and answers questions with **Claude**, grounding every answer in your sources —
with inline citations. Runs locally; you keep control of your data.

- **Semantic retrieval** — local embeddings (sentence-transformers); search never leaves your machine
- **Grounded answers + citations** — Claude answers *only* from your documents (no hallucinated facts)
- **Any documents** — `.txt`, `.md`, `.pdf`, or the included news demo
- **CLI + Streamlit chat UI**

## Install

```bash
pip install -r requirements.txt
```

Add your Claude key: `.env` → `ANTHROPIC_API_KEY=...` (from console.anthropic.com).

## Use

```bash
# 1) build the index over YOUR documents (folder of .txt / .md / .pdf)
python rag.py --build --corpus example-docs
python rag.py --build                       # demo: the bundled news corpus

# 2) ask
python rag.py --ask "how many vacation days do employees get?"
python rag.py --retrieve "vacation policy"  # passages only (offline, no LLM)

# or the chat UI
streamlit run app.py
```

## How it works

```
documents → chunks → local embeddings (MiniLM) → cosine top-k retrieval
→ Claude (Haiku) answers grounded in the retrieved passages, with [1][2] citations
```

## Notes

- Search is fully **local & free**. Only the final answer step calls Claude — pennies per question.
- Your API key stays in `.env` (gitignored) — never shipped to a client.
- Swap the embedding model or the Claude model in `rag.py` (e.g. Sonnet for higher quality).
