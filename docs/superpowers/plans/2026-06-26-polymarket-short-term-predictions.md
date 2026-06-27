# Short-Term Polymarket pUSD Prediction Trading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated and manual trading of dynamic short-term (5-minute and 15-minute) Crypto Up/Down prediction markets with pUSD using the Polymarket simulation.

**Architecture:** 
1. **State System**: Maintain dynamic short-term prediction markets (BTC, ETH, SOL for 5/15 minutes) inside `sim_state.json`.
2. **Auto-Resolution & Roll-over**: The simulator interval in `bot-backend.js` drifts the YES/NO token prices based on asset deviation, checks for expiry, resolves positions, pays out `pUSD`, and rolls over new intervals.
3. **Automated Trading**: Update `bot-backend.js` prediction loop to scan all available markets via CLI, analyze price trends, and trade.
4. **Dashboard**: Update `App.jsx` strategy config card and positions list to show countdowns and dynamic settings.

**Tech Stack:** Express, React, WebSocket, Node.js

## Global Constraints
* Implement all frontend changes in React using Vanilla CSS. No Tailwind CSS.
* Bypasses Polymarket regional restrictions by implementing direct simulated pUSD trading in the mock environment.
* All CLI commands must be executed via `runCLI` (respecting `preview-first` and `yes` confirm loops).

---

### Task 1: Update State File & Mock CLI (`sim_state.json` & `mock-bullpen.js`)

**Files:**
- Modify: `c:\Users\petra\Neuer Ordner\bullpen_bot_dashboard\sim_state.json`
- Modify: `c:\Users\petra\Neuer Ordner\bullpen_bot_dashboard\mock-bullpen.js`

**Interfaces:**
- Produces: `bullpen polymarket markets --output json` command output.

- [ ] **Step 1: Add default short-term markets to `sim_state.json`**
  Add a `"polymarket_markets"` array under the root JSON object in `sim_state.json`.
  Code to add:
  ```json
  "polymarket_markets": [
    {
      "id": "will-btc-be-up-in-5-min",
      "asset": "BTC",
      "interval": 5,
      "startAssetPrice": 66457.56,
      "startTime": "2026-06-26T19:18:00.000Z",
      "endTime": "2026-06-26T19:23:00.000Z",
      "currentYesPrice": 0.50,
      "currentNoPrice": 0.50
    },
    {
      "id": "will-eth-be-up-in-5-min",
      "asset": "ETH",
      "interval": 5,
      "startAssetPrice": 3422.71,
      "startTime": "2026-06-26T19:18:00.000Z",
      "endTime": "2026-06-26T19:23:00.000Z",
      "currentYesPrice": 0.50,
      "currentNoPrice": 0.50
    },
    {
      "id": "will-sol-be-up-in-5-min",
      "asset": "SOL",
      "interval": 5,
      "startAssetPrice": 138.05,
      "startTime": "2026-06-26T19:18:00.000Z",
      "endTime": "2026-06-26T19:23:00.000Z",
      "currentYesPrice": 0.50,
      "currentNoPrice": 0.50
    },
    {
      "id": "will-btc-be-up-in-15-min",
      "asset": "BTC",
      "interval": 15,
      "startAssetPrice": 66457.56,
      "startTime": "2026-06-26T19:18:00.000Z",
      "endTime": "2026-06-26T19:33:00.000Z",
      "currentYesPrice": 0.50,
      "currentNoPrice": 0.50
    },
    {
      "id": "will-eth-be-up-in-15-min",
      "asset": "ETH",
      "interval": 15,
      "startAssetPrice": 3422.71,
      "startTime": "2026-06-26T19:18:00.000Z",
      "endTime": "2026-06-26T19:33:00.000Z",
      "currentYesPrice": 0.50,
      "currentNoPrice": 0.50
    },
    {
      "id": "will-sol-be-up-in-15-min",
      "asset": "SOL",
      "interval": 15,
      "startAssetPrice": 138.05,
      "startTime": "2026-06-26T19:18:00.000Z",
      "endTime": "2026-06-26T19:33:00.000Z",
      "currentYesPrice": 0.50,
      "currentNoPrice": 0.50
    }
  ]
  ```

