'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const TRACKER_JS = path.join(__dirname, 'tracker.js');
let currentStorePath = '';

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [TRACKER_JS, ...args], {
    encoding: 'utf8',
    cwd: __dirname,
    env: { ...process.env, EXPENSES_STORE: currentStorePath },
    ...options
  });
}

function makeTempPath() {
  return path.join(os.tmpdir(), `expenses-test-${Math.random().toString(36).slice(2)}.json`);
}

describe('Expense Tracker Slice 1 Core CRUD', { concurrency: false }, () => {
  beforeEach(() => {
    currentStorePath = makeTempPath();
    process.env.EXPENSES_STORE = currentStorePath;
  });

  afterEach(() => {
    try { fs.unlinkSync(currentStorePath); } catch (_) {}
    delete process.env.EXPENSES_STORE;
  });

  test('CLI add command stores expense and assigns today date', () => {
    const result = runCli(['add', '12.50', 'lunch', 'food']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Added expense #1: lunch \(\$12\.50\)/);

    const exists = fs.existsSync(currentStorePath);
    assert.ok(exists);

    const data = JSON.parse(fs.readFileSync(currentStorePath, 'utf8'));
    assert.equal(data.length, 1);
    assert.equal(data[0].id, 1);
    assert.equal(data[0].amount, 12.50);
    assert.equal(data[0].description, 'lunch');
    assert.equal(data[0].category, 'food');
    assert.match(data[0].date, /^\d{4}-\d{2}-\d{2}$/);
  });

  test('CLI add command rejects empty description/category or invalid amount', () => {
    // Empty description
    const res1 = runCli(['add', '10', '', 'food']);
    assert.notEqual(res1.status, 0);
    assert.match(res1.stderr, /Error: Description cannot be empty/);

    // Negative amount
    const res2 = runCli(['add', '-5.50', 'coffee', 'food']);
    assert.notEqual(res2.status, 0);
    assert.match(res2.stderr, /Error: Amount must be a positive number/);

    // Zero amount
    const res3 = runCli(['add', '0', 'coffee', 'food']);
    assert.notEqual(res3.status, 0);
    assert.match(res3.stderr, /Error: Amount must be a positive number/);

    // Invalid amount string
    const res4 = runCli(['add', 'abc', 'coffee', 'food']);
    assert.notEqual(res4.status, 0);
    assert.match(res4.stderr, /Error: Amount must be a positive number/);
  });

  test('CLI list shows expenses and summary prints total', () => {
    runCli(['add', '10.00', 'breakfast', 'food']);
    runCli(['add', '50.00', 'fuel', 'transport']);

    const listRes = runCli(['list']);
    assert.equal(listRes.status, 0);
    assert.match(listRes.stdout, /\[1\].*breakfast \(food\): \$10\.00/);
    assert.match(listRes.stdout, /\[2\].*fuel \(transport\): \$50\.00/);

    const summaryRes = runCli(['summary']);
    assert.equal(summaryRes.status, 0);
    assert.match(summaryRes.stdout, /Total Expenses: \$60\.00/);
  });

  test('CLI delete removes expense or exits 1 if not found', () => {
    runCli(['add', '10.00', 'breakfast', 'food']);
    
    // Delete existing
    const delRes1 = runCli(['delete', '1']);
    assert.equal(delRes1.status, 0);
    assert.match(delRes1.stdout, /Deleted expense #1: breakfast/);

    const data = JSON.parse(fs.readFileSync(currentStorePath, 'utf8'));
    assert.equal(data.length, 0);

    // Delete non-existing
    const delRes2 = runCli(['delete', '99']);
    assert.notEqual(delRes2.status, 0);
    assert.match(delRes2.stderr, /Error: Expense #99 not found/);
  });
});
