'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { add, list, markDone, removeTodo, editTodo, createTodo } = require('./todo.js');

const TODO_JS = path.join(__dirname, 'todo.js');
const DEFAULT_STORE = path.join(__dirname, 'todos.json');
let currentStorePath = DEFAULT_STORE;

function makeTempPath() {
  return path.join(os.tmpdir(), `todo-test-${Date.now()}-${Math.random()}.json`);
}

function cleanup(storePath) {
  try { fs.rmSync(storePath, { force: true }); } catch (_) {}
}

function clearDefaultStore() {
  try { fs.rmSync(DEFAULT_STORE, { force: true }); } catch (_) {}
}

function runCli(args, options = {}) {
  const result = spawnSync(process.execPath, [TODO_JS, ...args], {
    encoding: 'utf8',
    cwd: __dirname,
    env: { ...process.env, TODO_STORE: currentStorePath, ...options.env },
    ...options,
  });
  return result;
}

function captureStderr(fn) {
  const originalWrite = process.stderr.write;
  let captured = '';
  process.stderr.write = (chunk) => {
    captured += chunk;
    return true;
  };
  try {
    return { result: fn(), stderr: captured };
  } finally {
    process.stderr.write = originalWrite;
  }
}

describe('todo app', { concurrency: false }, () => {
  beforeEach(() => {
    currentStorePath = makeTempPath();
    process.env.TODO_STORE = currentStorePath;
  });

  afterEach(() => {
    cleanup(currentStorePath);
    delete process.env.TODO_STORE;
  });

describe('add', () => {
  test('adds first item and returns it', () => {
    const storePath = makeTempPath();
    try {
      const item = add('Buy milk', storePath);
      assert.equal(item.id, 1);
      assert.equal(item.text, 'Buy milk');
      assert.equal(item.done, false);
    } finally {
      cleanup(storePath);
    }
  });

  test('assigns incrementing IDs', () => {
    const storePath = makeTempPath();
    try {
      add('First', storePath);
      const second = add('Second', storePath);
      assert.equal(second.id, 2);
    } finally {
      cleanup(storePath);
    }
  });

  test('persists to the store file', () => {
    const storePath = makeTempPath();
    try {
      add('Buy milk', storePath);
      const todos = list(storePath);
      assert.equal(todos.length, 1);
      assert.equal(todos[0].text, 'Buy milk');
    } finally {
      cleanup(storePath);
    }
  });

  test('rejects empty or whitespace-only text', () => {
    const storePath = makeTempPath();
    try {
      const result = add('   ', storePath);
      assert.equal(result, null);
      const todos = list(storePath);
      assert.equal(todos.length, 0);
    } finally {
      cleanup(storePath);
    }
  });
});

describe('createTodo', () => {
  test('stores priority high', () => {
    const storePath = makeTempPath();
    try {
      const item = createTodo('Buy milk', 'high', storePath);
      assert.equal(item.priority, 'high');
      const todos = list(storePath);
      assert.equal(todos[0].priority, 'high');
    } finally {
      cleanup(storePath);
    }
  });

  test('stores priority low', () => {
    const storePath = makeTempPath();
    try {
      const item = createTodo('Buy milk', 'low', storePath);
      assert.equal(item.priority, 'low');
    } finally {
      cleanup(storePath);
    }
  });

  test('defaults priority to normal', () => {
    const storePath = makeTempPath();
    try {
      const item = createTodo('Buy milk', undefined, storePath);
      assert.equal(item.priority, 'normal');
    } finally {
      cleanup(storePath);
    }
  });

  test('rejects invalid priority', () => {
    const storePath = makeTempPath();
    try {
      const { result, stderr } = captureStderr(() => createTodo('Buy milk', 'urgent', storePath));
      assert.equal(result, null);
      assert.match(stderr, /Invalid priority/);
      const todos = list(storePath);
      assert.equal(todos.length, 0);
    } finally {
      cleanup(storePath);
    }
  });

  test('rejects empty text with priority', () => {
    const storePath = makeTempPath();
    try {
      const result = createTodo('   ', 'high', storePath);
      assert.equal(result, null);
      const todos = list(storePath);
      assert.equal(todos.length, 0);
    } finally {
      cleanup(storePath);
    }
  });
});

describe('removeTodo', () => {
  test('removes a todo by ID and leaves other IDs stable', () => {
    const storePath = makeTempPath();
    try {
      add('First', storePath);
      add('Second', storePath);
      add('Third', storePath);
      const removed = removeTodo(2, storePath);
      assert.equal(removed.id, 2);
      assert.equal(removed.text, 'Second');
      const todos = list(storePath);
      assert.equal(todos.length, 2);
      assert.deepEqual(todos.map(t => t.id), [1, 3]);
      assert.deepEqual(todos.map(t => t.text), ['First', 'Third']);
    } finally {
      cleanup(storePath);
    }
  });

  test('returns the removed todo on success', () => {
    const storePath = makeTempPath();
    try {
      add('Buy milk', storePath);
      const removed = removeTodo(1, storePath);
      assert.equal(removed.id, 1);
      assert.equal(removed.text, 'Buy milk');
      assert.equal(removed.done, false);
    } finally {
      cleanup(storePath);
    }
  });

  test('returns null for unknown ID', () => {
    const storePath = makeTempPath();
    try {
      add('Only', storePath);
      const result = removeTodo(99, storePath);
      assert.equal(result, null);
      const todos = list(storePath);
      assert.equal(todos.length, 1);
    } finally {
      cleanup(storePath);
    }
  });
});

describe('editTodo', () => {
  test('updates the text of a todo by ID', () => {
    const storePath = makeTempPath();
    try {
      add('Old text', storePath);
      const updated = editTodo(1, 'New text', storePath);
      assert.equal(updated.id, 1);
      assert.equal(updated.text, 'New text');
      const todos = list(storePath);
      assert.equal(todos[0].text, 'New text');
      assert.equal(todos[0].done, false);
    } finally {
      cleanup(storePath);
    }
  });

  test('returns null for unknown ID', () => {
    const storePath = makeTempPath();
    try {
      add('Only', storePath);
      const result = editTodo(99, 'New text', storePath);
      assert.equal(result, null);
      const todos = list(storePath);
      assert.equal(todos[0].text, 'Only');
    } finally {
      cleanup(storePath);
    }
  });

  test('rejects empty or whitespace-only text', () => {
    const storePath = makeTempPath();
    try {
      add('Only', storePath);
      const result = editTodo(1, '   ', storePath);
      assert.equal(result, null);
      const todos = list(storePath);
      assert.equal(todos[0].text, 'Only');
    } finally {
      cleanup(storePath);
    }
  });
});

describe('list', () => {
  test('returns empty array when store file does not exist', () => {
    const storePath = makeTempPath(); // never created
    const todos = list(storePath);
    assert.deepEqual(todos, []);
  });

  test('returns all stored todos', () => {
    const storePath = makeTempPath();
    try {
      add('Buy milk', storePath);
      add('Walk the dog', storePath);
      const todos = list(storePath);
      assert.equal(todos.length, 2);
      assert.equal(todos[0].text, 'Buy milk');
      assert.equal(todos[1].text, 'Walk the dog');
    } finally {
      cleanup(storePath);
    }
  });

  test('returns empty array when store file contains invalid JSON', () => {
    const storePath = makeTempPath();
    try {
      fs.writeFileSync(storePath, 'not valid json', 'utf8');
      const { result, stderr } = captureStderr(() => list(storePath));
      assert.deepEqual(result, []);
      assert.match(stderr, /invalid JSON|corrupted/i);
    } finally {
      cleanup(storePath);
    }
  });

  test('returns empty array when store file contains non-array JSON', () => {
    const storePath = makeTempPath();
    try {
      fs.writeFileSync(storePath, JSON.stringify({ foo: 'bar' }), 'utf8');
      const { result, stderr } = captureStderr(() => list(storePath));
      assert.deepEqual(result, []);
      assert.match(stderr, /array|corrupted/i);
    } finally {
      cleanup(storePath);
    }
  });
});

describe('list filters', () => {
  test('filters by done status', () => {
    const storePath = makeTempPath();
    try {
      add('Pending one', storePath);
      add('Done one', storePath);
      markDone(2, storePath);
      const todos = list({ done: true }, storePath);
      assert.equal(todos.length, 1);
      assert.equal(todos[0].text, 'Done one');
      assert.equal(todos[0].done, true);
    } finally {
      cleanup(storePath);
    }
  });

  test('filters by pending status', () => {
    const storePath = makeTempPath();
    try {
      add('Pending one', storePath);
      add('Done one', storePath);
      markDone(2, storePath);
      const todos = list({ pending: true }, storePath);
      assert.equal(todos.length, 1);
      assert.equal(todos[0].text, 'Pending one');
      assert.equal(todos[0].done, false);
    } finally {
      cleanup(storePath);
    }
  });

  test('filters by priority', () => {
    const storePath = makeTempPath();
    try {
      createTodo('Low task', 'low', storePath);
      createTodo('High task', 'high', storePath);
      createTodo('Normal task', 'normal', storePath);
      const todos = list({ priority: 'high' }, storePath);
      assert.equal(todos.length, 1);
      assert.equal(todos[0].text, 'High task');
    } finally {
      cleanup(storePath);
    }
  });

  test('combines pending and priority filters', () => {
    const storePath = makeTempPath();
    try {
      createTodo('High pending', 'high', storePath);
      createTodo('High done', 'high', storePath);
      markDone(2, storePath);
      createTodo('Low pending', 'low', storePath);
      const todos = list({ pending: true, priority: 'high' }, storePath);
      assert.equal(todos.length, 1);
      assert.equal(todos[0].text, 'High pending');
    } finally {
      cleanup(storePath);
    }
  });

  test('treats legacy todos without priority as normal when filtering', () => {
    const storePath = makeTempPath();
    try {
      fs.writeFileSync(storePath, JSON.stringify([{ id: 1, text: 'Legacy task', done: false }]), 'utf8');
      const todos = list({ priority: 'normal' }, storePath);
      assert.equal(todos.length, 1);
      assert.equal(todos[0].text, 'Legacy task');
    } finally {
      cleanup(storePath);
    }
  });
});

describe('markDone', () => {
  test('marks an existing todo done by ID', () => {
    const storePath = makeTempPath();
    try {
      add('Buy milk', storePath);
      markDone(1, storePath);
      const todos = list(storePath);
      assert.equal(todos[0].done, true);
    } finally {
      cleanup(storePath);
    }
  });

  test('returns the updated todo on success', () => {
    const storePath = makeTempPath();
    try {
      add('Buy milk', storePath);
      const result = markDone(1, storePath);
      assert.equal(result.id, 1);
      assert.equal(result.text, 'Buy milk');
      assert.equal(result.done, true);
    } finally {
      cleanup(storePath);
    }
  });

  test('returns null for unknown ID', () => {
    const storePath = makeTempPath();
    try {
      const result = markDone(99, storePath);
      assert.equal(result, null);
    } finally {
      cleanup(storePath);
    }
  });

  test('does not affect other todos', () => {
    const storePath = makeTempPath();
    try {
      add('First', storePath);
      add('Second', storePath);
      markDone(1, storePath);
      const todos = list(storePath);
      assert.equal(todos[0].done, true);
      assert.equal(todos[1].done, false);
    } finally {
      cleanup(storePath);
    }
  });
});

describe('CLI error handling', { concurrency: false }, () => {
  test.afterEach(() => {
    clearDefaultStore();
  });

  test('unknown command prints error and exits 1', () => {
    const result = runCli(['badcmd']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown command/);
  });

  test('add with empty text exits 1', () => {
    const result = runCli(['add', '   ']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cannot be empty/);
  });

  test('delete with missing ID exits 1', () => {
    const result = runCli(['delete']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js delete <id>/);
  });

  test('delete with non-numeric ID exits 1', () => {
    const result = runCli(['delete', 'abc']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js delete <id>/);
  });

  test('delete with empty string ID exits 1', () => {
    const result = runCli(['delete', '']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js delete <id>/);
  });

  test('delete with float ID exits 1', () => {
    const result = runCli(['delete', '1.5']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js delete <id>/);
  });

  test('delete with unknown ID exits 1', () => {
    const result = runCli(['delete', '99']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Todo #99 not found/);
  });

  test('edit with missing ID exits 1', () => {
    const result = runCli(['edit']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js edit <id>/);
  });

  test('edit with non-numeric ID exits 1', () => {
    const result = runCli(['edit', 'abc']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js edit <id>/);
  });

  test('edit with empty string ID exits 1', () => {
    const result = runCli(['edit', '', 'foo']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js edit <id>/);
  });

  test('edit with float ID exits 1', () => {
    const result = runCli(['edit', '1.5', 'foo']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js edit <id>/);
  });

  test('edit with unknown ID exits 1', () => {
    const result = runCli(['edit', '99', 'foo']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Todo #99 not found/);
  });

  test('edit with empty text exits 1', () => {
    runCli(['add', 'Buy milk']);
    const result = runCli(['edit', '1', '   ']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /cannot be empty/);
  });

  test('done with missing ID exits 1', () => {
    const result = runCli(['done']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js done <id>/);
  });

  test('done with non-numeric ID exits 1', () => {
    const result = runCli(['done', 'abc']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js done <id>/);
  });

  test('done with empty string ID exits 1', () => {
    const result = runCli(['done', '']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js done <id>/);
  });

  test('done with float ID exits 1', () => {
    const result = runCli(['done', '1.5']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage: node todo.js done <id>/);
  });

  test('done with unknown ID exits 1', () => {
    const result = runCli(['done', '99']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Todo #99 not found/);
  });

  test('add with invalid priority exits 1', () => {
    const result = runCli(['add', 'Buy milk', '--priority', 'urgent']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid priority/);
  });

  test('add with missing priority value exits 1', () => {
    const result = runCli(['add', 'Buy milk', '--priority']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:/);
  });

  test('list with invalid priority exits 1', () => {
    const result = runCli(['list', '--priority', 'urgent']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid priority/);
  });

  test('list with missing priority value exits 1', () => {
    const result = runCli(['list', '--priority']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:/);
  });

  test('list with unknown option exits 1', () => {
    const result = runCli(['list', '--foo']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Unknown list option/);
  });
});

describe('CLI happy path', { concurrency: false }, () => {
  test.afterEach(() => {
    clearDefaultStore();
  });

  test('add prints success and persists todo', () => {
    const result = runCli(['add', 'Buy milk']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Added #1: Buy milk/);
    const todos = list(DEFAULT_STORE);
    assert.equal(todos.length, 1);
    assert.equal(todos[0].text, 'Buy milk');
    assert.equal(todos[0].done, false);
  });

  test('list prints todos', () => {
    runCli(['add', 'Buy milk']);
    runCli(['add', 'Walk the dog']);
    const result = runCli(['list']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[1\] \[ \] \[normal\] Buy milk/);
    assert.match(result.stdout, /\[2\] \[ \] \[normal\] Walk the dog/);
  });

  test('done marks todo done', () => {
    runCli(['add', 'Buy milk']);
    const result = runCli(['done', '1']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Done #1: Buy milk/);
    const todos = list(DEFAULT_STORE);
    assert.equal(todos[0].done, true);
  });

  test('delete removes todo', () => {
    runCli(['add', 'Buy milk']);
    const result = runCli(['delete', '1']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Deleted #1: Buy milk/);
    const todos = list(DEFAULT_STORE);
    assert.equal(todos.length, 0);
  });

  test('edit updates todo text', () => {
    runCli(['add', 'Old text']);
    const result = runCli(['edit', '1', 'New text']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Edited #1: New text/);
    const todos = list(DEFAULT_STORE);
    assert.equal(todos[0].text, 'New text');
  });

  test('add stores priority high via CLI', () => {
    const result = runCli(['add', 'Buy milk', '--priority', 'high']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Added #1: Buy milk/);
    const todos = list(DEFAULT_STORE);
    assert.equal(todos[0].priority, 'high');
  });

  test('list shows priority in plain output', () => {
    runCli(['add', 'Buy milk', '--priority', 'high']);
    runCli(['add', 'Walk the dog']);
    const result = runCli(['list']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[1\] \[ \] \[high\] Buy milk/);
    assert.match(result.stdout, /\[2\] \[ \] \[normal\] Walk the dog/);
  });

  test('list --done shows only done todos', () => {
    runCli(['add', 'Buy milk']);
    runCli(['add', 'Walk the dog']);
    runCli(['done', '1']);
    const result = runCli(['list', '--done']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Buy milk/);
    assert.doesNotMatch(result.stdout, /Walk the dog/);
  });

  test('list --pending shows only pending todos', () => {
    runCli(['add', 'Buy milk']);
    runCli(['add', 'Walk the dog']);
    runCli(['done', '1']);
    const result = runCli(['list', '--pending']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Walk the dog/);
    assert.doesNotMatch(result.stdout, /Buy milk/);
  });

  test('list --priority high shows only high-priority todos', () => {
    runCli(['add', 'Buy milk', '--priority', 'high']);
    runCli(['add', 'Walk the dog']);
    const result = runCli(['list', '--priority', 'high']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Buy milk/);
    assert.doesNotMatch(result.stdout, /Walk the dog/);
  });

  test('list combines --pending and --priority', () => {
    runCli(['add', 'Urgent task', '--priority', 'high']);
    runCli(['add', 'Done urgent', '--priority', 'high']);
    runCli(['done', '2']);
    runCli(['add', 'Low task', '--priority', 'low']);
    const result = runCli(['list', '--pending', '--priority', 'high']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Urgent task/);
    assert.doesNotMatch(result.stdout, /Done urgent/);
    assert.doesNotMatch(result.stdout, /Low task/);
  });
});


describe('parseDueDate (via CLI)', { concurrency: false }, () => {
  test('rejects impossible date via CLI', () => {
    const result = runCli(['add', 'Buy milk', '--due', '2026-02-31']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid date/);
    const todos = list(DEFAULT_STORE);
    assert.equal(todos.length, 0);
  });

  test('rejects non-date string via CLI', () => {
    const result = runCli(['add', 'Buy milk', '--due', 'not-a-date']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid date/);
  });
});


describe('createTodo due date', () => {
  test('stores optional due date', () => {
    const storePath = makeTempPath();
    try {
      const item = createTodo('Buy milk', 'normal', storePath, '2026-06-30');
      assert.equal(item.due, '2026-06-30');
      const todos = list(storePath);
      assert.equal(todos[0].due, '2026-06-30');
    } finally {
      cleanup(storePath);
    }
  });

  test('add without due date stores no due field', () => {
    const storePath = makeTempPath();
    try {
      const item = add('Buy milk', storePath);
      assert.equal(item.due, undefined);
      const todos = list(storePath);
      assert.equal(todos[0].due, undefined);
    } finally {
      cleanup(storePath);
    }
  });
});

describe('list sorting', () => {
  test('sorts by due date with undated todos at the end', () => {
    const storePath = makeTempPath();
    try {
      createTodo('No date', 'normal', storePath);
      createTodo('Late', 'normal', storePath, '2026-07-01');
      createTodo('Early', 'normal', storePath, '2026-06-20');
      const todos = list({ sort: 'due' }, storePath);
      assert.deepEqual(todos.map(t => t.text), ['Early', 'Late', 'No date']);
    } finally {
      cleanup(storePath);
    }
  });
});

describe('list overdue', () => {
  test('filters overdue todos', () => {
    const storePath = makeTempPath();
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyymmdd = (d) => d.toISOString().slice(0, 10);

      createTodo('Overdue', 'normal', storePath, yyyymmdd(yesterday));
      createTodo('Future', 'normal', storePath, yyyymmdd(tomorrow));
      createTodo('No date', 'normal', storePath);
      const todos = list({ overdue: true }, storePath);
      assert.equal(todos.length, 1);
      assert.equal(todos[0].text, 'Overdue');
    } finally {
      cleanup(storePath);
    }
  });

  test('combines overdue and priority filters', () => {
    const storePath = makeTempPath();
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yyyymmdd = (d) => d.toISOString().slice(0, 10);

      createTodo('Overdue high', 'high', storePath, yyyymmdd(yesterday));
      createTodo('Overdue low', 'low', storePath, yyyymmdd(yesterday));
      createTodo('Future high', 'high', storePath, '2099-01-01');
      const todos = list({ overdue: true, priority: 'high' }, storePath);
      assert.equal(todos.length, 1);
      assert.equal(todos[0].text, 'Overdue high');
    } finally {
      cleanup(storePath);
    }
  });
});

describe('CLI due date handling', { concurrency: false }, () => {
  test.afterEach(() => {
    clearDefaultStore();
  });

  test('add stores due date via CLI', () => {
    const result = runCli(['add', 'Buy milk', '--due', '2026-06-30']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Added #1: Buy milk/);
    const todos = list(DEFAULT_STORE);
    assert.equal(todos[0].due, '2026-06-30');
  });

  test('add with invalid due date exits 1', () => {
    const result = runCli(['add', 'Buy milk', '--due', '2026-02-31']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Invalid date/);
  });

  test('add with missing due date value exits 1', () => {
    const result = runCli(['add', 'Buy milk', '--due']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Usage:/);
  });

  test('list shows due date in plain output', () => {
    runCli(['add', '--due', '2026-06-30', 'Buy milk']);
    runCli(['add', 'Walk the dog']);
    const result = runCli(['list']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[1\] \[ \] \[normal\] Buy milk \(due: 2026-06-30\)/);
    assert.match(result.stdout, /\[2\] \[ \] \[normal\] Walk the dog/);
    assert.doesNotMatch(result.stdout, /Walk the dog.*due:/);
  });

  test('list --sort due sorts output', () => {
    runCli(['add', 'No date']);
    runCli(['add', '--due', '2026-07-01', 'Late']);
    runCli(['add', '--due', '2026-06-20', 'Early']);
    const result = runCli(['list', '--sort', 'due']);
    assert.equal(result.status, 0);
    const lines = result.stdout.trim().split('\n').filter(l => l.startsWith('['));
    assert.match(lines[0], /Early/);
    assert.match(lines[1], /Late/);
    assert.match(lines[2], /No date/);
  });

  test('list --overdue shows only overdue', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const yyyymmdd = (d) => d.toISOString().slice(0, 10);

    runCli(['add', '--due', yyyymmdd(yesterday), 'Overdue']);
    runCli(['add', '--due', yyyymmdd(tomorrow), 'Future']);
    runCli(['add', 'No date']);
    const result = runCli(['list', '--overdue']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Overdue/);
    assert.doesNotMatch(result.stdout, /Future/);
    assert.doesNotMatch(result.stdout, /No date/);
  });

  test('list combines --overdue and --priority', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yyyymmdd = (d) => d.toISOString().slice(0, 10);

    runCli(['add', '--due', yyyymmdd(yesterday), '--priority', 'high', 'Overdue high']);
    runCli(['add', '--due', yyyymmdd(yesterday), '--priority', 'low', 'Overdue low']);
    const result = runCli(['list', '--overdue', '--priority', 'high']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Overdue high/);
    assert.doesNotMatch(result.stdout, /Overdue low/);
  });
});

describe('CLI config handling', { concurrency: false }, () => {
  const CONFIG_PATH = path.join(__dirname, '.todoconfig.json');

  afterEach(() => {
    try { fs.rmSync(CONFIG_PATH, { force: true }); } catch (_) {}
    if (currentStorePath) {
      const ext = path.extname(currentStorePath);
      const base = currentStorePath.slice(0, -ext.length);
      try { fs.rmSync(`${base}-testproj${ext}`, { force: true }); } catch (_) {}
    }
  });

  test('respects defaultProject in .todoconfig.json', () => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify({ defaultProject: 'testproj' }), 'utf8');

    const addResult = runCli(['add', 'Buy milk']);
    assert.equal(addResult.status, 0);

    const ext = path.extname(currentStorePath);
    const base = currentStorePath.slice(0, -ext.length);
    const projectStorePath = `${base}-testproj${ext}`;
    assert.ok(fs.existsSync(projectStorePath), 'Should write to temporary project store path');
    
    const content = JSON.parse(fs.readFileSync(projectStorePath, 'utf8'));
    assert.equal(content[0].text, 'Buy milk');
  });
});

describe('CLI project handling', { concurrency: false }, () => {
  afterEach(() => {
    if (currentStorePath) {
      const ext = path.extname(currentStorePath);
      const base = currentStorePath.slice(0, -ext.length);
      try { fs.rmSync(`${base}-work${ext}`, { force: true }); } catch (_) {}
      try { fs.rmSync(`${base}-personal${ext}`, { force: true }); } catch (_) {}
    }
  });

  test('isolates different projects via --project', () => {
    const addWork = runCli(['add', 'Buy computer', '--project', 'work']);
    assert.equal(addWork.status, 0);

    const addPers = runCli(['add', 'Buy groceries', '--project', 'personal']);
    assert.equal(addPers.status, 0);

    const listWork = runCli(['list', '--project', 'work']);
    assert.equal(listWork.status, 0);
    assert.match(listWork.stdout, /Buy computer/);
    assert.doesNotMatch(listWork.stdout, /Buy groceries/);

    const listPers = runCli(['list', '--project', 'personal']);
    assert.equal(listPers.status, 0);
    assert.match(listPers.stdout, /Buy groceries/);
    assert.doesNotMatch(listPers.stdout, /Buy computer/);
  });

  test('combines --project with priority and due date', () => {
    const result = runCli(['add', 'Urgent task', '--priority', 'high', '--due', '2026-06-30', '--project', 'work']);
    assert.equal(result.status, 0);

    const listResult = runCli(['list', '--project', 'work']);
    assert.match(listResult.stdout, /high.*Urgent task.*due: 2026-06-30/);
  });

  test('rejects missing project name value', () => {
    const result = runCli(['add', 'Task', '--project']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Missing project name/);
  });
});

});
