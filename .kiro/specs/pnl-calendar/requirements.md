# Requirements Document

## Introduction

A PNL (Profit and Loss) Calendar feature for the portfolio page that visualizes daily trading performance in a monthly calendar grid. Users click a mini calendar icon on the portfolio page to open a dialog showing each day's PNL (sell volume minus buy volume), color-coded green for profit and red for loss. Day cells show hover popovers with detailed trade stats (buy/sell counts and volumes). The calendar sources data from the existing `trpc.data.activity` endpoint filtered to TRADE type.

## Glossary

- **PNL_Calendar_Dialog**: The modal dialog opened from the portfolio page that displays a monthly calendar grid with daily PNL values.
- **Calendar_Trigger**: The mini calendar icon button on the portfolio page that opens the PNL_Calendar_Dialog.
- **Day_Cell**: A single cell in the calendar grid representing one calendar day, displaying the day number and PNL value.
- **Day_Popover**: A tooltip/popover shown on hover of a Day_Cell that has trade activity, displaying detailed stats (buy/sell counts and volumes).
- **Trophy_Button**: A placeholder icon button in the calendar header with a "Flex your monthly PNL" tooltip, reserved for future functionality.
- **Activity_Data**: Trade activity records fetched from `trpc.data.activity` with type TRADE, containing timestamp, side (BUY/SELL), and usdcSize fields.
- **Daily_PNL**: The profit or loss for a single day, calculated as the sum of SELL usdcSize values minus the sum of BUY usdcSize values for that day.
- **Month_Navigator**: The prev/next arrow controls in the calendar header that allow navigating between months.

## Requirements

### Requirement 1: Calendar Trigger on Portfolio Page

**User Story:** As a trader, I want a calendar icon on the portfolio page, so that I can quickly access my daily PNL overview.

#### Acceptance Criteria

1. THE Calendar_Trigger SHALL render as a clickable calendar icon button within the portfolio top cards area of the portfolio page.
2. WHEN the Calendar_Trigger is clicked, THE PNL_Calendar_Dialog SHALL open as a centered modal dialog with a backdrop overlay.
3. THE Calendar_Trigger SHALL use an icon from the `lucide-react` library and follow the project Button component patterns.
4. WHILE the user wallet is not connected, THE Calendar_Trigger SHALL remain hidden.

### Requirement 2: Calendar Dialog Layout and Header

**User Story:** As a trader, I want a clear calendar interface with navigation controls, so that I can browse my PNL across different months.

#### Acceptance Criteria

1. THE PNL_Calendar_Dialog SHALL display a header containing the text "PNL Calendar" on the left side.
2. THE PNL_Calendar_Dialog header SHALL display the current month and year (e.g., "November 2025") with the Month_Navigator arrows on the right side.
3. WHEN the previous-month arrow in the Month_Navigator is clicked, THE PNL_Calendar_Dialog SHALL display the preceding calendar month.
4. WHEN the next-month arrow in the Month_Navigator is clicked, THE PNL_Calendar_Dialog SHALL display the following calendar month.
5. THE PNL_Calendar_Dialog SHALL display a row of weekday headers (Mon through Sun) above the day grid.
6. THE PNL_Calendar_Dialog SHALL use the project Dialog component from `@/components/ui/dialog`.
7. THE PNL_Calendar_Dialog SHALL use design system tokens for all colors, font sizes (`text-sm`, `text-xs`, `text-[10px]`), and font weights (`font-normal`, `font-medium`).

### Requirement 3: Trophy Placeholder Button

**User Story:** As a product team member, I want a trophy icon placeholder in the calendar header, so that we can later add a "flex your PNL" sharing feature.

#### Acceptance Criteria

1. THE Trophy_Button SHALL render as a trophy icon in the top-right area of the PNL_Calendar_Dialog header, adjacent to the Month_Navigator.
2. WHEN the user hovers over the Trophy_Button, THE PNL_Calendar_Dialog SHALL display a tooltip with the text "Flex your monthly PNL".
3. WHEN the Trophy_Button is clicked, THE PNL_Calendar_Dialog SHALL perform no action (placeholder only).
4. THE Trophy_Button SHALL use the Tooltip component from `@/components/ui/tooltip` for the hover text.

### Requirement 4: Monthly Day Grid Display

**User Story:** As a trader, I want to see each day of the month in a grid with my PNL, so that I can identify profitable and losing days at a glance.

#### Acceptance Criteria

