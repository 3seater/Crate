# Requirements Document

## Introduction

This feature audits and fixes all endpoints, types, and Zod schemas across the Polymarket monorepo to eliminate duplication, resolve naming conflicts, enforce consistent validation, and ensure a single source of truth for every data structure. The goal is to make the type system reliable end-to-end: from external API responses through Zod validation, into TypeScript interfaces, across tRPC boundaries, and into the frontend.

## Glossary

- **Shared_Types_Package**: The `packages/types/` package that serves as the single source of truth for all TypeScript interfaces and type definitions used across the monorepo
- **Zod_Schema**: A runtime validation schema defined using the Zod library that validates data at API boundaries
- **tRPC_Router**: A type-safe API router defined using tRPC that exposes procedures (queries/mutations) to the frontend
- **Server_AppRouter**: The primary `appRouter` defined in `apps/server/src/routers/index.ts` that the running Hono server mounts
- **Legacy_AppRouter**: The backward-compatibility `appRouter` defined in `packages/api/src/routers/index.ts` that is not mounted by the running server
- **Branded_Type**: A nominal type created via phantom branding that prevents accidental misuse of string identifiers (e.g., `TokenId`, `WalletAddress`)
- **CLOB_Client**: A client class for interacting with the Polymarket Central Limit Order Book API
- **Gamma_API**: The Polymarket API (`https://gamma-api.polymarket.com`) that returns event and market data, using mixed camelCase and snake_case field names
- **Data_API**: The Polymarket API (`https://data-api.polymarket.com`) that returns user positions, trades, activity, and leaderboard data
- **Bridge_API**: The Polymarket API that handles cross-chain deposits, withdrawals, and asset bridging
- **CLOB_API**: The Polymarket API (`https://clob.polymarket.com`) that handles orderbooks, prices, and order management
- **Relayer_API**: The Polymarket relayer service (`https://relayer-v2.polymarket.com`) that provides gasless transactions for builders
- **Canonical_Naming**: The single chosen naming convention (either camelCase or snake_case) for each field, eliminating dual-name fields
- **Output_Schema**: A Zod schema applied to tRPC procedure outputs to validate data returned to the frontend at runtime
- **Negative_Risk_Market**: A multi-outcome winner-take-all market where NO shares convert to YES shares in all other outcomes
- **Augmented_Negative_Risk**: A negative risk market with named outcomes, placeholder outcomes, and an "Other" outcome that changes definition as placeholders are clarified
- **Builder_Authentication**: HMAC-signed headers (`POLY_BUILDER_API_KEY`, `POLY_BUILDER_SIGNATURE`, `POLY_BUILDER_TIMESTAMP`, `POLY_BUILDER_PASSPHRASE`) required for relayer access and order attribution

## Requirements

### Requirement 1: Unify Router Definitions

**User Story:** As a developer, I want a single authoritative `appRouter` and `AppRouter` type, so that all endpoints are accessible and the frontend always gets the correct type.

#### Acceptance Criteria

1. THE Server_AppRouter SHALL include all sub-routers from both the current Server_AppRouter and the Legacy_AppRouter (including the auth router)
2. THE Shared_Types_Package SHALL export the `AppRouter` type from a single location that references the Server_AppRouter
3. WHEN a developer imports `AppRouter`, THE Shared_Types_Package SHALL resolve to the Server_AppRouter type definition
4. THE Legacy_AppRouter SHALL be removed or replaced with a re-export of the Server_AppRouter
5. IF a sub-router is defined in `packages/api/` but not mounted in the Server_AppRouter, THEN THE Server_AppRouter SHALL mount that sub-router

### Requirement 2: Consolidate CLOB Client Usage

**User Story:** As a developer, I want a single CLOB client implementation used across the entire monorepo, so that constructor signatures, method calls, and type imports are consistent.

#### Acceptance Criteria

1. THE Server_AppRouter SHALL use the `@poly/clob` package ClobClient for all CLOB operations, including read-only queries
2. WHEN the server performs read-only CLOB queries, THE CLOB_Client SHALL be instantiated without credentials using the `@poly/clob` package
3. THE codebase SHALL NOT import from `@polymarket/clob-client` (the external npm package) in any application or package code
4. WHEN a CLOB_Client method is called, THE CLOB_Client SHALL use a consistent constructor signature across all call sites

### Requirement 3: Establish Canonical Field Naming

**User Story:** As a developer, I want each data field to have exactly one canonical name, so that I never encounter ambiguous dual-named fields like `condition_id`/`conditionId`.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define each field with exactly one canonical name per interface (no dual `condition_id`/`conditionId`, `end_date_iso`/`endDate`/`endDateIso` fields)
2. WHEN the Gamma_API returns data with mixed naming conventions, THE Zod_Schema SHALL normalize field names to the Canonical_Naming convention during validation
3. WHEN the Data_API returns data with mixed naming conventions, THE Zod_Schema SHALL normalize field names to the Canonical_Naming convention during validation
4. THE `Market` interface in the Shared_Types_Package SHALL use a single name for each field
5. THE `Event` interface in the Shared_Types_Package SHALL use a single name for each field
6. THE `MarketSummary` interface in the Shared_Types_Package SHALL use a single name for each field

### Requirement 4: Centralize Type Definitions

**User Story:** As a developer, I want all shared TypeScript interfaces defined in `packages/types/`, so that server-local type definitions do not drift from the canonical types.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define interfaces for all data structures currently defined locally in server lib files (including `ActivityItem`, `PortfolioValue`, `LeaderboardEntry`, `BuilderLeaderboardEntry`, `HolderEntry`, `DepositAddresses`, `WithdrawAddresses`, `Quote`, `SupportedAsset`, `TransactionStatus`, `SearchResult`, `PublicProfile`, `OrderBookSnapshot`, `PriceHistoryPoint`)
2. WHEN a server lib file needs a type that represents a domain entity, THE server lib file SHALL import the type from the Shared_Types_Package
3. THE server lib files SHALL NOT define local interfaces that duplicate types available in the Shared_Types_Package
4. WHEN a new domain type is needed, THE developer SHALL add the type to the Shared_Types_Package

### Requirement 5: Align Zod Schemas with TypeScript Interfaces

**User Story:** As a developer, I want Zod schemas and TypeScript interfaces to describe the same shape, so that runtime validation and compile-time types never diverge.

#### Acceptance Criteria

1. WHEN a Zod_Schema uses `.default()` on a field, THE corresponding TypeScript interface in the Shared_Types_Package SHALL reflect that the field is required (not optional) in the validated output type
2. WHEN a Zod_Schema uses `z.coerce.number()`, THE corresponding TypeScript interface field SHALL be typed as `number`
3. THE Zod_Schema validated output types (via `z.infer`) SHALL be structurally compatible with the corresponding interfaces in the Shared_Types_Package
4. WHEN a Zod_Schema uses `.passthrough()`, THE corresponding TypeScript interface SHALL document that additional fields may be present at runtime
5. THE Shared_Types_Package SHALL export Zod-inferred types or ensure manual interfaces match Zod schema output shapes for every validated domain entity

### Requirement 6: Add tRPC Output Schemas

**User Story:** As a developer, I want tRPC procedures to validate their outputs with Zod schemas, so that the frontend receives runtime-validated data with accurate types.

#### Acceptance Criteria

1. WHEN a tRPC procedure returns data from an external API, THE tRPC_Router SHALL define an `.output()` Zod_Schema on that procedure
2. THE Output_Schema SHALL reference the same Zod schemas used by the server lib fetch helpers (no duplicate schema definitions)
3. WHEN a tRPC procedure output fails Zod validation, THE tRPC_Router SHALL return a structured error to the client
4. THE tRPC procedures in the events, markets, data, bridge, and clob routers SHALL each define output schemas

### Requirement 7: Strengthen Input Validation

**User Story:** As a developer, I want tRPC input schemas to validate domain-specific formats, so that invalid identifiers and addresses are rejected before reaching business logic.

#### Acceptance Criteria

