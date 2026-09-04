# Requirements Document

## Introduction

This feature integrates Polymarket CLOB (Central Limit Order Book) client capabilities into the existing full-stack TypeScript monorepo. It introduces a new `packages/clob` package providing server-side services for authentication, order building, market data retrieval, order management, and balance queries against the Polymarket CLOB API. The package exposes functionality through tRPC routers and adds necessary CLOB-specific types to the shared types package.

## Glossary

- **CLOB_Service**: The server-side CLOB client service in `packages/clob` that wraps the Polymarket CLOB REST API
- **Order_Builder**: The component responsible for converting simplified user orders into signed EIP-712 orders
- **Auth_Module**: The authentication module handling L1 (EIP-712 wallet signature) and L2 (HMAC-SHA256 API key) authentication
- **Rounding_Engine**: The utility module providing tick-size-aware decimal rounding for prices, sizes, and amounts
- **CLOB_Router**: The tRPC router in `packages/api` that exposes CLOB functionality to the server application
- **Env_Config**: The T3 Env validation module in `packages/env` managing CLOB-related environment variables
- **UserOrder**: A simplified order input containing tokenID, price, size, and side
- **UserMarketOrder**: A simplified market order input containing tokenID, amount, side, and optional price
- **SignedOrder**: An EIP-712 signed order ready for submission to the CLOB API
- **TickSize**: One of `"0.1"`, `"0.01"`, `"0.001"`, `"0.0001"` representing market price granularity
- **RoundConfig**: A configuration object mapping a TickSize to decimal precision for price, size, and amount fields
- **OrderBookSummary**: A snapshot of an order book containing bids, asks, hash, tick size, and last trade price
- **L1_Auth**: EIP-712 typed-data wallet signature used for API key derivation and order signing
- **L2_Auth**: HMAC-SHA256 signature using API key credentials for authenticated API requests
- **Neg_Risk**: A flag indicating a market uses the NegRiskExchange contract instead of the standard Exchange contract
- **ContractConfig**: A mapping of chain-specific smart contract addresses (Exchange, NegRiskAdapter, NegRiskExchange, Collateral, ConditionalTokens)
- **Chain**: An enum of supported blockchain networks: POLYGON (137) and AMOY (80002)
- **Heartbeat**: A keep-alive mechanism where missing a heartbeat within 10 seconds cancels all open orders

## Requirements

### Requirement 1: CLOB Type Definitions

**User Story:** As a developer, I want comprehensive CLOB-specific TypeScript types in the shared types package, so that all packages have consistent type-safe access to CLOB domain models.

#### Acceptance Criteria

1. THE Types_Package SHALL export a `TickSize` type defined as `"0.1" | "0.01" | "0.001" | "0.0001"`
2. THE Types_Package SHALL export a `RoundConfig` interface with `price`, `size`, and `amount` fields of type `number`
3. THE Types_Package SHALL export an `OrderBookSummary` interface containing `market`, `asset_id`, `timestamp`, `bids`, `asks`, `min_order_size`, `tick_size`, `neg_risk`, `last_trade_price`, and `hash` fields
4. THE Types_Package SHALL export an `OrderSummary` interface with `price` and `size` fields of type `string`
5. THE Types_Package SHALL export an `ApiKeyCreds` interface with `key`, `secret`, and `passphrase` fields of type `string`
6. THE Types_Package SHALL export `Chain`, `AssetType`, and `PriceHistoryInterval` enums matching the Polymarket CLOB API values
7. THE Types_Package SHALL export a `ContractConfig` type containing `exchange`, `negRiskAdapter`, `negRiskExchange`, `collateral`, and `conditionalTokens` address fields
8. THE Types_Package SHALL export `BalanceAllowanceResponse`, `HeartbeatResponse`, `MarketPrice`, and `PaginationPayload` interfaces matching the CLOB API response shapes
9. THE Types_Package SHALL export RFQ-related types including `RfqRequest`, `RfqQuote`, `RfqRequestResponse`, `RfqQuoteResponse`, and associated parameter types

### Requirement 2: Tick-Size-Aware Rounding Utilities

**User Story:** As a developer, I want rounding utility functions that respect tick-size decimal precision, so that order amounts are calculated correctly for each market's granularity.

