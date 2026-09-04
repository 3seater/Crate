---
name: TanStack Query audit findings
overview: "Audit findings for TanStack Query usage across the Doji web app: what to adjust or improve for optimization/performance, rate limits, and UX/UI, based on the plan checklist and doc-derived guidance."
todos: []
isProject: false
---

# TanStack Query audit – findings and recommended changes

This plan summarizes what needs to be adjusted or improved across the codebase, grouped by **optimization/performance**, **rate limit concerns**, **UX/UI**, and **consistency/docs alignment**. No code changes are made here; this is the audit report only.

---

## 0. Real-time vs cacheable data (app context)

The app is **real-time by nature**: speed matters, and **live data** (prices, orderbook, positions, balances, open orders, recent trades) must not feel stale. At the same time, **cacheable data** (market titles, event metadata, tags, static config) can be cached longer to improve perceived speed and reduce load with **many concurrent users**.

**Policy to apply across the audit:**


| Data type     | Examples                                                                                 | staleTime                                                        | refetchInterval                                                                        | Rationale                                                                                                            |
| ------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| **Live**      | Prices, orderbook, positions, balances, open orders, live trades                         | Short (0–10s) or 0                                               | Keep short (e.g. 3–10s) where polling is required; prefer WebSocket where already used | Avoid showing outdated prices/positions; multiple users × short interval = acceptable if only for truly live queries |
| **Cacheable** | Market titles, question text, event slugs, tags, categories, public profile display name | Long (60s–5min) or higher                                        | None or long (e.g. 60s+)                                                               | Instant from cache on back-navigation; fewer requests per user at scale                                              |
| **Hybrid**    | Event list (titles + volume), leaderboard (names + values)                               | Moderate for list (30–60s); consider splitting if backend allows | None or moderate                                                                       | List structure cached; live stats can come from a separate short-staleTime query or WebSocket if needed              |


**Implications:**

- **Do not** increase refetchInterval or staleTime for **live** data (prices, orderbook, positions on trading/portfolio) just to reduce load—that would hurt correctness and UX. Keep 3s (or consider WebSocket) where data must feel real-time.
- **Do** increase staleTime and **avoid or lengthen** refetchInterval for **cacheable** data (market metadata, event list metadata, tags). That reduces server/API load at scale and makes navigation feel instant.
- **Audit each query** and tag it as live vs cacheable; then set staleTime/refetchInterval accordingly. Where a single endpoint returns both (e.g. event + volume), either accept a single policy or split into two queries if the API supports it.

---

## 1. Optimization and performance

### 1.1 Status API: `isLoading` vs `isPending` (docs alignment)

**Finding:** The codebase uses `**isLoading`** in many places. TanStack Query v5 docs prefer `**isPending`** for “no data yet” and reserve `isLoading` for “first-time fetch” (isPending && isFetching).

**Files affected (React Query usage):**

- [apps/web/src/components/portfolio/orders-table.tsx](apps/web/src/components/portfolio/orders-table.tsx) (line 394: `ordersQuery.isLoading`)
- [apps/web/src/components/portfolio/closed-positions.tsx](apps/web/src/components/portfolio/closed-positions.tsx) (407)
- [apps/web/src/components/portfolio/activity-history.tsx](apps/web/src/components/portfolio/activity-history.tsx) (506)
- [apps/web/src/components/portfolio/activity-feed.tsx](apps/web/src/components/portfolio/activity-feed.tsx) (225)
- [apps/web/src/components/portfolio/trade-history.tsx](apps/web/src/components/portfolio/trade-history.tsx) (340, 347)
- [apps/web/src/components/portfolio/bridge-activity-table.tsx](apps/web/src/components/portfolio/bridge-activity-table.tsx) (100)
- [apps/web/src/components/portfolio/position-table.tsx](apps/web/src/components/portfolio/position-table.tsx) (820)
- [apps/web/src/components/profile/profile-hover-card.tsx](apps/web/src/components/profile/profile-hover-card.tsx) (225–226, 311)
- [apps/web/src/components/leaderboard/leaderboard-profile-modal.tsx](apps/web/src/components/leaderboard/leaderboard-profile-modal.tsx) (220–224)
- [apps/web/src/components/leaderboard/leaderboard-page.tsx](apps/web/src/components/leaderboard/leaderboard-page.tsx) (160)
- [apps/web/src/components/market/market-header-trading.tsx](apps/web/src/components/market/market-header-trading.tsx) (449)
- [apps/web/src/components/layout/header-wallet-balance.tsx](apps/web/src/components/layout/header-wallet-balance.tsx) (113, 144)
- [apps/web/src/components/layout/notifications-bell.tsx](apps/web/src/components/layout/notifications-bell.tsx) (170, 199)
- [apps/web/src/components/wallet-tracker/wallet-tracker-content.tsx](apps/web/src/components/wallet-tracker/wallet-tracker-content.tsx) (476, 516)
- [apps/web/src/components/bridge/deposit-flow.tsx](apps/web/src/components/bridge/deposit-flow.tsx) (49)
- [apps/web/src/components/bridge/withdraw-flow.tsx](apps/web/src/components/bridge/withdraw-flow.tsx) (51, 75)
- [apps/web/src/hooks/use-safe-balance.ts](apps/web/src/hooks/use-safe-balance.ts) (50)
- [apps/web/src/hooks/use-watchlist.ts](apps/web/src/hooks/use-watchlist.ts) (282–283)
- [apps/web/src/components/market/tabs/trades-tab.tsx](apps/web/src/components/market/tabs/trades-tab.tsx) (64: destructures `isLoading` from useInfiniteQuery)

