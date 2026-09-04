# Requirements Document

## Introduction

This feature encompasses a set of improvements to the Doji monorepo identified through auditing 30 reference Polymarket repositories. The improvements span structured error handling, runtime API response validation, server-side caching, API resilience patterns (retry/circuit breaker/deduplication), branded domain types, health check endpoints, OpenAPI documentation generation, and market intelligence services (trader profiling, arbitrage detection). These changes harden the existing API integration layer, improve type safety, reduce redundant upstream calls, and add new analytical capabilities.

## Glossary

- **API_Client**: The server-side modules (`gamma.ts`, `data.ts`, `clob-read.ts`, `bridge.ts`) that make HTTP requests to Polymarket upstream APIs
- **ApiError**: A structured error object carrying an error code, HTTP status, source API name, and retry eligibility flag
- **Circuit_Breaker**: A resilience component that tracks consecutive failures to an upstream API and temporarily stops sending requests when a failure threshold is exceeded
- **Cache_Layer**: An in-memory TTL-based cache that stores API responses to avoid redundant upstream requests
- **Request_Deduplicator**: A component that coalesces concurrent identical in-flight requests into a single upstream call
- **Zod_Schema**: A Zod schema definition used to validate the shape of data returned from upstream Polymarket APIs at runtime
- **Branded_Type**: A TypeScript nominal type that prevents accidental interchange of structurally identical but semantically distinct string identifiers (e.g., TokenId vs ConditionId)
- **Health_Endpoint**: An HTTP endpoint that reports connectivity status for all upstream APIs and the database
- **OpenAPI_Spec**: A machine-readable API description generated from tRPC router definitions
- **Trader_Profiler**: A backend service that computes trader scores, tiers, and anomaly signals from leaderboard and trade data
- **Arbitrage_Detector**: A service that identifies mispriced YES/NO token pairs from orderbook data where buy YES price + buy NO price < 1

## Requirements

### Requirement 1: Structured Error Handling

**User Story:** As a developer, I want all Polymarket API errors to be represented as structured typed objects, so that I can programmatically distinguish error categories and decide on retry/display logic.

#### Acceptance Criteria

1. THE API_Client SHALL represent all errors as ApiError objects containing an error code enum, HTTP status code, source API name, request path, and a boolean retry eligibility flag
2. WHEN an upstream API returns an HTTP error response, THE API_Client SHALL classify the error into one of these categories: NETWORK, AUTH, RATE_LIMIT, VALIDATION, SERVER, or UNKNOWN
3. WHEN an upstream API returns a rate-limit response (HTTP 429), THE API_Client SHALL set the error code to RATE_LIMIT and mark the error as retryable
4. WHEN an upstream API returns an authentication error (HTTP 401 or 403), THE API_Client SHALL set the error code to AUTH and mark the error as not retryable
5. WHEN a network-level failure occurs (DNS, timeout, connection refused), THE API_Client SHALL set the error code to NETWORK and mark the error as retryable
6. IF an ApiError is retryable, THEN THE API_Client SHALL include a suggested retry delay in milliseconds on the error object

### Requirement 2: Zod Runtime Validation of API Responses

**User Story:** As a developer, I want all upstream API responses to be validated against Zod schemas at runtime, so that malformed or changed API payloads are caught immediately rather than causing downstream type errors.

#### Acceptance Criteria

1. THE API_Client SHALL define Zod schemas for every response type returned by the Gamma, Data, CLOB, and Bridge APIs
2. WHEN an upstream API response is received, THE API_Client SHALL parse the JSON body through the corresponding Zod schema before returning it to callers
3. IF a Zod validation fails, THEN THE API_Client SHALL produce an ApiError with error code VALIDATION containing the Zod error details
4. THE Zod_Schema definitions SHALL be co-located with the API_Client modules that use them
5. WHEN a Zod schema is defined for a response type, THE Zod_Schema SHALL also export the inferred TypeScript type so that runtime and compile-time types stay in sync

### Requirement 3: Server-Side Caching Layer

**User Story:** As a developer, I want frequently-requested API data to be cached in memory with configurable TTLs, so that redundant upstream calls are eliminated and response times improve.

#### Acceptance Criteria

