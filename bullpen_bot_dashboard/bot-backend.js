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
    smartMoney: { enabled: false, targetAsset: "BTC", notional: 50, leverage: 2 },
    binaryMomentum: { enabled: false, targetAsset: "BTC", notional: 50, leverage: 5, durationMinutes: 5 },
    weatherHedging: { enabled: false, targetAsset: "BTC", sizeUsd: 100, probabilityThreshold: 0.70 }, // New Weather Strategy
    sportsFanToken: { enabled: false, targetToken: "CHZ", sizeUsd: 150, probabilityShiftThreshold: 0.10 } // New Sports Strategy
  },
  risk: {
    maxMarginUsage: 5000,
    previewFirst: true
  }
};

let commandLogs = [];
let signalFeed = [];
let weatherProbability = 0.50;
let sportsProbability = 0.50;

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

function runCLI(argsStr) {
  return new Promise((resolve, reject) => {
    const isReadOnly = botConfig.readOnly || process.env.BULLPEN_READ_ONLY === '1';
    let cmd = `node "${MOCK_CLI_PATH}" ${argsStr}`;
    
    if (isReadOnly && !argsStr.includes('--read-only') && (argsStr.includes('open') || argsStr.includes('setup') || argsStr.includes('close') || argsStr.includes('long') || argsStr.includes('short') || argsStr.includes('swap') || argsStr.includes('limit-buy') || argsStr.includes('cancel') || argsStr.includes('twap'))) {
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
    
    state.prices.BTC += (Math.random() - 0.5) * 150;
    state.prices.ETH += (Math.random() - 0.5) * 10;
    state.prices.SPCX += (Math.random() - 0.495) * 0.01;
    state.prices.SOL += (Math.random() - 0.5) * 0.5;
    
    // Inject and drift CHZ
    if (!state.prices.CHZ) state.prices.CHZ = 0.12;
    state.prices.CHZ += (Math.random() - 0.5) * 0.002;
    
    if (!state.wallets.solana.chz) state.wallets.solana.chz = 1000.0;

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
    
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

    broadcast({
      type: 'PORTFOLIO_STATE',
      data: {
        balances,
        pairStatus,
        accountStatus,
        readOnly: botConfig.readOnly
      }
    });

    broadcast({
      type: 'FULL_STATE',
      data: state
    });

    if (accountStatus.margin_usage_usd > botConfig.risk.maxMarginUsage) {
      triggerCircuitBreaker("Margin usage exceeded safety limits!");
    }
  } catch(e) {
    console.error("Error syncing portfolio state:", e);
  }
}

async function triggerCircuitBreaker(reason) {
  addSignal("RISK ENGINE", `CIRCUIT BREAKER TRIGGERED: ${reason}`, "danger");
  
  botConfig.strategies.pearPair.enabled = false;
  botConfig.strategies.spreadFarming.enabled = false;
  botConfig.strategies.momentum.enabled = false;
  botConfig.strategies.smartMoney.enabled = false;
  botConfig.strategies.binaryMomentum.enabled = false;
  botConfig.strategies.weatherHedging.enabled = false;
  botConfig.strategies.sportsFanToken.enabled = false;
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

    const ratio = state.prices.BTC / state.prices.ETH;
    const deviation = (ratio - pConfig.baseRatio) / pConfig.baseRatio;
    const activePairs = state.positions.filter(p => p.type === 'pair');

    if (activePairs.length === 0) {
      if (Math.abs(deviation) >= pConfig.deviationThreshold) {
        let longAsset = "BTC";
        let shortAsset = "ETH";
        let longWeight = 0.5;
        let shortWeight = 0.5;

        if (deviation > 0) {
          longAsset = "ETH";
          shortAsset = "BTC";
        }
        
        addSignal("PEAR PAIR", `Correlation dev ${ (deviation*100).toFixed(2) }% exceeds threshold. Initiating pair entry...`, "info");

        if (botConfig.risk.previewFirst) {
          const previewArgs = `hl pair open --long ${longAsset}=${longWeight} --short ${shortAsset}=${shortWeight} --size-usd ${pConfig.sizeUsd} --preview --output json`;
          await runCLI(previewArgs);
        }

        const execArgs = `hl pair open --long ${longAsset}=${longWeight} --short ${shortAsset}=${shortWeight} --size-usd ${pConfig.sizeUsd} --yes --output json`;
        const res = await runCLI(execArgs);
        addSignal("PEAR PAIR", `Market Neutral Position opened. ID: ${res.position_id}`, "success");
      }
    } else {
      for (const pos of activePairs) {
        const currentRatio = state.prices.BTC / state.prices.ETH;
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

      await runCLI(`hl long ${sfConfig.targetMarket} --limit ${longPrice} --tif alo --notional ${sfConfig.sizeUsd} --yes --output json`);
      await runCLI(`hl short ${sfConfig.targetMarket} --limit ${shortPrice} --tif alo --notional ${sfConfig.sizeUsd} --yes --output json`);
      
      addSignal("SPREAD FARMER", `Maker orders placed around midpoint $${midpoint.toFixed(4)}.`, "success");
    }
  } catch (e) {
    console.error("Spread Farming execution error:", e);
  }
}

// 5. 5-Minute Binary Momentum Loop
async function runBinaryMomentumStrategy() {
  if (!botConfig.strategies.binaryMomentum.enabled) return;

  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const bmConfig = botConfig.strategies.binaryMomentum;
    const activePositions = state.positions.filter(p => p.type === 'perp' && p.market === bmConfig.targetAsset);

    if (activePositions.length === 0) {
      const isUpTrend = Math.random() >= 0.5;
      const direction = isUpTrend ? 'long' : 'short';
      
      addSignal("BINARY MOMENTUM", `Detected short-term 5-Minute ${direction.toUpperCase()} trend on ${bmConfig.targetAsset}. Placing trade...`, "info");

      if (botConfig.risk.previewFirst) {
        await runCLI(`hl ${direction} ${bmConfig.targetAsset} --notional ${bmConfig.notional} --leverage ${bmConfig.leverage} --preview --output json`);
      }

      const res = await runCLI(`hl ${direction} ${bmConfig.targetAsset} --notional ${bmConfig.notional} --leverage ${bmConfig.leverage} --yes --output json`);
      addSignal("BINARY MOMENTUM", `Leveraged 5-Min Perp opened: ${res.position_id}`, "success");
    } else {
      for (const pos of activePositions) {
        const elapsedSecs = (Date.now() - new Date(pos.timestamp).getTime()) / 1000;
        if (elapsedSecs >= bmConfig.durationMinutes * 60) {
          addSignal("BINARY MOMENTUM", `Time limit of ${bmConfig.durationMinutes} minutes reached. Exiting position ${pos.id} via TWAP...`, "info");
          await runCLI(`hl cancel-all`);
          addSignal("BINARY MOMENTUM", `Successfully closed 5-Min Perp position.`, "success");
        }
      }
    }
  } catch (e) {
    console.error("Binary Momentum Strategy error:", e);
  }
}

// 6. Weather Hedging Strategy Loop
async function runWeatherHedgingStrategy() {
  if (!botConfig.strategies.weatherHedging.enabled) return;

  try {
    const wConfig = botConfig.strategies.weatherHedging;
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const activePositions = state.positions.filter(p => p.type === 'perp' && p.market === wConfig.targetAsset && p.direction === 'short');

    // Simulate weather forecast drift on Polymarket (e.g. record heat wave probabilities)
    weatherProbability += (Math.random() - 0.5) * 0.08;
    weatherProbability = Math.max(0.10, Math.min(0.95, weatherProbability));
    
    // Broadcast weather updates
    broadcast({ type: 'WEATHER_FORECAST', data: { probability: weatherProbability } });

    if (weatherProbability >= wConfig.probabilityThreshold) {
      if (activePositions.length === 0) {
        addSignal("WEATHER HEDGER", `Miami Heatwave probability ${(weatherProbability*100).toFixed(0)}% exceeds threshold. Shorting BTC as hash rate hedge...`, "warning");
        
        if (botConfig.risk.previewFirst) {
          await runCLI(`hl short ${wConfig.targetAsset} --notional ${wConfig.sizeUsd} --leverage 2 --preview --output json`);
        }

        const res = await runCLI(`hl short ${wConfig.targetAsset} --notional ${wConfig.sizeUsd} --leverage 2 --yes --output json`);
        addSignal("WEATHER HEDGER", `BTC Weather short hedge opened. ID: ${res.position_id}`, "success");
      }
    } else {
      // Weather cooled down, exit shorts
      if (activePositions.length > 0) {
        addSignal("WEATHER HEDGER", `Weather risk normalized (${(weatherProbability*100).toFixed(0)}%). Closing short hedges...`, "info");
        await runCLI("hl cancel-all");
        addSignal("WEATHER HEDGER", `Weather short hedges closed.`, "success");
      }
    }
  } catch (e) {
    console.error("Weather Hedging Strategy error:", e);
  }
}

// 7. Sports Fan Token Strategy Loop
async function runSportsFanTokenStrategy() {
  if (!botConfig.strategies.sportsFanToken.enabled) return;

  try {
    const sConfig = botConfig.strategies.sportsFanToken;
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

    // Simulate semi-final game drift on Polymarket
    const oldProb = sportsProbability;
    sportsProbability += (Math.random() - 0.5) * 0.15;
    sportsProbability = Math.max(0.05, Math.min(0.95, sportsProbability));

    broadcast({ type: 'SPORTS_PROBABILITY', data: { probability: sportsProbability } });

    const shift = sportsProbability - oldProb;

    if (shift >= sConfig.probabilityShiftThreshold) {
      // Rapid shift up: buy fan token
      addSignal("SPORTS FAN BOT", `Team probability shifted up by ${(shift*100).toFixed(0)}% (Now ${(sportsProbability*100).toFixed(0)}%). Buying ${sConfig.targetToken} fan token...`, "info");
      
      const res = await runCLI(`solana swap USDC ${sConfig.targetToken} ${sConfig.sizeUsd} --yes --output json`);
      addSignal("SPORTS FAN BOT", `Swapped USDC for ${sConfig.sizeUsd} ${sConfig.targetToken} fan tokens.`, "success");
    } else if (shift <= -sConfig.probabilityShiftThreshold) {
      // Rapid shift down: exit to USDC
      const currentTokenBal = state.wallets.solana.chz || 0;
      if (currentTokenBal > 0) {
        addSignal("SPORTS FAN BOT", `Team probability dropped by ${(-shift*100).toFixed(0)}%. Selling ${sConfig.targetToken} back to USDC...`, "warning");
        const res = await runCLI(`solana swap ${sConfig.targetToken} USDC ${currentTokenBal} --yes --output json`);
        addSignal("SPORTS FAN BOT", `Swapped ${currentTokenBal.toFixed(1)} ${sConfig.targetToken} back to USDC.`, "success");
      }
    }
  } catch (e) {
    console.error("Sports Fan Token Strategy error:", e);
  }
}

// Run bot loops
setInterval(() => {
  runPearPairStrategy();
  runSpreadFarmingStrategy();
  runBinaryMomentumStrategy();
  runWeatherHedgingStrategy();
  runSportsFanTokenStrategy();
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
      syncPortfolioState();
      return res.json({ success: true, result });
    }

    if (action === 'solana_swap') {
      const { tokenA, tokenB, amount } = params;
      const result = await runCLI(`solana swap ${tokenA} ${tokenB} ${amount} --yes --output json`);
      syncPortfolioState();
      return res.json({ success: true, result });
    }

    if (action === 'hl_cancel_all') {
      const result = await runCLI("hl cancel-all --output json");
      syncPortfolioState();
      return res.json({ success: true, result });
    }

    if (action === 'cancel_order') {
      const { orderId } = params;
      const result = await runCLI(`hl cancel ${orderId} --output json`);
      syncPortfolioState();
      return res.json({ success: true, result });
    }

    if (action === 'manual_trade') {
      const { asset, direction, notional, leverage, tp, sl } = params;
      let tpSlFlags = "";
      if (tp) tpSlFlags += ` --tp ${tp}`;
      if (sl) tpSlFlags += ` --sl ${sl}`;
      
      const cmd = `hl ${direction} ${asset} --notional ${notional} --leverage ${leverage}${tpSlFlags} --yes --output json`;
      const result = await runCLI(cmd);
      syncPortfolioState();
      return res.json({ success: true, result });
    }

    res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    res.status(500).json({ error: e.error || e.message });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', ws => {
  wsClients.add(ws);
  
  ws.send(JSON.stringify({ type: 'BOT_CONFIG', data: botConfig }));
  ws.send(JSON.stringify({ type: 'COMMAND_LOGS', data: commandLogs }));
  ws.send(JSON.stringify({ type: 'SIGNAL_FEED', data: signalFeed }));
  
  syncPortfolioState();

  ws.on('close', () => {
    wsClients.delete(ws);
  });
});
