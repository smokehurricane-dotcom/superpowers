'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STORE = path.join(__dirname, 'expenses.json');
const DEFAULT_BUDGET = path.join(__dirname, '.budgetconfig.json');

function getStorePath() {
  return process.env.EXPENSES_STORE || DEFAULT_STORE;
}

function getBudgetPath() {
  return process.env.BUDGET_STORE || DEFAULT_BUDGET;
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

function readBudget() {
  const budgetPath = getBudgetPath();
  try {
    const raw = fs.readFileSync(budgetPath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (err) {
    return {};
  }
}

function writeBudget(budgets) {
  const budgetPath = getBudgetPath();
  fs.writeFileSync(budgetPath, JSON.stringify(budgets, null, 2), 'utf8');
}

function setBudget(category, limitStr) {
  if (!category || category.trim() === '') {
    process.stderr.write('Error: Category cannot be empty.\n');
    return false;
  }
  const limit = parseFloat(limitStr);
  if (isNaN(limit) || limit <= 0) {
    process.stderr.write('Error: Limit must be a positive number.\n');
    return false;
  }

  const budgets = readBudget();
  const catKey = category.trim().toLowerCase();
  budgets[catKey] = limit;
  writeBudget(budgets);
  console.log(`Budget for ${catKey} set to $${limit.toFixed(2)}`);
  return true;
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
  const catKey = category.trim().toLowerCase();
  const expense = {
    id,
    amount,
    description: description.trim(),
    category: catKey,
    date
  };

  expenses.push(expense);
  writeStore(expenses);
  console.log(`Added expense #${id}: ${expense.description} ($${expense.amount.toFixed(2)})`);

  // Check budget limit
  const budgets = readBudget();
  if (budgets[catKey] !== undefined) {
    const limit = budgets[catKey];
    const currentMonth = date.slice(0, 7); // YYYY-MM
    const currentMonthTotal = expenses
      .filter(e => e.category === catKey && e.date.slice(0, 7) === currentMonth)
      .reduce((sum, e) => sum + e.amount, 0);

    if (currentMonthTotal > limit) {
      console.log(`[WARNING] Budget limit for ${catKey} ($${limit.toFixed(2)}) exceeded! Current month total: $${currentMonthTotal.toFixed(2)}`);
    }
  }

  return expense;
}

function listExpenses(options = {}) {
  let expenses = readStore();
  if (expenses.length === 0) {
    console.log('No expenses found.');
    return;
  }

  if (options.category) {
    const cat = options.category.trim().toLowerCase();
    expenses = expenses.filter(e => e.category === cat);
  }
  if (options.month) {
    const month = options.month.trim(); // YYYY-MM
    expenses = expenses.filter(e => e.date.slice(0, 7) === month);
  }

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
      const options = {};
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--category') {
          if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
            process.stderr.write('Usage: node tracker.js list [--category <name>] [--month <YYYY-MM>]\n');
            process.exit(1);
          }
          options.category = args[i + 1];
          i++;
        } else if (args[i] === '--month') {
          if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
            process.stderr.write('Usage: node tracker.js list [--category <name>] [--month <YYYY-MM>]\n');
            process.exit(1);
          }
          options.month = args[i + 1];
          i++;
        } else {
          process.stderr.write(`Unknown option: ${args[i]}\nUsage: node tracker.js list [--category <name>] [--month <YYYY-MM>]\n`);
          process.exit(1);
        }
      }
      listExpenses(options);
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
    case 'budget': {
      if (args.length < 2) {
        process.stderr.write('Usage: node tracker.js budget <category> <limit>\n');
        process.exit(1);
      }
      const ok = setBudget(args[0], args[1]);
      if (!ok) process.exit(1);
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\nUsage: node tracker.js add|list|delete|summary|budget\n`);
      process.exit(1);
  }
}

if (require.main === module) {
  runCliMain();
}

module.exports = { addExpense, listExpenses, deleteExpense, printSummary, setBudget };
