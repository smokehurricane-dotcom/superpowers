# CLI Hybrid Search Engine — Design Specification

Design specification for Phase C Option 2: CLI Hybrid Search Engine & Evaluation Harness.

## 1. Goal & Context
Build a CLI and HTTP-based Hybrid Search Engine using Node.js stdlib only. The search engine combines keyword-based retrieval (BM25) and vector-based retrieval (TF-IDF Cosine Similarity) using Reciprocal Rank Fusion (RRF). It preprocesses text with stopword removal and a lightweight suffix stemmer. It includes an evaluation harness calculating IR metrics (Precision@k, Recall@k, MRR, nDCG) and a benchmark mode comparing keyword-only and hybrid search.

## 2. Directory Structure
```
hybrid_search/
  data/
    documents.json       # Search corpus
    queries.json         # Labeled evaluation queries and ground truth relevance
  search.js              # Tokenizer, stemmer, BM25, Cosine, RRF, and CLI/Server routing
  search.test.js         # Comprehensive test suite
  package.json
```

## 3. Algorithm Specifications

### A. Preprocessing
1. Lowercase text and remove punctuation.
2. Filter out english stopwords.
3. Suffix Stemming: A custom lightweight stemmer removing common endings (`ing`, `ed`, `es`, `s`, `ly`, `ment`, `ness`).

### B. BM25 Scoring
Score for query terms $q \in Q$ on document $D$:
$$Score(D, Q) = \sum_{q \in Q} IDF(q) \cdot \frac{f(q, D) \cdot (k_1 + 1)}{f(q, D) + k_1 \cdot \left(1 - b + b \cdot \frac{|D|}{avgdl}\right)}$$
* $k_1 = 1.2$, $b = 0.75$.
* $IDF(q) = \ln\left(1 + \frac{N - n(q) + 0.5}{n(q) + 0.5}\right)$ where $N$ is total documents, $n(q)$ is documents containing $q$.

### C. TF-IDF Cosine Similarity
1. Map document and query into vocabulary vector space.
2. Cosine Similarity between document vector $V_D$ and query vector $V_Q$:
$$Similarity(D, Q) = \frac{V_D \cdot V_Q}{\|V_D\| \|V_Q\|}$$
(If either magnitude is 0, similarity is 0).

### D. Reciprocal Rank Fusion (RRF)
Combines ranking from BM25 and Cosine similarity:
$$RRF\_Score(D) = \frac{w_1}{60 + rank_1(D)} + \frac{w_2}{60 + rank_2(D)}$$
Where $w_1$ (BM25 weight) and $w_2$ (Cosine weight) are customizable weights.

## 4. Evaluation Metrics
For a given query retrieval list compared to ground truth relevance sets:
* **Precision@k**: $\frac{\text{Relevant docs in top-k}}{k}$
* **Recall@k**: $\frac{\text{Relevant docs in top-k}}{\text{Total relevant docs}}$
* **MRR (Mean Reciprocal Rank)**: $\frac{1}{rank \text{ of first relevant doc}}$
* **nDCG@k**: $DCG@k / IDCG@k$ where:
  - $DCG@k = \sum_{i=1}^k \frac{2^{rel_i} - 1}{\log_2(i + 1)}$
  - $IDCG@k$ is ideal DCG sorting relevance scores in descending order.

## 5. CLI commands
* `search "<query>"`: Performs hybrid search and prints results.
* `eval`: Evaluates both BM25-only and Hybrid search methods across all labeled queries, printing a comparison table.
* `serve`: Spawns a local HTTP server at port 3000 serving a web-based dashboard with visual comparison tables, charts (using pure HTML/CSS bars), and an interactive search interface.
