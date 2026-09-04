# Requirements Document

## Introduction

This document defines the requirements for migrating Doji's Polymarket integration from CLOB V1 (`@polymarket/clob-client`) to CLOB V2 (`@polymarket/clob-client-v2`). The migration encompasses SDK constructor changes, order schema updates, fee model separation, builder program simplification, collateral token transition, and EIP-712 domain version upgrade. Requirements are derived from the approved design document and cover all layers of the trading stack: shared types, CLOB client wrapper, server-side factory, trading router, builder sign endpoint, and environment configuration.

## Glossary

- **CLOB**: Central Limit Order Book — Polymarket's off-chain order matching system
- **CLOB_Client_Wrapper**: The Doji module (`packages/api/src/lib/clob/client.ts`) that wraps the Polymarket SDK and extends it with Doji-specific endpoints
- **CLOB_Factory**: The Doji module (`packages/api/src/lib/clob-factory.ts`) that creates per-user and read-only ClobClient instances with decrypted credentials
- **Trading_Router**: The tRPC router (`apps/server/src/features/trading/router.ts`) that exposes CLOB operations as server procedures
- **Sign_Endpoint**: The Hono route (`apps/server/src/features/bridge/routes/sign.ts`) that handles builder signing for Polymarket
- **Env_Schema**: The T3 Env validation schema (`packages/env/src/server.ts`) for server-side environment variables
- **Type_Package**: The shared types package (`packages/types/src/`) defining order and CLOB interfaces
- **SignedOrderV2**: The V2 order payload schema containing `timestamp`, optional `metadata`, optional `builder`, and excluding V1 fields `nonce`, `feeRateBps`, `taker`
- **SignedOrderV1**: The V1 order payload schema containing `nonce`, `feeRateBps`, `taker` fields
- **ClobMarketInfo**: The V2 response object from `getClobMarketInfo()` containing fee details, tick size, min order size, and RFQ status
- **BuilderCode**: A bytes32 hex string (66 characters with `0x` prefix) used for order attribution in V2
- **ApiKeyCreds**: The credential object with `key`, `secret`, and `passphrase` fields used for CLOB API authentication
- **EIP_712_Domain**: The typed data signing domain used for order signatures, versioned "1" (V1) or "2" (V2)
- **HMAC_Signing**: The V1 mechanism for builder order attribution via remote signing endpoint and `buildHmacSignature`

## Requirements

### Requirement 1: V2 SDK Package Migration

**User Story:** As a developer, I want the codebase to use `@polymarket/clob-client-v2` instead of `@polymarket/clob-client`, so that all CLOB operations use the V2 protocol.

#### Acceptance Criteria

1. THE Type_Package SHALL define a `SignedOrderV2` interface that includes `expiration`, `maker`, `makerAmount`, `salt`, `side`, `signature`, `signatureType`, `signer`, `takerAmount`, `tokenId`, `timestamp`, optional `metadata`, and optional `builder` fields
2. THE Type_Package SHALL NOT include `nonce`, `feeRateBps`, or `taker` fields in the `SignedOrderV2` interface
3. WHEN the CLOB_Client_Wrapper is imported, THE CLOB_Client_Wrapper SHALL import `ClobClient` from `@polymarket/clob-client-v2` instead of `@polymarket/clob-client`
4. THE codebase SHALL NOT contain any imports from `@polymarket/builder-signing-sdk`
5. THE codebase SHALL NOT contain any imports from `@polymarket/builder-relayer-client`

### Requirement 2: V2 Client Constructor

**User Story:** As a developer, I want the CLOB client to be constructed with an options object using the `chain` field, so that the client conforms to the V2 SDK interface.

#### Acceptance Criteria

1. WHEN `createClobClient` is called, THE CLOB_Client_Wrapper SHALL construct the ClobClient with a single options object parameter instead of positional arguments
2. WHEN `createClobClient` is called with a chain ID, THE CLOB_Client_Wrapper SHALL pass the chain ID as the `chain` field in the options object, not as `chainId`
3. WHEN `createClobClient` is called with a `signerAddress` but no `signer`, THE CLOB_Client_Wrapper SHALL create an address-only signer for server-side L2 operations
4. WHEN `createClobClient` is called without explicit `throwOnError`, THE CLOB_Client_Wrapper SHALL default `throwOnError` to `true`
5. WHEN `createClobClient` is called with a `builderConfig`, THE CLOB_Client_Wrapper SHALL accept a `builderConfig` object containing a `builderCode` string field

