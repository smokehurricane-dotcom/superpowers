'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const CRAG_JS = path.join(__dirname, 'crag.js');
let tempKbPath = '';
let tempWebPath = '';

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [CRAG_JS, ...args], {
    encoding: 'utf8',
    cwd: __dirname,
    env: {
      ...process.env,
      CRAG_KB: tempKbPath,
      CRAG_WEB: tempWebPath
    },
    ...options
  });
}

function makeTempPath(prefix) {
  return path.join(os.tmpdir(), `${prefix}-test-${Math.random().toString(36).slice(2)}.json`);
}

describe('Bielefeld CRAG Pipeline Tests', { concurrency: false }, () => {
  beforeEach(() => {
    tempKbPath = makeTempPath('kb');
    tempWebPath = makeTempPath('web');
    process.env.CRAG_KB = tempKbPath;
    process.env.CRAG_WEB = tempWebPath;

    // Seed mock databases
    const kbData = [
      { id: 'alpinzentrum', name: 'DAV Alpinzentrum Bielefeld', category: 'sports', content: 'DAV Alpinzentrum is located in Bielefeld-Senne. It features climbing walls.' },
      { id: 'lichtwerk', name: 'Lichtwerk', category: 'entertainment', content: 'Lichtwerk is a popular arthouse cinema situated in Ravensberger Park.' }
    ];
    const webData = [
      { keywords: ['loom', 'shopping'], content: 'Loom Bielefeld is a major shopping center downtown.' },
      { keywords: ['sparrenburg', 'castle'], content: 'Sparrenburg Castle is a historical fortress in Bielefeld.' }
    ];

    fs.writeFileSync(tempKbPath, JSON.stringify(kbData, null, 2), 'utf8');
    fs.writeFileSync(tempWebPath, JSON.stringify(webData, null, 2), 'utf8');
  });

  afterEach(() => {
    try { fs.unlinkSync(tempKbPath); } catch (_) {}
    try { fs.unlinkSync(tempWebPath); } catch (_) {}
    delete process.env.CRAG_KB;
    delete process.env.CRAG_WEB;
  });

  // Task 1 Tests: Retrieval & Scoring
  test('retrieves relevant documents with correct overlap scores', () => {
    const { retrieveDocs } = require('./crag.js');
    const results = retrieveDocs('climbing walls in Senne');
    
    assert.equal(results.length, 2);
    // DAV Alpinzentrum contains "climbing", "walls", "senne", so it must have a higher score
    assert.equal(results[0].doc.id, 'alpinzentrum');
    assert.ok(results[0].score > 0);
  });

  // Task 2 Tests: Evaluator & Refinement
  test('evaluates retrieval quality correctly based on scores', () => {
    const { evaluateRetrieval } = require('./crag.js');
    
    // High score -> CORRECT
    assert.equal(evaluateRetrieval(0.5), 'CORRECT');
    // Low score -> INCORRECT
    assert.equal(evaluateRetrieval(0.05), 'INCORRECT');
    // Mid score -> AMBIGUOUS
    assert.equal(evaluateRetrieval(0.18), 'AMBIGUOUS');
  });

  test('refines knowledge by filtering low-relevance sentences', () => {
    const { refineKnowledge } = require('./crag.js');
    const docContent = 'This sentence is about climbing. That other sentence is about cooking apples.';
    const refined = refineKnowledge(docContent, 'climbing walls');
    
    assert.match(refined, /climbing/);
    assert.doesNotMatch(refined, /apples/);
  });

  // Task 3 Tests: Corrective Web Search & Generation
  test('CLI queries local KB when document is CORRECT', () => {
    const result = runCli(['query', 'climbing walls in Senne']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /DAV Alpinzentrum/);
    assert.doesNotMatch(result.stdout, /Loom Bielefeld/);
  });

  test('CLI queries web simulator when document is INCORRECT', () => {
    // Loom is in webData, not in kbData
    const result = runCli(['query', 'loom shopping center']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Loom Bielefeld/);
    assert.doesNotMatch(result.stdout, /DAV Alpinzentrum/);
  });

  test('CLI query with --verbose displays detailed CRAG logs', () => {
    const result = runCli(['query', 'loom shopping center', '--verbose']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[EVALUATOR\] Classification: INCORRECT/);
    assert.match(result.stdout, /\[WEB SEARCH\] Triggered simulated query/);
  });
});
