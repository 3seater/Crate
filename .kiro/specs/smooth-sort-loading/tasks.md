# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** — Server Sort Not Wired + Unsorted Data During Client-Only Sort
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms both bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples demonstrating (a) server sort params are ignored/missing and (b) unsorted data rows render instead of skeletons during client-only sort fetch-all
  - Test file: `tests/unit/smooth-sort-loading-bug.test.ts`
  - **Prong 1 — Server sort not wired:**
    - **activityWithMarkets input schema**: Verify the `activityWithMarkets` tRPC procedure input schema does NOT accept `sortBy` or `sortDirection` — confirming sort params cannot be passed through to the Data API. On UNFIXED code this will FAIL (schema rejects sort params).
    - **Portfolio Activity History — shares sort**: Verify that `ActivityHistory` component's `useFullDatasetSort` call has `serverSortAvailable: false` for `sortField="amount"` — confirming fetch-all is triggered even though the API supports `sortBy: "TOKENS"`. On UNFIXED code this will FAIL.
    - **Profile Modal — Active Positions sort**: Verify that the positions infinite query does NOT include `sortBy`/`sortDirection` params when `posSort={key:"pnl",dir:"desc"}` — confirming server sort is not wired despite the `positions` endpoint supporting `CASHPNL`. On UNFIXED code this will FAIL.
    - **Trading Terminal — History sort**: Verify that `HistoryTab` component's `useFullDatasetSort` call has `serverSortAvailable: false` for `histSort="shares"` — confirming fetch-all is triggered. On UNFIXED code this will FAIL.
  - **Prong 2 — No skeleton during client-only sort:**
    - **Closed Positions — "bought" sort**: Render `ClosedPositionsContent` with `allDataLoaded=false`, `sortField="bought"`, `serverSorted=false`, mock data present. Assert skeleton rows are rendered (not unsorted data rows). On UNFIXED code this will FAIL because unsorted data rows are shown instead.
    - **Activity History — "price" sort**: Render `ActivityHistoryContent` with `allDataLoaded=false`, `sortField="price"`, mock data present. Assert skeleton rows are rendered. On UNFIXED code this will FAIL because unsorted data rows are shown.
    - **Profile Modal — Closed Positions "bought" sort**: Verify that when `closedApiSortBy=null`, `closedAllLoaded=false`, and closed positions data exists, skeleton rows appear instead of unsorted data. On UNFIXED code this will FAIL.
    - **Profile Modal — History "price" sort (safety net)**: Verify that when a client-only sort column is active, `histAllLoaded=false`, and history data exists, skeleton rows appear. On UNFIXED code this will FAIL.
    - **Trading Terminal — History "price" sort**: Verify that when `histSort="price"`, `histAllLoaded=false`, and activity data exists, skeleton rows appear instead of unsorted data. On UNFIXED code this will FAIL.
  - Run tests on UNFIXED code — expect FAILURE (this confirms both bugs exist)
  - Document counterexamples found
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Non-Bug-Condition Inputs Produce Unchanged Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code**:
    - Closed Positions with `serverSorted=true` (PNL, avg) → data rows render as-is, sort params passed to API, no skeletons
    - Activity History with `sortField="date"` (default) → data rows render in server order, no fetch-all triggered
    - Any table with `allDataLoaded=true` and non-default sort → data re-sorts instantly in-place, no skeletons
    - Any table with `isLoading=true` → existing initial-load skeleton path renders as before
    - Any table with empty data (`data.length === 0`) → empty state component renders, not skeletons
    - `activityWithMarkets` with no sort params → defaults to `sortBy: "TIMESTAMP", sortDirection: "DESC"` (same as current hardcoded behavior)
    - Portfolio Active Positions / Orders tabs → continue to work with `useQuery` unchanged
  - Test file: `tests/unit/smooth-sort-loading-preservation.test.ts`
  - Write property-based tests capturing observed behavior patterns:
    - **Closed Positions Server Sort Preservation**: For Closed Positions with `serverSorted=true` (PNL, avg), data rows render without sort-transition skeletons, sort params passed to API
    - **Default Sort Preservation**: For Activity History with `sortField="date"` (default), data rows render without sort-transition skeletons or fetch-all
    - **All Data Loaded Preservation**: When `allDataLoaded=true` and a non-default sort is active, data re-sorts instantly — no skeletons shown
    - **Initial Load Preservation**: When `isLoading=true`, the existing initial-load skeleton path renders unchanged
    - **Empty State Preservation**: When data is empty, the empty state component renders — not sort-transition skeletons
    - **activityWithMarkets Default Sort Preservation**: When no sort params provided, procedure defaults to TIMESTAMP/DESC (same as current behavior)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_


