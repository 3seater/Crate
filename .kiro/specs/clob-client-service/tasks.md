# Implementation Plan: CLOB Client Service

## Overview

Incremental implementation of the `packages/clob` package and supporting changes across the monorepo. Each task builds on previous ones, with property tests placed close to the code they validate. Uses TypeScript, viem for EIP-712 signing, native fetch for HTTP, and fast-check for property-based testing.

## Tasks

- [x] 1. Set up `packages/clob` package structure
  - [x] 1.1 Create `packages/clob/package.json` with dependencies (viem, @poly/types, @poly/env) and devDependencies (vitest, fast-check, typescript)
    - Configure `"name": "@poly/clob"`, set `"main"` and `"types"` entry points
    - Add `"scripts": { "test": "vitest --run" }`
    - _Requirements: 17.1_
  - [x] 1.2 Create `packages/clob/tsconfig.json` extending the shared config
    - _Requirements: 17.1_
  - [x] 1.3 Create `packages/clob/vitest.config.mts` matching the pattern from `packages/types`
    - _Requirements: 17.1_
  - [x] 1.4 Create `packages/clob/src/index.ts` as the barrel export file (initially empty, will re-export as modules are built)
    - _Requirements: 17.1_

- [x] 2. Add CLOB types to `packages/types`
  - [x] 2.1 Create `packages/types/src/clob.ts` with all CLOB-specific types
    - Export enums: `Side`, `OrderType`, `Chain`, `AssetType`, `PriceHistoryInterval`
    - Export types: `TickSize`, `RoundConfig`, `OrderSummary`, `OrderBookSummary`, `ApiKeyCreds`, `L1PolyHeader`, `L2PolyHeader`, `L2HeaderArgs`
    - Export types: `UserOrder`, `UserMarketOrder`, `CreateOrderOptions`, `SignedOrder` (CLOB variant), `NewOrder`, `OrderData`
    - Export types: `OrderResponse`, `BalanceAllowanceResponse`, `HeartbeatResponse`, `MarketPrice`, `PaginationPayload`
    - Export types: `ContractConfig`, `BookParams`, `TradeParams`, `OpenOrderParams`, `BalanceAllowanceParams`, `PriceHistoryFilterParams`, `OrderMarketCancelParams`
    - Export RFQ types: `RfqRequest`, `RfqQuote`, `RfqRequestResponse`, `RfqQuoteResponse`, and associated param types
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9_
  - [x] 2.2 Re-export `packages/types/src/clob.ts` from `packages/types/src/index.ts`
    - _Requirements: 1.1_

- [x] 3. Implement rounding utilities and contract config
  - [x] 3.1 Create `packages/clob/src/utilities.ts`
    - Implement `roundNormal`, `roundDown`, `roundUp`, `decimalPlaces`
    - Implement `priceValid`, `isTickSizeSmaller`
    - Export `ROUNDING_CONFIG` constant mapping each `TickSize` to its `RoundConfig`
    - Implement `generateOrderBookSummaryHash` using Web Crypto API SHA-1
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 8.1, 8.2_
  - [x] 3.2 Create `packages/clob/src/config.ts`
    - Define `COLLATERAL_TOKEN_DECIMALS` and `CONDITIONAL_TOKEN_DECIMALS` constants (both 6)
    - Define Polygon mainnet and Amoy testnet contract address configs
    - Implement `getContractConfig(chainId: number): ContractConfig`
    - _Requirements: 16.1, 16.2, 16.3_
  - [x] 3.3 Write property tests for rounding utilities in `packages/clob/src/__tests__/utilities.test.ts`
    - **Property 1: Rounding functions preserve decimal precision bounds**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
  - [x] 3.4 Write property test for price validation in `packages/clob/src/__tests__/utilities.test.ts`
    - **Property 2: Price validation matches tick size range**
    - **Validates: Requirements 2.7**
  - [x] 3.5 Write property test for orderbook hash in `packages/clob/src/__tests__/utilities.test.ts`
    - **Property 8: OrderBook hash generation is idempotent**
    - **Validates: Requirements 8.1**
  - [x] 3.6 Write property test for contract config in `packages/clob/src/__tests__/config.test.ts`
    - **Property 12: Unsupported chain ID rejection**
    - **Validates: Requirements 16.3**
    - Also include unit tests for known chain configs (137, 80002)

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement order amount calculation helpers
  - [x] 5.1 Create `packages/clob/src/order-builder/helpers.ts`
    - Implement `getOrderRawAmounts(side, size, price, roundConfig)` for limit orders
    - Implement `getMarketOrderRawAmounts(side, amount, price, roundConfig)` for market orders
    - Implement `buildOrderCreationArgs` to construct `OrderData` from `UserOrder`
    - Implement `buildMarketOrderCreationArgs` to construct `OrderData` from `UserMarketOrder`
    - Implement `calculateBuyMarketPrice` and `calculateSellMarketPrice` from order book depth
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 9.1, 9.2, 9.3, 9.4_
  - [x] 5.2 Write property tests for limit order amounts in `packages/clob/src/__tests__/order-builder.test.ts`
    - **Property 3: Limit order raw amounts are correctly rounded**
    - **Validates: Requirements 3.1, 3.2, 3.6**
  - [x] 5.3 Write property tests for market order amounts in `packages/clob/src/__tests__/order-builder.test.ts`
    - **Property 4: Market order raw amounts are correctly rounded**
    - **Validates: Requirements 3.3, 3.4**
  - [x] 5.4 Write property tests for market price calculation in `packages/clob/src/__tests__/order-builder.test.ts`
    - **Property 9: Market price calculation respects order book depth**
    - **Validates: Requirements 9.1, 9.2**
    - Include edge case tests for FOK no-match (throws) and FAK fallback (returns best price)

