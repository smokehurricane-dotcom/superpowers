'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STORE = path.join(__dirname, 'todos.json');

const VALID_PRIORITIES = ['high', 'normal', 'low'];

function validatePriority(priority) {
  if (!VALID_PRIORITIES.includes(priority)) {
    process.stderr.write(`Error: Invalid priority "${priority}". Valid priorities are: ${VALID_PRIORITIES.join(', ')}.\n`);
    return false;
  }
  return true;
}

function readStore(storePath) {
  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      process.stderr.write(`Error: Store file ${storePath} is corrupted (expected an array).\n`);
      return [];
    }
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    if (err instanceof SyntaxError) {
      process.stderr.write(`Error: Store file ${storePath} contains invalid JSON.\n`);
      return [];
    }
    throw err;
  }
}

function writeStore(storePath, todos) {
  fs.writeFileSync(storePath, JSON.stringify(todos, null, 2), 'utf8');
}

function createTodo(text, priority = 'normal', storePath = DEFAULT_STORE) {
  if (!text || text.trim() === '') {
    process.stderr.write('Error: Todo text cannot be empty.\n');
    return null;
  }
  if (!validatePriority(priority)) {
    return null;
  }
  const todos = readStore(storePath);
  const id = todos.reduce((max, t) => Math.max(max, t.id), 0) + 1;
  const todo = { id, text, done: false, priority };
  todos.push(todo);
  writeStore(storePath, todos);
  console.log(`Added #${id}: ${text} [${priority}]`);
  return todo;
}

function add(text, storePath = DEFAULT_STORE) {
  return createTodo(text, 'normal', storePath);
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
  if (!text || text.trim() === '') {
    process.stderr.write('Error: Todo text cannot be empty.\n');
    return null;
  }
  const todos = readStore(storePath);
  const todo = todos.find(t => t.id === id);
  if (!todo) return null;
  todo.text = text;
  writeStore(storePath, todos);
  console.log(`Edited #${id}: ${text}`);
  return todo;
}

if (require.main === module) {
  const [,, command, ...args] = process.argv;
  switch (command) {
    case 'add': {
      let priority = 'normal';
      const textArgs = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--priority') {
          if (i + 1 >= args.length) {
            process.stderr.write('Usage: node todo.js add "text" [--priority high|normal|low]\n');
            process.exit(1);
          }
          priority = args[i + 1];
          i++;
        } else {
          textArgs.push(args[i]);
        }
      }
      const text = textArgs.join(' ');
      const todo = createTodo(text, priority);
      if (!todo) process.exit(1);
      break;
    }
    case 'list':
      list();
      break;
    case 'done': {
      const id = Number(args[0]);
      if (args[0] === undefined || args[0].trim() === '' || !Number.isInteger(id)) {
        process.stderr.write('Usage: node todo.js done <id>\n');
        process.exit(1);
      }
      const done = markDone(id);
      if (!done) {
        process.stderr.write(`Todo #${id} not found.\n`);
        process.exit(1);
      }
      break;
    }
    case 'delete': {
      const id = Number(args[0]);
      if (args[0] === undefined || args[0].trim() === '' || !Number.isInteger(id)) {
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
      if (args[0] === undefined || args[0].trim() === '' || !Number.isInteger(id)) {
        process.stderr.write('Usage: node todo.js edit <id> "text"\n');
        process.exit(1);
      }
      if (!text || text.trim() === '') {
        process.stderr.write('Error: Todo text cannot be empty.\n');
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

module.exports = { add, createTodo, list, markDone, removeTodo, editTodo };
