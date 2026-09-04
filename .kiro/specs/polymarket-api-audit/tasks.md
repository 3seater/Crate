# Implementation Plan: Polymarket API Audit

## Overview

Bottom-up implementation: fix shared types first, then update server-side API wrappers, then client-side auth/order/WebSocket code, then rate limiters. Tests validate each layer before moving to the next.

## Tasks

- [x] 1. Update shared types in `packages/types/src/`
  - [x] 1.1 Update `Market` type in `market.ts`
    - Add optional fields: `accepting_order_timestamp`, `enable_order_book`, `maker_base_fee`, `taker_base_fee`, `seconds_delay`, `fpmm`, `game_start_time`, `is_50_50_outcome`
    - _Requirements: 1.4, 7.1_
  - [x] 1.2 Update `OpenOrder` type in `order.ts`
    - Rename `order_type` → `type` (keep values `GTC | GTD | FOK | FAK`)
    - Change `created_at: number` → `created_at: string`
    - Add fields: `owner: string`, `maker_address: string`, `associate_trades: string[]`
    - _Requirements: 3.4, 3.5, 3.6, 7.2, 7.3, 7.4_
  - [x] 1.3 Update `UserOrder` type in `order.ts`
    - Rename `order_type` → `type` to stay consistent with `OpenOrder`
    - Change `created_at: number` → `created_at: string`
    - _Requirements: 7.3, 7.4_
  - [x] 1.4 Update `OrderResponse` type in `order.ts`
    - Add fields: `takingAmount: string`, `makingAmount: string`
    - _Requirements: 3.2_
  - [x] 1.5 Update `Trade` and `MakerOrder` types in `trade.ts`
    - Add to `Trade`: `taker_order_id`, `last_update`, `bucket_index`, `owner`, `maker_address`, `type` (`"TAKER" | "MAKER"`)
    - Add to `MakerOrder`: `fee_rate_bps`, `asset_id`, `outcome`, `side`, `owner`, `maker_address`
    - _Requirements: 2.4, 7.5, 7.6_
  - [x] 1.6 Update WebSocket types in `websocket.ts`
    - Add `spread` field to `BestBidAskEvent`
    - Add fields to `UserTradeEvent`: `taker_order_id`, `last_update`, `fee_rate_bps`, `match_time`, `outcome`, `owner`, `maker_address`, `transaction_hash`, `bucket_index`, `type` (literal `"TRADE"`)
    - Expand `UserTradeEvent.maker_orders` items with: `fee_rate_bps`, `asset_id`, `outcome`, `side`, `owner`, `maker_address`
    - Add fields to `UserOrderEvent`: `associate_trades`, `owner`, `outcome`, `maker_address`, `status`, `expiration`, `created_at`, `order_type`
    - Move `NewMarketEvent` and `MarketResolvedEvent` here from `market-channel.ts` with full documented fields (`question`, `slug`, `description`, `assets_ids`, `outcomes`, `event_message`, `winning_asset_id`, `winning_outcome`)
    - Export `TickSizeChangeEvent` from here as well
    - _Requirements: 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10_

- [x] 2. Checkpoint - Verify types compile
  - Run `pnpm check-types` to ensure all type changes compile correctly
  - Fix any downstream compilation errors caused by the `order_type` → `type` rename and `created_at` type change
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Update Gamma API wrapper
  - [x] 3.1 Fix endpoint methods in `apps/server/src/lib/polymarket/gamma.ts`
    - Replace `getMarketBySlug` to use `GET /markets/slug/{slug}` directly
    - Replace `getEventBySlug` to use `GET /events/slug/{slug}` directly
    - Change `getPublicProfile` from path param to query param `GET /public-profile?address={address}`
    - Update `fetchJson` error handler to include `response.text()` body in error message
    - _Requirements: 1.1, 1.2, 1.3, 8.3_
  - [x] 3.2 Write unit tests for Gamma API wrapper
    - Mock fetch to verify correct endpoint URLs for slug lookups
    - Mock fetch to verify query param for public profile
    - Test error handler includes response body text
    - _Requirements: 1.1, 1.2, 1.3, 8.3_

