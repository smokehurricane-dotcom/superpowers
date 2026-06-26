#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(__dirname, 'sim_state.json');

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) {
    console.error("Error reading state file:", e);
    process.exit(1);
  }
}

function writeState(state) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {
    console.error("Error writing state file:", e);
    process.exit(1);
  }
}

const args = process.argv.slice(2);

const isReadOnlyEnv = process.env.BULLPEN_READ_ONLY === '1';

const hasOutputJson = args.includes('--output') && args[args.indexOf('--output') + 1] === 'json';
const hasReadOnlyFlag = args.includes('--read-only');
const isReadOnly = isReadOnlyEnv || hasReadOnlyFlag;
const hasYes = args.includes('--yes');
const hasPreview = args.includes('--preview');

function printResult(data) {
  if (hasOutputJson) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

function verifyNotReadOnly() {
  if (isReadOnly) {
    console.error(JSON.stringify({ error: "Operation blocked: Bullpen is in READ-ONLY mode." }));
    process.exit(1);
  }
}

const cmdString = args.join(' ');

if (cmdString.startsWith('status')) {
  const state = readState();
  printResult({
    status: "authenticated",
    session_valid: true,
    version: "1.2.0-mock",
    wallets: {
      solana: state.wallets.solana.address,
      hyperliquid: state.wallets.hyperliquid.address
    },
    network: "mainnet-beta"
  });
  process.exit(0);
}

if (cmdString.startsWith('portfolio balances')) {
  const state = readState();
  printResult({
    solana: {
      USDC: state.wallets.solana.usdc,
      SOL: state.wallets.solana.sol,
      CHZ: state.wallets.solana.chz || 0.0
    },
    hyperliquid: {
      USDC: state.wallets.hyperliquid.usdc,
      SPCX: state.wallets.hyperliquid.spcx
    },
    aggregated_balance_usd: state.wallets.solana.usdc + state.wallets.hyperliquid.usdc + (state.wallets.solana.sol * state.prices.SOL) + (state.wallets.hyperliquid.spcx * state.prices.SPCX) + ((state.wallets.solana.chz || 0.0) * (state.prices.CHZ || 0.12))
  });
  process.exit(0);
}

// Hyperliquid Pear Pair Trading
if (cmdString.startsWith('hl pair status')) {
  const state = readState();
  printResult({
    setup_completed: state.wallets.hyperliquid.pair_setup_done,
    positions: state.positions.filter(p => p.type === 'pair'),
    builder_fees_accrued: 0.05
  });
  process.exit(0);
}

if (cmdString.startsWith('hl pair setup')) {
  verifyNotReadOnly();
  if (hasYes) {
    const state = readState();
    state.wallets.hyperliquid.pair_setup_done = true;
    writeState(state);
    printResult({
      success: true,
      msg: "Hyperliquid agent wallets approved and builder fees enabled."
    });
  } else {
    console.error("Confirmation required. Use --yes to approve setup.");
    process.exit(1);
  }
  process.exit(0);
}

if (cmdString.startsWith('hl pair open')) {
  verifyNotReadOnly();
  const state = readState();
  if (!state.wallets.hyperliquid.pair_setup_done) {
    console.error(JSON.stringify({ error: "Hyperliquid pair setup has not been initialized. Run 'bullpen hl pair setup --yes' first." }));
    process.exit(1);
  }

  let longParam = "";
  let shortParam = "";
  let sizeUsd = 0;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--long') longParam = args[i+1];
    if (args[i] === '--short') shortParam = args[i+1];
    if (args[i] === '--size-usd') sizeUsd = parseFloat(args[i+1]);
  }

  if (!longParam || !shortParam || isNaN(sizeUsd)) {
    console.error(JSON.stringify({ error: "Missing required parameters: --long, --short, or --size-usd." }));
    process.exit(1);
  }

  const [longAsset, longWeight] = longParam.split('=');
  const [shortAsset, shortWeight] = shortParam.split('=');
  
  const wL = parseFloat(longWeight);
  const wS = parseFloat(shortWeight);

  if (Math.abs((wL + wS) - 1.0) > 0.001) {
    console.error(JSON.stringify({ error: "Pear v1 constraints violated: Long weight + Short weight must equal 1.0 exactly." }));
    process.exit(1);
  }

  const legsCount = 2;
  const minNotional = 11 * legsCount;
  if (sizeUsd < minNotional) {
    console.error(JSON.stringify({ error: `Pear v1 constraints violated: Notional value ($${sizeUsd}) must satisfy Notional >= 11 * Legs ($${minNotional}).` }));
    process.exit(1);
  }

  if (state.wallets.hyperliquid.usdc < sizeUsd) {
    console.error(JSON.stringify({ error: `Insufficient funds in Hyperliquid wallet. Required: $${sizeUsd}, Available: $${state.wallets.hyperliquid.usdc}` }));
    process.exit(1);
  }

  if (hasPreview) {
    printResult({
      preview: true,
      legs: [
        { asset: longAsset, direction: "long", weight: wL, size_usd: sizeUsd * wL, price: state.prices[longAsset] || 50000 },
        { asset: shortAsset, direction: "short", weight: wS, size_usd: sizeUsd * wS, price: state.prices[shortAsset] || 3000 }
      ],
      estimated_fees_usd: sizeUsd * 0.0005,
      slippage_tolerance: "0.5%",
      net_exposure_usd: 0.0
    });
    process.exit(0);
  }

  if (hasYes) {
    state.wallets.hyperliquid.usdc -= sizeUsd;
    const posId = "pair_" + Math.random().toString(36).substr(2, 9);
    const newPosition = {
      id: posId,
      type: "pair",
      longAsset,
      shortAsset,
      weightLong: wL,
      weightShort: wS,
      sizeUsd,
      entryTime: new Date().toISOString(),
      entryPriceLong: state.prices[longAsset] || 65000,
      entryPriceShort: state.prices[shortAsset] || 3500,
      currentPriceLong: state.prices[longAsset] || 65000,
      currentPriceShort: state.prices[shortAsset] || 3500
    };
    state.positions.push(newPosition);
    state.history.push({
      action: "pair_open",
      details: newPosition,
      timestamp: new Date().toISOString()
    });
    writeState(state);

    printResult({
      success: true,
      position_id: posId,
      msg: `Market-neutral pair ${longAsset}/${shortAsset} opened successfully.`,
      execution: newPosition
    });
  } else {
    console.error("Execution blocked. Use --yes or --preview.");
    process.exit(1);
  }
  process.exit(0);
}

