'use strict';

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const DEFAULT_DOCS = path.join(__dirname, 'data', 'documents.json');
const DEFAULT_QUERIES = path.join(__dirname, 'data', 'queries.json');

const STOP_WORDS = new Set([
  'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 
  'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 
  'herself', 'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 
  'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 
  'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 
  'did', 'doing', 'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 
  'while', 'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 
  'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 
  'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here', 
  'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 
  'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now'
]);

function getDocsPath() {
  return process.env.SEARCH_DOCS || DEFAULT_DOCS;
}

function getQueriesPath() {
  return process.env.SEARCH_QUERIES || DEFAULT_QUERIES;
}

function readDb(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return [];
  }
}

function stem(word) {
  if (typeof word !== 'string') return '';
  let stemmed = word.trim().toLowerCase();
  if (stemmed.endsWith('ing')) stemmed = stemmed.slice(0, -3);
  else if (stemmed.endsWith('ed')) stemmed = stemmed.slice(0, -2);
  else if (stemmed.endsWith('es')) stemmed = stemmed.slice(0, -2);
  else if (stemmed.endsWith('ness')) stemmed = stemmed.slice(0, -4);
  else if (stemmed.endsWith('ment')) stemmed = stemmed.slice(0, -4);
  else if (stemmed.endsWith('ly')) stemmed = stemmed.slice(0, -2);
  else if (stemmed.endsWith('s') && !stemmed.endsWith('ss')) stemmed = stemmed.slice(0, -1);
  return stemmed;
}

function tokenize(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 0 && !STOP_WORDS.has(w))
    .map(w => stem(w));
}

function runBm25(query, documents = null) {
  const docs = documents || readDb(getDocsPath());
  const queryTokens = Array.from(new Set(tokenize(query)));
  if (queryTokens.length === 0) return [];

  const N = docs.length;
  const docTokensList = docs.map(d => tokenize(d.text));
  const avgdl = docTokensList.reduce((sum, list) => sum + list.length, 0) / N;

  // Calculate n(q)
  const docFreqs = {};
  for (const token of queryTokens) {
    docFreqs[token] = 0;
    for (const tokens of docTokensList) {
      if (tokens.includes(token)) {
        docFreqs[token]++;
      }
    }
  }

  const k1 = 1.2;
  const b = 0.75;

  const results = docs.map((doc, idx) => {
    const tokens = docTokensList[idx];
    const docLen = tokens.length;
    let score = 0;

    for (const token of queryTokens) {
      const nq = docFreqs[token];
      const idf = Math.max(0.0001, Math.log(1 + (N - nq + 0.5) / (nq + 0.5)));
      
      const tf = tokens.filter(t => t === token).length;
      const numerator = tf * (k1 + 1);
      const denominator = tf + k1 * (1 - b + b * (docLen / avgdl));
      score += idf * (numerator / denominator);
    }

    return { id: doc.id, text: doc.text, score };
  });

  return results.filter(r => r.score > 0).sort((a, b) => b.score - a.score);
}

function runCosine(query, documents = null) {
  const docs = documents || readDb(getDocsPath());
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const docTokensList = docs.map(d => tokenize(d.text));
  
  // Vocabulary
  const vocab = new Set();
  docTokensList.forEach(list => list.forEach(t => vocab.add(t)));
  queryTokens.forEach(t => vocab.add(t));
  const vocabArray = Array.from(vocab);

  const N = docs.length;
  // Calculate IDF
  const docFreqs = {};
  vocabArray.forEach(term => {
    docFreqs[term] = 0;
    docTokensList.forEach(list => {
      if (list.includes(term)) docFreqs[term]++;
    });
  });

  const idfs = {};
  vocabArray.forEach(term => {
    const df = docFreqs[term];
    idfs[term] = Math.log(1 + N / (df || 1));
  });

  // Query vector
  const qTF = {};
  queryTokens.forEach(t => qTF[t] = (qTF[t] || 0) + 1);
  const qVec = vocabArray.map(term => (qTF[term] || 0) * idfs[term]);

  const results = docs.map((doc, idx) => {
    const tokens = docTokensList[idx];
    const docTF = {};
    tokens.forEach(t => docTF[t] = (docTF[t] || 0) + 1);
    const docVec = vocabArray.map(term => (docTF[term] || 0) * idfs[term]);

    // Cosine similarity
    let dotProduct = 0;
    let qMagnitude = 0;
    let dMagnitude = 0;

    for (let i = 0; i < vocabArray.length; i++) {
      dotProduct += qVec[i] * docVec[i];
      qMagnitude += qVec[i] * qVec[i];
      dMagnitude += docVec[i] * docVec[i];
    }

    const similarity = qMagnitude > 0 && dMagnitude > 0
      ? dotProduct / (Math.sqrt(qMagnitude) * Math.sqrt(dMagnitude))
      : 0;

    return { id: doc.id, text: doc.text, score: similarity };
  });

  return results.filter(r => r.score > 0).sort((a, b) => b.score - a.score);
}