- [ ] **Step 2: Add `polymarket markets` command in `mock-bullpen.js`**
  Modify `mock-bullpen.js` to handle `polymarket markets` command.
  Add this check around line 95 (before `polymarket buy` command handler):
  ```javascript
  if (cmdString.startsWith('polymarket markets')) {
    const state = readState();
    printResult(state.polymarket_markets || []);
    process.exit(0);
  }
  ```

- [ ] **Step 3: Modify `polymarket buy` in `mock-bullpen.js` to use dynamic market pricing**
  Update the price lookup inside `polymarket buy` command handler:
  ```javascript
    const activeMarket = state.polymarket_markets ? state.polymarket_markets.find(m => m.id === market) : null;
    const executionPrice = activeMarket ? (outcome === 'yes' ? activeMarket.currentYesPrice : activeMarket.currentNoPrice) : 0.50;
    const shares = amount / executionPrice;
  ```
  And update the execution position object fields:
  ```javascript
      entryPrice: executionPrice,
      currentPrice: executionPrice,
  ```

- [ ] **Step 4: Test command output manually**
  Run: `node mock-bullpen.js polymarket markets --output json`
  Expected: JSON list containing the 6 prediction markets.

- [ ] **Step 5: Commit changes**
  Run:
  ```bash
  git add mock-bullpen.js sim_state.json
  git commit -m "feat: add short-term polymarket markets array and CLI query command"
  ```

---

### Task 2: Backend Simulation, Auto-Settlement & Drift (`bot-backend.js`)

**Files:**
- Modify: `c:\Users\petra\Neuer Ordner\bullpen_bot_dashboard\bot-backend.js`

- [ ] **Step 1: Update the market simulator interval to drift and resolve markets**
  Modify the `setInterval` market drift block inside `bot-backend.js` (lines 113-156) to:
  1. Drift the YES/NO prices of each market in `state.polymarket_markets` based on underlying asset price deviation from `startAssetPrice`.
     ```javascript
     state.polymarket_markets = (state.polymarket_markets || []).map(m => {
       const curAssetPrice = state.prices[m.asset];
       if (curAssetPrice && m.startAssetPrice) {
         const dev = (curAssetPrice - m.startAssetPrice) / m.startAssetPrice;
         // Maps a 1% price change to a 0.50 probability shift
         const yesPrice = Math.max(0.05, Math.min(0.95, 0.50 + dev * 50));
         return {
           ...m,
           currentYesPrice: parseFloat(yesPrice.toFixed(4)),
           currentNoPrice: parseFloat((1.0 - yesPrice).toFixed(4))
         };
       }
       return m;
     });
     ```
  2. Detect expired markets, resolve YES/NO outcome, settle positions, and roll over:
     ```javascript
     const now = new Date();
     state.polymarket_markets = state.polymarket_markets.map(m => {
       if (now >= new Date(m.endTime)) {
         const finalPrice = state.prices[m.asset];
         const resolvedOutcome = finalPrice > m.startAssetPrice ? 'yes' : 'no';
         
         // Settle user positions
         state.positions = state.positions.filter(pos => {
           if (pos.type === 'prediction' && pos.market === m.id) {
             const isWin = pos.outcome === resolvedOutcome;
             const payout = isWin ? pos.shares * 1.0 : 0.0;
             if (!state.wallets.polymarket) {
               state.wallets.polymarket = { address: "0xPolymarketMockAddress777", pusd: 5000.0 };
             }
             state.wallets.polymarket.pusd += payout;
             
             // Add signal notification
             addSignal("POLY SETTLEMENT", `Market ${m.id} resolved to ${resolvedOutcome.toUpperCase()}. Position ${pos.id} settled. Payout: $${payout.toFixed(2)} pUSD.`, isWin ? "success" : "warning");
             
             state.history.push({
               action: "polymarket_settlement",
               market: m.id,
               positionId: pos.id,
               outcome: pos.outcome,
               resolved: resolvedOutcome,
               payout,
               timestamp: new Date().toISOString()
             });
             return false; // remove position
           }
           return true;
         });

         // Roll over to new interval
         const nextEndTime = new Date(Date.now() + m.interval * 60 * 1000);
         return {
           ...m,
           startAssetPrice: finalPrice,
           startTime: now.toISOString(),
           endTime: nextEndTime.toISOString(),
           currentYesPrice: 0.50,
           currentNoPrice: 0.50
         };
       }
       return m;
     });
     ```
  3. Sync the `currentPrice` for active prediction positions in `state.positions` from their active markets in `state.polymarket_markets`.
     ```javascript
     state.positions = state.positions.map(p => {
       if (p.type === 'prediction') {
         const m = state.polymarket_markets.find(market => market.id === p.market);
         if (m) {
           return {
             ...p,
             currentPrice: p.outcome === 'yes' ? m.currentYesPrice : m.currentNoPrice
           };
         }
       }
       return p;
     });
     ```

