'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const FLASHCARDS_JS = path.join(__dirname, 'flashcards.js');
let currentStorePath = '';

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [FLASHCARDS_JS, ...args], {
    encoding: 'utf8',
    cwd: __dirname,
    env: { ...process.env, FLASHCARDS_STORE: currentStorePath },
    ...options
  });
}

function makeTempPath() {
  return path.join(os.tmpdir(), `flashcards-test-${Math.random().toString(36).slice(2)}.json`);
}

describe('Flashcard App Slice 1 CRUD & Study', { concurrency: false }, () => {
  beforeEach(() => {
    currentStorePath = makeTempPath();
    process.env.FLASHCARDS_STORE = currentStorePath;
  });

  afterEach(() => {
    try { fs.unlinkSync(currentStorePath); } catch (_) {}
    delete process.env.FLASHCARDS_STORE;
  });

  test('CLI add command stores flashcard with default Box 1', () => {
    const result = runCli(['add', 'What is 2+2?', '4']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Added flashcard #1/);

    const exists = fs.existsSync(currentStorePath);
    assert.ok(exists);

    const data = JSON.parse(fs.readFileSync(currentStorePath, 'utf8'));
    assert.equal(data.length, 1);
    assert.equal(data[0].id, 1);
    assert.equal(data[0].question, 'What is 2+2?');
    assert.equal(data[0].answer, '4');
    assert.equal(data[0].box, 1);
  });

  test('CLI add command rejects empty questions or answers', () => {
    const res1 = runCli(['add', '', 'Answer']);
    assert.notEqual(res1.status, 0);
    assert.match(res1.stderr, /Error: Question cannot be empty/);

    const res2 = runCli(['add', 'Question', '   ']);
    assert.notEqual(res2.status, 0);
    assert.match(res2.stderr, /Error: Answer cannot be empty/);
  });

  test('CLI list command outputs question, answer and box', () => {
    runCli(['add', 'Q1', 'A1']);
    runCli(['add', 'Q2', 'A2']);

    const res = runCli(['list']);
    assert.equal(res.status, 0);
    assert.match(res.stdout, /\[1\] Q: Q1 \| A: A1 \(Box: 1\)/);
    assert.match(res.stdout, /\[2\] Q: Q2 \| A: A2 \(Box: 1\)/);
  });

  test('CLI delete command removes card or exits 1 if not found', () => {
    runCli(['add', 'Q1', 'A1']);

    const delRes1 = runCli(['delete', '1']);
    assert.equal(delRes1.status, 0);
    assert.match(delRes1.stdout, /Deleted flashcard #1/);

    const data = JSON.parse(fs.readFileSync(currentStorePath, 'utf8'));
    assert.equal(data.length, 0);

    const delRes2 = runCli(['delete', '99']);
    assert.notEqual(delRes2.status, 0);
    assert.match(delRes2.stderr, /Error: Flashcard #99 not found/);
  });

  test('CLI study command interactive session reports correct success rate', () => {
    runCli(['add', 'Q1', 'A1']);
    runCli(['add', 'Q2', 'A2']);

    // Mock interactive answers:
    // Card 1: Enter (to reveal), 'y' (correct)
    // Card 2: Enter (to reveal), 'n' (incorrect)
    const result = runCli(['study'], {
      input: '\ny\n\nn\n'
    });

    assert.equal(result.status, 0);
    assert.match(result.stdout, /Question: Q1/);
    assert.match(result.stdout, /Answer: A1/);
    assert.match(result.stdout, /Question: Q2/);
    assert.match(result.stdout, /Answer: A2/);
    assert.match(result.stdout, /Study session complete!/);
    assert.match(result.stdout, /Success Rate: 50%/);
  });
});
