# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Chart Font Drift & Default State Bugs
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the five bug conditions
  - **Scoped PBT Approach**: Scope properties to concrete failing cases for each bug condition
  - Test file: `tests/unit/chart-font-resize-bugs.test.ts`
  - **Bug 1 (Resize font drift)**: Mock a klinecharts `Chart` instance. Apply styles with `AXIS_FONT_SIZE=12` via `getKlineChartStyles()`. Simulate ResizeObserver firing `chart.resize()` multiple times. Assert `yAxis.tickText.size` remains 12 after each resize. On unfixed code, klinecharts resets styles internally after `resize()` and the ResizeObserver callback in Effect 1 does not re-apply `setStyles()`, so font size drifts.
  - **Bug 2 (Mode+side toggle race)**: Simulate rapid `chartType` change (triggering Effect 4 `setStyles()`) followed by `tokenId` change (triggering Effect 2 `setPeriod()` data reload). Assert axis font size is consistent after both effects settle. On unfixed code, Effect 2 overwrites Effect 4's style application.
  - **Bug 3 (Default height toolbar cutoff)**: Assert `CHART_HEIGHT_DEFAULT` from `workspace-layout.ts` is >= 65. On unfixed code, `CHART_HEIGHT_DEFAULT` is 55, which clips the toolbar on viewports <= 1080p.
  - **Bug 4 (Wrong default chart mode)**: Import `PolymarketKLineChartInner` and verify the default `chartType` prop is `"line"`. On unfixed code, the default is `"candle"`.
  - **Bug 5 (Preference hydration race)**: Assert that `useWorkspaceLayoutStore` contains a `chartType` field. On unfixed code, chart type lives in a separate `useSyncExternalStore` mechanism, not in the zustand store.
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bugs exist)
  - Document counterexamples found to understand root cause
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Chart Interactions Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `tests/unit/chart-font-resize-preservation.test.ts`
  - Observe: `getKlineChartStyles("dark")` returns `yAxis.tickText.size === 12` and `xAxis.tickText.size === 12` on unfixed code
  - Observe: `getKlineChartStyles("light")` returns identical axis font sizes on unfixed code
  - Observe: `CHART_HEIGHT_DEFAULT` is used as the initial `chartHeight` in the zustand store on unfixed code
  - Observe: `intervalToPeriod()` correctly maps each `IntervalValue` to a klinecharts `Period` on unfixed code
  - Observe: `getChartTypeSnapshot()` returns `"line"` when no localStorage entry exists on unfixed code
  - Observe: `useWorkspaceLayoutStore` persists and restores `panelOrder`, `orderbookWidthPct`, `chartHeight`, `activeTab` on unfixed code
  - Write property-based tests:
    - For all themes in `["light", "dark"]`, `getKlineChartStyles(theme)` returns `xAxis.tickText.size === 12` and `yAxis.tickText.size === 12` (from Preservation Requirements 3.1)
    - For all valid intervals, `intervalToPeriod()` returns a valid `Period` object (from Preservation Requirements 3.2)
    - The workspace-layout store v0→v1 migration correctly bumps `chartHeight` from 45 to 55 (existing migration behavior, Preservation Requirements 3.6, 3.7)
    - `getChartTypeSnapshot()` returns `"candle"` when localStorage has `"candle"`, returns `"line"` when localStorage has `"line"` or is empty (Preservation Requirements 3.1)
  - Verify tests pass on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix chart font resize and default state bugs

  - [x] 3.1 Re-apply styles after chart.resize() in ResizeObserver callback (Effect 1)
    - In `polymarket-kline-chart-inner.tsx`, Effect 1's ResizeObserver callback currently calls `chart.resize()` without re-applying styles
    - After `chart.resize()`, add `chart.setStyles(getKlineChartStyles(themeRef.current))` with candle type from `chartTypeRef.current`
    - Use existing `chartTypeRef` and add a `themeRef` (or use the existing theme closure) to access current values without adding effect dependencies
    - This ensures klinecharts' internal resize re-layout cannot reset `yAxis.tickText.size` from 12 to its default
    - _Bug_Condition: isBugCondition(input) where input.type == "resize_drag" AND ResizeObserver fires chart.resize() AND styles not re-applied_
    - _Expected_Behavior: yAxis.tickText.size == 12 AND xAxis.tickText.size == 12 after every resize_
    - _Preservation: Normal chart pan/zoom/scroll interactions must continue to work with correct 12px axis fonts_
    - _Requirements: 2.1, 3.1_

  - [x] 3.2 Guard Effect 4 style application against Effect 2 data reload race
    - In `polymarket-kline-chart-inner.tsx`, Effect 4 calls `chart.setStyles()` on `[chartType, theme]` change, but Effect 2 can fire concurrently and overwrite styles via `setPeriod()` data reload
    - Add a `requestAnimationFrame` follow-up after `chart.setStyles()` in Effect 4 to re-assert styles after any concurrent Effect 2 data reload settles
    - Alternatively, use a stable ref flag (e.g., `stylesPendingRef`) that Effect 2's data-load completion callback checks, re-applying styles if the flag is set
    - This prevents the font glitch when toggling candle/line mode and Yes/No side in quick succession
    - _Bug_Condition: isBugCondition(input) where input.type == "chart_type_change" OR "side_switch" AND Effect2 and Effect4 race_
    - _Expected_Behavior: axisFontSizeConsistent == true after both effects settle_
    - _Preservation: Time interval switching, drawing tools, indicators, WS updates must continue to work correctly_
    - _Requirements: 2.2, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.3 Change default chartType prop from "candle" to "line"
    - In `polymarket-kline-chart-inner.tsx`, change the destructured default `chartType = "candle"` to `chartType = "line"`
    - This aligns the inner component's default with `getChartTypeSnapshot()`'s fallback, preventing a flash of candle mode on first visit
    - _Bug_Condition: isBugCondition(input) where input.type == "first_visit" AND no localStorage "doji-chart-type" entry_
    - _Expected_Behavior: chartType == "line" from the very first render frame_
    - _Preservation: Existing chart type toggle behavior must continue to work_
    - _Requirements: 2.4_

  - [x] 3.4 Bump CHART_HEIGHT_DEFAULT from 55 to 65 with migration
    - In `workspace-layout.ts`, change `CHART_HEIGHT_DEFAULT = 55` to `CHART_HEIGHT_DEFAULT = 65`
    - Bump the persist `version` from 1 to 2
    - Add a v1→v2 migration: if `version === 1 && state.chartHeight === 55`, set `state.chartHeight = CHART_HEIGHT_DEFAULT` (65)
    - Keep the existing v0→v1 migration intact (bumps 45→55, which will now effectively become 45→65 for v0 users via chained migration)
    - _Bug_Condition: isBugCondition(input) where input.type == "initial_load" AND chartHeight == 55_
    - _Expected_Behavior: toolbarFullyVisible == true on viewports >= 768px tall_
    - _Preservation: Users who manually set a custom height must not have it overwritten_
    - _Requirements: 2.3_

  - [x] 3.5 Unify chart-type persistence into zustand workspace-layout store
    - In `workspace-layout.ts`, add `chartType: "candle" | "line"` (default `"line"`) and `setChartType: (type) => void` to the store interface and implementation
    - In the v1→v2 migration, read `localStorage.getItem("doji-chart-type")` and set `state.chartType` accordingly, then `localStorage.removeItem("doji-chart-type")` to clean up
    - In `polymarket-kline-chart.tsx`, replace the `useSyncExternalStore` / `CHART_TYPE_STORAGE_KEY` / `subscribeChartType` / `getChartTypeSnapshot` / `notifyChartTypeListeners` mechanism with `useWorkspaceLayoutStore(s => s.chartType)` and `useWorkspaceLayoutStore(s => s.setChartType)`
    - Remove the `CHART_TYPE_STORAGE_KEY` constant, `chartTypeListeners` set, `notifyChartTypeListeners`, `subscribeChartType`, `getChartTypeSnapshot`, and `getServerChartTypeSnapshot` functions
    - This ensures both chartHeight and chartType hydrate atomically via zustand-persist
    - _Bug_Condition: isBugCondition(input) where input.type == "return_visit" AND zustand hydrates before useSyncExternalStore_
    - _Expected_Behavior: chartType == savedChartType AND chartHeight == savedChartHeight on first render_
    - _Preservation: Chart type toggle UI must continue to work; theme switching must continue to recreate chart with correct styles_
    - _Requirements: 2.5, 3.1, 3.7_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Chart Font Drift & Default State Bugs
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1: `tests/unit/chart-font-resize-bugs.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Chart Interactions Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2: `tests/unit/chart-font-resize-preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run `pnpm test:unit` to verify all unit tests pass
  - Run `pnpm check-types` to verify no type errors were introduced
  - Run `pnpm fix` to ensure code formatting compliance
  - Ensure all tests pass, ask the user if questions arise.