#### Acceptance Criteria

1. THE Rounding_Engine SHALL provide a `roundNormal` function that rounds a number to a specified number of decimal places using standard rounding
2. THE Rounding_Engine SHALL provide a `roundDown` function that truncates a number to a specified number of decimal places using floor rounding
3. THE Rounding_Engine SHALL provide a `roundUp` function that rounds a number up to a specified number of decimal places using ceiling rounding
4. THE Rounding_Engine SHALL provide a `decimalPlaces` function that returns the count of decimal digits in a number
5. WHEN a number already has fewer decimal places than the target, THE Rounding_Engine SHALL return the number unchanged
6. THE Rounding_Engine SHALL define a `ROUNDING_CONFIG` constant mapping each TickSize to its RoundConfig with correct decimal precision values
7. THE Rounding_Engine SHALL provide a `priceValid` function that returns true only when a price is within the range `[tickSize, 1 - tickSize]`
8. THE Rounding_Engine SHALL provide an `isTickSizeSmaller` function that compares two TickSize values numerically

### Requirement 3: Order Amount Calculation

**User Story:** As a developer, I want correct maker/taker amount calculation from user-friendly order inputs, so that orders are built with properly rounded amounts matching the CLOB API expectations.

#### Acceptance Criteria

1. WHEN a BUY limit order is created, THE Order_Builder SHALL calculate `rawTakerAmt` as the size rounded down, and `rawMakerAmt` as `size * price` with tick-size-aware rounding
2. WHEN a SELL limit order is created, THE Order_Builder SHALL calculate `rawMakerAmt` as the size rounded down, and `rawTakerAmt` as `size * price` with tick-size-aware rounding
3. WHEN a BUY market order is created, THE Order_Builder SHALL calculate `rawMakerAmt` as the dollar amount rounded down, and `rawTakerAmt` as `amount / price` with tick-size-aware rounding
4. WHEN a SELL market order is created, THE Order_Builder SHALL calculate `rawMakerAmt` as the share amount rounded down, and `rawTakerAmt` as `amount * price` with tick-size-aware rounding
5. WHEN an intermediate amount exceeds the configured decimal precision, THE Order_Builder SHALL first attempt rounding up with extra precision, then fall back to rounding down to the target precision
6. THE Order_Builder SHALL convert raw amounts to on-chain units using 6 decimal places (USDC/conditional token decimals)

### Requirement 4: EIP-712 Order Signing

**User Story:** As a developer, I want to build and sign EIP-712 typed-data orders, so that orders can be cryptographically verified on-chain.

#### Acceptance Criteria

1. WHEN a UserOrder is submitted, THE Order_Builder SHALL produce a SignedOrder containing salt, maker, signer, taker, tokenId, makerAmount, takerAmount, expiration, nonce, feeRateBps, side, signatureType, and signature fields
2. WHEN a market uses neg_risk, THE Order_Builder SHALL use the NegRiskExchange contract address for signing instead of the standard Exchange address
3. THE Order_Builder SHALL generate a unique salt for each order to ensure order uniqueness
4. WHEN no taker address is provided, THE Order_Builder SHALL use the zero address to indicate a public order
5. WHEN no feeRateBps is provided, THE Order_Builder SHALL default to `"0"`
6. WHEN no nonce is provided, THE Order_Builder SHALL default to `"0"`

### Requirement 5: HMAC-SHA256 L2 Authentication

**User Story:** As a developer, I want HMAC-SHA256 API key authentication for CLOB API requests, so that authenticated endpoints can be called securely.

#### Acceptance Criteria

1. THE Auth_Module SHALL generate L2 headers containing POLY_ADDRESS, POLY_SIGNATURE, POLY_TIMESTAMP, POLY_API_KEY, and POLY_PASSPHRASE fields
2. WHEN generating an L2 signature, THE Auth_Module SHALL construct the message as `timestamp + method + requestPath + body` and sign it with HMAC-SHA256 using the API key secret
3. THE Auth_Module SHALL encode the HMAC signature as URL-safe base64 (replacing `+` with `-` and `/` with `_`)
4. THE Auth_Module SHALL use the Web Crypto API (`globalThis.crypto.subtle`) for all HMAC operations

