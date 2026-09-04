# Implementation Plan: Live Scoreboard Pill with Tooltip and Draggable Widget

## Overview

Replace the inline `Scoreboard` component in the trading terminal header with a three-tier progressive disclosure model: compact Live Pill → rich hover Tooltip → draggable pop-out Widget. All tiers share a `ScoreboardContent` component and consume data from the existing `useMarketSportsData` hook. A lightweight Zustand store manages widget open/position state.

## Tasks

- [x] 1. Create the Zustand store for widget state
  - [x] 1.1 Create `apps/web/src/features/trading/stores/scoreboard-widget.ts`
    - Define `ScoreboardWidgetState` interface with `isOpen`, `gameId`, `position: { x, y }`
    - Implement `open(gameId)`, `close()`, `setPosition(pos)` actions
    - No `persist` middleware — session-scoped only
    - `close()` sets `isOpen: false` and `gameId: null` but preserves `position`
    - `open(gameId)` sets `isOpen: true`, stores `gameId`, uses last position or default center
    - _Requirements: 4.1, 4.4, 4.5_

- [x] 2. Create the shared ScoreboardContent component
  - [x] 2.1 Create `apps/web/src/features/trading/components/market/scoreboard-content.tsx`
    - Accept props: team names, abbreviations, score, period/status/elapsed, live/ended, markets, eventImage
    - Use `ImageWithFallback` for team logos at 48px with team abbreviation as fallback
    - Display formatted score via `formatScore(parseScore(score))` in `text-lg` typography
    - Display game status line via `formatPeriod(...)` in `text-xs` with `text-red-500` for live, `text-text-secondary` otherwise
    - Include animated ping dot (with `aria-hidden="true"`) in status line when live
    - Handle partial data: show `–` placeholder when score is null, omit status line when period is null
    - Fall back to abbreviation when team name is unavailable
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 2.2, 2.3, 2.4, 2.8, 2.9_

  - [ ]* 2.2 Write property test for ScoreboardContent robustness
    - **Property 2: ScoreboardContent renders without errors and displays available data**
    - Generate random combinations of `{ score, period, elapsed, status, live, ended, homeAbbrev, awayAbbrev, homeTeamName, awayTeamName }`
    - Verify no render errors and both team identifiers present in output
    - **Validates: Requirements 2.2, 2.9, 7.5**

