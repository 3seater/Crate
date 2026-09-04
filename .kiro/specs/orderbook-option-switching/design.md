# Orderbook Option Switching — Bugfix Design

## Overview

Five interrelated bugs cause stale data, identical prices, and visual glitches when switching between options (markets) or Yes/No sides within a GMP event on the trading terminal. The root cause is a single-token-centric architecture: the orderbook Zustand store tracks only one active token's data in flat root fields, the `useOrderbook` hook subscribes to WebSocket updates for only the selected token, and `MarketTradingContext` derives Yes/No button prices from sticky `useRef` caches that only update when the store's `orderbookTokenId` matches.

The fix converts the architecture to a multi-token model:
1. The store already has a `books` map — ensure all mutations (especially `applyPriceChange`) route through it correctly for any token, not just the active one.
2. `useOrderbook` subscribes to both Yes and No token asset IDs and routes WS events (`book`, `price_change`, `last_trade_price`) to the correct token's book in the map.
3. `MarketTradingContext` reads prices directly from the store's `books` map via `getBook(state, tokenId)` instead of sticky refs, eliminating the stale-ref problem entirely.
4. Market switches use `setBookForToken` (atomic tokenId + book write) seeded from query cache for instant display.

## Glossary

- **Bug_Condition (C)**: The set of inputs/states where switching markets or Yes/No sides produces stale data, identical button prices, or swapped bids/asks
- **Property (P)**: The desired behavior — each token's orderbook is independently maintained, button prices reflect each token's live best ask, and market switches are atomic
- **Preservation**: Existing single-market orderbook behavior (WS debounce/batch, scroll pinning, flash animations, row click prefill, depth guard, reconnect refetch) must remain unchanged
- **`books` map**: `Record<string, TokenBook>` in the orderbook store — keyed by tokenId, holds independent orderbook state per token
- **`orderbookTokenId`**: The `tokenId` field on the store's root — identifies which token's book is currently "active" (spread to flat root fields for backward compat)
- **`setBookForToken`**: Atomic store action that writes book data + sets tokenId in a single `set()` call — no intermediate frame where tokenId and book data disagree
- **`preloadBook`**: Store action that writes to the `books` map without changing the active tokenId — used to pre-populate the complementary token's book
- **`applyPriceChangeForToken`**: New store action that applies incremental price changes to a specific token's book in the `books` map (not just the active token)
- **Sticky WS refs**: `yesWsAskRef`, `noWsAskRef`, `yesWsBidRef`, `noWsBidRef` in `MarketTradingContext` — `useRef` caches that persist each token's last-seen WS best bid/ask across side switches
- **`getBook(state, tokenId)`**: Exported helper that reads a specific token's `TokenBook` from the `books` map, returning `emptyBook` if not found

## Bug Details

### Bug Condition

The bugs manifest when a user switches between markets (options) within a GMP event, or switches between Yes and No sides on the same market. Five distinct failure modes share common architectural roots: single-token store tracking, single-token WS subscription, and sticky-ref price derivation.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type MarketSwitchEvent
  OUTPUT: boolean

  // Bug 1: Stale orderbook on market switch (~10s delay)
  LET staleBookBug =
    input.switchedMarket == true
    AND input.newTokenId != input.previousTokenId
    AND store.books[input.newTokenId] == undefined
    AND store.bids == previousToken.bids
    AND store.asks == previousToken.asks

  // Bug 2: No-side shows Yes-side book data
  LET wrongSideBookBug =
    input.switchedSide == true
    AND input.selectedTokenId != store.tokenId
    AND store.bids == otherSide.bids

  // Bug 3: Yes/No buttons show identical prices
  LET identicalPricesBug =
    input.yesTokenId != input.noTokenId
    AND yesWsAskRef.current == 0
    AND noWsAskRef.current == 0
    AND orderbookQueries.staleTime == Infinity
    AND abs(yesPrice - noPrice) < epsilon

  // Bug 4: Non-selected side price doesn't update in real-time
  LET stalePriceBug =
    input.wsEventReceived == true
    AND input.wsEvent.asset_id != store.tokenId
    AND store.books[input.wsEvent.asset_id] NOT updated

  // Bug 5: Bids/asks swapped during transition
  LET swappedBookBug =
    input.switchedMarket == true
    AND store.tokenId updated BEFORE store.bids/asks
    AND store.bids == newToken.asks

  RETURN staleBookBug OR wrongSideBookBug OR identicalPricesBug
         OR stalePriceBug OR swappedBookBug
