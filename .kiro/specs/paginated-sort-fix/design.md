# Paginated Sort Fix — Bugfix Design

## Overview

Sorting on paginated tables currently operates only on the pages fetched so far via `useInfiniteQuery`, producing incorrect results. The fix introduces a shared `useFullDatasetSort` hook that, when a sort is active and no server-side sort is available, auto-fetches all remaining pages before applying the client-side sort. For columns with server-side sort support (Closed Positions: `REALIZEDPNL`, `AVGPRICE`), the existing server-side sort path is preserved. Additionally, all sort headers on the Trades tab in the trading terminal are removed since sorting a real-time streaming dataset is not meaningful.

## Glossary

- **Bug_Condition (C)**: A user activates a sort on a paginated table where `hasNextPage` is true and no server-side sort is available — the client-side sort operates on a partial dataset
- **Property (P)**: When a sort is active, the displayed data reflects the sort applied to the *entire* dataset, not just loaded pages
- **Preservation**: Server-side sorting for Closed Positions (PNL, avg), default infinite scroll without sort, search/filter behavior, Trades tab display order — all must remain unchanged
- **`useInfiniteQuery`**: TanStack Query hook used across all paginated tables; exposes `fetchNextPage`, `hasNextPage`, `isFetchingNextPage`
- **`getNextPageParamForArrayPage`**: Shared helper that returns the next offset when `lastPage.length === pageSize`, or `undefined` when exhausted
- **`SortableHeader`**: Shared UI component in `@/shared/components/ui/sortable-header.tsx` that renders clickable column headers with sort indicators
- **`useFullDatasetSort`**: The new shared hook that auto-fetches all pages when a non-default sort is active

## Bug Details

### Bug Condition

The bug manifests when a user clicks a sortable column header on any paginated table that has more data than the initially loaded page(s). The client-side sort comparator runs on `infiniteData.pages.flat()` which only contains the pages fetched so far. As the user scrolls and more pages load, the sort order shifts — producing incorrect, unstable results.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { table: PaginatedTable, sortField: string | null, hasNextPage: boolean, serverSortAvailable: boolean }
  OUTPUT: boolean

  RETURN input.sortField IS NOT NULL
         AND input.sortField IS NOT the default sort field
         AND input.hasNextPage IS TRUE
         AND input.serverSortAvailable IS FALSE