### Requirement 3: V2 Order Schema

**User Story:** As a developer, I want all orders to conform to the V2 schema, so that the Polymarket V2 API accepts them without validation errors.

#### Acceptance Criteria

1. WHEN an order is created, THE CLOB_Client_Wrapper SHALL include a `timestamp` field containing a valid millisecond epoch string
2. WHEN an order is created, THE CLOB_Client_Wrapper SHALL NOT include `nonce`, `feeRateBps`, or `taker` fields in the signed order payload
3. WHEN a `builderCode` is configured, THE CLOB_Client_Wrapper SHALL attach the `builder` field to each order with the configured BuilderCode value
4. THE `timestamp` field on a V2 order SHALL represent a time within 5 minutes of the current server time
5. IF the `builder` field is present on an order, THEN THE CLOB_Client_Wrapper SHALL validate that the value is a valid bytes32 hex string matching the pattern `^0x[a-fA-F0-9]{64}$`
6. THE `signature` field on a V2 order SHALL be a valid EIP-712 signature using Exchange domain version "2"

### Requirement 4: V2 Fee Model

**User Story:** As a developer, I want fees to be queried separately via `getClobMarketInfo()` instead of embedded in orders, so that the fee model aligns with V2 protocol where fees are protocol-set at match time.

#### Acceptance Criteria

1. THE CLOB_Client_Wrapper SHALL expose a `getClobMarketInfo(conditionId: string)` method that returns a ClobMarketInfo object
2. WHEN `getClobMarketInfo` is called with a valid condition ID, THE CLOB_Client_Wrapper SHALL return an object containing fee details (`fd`), minimum tick size (`mts`), minimum order size (`mos`), token information (`t`), and RFQ enabled status (`rfqe`)
3. THE Trading_Router SHALL NOT accept `feeRateBps` as an input parameter for any order creation procedure
4. WHEN a market buy order is created, THE Trading_Router SHALL pass `userUSDCBalance` to enable fee-adjusted fill amount calculation
5. THE Trading_Router SHALL cache `getClobMarketInfo` results with a 60-second TTL to avoid per-order API calls
6. IF `getClobMarketInfo` is called with an invalid condition ID, THEN THE CLOB_Client_Wrapper SHALL throw a descriptive error

### Requirement 5: V2 Builder Program

**User Story:** As a developer, I want builder attribution to use a static `builderCode` field on orders instead of HMAC signing via a remote endpoint, so that order posting no longer requires a network round-trip to the sign endpoint.

#### Acceptance Criteria

1. WHEN `createUserClobClient` is called, THE CLOB_Factory SHALL configure `builderConfig` as `{ builderCode: env.POLY_BUILDER_CODE }` instead of a `BuilderConfig` instance with `remoteBuilderConfig`
2. WHEN `createUserClobClientForQueries` is called, THE CLOB_Factory SHALL NOT include `builderConfig` in the client configuration
3. THE order posting flow SHALL NOT call the `/api/polymarket/sign` endpoint or use `buildHmacSignature` for order attribution
4. THE Sign_Endpoint SHALL retain Builder API key credentials (`POLYMARKET_BUILDER_ID`, `POLYMARKET_BUILDER_SIGNING_KEY`, `POLYMARKET_BUILDER_PASSPHRASE`) for Relayer gasless transaction operations only
5. IF `POLY_BUILDER_CODE` is missing or does not match the pattern `^0x[a-fA-F0-9]{64}$`, THEN THE CLOB_Factory SHALL throw a descriptive validation error at client construction time

### Requirement 6: V2 Environment Configuration

**User Story:** As a developer, I want the environment schema to include `POLY_BUILDER_CODE` validation, so that the builder code is validated at startup and available for order attribution.

#### Acceptance Criteria

1. THE Env_Schema SHALL define a `POLY_BUILDER_CODE` variable validated as an optional string matching the regex `^0x[a-fA-F0-9]{64}$`
2. THE Env_Schema SHALL retain `POLYMARKET_BUILDER_ID`, `POLYMARKET_BUILDER_SIGNING_KEY`, and `POLYMARKET_BUILDER_PASSPHRASE` for Relayer operations
3. WHEN `POLY_BUILDER_CODE` is set, THE Env_Schema SHALL make the value available as `env.POLY_BUILDER_CODE`