END FUNCTION
```

### Examples

- **Market switch stale data**: User views Market A (Yes token `0xAAA`), switches to Market B (Yes token `0xBBB`). Store still shows `0xAAA`'s bids/asks for ~10s until WS `book` snapshot for `0xBBB` arrives. Expected: instant display from query cache.
- **Wrong side on No switch**: User is on Yes side, switches to No. Store's flat `bids`/`asks` still contain Yes token's data because `setTokenId("noToken")` runs before the No book WS snapshot arrives. Expected: No token's book surfaces immediately from `books` map.
- **Identical button prices**: Yes button shows 52¢, No button also shows 52¢. The Yes token's best ask is 52¢ (live via WS), but the No token's `noWsAskRef` is 0 (never updated because WS only subscribes to the selected token). Falls through to `orderbookQueries` snapshot which has `staleTime: Infinity` and shows the same stale value. Expected: Yes 52¢, No 48¢ (each from its own live orderbook).
- **Stale non-selected price**: User is viewing Yes side. No token's best ask changes from 48¢ to 45¢ on the CLOB. No button still shows 48¢ because there's no WS subscription for the No token. Expected: No button updates to 45¢ in real-time.
- **Swapped bids/asks**: User switches from Market A to Market B. `setTokenId` fires, then `setBook` fires with Market A's last WS data (race). Briefly shows Market A asks where Market B bids should be. Expected: atomic `setBookForToken` prevents any intermediate state.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Single market (SMP) orderbook with real-time WS updates, spread bar, depth bars, and scroll pinning must continue to work identically
- Incremental `price_change` events must continue to use the existing debounce/batch logic (120ms debounce, 250ms max buffer) and flash animation pipeline
- Clicking an orderbook row must continue to prefill the order form with the clicked price level
- WS reconnect must continue to refetch the orderbook snapshot to fill data gaps
- Hovering over a sibling market in the TradingSelectorCard dropdown must continue to prefetch that market's orderbook and chart data
- The shallow-snapshot depth-comparison guard in `handleBook` must continue to skip shallow WS snapshots that would cause depth flash
- All Markets mode must continue to disable Yes/No buttons and show multi-line chart overlay
- Closed/resolved markets must continue to skip orderbook fetching and WS subscriptions (`enabled: !closed` guard)
- The `bookHash` deduplication guard must continue to skip duplicate `setBook` calls

**Scope:**
All inputs that do NOT involve switching between markets within a GMP event or switching between Yes/No sides should be completely unaffected by this fix. This includes:
- Single-market viewing (no sibling markets)
- Order placement and cancellation
- Chart interactions
- Portfolio and positions display
- All non-trading features

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **`applyPriceChange` only updates the active token**: The store's `applyPriceChange` action reads `state.tokenId` and applies changes only to that token's book. When `useOrderbook` receives a `price_change` event for the complementary token (which it currently filters out anyway), there's no path to update the non-active book. Even if the WS subscription were expanded, the store action would ignore non-active token changes.

2. **`useOrderbook` filters WS events to selected token only**: `transformPriceChanges` explicitly filters `c.asset_id !== tokenId`, and `handleBook` checks `event.asset_id !== tokenId`. Even though `assetIds` includes the complementary token for WS subscription, all event handlers discard events for the non-selected token. This means the complementary token's book in the store never receives live updates.

3. **`MarketTradingContext` uses sticky refs that depend on `orderbookTokenId` matching**: The refs (`yesWsAskRef`, `noWsAskRef`) only update when `orderbookTokenId === yesTokenId` or `orderbookTokenId === noTokenId`. Since the store only tracks one token at a time, the non-selected side's ref stays at 0 and falls through to the `orderbookQueries` snapshot (which has `staleTime: Infinity` and never refetches).

4. **Non-atomic state transitions**: `setTokenId` and `setBook` are separate calls in `applySnapshotToStore`. During the gap between them, the store's flat fields can show data from the wrong token. The `setBookForToken` action exists but isn't used in all code paths.

5. **Query cache seeding is shallow-aware but not multi-token-aware**: The `useOrderbook` hook seeds from query cache on token switch, but only for the selected token. The complementary token's book is not pre-populated in the store's `books` map, so switching sides shows empty data until the WS snapshot arrives.

## Correctness Properties

Property 1: Bug Condition — Multi-Token Book Isolation

_For any_ market switch or side switch where the new tokenId differs from the previous one, the orderbook store's flat root fields (bids, asks, spread, midpoint, bestBid, bestAsk) SHALL immediately reflect the new token's book data from the `books` map (seeded from query cache or WS snapshot), with no intermediate frame showing the previous token's data.

**Validates: Requirements 2.1, 2.2, 2.5**

Property 2: Bug Condition — Independent Button Prices

_For any_ market with both Yes and No tokens having orderbook data, the Yes button price SHALL equal the lowest ask from the Yes token's orderbook and the No button price SHALL equal the lowest ask from the No token's orderbook, with each price derived independently from its respective token's live data in the store's `books` map.

**Validates: Requirements 2.3, 2.4**

Property 3: Bug Condition — Dual-Token WS Updates

_For any_ WebSocket `price_change` or `book` event received for either the Yes or No token, the corresponding token's book in the store's `books` map SHALL be updated, regardless of which token is currently active (selected).

**Validates: Requirements 2.4, 1.4**

Property 4: Preservation — Single-Market Orderbook Behavior

_For any_ input that does NOT involve switching between markets within a GMP event or switching Yes/No sides, the orderbook store SHALL produce the same state transitions as the original code, preserving all existing single-market functionality including debounce/batch, depth guard, scroll pinning, and flash animations.

**Validates: Requirements 3.1, 3.2, 3.3, 3.6**

Property 5: Preservation — WS Infrastructure Behavior

_For any_ WebSocket lifecycle event (connect, disconnect, reconnect, subscribe, unsubscribe), the market channel and subscription registry SHALL behave identically to the original code, preserving ref-counting, reconnect refetch, and subscription limits.

**Validates: Requirements 3.4, 3.5, 3.8**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/web/src/features/trading/stores/orderbook.ts`

