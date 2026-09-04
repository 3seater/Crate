# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — Paginated Sort on Partial Dataset
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate sorting only operates on loaded pages
  - **Scoped PBT Approach**: Scope the property to concrete failing cases:
    - Mock a `useInfiniteQuery` result with 2+ pages where the highest-value item is on page 2
    - Activate a non-default sort (e.g. "bought" descending on Closed Positions)
    - Assert the sorted output contains ALL items from ALL pages, not just page 1
    - On unfixed code, `infiniteData.pages.flat()` only contains page 1 — sort is incomplete
  - Test file: `tests/unit/paginated-sort-fix.test.ts`
  - Test the `useFullDatasetSort` hook behavior by simulating:
    - `sortField` is non-null and non-default
    - `hasNextPage` is `true`
    - `serverSortAvailable` is `false`
    - Assert: `fetchNextPage` is called repeatedly until `hasNextPage` becomes `false`
    - Assert: sorted output reflects the entire dataset, not just loaded pages
  - Test Closed Positions "bought" sort: mock 2 pages (page 1: bought values [100, 200], page 2: [500, 50]). Sort descending. Assert 500 appears first. On unfixed code, only [200, 100] are shown.
  - Test Activity History "value" sort: mock 2 pages. Sort by value descending. Assert highest value from page 2 is at top. On unfixed code, page 2 items are missing.
  - Run test on UNFIXED code — expect FAILURE (this confirms the bug exists)
  - Document counterexamples found (e.g., "sort by bought descending shows [200, 100] instead of [500, 200, 100, 50] — page 2 items missing")
  - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Server-Side Sort, Default Scroll, and Non-Paginated Tables Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code**:
    - Closed Positions sorted by PNL → `sortBy: "REALIZEDPNL"` passed to API, no fetch-all triggered
    - Closed Positions sorted by avg → `sortBy: "AVGPRICE"` passed to API, no fetch-all triggered
    - Default sort (no column clicked) → infinite scroll lazy-loads pages on scroll as normal
    - Trading Terminal Orders tab → reads from `useOrdersStore` (Zustand), not `useInfiniteQuery` — sort is already on full dataset
    - Trades tab → displays trades in reverse-chronological order from WebSocket + API
    - Search/filter → applies on loaded data without triggering fetch-all
  - Write property-based tests capturing observed behavior patterns:
    - For all server-side sortable columns (PNL → `REALIZEDPNL`, avg → `AVGPRICE`), the API call includes `sortBy`/`sortDirection` params and `fetchNextPage` is NOT called exhaustively
    - For all tables in default sort state (no active sort), `fetchNextPage` is only called by infinite scroll sentinel, not by any sort hook
    - For the Trading Terminal Orders tab, data comes from Zustand store and sort operates on the full in-memory dataset
    - For the Trades tab, no `SortableHeader` components are rendered (after fix — but observe current behavior first: sort headers exist but are misleading)
  - Test file: `tests/unit/paginated-sort-preservation.test.ts`
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Create shared useFullDatasetSort hook

  - [x] 3.1 Implement useFullDatasetSort hook
    - Create `apps/web/src/shared/hooks/use-full-dataset-sort.ts`
    - Hook accepts: `{ fetchNextPage, hasNextPage, isFetchingNextPage }` (from `useInfiniteQuery`), `sortField: string | null`, `defaultSortField: string | null`, `serverSortAvailable: boolean`
    - When `sortField` is non-null, differs from `defaultSortField`, `hasNextPage` is `true`, and `serverSortAvailable` is `false`: trigger a `useEffect` loop calling `fetchNextPage()` until `hasNextPage` becomes `false`
    - Expose `isFetchingForSort: boolean` (true while fetch-all is in progress) and `allDataLoaded: boolean` (true when all pages fetched or no fetch needed)
    - Gate the client-side sort: only apply sort comparator when `allDataLoaded` is `true`
    - Do NOT trigger fetch-all when `sortField` is null, equals `defaultSortField`, or `serverSortAvailable` is `true`
    - _Bug_Condition: isBugCondition(input) where input.sortField != null AND input.sortField != defaultSortField AND input.hasNextPage == true AND input.serverSortAvailable == false_
    - _Expected_Behavior: fetchNextPage called until hasNextPage is false; sort runs on complete dataset_
    - _Preservation: No fetch-all for default sort, server-side sort, or non-paginated tables_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.11, 3.1, 3.2_

  - [x] 3.2 Remove sorting from Trades tab
    - In `apps/web/src/features/trading/components/market/tabs/trades-tab.tsx`:
    - Remove all `SortableHeader` imports and usage
    - Remove `tmSort`/`tmDir` state variables
    - Remove `onTmSort` callback
    - Remove `sortedTrades` memo — use `tradesWithLive` directly (already reverse-chronological)
    - Replace sortable column headers with plain `<span>` labels
    - _Requirements: 2.10, 3.5_

  - [x] 3.3 Integrate useFullDatasetSort into Portfolio Closed Positions
    - In `apps/web/src/features/portfolio/components/closed-positions.tsx`:
    - Import and call `useFullDatasetSort` with the infinite query result and current sort state
    - For "bought" and "sold" columns (where `apiSortBy` is null): hook triggers fetch-all before client sort
    - For PNL (`REALIZEDPNL`) and avg (`AVGPRICE`) columns: `serverSortAvailable` is `true`, hook is a no-op — server-side sort preserved
    - Show loading indicator when `isFetchingForSort` is `true`
    - _Requirements: 2.2, 2.12, 3.1_

  - [x] 3.4 Integrate useFullDatasetSort into Portfolio Active Positions
    - In `apps/web/src/features/portfolio/components/position-table.tsx`:
    - Verify if this component uses `useInfiniteQuery` or `useQuery` — design notes it uses `useQuery` via `trpc.data.positions.queryOptions` with `sizeThreshold`
    - If it fetches all positions in a single call, no change needed (document this)
    - If it is paginated, convert to use `useFullDatasetSort`
    - _Requirements: 2.1_

  - [x] 3.5 Integrate useFullDatasetSort into Portfolio History
    - In `apps/web/src/features/portfolio/components/activity-history.tsx`:
    - Import and call `useFullDatasetSort` with the infinite query result and current sort state
    - When any non-default sort is active (amount, value, price, date), hook fetches all pages before sort
    - Show loading indicator when `isFetchingForSort` is `true`
    - _Requirements: 2.4_

  - [x] 3.6 Verify Portfolio Orders (check if paginated)
    - In `apps/web/src/features/portfolio/components/orders-table.tsx`:
    - Verify if this uses `useInfiniteQuery` or `useQuery` on `trpc.clob.getOpenOrdersWithMarkets`
    - If it returns all orders in one call, no change needed (document this)
    - If paginated, integrate `useFullDatasetSort`
    - _Requirements: 2.3_

  - [x] 3.7 Integrate useFullDatasetSort into Profile Modal
    - In `apps/web/src/features/leaderboard/components/leaderboard-profile-modal.tsx`:
    - Integrate `useFullDatasetSort` for Active Positions tab (all sort columns)
    - Integrate for Closed Positions tab — "bought" and "sold" columns only (PNL→`REALIZEDPNL`, avg→`AVGPRICE` use server sort — preserve that)
    - Integrate for History tab (shares, value, time columns)
    - Show loading indicator when `isFetchingForSort` is `true` on any tab
    - _Requirements: 2.5, 2.6, 2.7_

  - [x] 3.8 Integrate useFullDatasetSort into Trading Terminal History tab
    - In `apps/web/src/features/trading/components/market/tabs/history-tab.tsx`:
    - Import and call `useFullDatasetSort` with the infinite query result and current sort state
    - When sort is active on shares, price, or time (non-default), fetch all pages first
    - Show loading indicator when `isFetchingForSort` is `true`
    - _Requirements: 2.8_

  - [x] 3.9 Verify Trading Terminal Orders tab (likely no change)
    - In `apps/web/src/features/trading/components/market/tabs/orders-tab.tsx`:
    - Confirm this reads from `useOrdersStore` (Zustand), not `useInfiniteQuery`
    - If data is already fully in memory, no change needed (document this)
    - _Requirements: 2.9, 3.4_

  - [x] 3.10 Add loading indicators for fetch-all state
    - When `useFullDatasetSort` returns `isFetchingForSort: true`, render a `<Loader2>` spinner or similar indicator
    - Apply to all tables that integrate the hook: Closed Positions, History, Profile Modal tabs, Trading Terminal History
    - Use existing spinner/loader component from `@/shared/components/ui/`
    - _Requirements: 2.11_

  - [x] 3.11 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — Paginated Sort on Full Dataset
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 2.6, 2.7, 2.8_

  - [x] 3.12 Verify preservation tests still pass
    - **Property 2: Preservation** — Server-Side Sort, Default Scroll, and Non-Paginated Tables Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `pnpm test:unit`
  - Verify Trades tab has no sort headers
  - Verify server-side sort columns (PNL, avg) still delegate to API
  - Verify default infinite scroll still works without fetch-all
  - Ensure all tests pass, ask the user if questions arise.
