# Implementation Plan: Reference Audit Improvements

## Overview

Incremental implementation of the layered resilience and intelligence stack. Foundation types and errors are built first, then resilience middleware, then services. Each layer is wired into the existing API clients before moving to the next.

## Tasks

- [x] 1. Foundation: Structured errors and branded types
  - [x] 1.1 Create `ApiError` class and `ErrorCode` enum in `apps/server/src/lib/errors.ts`
    - Implement `ApiError` extending `Error` with fields: `code`, `httpStatus`, `source`, `path`, `retryable`, `retryDelayMs`, `details`
    - Implement `classifyHttpError(status, source, path, headers?)` and `classifyNetworkError(error, source, path)`
    - Classification: 401/403 → AUTH (not retryable), 429 → RATE_LIMIT (retryable, delay from Retry-After or 1000ms), 5xx → SERVER (retryable), network errors → NETWORK (retryable)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [x] 1.2 Write property tests for error classification
    - **Property 1: Error classification completeness**
    - **Property 2: Retryable errors include retry delay**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6**

  - [x] 1.3 Create branded types in `packages/types/src/branded.ts`
    - Define `Brand<T, B>` utility type with phantom `__brand` field
    - Define branded types: `TokenId`, `ConditionId`, `QuestionId`, `MarketSlug`, `WalletAddress`, `OrderId`
    - Implement constructor functions: `tokenId()`, `conditionId()`, `questionId()`, `marketSlug()`, `walletAddress()`, `orderId()`
    - Export from `packages/types/src/index.ts`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 1.4 Write property test for branded types
    - **Property 14: Branded type constructor round-trip**
    - **Validates: Requirements 6.2**

- [x] 2. Foundation: Zod response schemas
  - [x] 2.1 Create Zod schemas in `apps/server/src/lib/polymarket/schemas/`
    - `schemas/gamma.ts` — EventSchema, MarketSchema, TagSchema, SeriesSchema, SearchResultSchema, PublicProfileSchema
    - `schemas/data.ts` — PositionSchema, TradeSchema, LeaderboardEntrySchema, ActivityItemSchema, PortfolioValueSchema, HolderEntrySchema
    - `schemas/clob.ts` — OrderBookSnapshotSchema, PriceHistoryPointSchema
    - `schemas/bridge.ts` — QuoteSchema, SupportedAssetSchema, TransactionStatusSchema, DepositAddressesSchema
    - `schemas/index.ts` — re-export all schemas
    - Each schema exports the inferred TypeScript type alongside the Zod schema
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 2.2 Write property tests for Zod schemas
    - **Property 3: Zod schema round-trip for valid objects**
    - **Property 4: Invalid objects produce VALIDATION ApiError**
    - **Validates: Requirements 2.2, 2.3**

- [x] 3. Checkpoint — Foundation layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Resilience: Cache layer
  - [x] 4.1 Implement `TtlCache` class in `apps/server/src/lib/cache.ts`
    - Constructor takes `CacheConfig` with `defaultTtlMs` and `maxEntries`
    - `get<T>(key)` — returns cached value if not expired, updates `lastAccessed`, returns `undefined` if expired or missing
    - `set<T>(key, value, ttlMs?)` — stores entry, evicts LRU if at capacity
    - `invalidate(keyPrefix?)` — clears all or prefix-matching entries
    - `size()` — returns current entry count
    - Cache key helper: `buildCacheKey(source, path, params)` — sorts params alphabetically for determinism
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [x] 4.2 Write property tests for cache
    - **Property 5: Cache key determinism regardless of parameter order**
    - **Property 6: Cache TTL correctness**
    - **Property 7: Cache LRU eviction at max capacity**
    - **Property 8: Cache invalidation by prefix**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.5, 3.6**