**Changes**:
1. **Add `applyPriceChangeForToken` action**: New action that accepts a `tokenId` parameter and applies incremental price changes to that specific token's book in the `books` map, updating flat root fields only if the token is active. This allows WS events for the non-selected token to update the `books` map.
2. **Add `updateLastTradePriceForToken` action**: Similar to above — accepts a `tokenId` and updates `lastTradePrice`/`lastTradeSide` in the specific token's book entry.
3. **Add `updateBestBidAskForToken` action**: Accepts a `tokenId` and updates bestBid/bestAsk in the specific token's book entry.

**File**: `apps/web/src/features/trading/hooks/use-orderbook.ts`

**Changes**:
1. **Route WS events by asset_id to correct token book**: In `handleBook`, instead of filtering `event.asset_id !== tokenId`, use `setBookForToken` when the event is for the selected token and `preloadBook` when it's for the complementary token. This ensures both tokens' books stay live.
2. **Route `price_change` events to correct token**: In `handlePriceChange`, instead of filtering to only the selected token via `transformPriceChanges`, partition changes by asset_id and apply them to the correct token's book using `applyPriceChangeForToken(tokenId, changes)`.
3. **Route `last_trade_price` events to correct token**: Instead of filtering `event.asset_id === tokenId`, call `updateLastTradePriceForToken(event.asset_id, ...)` for any event whose asset_id is in `assetIds`.
4. **Seed both tokens from query cache on market switch**: When the hook mounts or `tokenId` changes, also seed the complementary token's book from query cache via `preloadBook`.

**File**: `apps/web/src/features/trading/components/market/market-trading-context.tsx`

