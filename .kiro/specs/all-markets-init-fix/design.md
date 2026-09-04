# All Markets Init Fix — Bugfix Design

## Overview

Three interrelated bugs cause visual glitches when navigating to an event with `?view=all-markets`:

1. **Empty charts**: `visibleMarketIds` is populated before `eventMarketsRaw` finishes loading, so `AllMarketsLineLayer` receives an empty `visibleMarkets` array and the dropdown shows "+" for every item.
2. **Header flash**: `MarketHeaderTrading`'s `stickyEventRef` retains the previous event's outcome label, causing a brief flash of stale text before the "All Markets" branch renders.
3. **Recurring crypto flash**: `isRecurringCryptoEventForAllMarkets()` fires _after_ `visibleMarketIds` is already set, producing a frame of All Markets UI before resetting to single-market mode.

The fix targets three files with minimal, surgical changes: reorder the recurring-crypto guard, gate `setVisibleMarketIds` on data readiness, and clear the sticky ref on navigation when `allMarketsMode` is active.

## Glossary

- **Bug_Condition (C)**: The set of inputs/states where navigating to `?view=all-markets` produces empty charts, a stale header flash, or a recurring-crypto UI flash
- **Property (P)**: The desired behavior — charts render only after data is ready, header shows "All Markets" immediately, recurring crypto never enters All Markets mode
- **Preservation**: Existing behaviors (dropdown +/− toggling, single-market view, outcome selection, chart color assignment) that must remain unchanged
- **`allMarketsMode`**: Boolean in `useWorkspaceLayoutStore` that activates multi-chart overlay mode
- **`visibleMarketIds`**: String array in `useWorkspaceLayoutStore` holding condition IDs of markets shown in the multi-chart
- **`eventMarketsRaw`**: The resolved array of `Market[]` for the current event, sourced from `fetchedEventForChart` or embedded `market.events[0].markets`
- **`eventMarketsForChart`**: Derived `EventMarketInfo[]` from `eventMarketsRaw` via `prepareSelectorMarkets` — used by `AllMarketsLineLayer`
- **`stickyEventRef`**: A `useRef` in `MarketHeaderTrading` that preserves the last event payload across sibling market switches to prevent layout shift
- **`isRecurringCryptoEventForAllMarkets()`**: Utility that checks if an event has a `"recurring"` tag, indicating 5m/15m/1h/4h crypto timeslot markets that should not use All Markets mode

## Bug Details

### Bug Condition

The bugs manifest when a user navigates (client-side or direct link) to an event URL with `?view=all-markets`. Three distinct failure modes share a common root: the `useEffect` in `TradingLayoutTerminal` that populates `visibleMarketIds` does not properly account for async data loading order and stale component state.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type NavigationEvent
  OUTPUT: boolean

  // Bug 1: Empty charts — visibleMarketIds set before data ready
  LET emptyChartsBug =
    input.urlHasAllMarketsParam
    AND input.allMarketsMode == true
    AND input.visibleMarketIds.length > 0
    AND input.eventMarketsForChart.length == 0

  // Bug 2: Header flash — stale stickyEventRef during navigation
  LET headerFlashBug =
    input.allMarketsMode == true
    AND input.conditionIdChanged == true
    AND input.stickyEventRef.slug != input.currentEvent.slug

  // Bug 3: Recurring crypto flash — allMarketsMode set before recurring check
  LET recurringFlashBug =
    input.urlHasAllMarketsParam
    AND input.eventIsRecurringCrypto == true
    AND input.allMarketsMode == true
    AND input.visibleMarketIds.length > 0

  RETURN emptyChartsBug OR headerFlashBug OR recurringFlashBug
