# Polybased SDK Audit — Design Notes

## Architecture Decisions

### Where Analytics Lives

The polybased-sdk bundles everything into a single SDK package. For Doji's monorepo, analytics services should live server-side to avoid exposing API keys and to leverage caching:

```
apps/server/src/lib/polymarket/analytics/
├── arbitrage.ts      # Arbitrage detection
├── smart-money.ts    # Trader scoring + sentiment
├── signals.ts        # Volume spikes, momentum, whales
└── index.ts          # Re-exports
```

Exposed via a new tRPC router:

```
apps/server/src/routers/analytics.ts
```

### Klines: Server-Side Aggregation

The polybased-sdk aggregates candles client-side from raw price history. For Doji, do this server-side to:
- Cache computed candles (avoid re-aggregation per request)
- Keep the PriceChart component thin
- Allow future persistence to DB for historical data

### On-Chain: Direct RPC via viem

Doji already has `viem` as a dependency. The on-chain service should use viem's `publicClient` for read operations (balances, approvals) — no need for ethers.js like polybased-sdk uses.

### Structured Errors: Shared Package

Errors go in `packages/types` so both server and web can use them. The resilient-fetch pipeline and CLOB client are the primary consumers.

## Key Algorithms to Port

### Arbitrage Detection (Simple)

```
yesPrice = bestAsk for YES token (or bestBid if selling)
noPrice  = bestAsk for NO token
combined = yesPrice + noPrice

if combined < 1.0:
  type = "LONG", profit = 1.0 - combined - fees
if combined > 1.0:
  type = "SHORT", profit = combined - 1.0 - fees
```

### Smart Money Score

```
score = (pnlScore * 0.3) + (winRateScore * 0.3) + (volumeScore * 0.2) + (diversityScore * 0.2)

pnlScore     = normalize(trader.pnl, allTraders.pnl)
winRateScore = trader.winRate * 100
volumeScore  = normalize(trader.volume, allTraders.volume)
diversityScore = normalize(trader.uniqueMarkets, allTraders.uniqueMarkets)
```

### Volume Spike Detection

```
volumeRatio = market.volume24hr / avgDailyVolume(market, 7d)
if volumeRatio > 3.0: signal = "VOLUME_SPIKE", strength = min(1, volumeRatio / 10)
```

### OHLCV Candle Aggregation

```
for each pricePoint in history:
  bucket = floor(timestamp / intervalMs) * intervalMs
  candle = candles[bucket] or new Candle(open=price)
  candle.high = max(candle.high, price)
  candle.low  = min(candle.low, price)
  candle.close = price
  candle.volume += estimatedVolume
```

### RSI Calculation

```
gains = [], losses = []
for i in 1..len(closes):
  delta = closes[i] - closes[i-1]
  if delta > 0: gains.push(delta), losses.push(0)
  else: gains.push(0), losses.push(abs(delta))

avgGain = sma(gains, period)
avgLoss = sma(losses, period)
rs = avgGain / avgLoss
rsi = 100 - (100 / (1 + rs))
```

## What NOT to Port

| Feature | Reason |
|---|---|
| FactsAI research integration | Third-party paid API ($0.012/query), not core to MVP |
| Relayer client | Doji uses Builder Relayer Client directly |
| ethers.js dependency | Doji standardizes on viem |
| SDK singleton pattern | Doji uses tRPC services, not a monolithic SDK class |
| Copy trading (Phase 1) | Complex, requires robust smart money data first |
