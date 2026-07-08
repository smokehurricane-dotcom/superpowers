# Polymarket-Bot (Paper-Phase)

Kronos-Signal -> Polymarket-Preis -> gebuehrenbewusste Edge -> virtuelles 100-USD-Konto.

## Bausteine
- config.py        Parameter (Kapital, Edge-Schwelle, Kelly, Fee, Modell)
- klines.py        Live-BTC-Klines von Binance (5m/15m/1d)
- kronos_signal.py P(up) via Kronos (mini|base, gecached)
- polymarket.py    Slug-Bau + Live-Preis via bullpen CLI (read-only)
- futures_signal.py Binance-Futures-Ensemble (Kaufman ER + Momentum + Trend-EMA + Funding)
- edge.py          EV + fractional Kelly (Fee + Spread eingerechnet)
- paper_engine.py  100-USD-Konto, Equity = Cash + MTM offener Positionen
- runner.py        Orchestrator: scan / status / resolve
- copy_trader.py   Top-Trader selektieren + via 'bullpen tracker copy' spiegeln (Kauf+Verkauf)
- dashboard.py     Web-Dashboard (stdlib): Auto-Scan alle 5 Min, Positionen verkaufen per Button
- backtest.py      Richtungs-Trefferquote + Kalibrierung je Coin (Benchmark 52.6% nach Fee + Naive-Baseline)

## Dashboard
    python dashboard.py        # -> http://127.0.0.1:8787 (auch aus Windows-Browser via localhost)
Scannt alle 5 Min automatisch, zeigt Opportunities (alle Timeframes, mit Kronos→Ensemble),
offene Paper-Positionen mit Live-Mark-Preis + Verkaufen-Button, und kopierbare Top-Trader.
Zusaetzlich (60s-Loop): echtes pUSD-Guthaben, aktive Copy-Subscriptions und kopierte Trades
(Executions) live von bullpen. 'Jetzt scannen' triggert einen Sofort-Scan.

## Copy-Trading (Echtgeld)
    python copy_trader.py recommend                 # kopierbare Trader vorschlagen (read-only)
    python copy_trader.py start <addr>              # Befehl zeigen (DRY)
    python copy_trader.py start <addr> --execute    # ECHTES Copy-Trading starten (mirror_sells, confirm)
Wichtig: hoechster PnL != kopierbar. Selektor nutzt copyability + win-rate + PnL,
schliesst Bots/Whales/degen aus. Caps in config.py (CopySettings).
Polymarket-Mindestgroesse ~$10/Trade. Steuern/Stoppen:
    bullpen tracker copy list        # aktive Subscriptions
    bullpen tracker copy executions  # ausgefuehrte Kopien
    bullpen tracker copy pause <id>  # pausieren
    bullpen tracker copy stop  <id>  # beenden
LIVE seit 2026-06-04: 0x91e8a6ed… (#1) + 0xe47c17e9… (#2), auto, mirror_sells.

## Coins (Multi-Asset)
BTC, ETH, SOL, XRP, DOGE, BNB (config.ASSETS). Daily-Slug <name>-up-or-down-on-<datum>,
Intraday <prefix>-updown-<tf>-<ts>. Cardano/Avalanche: kaum Up/Down-Maerkte.

## Nutzung (im venv ~/kronos-venv)
    python runner.py scan --asset BTC ETH SOL XRP DOGE BNB --tf daily 15m --model mini
    python runner.py scan --asset BTC --tf daily --model both --dry   # Modellvergleich
    python runner.py status
    python runner.py resolve <slug> <Up|Down>              # aufgeloesten Markt verbuchen

## WICHTIG / offen
- Markt-Fee = 10% (1000 bps) -> Edge muss Fee+Spread schlagen. Viele Maerkte werden (korrekt) abgelehnt.
- Signalqualitaet UNVALIDIERT. Daily-Forecast sieht die laufende Tageskerze nicht -> Scheinedge moeglich.
  Vor Echtgeld: Backtest + Kalibrierung von P(up) noetig.
- Echtgeld erst nach 'bullpen login' + 'bullpen setup' (wallet_ready=true) und validierter Strategie.
- TODO: automatisches resolve (Markt-Status pollen), Sport-Maerkte, Futures-Teile aus trading-bot.