END FUNCTION
```

### Examples

- **Bug 1 — Empty charts**: User clicks a GMP event link with `?view=all-markets`. `MarketTerminalShell` sets `allMarketsMode=true, visibleMarketIds=[]`. The `useEffect` in `TradingLayoutTerminal` fires, `eventMarketsRaw` is still `[]` (tRPC fetch pending), so `visibleMarketIds` stays empty. When `eventMarketsRaw` loads, `visibleMarketIds.length > 0` guard prevents re-population. Charts remain empty; dropdown shows "+" for all items.
- **Bug 2 — Header flash**: User is on Event A's market in All Markets mode. They navigate to Event B with `?view=all-markets`. `stickyEventRef` still holds Event A's data. For one render frame, the header shows Event A's outcome label before the `allMarketsMode` branch kicks in with "All Markets | Event B".
- **Bug 3 — Recurring crypto flash**: User navigates to a recurring crypto event (e.g., "BTC 5min Up/Down") with `?view=all-markets`. `MarketTerminalShell` sets `allMarketsMode=true`. The `useEffect` populates `visibleMarketIds` from `eventMarketsRaw`. On the _next_ render, `isRecurringCryptoEventForAllMarkets()` detects the `"recurring"` tag and calls `resetAllMarketsMode()`. For one frame, the All Markets UI (disabled orderbook, chart area) is visible before reverting.
- **Normal case (no bug)**: User navigates to a non-recurring GMP event with `?view=all-markets`, `eventMarketsRaw` loads with 6 markets, `visibleMarketIds` is populated with top 4 by yes price, charts render correctly. No bug condition.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Mouse clicks on outcome items in the dropdown must continue to switch to that market and exit All Markets mode
- The "+/−" toggle buttons in the dropdown must continue to add/remove individual charts from the multi-kline view
- `getDefaultVisibleMarkets()` must continue to select the top 4 active markets by yes price
- Color assignment via `assignMarketColors()` must continue to work for visible markets
- Single-market events (SMP) must continue to show standard single-market view
- The `removeVisibleMarket` action must continue to auto-exit All Markets mode when all markets are removed
- Recurring crypto events accessed without `?view=all-markets` must continue to show single-market view with crypto timeslot bar
- The orderbook must continue to be hidden when `allMarketsMode` is active and shown when it's not
- Chart type selection (line/candle), drawing tools, and interval selection must continue to work in single-market mode

**Scope:**
All inputs that do NOT involve the `?view=all-markets` URL parameter or the `allMarketsMode` store transition should be completely unaffected by this fix. This includes:
- Direct market navigation without `?view=all-markets`
- Sports event navigation (sports events don't use All Markets mode)
- Manual All Markets activation via the dropdown "All Markets" button (this path sets visibleMarketIds synchronously from already-loaded selectorItems)
- All orderbook, order form, and position management interactions

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **Race condition in `visibleMarketIds` population (Bug 1)**: The `useEffect` in `TradingLayoutTerminal` (lines ~180-195) has the guard `if (visibleMarketIds.length > 0) return;` which prevents re-population after the initial (possibly premature) attempt. However, the `MarketTerminalShell` sets `visibleMarketIds: []` on mount, and the `useEffect` only populates when `eventMarketsRaw.length >= 2`. The real issue is that when `eventMarketsRaw` loads _after_ the effect first runs, the effect re-runs but `visibleMarketIds.length > 0` may already be true from a stale previous event's IDs (persisted in Zustand). The `useEffect` that resets on `conditionId` change clears `visibleMarketIds` to `[]`, but there's a timing gap where the population effect and the reset effect interleave.

2. **Stale `stickyEventRef` across event boundaries (Bug 2)**: `MarketHeaderTrading` uses a ref-based sticky pattern to preserve event data across sibling market switches. This ref is never cleared when navigating to a _different_ event. When `allMarketsMode` is active, the component should bypass the sticky ref entirely and use the current event data, but the ref update happens in the render body before the `allMarketsMode` branch is evaluated.

3. **Late recurring-crypto guard (Bug 3)**: The `isRecurringCryptoEventForAllMarkets()` check is inside the same `useEffect` that populates `visibleMarketIds`. It only fires when `eventMarketsRaw.length >= 2`, meaning the recurring check is gated on data loading. If `eventDataForChart` (which carries the tags) is available before `eventMarketsRaw` loads, the check could run earlier. But the current code structure delays it.

4. **Zustand persist rehydration**: The `workspace-layout` store uses `persist` middleware. On navigation, the store may rehydrate with stale `allMarketsMode` and `visibleMarketIds` from a previous session, creating a brief inconsistent state before the shell's `useLayoutEffect` corrects it.

## Correctness Properties

Property 1: Bug Condition — visibleMarketIds only set when eventMarketsForChart is non-empty

_For any_ navigation to a `?view=all-markets` URL where `allMarketsMode` is true, the `setVisibleMarketIds` action SHALL only be called when `eventMarketsRaw.length >= 2` AND the derived `eventMarketsForChart` would produce a non-empty array, ensuring `AllMarketsLineLayer` always receives valid market data when `visibleMarketIds.length > 0`.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Recurring crypto events never enter All Markets mode with populated IDs

_For any_ navigation to a recurring crypto event (tagged `"recurring"`) with `?view=all-markets`, the system SHALL check `isRecurringCryptoEventForAllMarkets()` BEFORE calling `setVisibleMarketIds`, ensuring `allMarketsMode` is reset to false without any intermediate state where `visibleMarketIds.length > 0`.

**Validates: Requirements 2.4**

Property 3: Bug Condition — Header displays "All Markets" without stale flash on navigation

_For any_ client-side navigation where `allMarketsMode` is active and the `conditionId` changes (new event), the `MarketHeaderTrading` title pill SHALL display "All Markets | {event title}" without any intermediate render showing a previous event's outcome label.

**Validates: Requirements 2.3**

Property 4: Preservation — Non-All-Markets navigation unchanged

_For any_ navigation that does NOT include `?view=all-markets` and does NOT activate `allMarketsMode`, the fixed code SHALL produce exactly the same behavior as the original code, preserving single-market view, sports event handling, orderbook visibility, and all existing dropdown interactions.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/web/src/features/trading/components/trading-layout-terminal.tsx`

