'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { parseNote, serializeNote } = require('./notes.js');

describe('YAML Parser', () => {
  test('parses simple key-values and body', () => {
    const raw = '---\ntitle: Shopping List\ncreated: 2026-06-23\n---\n- Buy milk\n- Eggs';
    const parsed = parseNote(raw);
    assert.deepEqual(parsed.metadata, {
      title: 'Shopping List',
      created: '2026-06-23'
    });
    assert.equal(parsed.body, '- Buy milk\n- Eggs');
  });

  test('parses YAML array items under a key', () => {
    const raw = '---\ntitle: Task List\ntags:\n  - work\n  - urgent\n---\nDo work.';
    const parsed = parseNote(raw);
    assert.deepEqual(parsed.metadata, {
      title: 'Task List',
      tags: ['work', 'urgent']
    });
    assert.equal(parsed.body, 'Do work.');
  });

  test('parses content with no frontmatter block', () => {
    const raw = 'Just a regular text file.';
    const parsed = parseNote(raw);
    assert.deepEqual(parsed.metadata, {});
    assert.equal(parsed.body, 'Just a regular text file.');
  });

  test('serializes metadata and body back to string', () => {
    const note = {
      metadata: {
        title: 'Shopping List',
        tags: ['work', 'personal']
      },
      body: 'Get things done.'
    };
    const expected = '---\ntitle: Shopping List\ntags:\n  - work\n  - personal\n---\nGet things done.';
    assert.equal(serializeNote(note), expected);
  });
});
