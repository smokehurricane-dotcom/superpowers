# Design Spec: Automated Short-Term Crypto Prediction Trading (pUSD)

## Context & Objectives
To enable simulated automated prediction trading on short-term crypto price swings using pUSD, we will implement dynamic 5-minute and 15-minute UP/DOWN binary prediction markets. 

## Architectural Changes

### 1. Mock CLI (`mock-bullpen.js` & `sim_state.json`)
* **New Command**: `bullpen polymarket markets --output json`
  * Returns the list of active prediction markets.
* **State Management**:
  * We will add a `polymarket_markets` array in `sim_state.json`.
  * The backend simulator will initialize and update these markets.
  * Short-term prediction markets will track:
    * `id`: unique market identifier (e.g. `will-btc-be-up-in-5-min`).
    * `asset`: underlying asset (`BTC`, `ETH`, or `SOL`).
    * `interval`: duration (`5` or `15` minutes).
    * `startAssetPrice`: asset price at interval start.
    * `startTime`: ISO timestamp of start.
    * `endTime`: ISO timestamp of expiry.
    * `currentYesPrice`: dynamically shifted price of YES token based on price deviation.
    * `currentNoPrice`: dynamic price of NO token (`1.0 - currentYesPrice`).
* **Auto-Settlement and Roll-Over**:
  * The simulator loop (every 3 seconds) checks if any market's `endTime` has passed.
  * If expired:
    * Compare final asset price to `startAssetPrice`.
    * If `finalPrice > startAssetPrice`, YES resolves to $1.00 and NO to $0.00.
    * If `finalPrice <= startAssetPrice`, NO resolves to $1.00 and YES to $0.00.
    * Pay out active user positions matching the resolved outcome.
    * Refund/adjust the `polymarket.pusd` balance for YES/NO share contracts.
    * Remove resolved positions and log them to history.
    * Re-initialize a new market interval with the current asset price as the new `startAssetPrice`.

### 2. Strategy Engine (`bot-backend.js`)
* **Dynamic Category Scanning**:
  * Query `polymarket markets` to scan all active prediction markets.
  * Filter based on enabled assets and intervals in the config.
* **Trend Analysis & Entry**:
  * Keep track of historical prices of BTC, ETH, and SOL (e.g., store a rolling list of the last 5 prices).
  * If no current position exists for a given market, calculate the short-term trend (e.g. last price vs average of last 5).
  * If positive trend, execute `polymarket buy` for **YES**.
  * If negative trend, execute `polymarket buy` for **NO**.
  * Execute buy orders using the `runCLI` utility, respecting `previewFirst`.

### 3. Frontend Dashboard (`App.jsx`)
* **Configuration UI**:
  * Update the Polymarket Prediction strategy card to allow toggling:
    * Supported assets (`BTC`, `ETH`, `SOL`).
    * Supported intervals (`5 Min`, `15 Min`).
* **Open Positions UI**:
  * Display countdown timer to settlement.
  * Display the entry asset price and current asset price.
