# Trading Experience Audit Bugfix Design

## Overview

Two surgical fixes for the trading experience: (1) `tradeRecordFromEvent()` ignores the `effectiveSide` parameter, always recording the taker's side from `event.side` instead of the user's actual order side for resting limit fills; (2) the portfolio page position count badge relies solely on the Data API (`staleTime: 5000`) without incorporating WebSocket events or pending balance deltas, causing 5–30 second staleness compared to the market terminal.

Both fixes are minimal, targeted changes to existing functions — no restructuring.

## Glossary

- **Bug_Condition (C)**: The condition that triggers each bug — (1) resting limit fill where `effectiveSide ≠ event.side`, (2) Data API position count diverges from real-time merged count
- **Property (P)**: Desired behavior — (1) `TradeRecord.side` matches `effectiveSide` when provided, (2) portfolio badge reflects local positions store + pending deltas for instant count
- **Preservation**: (1) Market order trade records unchanged (no `effectiveSide` override), (2) portfolio position row data, PNL, and all non-badge computations unchanged
- **`tradeRecordFromEvent`**: Function in `apps/web/src/stores/positions.ts` that creates a `TradeRecord` from a `UserTradeEvent`
- **`applyTrade`**: Zustand action in `usePositionsStore` that calls both `applyTradeToPositions` (correctly uses `effectiveSide`) and `tradeRecordFromEvent` (ignores it)
- **`usePortfolioData`**: Hook in `apps/web/src/app/portfolio/use-portfolio-data.ts` that computes `positionsCount` as `positions.length` from `trpc.data.positions`
- **`usePositionsStore`**: Zustand store holding `LocalPosition[]` from WebSocket trade events — updated instantly on trade
- **`usePendingBalanceDeltasStore`**: Zustand store holding pending balance deltas from confirmed trades — used by `getEffectiveBalance` to prevent stale flash

## Bug Details

### Bug 1: Trade Record Wrong Side

The bug manifests when a resting limit order fills via WebSocket. The `applyTrade` action correctly passes `effectiveSide` to `applyTradeToPositions` (which uses it for position size math), but then calls `tradeRecordFromEvent(event)` without forwarding `effectiveSide`. The function signature `tradeRecordFromEvent(event: UserTradeEvent)` has no parameter for it, so it always uses `event.side` — which is the taker's side, opposite to the user's resting order.

**Formal Specification:**
```
FUNCTION isBugCondition_WrongSide(input)
  INPUT: input of type { event: UserTradeEvent, effectiveSide: "BUY" | "SELL" | undefined }
  OUTPUT: boolean

  RETURN input.effectiveSide IS NOT undefined
     AND input.effectiveSide ≠ input.event.side
END FUNCTION
```

### Examples

- User places a resting limit BUY at $0.45. Taker sells into it. WebSocket delivers `event.side = "SELL"`. `applyTradeToPositions` correctly uses `effectiveSide = "BUY"` to add size. But `tradeRecordFromEvent` records `side: "SELL"` — wrong.
- User places a resting limit SELL at $0.60. Taker buys into it. WebSocket delivers `event.side = "BUY"`. `tradeRecordFromEvent` records `side: "BUY"` — wrong.
- User places a market BUY (taker). WebSocket delivers `event.side = "BUY"`. No `effectiveSide` override. `tradeRecordFromEvent` records `side: "BUY"` — correct (no bug).
- User places a market SELL (taker). No `effectiveSide` override. Records `side: "SELL"` — correct.

### Bug 2: Portfolio Position Count Badge Stale

The bug manifests when the user navigates to the portfolio page after a trade. `usePortfolioData` computes `positionsCount` as `positions.length` where `positions` comes from `trpc.data.positions` with `staleTime: 5000`. The Data API can lag 5–30 seconds behind the actual state. Meanwhile, the market terminal uses `useMergedMarketPositions` which incorporates `usePositionsStore` (WebSocket-local positions) and `usePendingBalanceDeltasStore` (pending deltas) for instant updates.

**Formal Specification:**
```
FUNCTION isBugCondition_StaleBadge(input)
  INPUT: input of type { dataApiCount: number, localPositionsCount: number }
  OUTPUT: boolean

  RETURN input.dataApiCount ≠ input.localPositionsCount
     AND input.localPositionsCount reflects more recent state
END FUNCTION
```

### Examples

