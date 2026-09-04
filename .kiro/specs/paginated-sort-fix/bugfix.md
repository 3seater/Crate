# Bugfix Requirements Document

## Introduction

Sorting paginated tables only sorts the data that has been fetched so far via `useInfiniteQuery`, not the entire dataset. Users see incorrect sort results because the client-side sort comparator operates on a partial dataset — only the pages loaded via infinite scroll. This affects multiple surfaces across the app. Additionally, the Trades tab on the trading terminal has column sorting that serves no useful purpose and should be removed.

## Bug Analysis

### Current Behavior (Defect)

**Portfolio Page:**

1.1 WHEN a user sorts the Active Positions table by any column (bought, toWin, shares, value, avg, price, PNL) THEN the system only sorts the pages fetched so far, producing incorrect results that shift as more pages load

1.2 WHEN a user sorts the Closed Positions table by "bought" or "sold" (columns without server-side sort support) THEN the system only sorts the pages fetched so far, showing incorrect ordering that changes as the user scrolls

1.3 WHEN a user sorts the Orders table by price, filled, or expiration THEN the system only sorts the currently loaded orders, not the full set

1.4 WHEN a user sorts the History tab by shares, value, or time THEN the system only sorts the activity pages fetched so far, producing incorrect results

**Leaderboard Profile Modal:**

1.5 WHEN a user sorts the Active Positions table in the Profile Modal by avg, price, value, or pnl THEN the system only sorts the pages fetched so far

1.6 WHEN a user sorts the Closed Positions table in the Profile Modal by bought, sold, avg, or PNL THEN the system only sorts the pages fetched so far

1.7 WHEN a user sorts the History tab in the Profile Modal by shares, value, or time THEN the system only sorts the pages fetched so far

**Trading Terminal:**

1.8 WHEN a user sorts the History tab (market-level) by shares, value, price, or time THEN the system only sorts the fetched pages

1.9 WHEN a user sorts the Orders tab by price, filled, or expiration THEN the system only sorts the currently loaded orders

1.10 WHEN a user interacts with sort headers on the Trades tab THEN the sort only applies to loaded trades, which is misleading since trades stream in real-time and the dataset is unbounded — sorting here is not useful

### Expected Behavior (Correct)

**Portfolio Page:**

2.1 WHEN a user sorts the Active Positions table by any column THEN the system SHALL fetch all remaining pages before applying the client-side sort, so the sort reflects the entire dataset

2.2 WHEN a user sorts the Closed Positions table by "bought" or "sold" THEN the system SHALL fetch all remaining pages before applying the client-side sort

2.3 WHEN a user sorts the Orders table by any column THEN the system SHALL sort the complete orders dataset (fetch all if paginated)

2.4 WHEN a user sorts the History tab by shares, value, or time THEN the system SHALL fetch all remaining pages before applying the client-side sort

**Leaderboard Profile Modal:**

2.5 WHEN a user sorts the Active Positions table in the Profile Modal by any column THEN the system SHALL fetch all remaining pages before applying the client-side sort

2.6 WHEN a user sorts the Closed Positions table in the Profile Modal by bought or sold THEN the system SHALL fetch all remaining pages before applying the client-side sort

2.7 WHEN a user sorts the History tab in the Profile Modal by shares, value, or time THEN the system SHALL fetch all remaining pages before applying the client-side sort

**Trading Terminal:**

2.8 WHEN a user sorts the History tab (market-level) by any column THEN the system SHALL fetch all remaining pages before applying the client-side sort

2.9 WHEN a user sorts the Orders tab by any column THEN the system SHALL sort the complete orders dataset

2.10 The Trades tab on the trading terminal SHALL have all column sort headers removed — no sorting on the Trades tab

**General:**

2.11 WHEN the system is fetching all pages to fulfill a client-side sort THEN the system SHALL display a loading indicator so the user knows data is being loaded

2.12 WHEN server-side sorting is available for a column (e.g. Closed Positions PNL → REALIZEDPNL, avg → AVGPRICE) THEN the system SHALL use server-side sorting instead of fetching all pages

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user sorts the Closed Positions table by PNL or avg (columns with server-side sort support via REALIZEDPNL, AVGPRICE) THEN the system SHALL CONTINUE TO pass sortBy/sortDirection to the Data API and display server-sorted results without fetching all pages

3.2 WHEN a user scrolls without sorting (default sort) THEN the system SHALL CONTINUE TO use infinite scroll pagination with lazy page loading as before

3.3 WHEN a user searches/filters within any table THEN the system SHALL CONTINUE TO apply the search filter on the loaded data as before

3.4 WHEN no sort is active (default state) THEN the system SHALL CONTINUE TO display data in the default server order with infinite scroll pagination

3.5 WHEN the Trades tab displays real-time trades from WebSocket THEN the system SHALL CONTINUE TO show trades in reverse chronological order (newest first) without any sort controls

## Affected Files

### Portfolio Page
- `apps/web/src/features/portfolio/components/position-table.tsx` — Active Positions
- `apps/web/src/features/portfolio/components/closed-positions.tsx` — Closed Positions
- `apps/web/src/features/portfolio/components/orders-table.tsx` — Orders
- `apps/web/src/features/portfolio/components/activity-history.tsx` — History

### Leaderboard Profile Modal
- `apps/web/src/features/leaderboard/components/leaderboard-profile-modal.tsx` — Active Positions, Closed Positions, History tabs

### Trading Terminal
- `apps/web/src/features/trading/components/market/tabs/history-tab.tsx` — History
- `apps/web/src/features/trading/components/market/tabs/orders-tab.tsx` — Orders
- `apps/web/src/features/trading/components/market/tabs/trades-tab.tsx` — Trades (remove sorting)

### Server
- `apps/server/src/features/data/router.ts` — closedPositions, positions, activityWithMarkets procedures (check server-side sort support)
