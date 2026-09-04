# Implementation Plan: All Markets Multi-Line Chart

## Overview

Implement the "All Markets" multi-line chart mode for the Polymarket trading terminal. The feature extends the existing chart infrastructure to overlay multiple market outcome lines on a shared time axis, with color-coded legends, hover tooltips, and add/remove controls in the market selector dropdown. All changes are client-side — no new server endpoints needed.

## Tasks

- [x] 1. Extend workspace layout store with All Markets state
  - [x] 1.1 Add `allMarketsMode`, `visibleMarketIds`, and actions to `useWorkspaceLayoutStore`
    - Add `allMarketsMode: boolean` (default `false`) and `visibleMarketIds: string[]` (default `[]`) to the store state
    - Add actions: `setAllMarketsMode`, `setVisibleMarketIds`, `addVisibleMarket`, `removeVisibleMarket`, `resetAllMarketsMode`
    - `removeVisibleMarket` must check if the set would become empty and call `resetAllMarketsMode` if so
    - Persist new fields via existing Zustand persist middleware; bump version and add migration
    - _Requirements: 7.1, 6.6_
  - [ ]* 1.2 Write property test for add/remove market round-trip
    - **Property 6: Add/remove market round-trip on visibleMarketIds**
    - **Validates: Requirements 6.3, 6.4**

- [x] 2. Create color assignment and default selection utilities
  - [x] 2.1 Create `market-colors.ts` with `assignMarketColors` and the 12-color palette
    - Create `apps/web/src/features/trading/lib/market-colors.ts`
    - Export `MARKET_COLORS` array and `assignMarketColors(marketIds: string[]): Map<string, string>`
    - Colors assigned by index with modulo wrap for >12 markets
    - _Requirements: 2.3_
  - [ ]* 2.2 Write property test for color assignment uniqueness
    - **Property 2: Color assignment uniqueness**
    - **Validates: Requirements 2.3**
  - [x] 2.3 Create `default-visible-markets.ts` with `getDefaultVisibleMarkets`
    - Create `apps/web/src/features/trading/lib/default-visible-markets.ts`
    - Export `getDefaultVisibleMarkets(markets: SelectorMarket[]): string[]` that returns top `min(4, N)` conditionIds by Yes price descending
    - _Requirements: 2.2, 2.6_
  - [ ]* 2.4 Write property test for default visible markets selection
    - **Property 1: Default visible markets are the top markets by Yes price**
    - **Validates: Requirements 2.2, 2.6**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Modify `MarketSelectDropdown` for All Markets mode
  - [x] 4.1 Add "All Markets" row and +/− controls to `MarketSelectDropdown`
    - Add new props: `allMarketsMode`, `visibleMarketIds`, `onToggleAllMarkets`, `onAddMarket`, `onRemoveMarket`
    - Render "All Markets" row as first item when `items.length >= 2`
    - When `allMarketsMode` is true: show "All Markets" in trigger text, switch from `<Select>` to `<Popover>` + custom list, show +/− icon buttons per market row
    - Clicking +/− calls `onAddMarket`/`onRemoveMarket` without closing the popover
    - Selecting an individual market row while in All Markets mode exits the mode via `onSelectMarket`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 5. Implement chart components for All Markets mode
  - [x] 5.1 Create `AllMarketsLineLayer` component
    - Create `apps/web/src/features/trading/components/charts/all-markets-line-layer.tsx`
    - Fetch price history for each visible market via `trpc.clob.getPricesHistory` (parallel, deduplicated via TanStack Query)
    - Register a custom KLineChart technical indicator per market that draws a colored line
    - Manage WebSocket subscriptions for all visible market asset IDs via `marketChannel`
    - Update trailing data point on `last_trade_price` events
    - Call `chart.fitContent()` on mount and visible market changes to auto-scale
    - Expose `onPriceUpdate` callback for legend bar live prices
    - _Requirements: 2.1, 2.4, 2.5, 7.3, 7.4_
  - [x] 5.2 Create `LegendBar` component
    - Create `apps/web/src/features/trading/components/charts/legend-bar.tsx`
    - Render horizontal row of legend items: colored dot + truncated label + price as percentage
    - Horizontally scrollable if items overflow available width
    - Update prices within 1 second of WebSocket events
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - [ ]* 5.3 Write property test for legend item content completeness
    - **Property 3: Legend item content completeness**
    - **Validates: Requirements 4.1, 4.2**
  - [x] 5.4 Create `AllMarketsTooltip` custom crosshair tooltip
    - Create `apps/web/src/features/trading/components/charts/all-markets-tooltip.tsx`
    - Custom KLineChart crosshair tooltip renderer
    - Show date formatted as "Month Day, Year" (e.g. "April 30, 2026")
    - Show one row per visible market: colored dot + label + price in cents (e.g. "81.0¢")
    - Styled as opaque card with border, consistent with existing PnL tooltip
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - [ ]* 5.5 Write property test for tooltip row content completeness
    - **Property 4: Tooltip row content completeness**
    - **Validates: Requirements 5.2**
  - [ ]* 5.6 Write property test for tooltip date formatting
    - **Property 5: Tooltip date formatting**
    - **Validates: Requirements 5.3**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Modify `PolymarketKLineChart` to integrate All Markets mode
  - [x] 7.1 Update `PolymarketKLineChart` for conditional toolbar and All Markets rendering
    - Read `allMarketsMode` and `visibleMarketIds` from `useWorkspaceLayoutStore`
    - When `allMarketsMode` is true: hide `TimeframeSegment` buttons, `ChartTypePicker`, and `KlineLeftToolbar`
    - Keep screenshot and fullscreen buttons visible in All Markets mode
    - Render `LegendBar` in the top bar when `allMarketsMode` is true
    - Pass visible market data to `AllMarketsLineLayer`
    - _Requirements: 3.4, 3.5, 3.6, 3.7_
  - [x] 7.2 Apply chart interaction constraints in All Markets mode
    - Disable Y-axis drag via KLineChart styles/config when `allMarketsMode` is true
    - Ensure horizontal panning and scroll zoom remain enabled
    - Force line (area) display type for all series
    - _Requirements: 3.1, 3.2, 3.3, 2.5_

- [x] 8. Wire everything together and handle event navigation
  - [x] 8.1 Connect `MarketSelectDropdown` to store actions in parent components
    - Wire `onToggleAllMarkets` to `setAllMarketsMode(true)` + `setVisibleMarketIds(getDefaultVisibleMarkets(items))`
    - Wire `onAddMarket`/`onRemoveMarket` to store actions
    - Wire individual market selection to exit All Markets mode via `resetAllMarketsMode`
    - _Requirements: 1.3, 1.5, 6.3, 6.4_
  - [x] 8.2 Reset All Markets mode on event navigation
    - When `conditionId` or `tokenId` props change (new event), call `resetAllMarketsMode()`
    - Ensure WebSocket subscriptions are cleaned up on mode exit
    - _Requirements: 7.2, 7.4_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- All code uses TypeScript, consistent with the existing codebase
- Test files go in `tests/unit/` following the `*.property.test.ts` naming convention for property tests
