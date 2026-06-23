'use strict';

const { test, describe, beforeEach, afterEach } = require('node:test');
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

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { slugify } = require('./notes.js');

const NOTES_JS = path.join(__dirname, 'notes.js');
let currentNotesDir = '';

function runCli(args, options = {}) {
  return spawnSync(process.execPath, [NOTES_JS, ...args], {
    encoding: 'utf8',
    cwd: __dirname,
    env: { ...process.env, NOTES_DIR: currentNotesDir, ...options.env },
    ...options
  });
}

describe('Slugify', () => {
  test('converts strings to clean slug format', () => {
    assert.equal(slugify('Hello World!'), 'hello-world');
    assert.equal(slugify('My   Note 123'), 'my-note-123');
    assert.equal(slugify('---special-chars---'), 'special-chars');
  });
});

describe('CLI add command', { concurrency: false }, () => {
  beforeEach(() => {
    currentNotesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-test-'));
    process.env.NOTES_DIR = currentNotesDir;
  });

  afterEach(() => {
    try { fs.rmSync(currentNotesDir, { recursive: true, force: true }); } catch (_) {}
    delete process.env.NOTES_DIR;
  });

  test('adds note and generates correctly named markdown file with frontmatter', () => {
    const result = runCli(['add', 'My First Note', 'This is the note content.']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Added note #1: "My First Note"/);

    const expectedFile = path.join(currentNotesDir, '1-my-first-note.md');
    assert.ok(fs.existsSync(expectedFile), 'Should write file to temporary notes directory');

    const fileContent = fs.readFileSync(expectedFile, 'utf8');
    assert.match(fileContent, /title: My First Note/);
    assert.match(fileContent, /created: \d{4}-\d{2}-\d{2}/);
    assert.match(fileContent, /This is the note content\./);
  });

  test('auto-increments note IDs based on directory files', () => {
    const add1 = runCli(['add', 'First', 'Content 1']);
    assert.equal(add1.status, 0);
    const add2 = runCli(['add', 'Second', 'Content 2']);
    assert.equal(add2.status, 0);
    assert.match(add2.stdout, /Added note #2/);

    const expectedFile2 = path.join(currentNotesDir, '2-second.md');
    assert.ok(fs.existsSync(expectedFile2));
  });

  test('rejects empty title or content', () => {
    const res1 = runCli(['add', '', 'Content']);
    assert.notEqual(res1.status, 0);
    assert.match(res1.stderr, /Error: Note title cannot be empty/);

    const res2 = runCli(['add', 'Title', '   ']);
    assert.notEqual(res2.status, 0);
    assert.match(res2.stderr, /Error: Note content cannot be empty/);
  });

  test('adds note with category and tags via mock interactive prompt', () => {
    const result = runCli(['add', 'Project Plan', 'We need to design Slice 2.'], {
      input: 'work\nurgent, chore\n'
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Added note #1: "Project Plan"/);

    const expectedFile = path.join(currentNotesDir, '1-project-plan.md');
    assert.ok(fs.existsSync(expectedFile));

    const content = fs.readFileSync(expectedFile, 'utf8');
    const parsed = parseNote(content);
    assert.equal(parsed.metadata.category, 'work');
    assert.deepEqual(parsed.metadata.tags, ['urgent', 'chore']);
  });

  test('adds note with no category and tags (pressing enter directly)', () => {
    const result = runCli(['add', 'Quick Thought', 'Body content here.'], {
      input: '\n\n'
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Added note #1: "Quick Thought"/);

    const expectedFile = path.join(currentNotesDir, '1-quick-thought.md');
    assert.ok(fs.existsSync(expectedFile));

    const content = fs.readFileSync(expectedFile, 'utf8');
    const parsed = parseNote(content);
    assert.equal(parsed.metadata.category, undefined);
    assert.equal(parsed.metadata.tags, undefined);
  });
});

describe('CLI read/delete commands', { concurrency: false }, () => {
  beforeEach(() => {
    currentNotesDir = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-test-'));
    process.env.NOTES_DIR = currentNotesDir;
  });

  afterEach(() => {
    try { fs.rmSync(currentNotesDir, { recursive: true, force: true }); } catch (_) {}
    delete process.env.NOTES_DIR;
  });

  test('list shows all notes ordered by ID', () => {
    runCli(['add', 'Alpha Note', 'Short body']);
    runCli(['add', 'Beta Note', 'A somewhat longer body text that will be snippeted.']);

    const result = runCli(['list']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /\[1\] Alpha Note \(Created: \d{4}-\d{2}-\d{2}\) - Short body/);
    assert.match(result.stdout, /\[2\] Beta Note \(Created: \d{4}-\d{2}-\d{2}\) - A somewhat longer body text that will be\.\.\./);
  });

  test('list handles empty directory gracefully', () => {
    const result = runCli(['list']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /No notes found\./);
  });

  test('show prints note title, metadata, and full body content', () => {
    runCli(['add', 'Hello', 'First line.\nSecond line.']);
    
    const result = runCli(['show', '1']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Title: Hello/);
    assert.match(result.stdout, /Created: \d{4}-\d{2}-\d{2}/);
    assert.match(result.stdout, /First line\.\nSecond line\./);
  });

  test('show on non-existent note returns error and exits 1', () => {
    const result = runCli(['show', '99']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Error: Note #99 not found\./);
  });

  test('delete removes note file from directory', () => {
    runCli(['add', 'Deleteme', 'Content']);
    const expectedFile = path.join(currentNotesDir, '1-deleteme.md');
    assert.ok(fs.existsSync(expectedFile));

    const result = runCli(['delete', '1']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Deleted note #1: "Deleteme"/);
    assert.ok(!fs.existsSync(expectedFile), 'File should be removed');
  });

  test('delete on non-existent note returns error and exits 1', () => {
    const result = runCli(['delete', '99']);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Error: Note #99 not found\./);
  });

  test('list --category filters notes by category (case-insensitive)', () => {
    runCli(['add', 'Note A', 'Body'], { input: 'work\n\n' });
    runCli(['add', 'Note B', 'Body'], { input: 'personal\n\n' });

    const result = runCli(['list', '--category', 'WORK']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Note A/);
    assert.doesNotMatch(result.stdout, /Note B/);
  });

  test('list --tag filters notes by tag (case-insensitive)', () => {
    runCli(['add', 'Note A', 'Body'], { input: '\nurgent\n' });
    runCli(['add', 'Note B', 'Body'], { input: '\nchore\n' });

    const result = runCli(['list', '--tag', 'URGENT']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Note A/);
    assert.doesNotMatch(result.stdout, /Note B/);
  });

  test('list filters by both category and tag combined', () => {
    runCli(['add', 'Match', 'Body'], { input: 'work\nurgent\n' });
    runCli(['add', 'Wrong Tag', 'Body'], { input: 'work\nchore\n' });
    runCli(['add', 'Wrong Category', 'Body'], { input: 'personal\nurgent\n' });

    const result = runCli(['list', '--category', 'work', '--tag', 'urgent']);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Match/);
    assert.doesNotMatch(result.stdout, /Wrong Tag/);
    assert.doesNotMatch(result.stdout, /Wrong Category/);
  });

  test('list rejects missing filter values', () => {
    const res1 = runCli(['list', '--category']);
    assert.notEqual(res1.status, 0);
    assert.match(res1.stderr, /Usage:/);

    const res2 = runCli(['list', '--tag']);
    assert.notEqual(res2.status, 0);
    assert.match(res2.stderr, /Usage:/);
  });
});


