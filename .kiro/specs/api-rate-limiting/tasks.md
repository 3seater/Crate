# Implementation Plan: API Rate Limiting

## Overview

Replace the existing partial rate limiter with a comprehensive, configuration-driven system covering all Polymarket API rate limits. Implementation proceeds bottom-up: config types → token bucket enhancements → dual-window limiter → registry → resilient-fetch integration → cleanup of old code.

## Tasks

- [x] 1. Define rate limit configuration types and constants
  - [x] 1.1 Create `apps/server/src/lib/rate-limit-config.ts` with `SingleWindowLimit`, `DualWindowLimit`, `RateLimit`, `ApiFamilyConfig`, and `RateLimitConfig` types
    - Add Zod schemas (`RateLimitConfigSchema`) for validation
    - Export the `RATE_LIMIT_CONFIG` constant with all 6 API families and every endpoint-specific limit from the design document
    - Export `SOURCE_TO_FAMILY` mapping
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 1.2 Write property tests for config structure and serialization
    - **Property 1: Rate limit entry structure validity**
    - **Validates: Requirements 1.2, 1.3**
    - **Property 9: Configuration serialization round-trip**
    - **Validates: Requirements 9.2**
    - **Property 10: Invalid configuration rejection**
    - **Validates: Requirements 9.3**

  - [x] 1.3 Write unit tests for config completeness
    - Verify all 6 API families are present
    - Verify CLOB trading endpoints have dual-type entries
    - Verify specific limit values match documentation
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 3.3_

- [x] 2. Implement DualWindowLimiter and enhance TokenBucket
  - [x] 2.1 Create `DualWindowLimiter` class in `apps/server/src/lib/rate-limiter.ts`
    - Composes two `TokenBucket` instances (burst and sustained)
    - `acquire()` waits for both buckets
    - `tryAcquire()` returns true only when both have tokens
    - `getQueueLength()` returns max of both queues
    - `destroy()` destroys both buckets
    - _Requirements: 3.1, 3.2, 3.4_

  - [x] 2.2 Write property tests for DualWindowLimiter
    - **Property 5: Dual-window limiter requires both buckets**
    - **Validates: Requirements 3.1, 3.2, 3.4**

  - [x] 2.3 Write property tests for TokenBucket capacity and queuing
    - **Property 2: Token bucket capacity enforcement**
    - **Validates: Requirements 2.1, 2.4**
    - **Property 3: Token bucket queuing guarantees no drops**
    - **Validates: Requirements 2.2, 2.5**
    - **Property 4: Token bucket refill rate correctness**
    - **Validates: Requirements 2.3**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement LimiterRegistry with hierarchical enforcement
  - [x] 4.1 Create `LimiterRegistry` class in `apps/server/src/lib/rate-limiter.ts`
    - Constructor takes `RateLimitConfig` and `SOURCE_TO_FAMILY`
    - Implements path matching: iterates endpoint keys, checks prefix match, handles method-prefixed keys (e.g., `POST /order`)
    - `acquire(source, path, method?)` resolves family, matches endpoint, acquires from all applicable buckets (endpoint + general)
    - Lazily creates and caches `TokenBucket` or `DualWindowLimiter` instances
    - `destroyAll()` destroys all buckets and clears the map
    - Falls back to "general" family for unknown sources
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 4.2 Write property tests for hierarchical resolution
    - **Property 6: Hierarchical limit resolution**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 6.2**

  - [x] 4.3 Write property tests for registry lifecycle
    - **Property 8: Registry destroy lifecycle**
    - **Validates: Requirements 8.1, 8.2**

  - [x] 4.4 Write unit tests for path matching edge cases
    - Exact path match vs prefix match
    - Method-prefixed keys (POST /order vs DELETE /order)
    - Unknown source fallback to general
    - Path with no endpoint match uses only general bucket
    - _Requirements: 4.3_

- [x] 5. Integrate rate limiting into resilient-fetch pipeline
  - [x] 5.1 Update `createResilientFetch` in `apps/server/src/lib/polymarket/resilient-fetch.ts`
    - Add optional `rateLimiter` parameter (defaults to shared global `LimiterRegistry` instance)
    - Insert rate limiter as outermost layer: `rateLimiter.acquire(source, path)` before dedup
    - Pass `method` parameter through for CLOB trading endpoints
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 5.2 Replace old exports in `apps/server/src/lib/rate-limiter.ts`
    - Remove `SERVER_RATE_LIMITS`, old `RateLimitKey`, old `getRateLimiter`, old `destroyAllLimiters`
    - Export new `LimiterRegistry`, `DualWindowLimiter`, shared registry instance, and new `destroyAllLimiters` that calls `registry.destroyAll()`
    - Retain `TokenBucket`, `BackoffConfig`, `computeBackoffDelay` exports
    - _Requirements: 8.3_

  - [x] 5.3 Write unit tests for resilient-fetch integration
    - Verify rate limiter is called before dedup/cache/circuit-breaker
    - Verify correct source and path are passed to the registry
    - _Requirements: 6.1, 6.3, 6.4_

- [x] 6. Update server shutdown and API clients
  - [x] 6.1 Update `apps/server/src/index.ts` shutdown handler
    - Ensure `destroyAllLimiters` calls the new registry's `destroyAll()`
    - No import changes needed if the export name is preserved
    - _Requirements: 8.3_

  - [x] 6.2 Update API client files if needed
    - Verify `gamma.ts`, `data.ts`, `clob-read.ts`, `bridge.ts` work with the updated resilient-fetch
    - Add `method` parameter to any CLOB write operations if they use resilient-fetch
    - _Requirements: 6.1, 6.2_

- [x] 7. Backoff property test update
  - [x] 7.1 Update existing backoff property tests to reference new property numbering
    - **Property 7: Backoff delay monotonicity with cap**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already installed in `apps/server`)
- Checkpoints ensure incremental validation
- The existing `TokenBucket` class is retained and enhanced, not rewritten
- Old `SERVER_RATE_LIMITS` with 8 entries is replaced by `RATE_LIMIT_CONFIG` with full coverage