1. WHEN a tRPC procedure accepts a wallet address input, THE input Zod_Schema SHALL validate that the value matches the Ethereum address format (0x-prefixed, 40 hex characters)
2. WHEN a tRPC procedure accepts a condition ID input, THE input Zod_Schema SHALL validate that the value is a non-empty string conforming to the expected identifier format
3. WHEN a tRPC procedure accepts a chain identifier, THE input Zod_Schema SHALL validate against the set of supported chain values
4. WHEN a tRPC procedure accepts a token symbol or asset identifier, THE input Zod_Schema SHALL validate against the set of supported values or a defined format
5. IF a tRPC procedure receives an input that fails format validation, THEN THE tRPC_Router SHALL return a descriptive validation error

### Requirement 8: Integrate Branded Types in Router Inputs

**User Story:** As a developer, I want router input schemas to produce branded types after validation, so that downstream code benefits from nominal type safety.

#### Acceptance Criteria

1. WHEN a tRPC input schema validates a wallet address, THE validated output SHALL be typed as `WalletAddress` (branded type)
2. WHEN a tRPC input schema validates a condition ID, THE validated output SHALL be typed as `ConditionId` (branded type)
3. WHEN a tRPC input schema validates a token ID, THE validated output SHALL be typed as `TokenId` (branded type)
4. THE Shared_Types_Package SHALL export Zod schema helpers (e.g., `zodWalletAddress`, `zodConditionId`, `zodTokenId`) that validate format and produce branded types via `.transform()`

### Requirement 9: Remove Duplicate Zod Schema Definitions

**User Story:** As a developer, I want each Zod schema defined once and imported everywhere, so that schema changes propagate consistently.

#### Acceptance Criteria

1. THE `MarketSummarySchema` SHALL be defined in a single location and imported by all consumers (not redefined in `schemas/data.ts` separately from `schemas/gamma.ts`)
2. THE `ClosedPositionSchema`, `BuilderLeaderboardEntrySchema`, `LiveVolumeSchema`, and `OpenInterestSchema` SHALL be exported from the schema modules (not defined inline in `data.ts`)
3. WHEN a Zod schema is needed by multiple files, THE schema SHALL be defined in the schema modules under `apps/server/src/lib/polymarket/schemas/` and imported by consumers
4. THE codebase SHALL NOT contain two Zod schemas that validate the same domain entity with different field sets

### Requirement 10: Fix OpenAPI Spec Generation

**User Story:** As a developer, I want the OpenAPI spec to accurately describe both inputs and outputs for all tRPC procedures, so that API consumers have correct documentation.

#### Acceptance Criteria

1. WHEN generating the OpenAPI spec, THE OpenAPI generator SHALL include output schemas for all tRPC procedures that define them
2. THE OpenAPI generator SHALL use a Zod-to-JSON-Schema conversion method compatible with the project's Zod version
3. IF the project uses Zod 3, THEN THE OpenAPI generator SHALL NOT use Zod 4-only APIs (such as `toJSONSchema` from `zod`)

### Requirement 11: Handle Negative Risk Market Types

**User Story:** As a developer, I want negative risk and augmented negative risk markets properly typed, so that the frontend can correctly filter tradeable vs placeholder outcomes.

#### Acceptance Criteria

1. THE `Event` interface in the Shared_Types_Package SHALL include `negRisk: boolean`, `enableNegRisk: boolean`, and `negRiskAugmented: boolean` fields
2. THE `Market` interface SHALL include fields to identify outcome status (named, placeholder, or "other")
3. WHEN the Gamma_API returns an event with `enableNegRisk: true` AND `negRiskAugmented: true`, THE Zod_Schema SHALL validate all three negative risk fields
4. THE Shared_Types_Package SHALL export a type guard or utility function to identify augmented negative risk events
5. THE frontend SHALL be able to filter out placeholder and "other" outcomes based on type information

### Requirement 12: Support Builder Authentication Flow

**User Story:** As a builder, I want type-safe builder authentication helpers, so that I can correctly sign requests to the Relayer and CLOB APIs.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define a `BuilderCredentials` interface with `key`, `secret`, and `passphrase` fields
2. THE Shared_Types_Package SHALL define a `BuilderAuthHeaders` interface with `POLY_BUILDER_API_KEY`, `POLY_BUILDER_SIGNATURE`, `POLY_BUILDER_TIMESTAMP`, and `POLY_BUILDER_PASSPHRASE` fields
3. WHEN a server function generates builder auth headers, THE function SHALL return a type matching `BuilderAuthHeaders`
4. THE Shared_Types_Package SHALL define types for remote signing server requests and responses
5. THE builder authentication types SHALL be compatible with both CLOB and Relayer client configurations

### Requirement 13: Validate Order Structure and Fee Handling

**User Story:** As a developer, I want order types to include all required fields including fee rates, so that orders work on fee-enabled markets.

#### Acceptance Criteria

1. THE `Order` interface in the Shared_Types_Package SHALL include `feeRateBps` as a required field
2. THE `Order` interface SHALL include all fields from the CLOB API order structure: `salt`, `maker`, `signer`, `taker`, `tokenId`, `makerAmount`, `takerAmount`, `expiration`, `nonce`, `feeRateBps`, `side`, `signatureType`, `signature`
3. WHEN a tRPC procedure creates an order, THE input schema SHALL validate that `feeRateBps` is a non-negative integer
4. THE Shared_Types_Package SHALL define enums for `OrderType` (GTC, GTD, FOK, FAK) and `Side` (BUY, SELL)
5. THE Shared_Types_Package SHALL define a `SignatureType` enum with values for EOA (0), Magic Link proxy (1), and Gnosis Safe proxy (2)

### Requirement 14: Type Relayer Transactions and Wallet Operations

**User Story:** As a developer, I want relayer transaction types to match the API contract, so that wallet deployment and CTF operations are type-safe.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define a `RelayerTransaction` interface matching the relayer API response structure
2. THE Shared_Types_Package SHALL define a `Transaction` interface for relayer execute calls with `to`, `data`, and `value` fields
3. THE Shared_Types_Package SHALL define a `RelayerTxType` enum with `SAFE` and `PROXY` values
4. THE Shared_Types_Package SHALL define a `RelayerTransactionState` enum with all transaction states (STATE_NEW, STATE_EXECUTED, STATE_MINED, STATE_CONFIRMED, STATE_FAILED, STATE_INVALID)
5. WHEN a tRPC procedure calls the relayer, THE procedure SHALL use these types for inputs and outputs

### Requirement 15: Validate Contract Addresses and Chain IDs

**User Story:** As a developer, I want contract addresses and chain IDs validated at the type level, so that incorrect values are caught early.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define branded types for `ContractAddress` and `ChainId`
2. THE Shared_Types_Package SHALL export constants for Polygon mainnet contract addresses (USDCe, CTF, CTF Exchange, Neg Risk Exchange, Neg Risk Adapter)
3. WHEN a tRPC procedure accepts a contract address, THE input schema SHALL validate the Ethereum address format and produce a `ContractAddress` branded type
4. THE Shared_Types_Package SHALL define a `ChainId` enum or union type with supported chains (Polygon = 137)
5. WHEN a function requires a specific contract address, THE function signature SHALL use the branded `ContractAddress` type

### Requirement 16: Handle WebSocket Message Types

**User Story:** As a developer, I want WebSocket message types for market and user channels, so that real-time data is properly typed.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define types for WebSocket subscription messages (market channel, user channel)
2. THE Shared_Types_Package SHALL define types for WebSocket data messages (`book`, `price_change`, `last_trade_price`, order fills, cancellations)
3. WHEN a WebSocket message is received, THE message SHALL be validated against the appropriate Zod schema
4. THE Shared_Types_Package SHALL define authentication types for authenticated WebSocket connections
5. THE WebSocket message types SHALL include sequence numbers for message ordering

### Requirement 17: Normalize API Response Field Names

**User Story:** As a developer, I want all API responses normalized to camelCase, so that the frontend never sees snake_case fields.

#### Acceptance Criteria