**Recommendation:** Prefer `**isPending`** where the intent is “no data yet” (skeleton/empty). Keep `**isLoading`** only where the intent is explicitly “first load in progress” (e.g. lazy search). Update component prop names (e.g. `isLoading` → `isPending`) in public APIs where they reflect “loading” state so callers stay consistent.

---

### 1.2 Render optimization: no `select` usage

**Finding:** No `useQuery` calls use the `**select`** option. Components that only need a **subset or derived value** (e.g. length, a single field) re-render whenever the full `data` reference changes.

**Opportunities (examples):**

- **Leaderboard count:** A component that only shows “N traders” could use `select: (data) => data.length` (with a stable selector) so it re-renders only when length changes.
- **use-portfolio-data:** Returns many derived values (totalPnl, totalVolume, winRate, etc.). Consumers that only need one of these could subscribe via a custom hook that uses `select` on the same query key to a derived value; currently the hook returns a large object and any cache update re-renders all consumers.
- **Profile hover / leaderboard modal:** Multiple queries are combined into one “loading” flag; if any component only cared about e.g. `valueQuery.data`, using `select` in a dedicated hook would limit re-renders when only other queries update.

**Recommendation:** Add `**select`** (with **useCallback** or a stable function reference) where a component or hook only needs a subset or derived value. Avoid inline select functions so the selector does not run every render.

---

### 1.3 Prefetch-only parent: `notifyOnChangeProps`

**Finding:** The plan’s “prefetch in parent to flatten waterfall” pattern suggests using `**useQuery`** in the parent with `**notifyOnChangeProps: []** so the parent does not re-render when the prefetched query updates. This pattern is **not used** anywhere.

**Recommendation:** Where a parent runs a **useQuery** only to prime the cache for a child (and does not use the result), add `**notifyOnChangeProps: []`** to avoid unnecessary parent re-renders. Identify such cases (e.g. parent fetches event list, child uses same key) and apply there.

---

### 1.4 Object rest destructuring (tracked properties)

**Finding:** No instances of **object rest destructuring** from `useQuery` / `useMutation` were found (e.g. `const { data, ...rest } = useQuery(...)`). So the “tracked properties” optimization is **not** being disabled by rest spread.

**Recommendation:** Keep destructuring to only the properties actually used. If adding an ESLint rule for rest destructuring from React Query hooks (as in the docs), it would be a safeguard only; no code change required today.

---

### 1.5 Query key consistency: hardcoded open-orders key

**Finding:** The open-orders query key is **hardcoded** in two places:

- [apps/web/src/components/market/tabs/orders-tab.tsx](apps/web/src/components/market/tabs/orders-tab.tsx): `OPEN_ORDERS_QUERY_KEY = [["clob", "getOpenOrdersWithMarkets"]]` and used in `invalidateQueries`.
- [apps/web/src/components/portfolio/orders-table.tsx](apps/web/src/components/portfolio/orders-table.tsx): same key literal in `invalidateQueries` (line 432).

**Recommendation:** Replace with `**trpc.clob.getOpenOrdersWithMarkets.queryKey()`** (or the equivalent from your tRPC setup) in both files so the key stays in sync with the procedure and input if it ever changes.

---

### 1.6 Trades tab: `removeQueries` on unmount

**Finding:** [apps/web/src/components/market/tabs/trades-tab.tsx](apps/web/src/components/market/tabs/trades-tab.tsx) (lines 103–109) calls `**queryClient.removeQueries({ queryKey: ["data", "trades", "infinite", conditionId] })** in a cleanup effect on unmount so that returning to the tab refetches the “most recent 50”.

