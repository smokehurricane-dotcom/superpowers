'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STORE = path.join(__dirname, 'todos.json');

function readStore(storePath) {
  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }
}

function writeStore(storePath, todos) {
  fs.writeFileSync(storePath, JSON.stringify(todos, null, 2), 'utf8');
}

function add(text, storePath = DEFAULT_STORE) {
  if (!text || text.trim() === '') {
    process.stderr.write('Error: Todo text cannot be empty.\n');
    return null;
  }
  const todos = readStore(storePath);
  const id = Math.max(0, ...todos.map(t => t.id)) + 1;
  const todo = { id, text, done: false };
  todos.push(todo);
  writeStore(storePath, todos);
  console.log(`Added #${id}: ${text}`);
  return todo;
}

function list(storePath = DEFAULT_STORE) {
  const todos = readStore(storePath);
  if (todos.length === 0) {
    console.log('No todos yet.');
  } else {
    for (const todo of todos) {
      const status = todo.done ? 'x' : ' ';
      console.log(`[${todo.id}] [${status}] ${todo.text}`);
    }
  }
  return todos;
}

function markDone(id, storePath = DEFAULT_STORE) {
  const todos = readStore(storePath);
  const todo = todos.find(t => t.id === id);
  if (!todo) return null;
  todo.done = true;
  writeStore(storePath, todos);
  console.log(`Done #${id}: ${todo.text}`);
  return todo;
}

if (require.main === module) {
  const [,, command, ...args] = process.argv;
  switch (command) {
    case 'add': {
      const todo = add(args.join(' '));
      if (!todo) process.exit(1);
      break;
    }
    case 'list':
      list();
      break;
    case 'done':
      markDone(Number(args[0]));
      break;
    case 'delete': {
      const id = Number(args[0]);
      if (args[0] === undefined || Number.isNaN(id)) {
        process.stderr.write('Usage: node todo.js delete <id>\n');
        process.exit(1);
      }
      const removed = removeTodo(id);
      if (!removed) {
        process.stderr.write(`Todo #${id} not found.\n`);
        process.exit(1);
      }
      break;
    }
    case 'edit': {
      const id = Number(args[0]);
      const text = args.slice(1).join(' ');
      if (args[0] === undefined || Number.isNaN(id)) {
        process.stderr.write('Usage: node todo.js edit <id> "text"\n');
        process.exit(1);
      }
      const updated = editTodo(id, text);
      if (!updated) {
        process.stderr.write(`Todo #${id} not found.\n`);
        process.exit(1);
      }
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\nUsage: node todo.js add|list|done|delete|edit\n`);
      process.exit(1);
  }
}

function removeTodo(id, storePath = DEFAULT_STORE) {
  const todos = readStore(storePath);
  const index = todos.findIndex(t => t.id === id);
  if (index === -1) return null;
  const [removed] = todos.splice(index, 1);
  writeStore(storePath, todos);
  console.log(`Deleted #${id}: ${removed.text}`);
  return removed;
}

function editTodo(id, text, storePath = DEFAULT_STORE) {
  const todos = readStore(storePath);
  const todo = todos.find(t => t.id === id);
  if (!todo) return null;
  todo.text = text;
  writeStore(storePath, todos);
  console.log(`Edited #${id}: ${text}`);
  return todo;
}

module.exports = { add, list, markDone, removeTodo, editTodo };
