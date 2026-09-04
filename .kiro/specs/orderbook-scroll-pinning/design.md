# Orderbook Scroll Pinning — Bugfix Design

## Overview

Three related bugs cause the orderbook spread bar to lose its pinned position. The orderbook should keep the lowest ask and highest bid pinned to the spread bar (midpoint) unless the user has intentionally scrolled away. Three defects break this contract:

1. **Tab visibility**: No `visibilitychange` listener exists — returning from another browser tab leaves the orderbook unpinned.
2. **Short-circuit in `applySpreadScrollSync`**: `if (skipAsks || skipBids) { return; }` aborts BOTH sides when only one side's user has scrolled away.
3. **Incremental update drift**: When new ask levels arrive via WebSocket, `scrollHeight` grows but `scrollTop` is never adjusted, causing the best ask to drift away from the spread.

All three fixes target `apps/web/src/features/trading/components/orderbook.tsx`. The scroll logic lives entirely in the `Orderbook` component — the `useOrderbook` hook and Zustand stores handle data, not scroll positioning.

## Glossary

- **Bug_Condition (C)**: The set of inputs/states where the orderbook scroll position drifts away from the spread despite the user not having scrolled away
- **Property (P)**: The desired behavior — asks pinned with best ask at bottom, bids pinned with best bid at top, respecting per-side `userHasScrolled` flags
- **Preservation**: Existing behaviors (user scroll freedom, re-enable on scroll-back, market switch reset, programmatic scroll suppression, initial load pinning, spread bar debounce) that must remain unchanged
- **`applySpreadScrollSync`**: Helper function in `orderbook.tsx` that scrolls asks to bottom and bids to top, gated by `skipAsks`/`skipBids` flags
- **`userHasScrolledAsksRef` / `userHasScrolledBidsRef`**: Per-side refs tracking whether the user has intentionally scrolled away from the spread
- **`isProgrammaticScrollRef`**: Ref set to `true` during programmatic scrolls to prevent scroll handlers from falsely marking user-scrolled state
- **`isAsksAtSpread()` / `isBidsAtSpread()`**: Callbacks that check if the respective panel is within 2px of the spread position
- **`prevAsksLenRef` / `prevBidsLenRef`**: Refs tracking previous visible row counts to detect the empty→populated transition for initial load pinning

## Bug Details

### Bug Condition

The bugs manifest in three distinct scenarios, all within the `Orderbook` component's scroll management logic in `orderbook.tsx`.

**Bug 1 — Tab Visibility**: The component has no `visibilitychange` event listener. When the user switches tabs and returns, the browser may have discarded or reset scroll positions. The existing `useLayoutEffect` only fires on the empty→populated transition (`wasEmpty` guard), so it cannot re-pin on tab return.

**Bug 2 — Short-Circuit**: `applySpreadScrollSync` (line ~113) has `if (skipAsks || skipBids) { return; }`. This means if the user scrolled away on asks only (`skipAsks=true, skipBids=false`), the function returns early and bids are never pinned either.

**Bug 3 — Incremental Drift**: The `useLayoutEffect` (line ~218) only runs scroll sync when `wasEmpty` is true (0→N rows). When new price levels arrive via WebSocket `price_change` events, `visibleAsks` grows (new rows at worse prices), `scrollHeight` increases, but `scrollTop` stays the same. The best ask drifts upward away from the spread bar.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type OrderbookScrollState
  OUTPUT: boolean

  // Bug 1: Tab return with no re-pin
  LET tabReturnBug =
    input.visibilityChanged == true
    AND input.documentVisible == true
    AND input.hasOrderbookData == true
    AND (NOT input.userHasScrolledAsks OR NOT input.userHasScrolledBids)

  // Bug 2: Short-circuit prevents independent side pinning
  LET shortCircuitBug =
    input.skipAsks != input.skipBids
    AND (input.visibleAsksLen > 0 OR input.visibleBidsLen > 0)

  // Bug 3: Incremental update drift
  LET incrementalDriftBug =
    input.asksLengthIncreased == true
    AND NOT input.userHasScrolledAsks
    AND input.prevAsksLen > 0
    AND input.asksScrollHeight > input.asksClientHeight

  RETURN tabReturnBug OR shortCircuitBug OR incrementalDriftBug
