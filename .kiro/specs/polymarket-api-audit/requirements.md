# Requirements Document

## Introduction

This spec covers an audit of the existing Polymarket API integration codebase against the official Polymarket API documentation (`docs/POLYMARKET.md`). The audit identifies misalignments in endpoint paths, request/response shapes, authentication headers, error handling, WebSocket schemas, and TypeScript type definitions, then corrects them to match the documented API contracts.

## Glossary

- **Gamma_API**: The Polymarket Gamma API (`https://gamma-api.polymarket.com`) serving events, markets, tags, series, sports, profiles, search, and comments
- **Data_API**: The Polymarket Data API (`https://data-api.polymarket.com`) serving positions, trades, activity, leaderboard, holders, volume, open interest, and accounting snapshots
- **CLOB_API**: The Polymarket Central Limit Order Book API (`https://clob.polymarket.com`) serving orderbook, pricing, order management, and authentication
- **Bridge_API**: The Polymarket Bridge API (`https://bridge.polymarket.com`) serving deposit/withdrawal address generation, quotes, supported assets, and transaction status
- **RTDS**: The Polymarket Real-Time Data Socket (`wss://ws-live-data.polymarket.com`) for comments and crypto price streaming
- **Market_WebSocket**: The CLOB market channel (`wss://ws-subscriptions-clob.polymarket.com/ws/market`) for real-time orderbook and price updates
- **User_WebSocket**: The CLOB user channel (`wss://ws-subscriptions-clob.polymarket.com/ws/user`) for authenticated order and trade updates
- **Audit_System**: The collection of server-side API wrappers, client-side integration code, shared types, and tRPC routers in this monorepo
- **L1_Auth**: EIP-712 signature-based authentication for creating/deriving API credentials
- **L2_Auth**: HMAC-SHA256 signature-based authentication using API credentials (apiKey, secret, passphrase)
- **Builder_Auth**: HMAC-SHA256 signature-based authentication for builder program participants using builder-specific API credentials and headers

## Requirements

### Requirement 1: Gamma API Endpoint Alignment

**User Story:** As a developer, I want the Gamma API wrapper to use the correct documented endpoints and query parameters, so that market/event data is fetched reliably.

#### Acceptance Criteria

1. WHEN fetching a market by slug, THE Audit_System SHALL use the documented endpoint `GET /markets/slug/{slug}` instead of filtering the `GET /markets` list response
2. WHEN fetching an event by slug, THE Audit_System SHALL use the documented endpoint `GET /events/slug/{slug}` instead of filtering the `GET /events` list response
3. WHEN fetching a public profile, THE Audit_System SHALL call `GET /public-profile` with an `address` query parameter as documented, rather than using a path parameter
4. THE Audit_System SHALL include all documented fields in the Gamma API response types including `accepting_order_timestamp`, `enable_order_book`, `maker_base_fee`, `taker_base_fee`, `seconds_delay`, `fpmm`, `game_start_time`, and `is_50_50_outcome`

### Requirement 2: Data API Endpoint Alignment

**User Story:** As a developer, I want the Data API wrapper to use the correct documented endpoints and parameter names, so that position, trade, and leaderboard data is accurate.

#### Acceptance Criteria

1. WHEN fetching open interest, THE Audit_System SHALL use the documented endpoint path `/oi` instead of `/open-interest`
2. WHEN fetching trades, THE Audit_System SHALL enforce the documented maximum `limit` of 500 and maximum `offset` of 1000 in the Zod input schema
3. WHEN fetching activity, THE Audit_System SHALL enforce the documented maximum `limit` of 500 and maximum `offset` of 1000 in the Zod input schema
4. THE Audit_System SHALL include all documented fields in the Trade response type including `taker_order_id`, `last_update`, `bucket_index`, `owner`, `maker_address`, `type` (with values `TAKER` or `MAKER`), and the full `MakerOrder` shape with `owner`, `maker_address`, `fee_rate_bps`, `asset_id`, `outcome`, and `side`

### Requirement 3: CLOB API Response Type Alignment

**User Story:** As a developer, I want the CLOB API types to match the documented response shapes, so that orderbook and pricing data is correctly typed.

#### Acceptance Criteria