if (cmdString.startsWith('hl pair close')) {
  verifyNotReadOnly();
  const state = readState();
  const posId = args[args.indexOf('close') + 1];
  
  let twapMinutes = 0;
  if (args.includes('--twap-minutes')) {
    twapMinutes = parseInt(args[args.indexOf('--twap-minutes') + 1]);
  }

  const posIndex = state.positions.findIndex(p => p.id === posId);
  if (posIndex === -1) {
    console.error(JSON.stringify({ error: `Pear Pair position with ID ${posId} not found.` }));
    process.exit(1);
  }

  const pos = state.positions[posIndex];
  
  const currentPriceLong = state.prices[pos.longAsset] || pos.entryPriceLong;
  const currentPriceShort = state.prices[pos.shortAsset] || pos.entryPriceShort;
  
  const returnLong = (currentPriceLong - pos.entryPriceLong) / pos.entryPriceLong;
  const returnShort = (pos.entryPriceShort - currentPriceShort) / pos.entryPriceShort;

  const longPnl = pos.sizeUsd * pos.weightLong * returnLong;
  const shortPnl = pos.sizeUsd * pos.weightShort * returnShort;
  const totalPnl = longPnl + shortPnl;
  const settlementUsd = pos.sizeUsd + totalPnl;

  state.wallets.hyperliquid.usdc += settlementUsd;
  state.positions.splice(posIndex, 1);
  state.history.push({
    action: "pair_close",
    position_id: posId,
    pnl_usd: totalPnl,
    settlement_usd: settlementUsd,
    twap_minutes: twapMinutes,
    timestamp: new Date().toISOString()
  });
  writeState(state);

  printResult({
    success: true,
    position_id: posId,
    pnl_usd: totalPnl,
    settlement_usd: settlementUsd,
    twap_applied: twapMinutes > 0,
    twap_minutes: twapMinutes
  });
  process.exit(0);
}