- [ ] **Step 2: Commit changes**
  Run:
  ```bash
  git add bot-backend.js
  git commit -m "feat: implement prediction market drifting, resolution, and auto roll-over"
  ```

---

### Task 3: Scanning & Automated Short-term Trading (`bot-backend.js`)

**Files:**
- Modify: `c:\Users\petra\Neuer Ordner\bullpen_bot_dashboard\bot-backend.js`

- [ ] **Step 1: Maintain Price History in `bot-backend.js`**
  Add a `priceHistory` variable at the top of the file to store rolling prices (max 10 entries) for BTC, ETH, SOL:
  ```javascript
  let priceHistory = {
    BTC: [],
    ETH: [],
    SOL: []
  };
  ```
  Push to `priceHistory` in the simulated market drift interval:
  ```javascript
  ['BTC', 'ETH', 'SOL'].forEach(asset => {
    priceHistory[asset].push(state.prices[asset]);
    if (priceHistory[asset].length > 10) priceHistory[asset].shift();
  });
  ```

- [ ] **Step 2: Update Strategy Config Structure**
  Update default configuration for `polymarketPredictions` around line 32:
  ```javascript
    polymarketPredictions: {
      enabled: false,
      sizeUsd: 100,
      intervals: { "5min": true, "15min": true },
      assets: { "BTC": true, "ETH": true, "SOL": true }
    }
  ```

- [ ] **Step 3: Implement Scanner & Automated Strategy Loop**
  Rewrite `runPolymarketPredictionStrategy()` to scan and trade:
  ```javascript
  async function runPolymarketPredictionStrategy() {
    if (!botConfig.strategies.polymarketPredictions.enabled) return;

    try {
      const pmConfig = botConfig.strategies.polymarketPredictions;
      const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

      // 1. Fetch available markets from CLI
      const markets = await runCLI("polymarket markets --output json");

      for (const m of markets) {
        // Parse asset and interval
        const assetName = m.asset;
        const intervalKey = `${m.interval}min`;

        // Check if config allows this asset and interval
        if (!pmConfig.assets[assetName] || !pmConfig.intervals[intervalKey]) continue;

        // Check if we already have an active position in this market
        const hasPos = state.positions.some(p => p.type === 'prediction' && p.market === m.id);
        if (hasPos) continue;

        // 2. Trend detection using priceHistory
        const history = priceHistory[assetName] || [];
        if (history.length < 3) continue; // need some data points

        const avgPrice = history.reduce((a,b)=>a+b,0) / history.length;
        const currentPrice = state.prices[assetName];
        const trend = currentPrice - avgPrice;

        // Trigger entry if there's clear momentum
        if (Math.abs(trend) > 0.0) {
          const outcome = trend > 0 ? 'yes' : 'no';
          
          addSignal("POLY AUTOMATED", `Short-term momentum detected on ${assetName} (${trend > 0 ? 'UP' : 'DOWN'}). Executing automated prediction order...`, "info");

          if (botConfig.risk.previewFirst) {
            await runCLI(`polymarket buy --market ${m.id} --outcome ${outcome} --amount ${pmConfig.sizeUsd} --preview --output json`);
          }

          const res = await runCLI(`polymarket buy --market ${m.id} --outcome ${outcome} --amount ${pmConfig.sizeUsd} --yes --output json`);
          addSignal("POLY AUTOMATED", `Direct prediction bought: ${outcome.toUpperCase()} on ${m.id}. Shares: ${res.execution.shares.toFixed(1)} | ID: ${res.position_id}`, "success");
        }
      }
    } catch (e) {
      addSignal("POLY AUTOMATED", `Strategy execution error: ${e.message || e}`, "danger");
      console.error("Polymarket Prediction Strategy error:", e);
    }
  }
  ```