- [x] 3. Create the LivePill component
  - [x] 3.1 Create `apps/web/src/features/trading/components/market/live-pill.tsx`
    - Use `resolveGameState({ live, ended, status, period })` to determine visibility and mode
    - Return `null` when game state is `null`
    - Render `● LIVE` with animated ping dot and `text-red-500` when state is `"live"`
    - Render `FINAL` with `text-text-secondary` when state is `"ended"`
    - Wrap in `Tooltip` / `TooltipTrigger` / `TooltipContent` from design system
    - Suppress tooltip (don't render `TooltipContent`) when `useScoreboardWidgetStore.isOpen` is `true`
    - Render `ScoreboardContent` inside tooltip content
    - Add "Pop out" `Button` (variant `ghost`, `aria-label="Pop out scoreboard"`) in tooltip that calls `store.open(gameId)`
    - Build `aria-label` on the pill element with team names, score, and period info
    - Mark ping dot with `aria-hidden="true"`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 2.1, 2.5, 2.6, 2.7, 2.10, 5.1, 5.2, 6.1, 6.2, 6.3, 6.6_

  - [ ]* 3.2 Write property test for pill display consistency
    - **Property 1: Pill display is consistent with resolveGameState**
    - Generate random `{ live, ended, status, period }` combinations
    - Verify pill output matches `resolveGameState` return value
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 3.3 Write property test for tooltip suppression
    - **Property 5: Tooltip is suppressed when widget is open**
    - Generate random scoreboard data + `isOpen` boolean
    - Verify tooltip rendered iff `!isOpen`
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 3.4 Write property test for aria-label content
    - **Property 6: aria-label contains team and score information**
    - Generate random team names, scores, periods
    - Verify label contains team identifiers and formatted score when available
    - **Validates: Requirements 6.1**

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Create the ScoreboardWidget component
  - [x] 5.1 Create `apps/web/src/features/trading/components/market/scoreboard-widget.tsx`
    - Render via `createPortal` to `document.body`
    - Read `isOpen`, `position`, `gameId` from `useScoreboardWidgetStore`
    - Return `null` when `!isOpen`
    - Render ~300px wide card with `bg-card border border-border rounded-lg shadow-lg`
    - Header area as drag handle with grip icon and "Live Score" label, `cursor-grab` / `cursor-grabbing`
    - Close button: `Button` with `variant="ghost"` `size="icon-xs"`, X icon, `aria-label="Close scoreboard widget"`
    - Render `ScoreboardContent` with passed-through props
    - Set `z-[9000]`, `role="dialog"`, `aria-label="Live scoreboard: {homeTeamName} vs {awayTeamName}"`
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 3.6, 3.7, 6.4, 6.5_

  - [x] 5.2 Implement pointer-event drag with viewport clamping
    - `onPointerDown` on header captures initial pointer and widget position
    - Attach `onPointerMove` and `onPointerUp` to `document` during drag
    - Update position via `store.setPosition()` during move
    - Clamp position: `x ∈ [0, viewportWidth - widgetWidth]`, `y ∈ [0, viewportHeight - widgetHeight]`
    - Use `useRef` for drag state to avoid re-renders during drag
    - Apply `transform: translate(x, y)` for GPU-accelerated positioning
    - Add `touch-action: none` on drag handle to prevent scroll interference
    - _Requirements: 3.4, 3.8, 4.1_

  - [ ]* 5.3 Write property test for viewport clamping
    - **Property 3: Drag position is clamped to viewport boundaries**
    - Generate random `{ x, y, width, height, viewportWidth, viewportHeight }` (positive numbers)
    - Verify `0 <= clampedX <= viewportWidth - width` and `0 <= clampedY <= viewportHeight - height`
    - **Validates: Requirements 3.4, 3.8**

  - [ ]* 5.4 Write property test for widget gameId persistence
    - **Property 4: Widget open state persists if and only if gameId matches**
    - Generate random pairs of gameId strings
    - Verify widget remains open iff gameIds match, closes otherwise
    - **Validates: Requirements 4.2, 4.3**

- [x] 6. Integrate into MarketHeaderTrading
  - [x] 6.1 Replace `<Scoreboard {...scoreboardProps} />` with `<LivePill {...scoreboardProps} />`
    - Import `LivePill` component
    - Pass all `scoreboardProps` to `LivePill`
    - _Requirements: 1.7_

  - [x] 6.2 Add `<ScoreboardWidget {...scoreboardProps} />` to MarketHeaderTrading
    - Render conditionally when `scoreboardProps` is non-null
    - Component portals to `document.body` so placement in JSX doesn't matter
    - _Requirements: 3.1_

  - [x] 6.3 Add effect to auto-close widget on game change
    - Watch event slug (or derived gameId) changes
    - When slug changes and widget is open for a different game, call `store.close()`
    - When `scoreboardProps` becomes null, call `store.close()`
    - _Requirements: 4.3, 5.4_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Cleanup old Scoreboard component
  - [x] 8.1 Remove or deprecate the inline `Scoreboard` component
    - Remove the `<Scoreboard>` import and usage from `MarketHeaderTrading`
    - Add a deprecation comment to `apps/web/src/features/trading/components/market/scoreboard.tsx` or remove the file if no other consumers exist
    - Verify no other imports reference the old `Scoreboard` component
    - _Requirements: 1.7_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the 6 correctness properties defined in the design document
- All components use TypeScript and follow the project's design system tokens
- The implementation reuses existing utilities (`parseScore`, `formatPeriod`, `formatScore`, `resolveGameState`, `getTeamImage`, `ImageWithFallback`)
- Test file: `tests/unit/live-scoreboard-widget.test.ts` using Vitest + fast-check