### Requirement 6: EIP-712 L1 Authentication

**User Story:** As a developer, I want EIP-712 wallet-based authentication for API key derivation, so that API keys can be created and derived from wallet ownership proofs.

#### Acceptance Criteria

1. THE Auth_Module SHALL generate L1 headers containing POLY_ADDRESS, POLY_SIGNATURE, POLY_TIMESTAMP, and POLY_NONCE fields
2. WHEN generating an L1 signature, THE Auth_Module SHALL sign an EIP-712 typed-data message with domain name "ClobAuthDomain", version "1", and the appropriate chain ID
3. THE Auth_Module SHALL include the signer address, timestamp, nonce, and attestation message in the EIP-712 value

### Requirement 7: Market Data Retrieval

**User Story:** As a developer, I want to fetch order books, prices, midpoints, and spreads from the CLOB API, so that the application can display real-time market data.

#### Acceptance Criteria

1. WHEN a single token ID is provided, THE CLOB_Service SHALL fetch and return the full OrderBookSummary for that token
2. WHEN multiple BookParams are provided, THE CLOB_Service SHALL fetch order books in batch and return an array of OrderBookSummary objects
3. THE CLOB_Service SHALL provide methods to fetch midpoint, price, spread, and last trade price for single tokens and in batch
4. THE CLOB_Service SHALL provide a method to fetch price history with configurable interval, start/end timestamps, and fidelity parameters
5. THE CLOB_Service SHALL provide a method to resolve the tick size for a given token ID from the API
6. THE CLOB_Service SHALL provide a method to resolve the neg_risk flag for a given token ID from the API
7. THE CLOB_Service SHALL provide a method to resolve the fee rate in basis points for a given token ID from the API

### Requirement 8: Order Book Hash Generation

**User Story:** As a developer, I want to generate SHA-1 hashes of order book snapshots, so that I can detect changes in the order book efficiently.

#### Acceptance Criteria

1. WHEN an OrderBookSummary is provided, THE CLOB_Service SHALL generate a SHA-1 hash by clearing the hash field, JSON-serializing the object, hashing the result, and storing the hex-encoded hash back in the hash field
2. THE CLOB_Service SHALL use the Web Crypto API (`globalThis.crypto.subtle`) for SHA-1 hash computation

### Requirement 9: Market Price Calculation from Order Book Depth

**User Story:** As a developer, I want to calculate executable market prices from order book depth, so that market orders can determine the correct price to fill at.

#### Acceptance Criteria

1. WHEN calculating a buy market price, THE CLOB_Service SHALL walk the asks from highest to lowest price, accumulating `size * price` until the target dollar amount is reached, and return that price level
2. WHEN calculating a sell market price, THE CLOB_Service SHALL walk the bids from highest to lowest price, accumulating `size` until the target share amount is reached, and return that price level
3. WHEN the order book depth is insufficient for a FOK order, THE CLOB_Service SHALL throw an error indicating no match
4. WHEN the order book depth is insufficient for a FAK order, THE CLOB_Service SHALL return the best available price (first position)

### Requirement 10: Order Management

**User Story:** As a developer, I want to create, post, and cancel orders through the CLOB API, so that the application can manage trading operations.

#### Acceptance Criteria

1. WHEN posting a limit order, THE CLOB_Service SHALL accept GTC and GTD order types with optional post-only flag
2. WHEN posting a market order, THE CLOB_Service SHALL accept FOK and FAK order types
3. IF a post-only flag is set on a non-GTC/GTD order type, THEN THE CLOB_Service SHALL reject the request with a descriptive error
4. THE CLOB_Service SHALL provide methods to cancel a single order by ID, cancel multiple orders by ID array, cancel all orders, and cancel orders for a specific market
5. THE CLOB_Service SHALL provide a method to fetch open orders with optional filtering by market and asset ID
6. THE CLOB_Service SHALL serialize signed orders to the JSON payload format expected by the CLOB API using an `orderToJson` function

### Requirement 11: Order JSON Serialization

**User Story:** As a developer, I want to serialize SignedOrder objects to the CLOB API payload format, so that orders can be correctly transmitted to the API.