**Assessment:** This is intentional and matches the doc note that **filters** (e.g. queryKey) can be used with **removeQueries**. No change required unless you want to keep the cache for instant back-navigation (then remove the cleanup and rely on staleTime/refetchOnMount).

---

### 1.7 use-orderbook: useQueries shape

**Finding:** [apps/web/src/hooks/use-orderbook.ts](apps/web/src/hooks/use-orderbook.ts) uses **useQueries({ queries: [...] })** with 1 or 2 items (selected token + optional complementary). Shape matches the docs (array of options; tokenIds in key).

**Recommendation:** No change. If the number of tokens grew (e.g. multi-market view), ensure **queries** array is built from a stable list so key identity is correct.

---

## 2. Rate limit and request volume (with real-time + multi-user in mind)

### 2.1 `refetchInterval: 3s` – keep for live data; reduce load where possible

**Finding:** **refetchInterval: 3000** (3 seconds) is used in five places, all for **live or near-live** data:

- [apps/web/src/components/market/tabs/positions-tab.tsx](apps/web/src/components/market/tabs/positions-tab.tsx) (120) – positions on market
- [apps/web/src/components/portfolio/position-table.tsx](apps/web/src/components/portfolio/position-table.tsx) (651) – portfolio positions
- [apps/web/src/components/trading/trading-layout-terminal.tsx](apps/web/src/components/trading/trading-layout-terminal.tsx) (178) – trading layout
- [apps/web/src/components/trading/trading-layout.tsx](apps/web/src/components/trading/trading-layout.tsx) (150) – trading layout
- [apps/web/src/components/trading/trading-workspace.tsx](apps/web/src/components/trading/trading-workspace.tsx) (162) – trading workspace

**Context:** For a **real-time** app, 3s for positions/trading is reasonable so prices and positions don’t feel stale. With **multiple users**, total request volume = N users × (1/3s) per query. So the lever is: (1) keep 3s only for **truly live** queries, and (2) avoid polling when the tab is in the background.

**Recommendations:**

- **Keep 3s** for positions/trading queries that must feel live (no blanket increase that would make data stale).
- **Reduce background load:** Set **refetchIntervalInBackground: false** for these queries so polling stops when the tab is hidden; refetch on **window focus** will refresh when the user returns. That cuts load from users with many tabs open.
- **Avoid refetchInterval on cacheable data:** Ensure no **cacheable**-only queries (market titles, event list metadata, tags) use a short refetchInterval. If any do, remove it or set a long interval (60s+).
- **Optional:** Slightly longer interval (e.g. 5s) for portfolio position-table if 3s is not a hard requirement, trading off freshness vs load; document the choice.

---

### 2.2 Cacheable data: avoid short staleTime and polling

**Finding:** With **multiple users**, requests for **cacheable** data (market titles, event metadata, tags) should be minimized. Any query that only (or mostly) returns static-ish metadata should have **long staleTime** (e.g. 60s–5min) and **no refetchInterval** (or very long), so repeat visits and back-navigation are served from cache.

**Recommendation:** Audit queries that fetch **market by slug**, **event list** (titles/slugs), **tags**, **public profile** (display name, avatar), etc. Ensure they use **staleTime** ≥ 60s (or the existing constants like HOVER_STALE_TIME / ENRICHMENT_STALE_TIME) and do **not** use refetchInterval. That keeps live data fast and cacheable data cheap at scale.

---

### 2.3 events-discovery: waterfall (initial list → tradeCountsByMarket)

**Finding:** [apps/web/src/components/explore/events-discovery.tsx](apps/web/src/components/explore/events-discovery.tsx) runs:

1. **initialQuery** (events.list) with limit/offset/filters.
2. **tradeCountsQuery** (data.tradeCountsByMarket) with **enabled: eventIds.length > 0**, where `eventIds` is derived from **initialQuery.data** (allEvents).

So the second query waits for the first. That’s a **serial waterfall**: list then trade counts.

**Recommendation:** For better performance and lower perceived latency, consider a **backend endpoint** that returns the event list and per-event (or per-market) trade counts in one response, or a **batch** that the client calls in parallel once it has event IDs (if the backend supports batching). Alternatively, accept the waterfall but ensure **staleTime** on the list is sufficient so repeat visits don’t refetch unnecessarily.

