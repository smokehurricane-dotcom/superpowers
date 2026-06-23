'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STORE = path.join(__dirname, 'expenses.json');

function getStorePath() {
  return process.env.EXPENSES_STORE || DEFAULT_STORE;
}

function readStore() {
  const storePath = getStorePath();
  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    return [];
  }
}

function writeStore(expenses) {
  const storePath = getStorePath();
  fs.writeFileSync(storePath, JSON.stringify(expenses, null, 2), 'utf8');
}

function addExpense(amountStr, description, category) {
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    process.stderr.write('Error: Amount must be a positive number.\n');
    return null;
  }
  if (!description || description.trim() === '') {
    process.stderr.write('Error: Description cannot be empty.\n');
    return null;
  }
  if (!category || category.trim() === '') {
    process.stderr.write('Error: Category cannot be empty.\n');
    return null;
  }

  const expenses = readStore();
  const id = expenses.reduce((max, e) => Math.max(max, e.id), 0) + 1;
  const date = new Date().toISOString().slice(0, 10);
  const expense = {
    id,
    amount,
    description: description.trim(),
    category: category.trim().toLowerCase(),
    date
  };

  expenses.push(expense);
  writeStore(expenses);
  console.log(`Added expense #${id}: ${expense.description} ($${expense.amount.toFixed(2)})`);
  return expense;
}

function listExpenses() {
  const expenses = readStore();
  if (expenses.length === 0) {
    console.log('No expenses found.');
    return;
  }
  expenses.sort((a, b) => a.id - b.id);
  for (const e of expenses) {
    console.log(`[${e.id}] ${e.date} - ${e.description} (${e.category}): $${e.amount.toFixed(2)}`);
  }
}

function deleteExpense(idStr) {
  const id = parseInt(idStr, 10);
  if (isNaN(id) || !Number.isInteger(id)) {
    process.stderr.write('Error: ID must be an integer.\n');
    return false;
  }
  const expenses = readStore();
  const index = expenses.findIndex(e => e.id === id);
  if (index === -1) {
    process.stderr.write(`Error: Expense #${id} not found.\n`);
    return false;
  }
  const [removed] = expenses.splice(index, 1);
  writeStore(expenses);
  console.log(`Deleted expense #${id}: ${removed.description}`);
  return true;
}

function printSummary() {
  const expenses = readStore();
  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  console.log(`Total Expenses: $${total.toFixed(2)}`);
}

function runCliMain() {
  const cliArgs = process.argv.slice(2);
  const command = cliArgs[0];
  const args = cliArgs.slice(1);

  switch (command) {
    case 'add': {
      if (args.length < 3) {
        process.stderr.write('Usage: node tracker.js add <amount> "<description>" "<category>"\n');
        process.exit(1);
      }
      const ok = addExpense(args[0], args[1], args[2]);
      if (!ok) process.exit(1);
      break;
    }
    case 'list': {
      listExpenses();
      break;
    }
    case 'delete': {
      if (args.length < 1) {
        process.stderr.write('Usage: node tracker.js delete <id>\n');
        process.exit(1);
      }
      const ok = deleteExpense(args[0]);
      if (!ok) process.exit(1);
      break;
    }
    case 'summary': {
      printSummary();
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\nUsage: node tracker.js add|list|delete|summary\n`);
      process.exit(1);
  }
}

if (require.main === module) {
  runCliMain();
}

module.exports = { addExpense, listExpenses, deleteExpense, printSummary };