1. THE Audit_System SHALL include the documented `min_order_size`, `tick_size`, and `neg_risk` fields in the `OrderBookSnapshot` type returned by `getBook`
2. THE Audit_System SHALL include the documented `takingAmount` and `makingAmount` fields in the `OrderResponse` type
3. THE Audit_System SHALL type the `CancelOrdersResponse.not_canceled` field as `Record<string, string>` (order ID to reason map) instead of `string[]`
4. THE Audit_System SHALL include the documented `owner`, `maker_address`, and `associate_trades` fields in the `OpenOrder` type
5. THE Audit_System SHALL use the documented field name `type` (with values `GTC`, `GTD`, `FOK`, `FAK`) in the `OpenOrder` type instead of the current `order_type` field name
6. THE Audit_System SHALL type the `OpenOrder.created_at` field as `string` to match the documented ISO timestamp format instead of the current `number` type

### Requirement 4: Order Management Endpoint Alignment

**User Story:** As a developer, I want order creation, cancellation, and batch endpoints to match the documented API contracts, so that trading operations work correctly.

#### Acceptance Criteria

1. WHEN cancelling a single order, THE Audit_System SHALL send a `DELETE` request to `/order` with an `orderID` field in the request body, instead of using a path parameter `/order/{orderId}`
2. WHEN posting a single order, THE Audit_System SHALL include the `owner` field (API key) in the request payload as documented
3. WHEN posting batch orders, THE Audit_System SHALL include the `owner` field in each order payload as documented
4. WHEN cancelling market orders, THE Audit_System SHALL support both `market` and `asset_id` parameters as documented in the `OrderMarketCancelParams` interface
5. WHEN deriving API credentials, THE Audit_System SHALL use the documented `GET` method for `/auth/derive-api-key` instead of `POST`

### Requirement 5: Authentication Header Alignment

**User Story:** As a developer, I want L1 and L2 authentication headers to match the documented specification, so that authenticated requests succeed.

#### Acceptance Criteria

1. WHEN performing L1 authentication, THE Audit_System SHALL include the `POLY_NONCE` header in the request to `/auth/api-key` as documented in the L1 REST API header table
2. WHEN deriving API credentials via L1 authentication, THE Audit_System SHALL include the `POLY_NONCE` header in the request to `/auth/derive-api-key` as documented
3. WHEN signing L2 requests, THE Audit_System SHALL use the Base64-encoded HMAC-SHA256 signature matching the documented signing format
4. THE Audit_System SHALL use the documented EIP-712 domain with `name: "ClobAuthDomain"`, `version: "1"`, and `chainId: 137`

### Requirement 6: WebSocket Message Schema Alignment

**User Story:** As a developer, I want WebSocket event types to match the documented message schemas, so that real-time data is correctly parsed.

#### Acceptance Criteria

1. THE Audit_System SHALL include the `best_bid_ask` event type in the Market_WebSocket channel handler as a documented market event type
2. THE Audit_System SHALL include the `tick_size_change` event type in the Market_WebSocket channel handler
3. THE Audit_System SHALL type the `UserTradeEvent` to include all documented fields: `taker_order_id`, `last_update`, `fee_rate_bps`, `match_time`, `outcome`, `owner`, `maker_address`, `transaction_hash`, `bucket_index`, and `type` (literal `"TRADE"`)
4. THE Audit_System SHALL type the `UserTradeEvent.maker_orders` sub-type to include the documented `fee_rate_bps`, `asset_id`, `outcome`, `side`, `owner`, and `maker_address` fields
5. THE Audit_System SHALL type the `UserTradeEvent.status` field to include all documented statuses: `MATCHED`, `MINED`, `CONFIRMED`, `RETRYING`, and `FAILED`
6. THE Audit_System SHALL type the `UserOrderEvent` to include all documented fields: `associate_trades`, `owner`, `outcome`, `maker_address`, `status`, `expiration`, `created_at`, and `order_type` (with values `GTC`, `GTD`, `FOK`, `FAK`)
7. THE Audit_System SHALL type the `UserOrderEvent.type` field to include `PLACEMENT`, `UPDATE`, and `CANCELLATION` as documented
8. THE Audit_System SHALL include the documented `spread` field in the `BestBidAskEvent` type
9. THE Audit_System SHALL type the `NewMarketEvent` to include all documented fields: `question`, `slug`, `description`, `assets_ids`, `outcomes`, and `event_message`
10. THE Audit_System SHALL type the `MarketResolvedEvent` to include all documented fields: `winning_asset_id`, `winning_outcome`, and `event_message`
11. WHEN subscribing to the Market_WebSocket, THE Audit_System SHALL support the documented `initial_dump` field in subscription messages

### Requirement 7: Shared Type Definition Completeness