- [x] 6. Implement order serialization and pagination
  - [x] 6.1 Create `packages/clob/src/order-json.ts`
    - Implement `orderToJson` function converting `SignedOrder` to `NewOrder` API payload
    - Handle `postOnly` validation (only GTC/GTD allowed)
    - _Requirements: 10.3, 11.1, 11.2, 11.3_
  - [x] 6.2 Create `packages/clob/src/pagination.ts`
    - Export `INITIAL_CURSOR = "MA=="` and `END_CURSOR = "LTE="`
    - Implement `collectAllPages` async helper that follows cursors until `END_CURSOR`
    - _Requirements: 12.2, 12.3_
  - [x] 6.3 Write property tests for orderToJson in `packages/clob/src/__tests__/order-json.test.ts`
    - **Property 10: orderToJson serialization correctness**
    - **Validates: Requirements 10.3, 11.1, 11.2, 11.3**
  - [x] 6.4 Write property tests for pagination in `packages/clob/src/__tests__/pagination.test.ts`
    - **Property 11: Auto-pagination collects all pages**
    - **Validates: Requirements 12.2**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement authentication modules
  - [x] 8.1 Create `packages/clob/src/auth/hmac.ts`
    - Implement `buildPolyHmacSignature` using Web Crypto API HMAC-SHA256
    - Handle base64 key decoding, message construction, URL-safe base64 encoding of signature
    - _Requirements: 5.2, 5.3, 5.4_
  - [x] 8.2 Create `packages/clob/src/auth/eip712.ts`
    - Implement `buildClobEip712Signature` using viem's `signTypedData`
    - Define ClobAuth domain (`ClobAuthDomain`, version `1`) and types
    - _Requirements: 6.1, 6.2, 6.3_
  - [x] 8.3 Create `packages/clob/src/auth/headers.ts`
    - Implement `createL1Headers` generating L1PolyHeader with EIP-712 signature
    - Implement `createL2Headers` generating L2PolyHeader with HMAC signature
    - _Requirements: 5.1, 6.1_
  - [x] 8.4 Create `packages/clob/src/auth/index.ts` re-exporting all auth modules
    - _Requirements: 5.1, 6.1_
  - [x] 8.5 Write property tests for L2 HMAC headers in `packages/clob/src/__tests__/auth.test.ts`
    - **Property 7: L2 HMAC headers are well-formed and URL-safe**
    - **Validates: Requirements 5.1, 5.2, 5.3**

- [x] 9. Implement HTTP client layer
  - [x] 9.1 Create `packages/clob/src/http.ts`
    - Implement fetch-based `httpGet`, `httpPost`, `httpPut`, `httpDel` functions
    - Set headers: `Content-Type: application/json`, `User-Agent: @poly/clob`, `Accept: */*`, `Connection: keep-alive`
    - Implement retry logic for POST on transient errors (5xx, network errors) with 30ms delay
    - Implement structured error parsing from API responses
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_
  - [x] 9.2 Write unit tests for HTTP client in `packages/clob/src/__tests__/http.test.ts`
    - Test retry behavior with mocked fetch (fail once then succeed)
    - Test error parsing from various API error response shapes
    - _Requirements: 17.4, 17.5_