- [x] 3. Prong 1 — Wire server-side sort

  - [x] 3.1 Add `sortBy`/`sortDirection` to `activityWithMarkets` input schema and pass through to `getActivity`
    - In `apps/server/src/features/data/router.ts`, `activityWithMarkets` procedure:
    - Add `sortBy: z.enum(["TIMESTAMP", "TOKENS", "CASH"]).optional()` and `sortDirection: z.enum(["ASC", "DESC"]).optional()` to the input Zod schema
    - Replace hardcoded `sortBy: "TIMESTAMP", sortDirection: "DESC"` with `sortBy: input.sortBy ?? "TIMESTAMP"` and `sortDirection: input.sortDirection ?? "DESC"`
    - Default behavior is unchanged when params not provided
    - _Bug_Condition: activityWithMarkets hardcodes sort params, ignoring client sort selection_
    - _Expected_Behavior: pass sortBy/sortDirection through to getActivity, default to TIMESTAMP/DESC_
    - _Preservation: No sort params provided → same TIMESTAMP/DESC behavior as before_
    - _Requirements: 2.8_

  - [x] 3.2 Wire sort params in Portfolio Activity History
    - In `apps/web/src/features/portfolio/components/activity-history.tsx`:
    - Add `const ACTIVITY_SORT_API: Record<string, "TOKENS" | "CASH" | "TIMESTAMP" | null> = { amount: "TOKENS", value: "CASH", date: "TIMESTAMP", price: null }`
    - Derive `apiSortBy = sortField ? (ACTIVITY_SORT_API[sortField] ?? null) : null` and `apiSortDirection`
    - Include `apiSortBy` and `apiSortDirection` in `activityInfiniteQueryKey`
    - Pass `...(apiSortBy ? { sortBy: apiSortBy, sortDirection: apiSortDirection } : {})` in the `trpcClient.data.activityWithMarkets.query()` call
    - Change `useFullDatasetSort` to `serverSortAvailable: Boolean(apiSortBy)` — true for shares/value/time, false for price
    - _Bug_Condition: serverSortAvailable always false, fetch-all triggered for shares/value/time_
    - _Expected_Behavior: server-sorted paginated results for shares/value/time; client-only for price_
    - _Preservation: Default sort (date desc) passes TIMESTAMP/DESC — same as before_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Wire sort params in Profile Modal History
    - In `apps/web/src/features/leaderboard/components/leaderboard-profile-modal.tsx`, History tab section:
    - Add `const HIST_SORT_API: Record<string, "TOKENS" | "CASH" | "TIMESTAMP" | null> = { shares: "TOKENS", value: "CASH", time: "TIMESTAMP" }`
    - Derive `histApiSortBy` from `histSort.key` using the mapping
    - Include `histApiSortBy` and `histApiSortDirection` in `historyInfiniteQueryKey`
    - Pass sort params in `trpcClient.data.activityWithMarkets.query()` call
    - Change history `useFullDatasetSort` to `serverSortAvailable: Boolean(histApiSortBy)`
    - _Bug_Condition: serverSortAvailable always false for history, fetch-all triggered for shares/value/time_
    - _Expected_Behavior: server-sorted paginated results for all mapped columns_
    - _Preservation: Default sort (time desc) passes TIMESTAMP/DESC — same as before_
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Wire sort params in Profile Modal Active Positions + remove `useFullDatasetSort` for positions
    - In `apps/web/src/features/leaderboard/components/leaderboard-profile-modal.tsx`, Active Positions section:
    - Add `const POS_SORT_API: Record<string, string> = { avg: "AVGPRICE", price: "PRICE", value: "CURRENT", pnl: "CASHPNL" }`
    - Derive `posApiSortBy` from `posSort?.key` using the mapping
    - Include `posApiSortBy` and `posApiSortDirection` in `positionsInfiniteQueryKey`
    - Pass `...(posApiSortBy ? { sortBy: posApiSortBy, sortDirection: posApiSortDirection } : {})` in `trpcClient.data.positions.query()` call
    - Remove the `useFullDatasetSort` call for positions — all position sort columns have server support
    - Set `posAllLoaded` to `true` directly (or remove the gating in `sortedPositions` memo)
    - _Bug_Condition: positions query never passes sortBy/sortDirection despite endpoint supporting them_
    - _Expected_Behavior: server-sorted paginated results for avg/price/value/pnl; no fetch-all needed_
    - _Preservation: No sort active → default server order unchanged_
    - _Requirements: 2.4, 2.5, 2.6, 2.7_

  - [x] 3.5 Wire sort params in Trading Terminal History
    - In `apps/web/src/features/trading/components/market/tabs/history-tab.tsx`:
    - Add `const HIST_SORT_API: Record<string, "TOKENS" | "TIMESTAMP" | null> = { shares: "TOKENS", time: "TIMESTAMP", price: null }`
    - Derive `apiSortBy` from `histSort` using the mapping
    - Include `apiSortBy` and `apiSortDirection` in `historyInfiniteQueryKey`
    - Pass sort params in `trpcClient.data.activityWithMarkets.query()` call
    - Change `useFullDatasetSort` to `serverSortAvailable: Boolean(apiSortBy)` — true for shares/time, false for price
    - _Bug_Condition: serverSortAvailable always false, fetch-all triggered for shares/time_
    - _Expected_Behavior: server-sorted paginated results for shares/time; client-only for price_
    - _Preservation: Default sort (time desc) passes TIMESTAMP/DESC — same as before_
    - _Requirements: 2.1, 2.3_