// HIP-3 Perp DEXes & Spread Farming
if (cmdString.startsWith('hl perp-dexes')) {
  printResult([
    { name: "xyz", description: "Alpha HIP-3 DEX", fee_tier: "Maker -0.01%, Taker 0.03%" },
    { name: "krypton", description: "Krypton HIP-3 DEX", fee_tier: "Maker 0.00%, Taker 0.04%" }
  ]);
  process.exit(0);
}

if (cmdString.startsWith('hl orderbook')) {
  const market = args[args.indexOf('orderbook') + 1];
  const state = readState();
  
  let midPrice = 1.25;
  if (market.endsWith('SPCX')) midPrice = state.prices.SPCX;
  else if (market.endsWith('BTC')) midPrice = state.prices.BTC;

  const orderbook = {
    market,
    asks: [
      { price: midPrice * 1.002, size: 5000 },
      { price: midPrice * 1.004, size: 7500 },
      { price: midPrice * 1.006, size: 12000 }
    ],
    bids: [
      { price: midPrice * 0.998, size: 4800 },
      { price: midPrice * 0.996, size: 8200 },
      { price: midPrice * 0.994, size: 11000 }
    ],
    timestamp: new Date().toISOString()
  };

  printResult(orderbook);
  process.exit(0);
}

if (cmdString.startsWith('hl long') || cmdString.startsWith('hl short')) {
  verifyNotReadOnly();
  const direction = cmdString.startsWith('hl long') ? 'long' : 'short';
  const state = readState();

  const isLimit = args.includes('--limit');
  const isAlo = args.includes('--tif') && args[args.indexOf('--tif') + 1] === 'alo';
  
  let market = "";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === 'long' || args[i] === 'short') {
      market = args[i+1];
      break;
    }
  }

  let notional = 0;
  let leverage = 1;
  let sizeUsd = 0;
  let limitPrice = 0;
  let tp = null;
  let sl = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--notional') notional = parseFloat(args[i+1]);
    if (args[i] === '--leverage') leverage = parseFloat(args[i+1]);
    if (args[i] === '--size-usd') sizeUsd = parseFloat(args[i+1]);
    if (args[i] === '--limit') limitPrice = parseFloat(args[i+1]);
    if (args[i] === '--tp') tp = parseFloat(args[i+1]);
    if (args[i] === '--sl') sl = parseFloat(args[i+1]);
  }

  const size = notional || sizeUsd;

  if (!market || !size) {
    console.error(JSON.stringify({ error: "Missing market or size parameters." }));
    process.exit(1);
  }

  if (hasPreview) {
    printResult({
      preview: true,
      market,
      direction,
      size_usd: size,
      leverage,
      is_limit: isLimit,
      is_alo: isAlo,
      estimated_margin_usd: size / leverage,
      tp_bracket: tp,
      sl_bracket: sl
    });
    process.exit(0);
  }

  if (hasYes) {
    const marginReq = size / leverage;
    if (state.wallets.hyperliquid.usdc < marginReq) {
      console.error(JSON.stringify({ error: `Insufficient margin. Required: $${marginReq}, Available: $${state.wallets.hyperliquid.usdc}` }));
      process.exit(1);
    }

    if (isLimit) {
      const orderId = "ord_" + Math.random().toString(36).substr(2, 9);
      const newOrder = {
        id: orderId,
        market,
        direction,
        size,
        leverage,
        postOnly: isAlo,
        price: limitPrice || null,
        timestamp: new Date().toISOString()
      };
      state.orders.push(newOrder);
      writeState(state);
      printResult({
        success: true,
        order_id: orderId,
        msg: `Limit Order (${isAlo ? 'ALO' : 'Standard'}) placed successfully on ${market}.`
      });
    } else {
      state.wallets.hyperliquid.usdc -= marginReq;
      const posId = "perp_" + Math.random().toString(36).substr(2, 9);
      const newPosition = {
        id: posId,
        type: "perp",
        market,
        direction,
        size,
        leverage,
        entryPrice: state.prices[market.replace('xyz:', '')] || 1.25,
        tp,
        sl,
        timestamp: new Date().toISOString()
      };
      state.positions.push(newPosition);
      state.history.push({
        action: "perp_open",
        details: newPosition,
        timestamp: new Date().toISOString()
      });
      writeState(state);
      printResult({
        success: true,
        position_id: posId,
        msg: `Perpetual ${direction} position opened successfully on ${market}.`,
        tp_triggered_order: tp ? "Active reduce-only OCO" : "none",
        sl_triggered_order: sl ? "Active reduce-only OCO" : "none"
      });
    }
  } else {
    console.error("Execution blocked. Use --yes or --preview.");
    process.exit(1);
  }
  process.exit(0);
}