1. WHEN the Gamma_API returns `condition_id`, THE Zod_Schema SHALL transform it to `conditionId`
2. WHEN the Gamma_API returns `end_date_iso`, THE Zod_Schema SHALL transform it to `endDateIso`
3. WHEN the Data_API returns snake_case fields, THE Zod_Schema SHALL transform them to camelCase
4. THE Shared_Types_Package interfaces SHALL use camelCase exclusively for all field names
5. THE Zod schemas SHALL use `.transform()` to normalize field names during validation

### Requirement 18: Document Rate Limits in Types

**User Story:** As a developer, I want rate limit information available at the type level, so that I can implement proper throttling.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL export a `RateLimits` constant object with limits for each API endpoint
2. THE `RateLimits` object SHALL include limits for CLOB, Gamma, Data, and Relayer APIs
3. THE `RateLimits` object SHALL distinguish between burst and sustained rate limits where applicable
4. WHEN a client makes API calls, THE client SHALL have access to rate limit metadata via types
5. THE Shared_Types_Package SHALL define a `RateLimitInfo` interface with `limit`, `window`, and `burst` fields

### Requirement 19: Validate CLOB Client Implementation

**User Story:** As a developer, I want our custom CLOB client to match the official API contract, so that all methods work correctly with the Polymarket CLOB.

#### Acceptance Criteria

1. THE custom CLOB_Client in `packages/clob/` SHALL implement all public methods from the official `@polymarket/clob-client` package
2. THE custom CLOB_Client SHALL implement all L1 methods (createApiKey, deriveApiKey, createOrDeriveApiKey, createOrder, createMarketOrder)
3. THE custom CLOB_Client SHALL implement all L2 methods (createAndPostOrder, createAndPostMarketOrder, postOrder, postOrders, cancelOrder, cancelOrders, cancelAll, cancelMarketOrders, getOrder, getOpenOrders, getTrades, getBalanceAllowance, updateBalanceAllowance, getNotifications, dropNotifications)
4. THE custom CLOB_Client method signatures SHALL match the official client's TypeScript types exactly
5. THE custom CLOB_Client response types SHALL match the documented API response structures

### Requirement 20: Type CLOB Market and Order Structures

**User Story:** As a developer, I want complete type definitions for CLOB markets and orders, so that all fields are properly validated.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define a `Market` interface matching the CLOB API response with all fields: `accepting_order_timestamp`, `accepting_orders`, `active`, `archived`, `closed`, `condition_id`, `description`, `enable_order_book`, `end_date_iso`, `fpmm`, `game_start_time`, `icon`, `image`, `is_50_50_outcome`, `maker_base_fee`, `market_slug`, `minimum_order_size`, `minimum_tick_size`, `neg_risk`, `neg_risk_market_id`, `neg_risk_request_id`, `notifications_enabled`, `question`, `question_id`, `rewards`, `seconds_delay`, `tags`, `taker_base_fee`, `tokens`
2. THE Shared_Types_Package SHALL define a `MarketToken` interface with `outcome`, `price`, `token_id`, and `winner` fields
3. THE Shared_Types_Package SHALL define an `OrderBookSummary` interface with `market`, `asset_id`, `timestamp`, `bids`, `asks`, `min_order_size`, `tick_size`, `neg_risk`, and `hash` fields
4. THE Shared_Types_Package SHALL define an `OpenOrder` interface with all fields from the CLOB API
5. THE Shared_Types_Package SHALL define a `Trade` interface with all fields including `maker_orders` array

### Requirement 21: Type CLOB Authentication Structures

**User Story:** As a developer, I want L1 and L2 authentication types properly defined, so that authentication flows are type-safe.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define an `ApiKeyCreds` interface with `apiKey`, `secret`, and `passphrase` fields
2. THE Shared_Types_Package SHALL define L1 authentication header types: `POLY_ADDRESS`, `POLY_SIGNATURE`, `POLY_TIMESTAMP`, `POLY_NONCE`
3. THE Shared_Types_Package SHALL define L2 authentication header types: `POLY_ADDRESS`, `POLY_SIGNATURE`, `POLY_TIMESTAMP`, `POLY_API_KEY`, `POLY_PASSPHRASE`
4. THE Shared_Types_Package SHALL define an `EIP712Domain` type for L1 signature generation
5. THE Shared_Types_Package SHALL define an `EIP712ClobAuth` type matching the documented structure

### Requirement 22: Type Order Creation Parameters

**User Story:** As a developer, I want order creation parameters properly typed, so that invalid orders are caught at compile time.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define a `UserOrder` interface with `tokenID`, `price`, `size`, `side`, `feeRateBps?`, `nonce?`, `expiration?`, `taker?` fields
2. THE Shared_Types_Package SHALL define a `UserMarketOrder` interface with `tokenID`, `amount`, `side`, `price?`, `feeRateBps?`, `nonce?`, `taker?`, `orderType?` fields
3. THE Shared_Types_Package SHALL define a `CreateOrderOptions` interface with `tickSize` and `negRisk?` fields
4. THE Shared_Types_Package SHALL define a `SignedOrder` interface matching the CLOB API order structure
5. THE Shared_Types_Package SHALL define an `OrderResponse` interface with `success`, `errorMsg`, `orderID`, `transactionsHashes`, `status`, `takingAmount`, `makingAmount` fields

### Requirement 23: Handle Geographic Restrictions

**User Story:** As a developer, I want geoblock checking types, so that I can properly handle restricted regions.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define a `GeoblockResponse` interface with `blocked`, `ip`, `country`, and `region` fields
2. THE Shared_Types_Package SHALL export a constant array of blocked country codes
3. THE Shared_Types_Package SHALL export a constant array of blocked regions with country, region name, and region code
4. WHEN a tRPC procedure checks geoblocking, THE procedure SHALL use the `GeoblockResponse` type
5. THE Shared_Types_Package SHALL define a utility function type for checking if a country/region is blocked

### Requirement 24: Type Builder-Specific Structures

**User Story:** As a builder, I want builder-specific types for trades and authentication, so that builder methods are properly typed.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define a `BuilderTrade` interface matching the CLOB API response
2. THE Shared_Types_Package SHALL define a `BuilderTradesPaginatedResponse` interface with `trades`, `next_cursor`, `limit`, and `count` fields
3. THE custom CLOB_Client SHALL implement `getBuilderTrades()` and `revokeBuilderApiKey()` methods when builder config is provided
4. THE Shared_Types_Package SHALL define types for builder config (local vs remote signing)
5. THE builder authentication types SHALL be compatible with both CLOB and Relayer clients

### Requirement 25: Type Notification Structures

**User Story:** As a developer, I want notification types properly defined, so that event notifications are type-safe.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define a `Notification` interface with `id`, `owner`, `payload`, `timestamp?`, and `type` fields
2. THE Shared_Types_Package SHALL define a `NotificationType` enum with ORDER_CANCELLATION (1), ORDER_FILL (2), and MARKET_RESOLVED (4)
3. THE Shared_Types_Package SHALL define a `DropNotificationParams` interface with `ids` field
4. WHEN a notification is received, THE notification type SHALL be validated against the enum
5. THE notification payload SHALL be typed based on the notification type

### Requirement 26: Validate Fee Calculation Types

**User Story:** As a developer, I want fee calculation properly typed, so that fee logic is correct for both buying and selling.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define a `FeeCalculation` interface with formulas for buying and selling
2. THE Shared_Types_Package SHALL define a `FeeSchedule` interface with `makerFeeBaseBps` and `takerFeeBaseBps` fields
3. WHEN calculating fees, THE calculation SHALL use the documented formulas: `feeQuote = baseRate × min(price, 1-price) × size` for selling, `feeBase = baseRate × min(price, 1-price) × size/price` for buying
4. THE Shared_Types_Package SHALL export utility functions for fee calculation
5. THE fee calculation types SHALL handle both zero-fee and fee-enabled markets

### Requirement 27: Validate CLOB Types Against OpenAPI Specifications

**User Story:** As a developer, I want all CLOB types to match the official OpenAPI specifications exactly, so that API responses are correctly typed.

#### Acceptance Criteria