END FUNCTION
```

### Examples

- **Bug 1 — Tab return**: User views orderbook pinned at spread. Switches to another tab for 30 seconds. Returns. Browser has reset `scrollTop` to 0 on the asks container. Best ask is now at the top of the asks panel instead of at the bottom near the spread. No code re-pins it because the `useLayoutEffect` only fires on empty→populated.
- **Bug 2 — Short-circuit**: User scrolls up in the asks panel to see worse ask prices (`userHasScrolledAsks=true`). Bids are still at spread (`userHasScrolledBids=false`). A scroll sync trigger fires with `skipAsks=true, skipBids=false`. The `if (skipAsks || skipBids) { return; }` aborts entirely. Bids never get pinned to `scrollTop=0`, even though the user hasn't scrolled bids away.
- **Bug 3 — Incremental drift**: User is at spread. WebSocket delivers 3 new ask levels at worse prices. `visibleAsks` grows from 15 to 18 rows. `scrollHeight` increases by ~72px (3 rows × ~24px). `scrollTop` stays at the old value. The best ask is now 72px above the bottom of the asks container, no longer adjacent to the spread bar.
- **Normal case (no bug)**: User is at spread, no tab switch, no new levels arrive, `applySpreadScrollSync` is called with `skipAsks=false, skipBids=false`. Both sides are pinned correctly.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When the user has intentionally scrolled away from the spread on a given side, the system must continue to respect that choice and not auto-scroll them back (requirement 3.1)
- When the user scrolls back to the bottom of asks or top of bids, the system must continue to re-enable auto-pinning by resetting the `userHasScrolled` flag (requirement 3.2)
- When the user switches markets or tokens, scroll flags must continue to reset and the orderbook must re-pin to the spread (requirement 3.3)
- Programmatic scrolling via `isProgrammaticScrollRef` must continue to suppress scroll event handlers (requirement 3.4)
- Initial load pinning via the existing `useLayoutEffect` + `requestAnimationFrame` pattern must continue to work for the empty→populated transition (requirement 3.5)
- Spread bar label debounce must continue to smooth midpoint/spread display values (requirement 3.6)

**Scope:**
All inputs that do NOT involve tab visibility changes, the `applySpreadScrollSync` short-circuit path, or incremental WebSocket updates while at spread should be completely unaffected by this fix. This includes:
- Mouse wheel scrolling behavior and scroll event detection
- Row click prefill behavior
- Flash/pulse animation on price changes
- Orderbook row rendering, depth bars, and order indicators
- Column header drag handle for panel swap

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Missing `visibilitychange` listener (Bug 1)**: The `Orderbook` component has no `useEffect` that listens for `document.visibilitychange`. The only scroll-pinning code is in the `useLayoutEffect` at line ~218, which is gated by `wasEmpty` (empty→populated transition). There is no mechanism to re-pin after a tab switch. Browsers may discard or reset scroll positions for off-screen elements, and even if they don't, the scroll container's layout may have been recalculated.

2. **Logical OR instead of independent evaluation (Bug 2)**: `applySpreadScrollSync` at line ~113 uses `if (skipAsks || skipBids) { return; }`. This is a logical error — the intent is to skip each side independently, but the early return aborts the entire function when either side should be skipped. The fix is to remove the early return and wrap each side's scroll logic in its own `if (!skip*)` guard.

3. **No scrollTop adjustment after incremental updates (Bug 3)**: The `useLayoutEffect` at line ~218 tracks `prevAsksLenRef` and `prevBidsLenRef` but only uses them for the `wasEmpty` check. When `visibleAsks.length` changes from N to N+M (incremental update, not initial load), `wasEmpty` is false and the effect returns early. No code compensates for the increased `scrollHeight` on the asks side. The asks container has `[overflow-anchor:none]` CSS which explicitly disables browser auto-anchoring, so the browser won't help either.

4. **React Compiler consideration**: This is a React 19 app with React Compiler. Refs are not tracked by the compiler's memoization, so `userHasScrolledAsksRef.current` reads in effects are fine. However, any new `useEffect` must be careful not to capture stale closures over ref values — read refs inside the effect body, not in the dependency array.

## Correctness Properties

Property 1: Bug Condition — Tab Return Re-Pins to Spread

_For any_ `visibilitychange` event where `document.visibilityState` becomes `"visible"` and the orderbook has data, the fixed `Orderbook` component SHALL re-pin asks (scrollTop = scrollHeight - clientHeight) and bids (scrollTop = 0) for each side where `userHasScrolled` is false, using the `isProgrammaticScrollRef` pattern to suppress false scroll detection.

**Validates: Requirements 2.1**

Property 2: Bug Condition — Independent Side Evaluation in applySpreadScrollSync

_For any_ call to `applySpreadScrollSync` where `skipAsks` and `skipBids` have different values, the fixed function SHALL scroll the non-skipped side to its spread position while leaving the skipped side's `scrollTop` unchanged, rather than short-circuiting both sides.

**Validates: Requirements 2.2**

Property 3: Bug Condition — Incremental Update Keeps Best Ask Pinned

_For any_ incremental update where `visibleAsks.length` increases (new levels from WebSocket) and `userHasScrolledAsks` is false, the fixed code SHALL adjust the asks container's `scrollTop` to `scrollHeight - clientHeight`, keeping the best ask pinned at the bottom adjacent to the spread bar.

**Validates: Requirements 2.3**

Property 4: Preservation — User Scroll Freedom and Existing Behaviors

_For any_ input where none of the three bug conditions hold (no tab return, no mixed skip flags, no incremental update while at spread), the fixed code SHALL produce exactly the same scroll behavior as the original code, preserving user scroll freedom, scroll-back re-enable, market switch reset, programmatic scroll suppression, initial load pinning, and spread bar debounce.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/web/src/features/trading/components/orderbook.tsx`

