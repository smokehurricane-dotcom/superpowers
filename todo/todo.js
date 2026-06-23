'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_STORE = path.join(__dirname, 'todos.json');

const VALID_PRIORITIES = ['high', 'normal', 'low'];

function parseDueDate(dateString) {
  if (typeof dateString !== 'string') return null;
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() + 1 !== month ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

function validatePriority(priority) {
  if (!VALID_PRIORITIES.includes(priority)) {
    process.stderr.write(`Error: Invalid priority "${priority}". Valid priorities are: ${VALID_PRIORITIES.join(', ')}.\n`);
    return false;
  }
  return true;
}

function getStorePath(storePath) {
  if (!storePath || storePath === DEFAULT_STORE) {
    return process.env.TODO_STORE || DEFAULT_STORE;
  }
  return storePath;
}

function readStore(storePath) {
  const resolvedPath = getStorePath(storePath);
  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      process.stderr.write(`Error: Store file ${resolvedPath} is corrupted (expected an array).\n`);
      return [];
    }
    return parsed;
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    if (err instanceof SyntaxError) {
      process.stderr.write(`Error: Store file ${resolvedPath} contains invalid JSON.\n`);
      return [];
    }
    throw err;
  }
}

function writeStore(storePath, todos) {
  const resolvedPath = getStorePath(storePath);
  fs.writeFileSync(resolvedPath, JSON.stringify(todos, null, 2), 'utf8');
}

function createTodo(text, priority = 'normal', storePath = DEFAULT_STORE, due = undefined) {
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
  if (due !== undefined) {
    todo.due = due;
  }
  todos.push(todo);
  writeStore(storePath, todos);
  console.log(`Added #${id}: ${text} [${priority}]`);
  return todo;
}

function add(text, storePath = DEFAULT_STORE) {
  return createTodo(text, 'normal', storePath);
}

function list(options = {}, storePath = DEFAULT_STORE) {
  if (typeof options === 'string') {
    storePath = options;
    options = {};
  }
  let todos = readStore(storePath);
  if (options.done === true) {
    todos = todos.filter(t => t.done);
  }
  if (options.pending === true) {
    todos = todos.filter(t => !t.done);
  }
  if (options.priority) {
    todos = todos.filter(t => (t.priority || 'normal') === options.priority);
  }
  if (options.overdue === true) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    todos = todos.filter(t => {
      if (!t.due) return false;
      const due = new Date(t.due + 'T00:00:00Z');
      return due < today;
    });
  }
  if (options.sort === 'due') {
    todos = todos.slice().sort((a, b) => {
      if (!a.due && !b.due) return 0;
      if (!a.due) return 1;
      if (!b.due) return -1;
      return new Date(a.due + 'T00:00:00Z') - new Date(b.due + 'T00:00:00Z');
    });
  }
  if (todos.length === 0) {
    console.log('No todos yet.');
  } else {
    for (const todo of todos) {
      const status = todo.done ? 'x' : ' ';
      const priority = todo.priority || 'normal';
      const dueSuffix = todo.due ? ` (due: ${todo.due})` : '';
      console.log(`[${todo.id}] [${status}] [${priority}] ${todo.text}${dueSuffix}`);
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
      let due = undefined;
      const textArgs = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--priority') {
          if (i + 1 >= args.length) {
            process.stderr.write('Usage: node todo.js add "text" [--priority high|normal|low] [--due YYYY-MM-DD]\n');
            process.exit(1);
          }
          priority = args[i + 1];
          i++;
        } else if (args[i] === '--due') {
          if (i + 1 >= args.length) {
            process.stderr.write('Usage: node todo.js add "text" [--priority high|normal|low] [--due YYYY-MM-DD]\n');
            process.exit(1);
          }
          const parsed = parseDueDate(args[i + 1]);
          if (!parsed) {
            process.stderr.write(`Error: Invalid date "${args[i + 1]}". Use YYYY-MM-DD.\n`);
            process.exit(1);
          }
          due = args[i + 1];
          i++;
        } else {
          textArgs.push(args[i]);
        }
      }
      const text = textArgs.join(' ');
      const todo = createTodo(text, priority, DEFAULT_STORE, due);
      if (!todo) process.exit(1);
      break;
    }
    case 'list': {
      const options = {};
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--done') {
          options.done = true;
        } else if (args[i] === '--pending') {
          options.pending = true;
        } else if (args[i] === '--priority') {
          if (i + 1 >= args.length) {
            process.stderr.write('Usage: node todo.js list [--done|--pending] [--priority high|normal|low] [--sort due] [--overdue]\n');
            process.exit(1);
          }
          options.priority = args[i + 1];
          i++;
        } else if (args[i] === '--sort') {
          if (i + 1 >= args.length) {
            process.stderr.write('Usage: node todo.js list [--done|--pending] [--priority high|normal|low] [--sort due] [--overdue]\n');
            process.exit(1);
          }
          options.sort = args[i + 1];
          i++;
        } else if (args[i] === '--overdue') {
          options.overdue = true;
        } else {
          process.stderr.write(`Unknown list option: ${args[i]}\nUsage: node todo.js list [--done|--pending] [--priority high|normal|low] [--sort due] [--overdue]\n`);
          process.exit(1);
        }
      }
      if (options.priority && !validatePriority(options.priority)) {
        process.exit(1);
      }
      list(options);
      break;
    }
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