function rrfFuse(bm25List, cosineList, wBm25 = 1.0, wCosine = 1.0) {
  const k = 60;
  const scores = {};

  bm25List.forEach((item, index) => {
    const rank = index + 1;
    if (!scores[item.id]) scores[item.id] = 0;
    scores[item.id] += wBm25 / (k + rank);
  });

  cosineList.forEach((item, index) => {
    const rank = index + 1;
    if (!scores[item.id]) scores[item.id] = 0;
    scores[item.id] += wCosine / (k + rank);
  });

  const merged = Object.keys(scores).map(id => ({
    id,
    score: scores[id]
  }));

  return merged.sort((a, b) => {
    if (Math.abs(a.score - b.score) < 1e-9) {
      return a.id.localeCompare(b.id);
    }
    return b.score - a.score;
  });
}

function hybridSearch(query, wBm25 = 1.0, wCosine = 1.0, documents = null) {
  if (!query || query.trim() === '') return [];
  const docs = documents || readDb(getDocsPath());
  
  const bm25List = runBm25(query, docs);
  const cosineList = runCosine(query, docs);

  if (bm25List.length === 0 && cosineList.length === 0) return [];

  const fused = rrfFuse(bm25List, cosineList, wBm25, wCosine);
  // Map back texts
  return fused.map(item => {
    const original = docs.find(d => d.id === item.id);
    return { id: item.id, text: original ? original.text : '', score: item.score };
  });
}

function calcMetrics(retrieved, relevance, k = 3) {
  const topK = retrieved.slice(0, k);
  const totalRel = Object.keys(relevance).filter(id => relevance[id] > 0).length;
  
  // Precision@k
  const relDocs = topK.filter(id => relevance[id] && relevance[id] > 0).length;
  const precision = relDocs / k;

  // Recall@k
  const recall = totalRel > 0 ? relDocs / totalRel : 0;

  // MRR
  let mrr = 0;
  for (let i = 0; i < retrieved.length; i++) {
    const id = retrieved[i];
    if (relevance[id] && relevance[id] > 0) {
      mrr = 1 / (i + 1);
      break;
    }
  }

  // nDCG@k
  let dcg = 0;
  for (let i = 0; i < Math.min(topK.length, k); i++) {
    const id = topK[i];
    const rel = relevance[id] || 0;
    dcg += (Math.pow(2, rel) - 1) / Math.log2(i + 2);
  }

  const sortedRel = Object.values(relevance).sort((a, b) => b - a);
  let idcg = 0;
  for (let i = 0; i < Math.min(sortedRel.length, k); i++) {
    idcg += (Math.pow(2, sortedRel[i]) - 1) / Math.log2(i + 2);
  }
  const ndcg = idcg > 0 ? dcg / idcg : 0;

  return { precision, recall, mrr, ndcg };
}

function runBenchmark() {
  const docs = readDb(getDocsPath());
  const queries = readDb(getQueriesPath());

  const summary = {
    bm25: { precision: 0, recall: 0, mrr: 0, ndcg: 0 },
    hybrid: { precision: 0, recall: 0, mrr: 0, ndcg: 0 }
  };

  queries.forEach(q => {
    const bm25Result = runBm25(q.query, docs).map(r => r.id);
    const hybridResult = hybridSearch(q.query, 1.0, 1.0, docs).map(r => r.id);

    const bm25Metrics = calcMetrics(bm25Result, q.relevance);
    const hybridMetrics = calcMetrics(hybridResult, q.relevance);

    Object.keys(summary.bm25).forEach(m => {
      summary.bm25[m] += bm25Metrics[m];
      summary.hybrid[m] += hybridMetrics[m];
    });
  });

  const N = queries.length || 1;
  Object.keys(summary.bm25).forEach(m => {
    summary.bm25[m] /= N;
    summary.hybrid[m] /= N;
  });

  return { summary, N };
}