1. THE Cache_Layer SHALL store API responses in memory keyed by a deterministic cache key derived from the API path and query parameters
2. WHEN a cached entry exists and has not expired, THE Cache_Layer SHALL return the cached value without making an upstream request
3. WHEN a cached entry has expired, THE Cache_Layer SHALL evict the entry and make a fresh upstream request
4. THE Cache_Layer SHALL support per-endpoint TTL configuration with defaults: market lists 60s, event data 30s, tags 300s, profiles 120s, orderbook data 5s
5. THE Cache_Layer SHALL enforce a maximum entry count and evict the least-recently-used entry when the limit is reached
6. THE Cache_Layer SHALL expose a method to invalidate all entries or entries matching a specific key prefix

### Requirement 4: Retry Logic with Circuit Breaker

**User Story:** As a developer, I want API calls to automatically retry on transient failures and stop retrying when an upstream API is persistently down, so that the system degrades gracefully during outages.

#### Acceptance Criteria

1. WHEN an API call fails with a retryable error, THE API_Client SHALL retry the call with exponential backoff up to a configurable maximum number of attempts (default 3)
2. THE Circuit_Breaker SHALL track consecutive failures per upstream API endpoint
3. WHEN consecutive failures exceed a configurable threshold (default 5), THE Circuit_Breaker SHALL transition to an OPEN state and reject subsequent requests immediately with a CIRCUIT_OPEN error
4. WHILE the Circuit_Breaker is in OPEN state, THE Circuit_Breaker SHALL transition to HALF_OPEN state after a configurable cooldown period (default 30 seconds)
5. WHEN the Circuit_Breaker is in HALF_OPEN state and a request succeeds, THE Circuit_Breaker SHALL transition to CLOSED state and reset the failure counter
6. WHEN the Circuit_Breaker is in HALF_OPEN state and a request fails, THE Circuit_Breaker SHALL transition back to OPEN state

### Requirement 5: Request Deduplication

**User Story:** As a developer, I want concurrent identical API requests to be coalesced into a single upstream call, so that redundant network traffic is eliminated when multiple components request the same data simultaneously.

#### Acceptance Criteria

1. WHEN multiple callers request the same API resource concurrently, THE Request_Deduplicator SHALL make only one upstream request and resolve all waiting callers with the same result
2. THE Request_Deduplicator SHALL identify duplicate requests by matching the full request URL including query parameters
3. WHEN the single upstream request completes, THE Request_Deduplicator SHALL remove the in-flight entry so that subsequent requests trigger a new upstream call
4. IF the single upstream request fails, THEN THE Request_Deduplicator SHALL reject all waiting callers with the same error

### Requirement 6: Branded Types for Domain Identifiers

**User Story:** As a developer, I want key domain identifiers (token IDs, condition IDs, addresses) to use branded TypeScript types, so that the compiler prevents accidentally passing one identifier type where another is expected.

#### Acceptance Criteria

1. THE Branded_Type system SHALL define distinct branded types for: TokenId, ConditionId, QuestionId, MarketSlug, WalletAddress, and OrderId
2. THE Branded_Type system SHALL provide constructor functions that create branded values from plain strings
3. WHEN a function parameter is typed as a specific Branded_Type, THE TypeScript compiler SHALL reject plain strings or differently-branded strings at compile time
4. THE Branded_Type definitions SHALL be located in `packages/types` and exported for use across all packages
5. WHEN existing API_Client functions are updated to use Branded_Types, THE API_Client SHALL accept branded type parameters in place of plain string parameters

### Requirement 7: Health Check Endpoint

**User Story:** As an operator, I want a health check endpoint that verifies connectivity to all upstream APIs and the database, so that I can monitor system health and detect outages.

#### Acceptance Criteria

1. THE Health_Endpoint SHALL be accessible at the path `/api/health` via HTTP GET
2. WHEN the Health_Endpoint is called, THE Health_Endpoint SHALL check connectivity to the Gamma API, Data API, CLOB API, Bridge API, and PostgreSQL database
3. WHEN all upstream services and the database are reachable, THE Health_Endpoint SHALL return HTTP 200 with a JSON body listing each service as "healthy" and an overall status of "healthy"
4. WHEN one or more services are unreachable, THE Health_Endpoint SHALL return HTTP 503 with a JSON body listing each service status and an overall status of "degraded"
5. THE Health_Endpoint SHALL include response time in milliseconds for each service check
6. THE Health_Endpoint SHALL complete all checks within a 10-second timeout, marking timed-out services as "unhealthy"