1. THE `OrderBookSummary` interface SHALL have exactly these required fields: `market`, `asset_id`, `timestamp`, `hash`, `bids`, `asks`, `min_order_size`, `tick_size`, `neg_risk`
2. THE `OrderLevel` interface SHALL have `price: string` and `size: string` fields (strings for precision)
3. THE `PriceResponse` interface SHALL have a single `price: string` field
4. THE `PricesResponse` type SHALL be `{ [tokenId: string]: { BUY?: string; SELL?: string } }`
5. THE `MidpointResponse` interface SHALL have a single `mid: string` field
6. THE `PriceHistoryResponse` interface SHALL have `history: Array<{ t: number; p: number }>` field
7. THE `BookParams` interface SHALL have `token_id: string` and optional `side?: "BUY" | "SELL"` fields
8. THE `PriceHistoryFilterParams` interface SHALL use `market` (not `token_id`) as the token identifier field
9. THE `ErrorResponse` interface SHALL have a single `error: string` field for all CLOB API errors
10. WHEN the CLOB API returns an error, THE error response SHALL be typed as `ErrorResponse` with appropriate error messages

### Requirement 28: Type Order Management Structures

**User Story:** As a developer, I want order creation, placement, and cancellation properly typed, so that order management is type-safe.

#### Acceptance Criteria

1. THE `OrderResponse` interface SHALL have `success: boolean`, `errorMsg: string`, `orderID: string`, `transactionsHashes: string[]`, `status: "matched" | "live" | "delayed" | "unmatched"`, `takingAmount: string`, `makingAmount: string` fields
2. THE `OpenOrder` interface SHALL have all fields: `id`, `status`, `owner`, `maker_address`, `market`, `asset_id`, `side`, `original_size`, `size_matched`, `price`, `associate_trades`, `outcome`, `created_at`, `expiration`, `order_type`
3. THE `CancelOrdersResponse` interface SHALL have `canceled: string[]` and `not_canceled: Record<string, string>` fields
4. THE `OrderScoring` interface SHALL have `scoring: boolean` field
5. THE `OrdersScoring` type SHALL be `Record<string, boolean>` mapping order IDs to scoring status
6. THE Shared_Types_Package SHALL define an `OrderErrorCode` union type with all possible error codes from order placement
7. THE `PostOrdersArgs` interface SHALL have `order: SignedOrder`, `orderType: OrderType`, `owner: string`, and optional `postOnly?: boolean` fields
8. WHEN an order is placed with `postOnly: true`, THE order SHALL only be GTC or GTD type
9. THE order placement error messages SHALL be typed with specific error codes and descriptions
10. THE order status field SHALL be typed as a union: `"matched" | "live" | "delayed" | "unmatched"`

### Requirement 29: Validate Order Allowances and Balance Checks

**User Story:** As a developer, I want order allowance requirements properly typed, so that balance validation is clear.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define an `AllowanceRequirement` interface specifying required allowances for buying and selling
2. WHEN placing a BUY order, THE system SHALL validate USDC allowance is greater than or equal to spending amount
3. WHEN placing a SELL order, THE system SHALL validate conditional token allowance is greater than or equal to selling amount
4. THE Shared_Types_Package SHALL define a `MaxOrderSize` calculation type: `underlyingAssetBalance - sum(orderSize - orderFillAmount)`
5. THE order validation types SHALL include balance and allowance checks before order placement

### Requirement 30: Type Onchain Order Events

**User Story:** As a developer, I want onchain OrderFilled events properly typed, so that blockchain event parsing is type-safe.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define an `OrderFilledEvent` interface with `orderHash`, `maker`, `taker`, `makerAssetId`, `takerAssetId`, `makerAmountFilled`, `takerAmountFilled`, `fee` fields
2. WHEN `makerAssetId` is "0", THE order SHALL be interpreted as a BUY (giving USDC for outcome tokens)
3. WHEN `takerAssetId` is "0", THE order SHALL be interpreted as a SELL (receiving USDC for outcome tokens)
4. THE Shared_Types_Package SHALL define utility functions to interpret OrderFilled events
5. THE onchain event types SHALL be compatible with ethers/viem event parsing

### Requirement 31: Type Trade History Structures

**User Story:** As a developer, I want trade history properly typed with status tracking, so that trade execution can be monitored.

#### Acceptance Criteria

1. THE `Trade` interface SHALL have all fields: `id`, `taker_order_id`, `market`, `asset_id`, `side`, `size`, `fee_rate_bps`, `price`, `status`, `match_time`, `last_update`, `outcome`, `maker_address`, `owner`, `transaction_hash`, `bucket_index`, `maker_orders`, `trader_side`
2. THE `MakerOrder` interface SHALL have all fields: `order_id`, `maker_address`, `owner`, `matched_amount`, `fee_rate_bps`, `price`, `asset_id`, `outcome`, `side`
3. THE `TradeStatus` type SHALL be a union: `"MATCHED" | "MINED" | "CONFIRMED" | "RETRYING" | "FAILED"`
4. THE `TradeStatus` SHALL distinguish between terminal states (CONFIRMED, FAILED) and non-terminal states (MATCHED, MINED, RETRYING)
5. THE `TradeParams` interface SHALL have optional filters: `id`, `taker`, `maker`, `market`, `before`, `after`, `asset_id`
6. WHEN a trade is executed in multiple transactions, THE trades SHALL share the same `taker_order_id`, `match_time`, and have incrementing `bucket_index` values
7. THE `trader_side` field SHALL be typed as `"TAKER" | "MAKER"` to indicate the user's role in the trade
8. THE trade history types SHALL support filtering by maker address, taker address, market, and time range
9. THE `maker_orders` array SHALL contain all maker orders that were filled against the taker order
10. THE trade status transitions SHALL follow the documented state machine: MATCHED → MINED → CONFIRMED (success) or MATCHED → RETRYING → FAILED (failure)

### Requirement 32: Type WebSocket Message Structures

**User Story:** As a developer, I want WebSocket messages properly typed for both market and user channels, so that real-time updates are type-safe.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define a `WebSocketSubscription` interface with `auth?`, `markets?`, `assets_ids?`, `type`, `custom_feature_enabled?` fields
2. THE Shared_Types_Package SHALL define a `WebSocketAuth` interface with `apiKey`, `secret`, `passphrase` fields
3. THE Shared_Types_Package SHALL define a `WebSocketOperation` interface with `assets_ids?`, `markets?`, `operation: "subscribe" | "unsubscribe"`, `custom_feature_enabled?` fields
4. THE `WebSocketChannelType` SHALL be a union: `"market" | "user"`
5. THE Shared_Types_Package SHALL define WebSocket message types for the market channel: `BookMessage`, `PriceChangeMessage`, `TickSizeChangeMessage`, `LastTradePriceMessage`, `BestBidAskMessage`, `NewMarketMessage`, `MarketResolvedMessage`
6. THE Shared_Types_Package SHALL define WebSocket message types for the user channel: `TradeMessage`, `OrderMessage`
7. THE `BookMessage` SHALL have `event_type: "book"`, `asset_id`, `market`, `timestamp`, `hash`, `bids`, `asks` fields
8. THE `PriceChangeMessage` SHALL have `event_type: "price_change"`, `market`, `price_changes`, `timestamp` fields with `PriceChange` array
9. THE `TradeMessage` SHALL have `event_type: "trade"`, `type: "TRADE"`, and all trade-related fields
10. THE `OrderMessage` SHALL have `event_type: "order"`, `type: "PLACEMENT" | "UPDATE" | "CANCELLATION"`, and all order-related fields

### Requirement 33: Type Sports WebSocket Structures

**User Story:** As a developer, I want sports WebSocket messages properly typed, so that real-time sports data is type-safe.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define a `SportsResultMessage` interface with `gameId`, `leagueAbbreviation`, `homeTeam`, `awayTeam`, `status`, `live`, `ended`, `score`, `period`, `elapsed?`, `finishedTimestamp?`, `turn?` fields
2. THE `leagueAbbreviation` field SHALL support common values: `"nfl"`, `"nba"`, `"mlb"`, `"nhl"`, `"cs2"`, etc.
3. THE `status` field SHALL include values like `"InProgress"`, `"finished"`, `"scheduled"`
4. THE `turn` field SHALL only be present for NFL and CFB games to indicate possession
5. THE sports WebSocket connection SHALL handle PING/PONG heartbeat messages (PING every 5s, PONG timeout 10s)
6. THE Shared_Types_Package SHALL define period value types for different sports (quarters, halves, innings, maps)
7. THE sports WebSocket endpoint SHALL be `wss://sports-api.polymarket.com/ws`
8. THE sports WebSocket SHALL not require authentication (public broadcast)
9. THE `gameId` field SHALL be used as the unique identifier for updating game state
10. THE sports WebSocket types SHALL support automatic reconnection with exponential backoff