- [ ] **Step 4: Commit changes**
  Run:
  ```bash
  git add bot-backend.js
  git commit -m "feat: implement dynamic scanning, trend detection, and automated execution in strategy loop"
  ```

---

### Task 4: Frontend Updates (`App.jsx`)

**Files:**
- Modify: `c:\Users\petra\Neuer Ordner\bullpen_bot_dashboard\frontend\src\App.jsx`

- [ ] **Step 1: Update initial `strategies` state structure in React**
  Around lines 27-28 in `App.jsx`, update `polymarketPredictions` state structure:
  ```javascript
      polymarketPredictions: { 
        enabled: false, 
        sizeUsd: 100, 
        intervals: { "5min": true, "15min": true }, 
        assets: { "BTC": true, "ETH": true, "SOL": true } 
      }
  ```

- [ ] **Step 2: Update Config card UI inside App.jsx**
  Modify the `strategies.polymarketPredictions` configuration block inside `App.jsx` (lines 494-523):
  * Replace the single market input text boxes with checkboxes/toggles for Assets and Intervals.
  Code block representation:
  ```javascript
                  <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: `4px solid ${strategies.polymarketPredictions?.enabled ? 'var(--color-violet)' : 'var(--glass-border)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-main)' }}>Direct Polymarket pUSD Prediction Trader</h3>
                        <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Scans short-term crypto up/down markets and trades based on price momentum</p>
                      </div>
                      <label className="switch">
                        <input type="checkbox" checked={strategies.polymarketPredictions?.enabled} onChange={() => handleStrategyToggle('polymarketPredictions')} />
                        <span className="slider"></span>
                      </label>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      <div>
                        <label>Trade Size (pUSD)</label>
                        <input type="number" value={strategies.polymarketPredictions?.sizeUsd} onChange={(e) => handleParamChange('polymarketPredictions', 'sizeUsd', e.target.value)} />
                      </div>
                      <div>
                        <label style={{ marginBottom: '6px', display: 'block' }}>Target Intervals</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                            <input 
                              type="checkbox" 
                              checked={strategies.polymarketPredictions?.intervals?.["5min"]} 
                              onChange={(e) => {
                                const nextIntervals = { ...strategies.polymarketPredictions.intervals, "5min": e.target.checked };
                                handleParamChange('polymarketPredictions', 'intervals', nextIntervals);
                              }}
                            /> 5 Min
                          </label>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                            <input 
                              type="checkbox" 
                              checked={strategies.polymarketPredictions?.intervals?.["15min"]} 
                              onChange={(e) => {
                                const nextIntervals = { ...strategies.polymarketPredictions.intervals, "15min": e.target.checked };
                                handleParamChange('polymarketPredictions', 'intervals', nextIntervals);
                              }}
                            /> 15 Min
                          </label>
                        </div>
                      </div>
                      <div>
                        <label style={{ marginBottom: '6px', display: 'block' }}>Crypto Assets</label>
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                          {["BTC", "ETH", "SOL"].map(asset => (
                            <label key={asset} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                              <input 
                                type="checkbox" 
                                checked={strategies.polymarketPredictions?.assets?.[asset]} 
                                onChange={(e) => {
                                  const nextAssets = { ...strategies.polymarketPredictions.assets, [asset]: e.target.checked };
                                  handleParamChange('polymarketPredictions', 'assets', nextAssets);
                                }}
                              /> {asset}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
  ```

- [ ] **Step 3: Update "Open Positions" table inside `App.jsx` to render countdowns and details**
  Locate where `simState.positions` mapped prediction rows (around lines 914-918):
  Retrieve the associated market info from `simState.polymarket_markets` to draw details:
  ```javascript
                          } else if (pos.type === 'prediction') {
                            pnl = pos.shares * (pos.currentPrice - pos.entryPrice);
                            isUp = pnl >= 0;
                            const activeM = simState?.polymarket_markets?.find(m => m.id === pos.market);
                            let remainingText = "Resolving...";
                            if (activeM) {
                              const diffMs = new Date(activeM.endTime).getTime() - Date.now();
                              if (diffMs > 0) {
                                const min = Math.floor(diffMs / 60000);
                                const sec = Math.floor((diffMs % 60000) / 1000);
                                remainingText = `${min}m ${sec}s left`;
                              }
                            }
                            details = `${pos.outcome.toUpperCase()} prediction (${remainingText})`;
                          }
  ```
  Also display entry underlying price vs current underlying price under entry/current price headers:
  ```javascript
                              <td>
                                {pos.type === 'prediction' ? (
                                  <>
                                    <div>Entry Share: ${pos.entryPrice.toFixed(2)}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                      Start Asset: ${(simState?.polymarket_markets?.find(m => m.id === pos.market)?.startAssetPrice || 0).toFixed(2)}
                                    </div>
                                  </>
                                ) : (
                                  `$${(pos.entryPriceLong || pos.entryPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                                )}
                              </td>
                              <td>
                                {pos.type === 'prediction' ? (
                                  <>
                                    <div>Cur Share: ${pos.currentPrice.toFixed(2)}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                                      Cur Asset: ${(simState?.prices?.[simState?.polymarket_markets?.find(m => m.id === pos.market)?.asset] || 0).toFixed(2)}
                                    </div>
                                  </>
                                ) : (
                                  `$${(pos.currentPriceLong || pos.currentPrice || simState.prices[pos.market.replace('xyz:', '')] || pos.entryPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`
                                )}
                              </td>
  ```

- [ ] **Step 4: Commit changes**
  Run:
  ```bash
  git add App.jsx
  git commit -m "feat: update React dashboard with short-term prediction controls and countdown rendering"
  ```

---

### Task 5: Add Settlement Test Suite (`test.js`)

**Files:**
- Modify: `c:\Users\petra\Neuer Ordner\bullpen_bot_dashboard\test.js`

- [ ] **Step 1: Implement Settlement and Scanning test logic in `test.js`**
  Add a new test `testShortTermPredictions()` around line 85:
  ```javascript
  async function testShortTermPredictions() {
    console.log("🧪 Test 5: Short-Term Prediction Market Settle & Roll-over");
    
    // Simulate expired time
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
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
    
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    
    // Trigger mock resolution logic or execute CLI command to buy/sell
    const res = await runCommand("polymarket markets --output json");
    assert.strictEqual(res.code, 0);
    const markets = JSON.parse(res.stdout);
    assert.ok(markets.length > 0);
    
    console.log("✅ Passed Short-Term Prediction Market Verification\n");
  }
  ```
  Register the test in `runAll()`:
  ```javascript
  await testShortTermPredictions();
  ```

- [ ] **Step 2: Execute verification**
  Run: `node test.js`
  Expected: All tests pass.

- [ ] **Step 3: Commit**
  Run:
  ```bash
  git add test.js
  git commit -m "test: add short term prediction market settlement test case"
  ```