#### Acceptance Criteria

1. THE CLOB_Service SHALL provide an `orderToJson` function that converts a SignedOrder into a NewOrder payload with owner, orderType, and deferExec fields
2. WHEN the orderType is GTC or GTD and postOnly is true, THE `orderToJson` function SHALL include the postOnly field in the payload
3. IF postOnly is set to true and the orderType is not GTC or GTD, THEN THE `orderToJson` function SHALL throw an error

### Requirement 12: Trade and Position Data

**User Story:** As a developer, I want to fetch trade history with cursor-based pagination, so that the application can display historical trading activity.

#### Acceptance Criteria

1. THE CLOB_Service SHALL provide a method to fetch a single page of trades with optional filtering by market, asset ID, and time range
2. THE CLOB_Service SHALL provide an auto-pagination method that collects all trade pages by following cursors until the end cursor `"LTE="` is reached
3. THE CLOB_Service SHALL use `"MA=="` as the initial cursor value for pagination

### Requirement 13: API Key Management

**User Story:** As a developer, I want to create, derive, list, and delete API keys, so that the application can manage CLOB API authentication credentials.

#### Acceptance Criteria

1. THE CLOB_Service SHALL provide a method to create a new API key using L1 authentication, returning ApiKeyCreds
2. THE CLOB_Service SHALL provide a method to derive an API key using L1 authentication, returning ApiKeyCreds
3. THE CLOB_Service SHALL provide a `createOrDeriveApiKey` method that first attempts derivation and falls back to creation on failure
4. THE CLOB_Service SHALL provide methods to list and delete API keys using L2 authentication
5. THE CLOB_Service SHALL provide methods to create, list, delete, and validate readonly API keys

### Requirement 14: Balance and Allowance Queries

**User Story:** As a developer, I want to query token balances and allowances, so that the application can display account state and validate order feasibility.

#### Acceptance Criteria

1. WHEN querying balance and allowance, THE CLOB_Service SHALL accept an asset type (COLLATERAL or CONDITIONAL) and optional token ID parameter
2. THE CLOB_Service SHALL return a BalanceAllowanceResponse containing balance and allowance as string values
3. THE CLOB_Service SHALL provide a method to trigger a balance allowance update on the API

### Requirement 15: Heartbeat System

**User Story:** As a developer, I want to send heartbeat signals to the CLOB API, so that open orders are not automatically cancelled due to inactivity.

#### Acceptance Criteria

1. THE CLOB_Service SHALL provide a method to post a heartbeat, optionally chaining from a previous heartbeat_id
2. THE CLOB_Service SHALL return a HeartbeatResponse containing the new heartbeat_id and optional error field

### Requirement 16: Contract Configuration

**User Story:** As a developer, I want chain-specific contract address configuration, so that the service routes transactions to the correct smart contracts per network.

#### Acceptance Criteria

1. THE CLOB_Service SHALL provide a `getContractConfig` function that returns the correct ContractConfig for Polygon mainnet (chain ID 137)
2. THE CLOB_Service SHALL provide a `getContractConfig` function that returns the correct ContractConfig for Amoy testnet (chain ID 80002)
3. IF an unsupported chain ID is provided, THEN THE `getContractConfig` function SHALL throw an error with a descriptive message

### Requirement 17: HTTP Client Layer

**User Story:** As a developer, I want a lightweight HTTP client using the Fetch API instead of axios, so that the service has minimal dependencies and runs efficiently in server environments.

#### Acceptance Criteria

1. THE CLOB_Service SHALL use the native Fetch API for all HTTP requests instead of axios
2. THE CLOB_Service SHALL support GET, POST, PUT, and DELETE HTTP methods
3. THE CLOB_Service SHALL set appropriate headers including Content-Type, User-Agent, Accept, and Connection
4. WHEN a server error (5xx) or network error occurs on a POST request, THE CLOB_Service SHALL retry once after a short delay
5. WHEN an API error response is received, THE CLOB_Service SHALL parse and return a structured error object containing the error message and HTTP status

### Requirement 18: Environment Configuration

**User Story:** As a developer, I want validated environment variables for CLOB configuration, so that the service is correctly configured at startup with fail-fast validation.