### Requirement 34: Type RTDS WebSocket Structures

**User Story:** As a developer, I want RTDS (Real-Time Data Socket) messages properly typed for crypto prices and comments, so that real-time data streams are type-safe.

#### Acceptance Criteria

1. THE Shared_Types_Package SHALL define an `RTDSMessage` base interface with `topic`, `type`, `timestamp`, `payload` fields
2. THE Shared_Types_Package SHALL define an `RTDSSubscription` interface with `topic`, `type`, `filters?`, `gamma_auth?` fields
3. THE Shared_Types_Package SHALL define an `RTDSSubscriptionMessage` interface with `action: "subscribe" | "unsubscribe"`, `subscriptions` array
4. THE `RTDSGammaAuth` interface SHALL have `address` field for wallet address authentication
5. THE RTDS WebSocket endpoint SHALL be `wss://ws-live-data.polymarket.com`
6. THE RTDS connection SHALL support PING messages every 5 seconds to maintain connection
7. THE RTDS connection SHALL support dynamic subscriptions without disconnecting
8. THE Shared_Types_Package SHALL define crypto price message types for both Binance and Chainlink sources
9. THE Shared_Types_Package SHALL define comment message types for comment events
10. THE RTDS message types SHALL use discriminated unions based on `topic` and `type` fields

### Requirement 35: Type RTDS Crypto Price Structures

**User Story:** As a developer, I want RTDS crypto price messages properly typed for both Binance and Chainlink sources, so that price data is type-safe.

#### Acceptance Criteria

1. THE `RTDSCryptoPriceBinanceMessage` interface SHALL have `topic: "crypto_prices"`, `type: "update"`, `timestamp`, and `payload` with `symbol`, `timestamp`, `value` fields
2. THE `RTDSCryptoPriceChainlinkMessage` interface SHALL have `topic: "crypto_prices_chainlink"`, `type: "update"`, `timestamp`, and `payload` with `symbol`, `timestamp`, `value` fields
3. THE Binance crypto price symbols SHALL use lowercase concatenated format (e.g., `"solusdt"`, `"btcusdt"`, `"ethusdt"`)
4. THE Chainlink crypto price symbols SHALL use slash-separated format (e.g., `"eth/usd"`, `"btc/usd"`, `"sol/usd"`)
5. THE crypto price subscription filters SHALL support comma-separated symbol lists for Binance
6. THE crypto price subscription filters SHALL support JSON object format for Chainlink: `{"symbol":"eth/usd"}`
7. THE crypto price `value` field SHALL be typed as `number` representing the current price
8. THE crypto price `timestamp` field in payload SHALL represent when the price was recorded (Unix milliseconds)
9. THE outer `timestamp` field SHALL represent when the WebSocket message was sent
10. THE Shared_Types_Package SHALL define union types for supported crypto symbols for both sources

### Requirement 36: Type RTDS Comment Structures

**User Story:** As a developer, I want RTDS comment messages properly typed, so that comment events are type-safe.

#### Acceptance Criteria

1. THE `RTDSCommentMessage` interface SHALL have `topic: "comments"`, `type`, `timestamp`, and `payload` fields
2. THE comment message `type` SHALL be a union: `"comment_created" | "comment_removed" | "reaction_created" | "reaction_removed"`
3. THE `RTDSCommentPayload` interface SHALL have all fields: `body`, `createdAt`, `id`, `parentCommentID`, `parentEntityID`, `parentEntityType`, `profile`, `reactionCount`, `replyAddress`, `reportCount`, `userAddress`
4. THE `RTDSCommentProfile` interface SHALL have `baseAddress`, `displayUsernamePublic`, `name`, `proxyWallet`, `pseudonym` fields
5. THE `parentEntityType` field SHALL support values: `"Event"`, `"Market"`, and potentially others
6. THE `parentCommentID` field SHALL be nullable for top-level comments (not replies)
7. THE `createdAt` field SHALL be an ISO 8601 timestamp string with timezone
8. THE comment subscription MAY require `gamma_auth` with user wallet address for user-specific data
9. THE comment payload SHALL include `reactionCount` and `reportCount` as numbers
10. THE Shared_Types_Package SHALL support comment hierarchy with top-level and reply comments

---

## Gamma API Requirements

### Requirement 37: Type Gamma API Market and Series Endpoints

**User Story:** As a developer, I want Gamma API market and series endpoints properly typed, so that data retrieval is type-safe.

#### Acceptance Criteria

1. THE Gamma API base URL SHALL be `https://gamma-api.polymarket.com`
2. THE `GET /markets` endpoint SHALL support pagination with `limit`, `offset`, `order`, `ascending` parameters
3. THE `GET /markets` endpoint SHALL support filtering by: `id[]`, `slug[]`, `clob_token_ids[]`, `condition_ids[]`, `market_maker_address[]`
4. THE `GET /markets` endpoint SHALL support numeric range filters: `liquidity_num_min`, `liquidity_num_max`, `volume_num_min`, `volume_num_max`
5. THE `GET /markets` endpoint SHALL support date range filters: `start_date_min`, `start_date_max`, `end_date_min`, `end_date_max`
6. THE `GET /markets` endpoint SHALL support tag filtering: `tag_id`, `related_tags`, `include_tag`
7. THE `GET /markets` endpoint SHALL support sports filters: `game_id`, `sports_market_types[]`
8. THE `GET /markets` endpoint SHALL support status filters: `closed`, `cyom`, `uma_resolution_status`
9. THE `GET /markets` endpoint SHALL return an array of `Market` objects
10. THE `GET /markets/{id}` endpoint SHALL return a single `Market` object with optional `include_tag` parameter
11. THE `GET /markets/slug/{slug}` endpoint SHALL return a single `Market` object by slug with optional `include_tag` parameter
12. THE `GET /markets/{id}/tags` endpoint SHALL return an array of `Tag` objects associated with the market
13. THE `GET /series` endpoint SHALL support pagination with `limit`, `offset`, `order`, `ascending` parameters
14. THE `GET /series` endpoint SHALL support filtering by: `slug[]`, `categories_ids[]`, `categories_labels[]`, `closed`, `recurrence`, `include_chat`
15. THE `GET /series` endpoint SHALL return an array of `Series` objects
16. THE `GET /series/{id}` endpoint SHALL return a single `Series` object with optional `include_chat` parameter
17. THE Market and Series endpoints SHALL return 404 status for not found resources
18. THE Market list endpoint SHALL support `question_ids[]` and `rewards_min_size` filters

### Requirement 38: Type Gamma API Market Schema

**User Story:** As a developer, I want the Gamma API Market schema properly typed with all 150+ fields, so that market data is fully type-safe.

#### Acceptance Criteria

