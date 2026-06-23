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

function createNote(title, content, category = null, tags = []) {
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
  const metadata = { title, created };
  if (category) {
    metadata.category = category;
  }
  if (tags && tags.length > 0) {
    metadata.tags = tags;
  }

  const note = { metadata, body: content };
  fs.writeFileSync(filepath, serializeNote(note), 'utf8');
  console.log(`Added note #${id}: "${title}"`);
  return { id, filepath, title };
}

function findNoteFile(id) {
  const dir = getNotesDir();
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  const pattern = new RegExp(`^${id}-.*\\.md$`);
  const filename = files.find(f => pattern.test(f));
  return filename ? path.join(dir, filename) : null;
}

function listNotes(options = {}) {
  const dir = getNotesDir();
  if (!fs.existsSync(dir)) {
    console.log('No notes found.');
    return;
  }
  const files = fs.readdirSync(dir);
  const noteFiles = files.filter(f => /^\d+-.*\.md$/.test(f));
  if (noteFiles.length === 0) {
    console.log('No notes found.');
    return;
  }

  // Parse notes and map them with ID
  let notes = noteFiles.map(file => {
    const id = parseInt(file.split('-')[0], 10);
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const parsed = parseNote(raw);
    return { id, metadata: parsed.metadata, body: parsed.body };
  });

  // Apply filters
  if (options.category) {
    const filterCat = options.category.toLowerCase();
    notes = notes.filter(n => n.metadata.category && String(n.metadata.category).toLowerCase() === filterCat);
  }
  if (options.tag) {
    const filterTag = options.tag.toLowerCase();
    notes = notes.filter(n => {
      if (!n.metadata.tags || !Array.isArray(n.metadata.tags)) return false;
      return n.metadata.tags.some(t => String(t).toLowerCase() === filterTag);
    });
  }

  if (notes.length === 0) {
    console.log('No notes found.');
    return;
  }

  // Sort by ID ascending
  notes.sort((a, b) => a.id - b.id);

  for (const note of notes) {
    const title = note.metadata.title || 'Untitled';
    const created = note.metadata.created || 'Unknown';
    let snippet = note.body.replace(/\n/g, ' ');
    if (snippet.length > 40) {
      snippet = snippet.slice(0, 40) + '...';
    }
    console.log(`[${note.id}] ${title} (Created: ${created}) - ${snippet}`);
  }
}

function showNote(id) {
  const filepath = findNoteFile(id);
  if (!filepath) {
    process.stderr.write(`Error: Note #${id} not found.\n`);
    return false;
  }
  const raw = fs.readFileSync(filepath, 'utf8');
  const parsed = parseNote(raw);
  console.log(`Title: ${parsed.metadata.title || 'Untitled'}`);
  console.log(`Created: ${parsed.metadata.created || 'Unknown'}`);
  console.log('-------------------------');
  console.log(parsed.body);
  return true;
}

function deleteNote(id) {
  const filepath = findNoteFile(id);
  if (!filepath) {
    process.stderr.write(`Error: Note #${id} not found.\n`);
    return false;
  }
  const raw = fs.readFileSync(filepath, 'utf8');
  const parsed = parseNote(raw);
  const title = parsed.metadata.title || 'Untitled';

  fs.unlinkSync(filepath);
  console.log(`Deleted note #${id}: "${title}"`);
  return true;
}

const readline = require('node:readline');

function promptMetadata() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  return new Promise(resolve => {
    let resolved = false;
    
    rl.on('close', () => {
      if (!resolved) {
        resolved = true;
        resolve({ category: null, tags: [] });
      }
    });

    rl.question('Category (optional): ', category => {
      rl.question('Tags (comma-separated, optional): ', tagsStr => {
        if (!resolved) {
          resolved = true;
          rl.close();
          const categoryVal = category.trim() || null;
          const tags = tagsStr.trim()
            ? tagsStr.split(',').map(t => t.trim()).filter(Boolean)
            : [];
          resolve({ category: categoryVal, tags });
        }
      });
    });
  });
}

// CLI Routing
async function runCliMain() {
  const cliArgs = process.argv.slice(2);
  const command = cliArgs[0];
  const args = cliArgs.slice(1);

  switch (command) {
    case 'add': {
      if (args.length < 2) {
        process.stderr.write('Usage: node notes.js add "<title>" "<content>"\n');
        process.exit(1);
      }
      
      const { category, tags } = await promptMetadata();

      const note = createNote(args[0], args[1], category, tags);
      if (!note) process.exit(1);
      break;
    }
    case 'list': {
      const options = {};
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--category') {
          if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
            process.stderr.write('Usage: node notes.js list [--category <name>] [--tag <name>]\n');
            process.exit(1);
          }
          options.category = args[i + 1];
          i++;
        } else if (args[i] === '--tag') {
          if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
            process.stderr.write('Usage: node notes.js list [--category <name>] [--tag <name>]\n');
            process.exit(1);
          }
          options.tag = args[i + 1];
          i++;
        } else {
          process.stderr.write(`Unknown list option: ${args[i]}\nUsage: node notes.js list [--category <name>] [--tag <name>]\n`);
          process.exit(1);
        }
      }
      listNotes(options);
      break;
    }
    case 'show': {
      const id = Number(args[0]);
      if (args[0] === undefined || args[0].trim() === '' || !Number.isInteger(id)) {
        process.stderr.write('Usage: node notes.js show <id>\n');
        process.exit(1);
      }
      const ok = showNote(id);
      if (!ok) process.exit(1);
      break;
    }
    case 'delete': {
      const id = Number(args[0]);
      if (args[0] === undefined || args[0].trim() === '' || !Number.isInteger(id)) {
        process.stderr.write('Usage: node notes.js delete <id>\n');
        process.exit(1);
      }
      const ok = deleteNote(id);
      if (!ok) process.exit(1);
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\nUsage: node notes.js add|list|show|delete\n`);
      process.exit(1);
  }
}

if (require.main === module) {
  runCliMain().catch(err => {
    process.stderr.write(`Fatal: ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { parseNote, serializeNote, slugify, getNotesDir, getNextId, createNote, findNoteFile, listNotes, showNote, deleteNote };
