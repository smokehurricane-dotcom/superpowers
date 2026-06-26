import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const STATE_FILE = path.join(__dirname, 'sim_state.json');
const MOCK_CLI_PATH = path.join(__dirname, 'mock-bullpen.js');

// Bot config and run-time state
let botConfig = {
  readOnly: false,
  strategies: {
    pearPair: { enabled: false, sizeUsd: 22, targetPair: "BTC/ETH", baseRatio: 18.57, deviationThreshold: 0.015 },
    spreadFarming: { enabled: false, targetMarket: "xyz:SPCX", sizeUsd: 15, spreadThreshold: 0.004 },
    momentum: { enabled: false, targetMarket: "xyz:SPCX", notional: 20, leverage: 2, tpPct: 15, slPct: 10 },
    smartMoney: { enabled: false, targetAsset: "BTC", notional: 50, leverage: 2 }
  },
  risk: {
    maxMarginUsage: 5000, // Trigger circuit breaker if margin > 5000
    previewFirst: true
  }
};

let commandLogs = [];
let signalFeed = [];

// Helper to write signal messages
function addSignal(source, text, impact = "info") {
  const signal = {
    id: "sig_" + Math.random().toString(36).substr(2, 9),
    timestamp: new Date().toISOString(),
    source,
    text,
    impact
  };
  signalFeed.unshift(signal);
  if (signalFeed.length > 50) signalFeed.pop();
  broadcast({ type: 'SIGNAL_FEED', data: signalFeed });
}

// Helper to spawn bullpen CLI commands
function runCLI(argsStr) {
  return new Promise((resolve, reject) => {
    const isReadOnly = botConfig.readOnly || process.env.BULLPEN_READ_ONLY === '1';
    let cmd = `node "${MOCK_CLI_PATH}" ${argsStr}`;
    
    if (isReadOnly && !argsStr.includes('--read-only') && (argsStr.includes('open') || argsStr.includes('setup') || argsStr.includes('close') || argsStr.includes('long') || argsStr.includes('short') || argsStr.includes('swap') || argsStr.includes('limit-buy') || argsStr.includes('cancel-all') || argsStr.includes('twap'))) {
      cmd += ' --read-only';
    }

    const startTime = Date.now();
    exec(cmd, { env: { ...process.env, BULLPEN_READ_ONLY: isReadOnly ? '1' : '0' } }, (error, stdout, stderr) => {
      const duration = Date.now() - startTime;
      const logEntry = {
        timestamp: new Date().toISOString(),
        command: `bullpen ${argsStr}`,
        exitCode: error ? error.code : 0,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        duration_ms: duration
      };
      
      commandLogs.unshift(logEntry);
      if (commandLogs.length > 100) commandLogs.pop();
      broadcast({ type: 'COMMAND_LOGS', data: commandLogs });

      if (error) {
        let errData;
        try {
          errData = JSON.parse(stderr || stdout);
        } catch(e) {
          errData = { error: stderr.trim() || stdout.trim() || error.message };
        }
        reject(errData);
      } else {
        try {
          resolve(JSON.parse(stdout));
        } catch(e) {
          resolve({ raw: stdout.trim() });
        }
      }
    });
  });
}

// Websocket Broadcasting
let wsClients = new Set();
function broadcast(msgObj) {
  const jsonStr = JSON.stringify(msgObj);
  wsClients.forEach(client => {
    if (client.readyState === 1) {
      client.send(jsonStr);
    }
  });
}

// Periodically simulated market drift
setInterval(() => {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    
    // Random walk for prices
    state.prices.BTC += (Math.random() - 0.5) * 150;
    state.prices.ETH += (Math.random() - 0.5) * 10;
    state.prices.SPCX += (Math.random() - 0.495) * 0.01; // slight upward drift for SPCX
    state.prices.SOL += (Math.random() - 0.5) * 0.5;

    // Simulate price changes on active positions
    state.positions = state.positions.map(p => {
      if (p.type === 'pair') {
        return {
          ...p,
          currentPriceLong: state.prices[p.longAsset],
          currentPriceShort: state.prices[p.shortAsset]
        };
      }
      return p;
    });

    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    
    // Broadcast portfolio and positions
    syncPortfolioState();
  } catch (e) {
    console.error("Error in market simulator interval:", e);
  }
}, 3000);

async function syncPortfolioState() {
  try {
    const balances = await runCLI("portfolio balances --output json");
    const pairStatus = await runCLI("hl pair status --output json");
    const accountStatus = await runCLI("hl status --all-dexes --output json");
    
    broadcast({
      type: 'PORTFOLIO_STATE',
      data: {
        balances,
        pairStatus,
        accountStatus,
        readOnly: botConfig.readOnly
      }
    });

    // Check risk bounds
    if (accountStatus.margin_usage_usd > botConfig.risk.maxMarginUsage) {
      triggerCircuitBreaker("Margin usage exceeded safety limits!");
    }
  } catch(e) {
    console.error("Error syncing portfolio state:", e);
  }
}

