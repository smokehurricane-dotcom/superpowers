import rag
import numpy as np
import pickle, json

embs = np.load(rag.EMB_PATH)
chunks = json.load(open(rag.META_PATH, encoding="utf-8"))
bm25 = pickle.load(open(rag.BM25_PATH, "rb"))
query = "Was bedeutet Fehlercode F.28 bei der Vaillant ecoTEC?"

q_vec = rag.get_model().encode([query], normalize_embeddings=True)[0].astype("float32")
sem_scores = embs @ q_vec
sem_order = np.argsort(-sem_scores)

bm25_scores = bm25.get_scores(query.lower().split())
bm25_order = np.argsort(-bm25_scores)

f28_indices = [i for i, c in enumerate(chunks) if "F.28" in c["text"]]
print("Chunks mit F.28:", f28_indices)
print()
for idx in f28_indices:
    sem_rank = list(sem_order).index(idx)
    bm25_rank = list(bm25_order).index(idx)
    print(f"Chunk {idx}: semantic rank = {sem_rank}, BM25 rank = {bm25_rank}")
    print(f"  Text: {chunks[idx]['text'][:200]}")
    print()