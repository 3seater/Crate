# Implementation Plan: Wallet Tracking

## Overview

Migrate the wallet tracker from browser localStorage to a server-persisted PostgreSQL system exposed via tRPC. Implementation proceeds bottom-up: database schema → query module → tRPC router → frontend migration, with property tests validating each layer.

## Tasks

- [x] 1. Create database schema and query module
  - [x] 1.1 Create the `tracked_wallets` Drizzle table schema
    - Create `packages/db/src/schema/tracked-wallets.ts` with the `trackedWallets` pgTable definition
    - Include columns: `id` (uuid PK), `userId` (uuid FK → users.id, cascade delete), `address` (text), `label` (text), `createdAt`, `updatedAt` (timestamps)
    - Add composite unique constraint on `(userId, address)` and index on `userId`
    - Export the table from the schema barrel file (`packages/db/src/schema/index.ts`)
    - Run `pnpm db:push` to apply schema changes
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Implement the tracked-wallets query module
    - Create `packages/db/src/queries/tracked-wallets.ts` following the `queries/users.ts` pattern
    - Implement `addTrackedWallet(db, userId, address, label?)`: validate 50-wallet limit in a transaction, normalize address to lowercase, assign default label (`address.slice(0,6) + "..." + address.slice(-4)`) if omitted, throw `TRPCError` with `CONFLICT` on duplicate and `FORBIDDEN` on limit exceeded
    - Implement `listTrackedWallets(db, userId)`: return all wallets ordered by `createdAt DESC`
    - Implement `updateTrackedWallet(db, userId, walletId, label)`: update label and `updatedAt`, return null if not found/not owned
    - Implement `removeTrackedWallet(db, userId, walletId)`: delete if owned, return boolean
    - Implement `countTrackedWallets(db, userId)`: return count
    - Export all functions from `packages/db/src/index.ts`
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2_

  - [x] 1.3 Write property tests for tracked-wallets queries (Properties 1–9)
    - Create `tests/unit/wallet-tracking/tracked-wallets-queries.test.ts` using fast-check and Vitest
    - **Property 1: Add returns a complete record** — For any valid address and optional label, verify returned record has non-null UUID, correct userId, lowercase address, non-empty label, and timestamps
    - **Validates: Requirements 1.1, 2.1, 3.2**
    - **Property 2: Invalid address rejection** — For any string not matching `0x[a-fA-F0-9]{40}`, verify rejection with validation error and no record created
    - **Validates: Requirements 2.2**
    - **Property 3: Duplicate address prevention** — For any user and valid address, inserting twice should fail with conflict error, count unchanged
    - **Validates: Requirements 1.2, 2.3**
    - **Property 4: Default label from truncated address** — For any valid address with no label, verify label equals first 6 + last 4 chars of address
    - **Validates: Requirements 2.4**
    - **Property 5: Wallet limit enforcement** — For any user with 50 wallets, 51st add should be rejected
    - **Validates: Requirements 2.5, 2.6**
    - **Property 6: List sort order** — For any N wallets, verify list returns N records sorted by createdAt DESC
    - **Validates: Requirements 3.1**
    - **Property 7: Update label and timestamp** — For any valid label (1–100 chars), verify update changes label and updatedAt; reject empty or >100 char labels
    - **Validates: Requirements 4.1, 4.3**
    - **Property 8: Remove then absent** — For any wallet, after removal it should not appear in list and count decreases by one
    - **Validates: Requirements 5.1**
    - **Property 9: Ownership isolation** — For any wallet belonging to another user, update and remove should fail with not-found, no records modified
    - **Validates: Requirements 4.2, 5.2**

