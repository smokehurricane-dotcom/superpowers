import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [wsConnected, setWsConnected] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'positions'
  const [balances, setBalances] = useState({ solana: { USDC: 0, SOL: 0, CHZ: 0 }, hyperliquid: { USDC: 0, SPCX: 0 }, polymarket: { pUSD: 0 }, aggregated_balance_usd: 0 });
  const [pairStatus, setPairStatus] = useState({ setup_completed: false, positions: [], builder_fees_accrued: 0 });
  const [accountStatus, setAccountStatus] = useState({ maintenance_margin_usd: 0, margin_usage_usd: 0, available_margin_usd: 0, risk_level: 'LOW', positions_count: 0, open_orders_count: 0 });
  const [commandLogs, setCommandLogs] = useState([]);
  const [signalFeed, setSignalFeed] = useState([]);
  const [simState, setSimState] = useState(null);
  
  // Simulated probabilities from WebSocket
  const [weatherProb, setWeatherProb] = useState(0.50);
  const [sportsProb, setSportsProb] = useState(0.50);

  // Strategy Configurations
  const [strategies, setStrategies] = useState({
    pearPair: { enabled: false, sizeUsd: 22, targetPair: "BTC/ETH", baseRatio: 18.57, deviationThreshold: 0.015 },
    spreadFarming: { enabled: false, targetMarket: "xyz:SPCX", sizeUsd: 15, spreadThreshold: 0.004 },
    momentum: { enabled: false, targetMarket: "xyz:SPCX", notional: 20, leverage: 2, tpPct: 15, slPct: 10 },
    smartMoney: { enabled: false, targetAsset: "BTC", notional: 50, leverage: 2 },
    binaryMomentum: { enabled: false, targetAsset: "BTC", notional: 50, leverage: 5, durationMinutes: 5 },
    weatherHedging: { enabled: false, targetAsset: "BTC", sizeUsd: 100, probabilityThreshold: 0.70 },
    sportsFanToken: { enabled: false, targetToken: "CHZ", sizeUsd: 150, probabilityShiftThreshold: 0.10 },
    polymarketPredictions: { enabled: false, targetMarket: "will-btc-reach-100k-in-2026", outcome: "yes", sizeUsd: 100 }
  });

  const [maxMarginUsage, setMaxMarginUsage] = useState(5000);
  const [previewFirst, setPreviewFirst] = useState(true);

  // Manual Swap Form
  const [swapTokenA, setSwapTokenA] = useState('USDC');
  const [swapTokenB, setSwapTokenB] = useState('SOL');
  const [swapAmount, setSwapAmount] = useState('100');
  const [swapLoading, setSwapLoading] = useState(false);

  // Manual Position Opener
  const [manualAsset, setManualAsset] = useState('BTC');
  const [manualDirection, setManualDirection] = useState('long');
  const [manualSize, setManualSize] = useState('100');
  const [manualLeverage, setManualLeverage] = useState('5');
  const [manualTp, setManualTp] = useState('');
  const [manualSl, setManualSl] = useState('');
  const [tradeLoading, setTradeLoading] = useState(false);

  // Manual Prediction Form
  const [polyMarketSlug, setPolyMarketSlug] = useState('will-btc-reach-100k-in-2026');
  const [polyOutcome, setPolyOutcome] = useState('yes');
  const [polyAmount, setPolyAmount] = useState('250');
  const [polyLoading, setPolyLoading] = useState(false);

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
    ws.current = new WebSocket('ws://127.0.0.1:3001');

    ws.current.onopen = () => {
      setWsConnected(true);
    };

    ws.current.onclose = () => {
      setWsConnected(false);
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
      } else if (msg.type === 'FULL_STATE') {
        setSimState(msg.data);
      } else if (msg.type === 'WEATHER_FORECAST') {
        setWeatherProb(msg.data.probability);
      } else if (msg.type === 'SPORTS_PROBABILITY') {
        setSportsProb(msg.data.probability);
      }
    };
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setDevHistory(prev => {
        const next = [...prev.slice(1)];
        const lastVal = prev[prev.length - 1];
        const change = (Math.random() - 0.5) * 0.004;
        let nextVal = lastVal + change;
        nextVal = Math.max(-0.03, Math.min(0.03, nextVal));
        next.push(nextVal);
        return next;
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const updateBackendConfig = (updatedStrategies = strategies, isReadOnly = readOnly) => {
    fetch('http://127.0.0.1:3001/api/config', {
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
    fetch('http://127.0.0.1:3001/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'circuit_breaker' })
    })
    .catch(e => console.error(e));
  };

  const triggerHlSetup = () => {
    fetch('http://127.0.0.1:3001/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'hl_setup' })
    })
    .catch(e => console.error(e));
  };

  const handleSwapSubmit = (e) => {
    e.preventDefault();
    setSwapLoading(true);
    fetch('http://127.0.0.1:3001/api/action', {
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

  const handleManualTrade = (e) => {
    e.preventDefault();
    setTradeLoading(true);
    fetch('http://127.0.0.1:3001/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'manual_trade',
        params: {
          asset: manualAsset,
          direction: manualDirection,
          notional: parseFloat(manualSize),
          leverage: parseFloat(manualLeverage),
          tp: manualTp ? parseFloat(manualTp) : null,
          sl: manualSl ? parseFloat(manualSl) : null
        }
      })
    })
    .then(r => r.json())
    .then(res => {
      setTradeLoading(false);
      if (res.error) alert(res.error);
    })
    .catch(err => {
      setTradeLoading(false);
      console.error(err);
    });
  };

  const handlePolyTrade = (e) => {
    e.preventDefault();
    setPolyLoading(true);
    fetch('http://127.0.0.1:3001/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'polymarket_buy',
        params: {
          market: polyMarketSlug,
          outcome: polyOutcome,
          amount: parseFloat(polyAmount)
        }
      })
    })
    .then(r => r.json())
    .then(res => {
      setPolyLoading(false);
      if (res.error) alert(res.error);
    })
    .catch(err => {
      setPolyLoading(false);
      console.error(err);
    });
  };

  const handleCancelOrder = (orderId) => {
    fetch('http://127.0.0.1:3001/api/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel_order', params: { orderId } })
    });
  };

  const handleClosePosition = (posId, type) => {
    if (type === 'prediction') {
      fetch('http://127.0.0.1:3001/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'polymarket_sell', params: { posId } })
      });
    } else {
      fetch('http://127.0.0.1:3001/api/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hl_cancel_all' })
      });
    }
  };

  const generateSvgPath = () => {
    const width = 360;
    const height = 120;
    const xStep = width / (devHistory.length - 1);
    const yScale = height / 0.06;
    
    return devHistory.map((val, index) => {
      const x = index * xStep;
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

        {/* Tab Selection */}
        <div style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
          <button 
            onClick={() => setActiveTab('dashboard')} 
            className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
          >
            📈 Control Center
          </button>
          <button 
            onClick={() => setActiveTab('positions')} 
            className={`btn ${activeTab === 'positions' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px' }}
          >
            💼 Open Positions & Orders
          </button>
        </div>
        
        <div className="system-status">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className={`status-dot ${wsConnected ? 'active' : ''}`}></div>
            <span style={{ fontSize: '13px', color: 'var(--color-text-muted)', fontWeight: '500' }}>
              {wsConnected ? 'Connected' : 'Offline'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: readOnly ? 'var(--color-amber)' : 'var(--color-green)', fontWeight: '600' }}>
              {readOnly ? 'READ-ONLY' : 'LIVE'}
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
              Mode
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
              <label>Solana CHZ Fan</label>
              <div className="stat-value" style={{ fontSize: '16px' }}>{(balances.solana.CHZ || 0.0).toFixed(1)} CHZ</div>
            </div>
            <div className="stat-card">
              <label>Hyperliquid USDC</label>
              <div className="stat-value">${balances.hyperliquid.USDC.toFixed(2)}</div>
            </div>
            <div className="stat-card">
              <label>HL SPCX Spot</label>
              <div className="stat-value" style={{ fontSize: '16px' }}>{balances.hyperliquid.SPCX.toFixed(2)} SPCX</div>
            </div>
            <div className="stat-card" style={{ background: 'rgba(139, 92, 246, 0.03)' }}>
              <label>Polymarket pUSD</label>
              <div className="stat-value" style={{ color: 'var(--color-violet)' }}>${(balances.polymarket?.pUSD || 0.0).toFixed(2)}</div>
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
                <span className="switch-subtext">Runs CLI --preview before trades</span>
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
                  <option value="CHZ">CHZ</option>
                </select>
              </div>
              <div>
                <label>To</label>
                <select value={swapTokenB} onChange={(e) => setSwapTokenB(e.target.value)}>
                  <option value="SOL">SOL</option>
                  <option value="USDC">USDC</option>
                  <option value="CHZ">CHZ</option>
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
        {activeTab === 'dashboard' ? (
          <>
            {/* Strategy Control Panel */}
            <div className="panel full-width">
              <h2>Automated Trading Strategies</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '18px' }} className="responsive-strategies">
                {/* NEW: Polymarket Direct pUSD Prediction Trading Strategy */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: `4px solid ${strategies.polymarketPredictions?.enabled ? 'var(--color-violet)' : 'var(--glass-border)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '600', color: 'var(--color-text-main)' }}>Direct Polymarket pUSD Prediction Trader</h3>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Buys prediction market shares directly using pUSD balance based on news/alerts</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={strategies.polymarketPredictions?.enabled} onChange={() => handleStrategyToggle('polymarketPredictions')} />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                    <div>
                      <label>Trade Size (pUSD)</label>
                      <input type="number" value={strategies.polymarketPredictions?.sizeUsd} onChange={(e) => handleParamChange('polymarketPredictions', 'sizeUsd', e.target.value)} />
                    </div>
                    <div>
                      <label>Target Market (Slug)</label>
                      <input type="text" value={strategies.polymarketPredictions?.targetMarket} onChange={(e) => handleParamChange('polymarketPredictions', 'targetMarket', e.target.value)} />
                    </div>
                    <div>
                      <label>Outcome</label>
                      <select value={strategies.polymarketPredictions?.outcome} onChange={(e) => handleParamChange('polymarketPredictions', 'outcome', e.target.value)}>
                        <option value="yes">YES</option>
                        <option value="no">NO</option>
                      </select>
                    </div>
                  </div>
                </div>

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

                {/* Weather Hedging Strategy */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: `4px solid ${strategies.weatherHedging.enabled ? 'var(--color-cyan)' : 'var(--glass-border)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Polymarket Weather Hedger</h3>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Shorts BTC perps when Heatwave risk rises to hedge miner power curtailment</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={strategies.weatherHedging.enabled} onChange={() => handleStrategyToggle('weatherHedging')} />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                    <div>
                      <label>Hedge Size (USDC)</label>
                      <input type="number" value={strategies.weatherHedging.sizeUsd} onChange={(e) => handleParamChange('weatherHedging', 'sizeUsd', e.target.value)} />
                    </div>
                    <div>
                      <label>Heatwave Trigger Prob (%)</label>
                      <input type="number" step="0.01" value={strategies.weatherHedging.probabilityThreshold} onChange={(e) => handleParamChange('weatherHedging', 'probabilityThreshold', e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                      <div>
                        <label style={{ fontSize: '10px' }}>Miami Heatwave Prob</label>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-amber)', fontFamily: 'JetBrains Mono' }}>
                          {(weatherProb * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sports Fan Token Strategy */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: `4px solid ${strategies.sportsFanToken.enabled ? 'var(--color-cyan)' : 'var(--glass-border)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '600' }}>Sports Sentiment & Fan Tokens</h3>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Swaps Solana USDC into Fan Tokens (CHZ) on rapid Polymarket win probability shifts</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={strategies.sportsFanToken.enabled} onChange={() => handleStrategyToggle('sportsFanToken')} />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                    <div>
                      <label>Swap Size (USDC)</label>
                      <input type="number" value={strategies.sportsFanToken.sizeUsd} onChange={(e) => handleParamChange('sportsFanToken', 'sizeUsd', e.target.value)} />
                    </div>
                    <div>
                      <label>Shift Trigger (%)</label>
                      <input type="number" step="0.01" value={strategies.sportsFanToken.probabilityShiftThreshold} onChange={(e) => handleParamChange('sportsFanToken', 'probabilityShiftThreshold', e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                      <div>
                        <label style={{ fontSize: '10px' }}>Real Madrid Win Prob</label>
                        <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--color-cyan)', fontFamily: 'JetBrains Mono' }}>
                          {(sportsProb * 100).toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. 5-Min Binary Momentum Strategy */}
                <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', gap: '14px', borderLeft: `4px solid ${strategies.binaryMomentum.enabled ? 'var(--color-cyan)' : 'var(--glass-border)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ fontSize: '15px', fontWeight: '600' }}>5-Minute Binary Momentum (Up/Down Trend)</h3>
                      <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>Trades short-term 5-min price momentum swings (Long/Short)</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" checked={strategies.binaryMomentum.enabled} onChange={() => handleStrategyToggle('binaryMomentum')} />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px' }}>
                    <div>
                      <label>Trade Size (USD)</label>
                      <input type="number" value={strategies.binaryMomentum.notional} onChange={(e) => handleParamChange('binaryMomentum', 'notional', e.target.value)} />
                    </div>
                    <div>
                      <label>Leverage</label>
                      <input type="number" value={strategies.binaryMomentum.leverage} onChange={(e) => handleParamChange('binaryMomentum', 'leverage', e.target.value)} />
                    </div>
                    <div>
                      <label>Exit Duration (Mins)</label>
                      <input type="number" value={strategies.binaryMomentum.durationMinutes} onChange={(e) => handleParamChange('binaryMomentum', 'durationMinutes', e.target.value)} />
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

            {/* Real-time ratio chart */}
            <div className="panel">
              <h2>BTC/ETH Ratio Deviation</h2>
              <div className="chart-container">
                <svg width="360" height="120" style={{ overflow: 'visible' }}>
                  <line x1="0" y1="60" x2="360" y2="60" className="chart-center" />
                  <line x1="0" y1="30" x2="360" y2="30" className="chart-threshold" />
                  <line x1="0" y1="90" x2="360" y2="90" className="chart-threshold" />
                  <text x="5" y="25" fill="var(--color-red)" fontSize="10" opacity="0.6">Upper Threshold (+1.5%)</text>
                  <text x="5" y="115" fill="var(--color-red)" fontSize="10" opacity="0.6">Lower Threshold (-1.5%)</text>
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
            <div className="panel full-width">
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
          </>
        ) : (
          /* Tab: Positions & Manual Orders */
          <>
            {/* Manual Trade Execution Forms */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }} className="manual-grids">
              {/* Manual Perp Form */}
              <div className="panel">
                <h2>Manual Perp Execution (Hyperliquid)</h2>
                <form onSubmit={handleManualTrade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label>Asset</label>
                      <select value={manualAsset} onChange={(e) => setManualAsset(e.target.value)}>
                        <option value="BTC">BTC</option>
                        <option value="ETH">ETH</option>
                        <option value="SPCX">SPCX</option>
                      </select>
                    </div>
                    <div>
                      <label>Direction</label>
                      <select value={manualDirection} onChange={(e) => setManualDirection(e.target.value)}>
                        <option value="long">LONG (Up)</option>
                        <option value="short">SHORT (Down)</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label>Notional Size (USD)</label>
                      <input type="number" value={manualSize} onChange={(e) => setManualSize(e.target.value)} />
                    </div>
                    <div>
                      <label>Leverage</label>
                      <input type="number" value={manualLeverage} onChange={(e) => setManualLeverage(e.target.value)} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label>Take Profit (TP Price)</label>
                      <input type="number" step="0.01" placeholder="Optional" value={manualTp} onChange={(e) => setManualTp(e.target.value)} />
                    </div>
                    <div>
                      <label>Stop Loss (SL Price)</label>
                      <input type="number" step="0.01" placeholder="Optional" value={manualSl} onChange={(e) => setManualSl(e.target.value)} />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ marginTop: '6px' }} disabled={tradeLoading}>
                    {tradeLoading ? 'Routing Order...' : `Open Manual Perp (${manualDirection.toUpperCase()})`}
                  </button>
                </form>
              </div>

              {/* NEW: Manual Polymarket Prediction Form */}
              <div className="panel" style={{ borderLeft: '3px solid var(--color-violet)' }}>
                <h2>Manual Prediction Order (Polymarket pUSD)</h2>
                <form onSubmit={handlePolyTrade} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div>
                      <label>Market (Slug / ID)</label>
                      <input type="text" value={polyMarketSlug} onChange={(e) => setPolyMarketSlug(e.target.value)} />
                    </div>
                    <div>
                      <label>Outcome</label>
                      <select value={polyOutcome} onChange={(e) => setPolyOutcome(e.target.value)}>
                        <option value="yes">YES (Up)</option>
                        <option value="no">NO (Down)</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label>Amount (pUSD)</label>
                    <input type="number" value={polyAmount} onChange={(e) => setPolyAmount(e.target.value)} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ marginTop: '6px', background: 'var(--color-violet)', color: '#fff' }} disabled={polyLoading}>
                    {polyLoading ? 'Submitting pUSD order...' : `Buy Polymarket prediction (${polyOutcome.toUpperCase()})`}
                  </button>
                </form>
              </div>
            </div>

            {/* Positions Table */}
            <div className="panel full-width">
              <h2>Open Positions</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Market</th>
                      <th>Type</th>
                      <th>Direction / Details</th>
                      <th>Size</th>
                      <th>Lev / Shares</th>
                      <th>Entry Price</th>
                      <th>Current Price</th>
                      <th>Live PnL</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simState?.positions && simState.positions.length > 0 ? (
                      simState.positions.map(pos => {
                        let isUp = true;
                        let pnl = 0;
                        let details = "";
                        
                        if (pos.type === 'pair') {
                          const dev = (pos.currentPriceLong / pos.currentPriceShort);
                          const base = pos.longAsset === 'BTC' ? (pos.entryPriceLong / pos.entryPriceShort) : (pos.entryPriceShort / pos.entryPriceLong);
                          const curDev = (dev - base) / base;
                          pnl = pos.sizeUsd * curDev;
                          isUp = pnl >= 0;
                          details = `Long ${pos.longAsset} / Short ${pos.shortAsset}`;
                        } else if (pos.type === 'prediction') {
                          // Direct prediction positions
                          pnl = pos.shares * (pos.currentPrice - pos.entryPrice);
                          isUp = pnl >= 0;
                          details = `${pos.outcome.toUpperCase()} prediction`;
                        } else {
                          const curPrice = simState.prices[pos.market.replace('xyz:', '')] || pos.entryPrice;
                          const ratio = (curPrice - pos.entryPrice) / pos.entryPrice;
                          pnl = pos.size * ratio * (pos.direction === 'long' ? 1 : -1);
                          isUp = pnl >= 0;
                          details = pos.direction.toUpperCase();
                        }

                        return (
                          <tr key={pos.id}>
                            <td><span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }}>{pos.id}</span></td>
                            <td>{pos.market || 'BTC/ETH'}</td>
                            <td>
                              <span className="badge" style={{ 
                                background: pos.type === 'pair' ? 'rgba(139, 92, 246, 0.1)' : pos.type === 'prediction' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(0, 240, 255, 0.1)', 
                                color: pos.type === 'pair' ? 'var(--color-violet)' : pos.type === 'prediction' ? 'var(--color-violet)' : 'var(--color-cyan)', 
                                border: pos.type === 'pair' ? '1px solid rgba(139, 92, 246, 0.3)' : pos.type === 'prediction' ? '1px solid var(--color-violet)' : '1px solid rgba(0, 240, 255, 0.3)' 
                              }}>
                                {pos.type.toUpperCase()}
                              </span>
                            </td>
                            <td><span style={{ fontWeight: '600' }}>{details}</span></td>
                            <td>${pos.sizeUsd || pos.size}</td>
                            <td>{pos.type === 'prediction' ? `${pos.shares.toFixed(1)} shares` : `${pos.leverage || '1'}x`}</td>
                            <td>${(pos.entryPriceLong || pos.entryPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                            <td>${(pos.currentPriceLong || pos.currentPrice || simState.prices[pos.market.replace('xyz:', '')] || pos.entryPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                            <td className={isUp ? 'up' : 'down'} style={{ fontWeight: '700' }}>
                              ${pnl.toFixed(2)}
                            </td>
                            <td>
                              <button className="btn btn-danger" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => handleClosePosition(pos.id, pos.type)}>
                                Close
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="10" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>
                          No active positions found in ledger.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Active Limit Orders */}
            <div className="panel full-width">
              <h2>Open Limit Orders</h2>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Market</th>
                      <th>Direction</th>
                      <th>Size (USDC)</th>
                      <th>Limit Price / Rules</th>
                      <th>Created</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simState?.orders && simState.orders.length > 0 ? (
                      simState.orders.map(ord => (
                        <tr key={ord.id}>
                          <td><span style={{ fontFamily: 'JetBrains Mono', fontSize: '11px' }}>{ord.id}</span></td>
                          <td>{ord.market}</td>
                          <td>
                            <span style={{ color: ord.direction === 'long' || ord.direction === 'buy' ? 'var(--color-green)' : 'var(--color-red)', fontWeight: '700' }}>
                              {ord.direction.toUpperCase()}
                            </span>
                          </td>
                          <td>${ord.size}</td>
                          <td>
                            {ord.price ? `$${ord.price}` : 'Midpoint Market'}
                            {ord.postOnly && <span className="badge" style={{ marginLeft: '8px', fontSize: '10px' }}>ALO</span>}
                          </td>
                          <td>{new Date(ord.timestamp).toLocaleTimeString()}</td>
                          <td>
                            <button className="btn btn-danger" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => handleCancelOrder(ord.id)}>
                              Cancel
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '24px' }}>
                          No pending limit orders on the book.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