- [x] 4. Prong 2 — Skeleton-until-loaded for client-only sort columns

  - [x] 4.1 Add `showSortSkeletons` early-return in Portfolio Closed Positions
    - In `apps/web/src/features/portfolio/components/closed-positions.tsx`, `ClosedPositionsContent`:
    - After the `isLoading` / `isError` / empty-data early returns, compute: `const showSortSkeletons = !allDataLoaded && !serverSorted && sortField !== "PNL" && data && data.length > 0`
    - When `showSortSkeletons` is true, render `<TableHeader>` + `<PortfolioClosedPositionSkeletonRows>` and return early
    - Existing sort logic and all other code paths remain unchanged
    - _Bug_Condition: !allDataLoaded AND !serverSorted AND sortField is "bought" or "sold"_
    - _Expected_Behavior: skeleton rows with table header visible above them_
    - _Preservation: Server-side sort (PNL, avg), default sort, all-data-loaded instant re-sort, initial load skeletons — all unchanged_
    - _Requirements: 2.9, 2.11, 2.12, 3.1, 3.3, 3.4_

  - [x] 4.2 Add `showSortSkeletons` early-return in Portfolio Activity History
    - In `apps/web/src/features/portfolio/components/activity-history.tsx`, `ActivityHistoryContent`:
    - Add `serverSorted` prop (derived from `Boolean(apiSortBy)` in parent)
    - After the `isLoading` / `isError` / empty-data early returns, compute: `const showSortSkeletons = !allDataLoaded && sortField !== "date" && !serverSorted && data && data.length > 0`
    - This only triggers for the `price` column (the only client-only column after Prong 1)
    - When `showSortSkeletons` is true, render `<TableHeader>` + `<ActivityHistorySkeletonRows>` and return early
    - Existing sort logic and all other code paths remain unchanged
    - _Bug_Condition: !allDataLoaded AND sortField is "price" AND !serverSorted_
    - _Expected_Behavior: skeleton rows with table header visible above them_
    - _Preservation: Default sort ("date"), server-sorted columns, all-data-loaded instant re-sort, initial load skeletons — all unchanged_
    - _Requirements: 2.10, 2.11, 2.12, 3.2, 3.3, 3.4, 3.6_

  - [x] 4.3 Add skeleton path in Profile Modal Closed Positions tab
    - In `apps/web/src/features/leaderboard/components/leaderboard-profile-modal.tsx`, Closed Positions tab body:
    - After the `closedPending` skeleton check, add: if `!closedApiSortBy && !closedAllLoaded && closedPositions.length > 0`, render the closed positions header + inline skeleton rows
    - Reuses existing inline skeleton JSX pattern already present in the modal
    - _Bug_Condition: !closedApiSortBy (bought/sold) AND !closedAllLoaded AND data exists_
    - _Expected_Behavior: skeleton rows with column headers visible_
    - _Preservation: Server-side sort on closed positions (PNL, avg) unchanged_
    - _Requirements: 2.9, 2.11, 2.12, 3.1_

  - [x] 4.4 Add skeleton safety net in Profile Modal History tab
    - In `apps/web/src/features/leaderboard/components/leaderboard-profile-modal.tsx`, History tab body:
    - After the `historyActivityPending` skeleton check, add: if `!histApiSortBy && !histAllLoaded && activityHistory.length > 0`, render the history header + inline skeleton rows
    - Currently all profile modal history columns map to server sort after Prong 1, so this is a safety net for any future unmapped columns
    - _Bug_Condition: client-only sort column active AND !histAllLoaded AND data exists_
    - _Expected_Behavior: skeleton rows with column headers visible_
    - _Preservation: Server-sorted columns unchanged_
    - _Requirements: 2.10, 2.11, 2.12_

  - [x] 4.5 Add skeleton path in Trading Terminal History
    - In `apps/web/src/features/trading/components/market/tabs/history-tab.tsx`:
    - Compute `showSortSkeletons = !histAllLoaded && !Boolean(apiSortBy) && histSort !== "time" && activity.length > 0`
    - This triggers only for the `price` column (the only client-only column after Prong 1)
    - When `showSortSkeletons` is true, render the table header + `<TableSkeleton>` instead of unsorted data rows
    - _Bug_Condition: histSort is "price" AND !histAllLoaded AND data exists_
    - _Expected_Behavior: skeleton rows with sort headers visible_
    - _Preservation: Default sort (time desc), server-sorted columns — unchanged_
    - _Requirements: 2.10, 2.11, 2.12_

