# Smooth Sort Loading — Bugfix Design

## Overview

Sorting on paginated tables across the portfolio page, profile modal, and trading terminal suffers from two distinct problems. First, columns that have server-side sort support (activity history: shares/value/time; active positions: avg/price/value/pnl) are unnecessarily fetched client-side via `useFullDatasetSort` because the `activityWithMarkets` tRPC procedure hardcodes `sortBy: "TIMESTAMP", sortDirection: "DESC"` and the profile modal's active positions query never passes sort params despite the `positions` endpoint supporting them. Second, columns with no server-side sort (closed positions: bought/sold; activity history: price) display raw unsorted data during the `useFullDatasetSort` fetch-all, then suddenly reorder — causing visible jitter.

The fix is two-pronged: (1) wire server-side sort for columns that support it so they paginate smoothly without fetch-all, and (2) show skeleton rows until all data is loaded for columns that must remain client-only.

## Glossary

- **Bug_Condition (C)**: Either (a) a sort column with available server-side support is handled client-side due to missing sort param passthrough, or (b) a client-only sort column shows unsorted data during fetch-all instead of skeletons
- **Property (P)**: (a) Server-sortable columns pass `sortBy`/`sortDirection` through to the API and paginate without fetch-all; (b) client-only sort columns show skeleton rows during fetch-all instead of unsorted data
- **Preservation**: Existing server-side sort for closed positions PNL/avg, default sort behavior, initial load skeletons, instant re-sort when all data loaded, search/filter, portfolio active positions/orders (useQuery), trades tab (no sort headers) — all unchanged
- **`activityWithMarkets`**: tRPC procedure in `apps/server/src/features/data/router.ts` (~line 592) that wraps the Data API `getActivity` call. Currently hardcodes `sortBy: "TIMESTAMP", sortDirection: "DESC"`
- **`positions`**: tRPC procedure in `apps/server/src/features/data/router.ts` that wraps `getPositions`. Already accepts `sortBy`/`sortDirection` in its input schema (CURRENT, INITIAL, TOKENS, CASHPNL, PERCENTPNL, PRICE, AVGPRICE)
- **`useFullDatasetSort`**: Shared hook in `shared/hooks/use-full-dataset-sort.ts` that auto-fetches all pages when a non-default, non-server-side sort is active; exposes `isFetchingForSort` and `allDataLoaded`
- **Sort-transition skeleton**: Skeleton rows shown in place of data rows while `useFullDatasetSort` fetches remaining pages for a client-only sort
- **`serverSortAvailable`**: Boolean passed to `useFullDatasetSort` — when true, the hook skips fetch-all because the server handles sorting

## Bug Details

### Bug Condition

Two distinct conditions trigger the bug:

**Condition A — Server sort not wired:** The `activityWithMarkets` procedure hardcodes sort params, so all activity history sort columns (shares→TOKENS, value→CASH, time→TIMESTAMP) trigger `useFullDatasetSort` fetch-all even though the Data API supports them. Similarly, the profile modal's active positions query never passes `sortBy`/`sortDirection` to the `positions` procedure despite it supporting AVGPRICE, PRICE, CURRENT, CASHPNL.

**Condition B — No loading indicator for client-only sort:** When a user sorts by a column with no server-side mapping (closed positions: bought/sold; activity history: price), `useFullDatasetSort` fetches all pages but the table renders raw unsorted data during the fetch because the sort comparator is gated behind `allDataLoaded`.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type {
    table: "activityHistory" | "profilePositions" | "closedPositions",
    sortField: string | null,
    defaultSortField: string | null,
    apiSortMapping: Record<string, string | null>,
    serverSortCurrentlyWired: boolean,
    allDataLoaded: boolean,
    hasData: boolean
  }
  OUTPUT: boolean

  // Condition A: server sort available in API but not wired through
  apiSortBy := apiSortMapping[input.sortField]
  IF apiSortBy IS NOT NULL AND NOT input.serverSortCurrentlyWired THEN
    RETURN TRUE
  END IF

  // Condition B: client-only sort shows unsorted data during fetch-all
  IF apiSortBy IS NULL
     AND input.sortField IS NOT NULL
     AND input.sortField !== input.defaultSortField
     AND input.allDataLoaded IS FALSE
     AND input.hasData IS TRUE
  THEN
    RETURN TRUE
  END IF

  RETURN FALSE