function printBenchmarkConsole() {
  const { summary, N } = runBenchmark();
  console.log(`===============================================`);
  console.log(`Benchmark Comparison (Averaged over ${N} Queries)`);
  console.log(`===============================================`);
  console.log(`Metric       | BM25 (Keyword) | Hybrid (RRF) | Improvement`);
  console.log(`-------------+----------------+--------------+------------`);
  Object.keys(summary.bm25).forEach(m => {
    const bm25Val = summary.bm25[m];
    const hybridVal = summary.hybrid[m];
    const diff = hybridVal - bm25Val;
    const pct = bm25Val > 0 ? (diff / bm25Val) * 100 : 0;
    const sign = pct >= 0 ? '+' : '';
    console.log(`${m.toUpperCase().padEnd(12)} | ${bm25Val.toFixed(4).padEnd(14)} | ${hybridVal.toFixed(4).padEnd(12)} | ${sign}${pct.toFixed(2)}%`);
  });
  console.log(`===============================================`);
}

function startWebServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    if (url.pathname === '/') {
      const { summary, N } = runBenchmark();
      const docs = readDb(getDocsPath());
      
      // Handle interactive search query
      const searchQuery = url.searchParams.get('q') || '';
      const wBm25 = parseFloat(url.searchParams.get('wBm25') || '1.0');
      const wCosine = parseFloat(url.searchParams.get('wCosine') || '1.0');

      let bm25Results = [];
      let cosineResults = [];
      let hybridResults = [];

      if (searchQuery) {
        bm25Results = runBm25(searchQuery, docs);
        cosineResults = runCosine(searchQuery, docs);
        hybridResults = hybridSearch(searchQuery, wBm25, wCosine, docs);
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Hybrid Search Dashboard</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.7);
      --accent-sky: #38bdf8;
      --accent-indigo: #818cf8;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--bg-color);
      color: var(--text-main);
      margin: 0;
      padding: 40px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .container {
      max-width: 1000px;
      width: 100%;
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 5px;
      background: linear-gradient(135deg, var(--accent-sky), var(--accent-indigo));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subtitle {
      color: var(--text-muted);
      margin-bottom: 40px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 30px;
      margin-bottom: 40px;
    }
    @media (min-width: 768px) {
      .grid { grid-template-columns: 1fr 1fr; }
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      padding: 30px;
      border: 1px solid rgba(255, 255, 255, 0.05);
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.25);
    }
    .card h2 {
      margin-top: 0;
      font-size: 1.5rem;
      font-weight: 600;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .metric-row {
      margin-bottom: 20px;
    }
    .metric-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 5px;
      font-size: 0.95rem;
    }
    .metric-bar-outer {
      background: rgba(255, 255, 255, 0.05);
      border-radius: 8px;
      height: 12px;
      overflow: hidden;
      display: flex;
    }
    .metric-bar-inner {
      height: 100%;
      transition: width 0.3s ease;
    }
    .bar-bm25 { background: var(--accent-indigo); }
    .bar-hybrid { background: var(--accent-sky); }
    .improvement {
      color: #34d399;
      font-weight: bold;
    }
    .improvement.neg {
      color: #f87171;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }
    th {
      color: var(--text-muted);
      font-weight: 600;
    }
    .form-group {
      display: flex;
      gap: 15px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    input[type="text"] {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 12px;
      color: white;
      font-family: inherit;
      font-size: 1rem;
      flex-grow: 1;
    }
    input[type="number"] {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 12px;
      color: white;
      font-family: inherit;
      font-size: 1rem;
      width: 80px;
    }
    button {
      background: linear-gradient(135deg, var(--accent-sky), var(--accent-indigo));
      border: none;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    button:hover {
      opacity: 0.9;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Hybrid Search Analytics & Benchmark</h1>
    <div class="subtitle">BM25 + TF-IDF Cosine Similarity + Reciprocal Rank Fusion Evaluator</div>

    <div class="grid">
      <!-- Benchmark Card -->
      <div class="card">
        <h2>Evaluation Harness (${N} Queries)</h2>
        ${Object.keys(summary.bm25).map(m => {
          const bm25Val = summary.bm25[m];
          const hybridVal = summary.hybrid[m];
          const diff = hybridVal - bm25Val;
          const pct = bm25Val > 0 ? (diff / bm25Val) * 100 : 0;
          return `
            <div class="metric-row">
              <div class="metric-header">
                <span><strong>${m.toUpperCase()}</strong></span>
                <span>BM25: ${(bm25Val*100).toFixed(1)}% | Hybrid: ${(hybridVal*100).toFixed(1)}%</span>
              </div>
              <div class="metric-bar-outer" style="margin-bottom: 5px;">
                <div class="metric-bar-inner bar-bm25" style="width: ${bm25Val*100}%"></div>
              </div>
              <div class="metric-bar-outer">
                <div class="metric-bar-inner bar-hybrid" style="width: ${hybridVal*100}%"></div>
              </div>
              <div style="font-size: 0.85rem; text-align: right; margin-top: 4px;">
                Gain: <span class="improvement ${pct >= 0 ? 'pos' : 'neg'}">${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%</span>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Playground Card -->
      <div class="card">
        <h2>Interactive Playground</h2>
        <form method="GET" action="/">
          <div class="form-group">
            <input type="text" name="q" value="${searchQuery}" placeholder="Enter query..." required>
          </div>
          <div class="form-group" style="align-items: center;">
            <label>BM25 Weight:</label>
            <input type="number" step="0.1" name="wBm25" value="${wBm25}">
            <label>Cosine Weight:</label>
            <input type="number" step="0.1" name="wCosine" value="${wCosine}">
            <button type="submit">Search</button>
          </div>
        </form>

        ${searchQuery ? `
          <h3>RRF Fusion Ranking</h3>
          <table>
            <thead>
              <tr>
                <th>Doc ID</th>
                <th>RRF Score</th>
                <th>Text</th>
              </tr>
            </thead>
            <tbody>
              ${hybridResults.map(r => `
                <tr>
                  <td><code>${r.id}</code></td>
                  <td>${r.score.toFixed(4)}</td>
                  <td style="font-size: 0.85rem; color: var(--text-muted);">${r.text}</td>
                </tr>
              `).join('')}
              ${hybridResults.length === 0 ? '<tr><td colspan="3">No results matched</td></tr>' : ''}
            </tbody>
          </table>
        ` : '<p style="color: var(--text-muted);">Enter a query to run search play.</p>'}
      </div>
    </div>

    ${searchQuery ? `
      <!-- Ranks comparison card -->
      <div class="card" style="margin-bottom: 40px;">
        <h2>Detailed Rankings Comparison</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <h3>BM25 Ranking</h3>
            <table>
              <thead><tr><th>ID</th><th>BM25 Score</th></tr></thead>
              <tbody>
                ${bm25Results.map(r => `<tr><td><code>${r.id}</code></td><td>${r.score.toFixed(4)}</td></tr>`).join('')}
                ${bm25Results.length === 0 ? '<tr><td colspan="2">No matches</td></tr>' : ''}
              </tbody>
            </table>
          </div>
          <div>
            <h3>Cosine TF-IDF Ranking</h3>
            <table>
              <thead><tr><th>ID</th><th>Cosine Score</th></tr></thead>
              <tbody>
                ${cosineResults.map(r => `<tr><td><code>${r.id}</code></td><td>${r.score.toFixed(4)}</td></tr>`).join('')}
                ${cosineResults.length === 0 ? '<tr><td colspan="2">No matches</td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    ` : ''}
  </div>
</body>
</html>`);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  const port = 3000;
  server.listen(port, () => {
    console.log(`Mini-Dashboard running at http://localhost:${port}/`);
  });
}

function runCliMain() {
  const cliArgs = process.argv.slice(2);
  const command = cliArgs[0];
  const args = cliArgs.slice(1);

  switch (command) {
    case 'search': {
      if (args.length < 1) {
        process.stderr.write('Usage: node search.js search "<query>"\n');
        process.exit(1);
      }
      const results = hybridSearch(args[0]);
      if (results.length === 0) {
        console.log('No matching documents found.');
      } else {
        results.forEach((r, idx) => {
          console.log(`[${idx + 1}] Doc: ${r.id} (RRF: ${r.score.toFixed(4)}) - ${r.text}`);
        });
      }
      break;
    }
    case 'eval': {
      printBenchmarkConsole();
      break;
    }
    case 'serve': {
      startWebServer();
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\nUsage: node search.js search|eval|serve\n`);
      process.exit(1);
  }
}

if (require.main === module) {
  runCliMain();
}

module.exports = { tokenize, stem, runBm25, runCosine, rrfFuse, hybridSearch, calcMetrics, runBenchmark };
