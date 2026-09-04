# Bugfix Requirements Document

## Introduction

Sorting on paginated tables across the portfolio page, profile modal, and trading terminal suffers from two distinct problems depending on the column:

1. **Columns with available server-side sort** (activity history: shares/value/time; active positions: avg/price/value/pnl) are unnecessarily fetched client-side via `useFullDatasetSort` because the `activityWithMarkets` tRPC procedure hardcodes `sortBy: "TIMESTAMP", sortDirection: "DESC"` instead of passing through the client's sort params, and the profile modal's active positions query doesn't pass `sortBy`/`sortDirection` to the `positions` procedure despite it supporting `CURRENT`, `INITIAL`, `TOKENS`, `CASHPNL`, `PERCENTPNL`, `PRICE`, `AVGPRICE`.

2. **Columns with no server-side sort** (closed positions: bought/sold; activity history: price) must use `useFullDatasetSort` to fetch all pages, but during the fetch the table displays raw unsorted data with no loading indicator — then suddenly reorders, causing visible jitter.

The fix is a two-pronged approach: wire server-side sort for columns that support it (paginated, smooth, accurate), and show skeleton rows until all data is loaded for columns that don't.

## Bug Analysis

### Current Behavior (Defect)

**Prong 1 — Server-side sort not wired (unnecessary client-side fetch-all):**

1.1 WHEN a user clicks the "shares" (amount) sort column on the History table (portfolio page, profile modal, or trading terminal) THEN the system triggers `useFullDatasetSort` to fetch ALL pages client-side even though the Data API supports `sortBy: "TOKENS"` — because `activityWithMarkets` hardcodes `sortBy: "TIMESTAMP", sortDirection: "DESC"` and does not accept or pass through sort parameters from the client

1.2 WHEN a user clicks the "value" sort column on the History table (portfolio page, profile modal, or trading terminal) THEN the system triggers `useFullDatasetSort` to fetch ALL pages client-side even though the Data API supports `sortBy: "CASH"` — because `activityWithMarkets` hardcodes sort parameters

1.3 WHEN a user clicks any sort column (avg, price, value, pnl) on the Active Positions tab in the profile modal THEN the system triggers `useFullDatasetSort` to fetch ALL pages client-side even though the `positions` Data API endpoint supports server-side `sortBy` for `AVGPRICE`, `PRICE`, `CURRENT`, `CASHPNL`, and `PERCENTPNL` — because the query does not pass `sortBy`/`sortDirection` to the server

**Prong 2 — No loading indicator for client-only sort columns:**

1.4 WHEN a user clicks the "bought" or "sold" sort column on the Closed Positions table (portfolio page or profile modal) and `useFullDatasetSort` is fetching remaining pages THEN the system displays data in raw unsorted server order with no skeleton rows or loading indicator, then suddenly reorders all rows once fetching completes — causing visible jitter

1.5 WHEN a user clicks the "price" sort column on the History table (portfolio page, profile modal, or trading terminal) and `useFullDatasetSort` is fetching remaining pages THEN the system displays data in raw unsorted server order with no skeleton rows or loading indicator, then suddenly reorders all rows once fetching completes — because the Data API activity endpoint does not support sorting by price

### Expected Behavior (Correct)

**Prong 1 — Server-side sort for supported columns:**

2.1 WHEN a user clicks the "shares" (amount) sort column on the History table (portfolio page, profile modal, or trading terminal) THEN the system SHALL pass `sortBy: "TOKENS"` and the appropriate `sortDirection` through `activityWithMarkets` to the Data API, reset the infinite query with the new sort params, and display server-sorted paginated results — without triggering `useFullDatasetSort` fetch-all

2.2 WHEN a user clicks the "value" sort column on the History table (portfolio page, profile modal, or trading terminal) THEN the system SHALL pass `sortBy: "CASH"` and the appropriate `sortDirection` through `activityWithMarkets` to the Data API, reset the infinite query with the new sort params, and display server-sorted paginated results — without triggering `useFullDatasetSort` fetch-all

2.3 WHEN a user clicks the "time" (date) sort column on the History table THEN the system SHALL pass `sortBy: "TIMESTAMP"` and the appropriate `sortDirection` through `activityWithMarkets` to the Data API, reset the infinite query with the new sort params, and display server-sorted paginated results

