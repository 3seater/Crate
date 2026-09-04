# Chart Font / Resize / Defaults Bugfix Design

## Overview

Five interrelated bugs in the trading terminal chart degrade visual consistency and user preference reliability. The Y-axis font size drifts during height-divider drags because `chart.resize()` (triggered by ResizeObserver) causes klinecharts to re-layout without re-applying the explicit `AXIS_FONT_SIZE = 12` style. A similar font glitch occurs when toggling candle/line mode races with the Yes/No side-switch data reload (Effect 4 vs Effect 2). The default chart height (55%) is too short for the 12-item left toolbar, the default chart mode is "candle" instead of "line", and the two independent persistence mechanisms (zustand-persist for height, raw localStorage + `useSyncExternalStore` for chart type) don't hydrate atomically, causing preference loss on revisit.

The fix strategy is: (1) re-apply styles after every `chart.resize()`, (2) guard Effect 4 style application with a stable ref so it can't race with Effect 2, (3) bump `CHART_HEIGHT_DEFAULT` to 65, (4) align the default parameter in `PolymarketKLineChartInner` to `"line"`, and (5) unify chart-type persistence into the existing zustand workspace-layout store.

## Glossary

- **Bug_Condition (C)**: Any of the five trigger conditions described below — resize drag, candle/line + side toggle race, initial load with default height, first-visit chart mode, or preference restoration
- **Property (P)**: The desired behavior — consistent 12px axis font, full toolbar visibility, "line" default, reliable preference hydration
- **Preservation**: Existing chart interactions (pan, zoom, scroll, WS updates, drawing tools, indicators, interval switching, orderbook resize, column swap) must remain unchanged
- **`getKlineChartStyles()`**: Function in `kline-chart-theme.ts` that returns the full klinecharts `DeepPartial<Styles>` object including `AXIS_FONT_SIZE = 12`
- **Effect 1**: Chart instance lifecycle effect in `polymarket-kline-chart-inner.tsx` — creates/disposes chart on theme change, sets up ResizeObserver
- **Effect 2**: Data loader + WS subscription effect — re-runs on `tokenId`, `closed`, `theme`, `assetIds` changes
- **Effect 4**: Chart type / theme style sync effect — applies `setStyles()` on `chartType` or `theme` change
- **`CHART_HEIGHT_DEFAULT`**: Constant in `workspace-layout.ts` controlling initial chart height percentage
- **`useSyncExternalStore`**: React hook used in `polymarket-kline-chart.tsx` to read chart type from raw localStorage

## Bug Details

### Bug Condition

The bugs manifest across five distinct trigger conditions that share a common theme: chart styling state is not robustly maintained across lifecycle events.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type ChartInteraction
  OUTPUT: boolean

  // Bug 1: Font drift on resize drag
  IF input.type == "resize_drag"
     AND input.source == "height_divider"
     AND ResizeObserver fires chart.resize()
     AND styles not re-applied after resize
  THEN RETURN true

  // Bug 2: Font glitch on candle/line + side toggle
  IF input.type == "chart_type_change" OR input.type == "side_switch"
     AND Effect2 and Effect4 execute concurrently
     AND style application races with data reload
  THEN RETURN true

  // Bug 3: Toolbar cutoff at default height
  IF input.type == "initial_load"
     AND chartHeight == CHART_HEIGHT_DEFAULT (55)
     AND toolbarItemCount * itemHeight > availableHeight
  THEN RETURN true

  // Bug 4: Wrong default chart mode
  IF input.type == "first_visit"
     AND localStorage has no "doji-chart-type" entry
     AND PolymarketKLineChartInner receives chartType="candle"
  THEN RETURN true

  // Bug 5: Preference restoration failure
  IF input.type == "return_visit"
     AND zustand hydrates chartHeight before useSyncExternalStore resolves chartType
     AND inner component mounts with default "candle" before localStorage read completes
  THEN RETURN true

  RETURN false
