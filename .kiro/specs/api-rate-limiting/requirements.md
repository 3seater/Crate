# Requirements Document

## Introduction

This feature replaces the existing partial rate limiter in `apps/server/src/lib/rate-limiter.ts` with a comprehensive, configuration-driven rate limiting system that enforces all documented Polymarket API rate limits. The current implementation covers only 8 endpoint groups with a single token bucket per group. The new system must support the full set of Polymarket API rate limits across all API families (General, Data, GAMMA, CLOB, Relayer, User PNL), handle dual burst/sustained windows for CLOB trading endpoints, and integrate into the existing `resilient-fetch` pipeline so every outbound request is automatically throttled before hitting Polymarket's Cloudflare-based enforcement.

## Glossary

- **Rate_Limiter**: The module responsible for throttling outbound HTTP requests to Polymarket APIs to stay within documented rate limits
- **Token_Bucket**: An algorithm that models request capacity as tokens that refill at a steady rate; each request consumes one token
- **Burst_Limit**: The maximum number of requests allowed in a short sliding window (per 10 seconds) for CLOB trading endpoints
- **Sustained_Limit**: The maximum number of requests allowed in a longer sliding window (per 10 minutes) for CLOB trading endpoints
- **Dual_Window_Limiter**: A rate limiter that enforces both a burst limit and a sustained limit simultaneously; a request must pass both checks
- **Rate_Limit_Config**: A declarative data structure mapping API family and endpoint path patterns to their rate limit parameters
- **API_Family**: A grouping of Polymarket endpoints sharing a base URL and general rate limit (General, Data, GAMMA, CLOB, Relayer, User_PNL)
- **Sliding_Window**: A time-based window that continuously moves forward, measuring request counts over the most recent N seconds or minutes
- **Resilient_Fetch**: The existing fetch wrapper (`resilient-fetch.ts`) that composes dedup, cache, circuit breaker, and retry middleware
- **Backoff**: An exponential delay strategy applied when a request is throttled, increasing wait time with each consecutive throttle event

## Requirements

### Requirement 1: Declarative Rate Limit Configuration

**User Story:** As a developer, I want all Polymarket API rate limits defined in a single configuration structure, so that limits can be updated without changing logic code.

#### Acceptance Criteria

1. THE Rate_Limit_Config SHALL define rate limits for all six API families: General, Data, GAMMA, CLOB, Relayer, and User_PNL
2. WHEN a rate limit entry specifies a single window, THE Rate_Limit_Config SHALL store the request count and window duration in milliseconds
3. WHEN a rate limit entry specifies dual windows (burst and sustained), THE Rate_Limit_Config SHALL store both the burst limit with its window and the sustained limit with its window
4. THE Rate_Limit_Config SHALL support endpoint-specific overrides that take precedence over the API family general limit
5. THE Rate_Limit_Config SHALL be exportable as a TypeScript constant for use across the monorepo

### Requirement 2: Single-Window Token Bucket Rate Limiting

**User Story:** As a developer, I want outbound API requests throttled using a token bucket algorithm, so that the application stays within Polymarket's per-endpoint rate limits.

#### Acceptance Criteria

1. WHEN a request is submitted to the Rate_Limiter, THE Token_Bucket SHALL consume one token if available and allow the request to proceed
2. WHEN no tokens are available in the Token_Bucket, THE Rate_Limiter SHALL queue the request and resolve it when a token becomes available
3. THE Token_Bucket SHALL refill tokens at a constant rate derived from the configured limit and window duration
4. THE Token_Bucket SHALL cap the token count at the configured burst limit to prevent unbounded accumulation
5. WHEN the Rate_Limiter is destroyed, THE Token_Bucket SHALL resolve all queued requests and release resources

### Requirement 3: Dual-Window Rate Limiting for Trading Endpoints

**User Story:** As a developer, I want CLOB trading endpoints to enforce both burst and sustained rate limits simultaneously, so that the application respects Polymarket's dual-window throttling for order operations.

#### Acceptance Criteria

1. WHEN a request targets a dual-window endpoint, THE Dual_Window_Limiter SHALL acquire tokens from both the burst Token_Bucket and the sustained Token_Bucket before allowing the request
2. IF either the burst or sustained Token_Bucket has no available tokens, THEN THE Dual_Window_Limiter SHALL queue the request until both buckets have capacity
3. THE Dual_Window_Limiter SHALL apply to the following CLOB endpoints: POST /order, DELETE /order, POST /orders, DELETE /orders, DELETE /cancel-all, DELETE /cancel-market-orders
4. WHEN the burst window is 10 seconds and the sustained window is 10 minutes, THE Dual_Window_Limiter SHALL enforce both windows independently using separate Token_Bucket instances

### Requirement 4: Hierarchical Limit Enforcement

**User Story:** As a developer, I want each request to be checked against both its endpoint-specific limit and the API family general limit, so that neither limit is exceeded.

#### Acceptance Criteria