- [x] 10. Implement OrderBuilder class
  - [x] 10.1 Create `packages/clob/src/order-builder/builder.ts`
    - Implement `OrderBuilder` class with viem `WalletClient` for EIP-712 signing
    - Implement `buildOrder` for limit orders and `buildMarketOrder` for market orders
    - Handle neg_risk routing to correct exchange contract
    - Generate unique salt per order
    - Apply default values (zero address taker, "0" feeRateBps, "0" nonce)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 10.2 Create `packages/clob/src/order-builder/index.ts` re-exporting builder and helpers
    - _Requirements: 4.1_
  - [x] 10.3 Write property test for neg risk exchange selection in `packages/clob/src/__tests__/order-builder.test.ts`
    - **Property 5: Neg risk flag selects correct exchange contract**
    - **Validates: Requirements 4.2**
  - [x] 10.4 Write property test for salt uniqueness in `packages/clob/src/__tests__/order-builder.test.ts`
    - **Property 6: Order salts are unique**
    - **Validates: Requirements 4.3**

- [x] 11. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement ClobClient service class
  - [x] 12.1 Create `packages/clob/src/endpoints.ts`
    - Define all CLOB API endpoint path constants matching the reference implementation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 10.1, 10.4, 12.1, 13.1, 14.1, 15.1_
  - [x] 12.2 Create `packages/clob/src/client.ts`
    - Implement `ClobClient` class composing HTTP client, auth modules, and order builder
    - Implement public methods: `getOrderBook`, `getOrderBooks`, `getMidpoint`, `getPrice`, `getSpread`, `getLastTradePrice`, `getTickSize`, `getNegRisk`, `getFeeRateBps`, `getPricesHistory`, `calculateMarketPrice`, `getOrderBookHash`
    - Implement L1 methods: `createApiKey`, `deriveApiKey`, `createOrDeriveApiKey`, `createOrder`, `createMarketOrder`
    - Implement L2 methods: `postOrder`, `postOrders`, `cancelOrder`, `cancelOrders`, `cancelAll`, `cancelMarketOrders`, `getOpenOrders`, `getTrades`, `getTradesPaginated`, `getBalanceAllowance`, `updateBalanceAllowance`, `postHeartbeat`, `getApiKeys`, `deleteApiKey`
    - Implement convenience methods: `createAndPostOrder`, `createAndPostMarketOrder`
    - Add auth guards: throw on L1 methods without wallet, throw on L2 methods without creds
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 10.4, 10.5, 10.6, 12.1, 12.2, 12.3, 13.1, 13.2, 13.3, 13.4, 13.5, 14.1, 14.2, 14.3, 15.1, 15.2_
  - [x] 12.3 Update `packages/clob/src/index.ts` to re-export all public modules
    - Export from: `client`, `utilities`, `config`, `order-builder`, `order-json`, `pagination`, `auth`, `endpoints`, `http`
    - _Requirements: 17.1_

- [x] 13. Add environment variables for CLOB config
  - [x] 13.1 Update `packages/env/src/server.ts` to add CLOB-related env vars
    - Add `CHAIN_ID: z.coerce.number().default(137)`
    - ~~Add PRIVATE_KEY~~ (removed — Doji uses per-user Magic + Safe)
    - ~~Add optional CLOB_API_KEY, CLOB_SECRET, CLOB_PASSPHRASE~~ (removed — Doji uses per-user credentials only)
    - Note: `CLOB_API_URL` already exists in the env config
    - _Requirements: 18.1, 18.2, 18.3, 18.4_

- [x] 14. Implement tRPC CLOB router
  - [x] 14.1 Create `packages/api/src/routers/clob.ts`
    - Define Zod schemas for all input types (bookParams, tradeParams, openOrderParams, balanceAllowanceParams, priceHistoryParams, createOrderInput, etc.)
    - Implement query procedures: `getOrderBook`, `getOrderBooks`, `getMidpoint`, `getPrice`, `getSpread`, `getLastTradePrice`, `getPricesHistory`, `getOpenOrders`, `getTrades`, `getBalanceAllowance`
    - Implement mutation procedures: `createAndPostOrder`, `cancelOrder`, `cancelAll`, `cancelMarketOrders`, `postHeartbeat`
    - Instantiate `ClobClient` using env config values
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5_
  - [x] 14.2 Integrate CLOB router into the app router in `packages/api/src/routers/index.ts`
    - Add `clob: clobRouter` to the router definition
    - _Requirements: 19.6_

