'use strict';

const readline = require('node:readline');
const { DiscountBot } = require('./discount');

const bot = new DiscountBot();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: 'you> ',
});

console.log('kimi discount bot online 🎸 type your bargain or "exit" to quit');
console.log('normal price $19.00 but welfare starter price is $11.99 just for showing up');
rl.prompt();

rl.on('line', (line) => {
  const input = line.trim();
  if (input === 'exit') {
    rl.close();
    return;
  }
  const result = bot.processMessage(input);
  console.log(`kimi> ${result.reply}`);
  console.log(`[tool call] ${JSON.stringify(result.toolCall)}`);
  rl.prompt();
}).on('close', () => {
  console.log('\npeace out ✌️');
  process.exit(0);
});