### Requirement 8: OpenAPI Schema Generation

**User Story:** As a developer consuming the API, I want auto-generated OpenAPI documentation from the tRPC routers, so that I can discover available endpoints and their schemas without reading source code.

#### Acceptance Criteria

1. THE OpenAPI_Spec SHALL be generated from the tRPC router definitions using a tRPC-to-OpenAPI adapter
2. THE OpenAPI_Spec SHALL be served at the path `/api/openapi.json` via HTTP GET
3. WHEN a tRPC procedure has Zod input/output schemas, THE OpenAPI_Spec SHALL include those schemas as request/response definitions
4. THE OpenAPI_Spec SHALL include metadata: API title, version, and base URL
5. WHEN tRPC routers are modified, THE OpenAPI_Spec SHALL reflect the changes without manual updates

### Requirement 9: Trader Intelligence Service

**User Story:** As a trader, I want to see trader profiling data including tier rankings, win rates, and anomaly signals, so that I can identify smart money movements and make informed trading decisions.

#### Acceptance Criteria

1. THE Trader_Profiler SHALL compute a composite score for each trader based on volume, PnL, win rate, and position count from leaderboard data
2. THE Trader_Profiler SHALL assign traders to tiers (Whale, Shark, Dolphin, Fish) based on configurable score thresholds
3. WHEN a trader's recent activity deviates significantly from their historical pattern, THE Trader_Profiler SHALL flag the activity as anomalous
4. THE Trader_Profiler SHALL expose a tRPC procedure that returns a trader profile given a wallet address
5. THE Trader_Profiler SHALL cache computed profiles with a TTL of 15 minutes to avoid redundant computation

### Requirement 10: Arbitrage Detection Service

**User Story:** As a trader, I want to see arbitrage opportunities where YES and NO token prices are mispriced, so that I can identify risk-free profit opportunities.

#### Acceptance Criteria

1. THE Arbitrage_Detector SHALL scan orderbook data for markets where the sum of best ask prices for YES and NO tokens is less than 1.00 (minus fees)
2. THE Arbitrage_Detector SHALL calculate the expected profit for each opportunity accounting for maker/taker fees
3. WHEN an arbitrage opportunity is detected, THE Arbitrage_Detector SHALL return the market identifier, token pair, prices, estimated profit, and required capital
4. THE Arbitrage_Detector SHALL expose a tRPC procedure that returns current arbitrage opportunities
5. IF no arbitrage opportunities exist, THEN THE Arbitrage_Detector SHALL return an empty list

### Requirement 11 (Optional): Market Data Aggregation Utilities

**User Story:** As a developer, I want utility functions for aggregating raw trade data into OHLCV candles and computing orderbook depth metrics, so that I can build richer market visualizations.

#### Acceptance Criteria

1. WHERE market data aggregation is enabled, THE system SHALL provide a function that aggregates a list of trades into OHLCV candlestick data for a given time interval
2. WHERE market data aggregation is enabled, THE system SHALL provide a function that computes effective buy/sell prices for a given order size from orderbook depth data

### Requirement 12 (Optional): Portfolio Analytics Service

**User Story:** As a trader, I want portfolio analytics including win rate, category breakdown, and PnL tracking, so that I can evaluate my trading performance over time.

#### Acceptance Criteria

1. WHERE portfolio analytics is enabled, THE system SHALL compute win rate, total PnL, and per-category PnL breakdown from a trader's position and trade history
2. WHERE portfolio analytics is enabled, THE system SHALL generate daily portfolio value snapshots for charting

### Requirement 13 (Optional): Market Enrichment Pipeline

**User Story:** As a user, I want markets enriched with computed fields like volume trends, price momentum, and liquidity scores, so that I can quickly assess market quality.

#### Acceptance Criteria

1. WHERE market enrichment is enabled, THE system SHALL compute and attach volume trend (rising/falling/stable), price momentum, and liquidity score fields to market data
2. WHERE market enrichment is enabled, THE system SHALL recompute enrichment fields on a configurable interval (default 5 minutes)
