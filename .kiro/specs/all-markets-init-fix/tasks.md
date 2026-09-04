# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — All Markets Init Race Conditions
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the three interrelated bugs
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases:
    - Bug 1 (Empty Charts): Simulate `allMarketsMode=true`, `visibleMarketIds=[]`, then `eventMarketsRaw` loads with 4+ markets. Assert `setVisibleMarketIds` is only called when `eventMarketsForChart` would produce a non-empty array. On unfixed code, `visibleMarketIds` may be populated before chart data is ready (or not populated at all due to stale IDs from a previous event).
    - Bug 2 (Header Flash): Simulate navigation from Event A to Event B with `allMarketsMode=true`. Assert `stickyEventRef` in `MarketHeaderTrading` does not produce Event A's outcome label when the current event slug is Event B's slug. On unfixed code, the stale ref causes a flash.
    - Bug 3 (Recurring Crypto Flash): Simulate `allMarketsMode=true`, `eventDataForChart` with `tags: [{ slug: "recurring" }]`, `eventMarketsRaw` with 4 markets. Assert `isRecurringCryptoEventForAllMarkets()` is checked BEFORE `setVisibleMarketIds` is called. On unfixed code, `visibleMarketIds` is populated first, then `resetAllMarketsMode()` fires on the next render.
  - Test file: `tests/unit/all-markets-init-fix.test.ts`
  - Test the `useEffect` logic from `trading-layout-terminal.tsx` (~line 180-195) by extracting the population logic into a testable pure function or by testing the Zustand store state transitions
  - Test the `stickyEventRef` behavior in `market-header-trading.tsx` by simulating the ref update logic
  - Run test on UNFIXED code — expect FAILURE (this confirms the bugs exist)
  - Document counterexamples found (e.g., "`visibleMarketIds` populated with IDs that don't match `eventMarketsForChart`", "`allMarketsMode=true` with populated IDs for recurring crypto event")
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Non-All-Markets Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code**:
    - `isRecurringCryptoEventForAllMarkets({ tags: [{ slug: "recurring" }] })` returns `true`
    - `isRecurringCryptoEventForAllMarkets({ tags: [{ slug: "crypto" }] })` returns `false`
    - `isRecurringCryptoEventForAllMarkets(null)` returns `false`
    - `getDefaultVisibleMarkets(selectorItems)` returns top 4 active markets by yes price
    - `resetAllMarketsMode()` sets `{ allMarketsMode: false, visibleMarketIds: [] }`
    - `removeVisibleMarket(lastId)` when only 1 visible market → auto-exits All Markets mode
    - `addVisibleMarket(id)` appends to `visibleMarketIds` without duplicates
    - `setAllMarketsMode(true)` only sets the boolean, does not touch `visibleMarketIds`
  - Write property-based tests capturing observed behavior patterns:
    - For all non-recurring events with 2+ markets, `getDefaultVisibleMarkets` returns at most 4 condition IDs, all from active markets, sorted by descending yes price
    - For all store actions (`addVisibleMarket`, `removeVisibleMarket`, `resetAllMarketsMode`), the state transitions match the observed behavior on unfixed code
    - For all events without `?view=all-markets`, `allMarketsMode` remains `false` and `visibleMarketIds` remains `[]`
    - For single-market events (SMP), All Markets mode is never activated
  - Test file: `tests/unit/all-markets-init-preservation.test.ts`
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix All Markets init race conditions

  - [x] 3.1 Fix visibleMarketIds population timing in trading-layout-terminal.tsx
    - In the `useEffect` that populates `visibleMarketIds` (~line 180-195):
      1. Move `isRecurringCryptoEventForAllMarkets(eventDataForChart)` check to fire FIRST, before the `eventMarketsRaw.length < 2` guard — this way recurring crypto events are detected immediately when `eventDataForChart` has tags, without waiting for market data
      2. Gate `setVisibleMarketIds` on `eventMarketsForChart.length > 0` (not just `eventMarketsRaw.length >= 2`) to ensure derived chart data is actually available when IDs are set
      3. Add `eventMarketsForChart` to the `useEffect` dependency array
    - _Bug_Condition: isBugCondition(input) where input.urlHasAllMarketsParam AND (input.eventMarketsForChart.length == 0 OR input.eventIsRecurringCrypto)_
    - _Expected_Behavior: visibleMarketIds only populated when eventMarketsForChart is non-empty; recurring crypto detected before population_
    - _Preservation: All non-All-Markets navigation paths, dropdown +/− toggling, single-market view unchanged_
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.4_

  - [x] 3.2 Fix stale stickyEventRef flash in market-header-trading.tsx
    - In the `stickyEventRef` update logic in the render body (~line 50-65):
      1. When `allMarketsMode` is active AND the current event slug differs from `stickyEventRef.current?.slug`, clear `stickyEventRef.current` to `undefined` (or set it directly to `currentEventData`)
      2. This prevents the stale ref from producing a flash of the previous event's outcome label during cross-event navigation
    - The sticky ref's purpose (preserving rich event data across sibling market switches within the same event) is irrelevant during cross-event navigation in All Markets mode
    - _Bug_Condition: isBugCondition(input) where input.allMarketsMode AND input.stickyEventRef.slug != input.currentEvent.slug_
    - _Expected_Behavior: Header displays "All Markets | {event title}" without stale flash_
    - _Preservation: Sibling market switches within the same event still preserve rich event data via sticky ref_
    - _Requirements: 1.3, 2.3_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — All Markets Init Race Conditions
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** — Non-All-Markets Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `pnpm test:unit`
  - Ensure all tests pass, ask the user if questions arise.