---

### 2.4 use-portfolio-data: many parallel queries

**Finding:** [apps/web/src/app/portfolio/use-portfolio-data.ts](apps/web/src/app/portfolio/use-portfolio-data.ts) runs **8 useQuery** calls in parallel (value, publicProfile, positions, trades, closedPositions, getOpenOrdersWithMarkets, usdcBalance, getBalanceAllowance). All use **PORTFOLIO_STALE_TIME = 5000** and most run unconditionally (orders and balanceAllowance use **enabled: tradingReady**).

**Assessment:** Parallel useQuery is correct and matches the docs. Request volume is bounded by **staleTime** and **enabled**. No change required unless the backend or CLOB has per-user rate limits; then consider slightly higher staleTime or batching on the server.

---

### 2.5 Profile hover card and leaderboard modal: 6+ queries

**Finding:** [apps/web/src/components/profile/profile-hover-card.tsx](apps/web/src/components/profile/profile-hover-card.tsx) and [apps/web/src/components/leaderboard/leaderboard-profile-modal.tsx](apps/web/src/components/leaderboard/leaderboard-profile-modal.tsx) each run **multiple useQuery** hooks (publicProfile, value, positions, closedPositions, trades, leaderboard, etc.) with **enabled: Boolean(address)** or **enabled: open && !!address**.

**Assessment:** Queries are gated by visibility/address; opening the card/modal triggers a burst of N requests. Acceptable for UX; if rate limits become an issue, consider a single **aggregate profile** API that returns the needed fields in one call.

---

## 3. UX / UI

### 3.1 Trade history pagination: no placeholderData

**Finding:** [apps/web/src/components/portfolio/trade-history.tsx](apps/web/src/components/portfolio/trade-history.tsx) uses **useQuery** with **offset: page * MAX_PAGE_SIZE** in the key. When the user clicks “Next” or “Previous”, **page** changes, the key changes, and the query refetches. There is **no placeholderData** (e.g. keepPreviousData).

**UX impact:** The table goes to a loading skeleton on every page change instead of showing the previous page until the next page is ready.

**Recommendation:** Add **placeholderData: keepPreviousData** (and, if the UI needs to disable “Next” while the new page is loading, use **isPlaceholderData** from the result). This matches the pattern used in [leaderboard-page.tsx](apps/web/src/app/leaderboard/leaderboard-page.tsx) and [event-table-cells.tsx](apps/web/src/components/explore/event-table-cells.tsx).

---

### 3.2 events-discovery “load more”: manual refetch vs useInfiniteQuery

**Finding:** Events-discovery uses an **initial** events.list query plus a **second** useQuery with **enabled: false** and manual **refetch()** for “load more”. Results are merged into local state (**allEvents**, **setAllEvents**).

**UX/consistency:** This works but duplicates “infinite list” logic. The docs recommend **useInfiniteQuery** for infinite scroll (single cache, **data.pages** / **getNextPageParam** / **fetchNextPage**), which gives consistent loading states and cache shape.

**Recommendation:** Consider migrating to **useInfiniteQuery** for events.list (same endpoint, pageParam = offset). That would simplify state (no local allEvents/offset/hasMore) and align with trades-tab and doc patterns. Lower priority if the current UX is acceptable.

---

### 3.3 Error handling and mutation throwOnError

**Finding:** Mutations (user-menu, add-track-wallet, wallet-tracker, use-watchlist) do **not** set **throwOnError: true**. Errors are handled via try/catch and toasts.

**Recommendation:** No change required unless you want **all** mutation errors to propagate to an Error Boundary (e.g. for a global error UI). Then set **throwOnError: true** on those mutations and wrap the app (or routes) with **QueryErrorResetBoundary** + Error Boundary with **onReset={reset}** so “Try again” resets the query and retries.

---

### 3.4 Loading states: isFetching for “refreshing” indicator

**Finding:** The docs suggest using **isFetching** for a subtle “Refreshing…” indicator when data is already on screen. Some components use **isLoading** only; global-search and events-discovery use **isFetching** where appropriate.

**Recommendation:** In list/table components that show data and refetch in the background (e.g. positions, orders, activity), consider exposing **isFetching** and showing a small “Refreshing…” or spinner when **isFetching && !isPending** so users know data is updating without seeing a full skeleton.

---

## 4. Other (consistency and docs alignment)

### 4.1 Server query client (getQueryClient)