1. THE `Market` interface SHALL have core identification fields: `id` (string), `question` (nullable string), `conditionId` (string), `slug` (nullable string)
2. THE `Market` interface SHALL have outcome fields: `outcomes` (nullable string - JSON array), `outcomePrices` (nullable string - JSON array), `shortOutcomes` (nullable string)
3. THE `Market` interface SHALL have CLOB fields: `clobTokenIds` (nullable string - JSON array), `enableOrderBook` (nullable boolean), `orderPriceMinTickSize` (nullable number), `orderMinSize` (nullable number)
4. THE `Market` interface SHALL have volume fields: `volume` (nullable string), `volumeNum` (nullable number), `volume24hr`, `volume1wk`, `volume1mo`, `volume1yr` (all nullable numbers)
5. THE `Market` interface SHALL have AMM/CLOB breakdown fields: `volumeAmm`, `volumeClob`, `liquidityAmm`, `liquidityClob`, `volume24hrAmm`, `volume1wkAmm`, `volume1moAmm`, `volume1yrAmm`, `volume24hrClob`, `volume1wkClob`, `volume1moClob`, `volume1yrClob` (all nullable numbers)
6. THE `Market` interface SHALL have liquidity fields: `liquidity` (nullable string), `liquidityNum` (nullable number)
7. THE `Market` interface SHALL have fee fields: `fee` (nullable string), `makerBaseFee` (nullable integer), `takerBaseFee` (nullable integer)
8. THE `Market` interface SHALL have date fields: `startDate`, `endDate`, `createdAt`, `updatedAt`, `closedTime` (all nullable date-time strings), `startDateIso`, `endDateIso` (nullable strings)
9. THE `Market` interface SHALL have UMA fields: `questionID`, `umaEndDate`, `umaEndDateIso`, `umaResolutionStatus`, `umaResolutionStatuses`, `umaBond`, `umaReward`, `customLiveness` (all nullable)
10. THE `Market` interface SHALL have status fields: `active`, `closed`, `archived`, `featured`, `restricted`, `new`, `ready`, `funded`, `acceptingOrders`, `notificationsEnabled`, `commentsEnabled` (all nullable booleans)
11. THE `Market` interface SHALL have timestamp fields: `readyTimestamp`, `fundedTimestamp`, `acceptingOrdersTimestamp`, `deployingTimestamp`, `scheduledDeploymentTimestamp`, `eventStartTime` (all nullable date-time strings)
12. THE `Market` interface SHALL have price change fields: `oneDayPriceChange`, `oneHourPriceChange`, `oneWeekPriceChange`, `oneMonthPriceChange`, `oneYearPriceChange` (all nullable numbers)
13. THE `Market` interface SHALL have orderbook fields: `spread`, `bestBid`, `bestAsk`, `lastTradePrice` (all nullable numbers)
14. THE `Market` interface SHALL have sports fields: `gameId`, `gameStartTime`, `sportsMarketType`, `line`, `teamAID`, `teamBID`, `secondsDelay` (all nullable)
15. THE `Market` interface SHALL have image fields: `image`, `icon`, `twitterCardImage` (nullable strings), `imageOptimized`, `iconOptimized` (ImageOptimization objects)
16. THE `Market` interface SHALL have relationship arrays: `events[]` (Event[]), `categories[]` (Category[]), `tags[]` (Tag[])
17. THE `Market` interface SHALL have metadata fields: `description`, `resolutionSource`, `category`, `marketType`, `formatType`, `ammType` (all nullable strings)
18. THE `Market` interface SHALL have grouping fields: `marketGroup` (nullable integer), `groupItemTitle`, `groupItemThreshold`, `groupItemRange` (nullable strings)
19. THE `Market` interface SHALL have display fields: `wideFormat`, `showGmpSeries`, `showGmpOutcome`, `clearBookOnStart`, `manualActivation`, `automaticallyResolved`, `automaticallyActive` (all nullable booleans)
20. THE `Market` interface SHALL have color fields: `chartColor`, `seriesColor` (nullable strings)
21. THE `Market` interface SHALL have negative risk fields: `negRiskOther` (nullable boolean)
22. THE `Market` interface SHALL have rewards fields: `rewardsMinSize`, `rewardsMaxSpread`, `competitive` (all nullable numbers)
23. THE `Market` interface SHALL have deployment fields: `pendingDeployment`, `deploying` (nullable booleans), `rfqEnabled` (nullable boolean)
24. THE `Market` interface SHALL have legacy/misc fields: `marketMakerAddress` (string), `denominationToken`, `sponsorName`, `sponsorImage`, `xAxisValue`, `yAxisValue`, `lowerBound`, `upperBound`, `lowerBoundDate`, `upperBoundDate`, `mailchimpTag`, `resolvedBy`, `creator`, `pastSlugs`, `disqusThread`, `fpmmLive`, `curationOrder`, `score`, `hasReviewedDates`, `readyForCron` (all nullable)
25. THE `Market` interface SHALL have audit fields: `createdBy`, `updatedBy` (nullable integers)

### Requirement 39: Type Gamma API Nested Schemas

**User Story:** As a developer, I want all Gamma API nested schemas properly typed, so that related entities are type-safe.

#### Acceptance Criteria

1. THE `ImageOptimization` interface SHALL have fields: `id` (string), `imageUrlSource`, `imageUrlOptimized`, `imageSizeKbSource`, `imageSizeKbOptimized`, `imageOptimizedLastUpdated`, `field`, `relname` (all nullable), `imageOptimizedComplete` (nullable boolean), `relID` (nullable integer)
2. THE `Event` interface SHALL have core fields: `id`, `ticker`, `slug`, `title`, `subtitle`, `description`, `resolutionSource` (all nullable except id)
3. THE `Event` interface SHALL have date fields: `startDate`, `creationDate`, `endDate`, `closedTime`, `startTime`, `finishedTimestamp` (all nullable date-time strings), `eventDate` (nullable string)
4. THE `Event` interface SHALL have status fields: `active`, `closed`, `archived`, `new`, `featured`, `restricted`, `commentsEnabled`, `cyom`, `showAllOutcomes`, `showMarketImages`, `automaticallyResolved`, `enableNegRisk`, `automaticallyActive`, `live`, `ended`, `estimateValue`, `cantEstimate`, `pendingDeployment`, `deploying` (all nullable booleans)
5. THE `Event` interface SHALL have metrics fields: `liquidity`, `volume`, `openInterest`, `competitive`, `volume24hr`, `volume1wk`, `volume1mo`, `volume1yr`, `liquidityAmm`, `liquidityClob` (all nullable numbers)
6. THE `Event` interface SHALL have negative risk fields: `negRisk` (nullable boolean), `negRiskMarketID` (nullable string), `negRiskFeeBips` (nullable integer)
7. THE `Event` interface SHALL have sports fields: `score`, `elapsed`, `period`, `gameStatus` (nullable strings), `eventWeek` (nullable integer), `spreadsMainLine`, `totalsMainLine` (nullable numbers)
8. THE `Event` interface SHALL have relationship arrays: `markets[]`, `series[]`, `categories[]`, `collections[]`, `tags[]`, `eventCreators[]`, `chats[]`, `templates[]`, `subEvents[]` (nullable string array)
9. THE `Event` interface SHALL have image fields: `image`, `icon`, `featuredImage` (nullable strings), `imageOptimized`, `iconOptimized`, `featuredImageOptimized` (ImageOptimization objects)
10. THE `Event` interface SHALL have metadata fields: `category`, `subcategory`, `sortBy`, `parentEvent`, `seriesSlug`, `gmpChartMode`, `estimatedValue`, `carouselMap` (all nullable strings)
11. THE `Event` interface SHALL have template fields: `isTemplate` (nullable boolean), `templateVariables` (nullable string)
12. THE `Event` interface SHALL have count fields: `commentCount`, `tweetCount`, `featuredOrder` (all nullable integers)
13. THE `Category` interface SHALL have fields: `id`, `label`, `parentCategory`, `slug`, `publishedAt`, `createdBy`, `updatedBy` (all nullable except id), `createdAt`, `updatedAt` (nullable date-time strings)
14. THE `Tag` interface SHALL have fields: `id`, `label`, `slug` (nullable), `forceShow`, `forceHide`, `isCarousel` (nullable booleans), `publishedAt` (nullable string), `createdBy`, `updatedBy` (nullable integers), `createdAt`, `updatedAt` (nullable date-time strings)
15. THE `Series` interface SHALL have fields: `id`, `ticker`, `slug`, `title`, `subtitle`, `seriesType`, `recurrence`, `description`, `image`, `icon`, `layout`, `pythTokenID`, `cgAssetName` (all nullable except id)
16. THE `Series` interface SHALL have status fields: `active`, `closed`, `archived`, `new`, `featured`, `restricted`, `isTemplate`, `commentsEnabled` (all nullable booleans), `templateVariables` (nullable boolean)
17. THE `Series` interface SHALL have metrics fields: `volume24hr`, `volume`, `liquidity`, `competitive` (nullable, competitive is string), `score`, `commentCount` (nullable integers)
18. THE `Series` interface SHALL have relationship arrays: `events[]`, `collections[]`, `categories[]`, `tags[]`, `chats[]`
19. THE `Collection` interface SHALL have fields: `id`, `ticker`, `slug`, `title`, `subtitle`, `collectionType`, `description`, `tags`, `image`, `icon`, `headerImage`, `layout` (all nullable except id)
20. THE `Collection` interface SHALL have status fields: `active`, `closed`, `archived`, `new`, `featured`, `restricted`, `isTemplate`, `commentsEnabled` (all nullable booleans), `templateVariables` (nullable string)
21. THE `Collection` interface SHALL have image optimization fields: `imageOptimized`, `iconOptimized`, `headerImageOptimized` (ImageOptimization objects)
22. THE `EventCreator` interface SHALL have fields: `id`, `creatorName`, `creatorHandle`, `creatorUrl`, `creatorImage` (all nullable except id), `createdAt`, `updatedAt` (nullable date-time strings)
23. THE `Chat` interface SHALL have fields: `id`, `channelId`, `channelName`, `channelImage` (all nullable except id), `live` (nullable boolean), `startTime`, `endTime` (nullable date-time strings)
24. THE `Template` interface SHALL have fields: `id`, `eventTitle`, `eventSlug`, `eventImage`, `marketTitle`, `description`, `resolutionSource`, `sortBy`, `seriesSlug`, `outcomes` (all nullable except id), `negRisk`, `showMarketImages` (nullable booleans)
25. ALL date-time fields SHALL use ISO 8601 format strings with timezone information