- [x] 5. Resilience: Circuit breaker and retry
  - [x] 5.1 Implement `CircuitBreaker` class in `apps/server/src/lib/circuit-breaker.ts`
    - Constructor takes `source` string and optional `CircuitBreakerConfig` (failureThreshold default 5, cooldownMs default 30000)
    - State machine: CLOSED → OPEN (on threshold) → HALF_OPEN (after cooldown) → CLOSED (on success) or OPEN (on failure)
    - `preRequest()` — throws `ApiError` with `CIRCUIT_OPEN` if open, allows one request in HALF_OPEN
    - `onSuccess()` — resets failures, transitions HALF_OPEN → CLOSED
    - `onFailure()` — increments failures, transitions CLOSED → OPEN if threshold met, HALF_OPEN → OPEN
    - `reset()` — resets to CLOSED state
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 5.2 Write property tests for circuit breaker
    - **Property 9: Circuit breaker state machine**
    - **Property 10: Circuit breaker cooldown transitions to HALF_OPEN**
    - **Validates: Requirements 4.2, 4.3, 4.4**

  - [x] 5.3 Implement `withRetry` function in `apps/server/src/lib/retry.ts`
    - Takes async function and `RetryConfig` (maxAttempts default 3, baseDelayMs 500, maxDelayMs 10000, jitterFactor 0.2)
    - Catches `ApiError`, checks `retryable`, retries with exponential backoff + jitter
    - Non-retryable errors rethrown immediately
    - _Requirements: 4.1_

  - [x] 5.4 Write property test for retry
    - **Property 11: Retry attempts match configuration**
    - **Validates: Requirements 4.1**

- [x] 6. Resilience: Request deduplicator
  - [x] 6.1 Implement `RequestDeduplicator` class in `apps/server/src/lib/deduplicator.ts`
    - `dedupe<T>(key, fn)` — if key is in-flight, return existing promise; otherwise call fn and store promise
    - On resolve/reject, remove in-flight entry
    - `inflight()` — returns count of in-flight keys
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.2 Write property tests for deduplicator
    - **Property 12: Request deduplication — single upstream call for concurrent callers**
    - **Property 13: Deduplicator cleanup after completion**
    - **Validates: Requirements 5.1, 5.3, 5.4**

- [x] 7. Checkpoint — Resilience layer
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integration: Resilient fetch wrapper and API client migration
  - [x] 8.1 Create `createResilientFetch` in `apps/server/src/lib/polymarket/resilient-fetch.ts`
    - Composes deduplicator → cache → circuit breaker → retry → fetch + Zod validation
    - Takes `ResilientFetchConfig` with source, cache TTL, retry config, dedupe toggle
    - Returns a `fetchJson<T>(path, schema, params?)` function
    - Uses `ApiError` for all error paths, `buildCacheKey` for cache/dedup keys
    - _Requirements: 1.1, 2.2, 3.2, 4.1, 5.1_

  - [x] 8.2 Migrate `gamma.ts` to use resilient fetch
    - Replace internal `fetchJson` with `createResilientFetch({ source: "gamma", cache: { ttlMs: 60_000 } })`
    - Pass Zod schemas to each call (EventSchema, MarketSchema, etc.)
    - _Requirements: 1.1, 2.2, 3.4_

  - [x] 8.3 Migrate `data.ts` to use resilient fetch
    - Replace internal `fetchJson` with `createResilientFetch({ source: "data", cache: { ttlMs: 30_000 } })`
    - Pass Zod schemas to each call
    - _Requirements: 1.1, 2.2, 3.4_

  - [x] 8.4 Migrate `clob-read.ts` to use resilient fetch
    - Replace internal `fetchJson` with `createResilientFetch({ source: "clob", cache: { ttlMs: 5_000 } })`
    - Pass Zod schemas to each call
    - _Requirements: 1.1, 2.2, 3.4_

  - [x] 8.5 Migrate `bridge.ts` to use resilient fetch
    - Replace internal `fetchJson` with `createResilientFetch({ source: "bridge", cache: false })`
    - Pass Zod schemas to each call; disable cache for mutation endpoints
    - _Requirements: 1.1, 2.2_

  - [x] 8.6 Write integration tests for resilient fetch pipeline
    - Test the full pipeline with mocked fetch: cache hit, cache miss, retry on transient error, circuit breaker open, dedup of concurrent calls
    - _Requirements: 1.1, 2.2, 3.2, 4.1, 5.1_

- [x] 9. Checkpoint — Integration complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Services: Health endpoint and OpenAPI
  - [x] 10.1 Implement health endpoint in `apps/server/src/routers/health.ts`
    - Hono route at `/api/health` (not tRPC)
    - Check Gamma (GET /tags), Data (GET /v1/leaderboard?limit=1), CLOB (GET /), Bridge (GET /supported-assets), PostgreSQL (SELECT 1)
    - Each check has 10s timeout via `AbortController`
    - Return 200 + `{ status: "healthy", services: [...] }` or 503 + `{ status: "degraded", services: [...] }`
    - Each service entry includes `responseTimeMs`
    - Wire into `apps/server/src/index.ts`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 10.2 Write property test for health endpoint
    - **Property 15: Health endpoint degraded status**
    - **Validates: Requirements 7.4, 7.5**

  - [x] 10.3 Implement OpenAPI generation in `apps/server/src/routers/openapi.ts`
    - Use `trpc-to-openapi` or equivalent adapter to generate OpenAPI spec from `appRouter`
    - Serve at `/api/openapi.json` as a Hono route
    - Include metadata: title "Poly API", version "1.0.0", base URL from env
    - Wire into `apps/server/src/index.ts`
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 10.4 Write property test for OpenAPI spec
    - **Property 16: OpenAPI spec includes schemas for Zod-typed procedures**
    - **Validates: Requirements 8.3**

