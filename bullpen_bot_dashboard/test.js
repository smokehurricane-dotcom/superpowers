import assert from 'assert';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOCK_CLI = path.join(__dirname, 'mock-bullpen.js');
const STATE_FILE = path.join(__dirname, 'sim_state.json');

console.log("🚀 Starting Bullpen Trading Bot Verification Tests...\n");

function runCommand(args) {
  return new Promise((resolve) => {
    exec(`node "${MOCK_CLI}" ${args}`, (error, stdout, stderr) => {
      resolve({
        code: error ? error.code : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });
  });
}

async function testStatus() {
  console.log("🧪 Test 1: CLI Status Command");
  const res = await runCommand("status --output json");
  assert.strictEqual(res.code, 0);
  const data = JSON.parse(res.stdout);
  assert.strictEqual(data.status, "authenticated");
  assert.strictEqual(data.session_valid, true);
  console.log("✅ Passed Status Command Test\n");
}

async function testBalances() {
  console.log("🧪 Test 2: CLI Portfolio Balances Command");
  const res = await runCommand("portfolio balances --output json");
  assert.strictEqual(res.code, 0);
  const data = JSON.parse(res.stdout);
  assert.ok(data.solana);
  assert.ok(data.hyperliquid);
  assert.ok(data.aggregated_balance_usd > 0);
  console.log("✅ Passed Portfolio Balances Test\n");
}

async function testPearConstraints() {
  console.log("🧪 Test 3: Pear Pair Constraints (Weight & Size)");
  
  // Test invalid weight sum (0.5 + 0.6 = 1.1)
  const res1 = await runCommand("hl pair open --long BTC=0.5 --short ETH=0.6 --size-usd 22 --preview --output json");
  assert.notStrictEqual(res1.code, 0);
  assert.ok(res1.stderr.includes("must equal 1.0 exactly"));

  // Test invalid size (legs count is 2, minimum size is 22. Let's try 15)
  const res2 = await runCommand("hl pair open --long BTC=0.5 --short ETH=0.5 --size-usd 15 --preview --output json");
  assert.notStrictEqual(res2.code, 0);
  assert.ok(res2.stderr.includes("constraints violated: Notional value"));

  // Test valid preview
  const res3 = await runCommand("hl pair open --long BTC=0.5 --short ETH=0.5 --size-usd 22 --preview --output json");
  assert.strictEqual(res3.code, 0);
  const data = JSON.parse(res3.stdout);
  assert.strictEqual(data.preview, true);
  assert.strictEqual(data.legs.length, 2);
  
  console.log("✅ Passed Pear Pair Constraints Tests\n");
}

async function testReadOnlyMode() {
  console.log("🧪 Test 4: CLI Read-Only Restrictions");
  
  // Set environment variable to simulate read-only
  process.env.BULLPEN_READ_ONLY = '1';
  
  const res = await runCommand("hl pair open --long BTC=0.5 --short ETH=0.5 --size-usd 22 --yes --output json");
  assert.notStrictEqual(res.code, 0);
  assert.ok(res.stderr.includes("Bullpen is in READ-ONLY mode"));
  
  // Reset environment variable
  delete process.env.BULLPEN_READ_ONLY;
  
  console.log("✅ Passed Read-Only Mode Test\n");
}

async function runAll() {
  try {
    // Save original state
    const originalState = fs.readFileSync(STATE_FILE, 'utf8');
    
    // Ensure wallets are set up for pairs
    const state = JSON.parse(originalState);
    state.wallets.hyperliquid.pair_setup_done = true;
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

    await testStatus();
    await testBalances();
    await testPearConstraints();
    await testReadOnlyMode();

    // Restore original state
    fs.writeFileSync(STATE_FILE, originalState, 'utf8');
    
    console.log("🎉 All Tests Completed Successfully!");
    process.exit(0);
  } catch (e) {
    console.error("❌ Test Suite Failed:");
    console.error(e);
    process.exit(1);
  }
}

runAll();
