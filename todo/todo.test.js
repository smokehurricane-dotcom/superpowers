'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { add, list, markDone, removeTodo, editTodo, createTodo } = require('./todo.js');

const TODO_JS = path.join(__dirname, 'todo.js');
const DEFAULT_STORE = path.join(__dirname, 'todos.json');

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
  return spawnSync(process.execPath, [TODO_JS, ...args], {
    encoding: 'utf8',
    cwd: __dirname,
    ...options,
  });
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

describe('CLI error handling', () => {
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
});

describe('CLI happy path', () => {
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
    assert.match(result.stdout, /\[1\] \[ \] Buy milk/);
    assert.match(result.stdout, /\[2\] \[ \] Walk the dog/);
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
});