**Finding:** [apps/web/src/lib/trpc/query-client.ts](apps/web/src/lib/trpc/query-client.ts) sets only **staleTime: 30_000**; it does not set **gcTime**. The docs note that on the server, gcTime often defaults to Infinity and the client is short-lived.

**Recommendation:** Confirm whether the server **QueryClient** should set **gcTime** explicitly (e.g. to match client 300_000 or leave default). For RSC prefetch, leaving default is usually fine; document the choice.

---

### 4.2 Explore page: prefetch + HydrationBoundary

**Finding:** [apps/web/src/app/explore/page.tsx](apps/web/src/app/explore/page.tsx) uses **getQueryClient()**, **prefetchQuery(trpc.events.list.queryOptions(...))**, **dehydrate(queryClient)**, and **HydrationBoundary**. Errors are handled with try/catch and a fallback UI (MarketsError).

**Assessment:** Aligns with docs: prefetch for critical data, dehydrate + hydrate, and **prefetchQuery** used for non-throwing prefetch (errors handled in page). No change required.

---

### 4.3 Invalidation key style: queryKey() vs queryOptions().queryKey

**Finding:** Most invalidations use **trpc.path.queryKey()** (procedure prefix). [use-watchlist.ts](apps/web/src/hooks/use-watchlist.ts) uses **trpc.watchlist.list.queryOptions().queryKey**. Both are valid and equivalent when input is not needed for the key.

**Recommendation:** Standardize on one style (e.g. **queryKey()** for invalidation when you want prefix match, **queryOptions().queryKey** when you need the exact key including input). Optional cleanup for consistency.

---

### 4.4 Global search request burst (no debounce)

**Finding:** [apps/web/src/components/layout/global-search.tsx](apps/web/src/components/layout/global-search.tsx) calls `trpc.events.search` on every keystroke once `query.trim().length >= 2` (no debounce), while typing quickly.

**Impact:** In a multi-user setting, this causes bursty request volume and can trigger rate limiting or elevated tail latency on search endpoints.

**Recommendation:** Add a small debounce (e.g. 200–300ms) before enabling query execution (or debounce the query input key), and keep `isFetching` UI for responsiveness. This preserves perceived speed while reducing QPS materially.

---

### 4.5 Query key stability for array inputs (sort before query key)

**Finding:** Some queries use array inputs where order may vary across renders:

- [apps/web/src/hooks/use-open-interest.ts](apps/web/src/hooks/use-open-interest.ts): `markets: string[]`
- [apps/web/src/components/layout/notifications-bell.tsx](apps/web/src/components/layout/notifications-bell.tsx): `condition_ids: conditionIds`

If the same set is provided in different orders, React Query treats it as a different key.

**Impact:** Cache misses and unnecessary refetches under heavy UI churn.

**Recommendation:** Sort/dedupe array inputs used in query options before passing to `queryOptions` (stable canonical order). This keeps cache hits high and avoids duplicate traffic.

---

### 4.6 Notifications fan-out query sizing

**Finding:** In [apps/web/src/components/layout/notifications-bell.tsx](apps/web/src/components/layout/notifications-bell.tsx), `conditionIds` is derived from all notifications before display slicing, and `markets.list` is requested with `limit: conditionIds.length || 1`.

**Impact:** For users with many notifications, opening the bell can trigger a larger metadata fetch than necessary.

**Recommendation:** Build `conditionIds` from only the notifications that are actually rendered (e.g. top 50), then cap `limit` to that same upper bound. This improves bell-open latency and reduces server load.

---

### 4.7 High-payload polling in wallet tracker

**Finding:** [apps/web/src/components/wallet-tracker/wallet-tracker-content.tsx](apps/web/src/components/wallet-tracker/wallet-tracker-content.tsx) polls `wallets.activity` every 30s with `limit: 2000` and also polls values every 30s.

**Impact:** Heavy payload polling can become expensive with concurrent users, especially when most refreshes carry mostly unchanged data.

**Recommendation:** Keep 30s cadence if UX requires it, but reduce payload by polling a lightweight delta endpoint (new since timestamp) or smaller page for auto-refresh while leaving “load more” for historical pages. If backend changes are out of scope, lower the polled page size for auto-refresh and merge with local accumulated list.

---

### 4.8 State updates during render around query results

**Finding:** Render-time state sync patterns are used around query data in places like:

- [apps/web/src/components/explore/events-discovery.tsx](apps/web/src/components/explore/events-discovery.tsx) (`setAllEvents`, `setOffset`, `setHasMore` in render guard)
- [apps/web/src/components/wallet-tracker/wallet-tracker-content.tsx](apps/web/src/components/wallet-tracker/wallet-tracker-content.tsx) (`setAccumulatedTrades`, `setTradesOffset` in render guard)