**Function**: `useEffect` that populates `visibleMarketIds` (~line 180-195)

**Specific Changes**:
1. **Early recurring-crypto guard**: Move the `isRecurringCryptoEventForAllMarkets()` check to run as soon as `eventDataForChart` is available (has tags), BEFORE the `eventMarketsRaw.length < 2` guard. This way, recurring crypto events are detected and `resetAllMarketsMode()` is called immediately, without waiting for market data to load.

2. **Gate on eventMarketsForChart readiness**: Add a check that `eventMarketsForChart.length > 0` (not just `eventMarketsRaw.length >= 2`) before calling `setVisibleMarketIds`. This ensures the derived chart data is actually available when IDs are set. Alternatively, since `eventMarketsForChart` is derived from `eventMarketsRaw` via `useMemo`, ensuring `eventMarketsRaw.length >= 2` should be sufficient — but adding `eventMarketsForChart` to the dependency array and checking its length provides a stronger guarantee.

3. **Clear stale visibleMarketIds on event change**: In the `useEffect` that resets on `conditionId` change, ensure `visibleMarketIds` is cleared to `[]` when setting `allMarketsMode: true` for a new event. The current code already does `useWorkspaceLayoutStore.setState({ visibleMarketIds: [] })` — verify this runs before the population effect.

---

**File**: `apps/web/src/features/trading/components/market/market-header-trading.tsx`

**Function**: `stickyEventRef` update logic (render body, ~line 50-65)

**Specific Changes**:
4. **Clear/bypass sticky ref when allMarketsMode is active during navigation**: When `allMarketsMode` is true and the current event slug differs from the sticky ref's slug, reset `stickyEventRef.current` to `undefined` (or directly to `currentEventData`). This prevents the stale ref from producing a flash of the previous outcome label. The key insight is that the sticky ref's purpose (preserving rich event data across _sibling_ market switches within the same event) is irrelevant during _cross-event_ navigation in All Markets mode.

---

**File**: `apps/web/src/features/trading/stores/workspace-layout.ts`

