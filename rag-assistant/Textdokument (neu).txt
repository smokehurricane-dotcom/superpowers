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

k_each, rrf_k = 20, 60
fused = {}
for rank, idx in enumerate(sem_order[:k_each]):
    fused[int(idx)] = fused.get(int(idx), 0.0) + 1.0 / (rrf_k + rank)
for rank, idx in enumerate(bm25_order[:k_each]):
    fused[int(idx)] = fused.get(int(idx), 0.0) + 1.0 / (rrf_k + rank)

ranked = sorted(fused.items(), key=lambda x: -x[1])[:15]
print("=== Top 15 fused ===")
for i, (idx, score) in enumerate(ranked, 1):
    has_f28 = "F.28" in chunks[idx]["text"]
    sem_r = list(sem_order).index(idx)
    bm25_r = list(bm25_order).index(idx)
    marker = "🎯" if has_f28 else "  "
    print(f"{i:2d}. {marker} chunk {idx} | score={score:.4f} | sem={sem_r:3d} bm25={bm25_r:3d} | {chunks[idx]['text'][:90]}")

print()
print("=== F.28 chunks fused score ===")
for idx in [132, 138, 140]:
    s = fused.get(idx, 0.0)
    sem_r = list(sem_order).index(idx)
    bm25_r = list(bm25_order).index(idx)
    print(f"chunk {idx}: score={s:.4f} | sem={sem_r} bm25={bm25_r}")