- [x] 4. Update Data API wrapper
  - [x] 4.1 Fix endpoint and add validation in `apps/server/src/lib/polymarket/data.ts`
    - Change `getOpenInterest` endpoint from `/open-interest` to `/oi`
    - Add Zod schemas for `getTrades` and `getActivity` params enforcing `limit <= 500` and `offset <= 1000`
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 4.2 Write property test for Data API pagination validation
    - **Property 1: Data API pagination validation rejects out-of-bounds inputs**
    - **Validates: Requirements 2.2, 2.3**
  - [x] 4.3 Write unit tests for Data API wrapper
    - Mock fetch to verify `/oi` endpoint path
    - Test Zod schema rejects limit > 500 and offset > 1000
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Update CLOB read wrapper and add missing endpoints
  - [x] 5.1 Update `OrderBookSnapshot` and add new functions in `apps/server/src/lib/polymarket/clob-read.ts`
    - Add `min_order_size`, `tick_size`, `neg_risk` to `OrderBookSnapshot` type
    - Add `getTraded(tokenId: string)` function calling `GET /traded`
    - Add `getHeartbeat()` function calling the heartbeat endpoint
    - Add `getFeeRate(apiKey: string)` function calling `GET /fee-rate`
    - Verify `getPriceHistory` maps to `/prices-history` correctly
    - _Requirements: 3.1, 11.1, 11.2, 11.3, 11.4_
  - [x] 5.2 Write unit tests for new CLOB read endpoints
    - Test `getTraded`, `getHeartbeat`, `getFeeRate` call correct URLs
    - _Requirements: 11.1, 11.3, 11.4_

- [x] 6. Update Bridge API wrapper
  - [x] 6.1 Fix field naming and error handling in `apps/server/src/lib/polymarket/bridge.ts`
    - Rename `SupportedAsset.minDeposit` → `minCheckoutUsd`
    - Update `fetchJson` error handler to include `response.text()` body in error message
    - _Requirements: 7.7, 8.1_
  - [x] 6.2 Write property test for error response body inclusion
    - **Property 3: Error response body text is included in thrown errors**
    - **Validates: Requirements 8.1, 8.3**

- [x] 7. Checkpoint - Verify server-side changes
  - Run `pnpm check-types` and ensure all server-side tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Update CLOB auth
  - [x] 8.1 Fix auth headers and derive method in `apps/web/src/lib/auth/clob-auth.ts`
    - Add `POLY_NONCE: string` to `L2Headers` type
    - Update `performL1Auth` to include `POLY_NONCE` header in `/auth/api-key` request
    - Change `deriveApiKeyFromServer` from `POST` to `GET` with query params instead of body
    - Update `deriveApiKeyFromServer` to include `POLY_NONCE` header
    - _Requirements: 5.1, 5.2, 4.5_
  - [x] 8.2 Write property test for HMAC-SHA256 signing
    - **Property 2: HMAC-SHA256 signing produces correct base64 output**
    - **Validates: Requirements 5.3, 10.2**
  - [x] 8.3 Write unit tests for CLOB auth
    - Mock fetch to verify `GET` method for derive-api-key
    - Verify `POLY_NONCE` header presence in L1 auth requests
    - Verify EIP-712 domain constants
    - _Requirements: 4.5, 5.1, 5.2, 5.4_

- [x] 9. Create builder auth module
  - [x] 9.1 Create `apps/web/src/lib/auth/builder-auth.ts`
    - Define `BuilderL2Headers` type with `POLY_BUILDER_SIGNATURE`, `POLY_BUILDER_TIMESTAMP`, `POLY_BUILDER_API_KEY`, `POLY_BUILDER_PASSPHRASE`
    - Implement `signBuilderRequest` function using HMAC-SHA256 (reuse `hmacSha256` from clob-auth)
    - Implement `getBuilderVolume` wrapper for `GET /v1/builders/volume`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  - [x] 9.2 Write unit tests for builder auth
    - Verify `signBuilderRequest` produces all four `POLY_BUILDER_*` headers
    - Mock fetch to verify `/v1/builders/volume` endpoint call
    - _Requirements: 10.1, 10.3, 10.4_

