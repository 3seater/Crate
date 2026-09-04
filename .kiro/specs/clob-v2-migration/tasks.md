# Implementation Plan: CLOB V2 Migration

## Overview

Migrate Doji's Polymarket integration from CLOB V1 (`@polymarket/clob-client`) to V2 (`@polymarket/clob-client-v2`). Tasks proceed bottom-up: shared types → env config → client wrapper → factory → trading router → sign endpoint simplification → feature flag. Each task builds on the previous, with property-based tests validating correctness properties from the design document.

## Tasks

- [x] 1. Update V2 type definitions in `packages/types/src/`
  - [x] 1.1 Define `SignedOrderV2` interface in `packages/types/src/order.ts`
    - Add `SignedOrderV2` with retained fields (`expiration`, `maker`, `makerAmount`, `salt`, `side`, `signature`, `signatureType`, `signer`, `takerAmount`, `tokenId`) plus new V2 fields (`timestamp`, optional `metadata`, optional `builder`)
    - Do NOT include `nonce`, `feeRateBps`, or `taker`
    - Keep existing `SignedOrder` (V1) interface until feature flag removal
    - _Requirements: 1.1, 1.2, 8.1_

  - [x] 1.2 Define `UserOrderV2`, `ClobMarketInfo`, and `BuilderConfigV2` interfaces in `packages/types/src/clob.ts`
    - Add `UserOrderV2` with `tokenID`, `price`, `size`, `side`, optional `expiration`, optional `builderCode` — no `nonce`, `feeRateBps`, or `taker`
    - Add `ClobMarketInfo` with `mts`, `mos`, `fd` (`r`, `e`, `to`), `t` (array of `{ token_id, outcome }`), `rfqe`
    - Add `BuilderConfigV2` with single `builderCode: string` field
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 1.3 Write property test: V2 order field exclusion
    - **Property 1: V2 order field exclusion**
    - Use fast-check to generate arbitrary `SignedOrderV2` objects and assert `nonce`, `feeRateBps`, `taker` keys are never present
    - **Validates: Requirements 1.2, 3.2, 4.3**

  - [x] 1.4 Write property test: Builder code format validation
    - **Property 5: Builder code format validation**
    - Use fast-check to generate arbitrary strings and verify only strings matching `^0x[a-fA-F0-9]{64}$` pass the `BuilderConfigV2` validation function; all others are rejected
    - **Validates: Requirements 3.5, 5.5, 6.1**

- [x] 2. Add V2 environment configuration in `packages/env/src/server.ts`
  - [x] 2.1 Add `POLY_BUILDER_CODE` and `CLOB_V2_ENABLED` to env schema
    - Add `POLY_BUILDER_CODE: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional()` to the server env schema
    - Add `CLOB_V2_ENABLED: z.coerce.boolean().default(false)` for feature flag
    - Retain existing `POLYMARKET_BUILDER_ID`, `POLYMARKET_BUILDER_SIGNING_KEY`, `POLYMARKET_BUILDER_PASSPHRASE` for Relayer
    - Update `apps/server/.env.example` with new variables
    - _Requirements: 6.1, 6.2, 6.3, 10.1, 10.2_