// Emergency stop circuit breaker
async function triggerCircuitBreaker(reason) {
  addSignal("RISK ENGINE", `CIRCUIT BREAKER TRIGGERED: ${reason}`, "danger");
  
  // Disable all strategies
  botConfig.strategies.pearPair.enabled = false;
  botConfig.strategies.spreadFarming.enabled = false;
  botConfig.strategies.momentum.enabled = false;
  botConfig.strategies.smartMoney.enabled = false;
  broadcast({ type: 'BOT_CONFIG', data: botConfig });

  try {
    const res = await runCLI("hl cancel-all");
    addSignal("RISK ENGINE", `Circuit Breaker executed. ${res.msg || ''}`, "warning");
    syncPortfolioState();
  } catch (e) {
    addSignal("RISK ENGINE", `Failed to execute hl cancel-all: ${e.error || e.message}`, "danger");
  }
}

// --- Strategy Algorithms ---

// 1. Pear Pair Trading Strategy Loop
async function runPearPairStrategy() {
  if (!botConfig.strategies.pearPair.enabled) return;
  
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const pConfig = botConfig.strategies.pearPair;

    // TargetPair BTC/ETH
    const ratio = state.prices.BTC / state.prices.ETH;
    const deviation = (ratio - pConfig.baseRatio) / pConfig.baseRatio;
    
    // Fetch active pair positions
    const activePairs = state.positions.filter(p => p.type === 'pair');

    if (activePairs.length === 0) {
      // Look for entries
      if (Math.abs(deviation) >= pConfig.deviationThreshold) {
        let longAsset = "BTC";
        let shortAsset = "ETH";
        let longWeight = 0.5;
        let shortWeight = 0.5;

        if (deviation > 0) {
          // BTC is overvalued relative to ETH -> Short BTC, Long ETH
          longAsset = "ETH";
          shortAsset = "BTC";
        }
        
        addSignal("PEAR PAIR", `Correlation dev ${ (deviation*100).toFixed(2) }% exceeds threshold. Initiating pair entry...`, "info");

        // Preview First Paradigm
        if (botConfig.risk.previewFirst) {
          const previewArgs = `hl pair open --long ${longAsset}=${longWeight} --short ${shortAsset}=${shortWeight} --size-usd ${pConfig.sizeUsd} --preview --output json`;
          await runCLI(previewArgs);
        }

        // Execute
        const execArgs = `hl pair open --long ${longAsset}=${longWeight} --short ${shortAsset}=${shortWeight} --size-usd ${pConfig.sizeUsd} --yes --output json`;
        const res = await runCLI(execArgs);
        addSignal("PEAR PAIR", `Market Neutral Position opened. ID: ${res.position_id}`, "success");
      }
    } else {
      // Monitor exits
      for (const pos of activePairs) {
        // Calculate original direction relative to ratio
        const currentRatio = state.prices.BTC / state.prices.ETH;
        const entryRatio = pos.longAsset === "BTC" ? (pos.entryPriceLong / pos.entryPriceShort) : (pos.entryPriceShort / pos.entryPriceLong);
        
        // Return ratio to baseline
        const curDev = (currentRatio - pConfig.baseRatio) / pConfig.baseRatio;
        if (Math.abs(curDev) <= 0.002) {
          addSignal("PEAR PAIR", `Correlation normalized. Closing pair position ${pos.id} via TWAP...`, "info");
          await runCLI(`hl pair close ${pos.id} --twap-minutes 5 --output json`);
          addSignal("PEAR PAIR", `Pair position ${pos.id} closed.`, "success");
        }
      }
    }
  } catch (e) {
    console.error("Pear Pair Strategy execution error:", e);
  }
}

// 2. HIP-3 Spread Farming Loop
async function runSpreadFarmingStrategy() {
  if (!botConfig.strategies.spreadFarming.enabled) return;

  try {
    const sfConfig = botConfig.strategies.spreadFarming;
    const ob = await runCLI(`hl orderbook ${sfConfig.targetMarket} --output json`);
    
    const bestAsk = ob.asks[0].price;
    const bestBid = ob.bids[0].price;
    const midpoint = (bestAsk + bestBid) / 2;
    const spreadPct = (bestAsk - bestBid) / midpoint;

    if (spreadPct >= sfConfig.spreadThreshold) {
      addSignal("SPREAD FARMER", `Spread is ${(spreadPct*100).toFixed(3)}%. Placing Post-Only maker orders...`, "info");
      
      const longPrice = (midpoint * 0.999).toFixed(4);
      const shortPrice = (midpoint * 1.001).toFixed(4);

      // Place ALO orders
      await runCLI(`hl long ${sfConfig.targetMarket} --limit ${longPrice} --tif alo --notional ${sfConfig.sizeUsd} --yes --output json`);
      await runCLI(`hl short ${sfConfig.targetMarket} --limit ${shortPrice} --tif alo --notional ${sfConfig.sizeUsd} --yes --output json`);
      
      addSignal("SPREAD FARMER", `Maker orders placed around midpoint $${midpoint.toFixed(4)}.`, "success");
    }
  } catch (e) {
    console.error("Spread Farming execution error:", e);
  }
}