**Function**: No changes needed to the store itself — the store actions (`setAllMarketsMode`, `setVisibleMarketIds`, `resetAllMarketsMode`) are correct. The bugs are in the _consumers_ that call these actions with incorrect timing.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that simulate the state transitions in `useWorkspaceLayoutStore` and the `useEffect` execution order in `TradingLayoutTerminal`. Mock `eventMarketsRaw` loading delay and verify the store state at each step. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Empty Charts Race Condition**: Simulate `allMarketsMode=true`, `visibleMarketIds=[]`, `eventMarketsRaw=[]` → verify `visibleMarketIds` stays empty. Then set `eventMarketsRaw` to 4 markets → verify `visibleMarketIds` gets populated (will fail on unfixed code if timing is wrong)
2. **Recurring Crypto Flash**: Simulate `allMarketsMode=true`, `eventDataForChart` with `"recurring"` tag, `eventMarketsRaw` with 4 markets → verify `allMarketsMode` is reset BEFORE `visibleMarketIds` is populated (will fail on unfixed code)
3. **Header Stale Flash**: Simulate navigation from Event A to Event B with `allMarketsMode=true` → verify `stickyEventRef` does not produce Event A's outcome label (will fail on unfixed code)
4. **Cross-event navigation reset**: Simulate `conditionId` change with `?view=all-markets` → verify `visibleMarketIds` is cleared before re-population (may fail on unfixed code)

**Expected Counterexamples**:
- `visibleMarketIds` is populated with IDs that don't match any entry in `eventMarketsForChart`
- `allMarketsMode` is `true` with `visibleMarketIds.length > 0` for a recurring crypto event for at least one render frame
- Possible causes: effect execution order, stale closure over `eventMarketsRaw`, Zustand persist rehydration timing

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := applyFix(input)
  ASSERT result.visibleMarketIds.length == 0
         OR result.eventMarketsForChart.length > 0
  ASSERT NOT (result.eventIsRecurringCrypto AND result.allMarketsMode)
  ASSERT result.headerLabel == "All Markets"
         OR result.allMarketsMode == false
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
- It generates many combinations of event types (SMP, GMP, sports, crypto, recurring) and navigation paths
- It catches edge cases in store state transitions that manual unit tests might miss
- It provides strong guarantees that non-All-Markets flows are unchanged

**Test Plan**: Observe behavior on UNFIXED code first for non-All-Markets navigation, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Single-market preservation**: Verify that SMP events never activate All Markets mode, before and after fix
2. **Dropdown interaction preservation**: Verify that clicking an outcome exits All Markets mode and switches market, before and after fix
3. **+/− toggle preservation**: Verify that addVisibleMarket/removeVisibleMarket correctly update visibleMarketIds, before and after fix
4. **Sports event preservation**: Verify that sports events never enter All Markets mode, before and after fix

### Unit Tests

- Test `getDefaultVisibleMarkets()` with various market counts (0, 1, 2, 4, 10) and inactive markets
- Test `isRecurringCryptoEventForAllMarkets()` with various tag configurations
- Test `useWorkspaceLayoutStore` actions: `setAllMarketsMode`, `setVisibleMarketIds`, `resetAllMarketsMode`, `addVisibleMarket`, `removeVisibleMarket`
- Test the `visibleMarketIds` population logic with mocked `eventMarketsRaw` at different loading stages

### Property-Based Tests

- Generate random event configurations (market count, tags, active/inactive) and verify `visibleMarketIds` is only populated when `eventMarketsForChart` would be non-empty
- Generate random navigation sequences (event A → event B, with/without `?view=all-markets`) and verify no intermediate invalid store states
- Generate random recurring/non-recurring crypto events and verify `allMarketsMode` is never true with populated `visibleMarketIds` for recurring events

### Integration Tests

- Test full navigation flow: click GMP event link with `?view=all-markets` → verify charts render after data loads
- Test cross-event navigation: Event A (All Markets) → Event B (All Markets) → verify header shows correct title without flash
- Test recurring crypto navigation: navigate to recurring crypto with `?view=all-markets` → verify immediate reset to single-market mode without UI flash