**Change 1 — Add `visibilitychange` listener (Bug 1)**:

Add a new `useEffect` in the `Orderbook` component that:
- Listens for `document.visibilitychange`
- When `document.visibilityState === "visible"`, calls `applySpreadScrollSync` (the fixed version) with `skipAsks: userHasScrolledAsksRef.current` and `skipBids: userHasScrolledBidsRef.current`
- Guards on `isDataForToken` to avoid scrolling when there's no data
- Cleans up the listener on unmount

```typescript
useEffect(() => {
  const handleVisibilityChange = () => {
    if (document.visibilityState !== "visible" || !isDataForToken) {
      return;
    }
    applySpreadScrollSync({
      asksScrollRef,
      bidsScrollRef,
      visibleAsksLen: visibleAsks.length,
      visibleBidsLen: visibleBids.length,
      skipAsks: userHasScrolledAsksRef.current,
      skipBids: userHasScrolledBidsRef.current,
      isProgrammaticScrollRef,
    });
  };
  document.addEventListener("visibilitychange", handleVisibilityChange);
  return () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}, [isDataForToken, visibleAsks.length, visibleBids.length]);
```

**Change 2 — Fix `applySpreadScrollSync` short-circuit (Bug 2)**:

Remove the early return `if (skipAsks || skipBids) { return; }` and instead wrap each side's scroll logic in its own guard:

```typescript
function applySpreadScrollSync(args: { ... }): void {
  const { ..., skipAsks, skipBids, isProgrammaticScrollRef } = args;

  isProgrammaticScrollRef.current = true;
  if (!skipAsks && visibleAsksLen > 0) {
    const askEl = asksScrollRef.current;
    if (askEl) {
      const { scrollHeight, clientHeight } = askEl;
      if (scrollHeight > clientHeight + 1) {
        askEl.scrollTop = scrollHeight - clientHeight;
      }
    }
  }
  if (!skipBids && visibleBidsLen > 0) {
    const bidEl = bidsScrollRef.current;
    if (bidEl) {
      bidEl.scrollTop = 0;
    }
  }
  isProgrammaticScrollRef.current = false;
}
```

**Change 3 — Adjust scrollTop after incremental ask updates (Bug 3)**:

Extend the existing `useLayoutEffect` to handle incremental updates on the asks side. After the `wasEmpty` initial-load path, add a check: if `visibleAsks.length` increased from the previous value and `userHasScrolledAsksRef.current` is false, adjust `scrollTop` to keep the best ask at the bottom.

```typescript
useLayoutEffect(() => {
  if (!isDataForToken) {
    prevAsksLenRef.current = 0;
    prevBidsLenRef.current = 0;
    return;
  }

  const wasEmpty =
    prevAsksLenRef.current === 0 && prevBidsLenRef.current === 0;
  const prevAsksLen = prevAsksLenRef.current;
  prevAsksLenRef.current = visibleAsks.length;
  prevBidsLenRef.current = visibleBids.length;

  if (wasEmpty) {
    // Initial load — existing behavior preserved
    const runScroll = () => {
      applySpreadScrollSync({ ... });
    };
    runScroll();
    const id = requestAnimationFrame(runScroll);
    return () => cancelAnimationFrame(id);
  }

  // Incremental update: if asks grew and user hasn't scrolled away, re-pin
  if (
    visibleAsks.length > prevAsksLen &&
    prevAsksLen > 0 &&
    !userHasScrolledAsksRef.current
  ) {
    isProgrammaticScrollRef.current = true;
    const askEl = asksScrollRef.current;
    if (askEl) {
      const { scrollHeight, clientHeight } = askEl;
      if (scrollHeight > clientHeight + 1) {
        askEl.scrollTop = scrollHeight - clientHeight;
      }
    }
    isProgrammaticScrollRef.current = false;
  }
}, [isDataForToken, visibleAsks.length, visibleBids.length]);
```

**Change 4 — No changes to other files**:

