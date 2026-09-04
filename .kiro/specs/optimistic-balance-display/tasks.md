# Implementation Plan: Optimistic Balance Display

## Overview

Extract the per-token merge logic (chain balance → API fallback → pending deltas → local position overlay) into a shared `useOptimisticTokenBalance` hook, then wire it into the three trading surfaces so balance updates are instant and consistent.

## Tasks

- [x] 1. Create the `useOptimisticTokenBalance` hook
  - [x] 1.1 Create `apps/web/src/hooks/use-optimistic-token-balance.ts` with the hook implementation
    - Subscribe to `usePositionsStore` filtered by `tokenId` + `conditionId`
    - Subscribe to `usePendingBalanceDeltasStore` for reactivity to pending delta changes
    - Compute `serverSize = chainBalance ?? apiPositionSize ?? 0`
    - Compute `effective = getEffectiveBalance(serverSize, safeAddress, tokenId)`
    - If `effective < CLOB_SIZE_DISPLAY_THRESHOLD` and a local position exists with `size > 0`, return `localPosition.size`
    - Otherwise return `effective < CLOB_SIZE_DISPLAY_THRESHOLD ? 0 : effective`
    - Return `0` when `safeAddress` is null or `tokenId` is empty
    - _Requirements: 1.2, 1.3, 2.2, 2.3, 3.1, 3.4, 6.1, 6.3_

  - [x] 1.2 Write property test: Local Position Overlay When Chain Is Stale
    - **Property 1: Local Position Overlay When Chain Is Stale**
    - Generate random tokenId, conditionId, safeAddress; set chainBalance/apiSize to undefined or below threshold; generate LocalPosition with size above threshold; assert hook returns local size
    - **Validates: Requirements 1.2, 1.3, 2.2, 2.3**

  - [x] 1.3 Write property test: Chain Supersedes Local Position
    - **Property 2: Chain Supersedes Local Position**
    - Generate random inputs with chainBalance above threshold; generate optional LocalPosition; assert hook returns getEffectiveBalance result
    - **Validates: Requirements 1.4, 2.4**

  - [x] 1.4 Write unit tests for edge cases
    - Test null/empty safeAddress returns 0
    - Test empty tokenId returns 0
    - Test dust suppression: values below `CLOB_SIZE_DISPLAY_THRESHOLD` return 0
    - Test sell-side local position with negative size
    - _Requirements: 1.2, 1.3, 2.2, 2.3_

- [x] 2. Checkpoint — Ensure hook tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Integrate hook into `TradingLayout`
  - [x] 3.1 Replace inline `positionSizeForToken` in `apps/web/src/components/trading/trading-layout.tsx` with `useOptimisticTokenBalance`
    - Import `useOptimisticTokenBalance` from `@/hooks/use-optimistic-token-balance`
    - For each token ID, call the hook passing `tokenId`, `conditionId`, `safeAddress`, `chainBalance` from `onChainBalances`, and `apiPositionSize` from `positions` query
    - Remove the inline `positionSizeForToken` closure and direct `usePendingBalanceDeltasStore` subscription (hook handles it)
    - Keep existing `onChainBalances` and `positions` queries unchanged (they feed the hook)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 6.1, 6.2, 6.3_

- [x] 4. Integrate hook into `TradingLayoutTerminal`
  - [x] 4.1 Replace inline `positionSizeForToken` in `apps/web/src/components/trading/trading-layout-terminal.tsx` with `useOptimisticTokenBalance`
    - Import `useOptimisticTokenBalance` from `@/hooks/use-optimistic-token-balance`
    - For each token ID, call the hook passing `tokenId`, `conditionId`, `safeAddress`, `chainBalance` from `onChainBalances`, and `apiPositionSize` from `positions` query
    - Remove the inline `positionSizeForToken` closure and the `usePendingBalanceDeltasStore` shallow subscription (hook handles it)
    - Keep `positionSizeForTokenRaw` unchanged — split/merge must not include pending deltas or local positions
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 3.1, 6.1, 6.2, 6.3_

- [x] 5. Integrate hook into `InstantTradePopup`
  - [x] 5.1 Replace inline `positionSize` memo in `useInstantTradeData` in `apps/web/src/components/market/instant-trade-popup.tsx` with `useOptimisticTokenBalance`
    - Import `useOptimisticTokenBalance` from `@/hooks/use-optimistic-token-balance`
    - Call the hook passing `tokenId`, `conditionId`, `safeAddress`, `chainBalance` from `onChainBalances`, and `apiPositionSize` from `positions` query
    - Remove the inline `positionSize` useMemo and direct `usePendingBalanceDeltasStore` subscription (hook handles it)
    - Keep existing `onChainBalances` and `positions` queries unchanged
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 6.1, 6.2, 6.3_

- [x] 6. Checkpoint — Ensure all surfaces use the shared hook
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Anti-double-counting and convergence tests
  - [x] 7.1 Write property test: Equivalence With Full Merge
    - **Property 3: Equivalence With Full Merge**
    - Generate full input sets (chain, API, local, pending); run both the hook logic and `mergeMarketPositionsForCondition`; compare the token's size in both outputs
    - **Validates: Requirements 3.1, 3.3, 3.4, 6.1**

  - [x] 7.2 Write unit test: Anti-Double-Counting
    - **Property 4: Anti-Double-Counting**
    - Chain balance = 100, local position = 100 from same trade → output must be 100, not 200
    - **Validates: Requirements 3.2**

  - [x] 7.3 Write property test: Monotonic Convergence
    - **Property 5: Monotonic Convergence**
    - Generate a buy amount; create a sequence of states where chain balance increases from 0 to the buy amount; assert output sequence is non-decreasing; mirror for sell (non-increasing)
    - **Validates: Requirements 4.2, 4.3**

- [x] 8. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use `fast-check` with Vitest, minimum 100 iterations per property
- Test file: `tests/unit/optimistic-balance-display.test.ts`
- `positionSizeForTokenRaw` in `TradingLayoutTerminal` is intentionally left unchanged (split/merge needs raw chain data)
- No client-side sell guards are added — CLOB error is the authoritative rejection (Requirement 5)