- [x] 11. Services: Trader intelligence
  - [x] 11.1 Implement `TraderProfiler` in `apps/server/src/lib/intelligence/trader.ts`
    - `computeScore(entry)` — weighted: volume 40%, PnL 30%, win rate 20%, positions 10%, normalized to 0–100
    - `assignTier(score)` — whale ≥ 90, shark ≥ 70, dolphin ≥ 40, fish < 40
    - `detectAnomaly(current, historical)` — flags if current deviates > 2 std devs from historical mean
    - `getProfile(address)` — fetches leaderboard data, computes profile, caches for 15 min
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [x] 11.2 Write property tests for trader intelligence
    - **Property 17: Trader score and tier assignment consistency**
    - **Property 18: Anomaly detection flags deviations beyond threshold**
    - **Validates: Requirements 9.1, 9.2, 9.3**

  - [x] 11.3 Add `intelligence` tRPC router with `traderProfile` procedure
    - Input: `{ address: string }` (or `WalletAddress` branded type)
    - Output: `TraderProfile`
    - Wire into `apps/server/src/routers/index.ts`
    - _Requirements: 9.4_

- [x] 12. Services: Arbitrage detection
  - [x] 12.1 Implement `ArbitrageDetector` in `apps/server/src/lib/intelligence/arbitrage.ts`
    - `checkMarket(yesBook, noBook, feeRateBps)` — checks if bestYesAsk + bestNoAsk + 2*feeRate < 1.0
    - Returns `ArbitrageOpportunity` with conditionId, token IDs, prices, profit, required capital, or null
    - `scanMarkets(conditionIds)` — fetches orderbooks and checks each market
    - _Requirements: 10.1, 10.2, 10.3, 10.5_

  - [x] 12.2 Write property tests for arbitrage detection
    - **Property 19: Arbitrage detection correctness**
    - **Property 20: Arbitrage profit calculation accuracy**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**

  - [x] 12.3 Add `arbitrage` tRPC procedure to intelligence router
    - Output: `ArbitrageOpportunity[]`
    - Wire into the intelligence router
    - _Requirements: 10.4_

- [x] 13. Checkpoint — Services complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Optional: Market data utilities
  - [x] 14.1 Implement OHLCV aggregation and effective price in `apps/server/src/lib/intelligence/market-utils.ts`
    - `aggregateToOHLCV(trades, intervalMs)` — groups trades by interval, computes open/high/low/close/volume
    - `computeEffectivePrice(book, side, size)` — walks orderbook levels, returns VWAP or null if insufficient liquidity
    - _Requirements: 11.1, 11.2_

  - [x] 14.2 Write property tests for market data utilities
    - **Property 21: OHLCV aggregation invariants**
    - **Property 22: Effective price from orderbook depth**
    - **Validates: Requirements 11.1, 11.2**

- [x] 15. Optional: Portfolio analytics
  - [x] 15.1 Implement portfolio analytics in `apps/server/src/lib/intelligence/portfolio.ts`
    - `computePortfolioAnalytics(positions, closedPositions, trades)` — computes win rate, total PnL, category breakdown, daily snapshots
    - _Requirements: 12.1, 12.2_

  - [x] 15.2 Write property test for portfolio analytics
    - **Property 23: Portfolio analytics invariants**
    - **Validates: Requirements 12.1**

- [x] 16. Optional: Market enrichment
  - [x] 16.1 Implement market enrichment in `apps/server/src/lib/intelligence/enrichment.ts`
    - `enrichMarket(market, recentTrades, book)` — computes volumeTrend, priceMomentum, liquidityScore
    - _Requirements: 13.1_

  - [x] 16.2 Write property test for market enrichment
    - **Property 24: Market enrichment volume trend consistency**
    - **Validates: Requirements 13.1**

- [x] 17. Final checkpoint — All tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each layer
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The resilient fetch wrapper (task 8.1) is the key integration point that wires foundation + resilience together