- [x] 3. Checkpoint — Ensure types and env compile
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Migrate CLOB client wrapper to V2 SDK in `packages/api/src/lib/clob/`
  - [x] 4.1 Update `packages/api/src/lib/clob/client.ts` — V2 SDK imports and constructor
    - Replace `import { ClobClient as BaseClobClient, createL2Headers } from "@polymarket/clob-client"` with `from "@polymarket/clob-client-v2"`
    - Update `ClobClientConfig` interface: rename `chainId` → `chain`, replace `builderConfig?: BuilderConfigType` with `builderConfig?: BuilderConfigV2`, remove `geoBlockToken`
    - Update `createClobClient()` to construct `DojiClobClient` with a single options object (`{ host, chain, signer, creds, signatureType, funderAddress, useServerTime, builderConfig, retryOnError, throwOnError: true }`) instead of positional arguments
    - Remove the `builderConfig as import("@polymarket/builder-signing-sdk").BuilderConfig` cast
    - _Requirements: 1.3, 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 4.2 Add `getClobMarketInfo` method to `DojiClobClient`
    - Expose `getClobMarketInfo(conditionId: string): Promise<ClobMarketInfo>` on the extended client
    - Throw descriptive error for invalid condition IDs
    - _Requirements: 4.1, 4.2, 4.6_

  - [x] 4.3 Update `normalizeCreds` and `deriveOrCreateApiKey` for V2 SDK compatibility
    - Ensure `normalizeCreds` handles both `apiKey` and `key` field names
    - Update `deriveOrCreateApiKey` to use V2 SDK method signatures (verify `deriveApiKey`/`createApiKey` still accept nonce param)
    - _Requirements: 7.2, 7.3, 7.4_

  - [x] 4.4 Update `packages/api/src/lib/clob/index.ts` exports
    - Export new V2 types (`ClobMarketInfo`, `BuilderConfigV2`, `SignedOrderV2`)
    - Update re-exports to reference `@polymarket/clob-client-v2` instead of `@polymarket/clob-client`
    - _Requirements: 1.3_

  - [x] 4.5 Write property test: Constructor options shape
    - **Property 4: Constructor options shape**
    - Use fast-check to generate arbitrary valid `ClobClientConfig` inputs and verify the V2 SDK is always called with a single options object containing `chain` (never `chainId`)
    - **Validates: Requirements 2.1, 2.2**

  - [x] 4.6 Write property test: Credential normalization
    - **Property 8: Credential normalization**
    - Use fast-check to generate arbitrary credential objects with either `apiKey` or `key` field names and verify `normalizeCreds` always produces an object with non-empty `key`, `secret`, `passphrase`
    - **Validates: Requirements 7.4**

- [x] 5. Migrate CLOB factory to V2 in `packages/api/src/lib/clob-factory.ts`
  - [x] 5.1 Update `createUserClobClient` for V2 builder config
    - Remove `BuilderConfig` import from `@polymarket/builder-signing-sdk`
    - Replace `new BuilderConfig({ remoteBuilderConfig: { url, token } })` with `{ builderCode: env.POLY_BUILDER_CODE }`
    - Validate `POLY_BUILDER_CODE` is set and matches bytes32 hex pattern; throw descriptive error if missing/invalid
    - Update `createClobClient` call to use `chain` instead of `chainId`
    - _Requirements: 5.1, 5.3, 5.5_

  - [x] 5.2 Update `createUserClobClientForQueries` — omit builder config
    - Ensure no `builderConfig` is passed to the client for query-only operations
    - Update `createClobClient` call to use `chain` instead of `chainId`
    - _Requirements: 5.2_

  - [x] 5.3 Update `deriveUserCredentials` for V2 SDK
    - Update `createClobClient` call to use `chain` instead of `chainId`
    - Ensure V2 SDK `deriveApiKey`/`createApiKey` methods are used
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 5.4 Write property test: Builder attribution consistency
    - **Property 3: Builder attribution consistency**
    - Use fast-check to generate arbitrary user records and verify that `createUserClobClient` always produces a client with `builderConfig.builderCode === env.POLY_BUILDER_CODE`
    - **Validates: Requirements 3.3, 5.1**

  - [x] 5.5 Write property test: Query client omits builder config
    - **Property 6: Query client omits builder config**
    - Use fast-check to generate arbitrary user records and verify that `createUserClobClientForQueries` never includes `builderConfig` in the client configuration
    - **Validates: Requirements 5.2**

  - [x] 5.6 Write property test: Credential encryption round-trip
    - **Property 7: Credential encryption round-trip**
    - Use fast-check to generate arbitrary `ApiKeyCreds` objects (non-empty `key`, `secret`, `passphrase`) and verify that encrypting with AES then decrypting produces an equivalent object
    - **Validates: Requirements 7.1**

