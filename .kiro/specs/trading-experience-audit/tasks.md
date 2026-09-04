# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Trade Record Wrong Side & Portfolio Badge Stale
  - **CRITICAL**: These tests MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior - they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate both bug conditions
  - **Scoped PBT Approach**: Scope properties to concrete failing cases for each bug
  - Test file: `tests/unit/trading-experience-audit-exploration.test.ts`
  - **Bug 1 (Wrong Side - Resting BUY)**: Call `tradeRecordFromEvent(event, "BUY")` where `event.side = "SELL"` (resting limit BUY filled by taker SELL). Assert `record.side === "BUY"`. On unfixed code, `tradeRecordFromEvent` has no `effectiveSide` parameter, so it always returns `event.side` ("SELL") — test FAILS.
  - **Bug 1 (Wrong Side - Resting SELL)**: Call `tradeRecordFromEvent(event, "SELL")` where `event.side = "BUY"`. Assert `record.side === "SELL"`. On unfixed code, returns "BUY" — test FAILS.
  - **Bug 2 (Stale Badge)**: Call `applyTrade` on `usePositionsStore` to add a local position, then verify `tradeRecordFromEvent` records the correct side (this is the observable unit-level symptom). For the hook-level badge staleness, verify that `usePortfolioData` does not import or subscribe to `usePositionsStore` — on unfixed code, it doesn't.
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests FAIL (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when tests are written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Market Order Trade Records & Portfolio Non-Badge Data
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `tests/unit/trading-experience-audit-preservation.test.ts`
  - Observe: `tradeRecordFromEvent(event)` with no `effectiveSide` returns `side: event.side` on unfixed code (correct for market orders)
  - Observe: `tradeRecordFromEvent(event)` preserves all other fields (`id`, `asset_id`, `market`, `size`, `price`, `status`, `outcome`, `txHash`) on unfixed code
  - Observe: `applyTradeToPositions(positions, event, effectiveSide)` correctly uses `effectiveSide` for size math on unfixed code
  - Write property-based tests:
    - For all `UserTradeEvent` inputs with no `effectiveSide`, `tradeRecordFromEvent(event)` returns `side === event.side` (from Preservation Requirements 3.1)
    - For all `UserTradeEvent` inputs, all non-side fields of `TradeRecord` match the event fields (from Preservation Requirements 3.1)
    - For all positions + events, `applyTradeToPositions` BUY adds size and SELL subtracts size (from Preservation Requirements 3.2)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 3. Fix trade record wrong side and portfolio badge stale bugs

  - [x] 3.1 Add `effectiveSide` parameter to `tradeRecordFromEvent` and update call site
    - In `apps/web/src/stores/positions.ts`, change `tradeRecordFromEvent(event: UserTradeEvent)` to `tradeRecordFromEvent(event: UserTradeEvent, effectiveSide?: "BUY" | "SELL")`
    - Change `side: event.side` to `side: effectiveSide ?? event.side` in the returned object
    - In the `applyTrade` action, change `tradeRecordFromEvent(event)` to `tradeRecordFromEvent(event, effectiveSide)`
    - _Bug_Condition: isBugCondition_WrongSide(X) where X.effectiveSide IS NOT undefined AND X.effectiveSide ≠ X.event.side_
    - _Expected_Behavior: record.side = effectiveSide when provided, event.side otherwise_
    - _Preservation: Market orders (no effectiveSide) produce identical TradeRecord as before_
    - _Requirements: 2.1, 2.2, 3.1, 3.2_

  - [x] 3.2 Subscribe `usePortfolioData` to local positions store for augmented badge count
    - In `apps/web/src/app/portfolio/use-portfolio-data.ts`, add `import { usePositionsStore } from "@/stores/positions"` and `import { CLOB_SIZE_DISPLAY_THRESHOLD } from "@doji/types"`
    - Add `const localPositions = usePositionsStore((s) => s.positions)` inside the hook
    - Compute augmented `positionsCount`: count local positions whose `asset` is not already in the API `positions` array, filter by `Math.abs(size) >= CLOB_SIZE_DISPLAY_THRESHOLD`, add to `positions.length`
    - Return the augmented count as `positionsCount` instead of `positions.length`
    - _Bug_Condition: isBugCondition_StaleBadge(X) where X.dataApiCount ≠ X.localPositionsCount_
    - _Expected_Behavior: positionsCount incorporates local positions not yet in API response_
    - _Preservation: All non-positionsCount return values remain identical; no double-counting_
    - _Requirements: 2.3, 2.4, 3.3, 3.5_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Trade Record Wrong Side & Portfolio Badge Stale
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1: `tests/unit/trading-experience-audit-exploration.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** - Market Order Trade Records & Portfolio Non-Badge Data
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2: `tests/unit/trading-experience-audit-preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `pnpm test:unit` to verify all unit tests pass
  - Run `pnpm check-types` to verify no type errors were introduced
  - Run `pnpm fix` to ensure code formatting compliance
  - Ensure all tests pass, ask the user if questions arise.