The `useOrderbook` hook, `orderbook` store, `trading-ui-preferences` store, and WebSocket infrastructure require no changes. The scroll logic is entirely within the `Orderbook` component.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that exercise `applySpreadScrollSync` directly and simulate the scroll state transitions in the `Orderbook` component. Use mock DOM elements with controllable `scrollHeight`, `clientHeight`, and `scrollTop`. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Tab Return Test**: Simulate `visibilitychange` event on a mounted `Orderbook` with data — verify scroll positions are restored (will fail on unfixed code because no listener exists)
2. **Short-Circuit Test**: Call `applySpreadScrollSync` with `skipAsks=true, skipBids=false` — verify bids `scrollTop` is set to 0 (will fail on unfixed code because early return aborts both)
3. **Short-Circuit Inverse Test**: Call `applySpreadScrollSync` with `skipAsks=false, skipBids=true` — verify asks `scrollTop` is set to `scrollHeight - clientHeight` (will fail on unfixed code)
4. **Incremental Drift Test**: Simulate `visibleAsks` growing from 15 to 18 rows with `userHasScrolledAsks=false` — verify `scrollTop` is adjusted (will fail on unfixed code because `wasEmpty` is false)

**Expected Counterexamples**:
- `applySpreadScrollSync({skipAsks: true, skipBids: false})` returns without scrolling bids
- After tab return, asks `scrollTop` remains at browser-reset value (0) instead of `scrollHeight - clientHeight`
- After incremental update, asks `scrollTop` stays at old value while `scrollHeight` has grown
- Possible causes: early return in `applySpreadScrollSync`, missing `visibilitychange` listener, `wasEmpty` guard in `useLayoutEffect`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := applyFix(input)
  IF input.tabReturnBug THEN
    FOR EACH side IN [asks, bids] WHERE NOT input.userHasScrolled[side] DO
      ASSERT side.scrollTop == expectedSpreadPosition(side)
    END FOR
  END IF
  IF input.shortCircuitBug THEN
    ASSERT nonSkippedSide.scrollTop == expectedSpreadPosition(nonSkippedSide)
    ASSERT skippedSide.scrollTop == originalScrollTop
  END IF
  IF input.incrementalDriftBug THEN
    ASSERT asks.scrollTop == asks.scrollHeight - asks.clientHeight
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT originalBehavior(input) == fixedBehavior(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of scroll states, `userHasScrolled` flags, and `visibleAsks`/`visibleBids` lengths
- It catches edge cases in the `applySpreadScrollSync` function that manual unit tests might miss
- It provides strong guarantees that non-buggy scroll paths are unchanged

**Test Plan**: Observe behavior on UNFIXED code first for normal scroll interactions (both sides at spread, both sides scrolled away), then write property-based tests capturing that behavior.

**Test Cases**:
1. **Both-sides-at-spread preservation**: Verify that `applySpreadScrollSync({skipAsks: false, skipBids: false})` scrolls both sides correctly, before and after fix
2. **Both-sides-scrolled preservation**: Verify that `applySpreadScrollSync({skipAsks: true, skipBids: true})` does not scroll either side, before and after fix
3. **User scroll detection preservation**: Verify that manual scroll events correctly set/clear `userHasScrolled` flags, before and after fix
4. **Market switch reset preservation**: Verify that changing `tokenId` resets both `userHasScrolled` flags, before and after fix
5. **Programmatic scroll suppression preservation**: Verify that scroll events during `isProgrammaticScrollRef=true` do not change `userHasScrolled` flags, before and after fix
6. **Initial load pinning preservation**: Verify that the empty→populated transition still triggers `applySpreadScrollSync` via `useLayoutEffect` + `requestAnimationFrame`, before and after fix

### Unit Tests

- Test `applySpreadScrollSync` with all 4 combinations of `skipAsks`/`skipBids` using mock scroll elements
- Test `applySpreadScrollSync` with edge cases: `scrollHeight === clientHeight` (no overflow), zero visible rows, null refs
- Test `isAsksAtSpread()` and `isBidsAtSpread()` with various scroll positions (at spread, 1px away, 3px away)
- Test `handleAsksScroll` and `handleBidsScroll` with `isProgrammaticScrollRef` true vs false

### Property-Based Tests

- Generate random `scrollHeight`, `clientHeight`, `scrollTop` values and `skipAsks`/`skipBids` flags — verify `applySpreadScrollSync` only modifies the non-skipped side's `scrollTop`
- Generate random sequences of visibility changes and incremental updates — verify scroll position is always correct relative to `userHasScrolled` state
- Generate random `visibleAsks.length` transitions (grow, shrink, same) with random `userHasScrolledAsks` — verify `scrollTop` adjustment only occurs when length grows and user hasn't scrolled

### Integration Tests

- Test full orderbook render with mock data → tab switch → tab return → verify spread is pinned
- Test orderbook with one side scrolled away → trigger scroll sync → verify only the non-scrolled side is pinned
- Test orderbook at spread → simulate WebSocket price_change adding new ask levels → verify best ask stays at bottom
- Test market switch (tokenId change) → verify both sides reset and re-pin on new data arrival