- [x] 6. Checkpoint — Ensure client wrapper and factory compile and pass tests
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Update trading router for V2 in `apps/server/src/features/trading/router.ts`
  - [x] 7.1 Add `getClobMarketInfo` tRPC procedure with caching
    - Add a new `getClobMarketInfo` public procedure accepting `conditionId` input
    - Implement LRU cache with 60-second TTL for `ClobMarketInfo` results
    - Return fee details (`fd`), tick size (`mts`), min order size (`mos`), RFQ status (`rfqe`)
    - _Requirements: 4.1, 4.2, 4.5, 9.2_

  - [x] 7.2 Remove `feeRateBps` from order creation procedures
    - Remove `feeRateBps` from all order creation input schemas (Zod validators)
    - Add `userUSDCBalance` parameter to market buy order procedures for fee-adjusted fill
    - Update order posting to use V2 `SignedOrderV2` type
    - _Requirements: 3.2, 4.3, 4.4_

  - [x] 7.3 Update error handling for V2 responses
    - Verify `mapApiErrorToTRPC` handles V2 error response format (geo-blocking, invalid signature, validation errors)
    - Add V2-specific error codes to the error mapping if needed
    - _Requirements: 9.1, 9.3, 9.4_

  - [x] 7.4 Write property test: Timestamp freshness
    - **Property 2: Timestamp freshness**
    - Use fast-check to generate arbitrary order creation inputs and verify the `timestamp` field on created orders is always within 5 minutes of `Date.now()` and is a valid millisecond epoch string
    - **Validates: Requirements 3.1, 3.4**

  - [x] 7.5 Write unit tests for `getClobMarketInfo` caching
    - Test cache hit within TTL returns cached result
    - Test cache miss after TTL triggers fresh fetch
    - Test invalid condition ID throws descriptive error
    - _Requirements: 4.5, 4.6, 9.2_

- [x] 8. Simplify sign endpoint in `apps/server/src/features/bridge/routes/sign.ts`
  - [x] 8.1 Remove HMAC signing for order attribution
    - Remove `import { buildHmacSignature } from "@polymarket/builder-signing-sdk"`
    - Remove the `buildHmacSignature` call and `POLY_BUILDER_SIGNATURE`/`POLY_BUILDER_TIMESTAMP` from the response
    - Retain Builder API key headers (`POLY_BUILDER_API_KEY`, `POLY_BUILDER_PASSPHRASE`) for Relayer gasless transactions
    - Keep Bearer token auth with timing-safe comparison
    - _Requirements: 11.1, 11.2, 11.3, 5.3, 5.4_

  - [x] 8.2 Write unit tests for simplified sign endpoint
    - Test Relayer request returns Builder API key headers
    - Test Bearer auth is still enforced
    - Test missing credentials returns 500
    - _Requirements: 11.2, 11.3_

- [x] 9. Update package dependencies across workspaces
  - [x] 9.1 Swap SDK packages in `package.json` files
    - In `packages/api/package.json`: replace `@polymarket/clob-client` with `@polymarket/clob-client-v2`
    - In `apps/server/package.json`: remove `@polymarket/builder-signing-sdk`
    - In `apps/web/package.json`: remove `@polymarket/builder-signing-sdk` and `@polymarket/builder-relayer-client`
    - Run `pnpm install` to update lockfile
    - _Requirements: 1.3, 1.4, 1.5_

  - [x] 9.2 Remove all remaining V1 SDK imports across codebase
    - Search for and remove any remaining `@polymarket/clob-client` imports (not `-v2`)
    - Search for and remove any remaining `@polymarket/builder-signing-sdk` imports
    - Search for and remove any remaining `@polymarket/builder-relayer-client` imports
    - _Requirements: 1.4, 1.5_

- [x] 10. Implement feature flag gating
  - [x] 10.1 Add `CLOB_V2_ENABLED` conditional logic to trading router
    - Gate V2 code paths behind `env.CLOB_V2_ENABLED` check
    - When `false`, use V1 code paths; when `true`, use V2 code paths
    - Ensure toggling does not require a deployment (env var change + restart)
    - _Requirements: 10.1, 10.2, 10.3_

- [x] 11. Final checkpoint — Full build and test verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 8 correctness properties from the design document using Vitest + fast-check
- Unit tests validate specific examples and edge cases
- The codebase uses TypeScript throughout — all code examples use TypeScript
- Test files go in `tests/unit/` following existing naming conventions (e.g. `clob-v2-*.property.test.ts`)