- [x] 5. Verify fix

  - [x] 5.1 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** — Server Sort Wired + Sort-Transition Skeletons Rendered
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior for both prongs
    - When these tests pass, it confirms both bugs are fixed
    - Run bug condition exploration tests from step 1
    - **EXPECTED OUTCOME**: Tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

  - [x] 5.2 Verify preservation tests still pass
    - **Property 2: Preservation** — Non-Bug-Condition Inputs Produce Unchanged Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 6. Checkpoint — Ensure all tests pass
  - Run full test suite: `pnpm test:unit`
  - Verify Prong 1: activity history sort columns (shares/value/time) pass `sortBy`/`sortDirection` to API without fetch-all
  - Verify Prong 1: profile modal active positions sort columns pass `sortBy`/`sortDirection` to API, `useFullDatasetSort` removed for positions
  - Verify Prong 1: trading terminal history sort columns (shares/time) pass `sortBy`/`sortDirection` to API without fetch-all
  - Verify Prong 1: `activityWithMarkets` defaults to TIMESTAMP/DESC when no sort params provided
  - Verify Prong 2: sort-transition skeletons appear for client-only columns (closed positions bought/sold, activity history price)
  - Verify Prong 2: table headers remain visible above skeleton rows
  - Verify preservation: closed positions PNL/avg server sort unchanged
  - Verify preservation: default sort on each table does not trigger fetch-all or skeletons
  - Verify preservation: `allDataLoaded=true` re-sorts instantly without skeletons
  - Verify preservation: initial load skeletons (`isLoading=true`) unchanged
  - Ensure all tests pass, ask the user if questions arise.