END FUNCTION
```

### Examples

- **Bug 1**: User drags height divider from 55% to 40%. During the drag, ResizeObserver fires ~60 times. On frames 12, 27, and 45, the Y-axis tick text renders at klinecharts' internal default (~11px) instead of the configured 12px, causing visible jitter.
- **Bug 2**: User clicks "Line" mode, then immediately clicks "No" side. Effect 4 calls `chart.setStyles()` while Effect 2 is mid-`setPeriod()` data reload. The style application is overwritten by klinecharts' internal re-layout during data load, leaving axis text at wrong size until next full re-render.
- **Bug 3**: On a 1080p display (viewport ~900px usable height), 55% = ~495px for the chart area. The left toolbar has 1 pointer + 5 tool groups + 3 utilities + 1 eraser = 10 buttons at 32px + 3 dividers at ~5px = ~335px. With the top bar (~36px), the chart canvas is ~460px but the toolbar container is constrained by the chart slot's `overflow-hidden`, cutting off the bottom eraser button.
- **Bug 4**: New user visits the trading page. `getChartTypeSnapshot()` returns `"line"` (correct), but `PolymarketKLineChartInner` has `chartType = "candle"` as its default prop. During SSR/hydration, the inner component renders with candles before the `useSyncExternalStore` hook resolves.
- **Bug 5**: User sets chart to line mode and drags height to 70%. On next visit, zustand-persist hydrates `chartHeight: 70` synchronously, but `useSyncExternalStore` for chart type resolves asynchronously. The inner component briefly mounts with `chartType="candle"` (the default prop) before switching to "line", causing a flash of candles and a wasted Effect 4 cycle.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Chart pan, zoom, and scroll interactions must continue to work with correct 12px axis fonts
- Time interval switching (1H, 4H, 1D, 1W, Max) must continue to reload data and update period correctly
- Drawing tools from the left toolbar must continue to create and display overlays correctly
- Indicator toggles (MA, EMA, MACD, RSI, etc.) must continue to add/remove panes and overlays
- Real-time WebSocket price updates must continue to update the last candle/area point and sonar ring
- Orderbook width resize via vertical handle must continue to adjust grid layout and trigger chart resize
- Drag-to-swap chart/orderbook columns must continue to animate via FLIP and persist panel order
- Theme switching (light/dark) must continue to recreate the chart instance with correct styles

**Scope:**
All inputs that do NOT involve the five bug conditions should be completely unaffected by this fix. This includes:
- Normal chart rendering and data display
- Mouse/touch interactions within the chart canvas
- Keyboard shortcuts and accessibility features
- Mobile layout rendering
- Market header and trading form functionality

## Hypothesized Root Cause

Based on code analysis, the root causes are:

1. **Font Drift on Resize (Bug 1)**: In Effect 1, the `ResizeObserver` callback calls `chart.resize()` but does not re-apply `chart.setStyles(getKlineChartStyles(theme))` afterward. The klinecharts library's internal resize logic resets some style properties to its own defaults, causing `yAxis.tickText.size` to intermittently revert from 12 to the library default.

2. **Font Glitch on Mode + Side Toggle (Bug 2)**: Effect 4 (depends on `[chartType, theme]`) and Effect 2 (depends on `[tokenId, closed, theme, assetIds]`) can fire in the same React commit when the user toggles chart type and then switches Yes/No side. Effect 2 calls `chart.setPeriod()` which triggers an internal data reload and re-layout that can overwrite the styles Effect 4 just applied. There is no coordination between these effects.

3. **Toolbar Cutoff (Bug 3)**: `CHART_HEIGHT_DEFAULT = 55` in `workspace-layout.ts` allocates insufficient vertical space. The left toolbar in `KlineLeftToolbar` renders 10 buttons (32px each) + 3 dividers (~5px each) = ~335px minimum. At 55% of a 900px viewport, the chart slot is ~495px, but after the top bar and borders, the available height for the toolbar is tight enough to clip the bottom items on common displays.

4. **Wrong Default Mode (Bug 4)**: `PolymarketKLineChartInner` declares `chartType = "candle"` as its default prop value. While `getChartTypeSnapshot()` correctly returns `"line"` for new users (no localStorage entry), the `useSyncExternalStore` hook in the parent `PolymarketKLineChart` may not resolve before the inner component's first render via `dynamic()` import, causing the default prop to take effect.

5. **Preference Hydration Race (Bug 5)**: Chart height uses zustand-persist (synchronous hydration from localStorage on store creation), while chart type uses a separate `useSyncExternalStore` + raw `localStorage.getItem()`. These two mechanisms hydrate at different times. The zustand store is ready before React renders, but `useSyncExternalStore` resolves during render, creating a window where the inner component receives the persisted height but the default chart type.

## Correctness Properties

Property 1: Bug Condition - Font Size Consistency During Resize

_For any_ chart resize event triggered by the height divider drag (where `isBugCondition` returns true for resize_drag), the fixed code SHALL maintain `yAxis.tickText.size` and `xAxis.tickText.size` at exactly `AXIS_FONT_SIZE` (12) throughout the entire resize operation, with no frames showing a different font size.

**Validates: Requirements 2.1**

Property 2: Bug Condition - Font Size Consistency During Mode/Side Toggle

_For any_ combination of chart type toggle (candle↔line) and Yes/No side switch (where `isBugCondition` returns true for chart_type_change or side_switch), the fixed code SHALL maintain consistent axis font sizes with no transient glitches, by ensuring style application is not overwritten by concurrent data reloads.

**Validates: Requirements 2.2**

Property 3: Bug Condition - Default Height Shows Full Toolbar

_For any_ initial page load with no persisted chart height preference, the fixed code SHALL use a `CHART_HEIGHT_DEFAULT` value that provides sufficient vertical space for the complete left toolbar (all 10 buttons + 3 dividers) to be visible without clipping on viewports ≥ 768px tall.

**Validates: Requirements 2.3**

Property 4: Bug Condition - Default Chart Mode Is Line

_For any_ first visit with no persisted chart type preference, the fixed code SHALL render the chart in line mode from the very first frame, with no flash of candle mode.

**Validates: Requirements 2.4**

Property 5: Bug Condition - Reliable Preference Restoration

_For any_ return visit where the user previously set chart height and chart type preferences, the fixed code SHALL restore both preferences atomically before the chart renders, so the chart appears exactly as the user left it.

**Validates: Requirements 2.5**

Property 6: Preservation - Existing Chart Interactions Unchanged

_For any_ input where the bug condition does NOT hold (normal pan, zoom, scroll, interval switch, drawing tools, indicators, WS updates, orderbook resize, column swap), the fixed code SHALL produce exactly the same behavior as the original code, preserving all existing functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

**File**: `apps/web/src/components/charts/polymarket-kline-chart-inner.tsx`

**Effect 1 — ResizeObserver callback**:
1. **Re-apply styles after resize**: After `chart.resize()`, call `chart.setStyles(getKlineChartStyles(theme))` with the current chart type to prevent font drift. Use a ref to access the current theme and chartType without adding them as effect dependencies.

**Effect 4 — Style sync guard**:
2. **Debounce or sequence style application**: After `chart.setStyles()` in Effect 4, schedule a follow-up `setStyles()` via `requestAnimationFrame` to re-assert styles after any concurrent Effect 2 data reload settles. Alternatively, move the style application into Effect 2's data-load completion callback so styles are always applied last.

**File**: `apps/web/src/components/charts/polymarket-kline-chart-inner.tsx`

**Default prop**:
3. **Change default chartType**: Change `chartType = "candle"` to `chartType = "line"` in the component's props destructuring.

**File**: `apps/web/src/stores/workspace-layout.ts`

**Default height**:
4. **Bump CHART_HEIGHT_DEFAULT**: Change `CHART_HEIGHT_DEFAULT = 55` to `CHART_HEIGHT_DEFAULT = 65`. Add a migration from version 1 → 2 that bumps persisted values of 55 to 65 (similar to the existing v0→v1 migration).

**File**: `apps/web/src/components/charts/polymarket-kline-chart.tsx`

**Unified persistence**:
5. **Move chart type into zustand store**: Add `chartType: "candle" | "line"` and `setChartType` to `useWorkspaceLayoutStore`. Remove the standalone `CHART_TYPE_STORAGE_KEY` / `useSyncExternalStore` / `localStorage` mechanism. This ensures both preferences hydrate atomically via zustand-persist. Add a migration that reads the old `doji-chart-type` localStorage key into the store on first hydration, then cleans it up.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that exercise each bug condition in isolation using mocked klinecharts instances and DOM environments. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Resize Font Drift Test**: Create a chart instance, apply styles with `AXIS_FONT_SIZE=12`, call `chart.resize()` multiple times, assert `yAxis.tickText.size` remains 12 after each resize (will fail on unfixed code if klinecharts resets styles)
2. **Mode Toggle Race Test**: Simulate rapid `chartType` change followed by `tokenId` change, assert axis font size is consistent after both effects settle (will fail on unfixed code due to Effect 2/4 race)
3. **Default Height Toolbar Test**: Render `KlineLeftToolbar` in a container at 55% of 900px viewport, assert all toolbar buttons are visible and not clipped (will fail on unfixed code)
4. **Default Chart Mode Test**: Mount `PolymarketKLineChartInner` with no localStorage entry, assert first render uses `chartType="line"` (will fail on unfixed code — receives "candle")
5. **Preference Restoration Test**: Set both preferences in localStorage/zustand, remount the chart, assert both are applied on first render (will fail on unfixed code due to hydration timing)

**Expected Counterexamples**:
- Resize test: `yAxis.tickText.size` reads as library default (not 12) after `chart.resize()`
- Race test: Intermediate render shows wrong font size between Effect 4 and Effect 2 completion
- Default mode test: Inner component receives `chartType="candle"` on first render

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := applyFix(input)
  IF input.type == "resize_drag" THEN
    ASSERT result.yAxisFontSize == 12
    ASSERT result.xAxisFontSize == 12
  IF input.type == "chart_type_change" OR input.type == "side_switch" THEN
    ASSERT result.axisFontSizeConsistent == true
  IF input.type == "initial_load" THEN
    ASSERT result.toolbarFullyVisible == true
  IF input.type == "first_visit" THEN
    ASSERT result.chartType == "line"
  IF input.type == "return_visit" THEN
    ASSERT result.chartType == savedChartType
    ASSERT result.chartHeight == savedChartHeight
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
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for normal chart interactions, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Pan/Zoom Preservation**: Verify that chart pan and zoom interactions produce identical axis font sizes and layout before and after the fix
2. **Interval Switch Preservation**: Verify that switching time intervals triggers correct data reload and period update without font changes
3. **Drawing Tool Preservation**: Verify that creating overlays via toolbar works identically before and after the fix
4. **WS Update Preservation**: Verify that real-time price updates continue to update candle/area data and sonar ring position
5. **Theme Switch Preservation**: Verify that light/dark theme toggle recreates chart with correct styles

### Unit Tests

- Test that `getKlineChartStyles()` always returns `AXIS_FONT_SIZE = 12` for both themes
- Test that `CHART_HEIGHT_DEFAULT` is ≥ 65
- Test that the workspace-layout store migration correctly bumps old height values
- Test that chart type defaults to "line" when no preference is stored
- Test that the unified zustand store correctly persists and restores chart type

### Property-Based Tests

- Generate random sequences of resize events and verify font size remains 12 after each
- Generate random interleaving of chart type changes and side switches, verify no font glitch
- Generate random viewport heights ≥ 768px and verify toolbar is fully visible at default height
- Generate random preference combinations and verify both restore correctly on remount

### Integration Tests

- Test full trading terminal load with no preferences — verify line mode and adequate chart height
- Test drag-resize flow end-to-end — verify font consistency throughout drag
- Test rapid candle/line toggle + Yes/No switch — verify no visual artifacts
- Test preference round-trip: set preferences → navigate away → return → verify restoration