1. THE PNL_Calendar_Dialog SHALL render a 7-column grid (Monday through Sunday) with rows for each week of the displayed month.
2. Each Day_Cell SHALL display the day number in the top-left corner of the cell.
3. Each Day_Cell with trade activity SHALL display the Daily_PNL value centered in the cell, formatted as a USD amount (e.g., "$12.50", "-$3.20").
4. WHEN the Daily_PNL for a day is positive, THE Day_Cell SHALL display the PNL value using the `text-positive` color token (green, `--color-profit`).
5. WHEN the Daily_PNL for a day is negative, THE Day_Cell SHALL display the PNL value using the `text-negative` color token (red, `--color-loss`).
6. WHEN a day has zero PNL or no trade activity, THE Day_Cell SHALL display no PNL value and use the neutral `text-text-tertiary` color for the day number.
7. THE PNL_Calendar_Dialog SHALL visually highlight today's date with a distinct subtle background color using the `--surface-2` or `--surface-3` token.
8. Day_Cell entries that belong to the previous or next month (padding days in the grid) SHALL render with reduced opacity using `text-text-tertiary` styling.

### Requirement 5: Day Hover Popover with Trade Stats

**User Story:** As a trader, I want to see detailed trade stats when I hover over a day, so that I can understand the breakdown of my buys and sells.

#### Acceptance Criteria

1. WHEN the user hovers over a Day_Cell that has trade activity, THE Day_Popover SHALL appear showing detailed stats for that day.
2. THE Day_Popover SHALL display a formatted date header (e.g., "Thu, Nov 13, 2025") using the `date-fns` `format` function.
3. THE Day_Popover SHALL display a "Buys / Sells" row showing the count of BUY trades in green (`text-positive`) and the count of SELL trades in red (`text-negative`).
4. THE Day_Popover SHALL display a "Buy Vol. (incl. fees)" row showing the total BUY usdcSize in green (`text-positive`).
5. THE Day_Popover SHALL display a "Sell Vol. (incl. fees)" row showing the total SELL usdcSize in red (`text-negative`).
6. WHEN the user hovers over a Day_Cell with no trade activity, THE Day_Popover SHALL remain hidden.
7. THE Day_Popover SHALL use the Tooltip component from `@/components/ui/tooltip`.

### Requirement 6: Data Fetching and PNL Calculation

**User Story:** As a trader, I want the calendar to show accurate PNL from my real trades, so that I can trust the data displayed.

#### Acceptance Criteria

1. THE PNL_Calendar_Dialog SHALL fetch Activity_Data using `trpc.data.activity` with `type: ["TRADE"]`, `sortBy: "TIMESTAMP"`, `sortDirection: "ASC"`, and `start`/`end` timestamps corresponding to the displayed month boundaries.
2. THE PNL_Calendar_Dialog SHALL calculate Daily_PNL for each day by summing all SELL trade `usdcSize` values and subtracting all BUY trade `usdcSize` values for trades with matching day (based on `timestamp` field).
3. THE PNL_Calendar_Dialog SHALL aggregate trade counts (number of BUY trades and number of SELL trades) per day for the Day_Popover display.
4. THE PNL_Calendar_Dialog SHALL aggregate total BUY volume (sum of BUY `usdcSize`) and total SELL volume (sum of SELL `usdcSize`) per day for the Day_Popover display.
5. WHEN the displayed month changes via the Month_Navigator, THE PNL_Calendar_Dialog SHALL fetch new Activity_Data for the updated month range.
6. WHILE Activity_Data is loading, THE PNL_Calendar_Dialog SHALL display a loading state (skeleton placeholders or spinner) within the calendar grid.
7. IF the Activity_Data fetch fails, THEN THE PNL_Calendar_Dialog SHALL display the calendar grid with empty Day_Cell values and no PNL data.
8. THE PNL_Calendar_Dialog SHALL use the user's portfolio wallet address (safeAddress or funderAddress or address) consistent with the portfolio page data fetching pattern.

### Requirement 7: Accessibility and Interaction

**User Story:** As a user with assistive technology, I want the calendar to be accessible, so that I can navigate and understand my PNL data.

#### Acceptance Criteria

1. THE Calendar_Trigger SHALL include an `aria-label` attribute with the value "Open PNL Calendar".
2. THE PNL_Calendar_Dialog SHALL be keyboard-navigable, with Escape closing the dialog, consistent with the base Dialog component behavior.
3. THE Month_Navigator arrow buttons SHALL include `aria-label` attributes ("Previous month" and "Next month").
4. THE Trophy_Button SHALL include an `aria-label` attribute with the value "Flex your monthly PNL".
