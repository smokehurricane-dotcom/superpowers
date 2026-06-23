'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseNote(content) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const metadata = {};
  let bodyLines = [];
  
  if (lines[0] !== '---') {
    return { metadata: {}, body: content };
  }

  let state = 'FRONTMATTER';
  let currentKey = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];

    if (state === 'FRONTMATTER') {
      if (line === '---') {
        state = 'BODY';
        continue;
      }

      // Check for array items: - item
      const arrayMatch = line.match(/^\s*-\s+(.*)$/);
      if (arrayMatch && currentKey) {
        if (!Array.isArray(metadata[currentKey])) {
          metadata[currentKey] = [];
        }
        metadata[currentKey].push(arrayMatch[1].trim());
        continue;
      }

      // Check for key: value
      const keyValMatch = line.match(/^([^:]+):\s*(.*)$/);
      if (keyValMatch) {
        currentKey = keyValMatch[1].trim();
        const val = keyValMatch[2].trim();
        if (val === '') {
          metadata[currentKey] = [];
        } else {
          metadata[currentKey] = val;
        }
      }
    } else {
      bodyLines.push(line);
    }
  }

  return {
    metadata,
    body: bodyLines.join('\n')
  };
}

function serializeNote(note) {
  const { metadata, body } = note;
  const keys = Object.keys(metadata);
  if (keys.length === 0) {
    return body;
  }

  const lines = ['---'];
  for (const key of keys) {
    const val = metadata[key];
    if (Array.isArray(val)) {
      lines.push(`${key}:`);
      for (const item of val) {
        lines.push(`  - ${item}`);
      }
    } else {
      lines.push(`${key}: ${val}`);
    }
  }
  lines.push('---');
  if (body) {
    lines.push(body);
  }
  return lines.join('\n');
}

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getNotesDir() {
  const dir = process.env.NOTES_DIR || path.join(__dirname, 'notes');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getNextId() {
  const dir = getNotesDir();
  const files = fs.readdirSync(dir);
  let maxId = 0;
  for (const file of files) {
    const match = file.match(/^(\d+)-.*\.md$/);
    if (match) {
      const id = parseInt(match[1], 10);
      if (id > maxId) {
        maxId = id;
      }
    }
  }
  return maxId + 1;
}

function createNote(title, content) {
  if (!title || title.trim() === '') {
    process.stderr.write('Error: Note title cannot be empty.\n');
    return null;
  }
  if (!content || content.trim() === '') {
    process.stderr.write('Error: Note content cannot be empty.\n');
    return null;
  }
  const id = getNextId();
  const slug = slugify(title);
  const filename = `${id}-${slug}.md`;
  const filepath = path.join(getNotesDir(), filename);

  const created = new Date().toISOString().slice(0, 10);
  const note = {
    metadata: { title, created },
    body: content
  };

  fs.writeFileSync(filepath, serializeNote(note), 'utf8');
  console.log(`Added note #${id}: "${title}"`);
  return { id, filepath, title };
}

// CLI Routing
if (require.main === module) {
  const cliArgs = process.argv.slice(2);
  const command = cliArgs[0];
  const args = cliArgs.slice(1);

  if (command === 'add') {
    if (args.length < 2) {
      process.stderr.write('Usage: node notes.js add "<title>" "<content>"\n');
      process.exit(1);
    }
    const note = createNote(args[0], args[1]);
    if (!note) process.exit(1);
  }
}

module.exports = { parseNote, serializeNote, slugify, getNotesDir, getNextId, createNote };
