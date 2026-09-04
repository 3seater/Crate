# Polybased SDK Audit — Feature Ideas for Doji

## Introduction

Audit of `references/polybased-sdk` (v0.8.1) to identify features and patterns worth adopting into Doji. The SDK is a comprehensive TypeScript toolkit for Polymarket covering market data, trading, analytics, streaming, and AI research. This document maps polybased-sdk capabilities against Doji's current state and recommends what to implement.

## Source Reference

- Repo: `~/dev/doji/references/polybased-sdk`
- Architecture: 3-layer (Infrastructure → API Clients → High-Level Services)
- Key files: `src/analytics/`, `src/streams/`, `src/trading/`, `src/klines/`, `src/onchain/`, `src/integrations/research/`

## Audit Summary

### Already Covered by Doji

| Polybased Feature | Doji Equivalent | Notes |
|---|---|---|
| Market data (Gamma API) | `apps/server/src/lib/polymarket/gamma.ts` | Doji has comprehensive Gamma client |
| CLOB client | `packages/clob/src/client.ts` | Doji has custom CLOB wrapper |
| WebSocket streaming | `apps/web/src/lib/websocket/` | Market, user, RTDS channels |
| Price history | `clob.getPricesHistory()` | Basic interval support |
| Rate limiting | `apps/server/src/lib/rate-limiter.ts` | Partial — spec exists for expansion |
| Resilient fetch | `resilient-fetch.ts` | Dedup, cache, circuit breaker, retry |
| Order placement | `packages/clob/src/client.ts` | GTC/GTD/FOK/FAK via createAndPostOrder |

### Gap Analysis — Features Worth Implementing

#### Priority 1: High Value, Low Effort

| # | Feature | Polybased Source | Benefit | Effort |
|---|---|---|---|---|
| 1 | **OHLCV Klines + Technical Indicators** | `src/klines/index.ts` | SMA, EMA, RSI, Bollinger Bands on price charts | S |
| 2 | **Arbitrage Detection** | `src/analytics/arbitrage.ts` | Detect YES+NO mispricing (< $1 or > $1) | S |
| 3 | **Structured Error System** | `src/errors.ts` | Typed errors with codes, context, retryability hints | S |
| 4 | **Multi-Market WebSocket Manager** | `src/streams/multi-market.ts` | Connection pooling for subscribing to many markets at once | M |

#### Priority 2: High Value, Medium Effort

| # | Feature | Polybased Source | Benefit | Effort |
|---|---|---|---|---|
| 5 | **Smart Money Analytics** | `src/analytics/smart-money.ts` | Score traders by PnL + win rate + volume + diversity | M |
| 6 | **Market Signals** | `src/analytics/signals.ts` | Volume spikes, momentum shifts, whale activity detection | M |
| 7 | **On-Chain Balance & Approval Checks** | `src/onchain/index.ts` | Pre-trade readiness checks, USDCe/CTF balance display | M |
| 8 | **Orderbook Streaming with Snapshots** | `src/streams/orderbook.ts` | Full orderbook state with delta updates | M |

#### Priority 3: Interesting but Complex

| # | Feature | Polybased Source | Benefit | Effort |
|---|---|---|---|---|
| 9 | **Copy Trading** | `src/trading/copy-trading.ts` | Follow smart money trades with configurable scaling | L |
| 10 | **Arbitrage Executor** | `src/trading/arbitrage-executor.ts` | Auto-execute arbitrage with slippage protection + dry run | L |
| 11 | **AI Research Integration** | `src/integrations/research/client.ts` | FactsAI-powered market research with citations | L |
| 12 | **Authenticated WebSocket** | `src/streams/authenticated-websocket.ts` | HMAC-signed WS for private order/trade feeds | M |

### Patterns Worth Adopting

| Pattern | Polybased Implementation | Doji Status | Recommendation |
|---|---|---|---|
| **Circuit breaker** | Research client with failure thresholds | Partial in resilient-fetch | Formalize with configurable thresholds |
| **Cache-aside with TTL+LRU** | `utils/cache.ts` — TTL expiry + LRU eviction | TTL only in resilient-fetch | Add LRU eviction for memory bounds |
| **Event-driven services** | `on('trade', cb)` pattern in copy-trading | Ad-hoc in stores | Standardize EventEmitter pattern for services |
| **Graceful degradation** | Research client returns null on failure | Some try/catch | Formalize fallback returns for non-critical features |
| **Dry run mode** | Arbitrage executor simulates without executing | Not present | Add to order placement for testing |

## Requirements

### Requirement 1: OHLCV Klines Service

**User Story:** As a trader, I want candlestick charts with technical indicators so I can perform technical analysis on prediction markets.

#### Acceptance Criteria

1. A `KLinesService` SHALL aggregate CLOB price history into OHLCV candles for intervals: 1m, 5m, 15m, 30m, 1h, 4h, 1d, 1w
2. The service SHALL compute SMA(period), EMA(period), RSI(14), and Bollinger Bands(20, 2) from candle data
3. The service SHALL cache computed candles with a 30-second TTL
4. The `PriceChart` component SHALL support a candlestick view mode alongside the existing line chart