- [x] 15. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Add new CLOB types for cancel responses, status enums, and auxiliary endpoints
  - [x] 16.1 Update `packages/types/src/clob.ts` with new types
    - Add `CancelOrdersResponse` interface: `{ canceled: string[]; not_canceled: string[] }`
    - Add `TradeStatus` enum: `MATCHED | MINED | CONFIRMED | RETRYING | FAILED`
    - Add `OrderStatus` type: `"matched" | "live" | "delayed" | "unmatched"`
    - Add `SimplifiedMarket` interface for simplified market endpoints
    - Add `Notification` interface for notification endpoints
    - Add `OrderScoring` interface for scoring endpoints
    - Add `BuilderOperation` interface for builder operations
    - Add `OrderInsertError` interface: `{ error: string; order?: Record<string, unknown> }`
    - _Requirements: 21.1, 22.1, 22.2, 23.5, 26.9, 27.5_
  - [x] 16.2 Update `packages/types/src/trade.ts` to use `TradeStatus` for the `status` field in the `Trade` interface
    - Import `TradeStatus` from `./clob` and change `status: string` to `status: TradeStatus`
    - _Requirements: 22.3_
  - [x] 16.3 Update `packages/types/src/order.ts` to use `OrderStatus` for the `status` field in the `OrderResponse` interface
    - Import `OrderStatus` from `./clob` and ensure the existing `status` field uses the type
    - _Requirements: 22.4_

- [x] 17. Add new endpoint constants and server info methods
  - [x] 17.1 Update `packages/clob/src/endpoints.ts` with new endpoint path constants
    - Add `GET_SERVER_TIME`, `GET_GEO_RESTRICTION`, `GET_MARKET`, `GET_MARKETS`, `GET_SIMPLIFIED_MARKET`, `GET_SIMPLIFIED_MARKETS`
    - Add `GET_MIDPOINTS`, `GET_PRICES`, `GET_SPREADS`, `GET_LAST_TRADE_PRICES`, `POST_ORDERS`
    - Add `GET_NOTIFICATIONS`, `DROP_NOTIFICATIONS`, `GET_ORDER_SCORING`, `ARE_ORDERS_SCORING`
    - Add `GET_SAMPLING_MARKETS`, `GET_SAMPLING_SIMPLIFIED_MARKETS`, `GET_BUILDER_OPERATIONS`, `POST_BUILDER_OPERATIONS`
    - _Requirements: 20.1, 20.2, 23.1, 23.2, 23.3, 23.4, 24.1, 24.2, 24.3, 24.4, 25.1, 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8_
  - [x] 17.2 Add `getServerTime()` and `getGeoRestriction()` methods to `ClobClient`
    - `getServerTime` calls `GET /time` and returns the server timestamp
    - `getGeoRestriction` calls `GET /geo` and returns restriction status
    - _Requirements: 20.1, 20.2_

- [x] 18. Implement market discovery methods on ClobClient
  - [x] 18.1 Add `getMarket(conditionId)` and `getMarkets(nextCursor?)` methods to `ClobClient`
    - `getMarket` calls `GET /markets/{condition_id}` with path interpolation
    - `getMarkets` calls `GET /markets` with optional cursor query param
    - _Requirements: 23.1, 23.2_
  - [x] 18.2 Add `getSimplifiedMarket(conditionId)` and `getSimplifiedMarkets(nextCursor?)` methods to `ClobClient`
    - `getSimplifiedMarket` calls `GET /simplified-markets/{condition_id}`
    - `getSimplifiedMarkets` calls `GET /simplified-markets` with optional cursor
    - _Requirements: 23.3, 23.4_
  - [x] 18.3 Write property test for market endpoint URL construction in `packages/clob/src/__tests__/client.test.ts`
    - **Property 17: Market endpoint URL construction**
    - **Validates: Requirements 23.1, 23.3**

- [x] 19. Implement batch price methods on ClobClient
  - [x] 19.1 Add `getMidpoints(tokenIds)`, `getPrices(params)`, `getSpreads(tokenIds)`, `getLastTradePrices(tokenIds)` methods to `ClobClient`
    - Each method joins the token ID array with commas for the query parameter
    - `getPrices` also accepts a `side` parameter
    - _Requirements: 24.1, 24.2, 24.3, 24.4_
  - [x] 19.2 Write property test for batch query parameter construction in `packages/clob/src/__tests__/client.test.ts`
    - **Property 13: Batch price query parameter construction**
    - **Validates: Requirements 24.1, 24.2, 24.3, 24.4**