#### Acceptance Criteria

1. THE Env_Config SHALL validate a `CLOB_API_URL` environment variable as a URL string with a default of `"https://clob.polymarket.com"`
2. THE Env_Config SHALL validate a `CHAIN_ID` environment variable as a number, defaulting to `137`
3. THE Env_Config SHALL NOT include PRIVATE_KEY (Doji uses per-user Magic + Safe; no server-side wallet)
4. THE Env_Config SHALL NOT include CLOB_API_KEY, CLOB_SECRET, or CLOB_PASSPHRASE (Doji uses per-user credentials only)

### Requirement 19: tRPC Router Integration

**User Story:** As a developer, I want CLOB functionality exposed through tRPC routers, so that the frontend can access market data and the server can manage orders through a type-safe API.

#### Acceptance Criteria

1. THE CLOB_Router SHALL expose query procedures for fetching order books, prices, midpoints, spreads, and last trade prices
2. THE CLOB_Router SHALL expose query procedures for fetching open orders and trade history
3. THE CLOB_Router SHALL expose mutation procedures for creating, posting, and cancelling orders
4. THE CLOB_Router SHALL expose query procedures for balance and allowance data
5. THE CLOB_Router SHALL validate all input parameters using Zod schemas
6. THE CLOB_Router SHALL be integrated into the existing app router in `packages/api`

### Requirement 20: Server Time and Geographic Restriction

**User Story:** As a developer, I want to fetch the CLOB server time and geographic restriction status, so that I can synchronize authentication timestamps and enforce compliance restrictions.

#### Acceptance Criteria

1. THE CLOB_Service SHALL provide a `getServerTime` method that calls `GET /time` and returns the server timestamp
2. THE CLOB_Service SHALL provide a `getGeoRestriction` method that calls `GET /geo` and returns whether the current user is geographically restricted
3. WHEN generating L2 authentication signatures, THE Auth_Module SHALL use the server time from `getServerTime` when local clock synchronization is needed

### Requirement 21: Cancel Orders Response Type

**User Story:** As a developer, I want properly typed cancel order responses, so that I can determine which orders were successfully cancelled and which were not.

#### Acceptance Criteria

1. THE Types_Package SHALL export a `CancelOrdersResponse` interface with `canceled` (array of order ID strings) and `not_canceled` (array of order ID strings) fields
2. WHEN cancelling orders via `cancelOrders`, `cancelAll`, or `cancelMarketOrders`, THE CLOB_Service SHALL return a `CancelOrdersResponse` instead of `unknown`

### Requirement 22: Trade Status and Order Status Enums

**User Story:** As a developer, I want explicit enums for trade and order statuses, so that status values are type-safe and match the official CLOB API values.

#### Acceptance Criteria

1. THE Types_Package SHALL export a `TradeStatus` enum with values `MATCHED`, `MINED`, `CONFIRMED`, `RETRYING`, and `FAILED`
2. THE Types_Package SHALL export an `OrderStatus` type defined as `"matched" | "live" | "delayed" | "unmatched"`
3. THE Trade interface in `packages/types/src/trade.ts` SHALL use `TradeStatus` for its `status` field instead of `string`
4. THE OrderResponse interface in `packages/types/src/order.ts` SHALL use `OrderStatus` for its `status` field

### Requirement 23: Market Discovery Endpoints

**User Story:** As a developer, I want to fetch market data from the CLOB API, so that the application can discover and display available prediction markets.

#### Acceptance Criteria

1. THE CLOB_Service SHALL provide a `getMarket(conditionId: string)` method that calls `GET /markets/{condition_id}` and returns market data
2. THE CLOB_Service SHALL provide a `getMarkets(nextCursor?: string)` method that calls `GET /markets` and returns a paginated list of markets
3. THE CLOB_Service SHALL provide a `getSimplifiedMarket(conditionId: string)` method that calls `GET /simplified-markets/{condition_id}` and returns simplified market data
4. THE CLOB_Service SHALL provide a `getSimplifiedMarkets(nextCursor?: string)` method that calls `GET /simplified-markets` and returns a paginated list of simplified markets
5. THE Types_Package SHALL export a `SimplifiedMarket` interface representing the simplified market response shape