### Requirement 40: Type Gamma API Comments and Profile Endpoints

**User Story:** As a developer, I want Gamma API comments and profile endpoints properly typed, so that user-generated content is type-safe.

#### Acceptance Criteria

1. THE `GET /comments` endpoint SHALL support pagination with `limit`, `offset`, `order`, `ascending` parameters
2. THE `GET /comments` endpoint SHALL support filtering by `parent_entity_type` (enum: "Event", "Series", "market"), `parent_entity_id`, `get_positions`, `holders_only`
3. THE `GET /comments` endpoint SHALL return an array of `Comment` objects
4. THE `GET /comments/{id}` endpoint SHALL return an array of `Comment` objects (comment and its replies) with optional `get_positions` parameter
5. THE `GET /comments/user_address/{user_address}` endpoint SHALL return an array of `Comment` objects with pagination support
6. THE `GET /public-profile` endpoint SHALL require `address` query parameter (Ethereum address pattern: `^0x[a-fA-F0-9]{40}$`)
7. THE `GET /public-profile` endpoint SHALL return `PublicProfileResponse` object or error responses (400 for invalid address, 404 for not found)
8. THE `Comment` interface SHALL have fields: `id` (string), `body`, `parentEntityType`, `parentCommentID`, `userAddress`, `replyAddress` (all nullable strings)
9. THE `Comment` interface SHALL have `parentEntityID` (nullable integer), `reportCount`, `reactionCount` (nullable integers)
10. THE `Comment` interface SHALL have `createdAt`, `updatedAt` (nullable date-time strings)
11. THE `Comment` interface SHALL have `profile` (CommentProfile object), `reactions[]` (Reaction array)
12. THE `CommentProfile` interface SHALL have fields: `name`, `pseudonym`, `bio`, `proxyWallet`, `baseAddress`, `profileImage` (all nullable strings)
13. THE `CommentProfile` interface SHALL have `displayUsernamePublic`, `isMod`, `isCreator` (all nullable booleans)
14. THE `CommentProfile` interface SHALL have `profileImageOptimized` (ImageOptimization object), `positions[]` (CommentPosition array)
15. THE `Reaction` interface SHALL have fields: `id` (string), `commentID` (nullable integer), `reactionType`, `icon`, `userAddress` (nullable strings)
16. THE `Reaction` interface SHALL have `createdAt` (nullable date-time string), `profile` (CommentProfile object)
17. THE `CommentPosition` interface SHALL have fields: `tokenId`, `positionSize` (both nullable strings)
18. THE `PublicProfileResponse` interface SHALL have fields: `createdAt` (nullable date-time), `proxyWallet`, `profileImage`, `bio`, `pseudonym`, `name`, `xUsername` (all nullable strings)
19. THE `PublicProfileResponse` interface SHALL have `displayUsernamePublic`, `verifiedBadge` (nullable booleans), `users[]` (PublicProfileUser array)
20. THE `PublicProfileUser` interface SHALL have fields: `id` (string), `creator`, `mod` (booleans)
21. THE `PublicProfileError` interface SHALL have fields: `type`, `error` (both strings)
22. THE `parentCommentID` field SHALL be nullable for top-level comments (not replies)
23. THE `get_positions` parameter SHALL control whether position data is included in the response
24. THE `holders_only` parameter SHALL filter comments to only show users with positions in the market

### Requirement 41: Type Gamma API Search Endpoint

**User Story:** As a developer, I want the Gamma API search endpoint properly typed, so that multi-entity search is type-safe.

#### Acceptance Criteria

1. THE `GET /public-search` endpoint SHALL require `q` query parameter for search query string
2. THE `GET /public-search` endpoint SHALL support filtering by: `events_status`, `events_tag[]`, `recurrence`, `exclude_tag_id[]`, `keep_closed_markets`
3. THE `GET /public-search` endpoint SHALL support pagination with `limit_per_type`, `page` parameters
4. THE `GET /public-search` endpoint SHALL support sorting with `sort`, `ascending` parameters
5. THE `GET /public-search` endpoint SHALL support feature flags: `cache`, `search_tags`, `search_profiles`, `optimized`
6. THE `GET /public-search` endpoint SHALL return a `Search` object containing `events[]`, `tags[]`, `profiles[]`, and `pagination`
7. THE `Search` interface SHALL have `events` (nullable Event array), `tags` (nullable SearchTag array), `profiles` (nullable Profile array), `pagination` (Pagination object)
8. THE `SearchTag` interface SHALL have fields: `id`, `label`, `slug` (all strings), `event_count` (integer)
9. THE `Profile` interface SHALL have core fields: `id`, `name`, `pseudonym`, `bio`, `proxyWallet`, `profileImage` (nullable except id)
10. THE `Profile` interface SHALL have user fields: `user` (nullable integer), `referral`, `createdBy`, `updatedBy` (nullable)
11. THE `Profile` interface SHALL have UTM tracking fields: `utmSource`, `utmMedium`, `utmCampaign`, `utmContent`, `utmTerm` (all nullable strings)
12. THE `Profile` interface SHALL have status fields: `walletActivated`, `displayUsernamePublic`, `isCloseOnly`, `isCertReq` (all nullable booleans)
13. THE `Profile` interface SHALL have `certReqDate`, `createdAt`, `updatedAt` (nullable date-time strings)
14. THE `Profile` interface SHALL have `profileImageOptimized` (ImageOptimization object)
15. THE `Pagination` interface SHALL have fields: `hasMore` (boolean), `totalResults` (integer)
16. THE search results SHALL reuse existing `Event`, `Market`, `Series` schemas from other endpoints
17. THE `SearchTag` SHALL be distinct from regular `Tag` with additional `event_count` field
18. THE search endpoint SHALL support filtering events by multiple tags via `events_tag[]` array parameter

---

## Data API Requirements

### Requirement 42: Type Data API Endpoints and Schemas

**User Story:** As a developer, I want Data API endpoints properly typed, so that user positions, trades, and analytics are type-safe.

#### Acceptance Criteria