- [x] 10. Update order signer
  - [x] 10.1 Fix order operations in `apps/web/src/lib/polymarket/order-signer.ts`
    - Add `owner` field (API key) to `signAndPostOrder` request body
    - Add `owner` field to each order in `postBatchOrders` request body
    - Fix `cancelOrder` to use `DELETE /order` with `{ orderID }` in body instead of path param
    - Update `cancelMarketOrders` to support both `market` and `asset_id` params
    - Update local `CancelResponse` type: change `not_canceled` from `string[]` to `Record<string, string>`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 3.3_
  - [x] 10.2 Write property test for batch order owner field
    - **Property 4: Batch order payloads always include owner field**
    - **Validates: Requirements 4.3**
  - [x] 10.3 Write unit tests for order signer
    - Mock fetch to verify `owner` in single order POST body
    - Mock fetch to verify `DELETE /order` with `orderID` in body
    - Verify `cancelMarketOrders` accepts both `market` and `asset_id`
    - _Requirements: 4.1, 4.2, 4.4_

- [x] 11. Update WebSocket channels
  - [x] 11.1 Update `apps/web/src/lib/websocket/market-channel.ts`
    - Remove local `TickSizeChangeEvent`, `NewMarketEvent`, `MarketResolvedEvent` type definitions
    - Import these types from `@poly/types` instead
    - _Requirements: 6.1, 6.2, 6.9, 6.10_
  - [x] 11.2 Verify subscription message supports `initial_dump` field
    - Check WebSocket manager `subscribe` method and add `initial_dump` support if missing
    - _Requirements: 6.11_

- [x] 12. Update rate limiter configurations
  - [x] 12.1 Fix server rate limiter in `apps/server/src/lib/rate-limiter.ts`
    - Change `clob_book` from `{ limit: 1500, windowMs: 10_000 }` to `{ limit: 50, windowMs: 10_000 }`
    - Change `clob_price_history` from `{ limit: 1000, windowMs: 10_000 }` to `{ limit: 100, windowMs: 10_000 }`
    - _Requirements: 9.1, 9.3_
  - [x] 12.2 Audit client rate limiter in `apps/web/src/lib/rate-limiter.ts`
    - Verify `POST /order` burst limit aligns with documented 500/10s for order posting
    - _Requirements: 9.2_
  - [x] 12.3 Write unit tests for rate limiter configs
    - Assert `clob_book` limit is 50
    - Assert `clob_price_history` limit is 100
    - Assert order posting burst limit is 500
    - _Requirements: 9.1, 9.2, 9.3_

- [x] 13. Update CLOB error handling
  - [x] 13.1 Add CLOB order error code parsing in order signer
    - Parse CLOB error responses to surface documented error codes (`INVALID_ORDER_MIN_TICK_SIZE`, `INVALID_ORDER_NOT_ENOUGH_BALANCE`, etc.)
    - _Requirements: 8.2_
  - [x] 13.2 Add geoblock failure handling
    - Implement fail-open for read-only browsing and fail-closed for trading when geoblock check has network error
    - _Requirements: 8.4_
  - [x] 13.3 Write unit tests for error handling
    - Test CLOB error code parsing with known error responses
    - Test geoblock network failure: read-only succeeds, trading blocked
    - _Requirements: 8.2, 8.4_

- [x] 14. Final checkpoint - Full verification
  - Run `pnpm check-types` to verify all types compile
  - Run all tests to verify no regressions
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- Most type completeness criteria are validated by TypeScript compilation — if the types are wrong, `pnpm check-types` will fail