- User buys a new position on market terminal. Switches to portfolio. Badge shows 0 positions for 5–30s while Data API indexes. Market terminal already shows 1.
- User sells entire position. Switches to portfolio. Badge still shows 1 position for 5–30s. Market terminal already shows 0.
- User has 3 positions, no recent trades. Data API and local store agree. Badge shows 3 — correct (no bug).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Market order trade records must continue to record the correct side (taker = user, so `event.side` is already correct)
- `applyTradeToPositions` must continue to use `effectiveSide` for position size calculations exactly as today
- Portfolio position row data (size, avgPrice, PNL, redeemable) must continue to come from the Data API response
- Market terminal `useMergedMarketPositions` hook must continue to work with its current merge logic
- Instant trade popup Bought/Sold/PNL stats must continue to use `trpc.data.trades` (server-side correct)
- Limit fill toasts must continue to use `getRestingLimitSide` for display
- Quick-sell modal execution path is unaffected
- All non-badge return values from `usePortfolioData` must remain identical

**Scope:**
All inputs where `effectiveSide` is undefined (market orders) are unaffected by Bug 1 fix. All non-`positionsCount` return values from `usePortfolioData` are unaffected by Bug 2 fix.

## Hypothesized Root Cause

### Bug 1: Trade Record Wrong Side

1. **Missing parameter**: `tradeRecordFromEvent` was written with only `event: UserTradeEvent` as its parameter. When `effectiveSide` was later added to `applyTradeToPositions` and the `applyTrade` action, `tradeRecordFromEvent` was not updated to accept it.
2. **Call site omission**: The `applyTrade` action calls `tradeRecordFromEvent(event)` without passing `effectiveSide`, even though it passes `effectiveSide` to `applyTradeToPositions` on the line above.

### Bug 2: Portfolio Position Count Badge Stale

1. **Data source mismatch**: `usePortfolioData` computes `positionsCount` from `trpc.data.positions` (Data API only). The market terminal uses `useMergedMarketPositions` which overlays `usePositionsStore.positions` (WebSocket-local) and pending balance deltas on top of the API data.
2. **No local store subscription**: `usePortfolioData` does not subscribe to `usePositionsStore` or `usePendingBalanceDeltasStore`, so it has no fast-path for count updates.

## Correctness Properties

Property 1: Bug Condition - Trade Record Uses Effective Side

_For any_ trade event where `effectiveSide` is provided and differs from `event.side` (resting limit fill), the fixed `tradeRecordFromEvent` function SHALL use `effectiveSide` as the `TradeRecord.side` value, matching the user's actual order direction.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation - Market Order Trade Records Unchanged

_For any_ trade event where `effectiveSide` is undefined (market order, taker = user), the fixed `tradeRecordFromEvent` function SHALL produce the same `TradeRecord` as the original function, preserving `event.side` as the recorded side.

**Validates: Requirements 3.1, 3.2**

Property 3: Bug Condition - Portfolio Badge Incorporates Local Positions

_For any_ state where the local positions store contains positions not yet reflected in the Data API, the fixed `usePortfolioData` hook SHALL compute `positionsCount` incorporating the local positions store so the badge count converges faster than the Data API alone.

**Validates: Requirements 2.3, 2.4**

Property 4: Preservation - Portfolio Non-Badge Data Unchanged

_For any_ call to `usePortfolioData`, all return values other than `positionsCount` SHALL remain identical to the original function, preserving position row data, PNL calculations, and all other portfolio metrics.

**Validates: Requirements 3.3, 3.5**

## Fix Implementation

### Changes Required

#### Bug 1: Trade Record Wrong Side

**File**: `apps/web/src/stores/positions.ts`

**Function**: `tradeRecordFromEvent`

**Specific Changes**:
1. **Add optional `effectiveSide` parameter**: Change signature from `tradeRecordFromEvent(event: UserTradeEvent)` to `tradeRecordFromEvent(event: UserTradeEvent, effectiveSide?: "BUY" | "SELL")`.
2. **Use `effectiveSide` when provided**: Change `side: event.side` to `side: effectiveSide ?? event.side` in the returned object.

**Call site**: `applyTrade` action in `usePositionsStore`

3. **Pass `effectiveSide` to `tradeRecordFromEvent`**: Change `tradeRecordFromEvent(event)` to `tradeRecordFromEvent(event, effectiveSide)` in the `applyTrade` action.

#### Bug 2: Portfolio Position Count Badge Stale

**File**: `apps/web/src/app/portfolio/use-portfolio-data.ts`

**Function**: `usePortfolioData`

