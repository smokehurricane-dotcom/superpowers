# Up/Down-Logger (ml_features.jsonl) — Befunde

## Was der Logger sammelt
`ml_features.jsonl` ist ein 24/7-Log: pro Up/Down-Markt und Scan-Zyklus eine Zeile mit den
Mikrostruktur-Features zum Entscheidungszeitpunkt — Orderbook-Ungleichgewicht (ob),
Cumulative Volume Delta (cvd), Futures-Signal (fut), Spike, vorhergesagte Hoch-Wahrscheinlichkeit
(p_up), BTC-Momentum (btc_mom), BTC-CVD, CVD-Beschleunigung (cvd_accel), Coin-Momentum (sym_mom).
Stand 19.06.2026: ca. 24.600 Datensätze seit dem 08.06. Das Label (ging es hoch?) wird später per
Markt-Auflösung über den Slug angejoint. Zweck: Trainingsdaten für einen Richtungs-Klassifikator.

## Befund 1 — Richtung ist NICHT vorhersagbar (Münzwurf)
Auf 23.482 gelabelten Fenstern (Binance-1m-Klines als Wahrheit) liegt die AUC bei rund 0.50 für
alle Features: p_up = 0.49, realized_vol = 0.49, momentum = 0.47 (eine winzige Mean-Reversion,
statistisch real bei n=23k aber ökonomisch belanglos, schlägt den Spread nicht). Fazit: Die
kurzfristige Up/Down-Richtung auf liquiden Coins ist ein Münzwurf — strukturell, nicht behebbar
durch mehr Richtungs-Features. Die ML-Richtungs-These ist damit widerlegt.

## Befund 2 — Volatilität sagt die Bewegungs-REICHWEITE voraus (der echte Hebel)
Die Vor-Einstiegs-Volatilität korreliert mit der Bewegungsgröße: corr(Vola, |finale Bewegung|) = +0.31,
corr(Vola, maximale Intra-Fenster-Exkursion) = +0.41. Hoch-Vola-Fenster schwingen rund 2,6× weiter
(mediane maximale Exkursion: Q1 niedrig 0.088 % → Q4 hoch 0.228 %). Volatilität sagt nicht die
Richtung, aber sehr wohl, ob der +40 %-Take-Profit im Fenster erreichbar ist. Schlussfolgerung:
Ein Vola-Gate (nur einsteigen, wenn die Vor-Einstiegs-Vola hoch genug ist) ist die plausible Edge-Quelle.

## Die drei getesteten Feature-Ideen (19.06.2026)
1. Mispricing gegen fairen Vol-Preis: Für symmetrische Up/Down-Binärmärkte ist der faire Preis
   etwa 0.50, unabhängig von der Volatilität (sie kürzt sich heraus). Kein neuer Edge für Up/Down;
   nur Barrier-/asymmetrische Märkte würden profitieren.
2. Quote-Lag / Latenz gegen Binance: aktuell nicht testbar, weil die Markt-Quote-Zeitreihe im
   Sekundentakt nicht geloggt wird. Bräuchte einen kleinen neuen Logger.
3. Vola → Reichweite / TP-Erreichbarkeit: bestätigt (siehe Befund 2) — der vielversprechendste Hebel.

## Kernsatz
Der Edge liegt NICHT in der Richtung (Münzwurf), sondern in Volatilität und Mechanik
(TP-Erreichbarkeit, günstiger Einstieg, Fair-Value). Die Logger-Daten haben ihren Job erfüllt:
sie haben die ML-Richtungs-These empirisch widerlegt. Die rohen Daten gehören in numpy-Analysen
(z. B. `_feature_test.py`), nicht in ein RAG.