- [x] 20. Implement batch order posting and cancel response typing
  - [x] 20.1 Add `postOrders(orders, orderType?, postOnly?)` method to `ClobClient`
    - Serialize each order via `orderToJson` and POST the array to `/orders`
    - _Requirements: 25.1, 25.2_
  - [x] 20.2 Update `cancelOrder`, `cancelOrders`, `cancelAll`, `cancelMarketOrders` return types to `CancelOrdersResponse`
    - Parse API response into `{ canceled: string[], not_canceled: string[] }`
    - _Requirements: 21.2_
  - [x] 20.3 Write property test for batch order serialization in `packages/clob/src/__tests__/order-json.test.ts`
    - **Property 14: Batch order serialization preserves all orders**
    - **Validates: Requirements 25.1, 25.2**
  - [x] 20.4 Write property test for cancel response disjoint sets in `packages/clob/src/__tests__/client.test.ts`
    - **Property 15: Cancel response disjoint sets**
    - **Validates: Requirements 21.1, 21.2**

- [x] 21. Implement order insert error parsing
  - [x] 21.1 Update HTTP client error parsing in `packages/clob/src/http.ts` to produce `OrderInsertError` for order-related endpoints
    - Parse error responses into `{ error: string, order?: Record<string, unknown> }` structure
    - Handle known error messages: tick size, min size, max size, insufficient balance
    - _Requirements: 27.1, 27.2, 27.3, 27.4_
  - [x] 21.2 Write property test for order insert error parsing in `packages/clob/src/__tests__/http.test.ts`
    - **Property 16: Order insert error parsing preserves error message**
    - **Validates: Requirements 27.4**

- [x] 22. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 23. Implement auxiliary endpoint methods
  - [x] 23.1 Add notification methods to `ClobClient`
    - `getNotifications()` calls `GET /notifications` (L2 auth)
    - `dropNotifications(ids)` calls `POST /drop-notifications` (L2 auth)
    - _Requirements: 26.1, 26.2_
  - [x] 23.2 Add order scoring methods to `ClobClient`
    - `getOrderScoring()` calls `GET /order-scoring`
    - `areOrdersScoring()` calls `GET /are-orders-scoring`
    - _Requirements: 26.3, 26.4_
  - [x] 23.3 Add sampling market methods to `ClobClient`
    - `getSamplingMarkets(nextCursor?)` calls `GET /sampling-markets`
    - `getSamplingSimplifiedMarkets(nextCursor?)` calls `GET /sampling-simplified-markets`
    - _Requirements: 26.5, 26.6_
  - [x] 23.4 Add builder operation methods to `ClobClient`
    - `getBuilderOperations()` calls `GET /builder-operations` (L2 auth)
    - `postBuilderOperation(operation)` calls `POST /builder-operations` (L2 auth)
    - _Requirements: 26.7, 26.8_

- [x] 24. Update tRPC CLOB router with new endpoints
  - [x] 24.1 Add new query procedures to `packages/api/src/routers/clob.ts`
    - Add `getServerTime`, `getGeoRestriction` (public, no input)
    - Add `getMarket`, `getMarkets`, `getSimplifiedMarket`, `getSimplifiedMarkets` (public)
    - Add `getMidpoints`, `getPrices`, `getSpreads`, `getLastTradePrices` (public, batch)
    - Add `getSamplingMarkets`, `getSamplingSimplifiedMarkets` (public)
    - Add `getNotifications`, `getOrderScoring`, `areOrdersScoring`, `getBuilderOperations` (authenticated)
    - _Requirements: 19.1, 19.2, 19.5, 20.1, 20.2, 23.1, 23.2, 23.3, 23.4, 24.1, 24.2, 24.3, 24.4, 26.1, 26.3, 26.4, 26.5, 26.6, 26.7_
  - [x] 24.2 Add new mutation procedures to `packages/api/src/routers/clob.ts`
    - Add `createAndPostOrders` for batch order posting
    - Add `cancelOrders`, `cancelMarketOrders` mutations
    - Add `dropNotifications`, `postBuilderOperation` mutations
    - Define Zod schemas for all new input types
    - _Requirements: 19.3, 19.5, 25.1, 26.2, 26.8_

- [x] 25. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The implementation uses `viem` instead of `ethers` v5 for modern TypeScript-first EIP-712 signing
- HTTP client uses native `fetch` instead of `axios` per project requirements
- All wallet/signing operations are server-side only
