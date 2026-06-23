'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const TRACKER_JS = path.join(__dirname, 'tracker.js');
let currentStorePath = '';
let currentBudgetPath = '';

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [TRACKER_JS, ...args], {
    encoding: 'utf8',
    cwd: __dirname,
    env: {
      ...process.env,
      EXPENSES_STORE: currentStorePath,
      BUDGET_STORE: currentBudgetPath
    },
    ...options
  });
}

function makeTempPath(prefix) {
  return path.join(os.tmpdir(), `${prefix}-test-${Math.random().toString(36).slice(2)}.json`);
}

describe('Expense Tracker Tests', { concurrency: false }, () => {
  beforeEach(() => {
    currentStorePath = makeTempPath('expenses');
    currentBudgetPath = makeTempPath('budget');
    process.env.EXPENSES_STORE = currentStorePath;
    process.env.BUDGET_STORE = currentBudgetPath;
  });

  afterEach(() => {
    try { fs.unlinkSync(currentStorePath); } catch (_) {}
    try { fs.unlinkSync(currentBudgetPath); } catch (_) {}
    delete process.env.EXPENSES_STORE;
    delete process.env.BUDGET_STORE;
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

  test('CLI list --category filters expenses by category (case-insensitive)', () => {
    runCli(['add', '10.00', 'breakfast', 'food']);
    runCli(['add', '50.00', 'fuel', 'transport']);

    const listRes = runCli(['list', '--category', 'FOOD']);
    assert.equal(listRes.status, 0);
    assert.match(listRes.stdout, /breakfast/);
    assert.doesNotMatch(listRes.stdout, /fuel/);
  });

  test('CLI list --month filters expenses by month (YYYY-MM)', () => {
    // We mock manual entries in store to test historical month filtering
    const testDate = '2026-05-15';
    const otherDate = '2026-06-20';
    
    const expenses = [
      { id: 1, amount: 10, description: 'old breakfast', category: 'food', date: testDate },
      { id: 2, amount: 50, description: 'new fuel', category: 'transport', date: otherDate }
    ];
    fs.writeFileSync(currentStorePath, JSON.stringify(expenses), 'utf8');

    const listRes = runCli(['list', '--month', '2026-05']);
    assert.equal(listRes.status, 0);
    assert.match(listRes.stdout, /old breakfast/);
    assert.doesNotMatch(listRes.stdout, /new fuel/);
  });

  test('CLI list filters by both category and month combined', () => {
    const expenses = [
      { id: 1, amount: 10, description: 'Match', category: 'food', date: '2026-05-10' },
      { id: 2, amount: 20, description: 'Wrong Cat', category: 'transport', date: '2026-05-15' },
      { id: 3, amount: 30, description: 'Wrong Month', category: 'food', date: '2026-06-01' }
    ];
    fs.writeFileSync(currentStorePath, JSON.stringify(expenses), 'utf8');

    const listRes = runCli(['list', '--category', 'food', '--month', '2026-05']);
    assert.equal(listRes.status, 0);
    assert.match(listRes.stdout, /Match/);
    assert.doesNotMatch(listRes.stdout, /Wrong Cat/);
    assert.doesNotMatch(listRes.stdout, /Wrong Month/);
  });

  test('CLI list rejects missing filter parameters', () => {
    const res1 = runCli(['list', '--category']);
    assert.notEqual(res1.status, 0);
    assert.match(res1.stderr, /Usage:/);

    const res2 = runCli(['list', '--month']);
    assert.notEqual(res2.status, 0);
    assert.match(res2.stderr, /Usage:/);
  });

  test('CLI budget command registers limit and checks limits upon addition', () => {
    // Set budget limit for category food to $15
    const budgetRes = runCli(['budget', 'food', '15.00']);
    assert.equal(budgetRes.status, 0);
    assert.match(budgetRes.stdout, /Budget for food set to \$15\.00/);

    const budgetData = JSON.parse(fs.readFileSync(currentBudgetPath, 'utf8'));
    assert.equal(budgetData.food, 15.00);

    // Add expense within budget
    const addRes1 = runCli(['add', '10.00', 'first meal', 'food']);
    assert.equal(addRes1.status, 0);
    assert.doesNotMatch(addRes1.stdout, /WARNING/);

    // Add expense exceeding budget
    const addRes2 = runCli(['add', '6.00', 'second meal', 'food']);
    assert.equal(addRes2.status, 0);
    assert.match(addRes2.stdout, /\[WARNING\] Budget limit for food \(\$15\.00\) exceeded! Current month total: \$16\.00/);
  });

  test('CLI budget command rejects invalid categories or limits', () => {
    const res1 = runCli(['budget', '', '15']);
    assert.notEqual(res1.status, 0);
    assert.match(res1.stderr, /Error:/);

    const res2 = runCli(['budget', 'food', '-10']);
    assert.notEqual(res2.status, 0);
    assert.match(res2.stderr, /Error:/);

    const res3 = runCli(['budget', 'food', 'abc']);
    assert.notEqual(res3.status, 0);
    assert.match(res3.stderr, /Error:/);
  });
});