END FUNCTION
```

### Examples

**Prong 1 examples (server sort not wired):**
- User opens Portfolio → History, clicks "Shares" column. The `activityWithMarkets` procedure ignores the sort and hardcodes `sortBy: "TIMESTAMP"`. `useFullDatasetSort` fetches all pages client-side. Expected: pass `sortBy: "TOKENS"` to the API, paginate normally.
- User opens Profile Modal → Active Positions, clicks "PNL" sort. The query never passes `sortBy: "CASHPNL"` to the `positions` endpoint. `useFullDatasetSort` fetches all pages. Expected: pass `sortBy: "CASHPNL"` to the API, paginate normally.
- User opens Trading Terminal → History tab, clicks "Time" column to reverse sort direction. The procedure hardcodes `sortBy: "TIMESTAMP", sortDirection: "DESC"`. Expected: pass `sortBy: "TIMESTAMP", sortDirection: "ASC"` to the API.

**Prong 2 examples (client-only sort jitter):**
- User opens Portfolio → Closed Positions (3 pages), clicks "Bought" column. `apiSortBy` is null, `allDataLoaded` is false. Table shows unsorted data for ~1-2s, then suddenly reorders. Expected: skeleton rows during fetch, then sorted data.
- User opens Portfolio → History, clicks "Price" column. Price has no server-side sort mapping (`price: null`). Table shows data in server order, then jumps. Expected: skeleton rows during fetch, then sorted data.
- User opens Profile Modal → History, clicks "Price" sort. Same jitter. Expected: skeleton rows until all pages loaded.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Closed Positions sort by PNL (`REALIZEDPNL`) and avg (`AVGPRICE`) must continue to pass `sortBy`/`sortDirection` to the Data API and display server-sorted paginated results without fetch-all or sort-transition skeletons
- Default sort behavior (no sort active, or sort equals default field) must continue to display data in server order with infinite scroll pagination
- Initial page load skeletons (when `isLoading` / `isPending` is true, first page not yet loaded) must continue to render as before
- When all pages are already loaded (`allDataLoaded` is true) and the user changes sort, data must re-sort instantly in-place without showing skeletons
- Search/filter within any table must continue to apply on loaded data without triggering sort-transition skeletons
- Default sort on History table ("date"/"time" descending) must not trigger fetch-all or sort-transition skeletons
- Portfolio page Active Positions and Orders tabs must continue to work as before — they use `useQuery` (not `useInfiniteQuery`) and are not affected
- Trades tab must continue to show no sort headers as before

**Scope:**
All inputs where neither bug condition holds should be completely unaffected. This includes:
- Server-side sorted columns on Closed Positions (PNL, avg — already wired)
- Default sort field active (no fetch-all needed)
- All data already loaded (instant re-sort)
- Initial page load (existing skeleton path)
- Search/filter interactions
- Portfolio Active Positions / Orders (useQuery, not paginated)
- Trades tab (no sort headers)

## Hypothesized Root Cause

Based on code analysis, there are two distinct root causes corresponding to the two prongs:

### Root Cause 1: `activityWithMarkets` hardcodes sort params

In `apps/server/src/features/data/router.ts` (~line 592), the `activityWithMarkets` procedure's input schema does not include `sortBy` or `sortDirection`. The procedure hardcodes:
```typescript
sortBy: "TIMESTAMP",
sortDirection: "DESC",
```
in the `getActivity()` call. Even though the underlying Data API `activity` endpoint supports `sortBy: "TIMESTAMP" | "TOKENS" | "CASH"` and `sortDirection: "ASC" | "DESC"`, the client has no way to pass these through.

On the client side, all three activity history consumers (portfolio `activity-history.tsx`, profile modal, trading terminal `history-tab.tsx`) set `serverSortAvailable: false` on `useFullDatasetSort` because they know the procedure doesn't accept sort params — so every non-default sort triggers a full client-side fetch-all.

Similarly, the profile modal's active positions query calls `trpcClient.data.positions.query(...)` without passing `sortBy`/`sortDirection`, even though the `positions` procedure already accepts them (CURRENT, INITIAL, TOKENS, CASHPNL, PERCENTPNL, PRICE, AVGPRICE). The modal sets `serverSortAvailable: false`, causing fetch-all for every sort.

### Root Cause 2: No skeleton path for sort-transition fetch-all

When `useFullDatasetSort` is fetching remaining pages (`allDataLoaded` is false), each component skips the sort comparator and renders raw unsorted data:

- `closed-positions.tsx`: `const sorted = serverSorted || !allDataLoaded ? data : sortClosedPositions(...)` — when `!allDataLoaded`, raw `data` is rendered
- `activity-history.tsx`: `const sorted = allDataLoaded ? sortActivity(...) : data` — when `!allDataLoaded`, raw `data` is rendered
- `leaderboard-profile-modal.tsx`: `sortedPositions`, `sortedHistory`, `sortedClosedPositions` memos all return unsorted data when their respective `allLoaded` flag is false

The `useFullDatasetSort` hook exposes `isFetchingForSort` but no component consumes it. There is no code path that shows skeletons during a sort-triggered fetch-all.

## Correctness Properties

Property 1: Server Sort Wiring — Activity History

_For any_ sort action on the activity history table (portfolio, profile modal, or trading terminal) where the sort column maps to a Data API sort value (shares→TOKENS, value→CASH, time→TIMESTAMP), the system SHALL pass `sortBy` and `sortDirection` through the `activityWithMarkets` procedure to the Data API, include the sort params in the infinite query key to trigger a refetch, and display server-sorted paginated results without triggering `useFullDatasetSort` fetch-all.

**Validates: Requirements 2.1, 2.2, 2.3, 2.8**

Property 2: Server Sort Wiring — Profile Modal Active Positions

_For any_ sort action on the profile modal Active Positions tab (avg→AVGPRICE, price→PRICE, value→CURRENT, pnl→CASHPNL), the system SHALL pass `sortBy` and `sortDirection` to the `positions` Data API endpoint, include the sort params in the infinite query key, set `serverSortAvailable: true` on `useFullDatasetSort`, and display server-sorted paginated results without fetch-all. The `useFullDatasetSort` hook call for positions SHALL be removed since all position sort columns have server support.

**Validates: Requirements 2.4, 2.5, 2.6, 2.7**

Property 3: Skeleton-Until-Loaded — Client-Only Sort Columns

_For any_ table where a client-only sort is active (closed positions: bought/sold; activity history: price) AND `allDataLoaded` is false AND data exists, the component SHALL render skeleton rows with table headers visible above them instead of unsorted data rows. The transition SHALL go directly from skeletons to correctly sorted data in a single render with no intermediate unsorted frame.

**Validates: Requirements 2.9, 2.10, 2.11, 2.12**

Property 4: Preservation — Unchanged Behavior

_For any_ input where neither bug condition holds (existing server-side sort on closed positions PNL/avg, default sort active, all data already loaded, initial page load, search/filter, portfolio active positions/orders via useQuery, trades tab), the system SHALL produce the same behavior as the original code.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

The fix spans two prongs: server-side sort wiring (procedure + client query changes) and skeleton-until-loaded for client-only columns.

---

### Prong 1: Server-Side Sort Wiring

**File**: `apps/server/src/features/data/router.ts`

**Procedure**: `activityWithMarkets`

**Specific Changes**:
1. **Add sort params to input schema**: Add `sortBy: z.enum(["TIMESTAMP", "TOKENS", "CASH"]).optional()` and `sortDirection: z.enum(["ASC", "DESC"]).optional()` to the input Zod schema
2. **Pass through to `getActivity()`**: Replace the hardcoded `sortBy: "TIMESTAMP", sortDirection: "DESC"` with `sortBy: input.sortBy ?? "TIMESTAMP"` and `sortDirection: input.sortDirection ?? "DESC"` — defaulting to TIMESTAMP/DESC when not provided

---

**File**: `apps/web/src/features/portfolio/components/activity-history.tsx`

**Component**: `ActivityHistory`

**Specific Changes**:
1. **Add sort field → API sort mapping**: Define `const ACTIVITY_SORT_API: Record<string, "TOKENS" | "CASH" | "TIMESTAMP" | null> = { amount: "TOKENS", value: "CASH", date: "TIMESTAMP", price: null }`
2. **Derive `apiSortBy`**: Compute `apiSortBy = sortField ? (ACTIVITY_SORT_API[sortField] ?? null) : null` and `apiSortDirection = apiSortBy ? sortDirection.toUpperCase() as "ASC" | "DESC" : undefined`
3. **Include sort params in query key**: Add `apiSortBy` and `apiSortDirection` to `activityInfiniteQueryKey` so TanStack Query refetches when sort changes
4. **Pass sort params in query function**: Add `...(apiSortBy ? { sortBy: apiSortBy, sortDirection: apiSortDirection } : {})` to the `trpcClient.data.activityWithMarkets.query()` call
5. **Set `serverSortAvailable`**: Change `useFullDatasetSort` call to `serverSortAvailable: Boolean(apiSortBy)` — true for shares/value/time, false for price

---

**File**: `apps/web/src/features/leaderboard/components/leaderboard-profile-modal.tsx`

**Section**: History tab query

**Specific Changes**:
1. **Add sort field → API sort mapping**: Define `const HIST_SORT_API: Record<string, "TOKENS" | "CASH" | "TIMESTAMP" | null> = { shares: "TOKENS", value: "CASH", time: "TIMESTAMP" }` (no price column in profile modal history)
2. **Derive `histApiSortBy`**: Compute from `histSort.key` using the mapping
3. **Include sort params in query key**: Add `histApiSortBy` and `histApiSortDirection` to `historyInfiniteQueryKey`
4. **Pass sort params in query function**: Add to `trpcClient.data.activityWithMarkets.query()` call
5. **Set `serverSortAvailable`**: Change history `useFullDatasetSort` call to `serverSortAvailable: Boolean(histApiSortBy)`

**Section**: Active Positions query

**Specific Changes**:
1. **Add sort field → API sort mapping**: Define `const POS_SORT_API: Record<string, string> = { avg: "AVGPRICE", price: "PRICE", value: "CURRENT", pnl: "CASHPNL" }`
2. **Derive `posApiSortBy`**: Compute from `posSort?.key` using the mapping
3. **Include sort params in query key**: Add `posApiSortBy` and `posApiSortDirection` to `positionsInfiniteQueryKey`
4. **Pass sort params in query function**: Add `...(posApiSortBy ? { sortBy: posApiSortBy, sortDirection: posApiSortDirection } : {})` to `trpcClient.data.positions.query()` call
5. **Set `serverSortAvailable: true`**: All position sort columns have server support
6. **Remove `useFullDatasetSort` for positions**: Since all columns are server-sorted, the hook is no longer needed for positions. Remove the `useFullDatasetSort` call for positions and set `posAllLoaded` to `true` (or remove the gating in `sortedPositions` memo)

---

**File**: `apps/web/src/features/trading/components/market/tabs/history-tab.tsx`

**Component**: `HistoryTab`

**Specific Changes**:
1. **Add sort field → API sort mapping**: Define `const HIST_SORT_API: Record<string, "TOKENS" | "TIMESTAMP" | null> = { shares: "TOKENS", time: "TIMESTAMP", price: null }`
2. **Derive `apiSortBy`**: Compute from `histSort` using the mapping
3. **Include sort params in query key**: Add `apiSortBy` and `apiSortDirection` to `historyInfiniteQueryKey`
4. **Pass sort params in query function**: Add to `trpcClient.data.activityWithMarkets.query()` call
5. **Set `serverSortAvailable`**: Change `useFullDatasetSort` call to `serverSortAvailable: Boolean(apiSortBy)` — true for shares/time, false for price

---

### Prong 2: Skeleton-Until-Loaded for Client-Only Sort Columns

For each table that still has client-only sort columns after Prong 1, add a skeleton path when `!allDataLoaded && !serverSorted && sortField !== defaultSortField && data.length > 0`.

**File**: `apps/web/src/features/portfolio/components/closed-positions.tsx`

**Function**: `ClosedPositionsContent`

**Specific Changes**:
1. Compute `showSortSkeletons = !allDataLoaded && !serverSorted && sortField !== "PNL" && data && data.length > 0`
2. After the `isLoading` / `isError` / empty checks, if `showSortSkeletons` is true, render `<TableHeader>` + `<PortfolioClosedPositionSkeletonRows>` and return early
3. Existing sort logic remains unchanged for all other cases

---

**File**: `apps/web/src/features/portfolio/components/activity-history.tsx`

**Function**: `ActivityHistoryContent`

**Specific Changes**:
1. Add `serverSorted` prop (or derive from existing `allDataLoaded` + sort field context)
2. Compute `showSortSkeletons = !allDataLoaded && sortField !== "date" && !serverSorted && data && data.length > 0` — this only triggers for the `price` column (the only client-only column after Prong 1)
3. After the `isLoading` / `isError` / empty checks, if `showSortSkeletons` is true, render `<TableHeader>` + `<ActivityHistorySkeletonRows>` and return early

---

**File**: `apps/web/src/features/leaderboard/components/leaderboard-profile-modal.tsx`

**Section**: Closed Positions tab body

**Specific Changes**:
1. After the `closedPending` skeleton check, add: if `!closedApiSortBy && !closedAllLoaded && closedPositions.length > 0`, render the closed positions header + inline skeleton rows
2. Reuses the existing inline skeleton JSX pattern already present in the modal

**Section**: History tab body

**Specific Changes**:
1. After the `historyActivityPending` skeleton check, add: if `!histApiSortBy && !histAllLoaded && activityHistory.length > 0`, render the history header + inline skeleton rows
2. This only triggers when sorting by a column with no server mapping (if any exist in the profile modal history — currently all history columns map to server sort, so this is a safety net)

---

**File**: `apps/web/src/features/trading/components/market/tabs/history-tab.tsx`

**Component**: `HistoryTab`

**Specific Changes**:
1. Compute `showSortSkeletons = !histAllLoaded && !Boolean(apiSortBy) && histSort !== "time" && activity.length > 0` — triggers only for the `price` column
2. When `showSortSkeletons` is true, render the table header + `<TableSkeleton>` instead of unsorted data rows

---

### What NOT to Change

- `useFullDatasetSort` hook itself — it works correctly as-is
- Closed Positions PNL/avg server sort — already wired and working
- Portfolio Active Positions / Orders tabs — use `useQuery`, not paginated
- Trades tab — sort headers already removed
- Default sort behavior on all tables

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate both bugs on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate both bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan — Prong 1**: Inspect the `activityWithMarkets` procedure to confirm sort params are hardcoded. Write tests that call the procedure with sort params and verify they are ignored (params not in schema). Inspect profile modal positions query to confirm `sortBy`/`sortDirection` are not passed.

**Test Plan — Prong 2**: Write component tests that render content components with `allDataLoaded=false`, a non-default client-only sort active, and data present. Assert that unsorted data rows are rendered (demonstrating the jitter bug).

**Test Cases**:
1. **Activity History — Shares Sort (Prong 1)**: Verify `activityWithMarkets` input schema does not accept `sortBy` — confirming the server sort is not wired
2. **Profile Modal — Positions Sort (Prong 1)**: Verify the positions query call does not include `sortBy`/`sortDirection` — confirming server sort is not wired for positions
3. **Closed Positions — Bought Sort (Prong 2)**: Render `ClosedPositionsContent` with `allDataLoaded=false`, `sortField="bought"`, `serverSorted=false`, and mock data. Assert data rows rendered (not skeletons) — confirming the jitter bug
4. **Activity History — Price Sort (Prong 2)**: Render `ActivityHistoryContent` with `allDataLoaded=false`, `sortField="price"`, and mock data. Assert data rows rendered — confirming the jitter bug

**Expected Counterexamples**:
- Prong 1: `activityWithMarkets` always returns TIMESTAMP-sorted data regardless of client sort selection; positions query always returns default-sorted data
- Prong 2: Unsorted data rows visible when `allDataLoaded` is false and a client-only sort is active; no skeleton rows present

### Fix Checking

**Goal**: Verify that for all inputs where either bug condition holds, the fixed code produces the expected behavior.

**Pseudocode — Prong 1:**
```
FOR ALL sortField IN ["shares", "value", "time"] DO
  apiSortBy := ACTIVITY_SORT_API[sortField]
  result := activityWithMarkets({ ..., sortBy: apiSortBy, sortDirection: "DESC" })
  ASSERT result is sorted by apiSortBy in DESC order
  ASSERT useFullDatasetSort NOT triggered (serverSortAvailable = true)
