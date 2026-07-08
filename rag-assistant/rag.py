"""
rag.py — "Chat with your data" RAG assistant.

Loads a document corpus, embeds it locally (sentence-transformers), retrieves the
most relevant passages by cosine similarity, and uses Claude to answer the question
grounded in those passages — WITH source citations.

Usage:
    python rag.py --build                    # build the index from the corpus
    python rag.py --ask "your question"      # retrieval + Claude answer + sources
    python rag.py --retrieve "your query"    # retrieval only (no LLM, fully offline)

Setup for --ask: put your key in .env  ->  ANTHROPIC_API_KEY=...
"""
import os, sys, json, glob, argparse, pickle
import numpy as np
from rank_bm25 import BM25Okapi

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX_DIR = os.path.join(HERE, "index")
EMB_PATH = os.path.join(INDEX_DIR, "embeddings.npy")
META_PATH = os.path.join(INDEX_DIR, "meta.json")
BM25_PATH = os.path.join(INDEX_DIR, "bm25.pkl")
BM25_STOPWORDS = {"was","ist","der","die","das","den","dem","des","ein","eine","einen","einem","einer","bei","auf","in","im","an","am","von","vom","zum","zur","zu","und","oder","mit","fuer","für","wie","bedeutet","behebe","ich","mein","meine","sie","es","du","man","vaillant","ecotec","broetje","brötje","wgb"}
MODEL_NAME = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"
CLAUDE_MODEL = "claude-haiku-4-5-20251001"

# default corpus = latest news-aggregator output
DEFAULT_CORPUS = sorted(glob.glob(r"C:\Users\petra\news-aggregator\output\news_*.json"))
_model = None


import re
def clean_tokenize(text: str) -> list:
    return re.findall(r'\b\w+(?:\.\w+)*\b', text.lower())


def load_env(path=os.path.join(HERE, ".env")):
    if os.path.exists(path):
        for ln in open(path, encoding="utf-8"):
            ln = ln.strip()
            if ln and not ln.startswith("#") and "=" in ln:
                k, v = ln.split("=", 1); os.environ.setdefault(k.strip(), v.strip())


def get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        print("loading embedding model (first run downloads ~80 MB)...")
        _model = SentenceTransformer(MODEL_NAME)
    return _model


def _load_news_json(path):
    docs = []
    for a in json.load(open(path, encoding="utf-8")):
        title = (a.get("title") or "").strip()
        summary = (a.get("summary") or "").strip()
        text = (title + ". " + summary).strip(". ").strip()
        if text:
            docs.append({"text": text, "title": title, "source": a.get("source", ""),
                         "date": a.get("published", ""), "url": a.get("link", "")})
    return docs


def _read_file(fp):
    ext = fp.lower().rsplit(".", 1)[-1]
    if ext in ("txt", "md"):
        return open(fp, encoding="utf-8", errors="ignore").read()
    if ext == "pdf":
        try:
            from pypdf import PdfReader
            return "\n".join((p.extract_text() or "") for p in PdfReader(fp).pages)
        except Exception as e:
            print("  pdf read err:", os.path.basename(fp), repr(e)[:60])
    return ""


def load_corpus(path=None):
    """Load docs from: news JSON (default), a single .txt/.md/.pdf/.json, or a folder of them.
    Returns list of {text, title, source, date, url}."""
    if path is None:
        if not DEFAULT_CORPUS:
            raise SystemExit("no corpus found; pass --corpus PATH")
        path = DEFAULT_CORPUS[-1]
    docs = []
    if os.path.isdir(path):
        files = []
        for ext in ("txt", "md", "pdf", "json"):
            files += glob.glob(os.path.join(path, "*." + ext))
        for fp in sorted(files):
            if fp.endswith(".json"):
                docs += _load_news_json(fp)
            else:
                t = _read_file(fp).strip()
                if t:
                    docs.append({"text": t, "title": os.path.basename(fp),
                                 "source": os.path.basename(fp), "date": "", "url": fp})
    elif path.endswith(".json"):
        docs = _load_news_json(path)
    else:
        t = _read_file(path).strip()
        if t:
            docs = [{"text": t, "title": os.path.basename(path),
                     "source": os.path.basename(path), "date": "", "url": path}]
    print("loaded %d docs from %s" % (len(docs), os.path.basename(path.rstrip("\\/"))))
    return docs


def chunk_docs(docs, max_chars=900):
    """Split long docs into passages on sentence boundaries; short ones stay whole."""
    chunks = []
    for d in docs:
        t = d["text"]
        if len(t) <= max_chars:
            chunks.append(d); continue
        parts, cur = [], ""
        for sent in t.replace("\n", " ").split(". "):
            if len(cur) + len(sent) + 2 <= max_chars:
                cur += sent + ". "
            else:
                if cur.strip():
                    parts.append(cur.strip())
                cur = sent + ". "
        if cur.strip():
            parts.append(cur.strip())
        for p in parts:
            c = dict(d); c["text"] = p; chunks.append(c)
    return chunks


