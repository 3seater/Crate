# Implementation Plan: PNL Calendar

## Overview

Implement a dialog-based monthly PNL calendar for the portfolio page. The feature lives in a single client component file (`pnl-calendar.tsx`) with a trigger button integrated into the existing `PortfolioTopCards`. Data is fetched via `trpc.data.activity` and aggregated by a pure function `aggregateDailyPnl`. Property-based tests validate the aggregation logic and color-coding rules.

## Tasks

- [x] 1. Create PnlCalendar component file with data layer and types
  - [x] 1.1 Create `apps/web/src/components/portfolio/pnl-calendar.tsx` with type definitions and aggregation function
    - Define `DayStats` interface (`pnl`, `buyCount`, `sellCount`, `buyVolume`, `sellVolume`)
    - Define `ActivityRecord` type shape (type, timestamp, side, usdcSize)
    - Implement the pure `aggregateDailyPnl(activities, monthStart, monthEnd)` function that groups TRADE records by calendar day, computes per-day buy/sell counts, volumes, and `pnl = sellVolume - buyVolume`
    - Implement `getPnlColorClass(pnl)` helper returning `"text-positive"` for positive, `"text-negative"` for negative, empty string for zero/null
    - Use `date-fns` `format` for date key generation (`"yyyy-MM-dd"`)
    - Handle edge cases: missing/non-numeric `usdcSize` → treat as 0, missing/invalid `timestamp` → skip record
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 1.2 Write property test: Daily PNL aggregation correctness (Property 1)
    - Create `tests/unit/pnl-calendar-aggregation.property.test.ts`
    - Use `fast-check` to generate random lists of activity records with `type: "TRADE"`, random timestamps within a random month, side randomly `"BUY"` or `"SELL"`, and positive numeric `usdcSize` (string format)
    - Call `aggregateDailyPnl` and verify: `pnl === sellVolume - buyVolume`, `buyCount` equals BUY record count per day, `sellCount` equals SELL record count per day, `buyVolume` equals sum of BUY usdcSize, `sellVolume` equals sum of SELL usdcSize, `buyCount + sellCount` equals total records per day
    - Minimum 100 iterations
    - **Property 1: Daily PNL aggregation correctness**
    - **Validates: Requirements 6.2, 6.3, 6.4**

  - [ ]* 1.3 Write property test: PNL sign determines color class (Property 2)
    - Add to `tests/unit/pnl-calendar-aggregation.property.test.ts`
    - Use `fast-check` to generate random `DayStats` objects with varying `pnl` values (positive, negative, zero)
    - Verify `getPnlColorClass` returns `"text-positive"` when `pnl > 0`, `"text-negative"` when `pnl < 0`, and empty string when `pnl === 0`
    - Minimum 100 iterations
    - **Property 2: PNL sign determines color class**
    - **Validates: Requirements 4.4, 4.5, 4.6**

- [x] 2. Implement PnlCalendarDialog and CalendarHeader
  - [x] 2.1 Implement `PnlCalendarDialog` component
    - Accept `open`, `onOpenChange`, `address` props
    - Use `Dialog` / `DialogContent` from `@/components/ui/dialog`
    - Manage `viewMonth` state (`Date`) for month navigation
    - Fetch activity data via `useQuery(trpc.data.activity.queryOptions(...))` with `type: ["TRADE"]`, `sortBy: "TIMESTAMP"`, `sortDirection: "ASC"`, `start`/`end` from `startOfMonth`/`endOfMonth` of `viewMonth`, `limit: 1000`
    - Pass aggregated daily data (from `aggregateDailyPnl`) to the grid
    - Show skeleton placeholders while data is loading
    - On fetch failure, render grid with empty cells (silent degradation)
    - _Requirements: 2.1, 2.2, 2.6, 2.7, 6.1, 6.5, 6.6, 6.7_

  - [x] 2.2 Implement `CalendarHeader` inside the dialog
    - Left side: "PNL Calendar" title (`text-sm font-medium`)
    - Right group: Trophy icon button with `Tooltip` ("Flex your monthly PNL"), month/year label (`format(viewMonth, "MMMM yyyy")`), prev/next `Button` (variant `ghost`) for month navigation
    - Trophy button: `aria-label="Flex your monthly PNL"`, no-op on click, uses `Tooltip` from `@/components/ui/tooltip`
    - Nav buttons: `aria-label="Previous month"` and `aria-label="Next month"`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 7.3, 7.4_

- [x] 3. Implement DayGrid, DayCell, and DayTooltip
  - [x] 3.1 Implement `DayGrid` with weekday headers and week rows
    - 7-column CSS grid (Mon–Sun) with weekday header row
    - Generate calendar days for the displayed month including padding days from prev/next months using `date-fns` (`startOfWeek`, `eachDayOfInterval`, `endOfMonth`)
    - Map each day to its `DayStats` from the aggregated data map
    - _Requirements: 2.5, 4.1_

  - [x] 3.2 Implement `DayCell` as a `memo`-ized component
    - Accept `day`, `isCurrentMonth`, `isToday`, `stats` props
    - Show day number top-left (`text-xs`)
    - Show PNL value centered (`text-[10px]`) with `text-positive` or `text-negative` color based on sign
    - Days with no activity: no PNL shown, day number in `text-text-tertiary`
    - Padding days (prev/next month): `text-text-tertiary` styling
    - Today: `bg-surface-2` background
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [x] 3.3 Implement `DayTooltip` wrapping DayCells with activity
    - Use `Tooltip` from `@/components/ui/tooltip`
    - Show date header: `format(day, "EEE, MMM d, yyyy")` (`text-xs font-medium`)
    - Show "Buys / Sells" row: buy count in `text-positive`, sell count in `text-negative`
    - Show "Buy Vol. (incl. fees)" row: total buy volume in `text-positive`
    - Show "Sell Vol. (incl. fees)" row: total sell volume in `text-negative`
    - Days with no activity: no tooltip
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 4. Checkpoint - Verify component renders correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Integrate PnlCalendarTrigger into PortfolioTopCards
  - [x] 5.1 Implement `PnlCalendarTrigger` and add to `portfolio-top-cards.tsx`
    - Create `PnlCalendarTrigger` in `pnl-calendar.tsx`: `Button` (variant `ghost`, size `icon-sm`) with `CalendarDays` icon from `lucide-react`, `aria-label="Open PNL Calendar"`
    - Manage `open` state via `useState`, render `PnlCalendarDialog` when open
    - Pass `address` prop through (use `safeAddress ?? funderAddress ?? address` pattern consistent with portfolio page)
    - Hide trigger when wallet is not connected (Requirement 1.4)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.8, 7.1, 7.2_

  - [x] 5.2 Modify `apps/web/src/components/portfolio/portfolio-top-cards.tsx` to render the trigger
    - Import `PnlCalendarTrigger` from `./pnl-calendar`
    - Add the trigger button in the PNL card header area (right side, near the timeframe segments)
    - Pass `address` prop to the trigger
    - _Requirements: 1.1_

- [x] 6. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate the `aggregateDailyPnl` pure function and color class logic using `fast-check`
- The component is a single file (`pnl-calendar.tsx`) with all sub-components co-located
- Test file follows project convention: `tests/unit/pnl-calendar-aggregation.property.test.ts`