END FOR

FOR ALL posSort IN ["avg", "price", "value", "pnl"] DO
  apiSortBy := POS_SORT_API[posSort]
  result := positions({ ..., sortBy: apiSortBy, sortDirection: "DESC" })
  ASSERT result is sorted by apiSortBy in DESC order
  ASSERT useFullDatasetSort NOT used for positions
END FOR
```

**Pseudocode — Prong 2:**
```
FOR ALL input WHERE isClientOnlySort(input) AND NOT allDataLoaded AND hasData DO
  result := renderComponent(input)
  ASSERT skeletonRowsVisible(result)
  ASSERT tableHeaderVisible(result)
  ASSERT NOT unsortedDataRowsVisible(result)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where neither bug condition holds, the fixed code produces the same result as the original.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT renderOriginal(input) = renderFixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for server-side sort (closed positions PNL/avg), default sort, all-data-loaded, and initial-load states, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Closed Positions Server Sort Preservation**: Verify PNL and avg sort continue to pass `sortBy`/`sortDirection` to the API without showing sort-transition skeletons
2. **Default Sort Preservation**: Verify all tables with default sort active do NOT trigger fetch-all or show sort-transition skeletons
3. **All Data Loaded Preservation**: Verify that when `allDataLoaded=true` and sort changes, data re-sorts instantly without skeletons
4. **Initial Load Preservation**: Verify `isLoading=true` still shows existing initial-load skeleton path unchanged
5. **Activity History Default (time desc) Preservation**: Verify the default time-descending sort on activity history now passes `sortBy: "TIMESTAMP", sortDirection: "DESC"` to the API (same as the previous hardcoded behavior) — no behavioral change
6. **Portfolio Active Positions / Orders Preservation**: Verify these tabs continue to work with `useQuery` unchanged