### Requirement 7: V2 Credential Compatibility

**User Story:** As a developer, I want existing encrypted user credentials to remain valid after migration, so that users do not need to re-derive their API keys.

#### Acceptance Criteria

1. THE CLOB_Factory SHALL decrypt and use existing AES-encrypted `ApiKeyCreds` (containing `key`, `secret`, `passphrase`) without modification after migration
2. WHEN deriving new credentials via `deriveUserCredentials`, THE CLOB_Factory SHALL use the V2 SDK's `deriveApiKey` method with `nonce=0`
3. IF credential derivation fails with a NONCE_ALREADY_USED error, THEN THE CLOB_Factory SHALL retry with `createApiKey` using `nonce=0`
4. THE CLOB_Client_Wrapper SHALL normalize credentials that use `apiKey` instead of `key` to ensure compatibility with both field names

### Requirement 8: V2 Type Definitions

**User Story:** As a developer, I want V2-specific TypeScript interfaces defined in the shared types package, so that type safety prevents accidental inclusion of V1 fields.

#### Acceptance Criteria

1. THE Type_Package SHALL define a `UserOrderV2` interface with `tokenID`, `price`, `size`, `side`, optional `expiration`, and optional `builderCode` fields
2. THE Type_Package SHALL NOT include `nonce`, `feeRateBps`, or `taker` fields in the `UserOrderV2` interface
3. THE Type_Package SHALL define a `ClobMarketInfo` interface with `mts`, `mos`, `fd` (containing `r`, `e`, `to`), `t` (array of token objects), and `rfqe` fields
4. THE Type_Package SHALL define a `BuilderConfigV2` interface with a single `builderCode` string field
5. THE Type_Package SHALL remove or deprecate the V1 `BuilderConfig` interface that references `localBuilderCreds` and `remoteBuilderConfig`

### Requirement 9: V2 Error Handling

**User Story:** As a developer, I want clear error handling for V2-specific failure modes, so that issues are diagnosed quickly during and after migration.

#### Acceptance Criteria

1. IF a V2 order is rejected by the Polymarket API due to validation errors, THEN THE Trading_Router SHALL map the error to a descriptive tRPC error using `mapApiErrorToTRPC`
2. IF the `getClobMarketInfo` cache returns stale data, THEN THE Trading_Router SHALL automatically refresh the cache after the 60-second TTL expires
3. WHEN geo-blocking or regional restriction errors are received from the V2 API, THE Trading_Router SHALL handle the errors using the existing `mapApiErrorToTRPC` error mapping
4. IF credential derivation fails against V2 endpoints, THEN THE CLOB_Factory SHALL return a descriptive error message including the V2 API error code

### Requirement 10: V2 Feature Flag

**User Story:** As a developer, I want a feature flag to gate V2 code paths, so that the migration can be tested against V2 staging endpoints before go-live without affecting production V1 traffic.

#### Acceptance Criteria

1. WHILE `CLOB_V2_ENABLED` is set to `false`, THE Trading_Router SHALL use V1 code paths for all CLOB operations
2. WHILE `CLOB_V2_ENABLED` is set to `true`, THE Trading_Router SHALL use V2 code paths for all CLOB operations
3. WHEN `CLOB_V2_ENABLED` is toggled from `true` to `false`, THE Trading_Router SHALL revert to V1 behavior without requiring a deployment

### Requirement 11: V2 Sign Endpoint Simplification

**User Story:** As a developer, I want the sign endpoint simplified to only handle Relayer gasless transactions, so that the HMAC signing logic for order attribution is removed.

#### Acceptance Criteria

1. THE Sign_Endpoint SHALL remove the `buildHmacSignature` import and usage from `@polymarket/builder-signing-sdk`
2. THE Sign_Endpoint SHALL retain Bearer token authentication with timing-safe comparison for Relayer operations
3. WHEN a Relayer signing request is received with valid Bearer auth, THE Sign_Endpoint SHALL return Builder API key headers (`POLY_BUILDER_API_KEY`, `POLY_BUILDER_PASSPHRASE`) for gasless transaction authorization
