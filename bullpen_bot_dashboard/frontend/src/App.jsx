import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [wsConnected, setWsConnected] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [balances, setBalances] = useState({ solana: { USDC: 0, SOL: 0 }, hyperliquid: { USDC: 0, SPCX: 0 }, aggregated_balance_usd: 0 });
  const [pairStatus, setPairStatus] = useState({ setup_completed: false, positions: [], builder_fees_accrued: 0 });
  const [accountStatus, setAccountStatus] = useState({ maintenance_margin_usd: 0, margin_usage_usd: 0, available_margin_usd: 0, risk_level: 'LOW', positions_count: 0, open_orders_count: 0 });
  const [commandLogs, setCommandLogs] = useState([]);
  const [signalFeed, setSignalFeed] = useState([]);
  
  // Strategy Configurations
  const [strategies, setStrategies] = useState({
    pearPair: { enabled: false, sizeUsd: 22, targetPair: "BTC/ETH", baseRatio: 18.57, deviationThreshold: 0.015 },
    spreadFarming: { enabled: false, targetMarket: "xyz:SPCX", sizeUsd: 15, spreadThreshold: 0.004 },
    momentum: { enabled: false, targetMarket: "xyz:SPCX", notional: 20, leverage: 2, tpPct: 15, slPct: 10 },
    smartMoney: { enabled: false, targetAsset: "BTC", notional: 50, leverage: 2 }
  });

  const [maxMarginUsage, setMaxMarginUsage] = useState(5000);
  const [previewFirst, setPreviewFirst] = useState(true);

  // Manual Swap Form
  const [swapTokenA, setSwapTokenA] = useState('USDC');
  const [swapTokenB, setSwapTokenB] = useState('SOL');
  const [swapAmount, setSwapAmount] = useState('100');
  const [swapLoading, setSwapLoading] = useState(false);

  // Correlation deviation chart state
  const [devHistory, setDevHistory] = useState(Array(20).fill(0));

  const ws = useRef(null);

  useEffect(() => {
    connectWS();
    return () => {
      if (ws.current) ws.current.close();
    };
  }, []);

  const connectWS = () => {
    ws.current = new WebSocket('ws://localhost:3001');

    ws.current.onopen = () => {
      setWsConnected(true);
    };

    ws.current.onclose = () => {
      setWsConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connectWS, 3000);
    };

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'BOT_CONFIG') {
        setStrategies(msg.data.strategies);
        setReadOnly(msg.data.readOnly);
        setMaxMarginUsage(msg.data.risk.maxMarginUsage);
        setPreviewFirst(msg.data.risk.previewFirst);
      } else if (msg.type === 'PORTFOLIO_STATE') {
        if (msg.data.balances) setBalances(msg.data.balances);
        if (msg.data.pairStatus) setPairStatus(msg.data.pairStatus);
        if (msg.data.accountStatus) setAccountStatus(msg.data.accountStatus);
        setReadOnly(msg.data.readOnly);
      } else if (msg.type === 'COMMAND_LOGS') {
        setCommandLogs(msg.data);
      } else if (msg.type === 'SIGNAL_FEED') {
        setSignalFeed(msg.data);
      }
    };
  };

  // Simulate a rolling chart deviation line
  useEffect(() => {
    const timer = setInterval(() => {
      // Simulate minor price deviation for the visual chart
      setDevHistory(prev => {
        const next = [...prev.slice(1)];
        // Create an organic wave
        const lastVal = prev[prev.length - 1];
        const change = (Math.random() - 0.5) * 0.004;
        let nextVal = lastVal + change;
        // Clamp between -3.0% and +3.0%
        nextVal = Math.max(-0.03, Math.min(0.03, nextVal));
        next.push(nextVal);
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const updateBackendConfig = (updatedStrategies = strategies, isReadOnly = readOnly) => {
    fetch('http://localhost:3001/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        readOnly: isReadOnly,
        strategies: updatedStrategies,
        risk: {
          maxMarginUsage,
          previewFirst
        }
      })
    })
    .then(r => r.json())
    .catch(e => console.error("Error updating config:", e));
  };

  const handleStrategyToggle = (strategyKey) => {
    const updated = {
      ...strategies,
      [strategyKey]: {
        ...strategies[strategyKey],
        enabled: !strategies[strategyKey].enabled
      }
    };
    setStrategies(updated);
    updateBackendConfig(updated);
  };

  const handleParamChange = (strategyKey, paramKey, value) => {
    const parsedVal = isNaN(value) ? value : parseFloat(value);
    const updated = {
      ...strategies,
      [strategyKey]: {
        ...strategies[strategyKey],
        [paramKey]: parsedVal
      }
    };
    setStrategies(updated);
    updateBackendConfig(updated);
  };

  const triggerCircuitBreaker = () => {
    fetch('http://localhost:3001/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'circuit_breaker' })
    })
    .catch(e => console.error(e));
  };

  const triggerHlSetup = () => {
    fetch('http://localhost:3001/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hl_setup' })
    })
    .catch(e => console.error(e));
  };

  const handleSwapSubmit = (e) => {
    e.preventDefault();
    setSwapLoading(true);
    fetch('http://localhost:3001/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'solana_swap',
        params: {
          tokenA: swapTokenA,
          tokenB: swapTokenB,
          amount: parseFloat(swapAmount)
        }
      })
    })
    .then(r => r.json())
    .then(res => {
      setSwapLoading(false);
      if (res.error) alert(res.error);
    })
    .catch(err => {
      setSwapLoading(false);
      console.error(err);
    });
  };

  const handleClosePosition = (posId) => {
    fetch('http://localhost:3001/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'hl_cancel_all' // Simplified manual cancel for mock demo
      })
    });
  };

  // Convert deviation history to SVG path
  const generateSvgPath = () => {
    const width = 360;
    const height = 120;
    const xStep = width / (devHistory.length - 1);
    const yScale = height / 0.06; // Max range -3% to +3% (total 6%)
    
    return devHistory.map((val, index) => {
      const x = index * xStep;
      // Center of chart is height / 2. Up is subtract, Down is add
      const y = (height / 2) - (val * yScale);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  };

  return (
    <div className="dashboard">
      {/* Header Panel */}
      <header className="header panel">
        <div className="brand">
          <h1>Bullpen Dashboard</h1>
          <span className="badge">Agent Kit v1.2</span>
        </div>
        
        <div className="system-status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className={`status-dot ${wsConnected ? 'active' : ''}`}></div>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '500' }}>
              {wsConnected ? 'Connected to Bot Backend' : 'Reconnecting...'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: readOnly ? 'var(--color-amber)' : 'var(--color-green)', fontWeight: '600' }}>
              {readOnly ? 'READ-ONLY ACTIVE' : 'LIVE TRADING'}
            </span>
            <button 
              className="btn btn-secondary" 
              onClick={() => {
                const nextReadOnly = !readOnly;
                setReadOnly(nextReadOnly);
                updateBackendConfig(strategies, nextReadOnly);
              }}
              style={{ fontSize: '12px', padding: '6px 12px' }}
            >
              Toggle Mode
            </button>
            <button className="btn btn-danger" onClick={triggerCircuitBreaker}>
              🚨 EMERGENCY STOP
            </button>
          </div>
        </div>
      </header>

      {/* Sidebar Panel */}
      <aside className="sidebar">
        {/* Account Info */}
        <div className="panel" style={{ flex: 'none' }}>
          <h2>Portfolio Balance</h2>
          
          <div className="stat-card" style={{ marginBottom: '12px', background: 'rgba(0, 240, 255, 0.03)', borderColor: 'rgba(0, 240, 255, 0.15)' }}>
            <label>Total Account Balance</label>
            <div className="stat-value accent">${balances.aggregated_balance_usd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <label>Solana USDC</label>
              <div className="stat-value">${balances.solana.USDC.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <label>Solana SOL</label>
              <div className="stat-value" style={{ fontSize: '16px' }}>{balances.solana.SOL.toFixed(2)} SOL</div>
            </div>
            <div className="stat-card">
              <label>Hyperliquid USDC</label>
              <div className="stat-value">${balances.hyperliquid.USDC.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <label>HL SPCX Spot</label>
              <div className="stat-value" style={{ fontSize: '16px' }}>{balances.hyperliquid.SPCX.toFixed(2)} SPCX</div>
            </div>
          </div>

          {!pairStatus.setup_completed && (
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-amber)', marginBottom: '8px', lineHeight: '1.4' }}>
                ⚠️ Hyperliquid Agent Wallets are not approved.
              </div>
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={triggerHlSetup}>
                Approve EVM agent wallets
              </button>
            </div>
          )}
        </div>

        {/* Risk Management */}
        <div className="panel" style={{ flex: 'none' }}>
          <h2>Risk controls</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label>Max Margin Limit (USD)</label>
              <input 
                type="number" 
                value={maxMarginUsage} 
                onChange={(e) => {
                  setMaxMarginUsage(parseFloat(e.target.value));
                  updateBackendConfig();
                }}
              />
            </div>

            <div className="switch-container">
              <div className="switch-label">
                <span style={{ fontSize: '13px', fontWeight: '500' }}>Preview-First Paradigm</span>
                <span className="switch-subtext">Runs CLI --preview before signing trades</span>
              </div>
              <label className="switch">
                <input 
                  type="checkbox" 
                  checked={previewFirst} 
                  onChange={(e) => {
                    setPreviewFirst(e.target.checked);
                    updateBackendConfig();
                  }}
                />
                <span className="slider"></span>
              </label>
            </div>

            <div className="stat-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <label>Margin Usage</label>
                <div style={{ fontSize: '16px', fontWeight: '700', fontFamily: 'JetBrains Mono' }}>
                  ${accountStatus.margin_usage_usd.toFixed(2)} / ${maxMarginUsage}
                </div>
              </div>
              <span className={`badge ${accountStatus.risk_level === 'HIGH' ? 'btn-danger' : 'btn-secondary'}`} style={{ background: accountStatus.risk_level === 'HIGH' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)', color: accountStatus.risk_level === 'HIGH' ? 'var(--color-red)' : 'var(--color-green)' }}>
                {accountStatus.risk_level} RISK
              </span>
            </div>
          </div>
        </div>

        {/* Solana manual swap */}
        <div className="panel" style={{ flex: 'none' }}>
          <h2>Solana Token Swaps</h2>
          <form onSubmit={handleSwapSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label>From</label>
                <select value={swapTokenA} onChange={(e) => setSwapTokenA(e.target.value)}>
                  <option value="USDC">USDC</option>
                  <option value="SOL">SOL</option>
                </select>
              </div>
              <div>
                <label>To</label>
                <select value={swapTokenB} onChange={(e) => setSwapTokenB(e.target.value)}>
                  <option value="SOL">SOL</option>
                  <option value="USDC">USDC</option>
                </select>
              </div>
            </div>
            <div>
              <label>Amount</label>
              <input type="number" value={swapAmount} onChange={(e) => setSwapAmount(e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: '4px' }} disabled={swapLoading}>
              {swapLoading ? 'Routing...' : 'Swap via Jupiter'}
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Strategy Control Panel */}
        <div className="panel full-width">
          <h2>Automated Trading Strategies</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '18px' }} className="responsive-strategies">
            {/* 1. Pear Pair Trading */}
            <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: `4px solid ${strategies.pearPair.enabled ? 'var(--color-cyan)' : 'var(--glass-border)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Pear Pair Trading</h3>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Marktneutrale Arbitrage BTC/ETH</p>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={strategies.pearPair.enabled} onChange={() => handleStrategyToggle('pearPair')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Position Size (USD)</label>
                  <input type="number" value={strategies.pearPair.sizeUsd} onChange={(e) => handleParamChange('pearPair', 'sizeUsd', e.target.value)} />
                </div>
                <div>
                  <label>Deviation Entry (%)</label>
                  <input type="number" step="0.001" value={strategies.pearPair.deviationThreshold} onChange={(e) => handleParamChange('pearPair', 'deviationThreshold', e.target.value)} />
                </div>
                <div>
                  <label>Base Correlation Ratio</label>
                  <input type="number" step="0.01" value={strategies.pearPair.baseRatio} onChange={(e) => handleParamChange('pearPair', 'baseRatio', e.target.value)} />
                </div>
              </div>
            </div>

            {/* 2. Spread Farming */}
            <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: `4px solid ${strategies.spreadFarming.enabled ? 'var(--color-cyan)' : 'var(--glass-border)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '600' }}>HIP-3 & Spot Spread Farming</h3>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Limit Order Maker spread capture on SPCX</p>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={strategies.spreadFarming.enabled} onChange={() => handleStrategyToggle('spreadFarming')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Maker Size (USD)</label>
                  <input type="number" value={strategies.spreadFarming.sizeUsd} onChange={(e) => handleParamChange('spreadFarming', 'sizeUsd', e.target.value)} />
                </div>
                <div>
                  <label>Target Spread (%)</label>
                  <input type="number" step="0.001" value={strategies.spreadFarming.spreadThreshold} onChange={(e) => handleParamChange('spreadFarming', 'spreadThreshold', e.target.value)} />
                </div>
              </div>
            </div>

            {/* 3. Momentum & News-driven */}
            <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: `4px solid ${strategies.momentum.enabled ? 'var(--color-cyan)' : 'var(--glass-border)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Momentum & News Trading</h3>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Solana/Hyperliquid aggressive news-driven IOC purchases</p>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={strategies.momentum.enabled} onChange={() => handleStrategyToggle('momentum')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Size (USDC)</label>
                  <input type="number" value={strategies.momentum.notional} onChange={(e) => handleParamChange('momentum', 'notional', e.target.value)} />
                </div>
                <div>
                  <label>Leverage</label>
                  <input type="number" value={strategies.momentum.leverage} onChange={(e) => handleParamChange('momentum', 'leverage', e.target.value)} />
                </div>
                <div>
                  <label>Take Profit (%)</label>
                  <input type="number" value={strategies.momentum.tpPct} onChange={(e) => handleParamChange('momentum', 'tpPct', e.target.value)} />
                </div>
                <div>
                  <label>Stop Loss (%)</label>
                  <input type="number" value={strategies.momentum.slPct} onChange={(e) => handleParamChange('momentum', 'slPct', e.target.value)} />
                </div>
              </div>
            </div>

            {/* 4. Smart Money Tracking */}
            <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: `4px solid ${strategies.smartMoney.enabled ? 'var(--color-cyan)' : 'var(--glass-border)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Smart Money Copy Trading</h3>
                  <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Copy trade Polymarket whale transaction feeds on Hyperliquid</p>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={strategies.smartMoney.enabled} onChange={() => handleStrategyToggle('smartMoney')} />
                  <span className="slider"></span>
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                <div>
                  <label>Copy Trade Size</label>
                  <input type="number" value={strategies.smartMoney.notional} onChange={(e) => handleParamChange('smartMoney', 'notional', e.target.value)} />
                </div>
                <div>
                  <label>Leverage</label>
                  <input type="number" value={strategies.smartMoney.leverage} onChange={(e) => handleParamChange('smartMoney', 'leverage', e.target.value)} />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Positions & Real-time chart */}
        <div className="panel">
          <h2>Active Positions & Margin Details</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Details</th>
                  <th>Size</th>
                  <th>Leverage</th>
                  <th>PnL</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pairStatus.positions && pairStatus.positions.length > 0 ? (
                  pairStatus.positions.map(pos => {
                    const dev = (pos.currentPriceLong / pos.currentPriceShort);
                    const base = pos.longAsset === 'BTC' ? (pos.entryPriceLong / pos.entryPriceShort) : (pos.entryPriceShort / pos.entryPriceLong);
                    const curDev = (dev - base) / base;
                    return (
                      <tr key={pos.id}>
                        <td><span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }}>{pos.id}</span></td>
                        <td><span className="badge" style={{ background: 'rgba(139, 92, 246, 0.1)', color: 'var(--color-violet)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>Pair Trade</span></td>
                        <td>
                          <span style={{ fontWeight: '500' }}>Long {pos.longAsset} / Short {pos.shortAsset}</span>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                            Entry ratio: {base.toFixed(3)} | Current: {dev.toFixed(3)}
                          </div>
                        </td>
                        <td>${pos.sizeUsd}</td>
                        <td>1x</td>
                        <td className={curDev >= 0 ? 'up' : 'down'} style={{ fontWeight: '700' }}>
                          ${(pos.sizeUsd * curDev).toFixed(2)}
                        </td>
                        <td>
                          <button className="btn btn-danger" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => handleClosePosition(pos.id)}>
                            Close (TWAP)
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>
                      No active market-neutral pairs or perpetual positions open.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Live SVG Deviation Chart */}
        <div className="panel">
          <h2>BTC/ETH Ratio Deviation</h2>
          <div className="chart-container">
            <svg width="360" height="120" style={{ overflow: 'visible' }}>
              {/* Reference Gridlines */}
              <line x1="0" y1="60" x2="360" y2="60" className="chart-center" />
              {/* Positive threshold line at 1.5% */}
              <line x1="0" y1="30" x2="360" y2="30" className="chart-threshold" />
              {/* Negative threshold line at -1.5% */}
              <line x1="0" y1="90" x2="360" y2="90" className="chart-threshold" />
              
              <text x="5" y="25" fill="var(--color-red)" fontSize="10" opacity="0.6">Upper Threshold (+1.5%)</text>
              <text x="5" y="115" fill="var(--color-red)" fontSize="10" opacity="0.6">Lower Threshold (-1.5%)</text>
              
              {/* Path */}
              <path d={generateSvgPath()} className="chart-line" />
            </svg>
            <div style={{ position: 'absolute', bottom: '8px', right: '12px', fontSize: '11px', color: 'var(--color-text-muted)', display: 'flex', gap: '8px' }}>
              <span>Live Deviation:</span>
              <span className={devHistory[devHistory.length-1] >= 0 ? 'up' : 'down'} style={{ fontWeight: '700' }}>
                {(devHistory[devHistory.length-1] * 100).toFixed(3)}%
              </span>
            </div>
          </div>
        </div>

        {/* Live Signal Feed */}
        <div className="panel">
          <h2>News Alerts & Polymarket Signals</h2>
          <div className="signal-list">
            {signalFeed.length > 0 ? (
              signalFeed.map(sig => (
                <div key={sig.id} className={`signal-card ${sig.impact}`}>
                  <div className="signal-meta">
                    <span className="signal-source">{sig.source}</span>
                    <span>{new Date(sig.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="signal-text">{sig.text}</div>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>
                Waiting for signals and whale alerts...
              </div>
            )}
          </div>
        </div>

        {/* Live CLI Console */}
        <div className="panel">
          <h2>Bullpen CLI Process Log</h2>
          <div className="terminal">
            {commandLogs.length > 0 ? (
              commandLogs.map((log, index) => (
                <div key={index} className="terminal-entry">
                  <div className="terminal-header">
                    <span>{log.command}</span>
                    <span>{log.duration_ms}ms | exit: {log.exitCode}</span>
                  </div>
                  {log.stdout && (
                    <div className="terminal-body">
                      {log.stdout}
                    </div>
                  )}
                  {log.stderr && (
                    <div className="terminal-body terminal-stderr">
                      {log.stderr}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>
                Console initialized. Waiting for CLI commands to execute...
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