1. WHEN a request matches an endpoint-specific rate limit, THE Rate_Limiter SHALL acquire tokens from both the endpoint-specific bucket and the API family general bucket
2. WHEN a request does not match any endpoint-specific pattern, THE Rate_Limiter SHALL acquire tokens from only the API family general bucket
3. THE Rate_Limiter SHALL resolve endpoint-specific limits by matching the request path against configured path patterns
4. IF either the endpoint-specific bucket or the general bucket has no available tokens, THEN THE Rate_Limiter SHALL queue the request until both buckets have capacity

### Requirement 5: Complete Polymarket Rate Limit Coverage

**User Story:** As a developer, I want every documented Polymarket API rate limit enforced, so that the application avoids Cloudflare throttling on any endpoint.

#### Acceptance Criteria

1. THE Rate_Limit_Config SHALL include General API limits: 15000 requests/10s general, 100 requests/10s for the OK endpoint
2. THE Rate_Limit_Config SHALL include Data API limits: 1000 requests/10s general, 200 requests/10s for /trades, 150 requests/10s for /positions, 150 requests/10s for /closed-positions, 100 requests/10s for the OK endpoint
3. THE Rate_Limit_Config SHALL include GAMMA API limits: 4000 requests/10s general, 200 requests/10s for Get Comments, 500 requests/10s for /events, 300 requests/10s for /markets, 900 requests/10s for /markets and /events listing, 200 requests/10s for Tags, 350 requests/10s for Search
4. THE Rate_Limit_Config SHALL include CLOB API limits: 9000 requests/10s general, 200 requests/10s for GET Balance Allowance, 50 requests/10s for UPDATE Balance Allowance, 1500 requests/10s for /book, 500 requests/10s for /books, 1500 requests/10s for /price, 500 requests/10s for /prices, 1500 requests/10s for /midprice, 500 requests/10s for /midprices, 900 requests/10s for Ledger endpoints, 500 requests/10s for /data/orders, 500 requests/10s for /data/trades, 125 requests/10s for /notifications, 1000 requests/10s for Price History, 200 requests/10s for Market Tick Size, 100 requests/10s for API Keys
5. THE Rate_Limit_Config SHALL include CLOB trading dual-window limits: POST /order at 3500/10s burst and 36000/10min sustained, DELETE /order at 3000/10s burst and 30000/10min sustained, POST /orders at 1000/10s burst and 15000/10min sustained, DELETE /orders at 1000/10s burst and 15000/10min sustained, DELETE /cancel-all at 250/10s burst and 6000/10min sustained, DELETE /cancel-market-orders at 1000/10s burst and 1500/10min sustained
6. THE Rate_Limit_Config SHALL include Relayer /submit limit: 25 requests/1 minute
7. THE Rate_Limit_Config SHALL include User PNL API limit: 200 requests/10s

### Requirement 6: Integration with Resilient Fetch Pipeline

**User Story:** As a developer, I want rate limiting automatically applied to every outbound Polymarket API request, so that I do not need to manually acquire rate limit tokens in each API client.

#### Acceptance Criteria

1. WHEN createResilientFetch is called with a source identifier, THE Resilient_Fetch SHALL automatically apply the corresponding API family rate limits to every request
2. WHEN a request path matches an endpoint-specific rate limit, THE Resilient_Fetch SHALL apply both the endpoint-specific and general rate limits before executing the request
3. THE Resilient_Fetch SHALL apply rate limiting as the outermost layer of the middleware pipeline, before deduplication, caching, circuit breaking, and retry
4. WHEN rate limiting is applied, THE Resilient_Fetch SHALL wait for token acquisition before proceeding to the next middleware layer

### Requirement 7: Backoff Strategy for Throttled Requests

**User Story:** As a developer, I want queued requests to use exponential backoff when the rate limiter is under sustained pressure, so that the application recovers gracefully from burst overloads.

#### Acceptance Criteria

1. WHEN a request is queued due to rate limiting, THE Rate_Limiter SHALL apply exponential backoff with a configurable base delay, multiplier, and maximum delay
2. THE Rate_Limiter SHALL increase the backoff delay with each consecutive queued request for the same bucket
3. THE Rate_Limiter SHALL reset the backoff delay to zero when a request succeeds without queuing
4. THE Rate_Limiter SHALL cap the backoff delay at the configured maximum delay value

### Requirement 8: Resource Lifecycle Management

**User Story:** As a developer, I want rate limiter resources properly cleaned up on server shutdown, so that timers and queued promises do not leak.

#### Acceptance Criteria

1. WHEN destroyAllLimiters is called, THE Rate_Limiter SHALL clear all timer references and resolve all queued requests
2. WHEN destroyAllLimiters is called, THE Rate_Limiter SHALL release all Token_Bucket instances from the internal registry
3. THE Rate_Limiter SHALL integrate with the existing server graceful shutdown handler in `apps/server/src/index.ts`

### Requirement 9: Rate Limit Configuration Serialization

**User Story:** As a developer, I want the rate limit configuration to be serializable to and from JSON, so that it can be stored, transmitted, or loaded from external sources.

#### Acceptance Criteria

1. THE Rate_Limit_Config SHALL be representable as a JSON-compatible object
2. FOR ALL valid Rate_Limit_Config objects, serializing to JSON and deserializing back SHALL produce an equivalent configuration object (round-trip property)
3. WHEN an invalid JSON structure is provided, THE Rate_Limit_Config parser SHALL return a descriptive validation error
