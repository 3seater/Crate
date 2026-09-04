# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Position Size Formatting (10^6 Division Bug)
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Generate random positive integers (1 to 10^8) as position sizes and assert that `formatPositionSize(size)` produces correct compact notation WITHOUT dividing by 10^6
  - Test file: `tests/unit/comments-position-size.test.ts`
  - Property: for all `size` where `size > 0`:
    - If `size >= 1_000_000` → result matches `/^\d+(\.\d)?M$/`
    - If `size >= 1_000` → result matches `/^\d+(\.\d)?K$/`
    - If `size < 1_000` → result matches `/^\d+$/`
  - Concrete scoped cases from Bug Condition in design:
    - `formatPositionSize(354821)` → expect "354.8K" (unfixed returns "0")
    - `formatPositionSize(1500)` → expect "1.5K" (unfixed returns "0")
    - `formatPositionSize(56)` → expect "56" (unfixed returns "0")
    - `formatPositionSize(2500000)` → expect "2.5M" (unfixed returns "2.5")
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (all values are 10^6 too small due to erroneous division)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 2.1_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Current Market Badge & Empty Position Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `tests/unit/comments-position-preservation.test.ts`
  - Observe behavior on UNFIXED code for non-buggy inputs:
    - Observe: `matchPosition([{tokenId: yesTokenId, positionSize: "1000"}], yesTokenId, noTokenId, "Yes", "No")` returns `{side: "yes", size: 1000, outcomeLabel: "Yes"}`
    - Observe: `matchPosition([{tokenId: noTokenId, positionSize: "500"}], yesTokenId, noTokenId, "Yes", "No")` returns `{side: "no", size: 500, outcomeLabel: "No"}`
    - Observe: `matchPosition([], yesTokenId, noTokenId, "Yes", "No")` returns `null`
    - Observe: `matchPosition([{tokenId: null, positionSize: null}], yesTokenId, noTokenId, "Yes", "No")` returns `null`
    - Observe: `matchPosition([{tokenId: "other", positionSize: "100"}], yesTokenId, noTokenId, "Yes", "No")` returns `null`
  - Write property-based tests:
    - Property: for all positions where tokenId matches yesTokenId, `matchPosition` returns `{side: "yes", size: Number(positionSize), outcomeLabel: yesLabel}`
    - Property: for all positions where tokenId matches noTokenId, `matchPosition` returns `{side: "no", size: Number(positionSize), outcomeLabel: noLabel}`
    - Property: for all empty position arrays or arrays with null tokenIds, `matchPosition` returns `null`
    - Property: for all positions with size 0 or negative, badge should not render (size <= 0 → no badge)
  - Verify tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix position badge bugs

  - [x] 3.1 Fix `formatPositionSize` — remove 10^6 division
    - In `apps/web/src/domains/trading/components/market/comments-utils.ts`
    - Remove the line `const size = rawSize / 1_000_000;` and use `rawSize` directly
    - Format the input number as-is: ≥1M → "X.YM", ≥1K → "X.YK", <1K → integer string
    - Remove the misleading comment about "micro-units"
    - _Bug_Condition: isBugCondition_Formatting(X) where X.positionSize IS NOT NULL AND Number(X.positionSize) > 0_
    - _Expected_Behavior: formatPositionSize'(size) produces compact notation without 10^6 division_
    - _Preservation: matchPosition behavior for current-market tokens unchanged_
    - _Requirements: 1.1, 2.1_

  - [x] 3.2 Add `buildTokenMarketMap` utility
    - In `apps/web/src/domains/trading/components/market/comments-utils.ts`
    - Create and export `buildTokenMarketMap(markets: Market[]): Map<string, { marketName: string; side: "yes" | "no" }>`
    - For each market, extract tokens (yes at index 0, no at index 1) and map each token_id to the market's `groupItemTitle` or `question` and the token's side
    - _Bug_Condition: isBugCondition_MarketName(X) where tokenId ≠ currentYesTokenId AND tokenId ≠ currentNoTokenId_
    - _Expected_Behavior: Non-current-market positions resolve to market name via tokenMarketMap_
    - _Requirements: 1.2, 2.2_

  - [x] 3.3 Redesign `PositionBadge` component
    - In `apps/web/src/domains/trading/components/market/position-badge.tsx`
    - Accept new props: `positions: CommentPosition[]`, `tokenMarketMap: Map<string, { marketName: string; side: "yes" | "no" }>`, plus existing current-market props
    - Resolve all positions with non-null tokenId and positive size using tokenMarketMap
    - Sort resolved positions by size descending; show largest as primary badge
    - For non-current-market positions: show market name + size
    - For current-market positions: show size + outcome label (existing color logic preserved)
    - When multiple positions exist: add ChevronDown icon that opens a Popover listing all positions sorted by size (each row: market name, formatted size, Yes/No outcome pill)
    - _Bug_Condition: hasMultiplePositions OR hasNonCurrentMarketPosition_
    - _Expected_Behavior: Largest position shown as primary badge with chevron dropdown for all positions_
    - _Preservation: Current-market single-position badges retain same color/label behavior_
    - _Requirements: 1.2, 1.3, 1.4, 2.2, 2.3, 2.4, 3.1, 3.4_

  - [x] 3.4 Pass event markets from `MarketTabs` → `Comments`
    - In `apps/web/src/domains/trading/components/market/market-tabs.tsx`
    - Pass `allEventMarkets` (from `useAllMarketsTabEventData`) as a prop to the `Comments` component
    - In `apps/web/src/domains/trading/components/market/comments.tsx`
    - Accept `eventMarkets?: Market[]` in `CommentsProps` and thread it down to `Bubble`
    - Build `tokenMarketMap` via `buildTokenMarketMap(eventMarkets)` (memoized)
    - _Requirements: 1.2, 2.2_

  - [x] 3.5 Replace fallback badge logic in `Bubble` with new `PositionBadge`
    - In `apps/web/src/domains/trading/components/market/comments.tsx` (`Bubble` component)
    - Remove `badgePosition` / `fallbackPosition` logic
    - Replace with single `<PositionBadge positions={comment.positions} tokenMarketMap={tokenMarketMap} ... />` that handles all logic internally
    - _Bug_Condition: All positions now handled by redesigned PositionBadge_
    - _Expected_Behavior: Largest position shown, dropdown for all, market names resolved_
    - _Preservation: Current-market badges unchanged in appearance_
    - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.1, 3.4_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Position Size Formatting
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Current Market Badge & Empty Position Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `pnpm test:unit --run`
  - Ensure exploration test (task 1) passes after fix
  - Ensure preservation tests (task 2) still pass after fix
  - Run `pnpm check-types` to verify no type errors introduced
  - Ask the user if questions arise