// Cancel individual order
if (cmdString.startsWith('hl cancel') && !cmdString.includes('cancel-all')) {
  verifyNotReadOnly();
  const state = readState();
  const orderId = args[args.indexOf('cancel') + 1];

  const orderIndex = state.orders.findIndex(o => o.id === orderId);
  if (orderIndex === -1) {
    console.error(JSON.stringify({ error: `Order ${orderId} not found.` }));
    process.exit(1);
  }

  const order = state.orders[orderIndex];
  state.orders.splice(orderIndex, 1);
  
  // Refund cost if Solana limit buy
  if (order.market.startsWith('solana:')) {
    state.wallets.solana.usdc += order.size * order.price;
  }

  writeState(state);
  printResult({
    success: true,
    order_id: orderId,
    msg: `Order ${orderId} cancelled successfully.`
  });
  process.exit(0);
}

if (cmdString.includes('spot twap create')) {
  verifyNotReadOnly();
  const createIndex = args.indexOf('create');
  const tokenA = args[createIndex + 1];
  const tokenB = args[createIndex + 2];
  const amount = parseFloat(args[createIndex + 3]);
  const duration = parseInt(args[createIndex + 4]);
  
  if (hasPreview) {
    printResult({
      preview: true,
      tokenA,
      tokenB,
      amount,
      duration_minutes: duration,
      expected_intervals: Math.ceil(duration / 0.5)
    });
    process.exit(0);
  }

  if (hasYes) {
    const state = readState();
    if (state.wallets.hyperliquid.usdc < amount) {
      console.error(JSON.stringify({ error: "Insufficient USDC balance for TWAP order." }));
      process.exit(1);
    }
    state.wallets.hyperliquid.usdc -= amount;
    state.wallets.hyperliquid.spcx += (amount / state.prices.SPCX) * 0.997;
    state.history.push({
      action: "spot_twap_create",
      tokenA,
      tokenB,
      amount,
      duration_minutes: duration,
      timestamp: new Date().toISOString()
    });
    writeState(state);
    printResult({
      success: true,
      msg: `Spot TWAP created: Swap ${amount} USDC into ${tokenA} over ${duration} minutes.`
    });
  } else {
    console.error("Execution blocked. Use --yes or --preview.");
    process.exit(1);
  }
  process.exit(0);
}

// Solana Operations
if (cmdString.startsWith('solana swap')) {
  verifyNotReadOnly();
  let tokenA = args[args.indexOf('swap') + 1];
  let tokenB = args[args.indexOf('swap') + 2];
  let amount = parseFloat(args[args.indexOf('swap') + 3]);

  if (!tokenA || !tokenB || isNaN(amount)) {
    console.error(JSON.stringify({ error: "Missing arguments: swap <TOKEN_A> <TOKEN_B> <AMOUNT>" }));
    process.exit(1);
  }

  const state = readState();
  if (tokenA.toUpperCase() === 'USDC' && tokenB.toUpperCase() === 'SOL') {
    if (state.wallets.solana.usdc < amount) {
      console.error(JSON.stringify({ error: "Insufficient USDC on Solana." }));
      process.exit(1);
    }
    state.wallets.solana.usdc -= amount;
    state.wallets.solana.sol += (amount / state.prices.SOL) * 0.998;
  } else if (tokenA.toUpperCase() === 'SOL' && tokenB.toUpperCase() === 'USDC') {
    if (state.wallets.solana.sol < amount) {
      console.error(JSON.stringify({ error: "Insufficient SOL on Solana." }));
      process.exit(1);
    }
    state.wallets.solana.sol -= amount;
    state.wallets.solana.usdc += (amount * state.prices.SOL) * 0.998;
  } else {
    console.error(JSON.stringify({ error: `Unsupported swap token pair: ${tokenA}/${tokenB}` }));
    process.exit(1);
  }

  state.history.push({
    action: "solana_swap",
    tokenA,
    tokenB,
    amount,
    timestamp: new Date().toISOString()
  });
  writeState(state);

  printResult({
    success: true,
    msg: `Successfully swapped ${amount} ${tokenA} to ${tokenB} via Jupiter routing.`,
    balances: state.wallets.solana
  });
  process.exit(0);
}