**User Story:** As a developer, I want shared TypeScript types to include all documented fields with correct names and types, so that the application can access all available API data.

#### Acceptance Criteria

1. THE Audit_System SHALL include the documented `accepting_order_timestamp`, `enable_order_book`, `maker_base_fee`, `taker_base_fee`, `seconds_delay`, `fpmm`, `game_start_time`, and `is_50_50_outcome` fields in the `Market` type
2. THE Audit_System SHALL include the documented `owner`, `maker_address`, and `associate_trades` fields in the `OpenOrder` type
3. THE Audit_System SHALL use the documented field name `type` instead of `order_type` in the `OpenOrder` type, with values `GTC`, `GTD`, `FOK`, `FAK`
4. THE Audit_System SHALL type the `OpenOrder.created_at` field as `string` (ISO timestamp) instead of `number`
5. THE Audit_System SHALL include the documented `taker_order_id`, `last_update`, `bucket_index`, `owner`, `maker_address`, and `type` (with values `TAKER` or `MAKER`) fields in the `Trade` type
6. THE Audit_System SHALL type the `MakerOrder` interface to include the documented `owner`, `maker_address`, `fee_rate_bps`, `asset_id`, `outcome`, and `side` fields
7. THE Audit_System SHALL use the documented field name `minCheckoutUsd` instead of `minDeposit` in the `SupportedAsset` type in the Bridge_API wrapper

### Requirement 8: Error Handling Alignment

**User Story:** As a developer, I want API error handling to follow documented error patterns, so that failures are handled gracefully and informatively.

#### Acceptance Criteria

1. WHEN the Bridge_API returns a non-OK response, THE Audit_System SHALL include the response body text in the error message for debugging
2. WHEN the CLOB_API returns an order placement error, THE Audit_System SHALL parse and surface the documented error codes (e.g., `INVALID_ORDER_MIN_TICK_SIZE`, `INVALID_ORDER_NOT_ENOUGH_BALANCE`)
3. WHEN the Gamma_API returns a non-OK response, THE Audit_System SHALL include the response body text in the error message for debugging
4. IF a geoblock check fails due to network error, THEN THE Audit_System SHALL fail open for read-only browsing and fail closed for trading operations

### Requirement 9: Rate Limiter Configuration Alignment

**User Story:** As a developer, I want rate limiter configurations to respect the documented API rate limits, so that requests are not throttled or rejected.

#### Acceptance Criteria

1. THE Audit_System SHALL configure the CLOB book rate limiter to respect the documented limit of 50 requests per 10 seconds for non-website clients
2. THE Audit_System SHALL configure the CLOB order posting rate limiter to respect the documented burst limit of 500 requests per 10 seconds
3. THE Audit_System SHALL configure the CLOB price endpoint rate limiter to respect the documented limit of 100 requests per 10 seconds

### Requirement 10: Builder Program Authentication

**User Story:** As a developer, I want the codebase to support builder program authentication, so that builder partners can interact with the CLOB API using their dedicated credentials.

#### Acceptance Criteria

1. THE Audit_System SHALL define a `BuilderL2Headers` type containing the documented headers: `POLY_BUILDER_SIGNATURE`, `POLY_BUILDER_TIMESTAMP`, `POLY_BUILDER_API_KEY`, and `POLY_BUILDER_PASSPHRASE`
2. THE Audit_System SHALL implement a builder signing function that produces HMAC-SHA256 signatures using builder API credentials in the same format as L2_Auth
3. WHEN a builder-authenticated request is made, THE Audit_System SHALL attach the four `POLY_BUILDER_*` headers alongside the standard L2_Auth headers
4. THE Audit_System SHALL implement a wrapper for the documented `GET /v1/builders/volume` endpoint that returns builder volume data

### Requirement 11: Missing CLOB API Endpoint Implementations

**User Story:** As a developer, I want all documented CLOB API read endpoints to be implemented, so that the application can access the full range of market data.

#### Acceptance Criteria

1. THE Audit_System SHALL implement a wrapper for the documented `GET /traded` endpoint that returns whether a given token has been traded
2. THE Audit_System SHALL implement a wrapper for the documented `GET /prices-history` endpoint that returns historical price data with `market`, `startTs`, `endTs`, `interval`, and `fidelity` parameters
3. THE Audit_System SHALL implement a wrapper for the documented heartbeat endpoint that verifies CLOB API connectivity
4. THE Audit_System SHALL implement a wrapper for the documented `GET /fee-rate` endpoint that returns the fee rate for a given API key