**Impact:** Extra render passes and harder-to-predict update behavior; under frequent query updates this can cost UI smoothness.

**Recommendation:** Move query-to-local-state syncing into `useEffect` keyed on query data + pagination params, or replace with `useInfiniteQuery` / derived memoized state where possible. This reduces render churn and improves responsiveness under live updates.

---

## 5. Summary table


| Area                                  | Priority | Action                                                                                                                             |
| ------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Real-time vs cacheable**            | High     | Tag each query as live vs cacheable; live = short staleTime / keep 3s polling; cacheable = long staleTime, no refetchInterval.     |
| **refetchInterval 3s (live)**         | Medium   | Keep 3s for live data; add **refetchIntervalInBackground: false** to reduce load when tab hidden; ensure no cacheable query polls. |
| **Cacheable queries**                 | Medium   | Audit market/event/tags/profile metadata queries; set staleTime ≥ 60s and no (or long) refetchInterval for multi-user scale.       |
| **isLoading → isPending**             | Medium   | Prefer isPending for “no data”; update ~20 call sites and any public prop names.                                                   |
| **Trade-history placeholderData**     | Medium   | Add placeholderData: keepPreviousData (+ isPlaceholderData if needed).                                                             |
| **Open-orders key**                   | Low      | Replace hardcoded key with trpc.clob.getOpenOrdersWithMarkets.queryKey() in orders-tab and orders-table.                           |
| **select for subset/derived**         | Low      | Add select (memoized) where only a subset/derived value is needed (e.g. leaderboard count, portfolio summary).                     |
| **notifyOnChangeProps: []**           | Low      | Use in parents that only prefetch for children.                                                                                    |
| **events-discovery waterfall**        | Low      | Consider backend aggregate or batch; or document and keep.                                                                         |
| **events-discovery useInfiniteQuery** | Low      | Optional migration from “load more” refetch to useInfiniteQuery.                                                                   |
| **isFetching “Refreshing”**           | Low      | Add subtle refresh indicator where lists refetch in background.                                                                    |
| **Server gcTime**                     | Low      | Document or set gcTime in getQueryClient if desired.                                                                               |
| **Global search debounce**            | High     | Debounce `events.search` input (200–300ms) to reduce per-keystroke request bursts across concurrent users.                         |
| **Array key canonicalization**        | Medium   | Sort/dedupe array inputs (e.g. `markets`, `condition_ids`) before queryOptions to maximize cache hits and avoid duplicate fetches. |
| **Notifications fan-out limit**       | Medium   | Build market metadata fetch from rendered notification subset only; cap `limit` (e.g. 50).                                         |
| **Wallet tracker polling payload**    | Medium   | Avoid polling very large pages (`limit: 2000`) every 30s; prefer delta/smaller refresh + load-more for history.                    |
| **Render-time state syncing**         | Medium   | Move query→state synchronization out of render (into effects or infinite-query patterns) to cut re-render churn.                   |


---

## 6. Suggested implementation order

1. **Real-time vs cacheable:** Classify each query as live or cacheable (see §0). Ensure **live** (prices, orderbook, positions, balances, orders) keep short staleTime and 3s refetch where needed; **cacheable** (titles, metadata, tags) get long staleTime and no short refetchInterval.
2. **Multi-user quick wins:** Add debounce to `events.search`; canonicalize array inputs (`markets`, `condition_ids`) before query options; cap notifications metadata fetch to rendered subset.
3. **Background + polling control:** Add **refetchIntervalInBackground: false** to polling queries where appropriate; keep live freshness but stop hidden-tab polling.
4. **Quick wins:** Open-orders key → `trpc.clob.getOpenOrdersWithMarkets.queryKey()`; trade-history → **placeholderData: keepPreviousData**.
5. **Heavy-query optimization:** Reduce wallet-tracker auto-refresh payload (avoid polling huge pages); prefer delta/smaller refresh plus load-more history.
6. **Docs alignment:** Systematic **isLoading** → **isPending** where “no data yet” is meant; add **isFetching** refresh indicators for live lists if desired.
7. **Optimization/refactor:** Introduce **select** for subset/derived where it helps; add **notifyOnChangeProps: []** for prefetch-only parents; move query-to-state syncing out of render.
8. **Optional:** events-discovery → useInfiniteQuery; backend option for list + trade counts in one call.