END FUNCTION
```

### Examples

- User opens Portfolio → Active Positions (200+ positions), clicks "PNL" column to sort descending. Only the first page (e.g. 200 items) is sorted. The position with the highest PNL across all pages may not appear at the top.
- User opens Portfolio → Closed Positions, clicks "Bought" column. Server-side sort is NOT available for "bought" (only for PNL/avg). Only loaded pages are sorted, so the highest "bought" value may be on an unfetched page.
- User opens Profile Modal → History, clicks "Value" column. Only the first 50 activity items are sorted; the highest-value trade may be on page 3.
- User opens Trading Terminal → Trades tab, clicks "Price" column. Trades stream in real-time via WebSocket; sorting a live-updating unbounded dataset is misleading.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Server-side sorting for Closed Positions by PNL (`REALIZEDPNL`) and avg (`AVGPRICE`) must continue to pass `sortBy`/`sortDirection` to the Data API without fetching all pages
- Default infinite scroll pagination (no active sort or default sort field) must continue to lazy-load pages on scroll as before
- Search/filter within any table must continue to apply on the loaded (or fully-fetched) data as before
- Trades tab must continue to display trades in reverse chronological order (newest first) from WebSocket + API without sort controls
- The Orders tab on the trading terminal reads from the Zustand `useOrdersStore` (not paginated via infinite query) — its sort is already correct and must remain unchanged

**Scope:**
All inputs that do NOT involve clicking a non-default sort header on a paginated table with unfetched pages should be completely unaffected by this fix. This includes:
- Scrolling without sorting (default order)
- Server-side sorted columns on Closed Positions
- Non-paginated tables (trading terminal Orders tab uses Zustand store)
- Search/filter interactions

## Hypothesized Root Cause

Based on the code analysis, the root cause is straightforward:

1. **Client-side sort on partial data**: Every paginated table calls a local `sortXxx()` function on `infiniteData.pages.flat()`. This array only contains pages fetched so far. The sort is correct for the loaded subset but incorrect for the full dataset.

2. **No mechanism to fetch all pages before sorting**: The `useInfiniteQuery` hook supports `fetchNextPage()` but no table component calls it exhaustively when a sort is activated. The infinite scroll sentinel only fetches the next page when it becomes visible.

3. **Trades tab has sort headers on unbounded real-time data**: The Trades tab merges WebSocket live trades with API-fetched trades. Sorting this combined, ever-growing dataset is misleading since new trades arrive continuously.

4. **Inconsistent server-side sort usage**: Closed Positions already maps PNL→`REALIZEDPNL` and avg→`AVGPRICE` to server-side sort, but "bought" and "sold" columns fall through to client-side sort on partial data. The Profile Modal duplicates this mapping independently.

## Correctness Properties

Property 1: Bug Condition — Full Dataset Sort

_For any_ paginated table where a non-default sort is activated and no server-side sort is available, the `useFullDatasetSort` hook SHALL fetch all remaining pages (calling `fetchNextPage` until `hasNextPage` is false) before the client-side sort comparator runs, ensuring the sort reflects the entire dataset.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9**

Property 2: Preservation — Unchanged Behavior for Non-Bug Inputs

_For any_ input where the bug condition does NOT hold (default sort, server-side sort available, non-paginated table, or Trades tab), the system SHALL produce the same behavior as the original code, preserving default infinite scroll, server-side sort delegation, Zustand-based order sorting, and Trades tab reverse-chronological display.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

Property 3: Trades Tab — Sort Removal

_For any_ rendering of the Trades tab on the trading terminal, the component SHALL NOT render `SortableHeader` components or maintain sort state, displaying trades in fixed reverse-chronological order.

**Validates: Requirement 2.10**

Property 4: Loading Indicator During Fetch-All

_For any_ table where `useFullDatasetSort` is actively fetching remaining pages, the system SHALL display a loading indicator to communicate that data is being loaded for sorting.

**Validates: Requirement 2.11**

## Fix Implementation

### Changes Required

**New File**: `apps/web/src/shared/hooks/use-full-dataset-sort.ts`

**Hook**: `useFullDatasetSort`

**Specific Changes**:

1. **Create `useFullDatasetSort` hook**: A shared hook that accepts the infinite query result (`fetchNextPage`, `hasNextPage`, `isFetchingNextPage`) and the current sort state. When a non-default sort is active and `hasNextPage` is true, it triggers a loop calling `fetchNextPage()` until all pages are loaded. Exposes `isFetchingForSort: boolean` for the loading indicator and `allDataLoaded: boolean` to gate the sort.

2. **Portfolio — Active Positions (`position-table.tsx`)**: This component uses `useQuery` (not `useInfiniteQuery`) via `trpc.data.positions.queryOptions`. It fetches all positions in a single call with `sizeThreshold`. Verify that pagination is not an issue here — if the API returns all positions, no change is needed. If it is paginated, convert to `useInfiniteQuery` + `useFullDatasetSort`.

3. **Portfolio — Closed Positions (`closed-positions.tsx`)**: Integrate `useFullDatasetSort` for the "bought" and "sold" sort fields (where `apiSortBy` is null). When `apiSortBy` is set (PNL, avg), skip the hook — server handles it. Show loading indicator when fetching for sort.

4. **Portfolio — Orders (`orders-table.tsx`)**: This uses `useQuery` on `trpc.clob.getOpenOrdersWithMarkets` (not paginated via infinite query). Verify — if it returns all orders in one call, no change needed. If paginated, integrate `useFullDatasetSort`.

5. **Portfolio — History (`activity-history.tsx`)**: Integrate `useFullDatasetSort`. When any sort field is active (amount, value, price, date) and differs from default, fetch all pages before sorting.

6. **Profile Modal (`leaderboard-profile-modal.tsx`)**: Integrate `useFullDatasetSort` for Active Positions, Closed Positions (bought/sold only), and History tabs. The Closed Positions tab already maps PNL→`REALIZEDPNL` and avg→`AVGPRICE` to server sort — preserve that.

7. **Trading Terminal — History (`history-tab.tsx`)**: Integrate `useFullDatasetSort`. When sort is active on shares, price, or time (non-default), fetch all pages first.

8. **Trading Terminal — Orders (`orders-tab.tsx`)**: This reads from `useOrdersStore` (Zustand), not `useInfiniteQuery`. The data is already fully in memory. No change needed.

9. **Trading Terminal — Trades (`trades-tab.tsx`)**: Remove all `SortableHeader` imports and usage. Remove `tmSort`/`tmDir` state. Remove `onTmSort` callback. Remove `sortedTrades` memo — use `tradesWithLive` directly (already in reverse-chronological order). Replace sortable column headers with plain `<span>` labels.

10. **Loading indicator**: When `useFullDatasetSort` is fetching, render a `<Spinner>` or `<Loader2>` overlay/inline indicator near the table header or in place of the sort icon.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render paginated table components with mocked `useInfiniteQuery` data (2+ pages), activate a sort, and assert the displayed order. Run these tests on the UNFIXED code to observe that only the first page's data is sorted.

**Test Cases**:
1. **Closed Positions — Bought Sort**: Mock 2 pages of closed positions. Sort by "bought". Assert the highest "bought" value (on page 2) does NOT appear first (will fail on unfixed code)
2. **Activity History — Value Sort**: Mock 2 pages of activity. Sort by "value". Assert the highest value item (on page 2) is NOT at the top (will fail on unfixed code)
3. **Profile Modal — Active Positions Sort**: Mock 2 pages of positions. Sort by "pnl". Assert incomplete sort (will fail on unfixed code)
4. **Trading Terminal History — Price Sort**: Mock 2 pages of history. Sort by "price". Assert partial sort (will fail on unfixed code)

**Expected Counterexamples**:
- Items from unfetched pages are missing from the sorted output
- The sort order changes as more pages are loaded via scroll

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := renderTableWithSort(input.table, input.sortField)
  ASSERT allPagesLoaded(result.infiniteQuery)
  ASSERT isSortedCorrectly(result.displayedRows, input.sortField, input.sortDirection)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderTableOriginal(input) = renderTableFixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for default sort, server-side sort, and non-paginated tables, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Server-Side Sort Preservation**: Verify Closed Positions PNL/avg sort continues to pass `sortBy`/`sortDirection` to the API and does NOT trigger fetch-all
2. **Default Sort Preservation**: Verify that when no sort is active, infinite scroll pagination works exactly as before with lazy page loading
3. **Search Filter Preservation**: Verify search filtering continues to work on loaded data without triggering fetch-all
4. **Trades Tab Display Preservation**: Verify trades display in reverse-chronological order without sort controls

### Unit Tests

- Test `useFullDatasetSort` hook in isolation: verify it calls `fetchNextPage` repeatedly until `hasNextPage` is false
- Test `useFullDatasetSort` does NOT trigger fetch when sort is default or server-side sort is available
- Test `useFullDatasetSort` exposes correct `isFetchingForSort` state
- Test Trades tab renders without `SortableHeader` components

### Property-Based Tests

- Generate random datasets (varying page counts, item values) and verify `useFullDatasetSort` always produces a fully-loaded dataset before sort runs
- Generate random sort field / direction combinations and verify the sorted output matches a reference sort on the full dataset
- Generate random inputs where bug condition is false and verify no fetch-all is triggered

### Integration Tests

- Test full Portfolio → Closed Positions flow: click "bought" sort, verify loading indicator appears, verify all pages fetched, verify correct sort order
- Test Profile Modal → History: activate sort, verify fetch-all, verify correct order
- Test Trades tab: verify no sort headers rendered, verify trades display in time order
