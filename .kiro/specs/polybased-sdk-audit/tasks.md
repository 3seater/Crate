# Polybased SDK Audit — Implementation Tasks

## Task Overview

Tasks ordered by priority and dependency. Each maps to a requirement from the audit.

---

## Phase 1: Quick Wins (Priority 1)

### Task 1: Structured Error System
**Requirement:** 5 | **Effort:** S | **Depends on:** Nothing

- [ ] 1.1 Create `packages/types/src/errors.ts` with `DojiError` base class, error code enum
- [ ] 1.2 Add specialized classes: `HttpError`, `TradingError`, `WebSocketError`, `ValidationError`
- [ ] 1.3 Update `resilient-fetch.ts` to throw structured errors
- [ ] 1.4 Update CLOB client to throw `TradingError` for order failures

**Reference:** `polybased-sdk/src/errors.ts`

### Task 2: Arbitrage Detection Service
**Requirement:** 2 | **Effort:** S | **Depends on:** Nothing

- [ ] 2.1 Create `apps/server/src/lib/polymarket/analytics/arbitrage.ts`
- [ ] 2.2 Implement `detectArbitrage(conditionId)` — fetch YES+NO best prices, compute spread
- [ ] 2.3 Implement `scanMarkets()` — iterate active markets, return sorted opportunities
- [ ] 2.4 Add tRPC endpoint `analytics.arbitrage` in a new analytics router
- [ ] 2.5 Add arbitrage indicator to market detail page

**Reference:** `polybased-sdk/src/analytics/arbitrage.ts`

### Task 3: OHLCV Klines + Technical Indicators
**Requirement:** 1 | **Effort:** S-M | **Depends on:** Nothing

- [ ] 3.1 Create `apps/server/src/lib/polymarket/klines.ts`
- [ ] 3.2 Implement candle aggregation from CLOB price history data
- [ ] 3.3 Implement indicators: `calculateSMA()`, `calculateEMA()`, `calculateRSI()`, `calculateBollingerBands()`
- [ ] 3.4 Add tRPC endpoint `clob.getKLines` with interval parameter
- [ ] 3.5 Add candlestick view toggle to `PriceChart` component

**Reference:** `polybased-sdk/src/klines/index.ts`

---

## Phase 2: Analytics (Priority 2)

### Task 4: Smart Money Tracking
**Requirement:** 3 | **Effort:** M | **Depends on:** Nothing

- [ ] 4.1 Create `apps/server/src/lib/polymarket/analytics/smart-money.ts`
- [ ] 4.2 Implement trader scoring: PnL (30%) + Win Rate (30%) + Volume (20%) + Diversity (20%)
- [ ] 4.3 Implement `getSmartMoneyActivity(conditionId)` — sentiment ratio from top trader trades
- [ ] 4.4 Add tRPC endpoints: `analytics.topTraders`, `analytics.smartMoneyActivity`
- [ ] 4.5 Add smart money sentiment indicator to market detail page

**Reference:** `polybased-sdk/src/analytics/smart-money.ts`

### Task 5: Market Signals Detection
**Requirement:** 4 | **Effort:** M | **Depends on:** Task 4 (shares analytics infrastructure)

- [ ] 5.1 Create `apps/server/src/lib/polymarket/analytics/signals.ts`
- [ ] 5.2 Implement signal detectors: volume spike, momentum, whale activity
- [ ] 5.3 Implement `scanForSignals()` across multiple markets
- [ ] 5.4 Add tRPC endpoint `analytics.signals`
- [ ] 5.5 Surface signals in notification system and market cards

**Reference:** `polybased-sdk/src/analytics/signals.ts`

### Task 6: On-Chain Readiness Checks
**Requirement:** 6 | **Effort:** M | **Depends on:** Auth flow (Magic + Safe)

- [ ] 6.1 Create `apps/server/src/lib/polymarket/onchain.ts` (or `packages/api/src/lib/onchain.ts`)
- [ ] 6.2 Implement USDCe + CTF balance queries via viem
- [ ] 6.3 Implement approval status checks for CTF Exchange + NegRisk Exchange
- [ ] 6.4 Implement `checkReadyForTrading()` composite check
- [ ] 6.5 Add balance display to header and pre-trade warnings to order form

**Reference:** `polybased-sdk/src/onchain/index.ts`

---

## Phase 3: Advanced (Priority 3)

### Task 7: Copy Trading Service
**Requirement:** N/A (stretch) | **Effort:** L | **Depends on:** Task 4, Task 6

- [ ] 7.1 Design copy trading data model and configuration schema
- [ ] 7.2 Implement leader trade detection via Data API polling
- [ ] 7.3 Implement trade scaling and execution via CLOB client
- [ ] 7.4 Add copy trading UI (leader selection, size scaling, start/stop)

**Reference:** `polybased-sdk/src/trading/copy-trading.ts`

### Task 8: Arbitrage Executor
**Requirement:** N/A (stretch) | **Effort:** L | **Depends on:** Task 2, Task 6

- [ ] 8.1 Implement `ArbitrageExecutor` with dry run mode
- [ ] 8.2 Add slippage protection and profit threshold configuration
- [ ] 8.3 Add execution UI with profit/loss tracking

**Reference:** `polybased-sdk/src/trading/arbitrage-executor.ts`

---

## Patterns to Adopt (Cross-Cutting)

These should be applied incrementally as tasks are implemented:

- [ ] P1: Add LRU eviction to resilient-fetch cache (from `polybased-sdk/src/utils/cache.ts`)
- [ ] P2: Standardize EventEmitter pattern for new analytics services
- [ ] P3: Add dry run mode to order placement in CLOB client
- [ ] P4: Formalize graceful degradation (return null/empty for non-critical service failures)