2.4 WHEN a user clicks the "avg" sort column on the Active Positions tab in the profile modal THEN the system SHALL pass `sortBy: "AVGPRICE"` and the appropriate `sortDirection` to the `positions` Data API endpoint, reset the infinite query, and display server-sorted paginated results — without triggering `useFullDatasetSort` fetch-all

2.5 WHEN a user clicks the "price" sort column on the Active Positions tab in the profile modal THEN the system SHALL pass `sortBy: "PRICE"` and the appropriate `sortDirection` to the `positions` Data API endpoint, reset the infinite query, and display server-sorted paginated results

2.6 WHEN a user clicks the "value" sort column on the Active Positions tab in the profile modal THEN the system SHALL pass `sortBy: "CURRENT"` and the appropriate `sortDirection` to the `positions` Data API endpoint, reset the infinite query, and display server-sorted paginated results

2.7 WHEN a user clicks the "pnl" sort column on the Active Positions tab in the profile modal THEN the system SHALL pass `sortBy: "CASHPNL"` and the appropriate `sortDirection` to the `positions` Data API endpoint, reset the infinite query, and display server-sorted paginated results

**Prong 1 — Server procedure change:**

2.8 WHEN the `activityWithMarkets` tRPC procedure receives `sortBy` and `sortDirection` input parameters THEN the system SHALL pass those values through to the underlying `getActivity` call instead of hardcoding `sortBy: "TIMESTAMP", sortDirection: "DESC"` — defaulting to `TIMESTAMP` / `DESC` when not provided

**Prong 2 — Skeleton-until-loaded for client-only sort columns:**

2.9 WHEN a user clicks the "bought" or "sold" sort column on the Closed Positions table (portfolio page or profile modal) and `useFullDatasetSort` needs to fetch remaining pages THEN the system SHALL immediately display skeleton rows in place of data rows while fetching, and only show the correctly sorted data once ALL pages are loaded — no intermediate frame of unsorted data

2.10 WHEN a user clicks the "price" sort column on the History table (portfolio page, profile modal, or trading terminal) and `useFullDatasetSort` needs to fetch remaining pages THEN the system SHALL immediately display skeleton rows in place of data rows while fetching, and only show the correctly sorted data once ALL pages are loaded — no intermediate frame of unsorted data

2.11 WHEN skeleton rows are displayed during a sort-triggered fetch-all THEN the system SHALL continue to display the table column headers (including the active sort indicator) above the skeleton rows so the user knows which sort is active

2.12 WHEN `useFullDatasetSort` completes fetching all pages for any table THEN the system SHALL transition from skeleton rows directly to correctly sorted data rows in a single render — there SHALL be no intermediate frame showing unsorted data

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user sorts the Closed Positions table by PNL or avg (columns with existing server-side sort support via REALIZEDPNL, AVGPRICE) THEN the system SHALL CONTINUE TO pass sortBy/sortDirection to the Data API and display server-sorted paginated results without fetching all pages and without showing sort-transition skeletons

3.2 WHEN a user scrolls without changing sort (default sort active) on any table THEN the system SHALL CONTINUE TO use infinite scroll pagination with lazy page loading and show fetch-next-page indicators at the bottom as before

3.3 WHEN a table is in its initial loading state (first page not yet loaded) THEN the system SHALL CONTINUE TO show the existing initial-load skeleton rows as before

3.4 WHEN all pages are already loaded (allDataLoaded is true) and the user changes sort THEN the system SHALL CONTINUE TO re-sort the data instantly in-place without showing skeletons (no fetch needed)

3.5 WHEN a user searches or filters within any table THEN the system SHALL CONTINUE TO apply the search/filter on the loaded data as before without triggering sort-transition skeletons

3.6 WHEN the History table uses its default sort (time descending) THEN the system SHALL CONTINUE TO display data in server order with infinite scroll without triggering fetch-all or showing sort-transition skeletons

3.7 WHEN the portfolio page Active Positions or Orders tabs are used THEN the system SHALL CONTINUE TO work as before — these use `useQuery` (not `useInfiniteQuery`) and are not affected by this fix

3.8 WHEN the Trades tab is displayed on any page THEN the system SHALL CONTINUE TO show no sort headers as before — sort headers were already removed from the Trades tab