if (cmdString.startsWith('solana limit-buy')) {
  verifyNotReadOnly();
  let token = args[args.indexOf('limit-buy') + 1];
  let amount = parseFloat(args[args.indexOf('limit-buy') + 2]);
  let price = parseFloat(args[args.indexOf('limit-buy') + 3]);

  const state = readState();
  const cost = amount * price;
  if (state.wallets.solana.usdc < cost) {
    console.error(JSON.stringify({ error: "Insufficient USDC for Solana limit buy." }));
    process.exit(1);
  }

  state.wallets.solana.usdc -= cost;
  const orderId = "sol_ord_" + Math.random().toString(36).substr(2, 9);
  state.orders.push({
    id: orderId,
    market: `solana:${token}`,
    direction: "buy",
    size: amount,
    price,
    timestamp: new Date().toISOString()
  });
  writeState(state);

  printResult({
    success: true,
    order_id: orderId,
    msg: `Placed Solana limit buy order for ${amount} ${token} at $${price}.`
  });
  process.exit(0);
}

// Smart Money Tracking
if (cmdString.includes('polymarket data smart-money') || cmdString.startsWith('tracker feed')) {
  printResult([
    {
      wallet: "0xWhale1...f9a",
      rank: 4,
      action: "buy_yes",
      market: "BTC reaches 100k in 2026",
      amount_usd: 75000,
      timestamp: new Date().toISOString()
    },
    {
      wallet: "0xOracle...88b",
      rank: 12,
      action: "buy_yes",
      market: "Trump announces SPCX partnership",
      amount_usd: 55000,
      timestamp: new Date(Date.now() - 30000).toISOString()
    }
  ]);
  process.exit(0);
}

// Monitoring & Risk Circuit Breakers
if (cmdString.startsWith('hl status --all-dexes')) {
  const state = readState();
  
  let activeMargin = 0;
  state.positions.forEach(p => {
    if (p.type === 'perp') {
      activeMargin += p.size / p.leverage;
    }
  });

  printResult({
    maintenance_margin_usd: state.wallets.hyperliquid.maintenance_margin,
    margin_usage_usd: activeMargin,
    available_margin_usd: state.wallets.hyperliquid.usdc,
    risk_level: activeMargin > 5000 ? "HIGH" : activeMargin > 1500 ? "MODERATE" : "LOW",
    positions_count: state.positions.length,
    open_orders_count: state.orders.length
  });
  process.exit(0);
}

if (cmdString.startsWith('hl cancel-all')) {
  verifyNotReadOnly();
  const state = readState();
  
  let returnedCollateral = 0;
  state.positions.forEach(p => {
    if (p.type === 'perp') {
      returnedCollateral += p.size / p.leverage;
    } else if (p.type === 'pair') {
      returnedCollateral += p.sizeUsd;
    }
  });
  state.orders.forEach(o => {
    if (o.market.startsWith('solana:')) {
      returnedCollateral += o.size * o.price;
    }
  });

  state.wallets.hyperliquid.usdc += returnedCollateral;
  state.positions = [];
  state.orders = [];
  state.history.push({
    action: "cancel_all_circuit_breaker",
    returned_collateral: returnedCollateral,
    timestamp: new Date().toISOString()
  });
  writeState(state);

  printResult({
    success: true,
    cancelled_positions: true,
    cancelled_orders: true,
    returned_margin_usd: returnedCollateral,
    msg: "Emergency stop triggered! Cancelled all open positions and orders."
  });
  process.exit(0);
}

console.error("Unknown command or missing parameters. Run with --help for command structure.");
process.exit(1);