**Changes**:
1. **Replace sticky WS refs with direct store reads**: Instead of maintaining `yesWsAskRef`/`noWsAskRef`/`yesWsBidRef`/`noWsBidRef` and conditionally updating them when `orderbookTokenId` matches, read prices directly from the store's `books` map using selectors like `useOrderbookStore(s => s.books[yesTokenId]?.bestAsk ?? 0)`. Since both tokens now receive live WS updates, the `books` map is always current.
2. **Remove `orderbookQueries` dual-fetch**: The `useQueries` call that fetches both orderbooks with `staleTime: Infinity` can be simplified or removed — the store's `books` map (populated by `useOrderbook` + WS) is now the single source of truth for button prices.
3. **Simplify price priority chain**: The 4-level fallback (WS ref → snapshot → polled → static) simplifies to: store book bestAsk → polled last-trade → static Gamma price.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests against the orderbook store and mock WS event handlers that simulate market/side switching scenarios. Run on UNFIXED code to observe failures.

**Test Cases**:
1. **Stale Book on Market Switch**: Call `setBookForToken("tokenA", bidsA, asksA)`, then `setTokenId("tokenB")` — assert flat fields show `emptyBook`, not tokenA's data (will fail on unfixed code if tokenB has no book entry)
2. **applyPriceChange Ignores Non-Active Token**: Set active token to "tokenA", call `applyPriceChange` with changes for "tokenB" — assert `books["tokenB"]` is updated (will fail on unfixed code because applyPriceChange only updates active token)
3. **Identical Button Prices**: Simulate MarketTradingContext with orderbookTokenId === yesTokenId, verify noWsAskRef stays at 0 and noPrice falls through to stale snapshot (will demonstrate the bug on unfixed code)
4. **Race Condition**: Call `setTokenId("tokenB")` then `setBook(tokenA_data)` in sequence — assert flat fields don't show tokenA data (may fail on unfixed code)

**Expected Counterexamples**:
- `applyPriceChange` silently drops changes for non-active tokens
- Sticky refs remain at 0 for the non-selected token, producing identical prices
- Possible causes: single-token filtering in WS handlers, ref-based price caching, non-atomic state transitions

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := applyFixedActions(input)
  ASSERT books[input.newTokenId].bids == expectedBids
  ASSERT books[input.newTokenId].asks == expectedAsks
  ASSERT flatFields match books[activeTokenId]
  ASSERT yesPrice derived from books[yesTokenId].bestAsk
  ASSERT noPrice derived from books[noTokenId].bestAsk
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT orderbookStore_fixed(input) == orderbookStore_original(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many random orderbook states (varying depths, prices, sizes) and verifies store mutations produce identical results
- It catches edge cases in the binary-search insert, deduplication, and depth computation paths
- It provides strong guarantees that the multi-token refactor doesn't regress single-token behavior

**Test Plan**: Observe behavior on UNFIXED code first for single-market operations, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Single-Market setBook Preservation**: Generate random bids/asks, verify `setBook` produces identical store state in both original and fixed code
2. **applyPriceChange Preservation (Active Token)**: Generate random price changes for the active token, verify identical results
3. **bookHash Deduplication Preservation**: Generate duplicate book snapshots, verify both versions skip the update
4. **Depth Guard Preservation**: Generate shallow WS snapshots after deep cache seeds, verify both versions skip the shallow snapshot

### Unit Tests

- Test `applyPriceChangeForToken` correctly updates a specific token's book in the `books` map
- Test `setBookForToken` atomically sets both tokenId and book data
- Test `preloadBook` writes to `books` map without changing active tokenId or flat fields
- Test `setTokenId` surfaces the correct book from `books` map to flat fields
- Test price derivation in MarketTradingContext reads from `books` map instead of sticky refs
- Test WS event routing: `book` events for complementary token update `books` map via `preloadBook`
- Test WS event routing: `price_change` events for complementary token update `books` map via `applyPriceChangeForToken`

### Property-Based Tests

- Generate random pairs of tokenIds and orderbook data, verify `books` map maintains isolation (no cross-contamination between tokens)
- Generate random sequences of `setBookForToken`, `applyPriceChangeForToken`, and `setTokenId` calls, verify flat fields always match `books[activeTokenId]`
- Generate random single-token operations, verify fixed store produces identical output to original store (preservation)

### Integration Tests

- Test full market switch flow: prefetch → switchMarket → query cache seed → WS subscription → live updates for both tokens
- Test Yes/No side switch: verify both button prices update independently after switching sides
- Test WS reconnect: verify both tokens' books are refetched on reconnect