**Reference:** `polybased-sdk/src/klines/index.ts` — price aggregation into time buckets, indicator calculations

### Requirement 2: Arbitrage Detection

**User Story:** As a trader, I want to see when YES + NO token prices don't sum to $1 so I can identify arbitrage opportunities.

#### Acceptance Criteria

1. An `ArbitrageService` SHALL detect long arbitrage (YES + NO < $1) and short arbitrage (YES + NO > $1) for any market
2. The service SHALL calculate profit potential as `|1 - (yesPrice + noPrice)|` minus estimated fees
3. The service SHALL expose a `scanMarkets()` function that checks all active markets and returns opportunities sorted by profit
4. Arbitrage opportunities SHALL be displayed in the trading terminal UI with profit estimates

**Reference:** `polybased-sdk/src/analytics/arbitrage.ts` — combinedPrice logic, fee estimation

### Requirement 3: Smart Money Tracking

**User Story:** As a trader, I want to see what top-performing traders are doing so I can make more informed decisions.

#### Acceptance Criteria

1. A `SmartMoneyService` SHALL score traders using: PnL (30%) + Win Rate (30%) + Volume (20%) + Diversity (20%)
2. The service SHALL track smart money activity per market: buy/sell volume, sentiment ratio `(buyVol - sellVol) / totalVol`
3. The service SHALL detect accumulation/distribution signals when smart money activity exceeds configurable thresholds
4. Smart money data SHALL be accessible via a tRPC endpoint and displayed on market detail pages

**Reference:** `polybased-sdk/src/analytics/smart-money.ts` — scoring algorithm, sentiment calculation

### Requirement 4: Market Signals Detection

**User Story:** As a trader, I want automated alerts for unusual market activity like volume spikes and whale trades.

#### Acceptance Criteria

1. A `SignalsService` SHALL detect: volume spikes (24h volume / avg daily volume > threshold), momentum shifts (price change rate), and whale activity (large single trades)
2. Each signal SHALL have a type, strength (0-1), and human-readable description
3. The service SHALL support `scanForSignals()` across multiple markets with configurable minimum strength
4. Signals SHALL be surfaced in the UI via the existing notification system

**Reference:** `polybased-sdk/src/analytics/signals.ts` — volumeRatio calculation, signal strength scoring

### Requirement 5: Structured Error System

**User Story:** As a developer, I want typed errors with context and retryability hints so error handling is consistent across the codebase.

#### Acceptance Criteria

1. A `DojiError` base class SHALL extend `Error` with: `code` (enum), `context` (Record), `retryable` (boolean), `hint` (string)
2. Specialized error classes SHALL exist for: `HttpError`, `TradingError`, `WebSocketError`, `ValidationError`
3. The resilient-fetch pipeline SHALL use structured errors instead of generic Error throws
4. Error codes SHALL be defined as a TypeScript enum in `packages/types`

**Reference:** `polybased-sdk/src/errors.ts` — error hierarchy, retryability detection

### Requirement 6: On-Chain Readiness Checks

**User Story:** As a trader, I want to see my USDCe balance and approval status before placing trades so I don't submit orders that will fail.

#### Acceptance Criteria

1. An `OnchainService` SHALL query USDCe balance and CTF token balances for a given wallet address
2. The service SHALL check approval status for CTF Exchange and NegRisk CTF Exchange contracts
3. A `checkReadyForTrading()` function SHALL return a checklist of: has balance, has approvals, has API credentials
4. The trading UI SHALL display balance and show warnings when approvals are missing

**Reference:** `polybased-sdk/src/onchain/index.ts` — lazy provider initialization, approval checking logic

## Implementation Notes

### Where Things Go in Doji

| Feature | Package/App | Location |
|---|---|---|
| Klines service | `packages/api` or `apps/server` | New `lib/klines.ts` |
| Arbitrage detection | `apps/server/src/lib/polymarket/` | New `analytics/arbitrage.ts` |
| Smart money | `apps/server/src/lib/polymarket/` | New `analytics/smart-money.ts` |
| Signals | `apps/server/src/lib/polymarket/` | New `analytics/signals.ts` |
| Structured errors | `packages/types` | New `src/errors.ts` |
| On-chain service | `packages/api` or `apps/server` | New `lib/onchain.ts` |
| UI components | `apps/web/src/components/trading/` | Extend existing components |

### Data Sources

- **Klines:** CLOB `getPricesHistory` → aggregate into candles client-side
- **Arbitrage:** CLOB orderbook best bid/ask for YES and NO tokens
- **Smart money:** Data API `/leaderboard` + `/trades` endpoints
- **Signals:** Data API volume data + WebSocket trade events
- **On-chain:** Polygon RPC via viem (already a dependency)

## Resources

- [Polybased SDK README](../references/polybased-sdk/README.md)
- [Polybased Architecture](../references/polybased-sdk/ARCHITECTURE.md)
- [Polybased API Examples](../references/polybased-sdk/API_EXAMPLES.md)
- [Polymarket CLOB Docs](https://docs.polymarket.com/developers/CLOB/clients)