// Run bot loops
setInterval(() => {
  runPearPairStrategy();
  runSpreadFarmingStrategy();
}, 8000);

// Simulated News Signal generator
setInterval(() => {
  if (!botConfig.strategies.momentum.enabled && !botConfig.strategies.smartMoney.enabled) return;
  
  const newsItems = [
    { source: "X FEED", text: "SPCX is trending! Massive trading volume spike on decentralized markets.", target: "SPCX", direction: "long" },
    { source: "POLYMARKET WHALES", text: "Whale Wallet '0x777' placed $120,000 YES bets on Bitcoin reaching 100k.", target: "BTC", direction: "long" },
    { source: "TELEGRAM CHANNELS", text: "Whale alerts show massive SPCX spot dumps on Hyperliquid.", target: "SPCX", direction: "short" },
    { source: "COINTELEGRAPH", text: "SEC comments on Solana DCA indexing protocols.", target: "SOL", direction: "long" }
  ];

  const item = newsItems[Math.floor(Math.random() * newsItems.length)];
  addSignal(item.source, item.text, item.direction === 'long' ? 'success' : 'warning');

  // Trigger strategies if enabled
  if (botConfig.strategies.momentum.enabled && item.target === "SPCX") {
    triggerMomentumTrade(item.target, item.direction);
  }
  if (botConfig.strategies.smartMoney.enabled && item.source === "POLYMARKET WHALES") {
    triggerSmartMoneyTrade(item.target);
  }
}, 30000);

async function triggerMomentumTrade(asset, direction) {
  const mConfig = botConfig.strategies.momentum;
  addSignal("MOMENTUM BOT", `News trigger for ${asset} (${direction}). Executing aggressive market order.`, "info");
  
  const tpPrice = direction === 'long' ? 1.50 : 1.00;
  const slPrice = direction === 'long' ? 1.10 : 1.40;

  try {
    const cmd = `hl ${direction} ${mConfig.targetMarket} --notional ${mConfig.notional} --leverage ${mConfig.leverage} --tp ${tpPrice} --sl ${slPrice} --yes --output json`;
    const res = await runCLI(cmd);
    addSignal("MOMENTUM BOT", `Trade executed. Position opened: ${res.position_id}`, "success");
  } catch (e) {
    addSignal("MOMENTUM BOT", `Trade execution failed: ${e.error || e.message}`, "danger");
  }
}

async function triggerSmartMoneyTrade(asset) {
  const smConfig = botConfig.strategies.smartMoney;
  addSignal("SMART MONEY BOT", `Whale copy trade signal on ${asset}. Placing leveraged perp position...`, "info");

  try {
    // Copy whales by going long Hyperliquid perp
    const cmd = `hl long ${asset} --notional ${smConfig.notional} --leverage ${smConfig.leverage} --yes --output json`;
    const res = await runCLI(cmd);
    addSignal("SMART MONEY BOT", `Long executed on ${asset} perp. ID: ${res.position_id}`, "success");
  } catch (e) {
    addSignal("SMART MONEY BOT", `Trade execution failed: ${e.error || e.message}`, "danger");
  }
}

// --- Express API Routes ---

app.get('/api/status', (req, res) => {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    res.json({
      botConfig,
      state,
      commandLogs,
      signalFeed
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/config', (req, res) => {
  botConfig = { ...botConfig, ...req.body };
  broadcast({ type: 'BOT_CONFIG', data: botConfig });
  res.json({ success: true, botConfig });
});

app.post('/api/action', async (req, res) => {
  const { action, params } = req.body;
  addSignal("USER ACTION", `Manual trigger: ${action}`, "info");

  try {
    if (action === 'circuit_breaker') {
      await triggerCircuitBreaker("Manual user trigger");
      return res.json({ success: true });
    }

    if (action === 'hl_setup') {
      const result = await runCLI("hl pair setup --yes --output json");
      return res.json({ success: true, result });
    }

    if (action === 'solana_swap') {
      const { tokenA, tokenB, amount } = params;
      const result = await runCLI(`solana swap ${tokenA} ${tokenB} ${amount} --yes --output json`);
      return res.json({ success: true, result });
    }

    if (action === 'hl_cancel_all') {
      const result = await runCLI("hl cancel-all --output json");
      return res.json({ success: true, result });
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    res.status(500).json({ error: e.error || e.message });
  }
});

// Websocket upgrade server
const server = app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  wsClients.add(ws);
  
  // Send initial data
  ws.send(JSON.stringify({ type: 'BOT_CONFIG', data: botConfig }));
  ws.send(JSON.stringify({ type: 'COMMAND_LOGS', data: commandLogs }));
  ws.send(JSON.stringify({ type: 'SIGNAL_FEED', data: signalFeed }));
  
  syncPortfolioState();

  ws.on('close', () => {
    wsClients.delete(ws);
  });
});
