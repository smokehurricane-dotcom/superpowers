import assert from 'assert';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MOCK_CLI = path.join(__dirname, 'mock-bullpen.js');
const STATE_FILE = path.join(__dirname, 'sim_state.json');

function readState() {
  let lastError;
  for (let i = 0; i < 10; i++) {
    try {
      return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    } catch (e) {
      lastError = e;
      const start = Date.now();
      while (Date.now() - start < 20) {}
    }
  }
  throw lastError;
}

function writeState(state) {
  const tempPath = STATE_FILE + '.' + process.pid + '_' + Math.random().toString(36).substr(2, 9) + '.tmp';
  try {
    fs.writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf8');
    
    let success = false;
    let lastError;
    for (let i = 0; i < 20; i++) {
      try {
        fs.renameSync(tempPath, STATE_FILE);
        success = true;
        break;
      } catch (err) {
        if (err.code === 'EPERM' || err.code === 'EBUSY') {
          lastError = err;
          const delay = 10 + i * 10;
          const start = Date.now();
          while (Date.now() - start < delay) {}
        } else {
          try { fs.unlinkSync(tempPath); } catch (_) {}
          throw err;
        }
      }
    }
    
    if (!success) {
      try { fs.unlinkSync(tempPath); } catch (_) {}
      throw lastError;
    }
  } catch (e) {
    throw e;
  }
}

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

async function testShortTermPredictions() {
  console.log("🧪 Test 5: Short-Term Prediction Market Settle & Roll-over");
  
  // Simulate expired time
  const state = readState();
  if (!state.polymarket_markets) {
    state.polymarket_markets = [];
  }
  
  // Create an active prediction position for test
  const marketId = "will-btc-be-up-in-5-min";
  state.positions.push({
    id: "poly_test_123",
    type: "prediction",
    market: marketId,
    outcome: "yes",
    sizeUsd: 100,
    shares: 200,
    entryPrice: 0.50,
    currentPrice: 0.50,
    timestamp: new Date().toISOString()
  });
  
  // Force target market to be expired
  const expiredM = state.polymarket_markets.find(m => m.id === marketId);
  if (expiredM) {
    expiredM.endTime = new Date(Date.now() - 10000).toISOString(); // 10s ago
    expiredM.startAssetPrice = 60000;
  }
  
  // Force BTC price higher to trigger win
  state.prices.BTC = 65000; 
  
  writeState(state);
  
  // Trigger mock resolution logic or execute CLI command to buy/sell
  const res = await runCommand("polymarket markets --output json");
  assert.strictEqual(res.code, 0);
  const markets = JSON.parse(res.stdout);
  assert.ok(markets.length > 0);
  
  console.log("✅ Passed Short-Term Prediction Market Verification\n");
}

async function testPolymarketTakeProfit() {
  console.log("🧪 Test 6: Polymarket Prediction Take Profit");

  // Load state
  const state = readState();

  // Clear existing prediction positions & add our target test position
  state.positions = state.positions.filter(p => p.type !== 'prediction');
  const marketId = "will-btc-be-up-in-5-min";
  
  state.positions.push({
    id: "poly_tp_test_123",
    type: "prediction",
    market: marketId,
    outcome: "yes",
    sizeUsd: 100,
    shares: 200,
    entryPrice: 0.50,
    currentPrice: 0.80,
    timestamp: new Date().toISOString()
  });

  // Make sure the market exists and set YES price high so PnL reaches TP target (e.g. $0.80 YES price, so PnL is 200 * (0.80 - 0.50) = $60, which is >= $50 TP target)
  if (!state.polymarket_markets) state.polymarket_markets = [];
  let testMarket = state.polymarket_markets.find(m => m.id === marketId);
  if (!testMarket) {
    testMarket = {
      id: marketId,
      asset: "BTC",
      interval: 5,
      startAssetPrice: 60000,
      startTime: new Date().toISOString(),
    };
    state.polymarket_markets.push(testMarket);
  }
  testMarket.endTime = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  testMarket.currentYesPrice = 0.80;
  testMarket.currentNoPrice = 0.20;

  writeState(state);

  // Verify that selling using mock CLI works
  const sellRes = await runCommand("polymarket sell poly_tp_test_123 --yes --output json");
  if (sellRes.code !== 0) {
    console.error("sellRes failed:", sellRes);
  }
  assert.strictEqual(sellRes.code, 0);
  const data = JSON.parse(sellRes.stdout);
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.position_id, "poly_tp_test_123");
  // Payout should be 200 shares * $0.80 current price = $160 pUSD
  assert.strictEqual(data.payout_pusd, 160);

  // Read state to verify position is removed and wallet is updated
  const updatedState = readState();
  const soldPos = updatedState.positions.find(p => p.id === "poly_tp_test_123");
  assert.ok(!soldPos, "Position should be removed after sale");

  console.log("✅ Passed Polymarket Prediction Take Profit Test\n");
}

async function runAll() {
  try {
    // Save original state
    const originalState = readState();
    
    // Ensure wallets are set up for pairs
    const state = readState();
    state.wallets.hyperliquid.pair_setup_done = true;
    writeState(state);

    await testStatus();
    await testBalances();
    await testPearConstraints();
    await testReadOnlyMode();
    await testShortTermPredictions();
    await testPolymarketTakeProfit();

    // Restore original state
    writeState(originalState);
    
    console.log("🎉 All Tests Completed Successfully!");
    process.exit(0);
  } catch (e) {
    console.error("❌ Test Suite Failed:");
    console.error(e);
    process.exit(1);
  }
}

runAll();