### Requirement 24: Batch Price Endpoints

**User Story:** As a developer, I want batch price retrieval methods, so that the application can efficiently fetch pricing data for multiple tokens in a single request.

#### Acceptance Criteria

1. THE CLOB_Service SHALL provide a `getMidpoints(tokenIds: string[])` method that calls `GET /midpoints` with a comma-separated list of token IDs and returns a record of token ID to midpoint values
2. THE CLOB_Service SHALL provide a `getPrices(params: { tokenIds: string[]; side: Side })` method that calls `GET /prices` and returns a record of token ID to price values
3. THE CLOB_Service SHALL provide a `getSpreads(tokenIds: string[])` method that calls `GET /spreads` and returns a record of token ID to spread values
4. THE CLOB_Service SHALL provide a `getLastTradePrices(tokenIds: string[])` method that calls `GET /last-trade-price` with a comma-separated list of token IDs and returns a record of token ID to last trade price values

### Requirement 25: Batch Order Posting

**User Story:** As a developer, I want to post multiple orders in a single request, so that the application can efficiently submit batch orders to the CLOB API.

#### Acceptance Criteria

1. THE CLOB_Service SHALL provide a `postOrders(orders: SignedOrder[], orderType?: OrderType, postOnly?: boolean)` method that calls `POST /orders` with an array of serialized order payloads
2. THE CLOB_Service SHALL serialize each order in the batch using the `orderToJson` function
3. WHEN any order in the batch fails validation, THE CLOB_Service SHALL return the error details identifying which orders failed

### Requirement 26: Notifications, Order Scoring, Sampling, and Builder Operations

**User Story:** As a developer, I want access to auxiliary CLOB API endpoints for notifications, order scoring, sampling markets, and builder operations, so that the application can support advanced trading features and market creation workflows.

#### Acceptance Criteria

1. THE CLOB_Service SHALL provide a `getNotifications()` method that calls `GET /notifications` and returns an array of notification objects
2. THE CLOB_Service SHALL provide a `dropNotifications(ids: string[])` method that calls `POST /drop-notifications` to dismiss specified notifications
3. THE CLOB_Service SHALL provide a `getOrderScoring()` method that calls `GET /order-scoring` and returns scoring data for maker rewards
4. THE CLOB_Service SHALL provide an `areOrdersScoring()` method that calls `GET /are-orders-scoring` and returns whether orders are currently eligible for scoring
5. THE CLOB_Service SHALL provide a `getSamplingMarkets(nextCursor?: string)` method that calls `GET /sampling-markets` and returns a paginated list of sampling markets
6. THE CLOB_Service SHALL provide a `getSamplingSimplifiedMarkets(nextCursor?: string)` method that calls `GET /sampling-simplified-markets` and returns a paginated list of simplified sampling markets
7. THE CLOB_Service SHALL provide a `getBuilderOperations()` method that calls `GET /builder-operations` and returns builder operation data
8. THE CLOB_Service SHALL provide a `postBuilderOperation(operation: BuilderOperation)` method that calls `POST /builder-operations` to submit a new builder operation
9. THE Types_Package SHALL export `Notification`, `OrderScoring`, and `BuilderOperation` interfaces matching the CLOB API response shapes

### Requirement 27: Order Insert Error Messages

**User Story:** As a developer, I want descriptive error messages for order validation failures, so that the application can display actionable feedback when orders are rejected.

#### Acceptance Criteria

1. WHEN the CLOB API rejects an order due to price not being a multiple of the tick size, THE CLOB_Service SHALL surface the error message "order price is not a multiple of the tick size"
2. WHEN the CLOB API rejects an order due to size below minimum, THE CLOB_Service SHALL surface the error message "order size below minimum"
3. WHEN the CLOB API rejects an order due to size above maximum, THE CLOB_Service SHALL surface the error message "order size above maximum"
4. IF an order is rejected by the CLOB API, THEN THE CLOB_Service SHALL parse the error response and return a structured `OrderInsertError` containing the error message and the rejected order details
5. THE Types_Package SHALL export an `OrderInsertError` interface with `error` (string) and `order` (optional object) fields