def build(path=None):
    chunks = chunk_docs(load_corpus(path))
    print("embedding %d chunks..." % len(chunks))
    embs = get_model().encode([c["text"] for c in chunks], normalize_embeddings=True,
                              show_progress_bar=True, batch_size=64)
    embs = np.asarray(embs, dtype="float32")
    tokenized = [clean_tokenize(c["text"]) for c in chunks]
    bm25 = BM25Okapi(tokenized)
    os.makedirs(INDEX_DIR, exist_ok=True)
    np.save(EMB_PATH, embs)
    pickle.dump(bm25, open(BM25_PATH, "wb"))
    json.dump(chunks, open(META_PATH, "w", encoding="utf-8"), ensure_ascii=False)
    print("index built:", embs.shape, "-> saved to ./index")


def retrieve(query, k=5):
    if not os.path.exists(EMB_PATH):
        raise SystemExit("no index — run: python rag.py --build")
    embs = np.load(EMB_PATH)
    chunks = json.load(open(META_PATH, encoding="utf-8"))
    q = get_model().encode([query], normalize_embeddings=True)[0].astype("float32")
    scores = embs @ q                       # cosine similarity (vectors are normalized)
    idx = np.argsort(-scores)[:k]
    return [(float(scores[i]), chunks[i]) for i in idx]

def retrieve_hybrid(query, k=5, k_each=20, rrf_k=60):
    if not os.path.exists(EMB_PATH) or not os.path.exists(BM25_PATH):
        raise SystemExit("no hybrid index — run: python rag.py --build")
    embs = np.load(EMB_PATH)
    chunks = json.load(open(META_PATH, encoding="utf-8"))
    bm25 = pickle.load(open(BM25_PATH, "rb"))

    q_vec = get_model().encode([query], normalize_embeddings=True)[0].astype("float32")
    sem_scores = embs @ q_vec
    sem_top = np.argsort(-sem_scores)[:k_each]

    q_tokens = [t for t in clean_tokenize(query) if t not in BM25_STOPWORDS]
    if not q_tokens: q_tokens = clean_tokenize(query)
    bm25_scores = bm25.get_scores(q_tokens)
    bm25_top = np.argsort(-bm25_scores)[:k_each]

    fused = {}
    for rank, idx in enumerate(sem_top):
        fused[int(idx)] = fused.get(int(idx), 0.0) + 1.0 / (rrf_k + rank)
    for rank, idx in enumerate(bm25_top):
        fused[int(idx)] = fused.get(int(idx), 0.0) + 1.0 / (rrf_k + rank)

    ranked = sorted(fused.items(), key=lambda x: -x[1])[:k]
    return [(score, chunks[i]) for i, score in ranked]


def answer(query, k=5):
    """Retrieve top-k passages and have Claude answer grounded in them, with citations."""
    hits = retrieve(query, k)
    ctx = ""
    for i, (score, c) in enumerate(hits, 1):
        ctx += "[%d] %s (%s, %s)\n%s\n\n" % (i, c["title"], c["source"], str(c["date"])[:10], c["text"])
    key = os.getenv("ANTHROPIC_API_KEY")
    if not key:
        raise SystemExit("no ANTHROPIC_API_KEY — put your key in .env (or use --retrieve for offline mode)")
    import anthropic
    client = anthropic.Anthropic(api_key=key)
    system = ("You are a precise research assistant. Answer the question using ONLY the numbered "
              "sources provided. Cite the sources you use inline like [1], [2]. If the answer is "
              "not in the sources, say so plainly. Be concise and factual.")
    resp = client.messages.create(
        model=CLAUDE_MODEL, max_tokens=600, system=system,
        messages=[{"role": "user", "content": "Sources:\n\n%s\nQuestion: %s" % (ctx, query)}],
    )
    return resp.content[0].text.strip(), hits


def _print_hits(hits, query):
    print("\nTop %d passages for: \"%s\"\n" % (len(hits), query))
    for score, c in hits:
        print("[%.3f] %s" % (score, c["title"][:85]))
        print("        %s · %s" % (c["source"][:32], str(c["date"])[:10]))
        print("        %s" % c["text"][:200].replace("\n", " "))
        print("        %s\n" % c["url"])


def main():
    ap = argparse.ArgumentParser(description="RAG assistant — chat with your data")
    ap.add_argument("--build", action="store_true", help="build the index")
    ap.add_argument("--ask", help="ask a question (retrieval + Claude answer with sources)")
    ap.add_argument("--retrieve", help="retrieval only — show passages (no LLM, offline)")
    ap.add_argument("--corpus", help="path to a corpus .json")
    ap.add_argument("-k", type=int, default=5, help="number of passages")
    args = ap.parse_args()
    load_env()
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass
    if args.build:
        build(args.corpus)
    if args.retrieve:
        _print_hits(retrieve(args.retrieve, args.k), args.retrieve)
    if args.ask:
        ans, hits = answer(args.ask, args.k)
        print("\nQ: %s\n" % args.ask)
        print(ans + "\n")
        print("Sources:")
        for i, (score, c) in enumerate(hits, 1):
            print("  [%d] %s — %s" % (i, c["title"][:72], c["url"]))
    if not (args.build or args.ask or args.retrieve):
        ap.print_help()


if __name__ == "__main__":
    main()