1. THE Data API base URL SHALL be `https://data-api.polymarket.com`
2. THE `GET /` endpoint SHALL return a `HealthResponse` object with `data: "OK"` field
3. THE `GET /positions` endpoint SHALL require `user` parameter (Ethereum address pattern: `^0x[a-fA-F0-9]{40}$`)
4. THE `GET /positions` endpoint SHALL support filtering by: `market[]` (condition IDs), `eventId[]`, `title`, `sizeThreshold`, `redeemable`, `mergeable`
5. THE `GET /positions` endpoint SHALL support pagination with `limit` (0-500, default 100), `offset` (0-10000, default 0)
6. THE `GET /positions` endpoint SHALL support sorting with `sortBy` (enum: CURRENT, INITIAL, TOKENS, CASHPNL, PERCENTPNL, TITLE, RESOLVING, PRICE, AVGPRICE), `sortDirection` (ASC/DESC)
7. THE `GET /closed-positions` endpoint SHALL require `user` parameter and support filtering by `market[]`, `eventId[]`, `title`
8. THE `GET /closed-positions` endpoint SHALL support pagination with `limit` (0-50, default 10), `offset` (0-100000, default 0)
9. THE `GET /closed-positions` endpoint SHALL support sorting with `sortBy` (enum: REALIZEDPNL, TITLE, PRICE, AVGPRICE, TIMESTAMP), `sortDirection` (ASC/DESC)
10. THE `GET /trades` endpoint SHALL support filtering by: `user`, `market[]`, `eventId[]`, `side` (BUY/SELL), `takerOnly`, `filterType` (CASH/TOKENS), `filterAmount`
11. THE `GET /trades` endpoint SHALL support pagination with `limit` (0-10000, default 100), `offset` (0-10000, default 0)
12. THE `GET /activity` endpoint SHALL require `user` parameter and support filtering by: `market[]`, `eventId[]`, `type[]`, `side`, `start`, `end`
13. THE `GET /activity` endpoint SHALL support activity types: TRADE, SPLIT, MERGE, REDEEM, REWARD, CONVERSION, MAKER_REBATE
14. THE `GET /activity` endpoint SHALL support sorting with `sortBy` (TIMESTAMP, TOKENS, CASH), `sortDirection` (ASC/DESC)
15. THE `GET /holders` endpoint SHALL require `market[]` parameter and support `limit` (0-20, default 20), `minBalance` (0-999999, default 1)
16. THE `GET /value` endpoint SHALL require `user` parameter and optional `market[]` filter
17. THE `GET /traded` endpoint SHALL require `user` parameter and return `Traded` object with `user`, `traded` (integer) fields
18. THE `GET /oi` endpoint SHALL accept optional `market[]` parameter (array of condition IDs) and return array of `OpenInterest` objects
19. THE `GET /live-volume` endpoint SHALL require `id` parameter (event ID, minimum 1) and return array of `LiveVolume` objects
20. THE `GET /v1/accounting/snapshot` endpoint SHALL require `user` parameter and return `application/zip` binary containing `positions.csv` and `equity.csv`
21. THE `GET /v1/leaderboard` endpoint SHALL support filtering by: `category` (10 categories), `timePeriod` (DAY/WEEK/MONTH/ALL), `orderBy` (PNL/VOL), `user`, `userName`
22. THE `GET /v1/leaderboard` endpoint SHALL support pagination with `limit` (1-50, default 25), `offset` (0-1000, default 0)
23. THE `GET /v1/builders/leaderboard` endpoint SHALL support `timePeriod` (DAY/WEEK/MONTH/ALL, default DAY) and pagination with `limit` (0-50, default 25), `offset` (0-1000, default 0)
24. THE `GET /v1/builders/volume` endpoint SHALL support `timePeriod` (DAY/WEEK/MONTH/ALL, default DAY) and return daily time-series data without pagination
25. THE `Position` interface SHALL have wallet fields: `proxyWallet` (Address), `asset` (string), `conditionId` (Hash64)
26. THE `Position` interface SHALL have size/price fields: `size`, `avgPrice`, `curPrice`, `totalBought` (all numbers)
27. THE `Position` interface SHALL have value fields: `initialValue`, `currentValue`, `cashPnl`, `percentPnl`, `realizedPnl`, `percentRealizedPnl` (all numbers)
28. THE `Position` interface SHALL have status fields: `redeemable`, `mergeable`, `negativeRisk` (all booleans)
29. THE `Position` interface SHALL have metadata fields: `title`, `slug`, `icon`, `eventSlug`, `outcome`, `oppositeOutcome`, `oppositeAsset`, `endDate` (all strings), `outcomeIndex` (integer)
30. THE `ClosedPosition` interface SHALL have fields: `proxyWallet`, `asset`, `conditionId`, `avgPrice`, `totalBought`, `realizedPnl`, `curPrice`, `timestamp`, `title`, `slug`, `icon`, `eventSlug`, `outcome`, `outcomeIndex`, `oppositeOutcome`, `oppositeAsset`, `endDate`
31. THE `Trade` interface SHALL have fields: `proxyWallet`, `side` (BUY/SELL), `asset`, `conditionId`, `size`, `price`, `timestamp`, `transactionHash`
32. THE `Trade` interface SHALL have metadata fields: `title`, `slug`, `icon`, `eventSlug`, `outcome`, `outcomeIndex`
33. THE `Trade` interface SHALL have profile fields: `name`, `pseudonym`, `bio`, `profileImage`, `profileImageOptimized`
34. THE `Activity` interface SHALL have fields: `proxyWallet`, `timestamp`, `conditionId`, `type`, `size`, `usdcSize`, `transactionHash`, `price`, `asset`, `side`, `outcomeIndex`
35. THE `Activity` interface SHALL have metadata fields: `title`, `slug`, `icon`, `eventSlug`, `outcome`, `name`, `pseudonym`, `bio`, `profileImage`, `profileImageOptimized`
36. THE `Holder` interface SHALL have fields: `proxyWallet`, `bio`, `asset`, `pseudonym`, `amount`, `displayUsernamePublic`, `outcomeIndex`, `name`, `profileImage`, `profileImageOptimized`
37. THE `MetaHolder` interface SHALL have fields: `token` (string), `holders[]` (Holder array)
38. THE `Value` interface SHALL have fields: `user` (Address), `value` (number)
39. THE `TraderLeaderboardEntry` interface SHALL have fields: `rank`, `proxyWallet`, `userName`, `vol`, `pnl`, `profileImage`, `xUsername`, `verifiedBadge`
40. THE `LeaderboardEntry` interface (builders) SHALL have fields: `rank`, `builder`, `volume`, `activeUsers`, `verified`, `builderLogo`
41. THE `BuilderVolumeEntry` interface SHALL have fields: `dt` (ISO 8601 date-time), `builder`, `builderLogo`, `verified`, `volume`, `activeUsers`, `rank`
42. THE `OpenInterest` interface SHALL have fields: `market` (Hash64), `value` (number)
43. THE `LiveVolume` interface SHALL have fields: `total` (number), `markets[]` (MarketVolume array)
44. THE `MarketVolume` interface SHALL have fields: `market` (Hash64), `value` (number)
45. THE `Traded` interface SHALL have fields: `user` (Address), `traded` (integer)
46. THE `Address` type SHALL be a string with pattern `^0x[a-fA-F0-9]{40}$` (Ethereum address)
47. THE `Hash64` type SHALL be a string with pattern `^0x[a-fA-F0-9]{64}$` (condition ID)
48. THE `ErrorResponse` interface SHALL have `error` (string) field for all error responses (400, 401, 500)
49. THE accounting snapshot CSV SHALL have `positions.csv` with columns: conditionId, asset, size, curPrice, valuationTime (RFC3339)
50. THE accounting snapshot CSV SHALL have `equity.csv` with columns: cashBalance, positionsValue, equity, valuationTime (RFC3339)
51. THE `market` and `eventId` parameters SHALL be mutually exclusive in positions, trades, activity, and closed-positions endpoints
52. THE `filterType` and `filterAmount` parameters SHALL be provided together in trades endpoint
53. THE leaderboard categories SHALL include: OVERALL, POLITICS, SPORTS, CRYPTO, CULTURE, MENTIONS, WEATHER, ECONOMICS, TECH, FINANCE
54. THE builder endpoints SHALL support time periods: DAY, WEEK, MONTH, ALL
55. ALL numeric values in positions SHALL use 6 decimal precision for USDC amounts