**Specific Changes**:
1. **Subscribe to local positions store**: Add `const localPositions = usePositionsStore((s) => s.positions)` to read WebSocket-local positions.
2. **Compute augmented position count**: After computing `positions` from the Data API, compute a `positionsCount` that accounts for local positions not yet in the API response. Count local positions whose `asset` is not already present in the API positions array, filter by a minimum size threshold (`CLOB_SIZE_DISPLAY_THRESHOLD` or `0.01`), and add that count to `positions.length`.
3. **Import**: Add `import { usePositionsStore } from "@/stores/positions"` and `import { CLOB_SIZE_DISPLAY_THRESHOLD } from "@doji/types"`.

This is a lightweight approach — no full merge logic, no chain balance queries, no new hooks. Just overlay the local positions store count on top of the API count for the badge only.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write unit tests that call `tradeRecordFromEvent` with an `effectiveSide` that differs from `event.side`, and verify the returned `TradeRecord.side` is wrong. For Bug 2, mock `usePortfolioData` with stale API data and verify the badge count doesn't reflect local positions.

**Test Cases**:
1. **Wrong Side - Resting BUY**: Call `tradeRecordFromEvent(event)` where `event.side = "SELL"` and `effectiveSide = "BUY"` — record will show "SELL" (will fail on unfixed code)
2. **Wrong Side - Resting SELL**: Call `tradeRecordFromEvent(event)` where `event.side = "BUY"` and `effectiveSide = "SELL"` — record will show "BUY" (will fail on unfixed code)
3. **Stale Badge - New Position**: Set local positions store with 1 position, API returns 0 — badge shows 0 (will fail on unfixed code)
4. **Stale Badge - Closed Position**: Set local positions store with 0 positions, API returns 1 — badge shows 1 (will fail on unfixed code)

**Expected Counterexamples**:
- `tradeRecordFromEvent` ignores `effectiveSide` entirely because it has no such parameter
- `usePortfolioData` returns `positions.length` from API data only, never consulting local store

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
// Bug 1: Trade Record Side
FOR ALL input WHERE isBugCondition_WrongSide(input) DO
  record := tradeRecordFromEvent'(input.event, input.effectiveSide)
  ASSERT record.side = input.effectiveSide
END FOR

// Bug 2: Portfolio Badge
FOR ALL input WHERE localPositions has entries not in API DO
  count := usePortfolioData'(address).positionsCount
  ASSERT count >= localPositionCount
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
// Bug 1: Market orders (no effectiveSide)
FOR ALL input WHERE NOT isBugCondition_WrongSide(input) DO
  ASSERT tradeRecordFromEvent(input.event) = tradeRecordFromEvent'(input.event)
END FOR

// Bug 2: When API and local store agree
FOR ALL input WHERE dataApiCount = localCount DO
  ASSERT usePortfolioData(address).positionsCount = usePortfolioData'(address).positionsCount
END FOR
```

**Testing Approach**: Property-based testing is recommended for Bug 1 preservation checking because `tradeRecordFromEvent` is a pure function with a well-defined input domain. For Bug 2, unit tests with mocked stores are more practical since the hook involves React Query and Zustand subscriptions.

**Test Plan**: Observe behavior on UNFIXED code first, then write tests capturing that behavior.

**Test Cases**:
1. **Market Order Preservation**: Verify `tradeRecordFromEvent(event)` with no `effectiveSide` produces identical output before and after fix
2. **applyTradeToPositions Preservation**: Verify position size calculations are unchanged
3. **Portfolio Non-Badge Preservation**: Verify all `usePortfolioData` return values except `positionsCount` are identical
4. **Portfolio Badge When In Sync**: Verify badge count is correct when API and local store agree

### Unit Tests

- Test `tradeRecordFromEvent` with `effectiveSide` override (BUY fill, SELL fill)
- Test `tradeRecordFromEvent` without `effectiveSide` (market orders — unchanged behavior)
- Test `applyTrade` action passes `effectiveSide` through to both `applyTradeToPositions` and `tradeRecordFromEvent`
- Test portfolio `positionsCount` incorporates local positions not in API response
- Test portfolio `positionsCount` does not double-count positions already in API response

### Property-Based Tests

- Generate random `UserTradeEvent` + `effectiveSide` pairs and verify `tradeRecordFromEvent` uses `effectiveSide` when provided, `event.side` otherwise
- Generate random local position sets and API position sets, verify `positionsCount` is at least `max(apiCount, localUniqueCount)`

### Integration Tests

- Test full WebSocket trade event flow: resting limit fill → `processUserTradeEvent` → verify `TradeRecord.side` matches order direction
- Test portfolio page renders correct badge count when local positions store has recent trades not yet in API
