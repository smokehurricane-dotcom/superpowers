'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { add, list, markDone } = require('./todo.js');

function makeTempPath() {
  return path.join(os.tmpdir(), `todo-test-${Date.now()}-${Math.random()}.json`);
}

function cleanup(storePath) {
  try { fs.rmSync(storePath, { force: true }); } catch (_) {}
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