### Unit Tests

- Test `activityWithMarkets` procedure accepts and passes through `sortBy`/`sortDirection`
- Test `activityWithMarkets` defaults to TIMESTAMP/DESC when sort params not provided
- Test each client component's sort field → API sort mapping is correct
- Test `ClosedPositionsContent` renders skeletons when `showSortSkeletons` condition is true
- Test `ActivityHistoryContent` renders skeletons when `showSortSkeletons` condition is true (price column)
- Test that `TableHeader` is rendered above skeleton rows (headers remain visible)
- Test that existing `isLoading` skeleton path is unchanged
- Test that `serverSorted=true` bypasses sort-transition skeletons

### Property-Based Tests

- Generate random combinations of `{sortField, apiSortMapping, serverSortAvailable, allDataLoaded, hasData}` and verify: when server sort is available, sort params are passed to API; when client-only sort and not loaded, skeletons shown; otherwise original behavior preserved
- Generate random sort field transitions on activity history and verify query key changes when sort changes (triggering refetch)

### Integration Tests

- Test full activity history flow: click "Shares" sort, verify query includes `sortBy: "TOKENS"` and data is server-sorted without fetch-all
- Test full activity history flow: click "Price" sort, verify skeleton transition (client-only column)
- Test profile modal active positions: click "PNL" sort, verify query includes `sortBy: "CASHPNL"` without fetch-all
- Test profile modal closed positions: click "Bought" sort, verify skeleton transition
- Test trading terminal history: click "Shares" sort, verify query includes `sortBy: "TOKENS"`
- Test trading terminal history: click "Price" sort, verify skeleton transition
