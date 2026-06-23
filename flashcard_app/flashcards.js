'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');

const DEFAULT_STORE = path.join(__dirname, 'flashcards.json');

function getStorePath() {
  return process.env.FLASHCARDS_STORE || DEFAULT_STORE;
}

function readStore() {
  const storePath = getStorePath();
  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    return [];
  }
}

function writeStore(cards) {
  const storePath = getStorePath();
  fs.writeFileSync(storePath, JSON.stringify(cards, null, 2), 'utf8');
}

function addFlashcard(question, answer) {
  if (!question || question.trim() === '') {
    process.stderr.write('Error: Question cannot be empty.\n');
    return null;
  }
  if (!answer || answer.trim() === '') {
    process.stderr.write('Error: Answer cannot be empty.\n');
    return null;
  }

  const cards = readStore();
  const id = cards.reduce((max, c) => Math.max(max, c.id), 0) + 1;
  const card = {
    id,
    question: question.trim(),
    answer: answer.trim(),
    box: 1
  };

  cards.push(card);
  writeStore(cards);
  console.log(`Added flashcard #${id}`);
  return card;
}

function listFlashcards() {
  const cards = readStore();
  if (cards.length === 0) {
    console.log('No flashcards found.');
    return;
  }
  cards.sort((a, b) => a.id - b.id);
  for (const c of cards) {
    console.log(`[${c.id}] Q: ${c.question} | A: ${c.answer} (Box: ${c.box})`);
  }
}

function deleteFlashcard(idStr) {
  const id = parseInt(idStr, 10);
  if (isNaN(id) || !Number.isInteger(id)) {
    process.stderr.write('Error: ID must be an integer.\n');
    return false;
  }
  const cards = readStore();
  const index = cards.findIndex(c => c.id === id);
  if (index === -1) {
    process.stderr.write(`Error: Flashcard #${id} not found.\n`);
    return false;
  }
  const [removed] = cards.splice(index, 1);
  writeStore(cards);
  console.log(`Deleted flashcard #${id}`);
  return true;
}

function studySession(targetBox = null) {
  let cards = readStore();
  if (targetBox !== null) {
    cards = cards.filter(c => c.box === targetBox);
  }
  if (cards.length === 0) {
    console.log('No flashcards found to study.');
    return Promise.resolve();
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => {
    let resolved = false;

    // Handle close event to resolve gracefully if EOF happens
    rl.on('close', () => {
      if (!resolved) {
        resolved = true;
        console.log('\nStudy session complete!');
        resolve();
      }
    });

    function quizCards(index, correctCount, totalCount) {
      if (index >= cards.length) {
        if (!resolved) {
          resolved = true;
          rl.close();
          console.log('\nStudy session complete!');
          const rate = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
          console.log(`Success Rate: ${rate}% (${correctCount}/${totalCount})`);
          resolve();
        }
        return;
      }

      const card = cards[index];
      console.log(`\nQuestion: ${card.question}`);

      rl.question('Press Enter to reveal answer...', () => {
        console.log(`Answer: ${card.answer}`);

        function askCorrect() {
          rl.question('Correct? (y/n): ', answerInput => {
            const cleaned = answerInput.trim().toLowerCase();
            if (cleaned === 'y' || cleaned === 'n') {
              const isCorrect = cleaned === 'y';
              onAnswerReviewed(card.id, isCorrect);
              quizCards(index + 1, correctCount + (isCorrect ? 1 : 0), totalCount + 1);
            } else {
              console.log('Please enter "y" or "n".');
              askCorrect();
            }
          });
        }

        askCorrect();
      });
    }

    quizCards(0, 0, 0);
  });
}

function onAnswerReviewed(cardId, isCorrect) {
  // To be extended in Slice 2
}

async function runCliMain() {
  const cliArgs = process.argv.slice(2);
  const command = cliArgs[0];
  const args = cliArgs.slice(1);

  switch (command) {
    case 'add': {
      if (args.length < 2) {
        process.stderr.write('Usage: node flashcards.js add "<question>" "<answer>"\n');
        process.exit(1);
      }
      const ok = addFlashcard(args[0], args[1]);
      if (!ok) process.exit(1);
      break;
    }
    case 'list': {
      listFlashcards();
      break;
    }
    case 'delete': {
      if (args.length < 1) {
        process.stderr.write('Usage: node flashcards.js delete <id>\n');
        process.exit(1);
      }
      const ok = deleteFlashcard(args[0]);
      if (!ok) process.exit(1);
      break;
    }
    case 'study': {
      await studySession();
      break;
    }
    default:
      process.stderr.write(`Unknown command: ${command}\nUsage: node flashcards.js add|list|delete|study\n`);
      process.exit(1);
  }
}

if (require.main === module) {
  runCliMain().catch(err => {
    process.stderr.write(`Fatal error: ${err.message}\n`);
    process.exit(1);
  });
}

module.exports = { addFlashcard, listFlashcards, deleteFlashcard, studySession, onAnswerReviewed };