- [x] 2. Checkpoint - Ensure database layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement tRPC wallets router
  - [x] 3.1 Create the wallets tRPC router with CRUD procedures
    - Create `apps/server/src/routers/wallets.ts`
    - Define Zod schemas: `ETH_ADDRESS_RE`, `addWalletInput`, `updateWalletInput`, `removeWalletInput`
    - Implement `wallets.add` mutation using `protectedProcedure`, calling `addTrackedWallet`
    - Implement `wallets.list` query using `protectedProcedure`, calling `listTrackedWallets`
    - Implement `wallets.update` mutation using `protectedProcedure`, calling `updateTrackedWallet` (throw `NOT_FOUND` if null returned)
    - Implement `wallets.remove` mutation using `protectedProcedure`, calling `removeTrackedWallet` (throw `NOT_FOUND` if false returned)
    - Wrap each procedure in try/catch: re-throw `TRPCError`, log and throw `INTERNAL_SERVER_ERROR` for unexpected errors
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 3.2 Implement activity feed and portfolio values procedures
    - Add `wallets.activity` query: fetch trades for all tracked wallets via `Promise.allSettled`, merge and sort by timestamp DESC, enrich with wallet labels and Gamma market metadata using existing `tradesWithMarkets` pattern, apply limit/offset pagination, return `{ trades, total, hasMore, failures }`
    - Add `wallets.values` query: fetch portfolio value for each tracked wallet via `Promise.allSettled`, return array of `{ walletId, address, label, value: number | null }`, continue on per-wallet failures
    - Define Zod schema for `activityInput` with `limit` (1–500, default 100) and `offset` (≥0, default 0)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 7.1, 7.2, 7.3_

  - [x] 3.3 Register wallets router in the app router
    - Import `walletsRouter` in `apps/server/src/routers/index.ts`
    - Add `wallets: walletsRouter` to the `appRouter` object
    - _Requirements: 8.1_

  - [x] 3.4 Write property tests for activity feed and portfolio values (Properties 10–13)
    - Create `tests/unit/wallet-tracking/activity-feed.test.ts`
    - **Property 10: Activity feed merge sort** — For any set of trade lists from multiple wallets, merged feed is sorted by timestamp DESC
    - **Validates: Requirements 6.2**
    - **Property 11: Wallet label enrichment** — For any trade in the feed, walletLabel matches the tracked wallet's label
    - **Validates: Requirements 6.3**
    - **Property 12: Pagination respects bounds** — For any valid limit/offset, result has at most `limit` trades; offset beyond total returns empty
    - **Validates: Requirements 6.4**
    - Create `tests/unit/wallet-tracking/portfolio-values.test.ts`
    - **Property 13: Portfolio value mapping completeness** — For any N wallets, response contains exactly N entries with value as number or null
    - **Validates: Requirements 7.2**

- [x] 4. Checkpoint - Ensure router and all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Migrate frontend from localStorage to tRPC
  - [x] 5.1 Replace localStorage CRUD with tRPC queries and mutations
    - In `apps/web/src/components/wallet-tracker/wallet-tracker-content.tsx`:
    - Replace `parseStoredWallets()` with `useQuery(trpc.wallets.list.queryOptions())`
    - Replace `persistWallets()` calls with `useMutation` on `trpc.wallets.add`, `trpc.wallets.update`, `trpc.wallets.remove`
    - Remove the `parseStoredWallets` and `persistWallets` helper functions
    - Remove the `TrackedWallet` localStorage interface (server types replace it)
    - Add cache invalidation: after any mutation, invalidate `wallets.list`, `wallets.activity`, and `wallets.values` query keys
    - Add loading states (skeleton loaders) and error states (toast notifications) during server communication
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 5.2 Replace per-wallet data queries with aggregated endpoints
    - Replace individual `useQueries` on `trpc.data.tradesWithMarkets` per wallet with `useQuery(trpc.wallets.activity.queryOptions({ limit, offset }))`
    - Replace individual `useQueries` on `trpc.data.value` per wallet with `useQuery(trpc.wallets.values.queryOptions())`
    - Handle partial failures: display available data and show warning for failed wallets using the `failures` array
    - _Requirements: 6.1, 6.5, 7.1, 7.3, 9.1_

  - [x] 5.3 Write unit tests for frontend wallet tracker
    - Test that add/update/remove mutations trigger correct cache invalidation
    - Test loading and error state rendering
    - Test partial failure warning display
    - _Requirements: 9.3, 9.4_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The implementation language is TypeScript throughout, matching the existing codebase
- fast-check is used for property-based testing with Vitest
