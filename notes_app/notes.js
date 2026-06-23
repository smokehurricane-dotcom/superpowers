'use strict';

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

module.exports = { parseNote, serializeNote };
