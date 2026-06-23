'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync, spawn } = require('node:child_process');
const http = require('node:http');

const SEARCH_JS = path.join(__dirname, 'search.js');
let tempDocsPath = '';
let tempQueriesPath = '';

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [SEARCH_JS, ...args], {
    encoding: 'utf8',
    cwd: __dirname,
    env: {
      ...process.env,
      SEARCH_DOCS: tempDocsPath,
      SEARCH_QUERIES: tempQueriesPath
    },
    ...options
  });
}

function makeTempPath(prefix) {
  return path.join(os.tmpdir(), `${prefix}-test-${Math.random().toString(36).slice(2)}.json`);
}

describe('Hybrid Search Engine Tests', { concurrency: false }, () => {
  beforeEach(() => {
    tempDocsPath = makeTempPath('docs');
    tempQueriesPath = makeTempPath('queries');
    process.env.SEARCH_DOCS = tempDocsPath;
    process.env.SEARCH_QUERIES = tempQueriesPath;

    // Seed mock docs
    const docs = [
      { id: 'doc1', text: 'Teuto climbing contains lead climbing in Senne.' },
      { id: 'doc2', text: 'Baking bread Lamm bakery has traditional wood-fired ovens.' },
      { id: 'doc3', text: 'Loom shopping mall in Bielefeld center.' }
    ];
    // Seed mock queries
    const queries = [
      {
        query: 'climbing in Senne',
        relevance: { doc1: 3 }
      },
      {
        query: 'baking ovens',
        relevance: { doc2: 3 }
      }
    ];

    fs.writeFileSync(tempDocsPath, JSON.stringify(docs, null, 2), 'utf8');
    fs.writeFileSync(tempQueriesPath, JSON.stringify(queries, null, 2), 'utf8');
  });

  afterEach(() => {
    try { fs.unlinkSync(tempDocsPath); } catch (_) {}
    try { fs.unlinkSync(tempQueriesPath); } catch (_) {}
    delete process.env.SEARCH_DOCS;
    delete process.env.SEARCH_QUERIES;
  });

  // Task 1: Preprocessing Tests
  test('tokenizer lowercases, strips punctuation, and filters stopwords', () => {
    const { tokenize } = require('./search.js');
    const tokens = tokenize('Climbing in the Teutoburg forest ridge!');
    
    assert.deepEqual(tokens, ['climbing', 'teutoburg', 'forest', 'ridge']);
  });

  test('stemmer strips common suffix endings', () => {
    const { stem } = require('./search.js');
    assert.equal(stem('climbing'), 'climb');
    assert.equal(stem('baked'), 'bake');
    assert.equal(stem('ovens'), 'oven');
    assert.equal(stem('traditionally'), 'traditional');
    assert.equal(stem('sadness'), 'sad');
  });

  // Task 2: BM25, Cosine, RRF Tests
  test('BM25 scores matching documents correctly', () => {
    const { runBm25 } = require('./search.js');
    const results = runBm25('climbing');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'doc1');
    assert.ok(results[0].score > 0);
  });

  test('TF-IDF Cosine scores matching documents correctly', () => {
    const { runCosine } = require('./search.js');
    const results = runCosine('bread bakery');
    assert.equal(results.length, 1);
    assert.equal(results[0].id, 'doc2');
    assert.ok(results[0].score > 0);
  });

  test('RRF fuses ranks correctly with weights', () => {
    const { rrfFuse } = require('./search.js');
    const bm25List = [{ id: 'doc1' }, { id: 'doc2' }];
    const cosineList = [{ id: 'doc2' }, { id: 'doc1' }];
    
    // equal weights: doc1 and doc2 both ranked 1st and 2nd, so their RRF scores should be identical.
    // Let's check when weights favor BM25:
    const results = rrfFuse(bm25List, cosineList, 2.0, 1.0);
    assert.equal(results[0].id, 'doc1'); // doc1 should win since BM25 weight is higher
  });

  // Task 3: IR Metrics Tests
  test('calculates correct IR evaluation metrics', () => {
    const { calcMetrics } = require('./search.js');
    const retrieved = ['doc1', 'doc2', 'doc3'];
    const relevance = { doc1: 3, doc3: 1 };
    
    const metrics = calcMetrics(retrieved, relevance, 2);
    
    // Precision@2 should be 1/2 (since doc1 is relevant, doc2 is not)
    assert.equal(metrics.precision, 0.5);
    // Recall@2 should be 1/2 (since total relevant is 2, doc1 is retrieved in top 2)
    assert.equal(metrics.recall, 0.5);
    // MRR is 1.0 since doc1 (first relevant) is at rank 1
    assert.equal(metrics.mrr, 1.0);
    // nDCG@2 should be positive
    assert.ok(metrics.ndcg > 0);
  });

  // Edge Cases
  test('handles edge cases gracefully: empty query, no matches, ties', () => {
    const { hybridSearch } = require('./search.js');
    
    // Empty query
    const resEmpty = hybridSearch('');
    assert.equal(resEmpty.length, 0);

    // No matches query
    const resNoMatch = hybridSearch('apples and oranges');
    assert.equal(resNoMatch.length, 0);

    // Ties in RRF scoring stay stable
    const { rrfFuse } = require('./search.js');
    const bm25List = [{ id: 'doc1' }, { id: 'doc2' }];
    const cosineList = [{ id: 'doc2' }, { id: 'doc1' }];
    const fused = rrfFuse(bm25List, cosineList, 1.0, 1.0);
    assert.equal(fused.length, 2);
  });

  // CLI Integration
  test('CLI search command outputs results', () => {
    const res = runCli(['search', 'climbing']);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /doc1/);
  });

  test('CLI eval command outputs benchmark comparison', () => {
    const res = runCli(['eval']);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /Benchmark Comparison/);
  });

  test('HTTP server serves mini-dashboard on port 3000', async () => {
    // Start server in background
    const serverProcess = spawn(process.execPath, [SEARCH_JS, 'serve'], {
      cwd: __dirname,
      env: {
        ...process.env,
        SEARCH_DOCS: tempDocsPath,
        SEARCH_QUERIES: tempQueriesPath
      }
    });

    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
    });

    // Wait a brief moment for server to bind
    await new Promise(r => setTimeout(r, 1000));

    try {
      // Request dashboard page
      await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:3000/', (res) => {
          try {
            assert.equal(res.statusCode, 200);
            assert.match(res.headers['content-type'], /text\/html/);
            resolve();
          } catch (e) {
            reject(e);
          }
        });

        req.on('error', (err) => {
          reject(new Error(`Could not connect to server: ${err.message}`));
        });
      });
    } finally {
      // Cleanup process
      serverProcess.kill();
      // Wait for process to fully terminate
      await new Promise(r => {
        serverProcess.on('exit', r);
        setTimeout(() => {
          try { serverProcess.kill('SIGKILL'); } catch (_) {}
          r();
        }, 500);
      });
    }
  });
});
