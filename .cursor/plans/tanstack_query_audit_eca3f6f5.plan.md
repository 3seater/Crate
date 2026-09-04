---
name: TanStack Query audit
overview: Audit all TanStack Query usage in the Doji web app against best practices, then align findings and fixes with the documentation you provide. The codebase uses TanStack Query v5 with tRPC integration across 40+ files; the plan maps current patterns and audit dimensions so your docs can drive the final checklist and remediation.
todos: []
isProject: false
---

# TanStack Query codebase audit plan

## Current state summary

- **Version:** `@tanstack/react-query` ^5.90.21 ([apps/web/package.json](apps/web/package.json)).
- **Integration:** tRPC via `createTRPCOptionsProxy`; queries use `trpc.path.queryOptions(input)` and optional overrides (`enabled`, `staleTime`, etc.). See [apps/web/src/lib/trpc/index.ts](apps/web/src/lib/trpc/index.ts) for `QueryClient` defaults (`staleTime: 30_000`, `gcTime: 300_000`, custom retry and `QueryCache.onError`).
- **Scope:** ~45 files in `apps/web/src` use `useQuery`, `useMutation`, `useQueryClient`, `useQueries`, or `useInfiniteQuery`. Provider is in [apps/web/src/components/providers.tsx](apps/web/src/components/providers.tsx). Server prefetch uses [apps/web/src/lib/trpc/query-client.ts](apps/web/src/lib/trpc/query-client.ts) (`getQueryClient()` per request).

---

## TanStack Query usage inventory (reference for doc alignment)

### 1. APIs and imports


| API                   | Import source           | Where used                                                                                                                                                                                                                                                          |
| --------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `useQuery`            | `@tanstack/react-query` | 35+ components/hooks                                                                                                                                                                                                                                                |
| `useMutation`         | `@tanstack/react-query` | add-track-wallet-modal-provider, user-menu, wallet-tracker-content, use-watchlist                                                                                                                                                                                   |
| `useQueryClient`      | `@tanstack/react-query` | positions-tab, redeem-tab, order-form.hooks, quick-sell-modal, position-table, deposit-status-tracker, withdraw-status-tracker, trades-tab, use-prefetch-market, use-split-merge, add-track-wallet-modal-provider, wallet-tracker-content, user-menu, use-watchlist |
| `useInfiniteQuery`    | `@tanstack/react-query` | trades-tab only                                                                                                                                                                                                                                                     |
| `useQueries`          | `@tanstack/react-query` | use-orderbook only                                                                                                                                                                                                                                                  |
| `QueryClient`         | `@tanstack/react-query` | lib/trpc/index.ts, lib/trpc/query-client.ts                                                                                                                                                                                                                         |
| `QueryClientProvider` | `@tanstack/react-query` | providers.tsx                                                                                                                                                                                                                                                       |
| `QueryCache`          | `@tanstack/react-query` | lib/trpc/index.ts (onError)                                                                                                                                                                                                                                         |
| `keepPreviousData`    | `@tanstack/react-query` | leaderboard-page, event-table-cells (used as `placeholderData: keepPreviousData`)                                                                                                                                                                                   |


**Direct `queryClient` usage (no hook):** orders-tab.tsx, withdraw-flow.tsx, orders-table.tsx (import from `@/lib/trpc` for imperative invalidation).

### 2. Configuration

**Client-side** ([apps/web/src/lib/trpc/index.ts](apps/web/src/lib/trpc/index.ts)): `new QueryClient({ defaultOptions, queryCache })` — `staleTime: 30_000`, `gcTime: 300_000`, custom `retry`, `QueryCache.onError` (toast + optional retry action).

**Server-side** ([apps/web/src/lib/trpc/query-client.ts](apps/web/src/lib/trpc/query-client.ts)): `getQueryClient()` returns fresh `QueryClient` with only `staleTime: 30_000`. Used in explore/page.tsx for prefetch.

**Provider** ([apps/web/src/components/providers.tsx](apps/web/src/components/providers.tsx)): `<QueryClientProvider client={queryClient}>`.

### 3. Query usage by file

Pattern: `useQuery({ ...trpc.<router>.<procedure>.queryOptions(input), enabled?, staleTime?, gcTime?, placeholderData?, retry? })`.


| File                                                 | Queries                                                                                                                                                                                   | Notes                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| app/portfolio/use-portfolio-data.ts                  | value, publicProfile, positions, trades, closedPositions, getOpenOrdersWithMarkets, usdcBalance, getBalanceAllowance                                                                      | PORTFOLIO_STALE_TIME=5000; custom retry on profile; orders+balanceAllowance `enabled: tradingReady`     |
| app/leaderboard/leaderboard-page.tsx                 | leaderboard                                                                                                                                                                               | `placeholderData: keepPreviousData`                                                                     |
| app/explore/page.tsx                                 | (prefetch) events.list                                                                                                                                                                    | RSC prefetch only                                                                                       |
| components/portfolio/*                               | activity, leaderboard, positions, ctfTokenBalances, activityWithMarkets, bridge.inboundUsdcTransfers, getOpenOrdersWithMarkets, closedPositions, data.trades                              | Various enabled/staleTime; position-table, redeem-tab, orders-table use useQueryClient for invalidation |
| components/profile/profile-hover-card.tsx            | publicProfile, value, positions, closedPositions, trades, leaderboard                                                                                                                     | HOVER_STALE_TIME; all `enabled: Boolean(address)`                                                       |
| components/market/tabs/*                             | positions, ctfTokenBalances, getBySlug, useInfiniteQuery(trades), activityWithMarkets, holders, getOpenOrdersWithMarkets (imperative)                                                     | positions-tab/orders-tab/trades-tab/history-tab/holders-tab; orders-tab uses OPEN_ORDERS_QUERY_KEY      |
| components/market/*                                  | market-tabs positions; market-header-trading liveVolume, openInterest, getBySlug; quick-sell getTickSize, getOrderBook; related-tags getTags                                              | Various staleTimes                                                                                      |
| components/trading/*                                 | getMidpoint, positions, ctfTokenBalances (layout/workspace/terminal); order-form.hooks getBalanceAllowance, getTickSize, calculateMarketPrice, getFeeRate; related-markets relatedMarkets | order-form.hooks invalidates on mutation success                                                        |
| components/charts/use-trade-markers.ts               | trades                                                                                                                                                                                    | safeAddress, conditionId; staleTime 60_000                                                              |
| components/explore/*                                 | event-table-cells getPricesHistory, getById, getBySlug; events-discovery events.list x2, tradeCountsByMarket                                                                              | keepPreviousData in event-table-cells; events-discovery manual “load more” (enabled: false + refetch)   |
| components/calendar/calendar-widget.tsx              | calendarList, list                                                                                                                                                                        | open; staleTime 5min; gcTime 10min                                                                      |
| components/bridge/*                                  | deposit/withdraw-flow supportedAssets; deposit/withdraw-status-tracker bridge.status                                                                                                      | Status trackers invalidate balance/allowance                                                            |
| components/layout/*                                  | notifications-bell getNotifications, markets.list; global-search events.search; header-wallet-balance value, getBalanceAllowance                                                          | Notifications: placeholderData from persisted                                                           |
| components/auth/user-menu.tsx                        | checkApprovalStatus                                                                                                                                                                       | clearSafeMutation + invalidate                                                                          |
| components/add-track-wallet-modal-provider.tsx       | publicProfile                                                                                                                                                                             | addMutation invalidates wallets.list, activity, values                                                  |
| components/wallet-tracker/wallet-tracker-content.tsx | publicProfile, wallets.list, activity, values                                                                                                                                             | updateMutation, removeMutation invalidate list/activity/values                                          |
| components/leaderboard/leaderboard-profile-modal.tsx | publicProfile, positions, activityWithMarkets, value, leaderboard, traded                                                                                                                 | All `enabled: open && !!address`                                                                        |
| hooks/use-orderbook.ts                               | useQueries(getOrderBook per tokenId)                                                                                                                                                      | Dynamic token list                                                                                      |
| hooks/use-prefetch-market.ts                         | prefetchQuery getBySlug, getPricesHistory                                                                                                                                                 | Not useQuery                                                                                            |
| hooks/use-safe-balance.ts                            | data.usdcBalance                                                                                                                                                                          | enabled: Boolean(safeAddress); returns query.isLoading                                                  |
| hooks/use-split-merge.ts                             | (no useQuery)                                                                                                                                                                             | useQueryClient only; invalidates many keys                                                              |
| hooks/use-watchlist.ts                               | watchlist.list, markets.list, data.positions                                                                                                                                              | useMutation x2; invalidate queryOptions().queryKey                                                      |
| hooks/use-trading-init.ts                            | auth.me                                                                                                                                                                                   | enabled: Boolean(sessionToken)                                                                          |
| hooks/use-open-interest.ts                           | data.openInterest                                                                                                                                                                         | enabled: markets.length > 0; staleTime 60_000                                                           |
| hooks/use-comments.ts                                | events.comments                                                                                                                                                                           | Returns isLoading                                                                                       |


### 4. Mutation usage


| File                                | Mutation                         | Invalidations                               |
| ----------------------------------- | -------------------------------- | ------------------------------------------- |
| auth/user-menu.tsx                  | clearSafeMutation                | trpc.auth.checkApprovalStatus.queryKey()    |
| add-track-wallet-modal-provider.tsx | addMutation                      | wallets.list, activity, values              |
| wallet-tracker-content.tsx          | updateMutation, removeMutation   | wallets.list, activity, values              |
| use-watchlist.ts                    | toggleMutation, clearAllMutation | trpc.watchlist.list.queryOptions().queryKey |


No mutations use `throwOnError` in current code.

### 5. Invalidation patterns

- **Procedure-level:** `trpc.data.positions.queryKey()`, `trpc.data.value.queryKey()`, etc. — used in position-table, redeem-tab, positions-tab, quick-sell-modal, order-form.hooks, withdraw-flow, status-trackers, user-menu, use-split-merge, wallet-tracker, add-track-wallet.
- **Options-based:** `trpc.watchlist.list.queryOptions().queryKey` in use-watchlist.
- **Hardcoded:** `OPEN_ORDERS_QUERY_KEY = [["clob","getOpenOrdersWithMarkets"]]` in orders-tab (could use `trpc.clob.getOpenOrdersWithMarkets.queryKey()`).

### 6. Options used across queries

**enabled** — Used for address, safeAddress, conditionId, tokenId, open, sessionToken, tradingReady, etc.

**staleTime** — Per-query: 5s, 10s, 30s, 60s, 5min; constants: PORTFOLIO_STALE_TIME, HOVER_STALE_TIME, ENRICHMENT_STALE_TIME.

**gcTime** — Global 300_000; overridden in calendar-widget (10min).

**placeholderData** — `keepPreviousData` (leaderboard-page, event-table-cells); custom in notifications-bell.

**retry** — Custom in use-portfolio-data (publicProfile); global default in lib/trpc.

**refetchOnMount** — trades-tab: `"always"`.

### 7. tRPC integration

- `createTRPCOptionsProxy` so `trpc.path.queryOptions(input)` and `trpc.path.queryKey()` exist.
- Single shared `queryClient` from lib/trpc for provider and imperative invalidation.
- Only explore page uses RSC prefetch: `getQueryClient()` + `prefetchQuery(trpc.events.list.queryOptions(...))`.

---

## Audit dimensions (to validate against your docs)

### 1. Query options and API usage

- **queryOptions pattern:** Most calls spread `trpc.*.queryOptions(...)` and add `enabled`, `staleTime`, or `gcTime`. A few pass only `queryOptions` (e.g. [deposit-flow.tsx](apps/web/src/components/bridge/deposit-flow.tsx), [withdraw-flow.tsx](apps/web/src/components/bridge/withdraw-flow.tsx)).
- **keepPreviousData:** Used in [leaderboard-page.tsx](apps/web/src/app/leaderboard/leaderboard-page.tsx) and [event-table-cells.tsx](apps/web/src/components/explore/event-table-cells.tsx) as `placeholderData: keepPreviousData`. Confirm with your docs whether v5 recommends this or a different placeholder strategy.
- **Loading flags:** Codebase uses `isLoading` (initial load) and `isFetching` / `isFetchingNextPage` where appropriate. TanStack Query v5 prefers `isPending` over `isLoading` in the API; audit should check if your docs require a rename and update call sites (many components expose or consume `isLoading` in props).

### 2. Conditional and dependent queries

- **enabled:** Used consistently for auth-dependent or input-dependent queries (e.g. `enabled: Boolean(safeAddress)`, `enabled: open && !!address`). A few queries run always (e.g. [trade-history.tsx](apps/web/src/components/portfolio/trade-history.tsx) has no `enabled` and no pagination key in the options, so refetches may not be scoped by page).
- **events-discovery.tsx:** Uses an “initial” query plus a second `useQuery` with `enabled: false` and manual `refetch()` for “load more” instead of `useInfiniteQuery`. Your docs may recommend standardizing on `useInfiniteQuery` for infinite scroll.

### 3. Mutations and invalidation

- **useMutation:** Used in [user-menu.tsx](apps/web/src/components/auth/user-menu.tsx), [add-track-wallet-modal-provider.tsx](apps/web/src/components/add-track-wallet-modal-provider.tsx), [wallet-tracker-content.tsx](apps/web/src/components/wallet-tracker/wallet-tracker-content.tsx), [use-watchlist.ts](apps/web/src/hooks/use-watchlist.ts). Mutations invalidate via `queryClient.invalidateQueries({ queryKey: trpc.path.queryKey() })` or `queryOptions().queryKey`.
- **Orders tab:** [orders-tab.tsx](apps/web/src/components/market/tabs/orders-tab.tsx) uses imperative `queryClient` and `trpcClient` from `@/lib/trpc` (no hooks) for cancel; invalidation uses a hand-written `OPEN_ORDERS_QUERY_KEY`. Should be checked for consistency with tRPC key helpers (e.g. `trpc.clob.getOpenOrdersWithMarkets.queryKey()`).
- **throwOnError / error handling:** Mutations do not consistently use `throwOnError`; some rely on try/catch and toast. Audit should align with your docs on mutation error handling and optional `throwOnError`.

### 4. Query keys and consistency

- **tRPC-driven keys:** Most invalidation uses `trpc.path.queryKey()` (procedure prefix). A few use `trpc.path.queryOptions().queryKey` (e.g. [use-watchlist.ts](apps/web/src/hooks/use-watchlist.ts)). Both are valid; docs may prefer one for consistency.
- **Hardcoded key:** `OPEN_ORDERS_QUERY_KEY` in orders-tab; could be replaced with `trpc.clob.getOpenOrdersWithMarkets.queryKey()` to avoid drift.

### 5. useQueries and useInfiniteQuery

- **useQueries:** [use-orderbook.ts](apps/web/src/hooks/use-orderbook.ts) builds dynamic query options for multiple token orderbooks; structure is appropriate for dynamic token lists.
- **useInfiniteQuery:** [trades-tab.tsx](apps/web/src/components/market/tabs/trades-tab.tsx) uses it correctly with `getNextPageParam` and `fetchNextPage`; also uses `queryClient.removeQueries` on unmount (confirm with docs if this is desired).

### 6. Stale time and cache

- **Global defaults:** 30s staleTime, 300s gcTime in [apps/web/src/lib/trpc/index.ts](apps/web/src/lib/trpc/index.ts).
- **Overrides:** Many per-query `staleTime` values (5s, 10s, 60s, 5 min) and a few `gcTime` overrides (e.g. [calendar-widget.tsx](apps/web/src/components/calendar/calendar-widget.tsx)). Audit can verify these match your guidance (e.g. “no over-aggressive refetch” or “stale-while-revalidate” expectations).
- **Server query client:** [query-client.ts](apps/web/src/lib/trpc/query-client.ts) only sets `staleTime: 30_000`; no `gcTime`. Confirm with docs whether RSC prefetch client should mirror client defaults.

### 7. SSR / prefetch

- **RSC:** [explore/page.tsx](apps/web/src/app/explore/page.tsx) uses `getQueryClient()` and `prefetchQuery(trpc.events.list.queryOptions(...))`. Single prefetch; no other pages use this pattern in the grep results. Docs may recommend consistent patterns for SSR/hydration (e.g. dehydrate/use client hydration).

### 8. Direct queryClient usage

- **orders-tab.tsx** and **withdraw-flow.tsx** import `queryClient` from `@/lib/trpc` for invalidation outside of hooks. Acceptable for one-off actions; ensure your docs do not require all invalidation to go through `useQueryClient()` in a component (e.g. for tests or context).

---

## TanStack Query docs (reference)

### Important defaults (from docs)

- Cached data is **stale by default**; use `staleTime` to avoid excessive refetches (e.g. `2 * 60 * 1000` for 2 min, `Infinity` to refetch only on manual invalidation, `'static'` to never refetch even on invalidation).
- Stale queries refetch when: new instances mount, window refocus, network reconnect. Tune with `refetchOnMount`, `refetchOnWindowFocus`, `refetchOnReconnect`. `refetchInterval` is independent of `staleTime`.
- **Inactive** queries (no active observers) are GC’d after **5 minutes** by default; change with `gcTime` (doc default `1000 * 60 * 5`).
- Failed queries are **retried 3 times with exponential backoff** by default; override with `retry` and `retryDelay`.
- **Structural sharing** is on by default (JSON-compatible values); disable with `structuralSharing: false` or custom function if needed.

### Queries (from docs)

- Query needs a **unique key** and a **queryFn** that returns a promise (resolves data or throws).
- Result states: `**isPending`** or `status === 'pending'` (no data), `**isError`** or `status === 'error'`, `**isSuccess`** or `status === 'success'`. Prefer checking `isPending` → `isError` → then render success.
- `**fetchStatus**`: `'fetching'` | `'paused'` | `'idle'`. `status` describes the data; `fetchStatus` describes whether `queryFn` is running.
- Doc examples use `**isPending**` (not `isLoading`) for “no data yet”.

### Query keys (from docs)

- Top-level **array**; serializable; **unique to the query’s data**.
- Include any **variables** used in the query function in the key so cache is correct and refetches run when vars change.
- Object key order is normalized (hashed); **array order matters**.

### Query options (from docs)

- `**queryOptions`** helper: share `queryKey` and `queryFn` (and options like `staleTime`) in one place. Use for `useQuery`, `useSuspenseQuery`, `useQueries`, `prefetchQuery`, `setQueryData`. Override at call site (e.g. `select`) by spreading: `useQuery({ ...groupOptions(1), select: (data) => data.groupName })`.

### Parallel queries (from docs)

- **Manual parallel:** Use multiple `useQuery` / `useInfiniteQuery` side-by-side when the number of queries is fixed; they run in parallel by default. In suspense mode use `useSuspenseQueries` or separate components per `useSuspenseQuery` to avoid serializing.
- **Dynamic parallel:** When the number of queries changes per render, use `**useQueries`** (options object with `queries` array). Returns an array of query results. Example: `useQueries({ queries: users.map((user) => ({ queryKey: ['user', user.id], queryFn: () => fetchUserById(user.id) })) })`.

### Dependent queries (from docs)

- Use `**enabled`** so a query runs only when prior data exists (e.g. `enabled: !!userId` after `const userId = user?.id`). Doc example: user query then projects query with `enabled: !!userId`.
- Dependent query starts as `status: 'pending'`, `isPending: true`, `fetchStatus: 'idle'`; when enabled moves to `fetchStatus: 'fetching'`; on success to `status: 'success'`, `isPending: false`, `fetchStatus: 'idle'`.
- **useQueries dependent:** First query (e.g. get user IDs), then `useQueries({ queries: ids ? ids.map(...) : [] })` so the dynamic list runs only when the first query has data.
- **Performance:** Dependent queries are a **request waterfall** (serial = slower). Prefer restructuring backend so both can be fetched in parallel (e.g. `getProjectsByUserEmail`) when feasible.

### Background fetching indicators (from docs)

- `**status === 'pending'`** is enough for initial loading. Use `**isFetching`** to show an extra “refreshing” indicator when the query is refetching in the background (any status).
- **Global indicator:** `**useIsFetching()`** — true when any query is fetching; use for a global “Queries are fetching in the background…” UI.

### Window focus refetching (from docs)

- When the user returns to the app and data is stale, TanStack Query refetches in the background by default. Disable with `**refetchOnWindowFocus: false`** (global on QueryClient defaultOptions or per-query).
- **Custom focus:** `focusManager.setEventListener(handleFocus)` to drive focus yourself; `focusManager.setFocused(true | false | undefined)` to override or reset.

### Disabling / pausing queries (from docs)

- `**enabled: false`**: Query does not run automatically; with cached data it starts in `status: 'success'`; without cache, `status: 'pending'`, `fetchStatus: 'idle'`. No auto refetch on mount/background; ignores invalidateQueries/refetchQueries. `**refetch()`** can still trigger a manual fetch (but not with skipToken).
- **Lazy queries:** Use `enabled: !!filter` (or similar) so the first request runs only when the user has provided input; avoids “fetch on mount” until ready.
- `**isLoading`**: Derived as `**isPending && isFetching`** — true only when fetching for the first time. Use for disabled/lazy queries when you need a spinner (since `isPending` can be true without fetching when `enabled` is false).
- `**skipToken**`: TypeScript-friendly way to disable; `**refetch()` does not work with skipToken** (Missing queryFn). Use `enabled: false` if you need manual refetch.

### Query retries (from docs)

- On failure, TanStack Query retries (default 3) unless overridden. `**retry: false`** = no retries; `**retry: 6`** = 6 times; `**retry: true`** = infinite; `**retry: (failureCount, error) => ...**` = custom (failureCount is 0 on first retry). On the server, retries default to **0** for faster SSR.
- `**retryDelay`**: Default is exponential backoff (e.g. `attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000)`). Can be a function or a fixed ms number per query or globally.
- With `**refetchInterval`** and `**refetchIntervalInBackground: true`**, retries pause when the tab is inactive (same as refetch focus behavior). For continuous retries in background, consider `retry: false` and a custom `refetchInterval` based on error state.

### Paginated / lagged queries (from docs)

- Put **page (or cursor) in the query key** so each page is a distinct query. Without more, the UI can jump between pending/success when the key changes.
- `**placeholderData: keepPreviousData`** (or `(previousData) => previousData`): Keeps the last successful data visible while the new page is fetching; when new data arrives, swap is seamless. `**isPlaceholderData`** tells you if the current `data` is placeholder. Use to disable “Next” until `!isPlaceholderData && data?.hasMore`. Same idea works with `**useInfiniteQuery`** for lagging infinite results.

### Infinite queries (from docs)

- `**useInfiniteQuery**`: `data` is `{ pages, pageParams }`; `**fetchNextPage**` / `**fetchPreviousPage**`; `**initialPageParam**` (required); `**getNextPageParam**` / `**getPreviousPageParam**` (return next/prev param or `null`/`undefined` for “no more”); `**hasNextPage**` / `**hasPreviousPage**`; `**isFetchingNextPage**` / `**isFetchingPreviousPage**` for “load more” vs background refresh. `initialData` / `placeholderData` must match structure `{ pages, pageParams }`.
- **Single ongoing fetch:** Calling `fetchNextPage` while a fetch is in progress can overwrite data. Prefer `**hasNextPage && !isFetching && fetchNextPage()`** (or pass `{ cancelRefetch: false }` to allow concurrent fetch). Only one cache entry for all pages.
- **Refetch:** When infinite query goes stale, pages are refetched **sequentially** from the first. If results are removed from cache, pagination restarts at initial state.
- **Bi-directional:** Use `getPreviousPageParam`, `fetchPreviousPage`, `hasPreviousPage`, `isFetchingPreviousPage`. **Reversed order:** use `select` to return `{ pages: [...data.pages].reverse(), pageParams: [...data.pageParams].reverse() }`. **Manual updates:** `queryClient.setQueryData` must keep `pages` + `pageParams` shape. `**maxPages`** limits how many pages are kept (memory/refetch cost). **No cursor from API:** derive next/prev from `lastPageParam` / `firstPageParam` in getNextPageParam/getPreviousPageParam.

### Initial query data (from docs)

- `**initialData`**: Prepopulates cache; skips initial loading state. Persisted to cache — do not use for partial/placeholder data; use `**placeholderData`** for that.
- `**staleTime**`: With initialData and no staleTime, query refetches on mount. With `staleTime`, data is treated as fresh for that duration. `**initialDataUpdatedAt**`: Timestamp (ms) when initialData was last updated so the query can decide whether to refetch on mount (e.g. refetch if older than staleTime).
- **initialData as function:** Runs once on init (saves work per render). **From cache:** `initialData: () => queryClient.getQueryData(['todos'])?.find(...)`. Pass `**initialDataUpdatedAt: () => queryClient.getQueryState(['todos'])?.dataUpdatedAt`** so freshness is based on source. **Conditional:** Use `queryClient.getQueryState` and e.g. `Date.now() - state.dataUpdatedAt <= 10_000` to use cache only when “fresh enough”, else undefined for hard load.

### Placeholder query data (from docs)

- `**placeholderData`**: Query behaves as if it has data but data is not persisted to cache. Good for partial/fake data while real data loads. Query is in `**success`** state (not pending); `**isPlaceholderData**` is true so you can distinguish from real data.
- Can be a **value** (or memoized), or a **function** `(previousData, previousQuery) => previousData` for key transitions (e.g. pagination). Can be **from cache**: `placeholderData: () => queryClient.getQueryData(['blogPosts'])?.find(...)` (e.g. list preview as placeholder for detail).

### Mutations (from docs)

- `**useMutation`**: States `**isIdle`** | `**isPending**` | `**isError**` | `**isSuccess**`; `error` and `data` by state. Call `**mutate(variables)**` (single arg); for event handlers in React 16 and earlier wrap in a function (don’t pass `mutate` directly to e.g. onSubmit). `**reset()**` clears error/data.
- **Side effects:** `**onMutate`**, `**onError`**, `**onSuccess**`, `**onSettled**` (can return a promise; next callback waits). Same callbacks can be passed to `**mutate(vars, { onSuccess, onError, onSettled })**` for per-call effects; those run **after** the hook’s callbacks. Callbacks on `mutate()` run **once** per observer (e.g. only for last mutation if multiple mutate() calls); hook callbacks run **per mutate call**. Order of fulfillment can differ from order of mutate() calls when mutationFn is async.
- `**mutateAsync`**: Returns a promise (resolve on success, throw on error). Retry: mutations don’t retry by default; set `**retry: 3`** (or similar) to enable. **Mutation scopes:** `**scope: { id: 'todo' }`** so mutations with same scope.id run **serially** (queued, isPaused until their turn). Persist/hydrate for offline: use dehydrate/hydrate and `**resumePausedMutations()`**; with persist plugin, provide **default mutation function** via `setMutationDefaults` so paused mutations can resume after reload.

### Query invalidation (from docs)

- `**queryClient.invalidateQueries()`**: Marks matching queries stale (overrides staleTime) and refetches them if they are currently rendered. No args = all queries; `**queryKey: ['todos']`** = prefix match (all keys starting with `['todos']`); more specific key = narrower match. `**exact: true**` = only exact key. `**predicate: (query) => ...**` for custom matching.

### Invalidations from mutations (from docs)

- In `**onSuccess**` (or other mutation callbacks), call `**queryClient.invalidateQueries({ queryKey: ['todos'] })**`. For multiple queries use `**Promise.all([...invalidateQueries...])**`. **Returning a Promise** from onSuccess keeps the mutation in a “pending” state until it resolves (data updated before mutation is considered complete).

### Updates from mutation responses (from docs)

- When the mutation **returns** the updated object, use `**queryClient.setQueryData(['todo', { id }], data)`** in `**onSuccess`** (or `(data, variables) => setQueryData(..., data)`) to update the cache and avoid an extra refetch. **Immutability:** never mutate `oldData` in place in setQueryData; always return a **new** object (e.g. `{ ...oldData, title }`).

### Optimistic updates (from docs)

- **Via the UI:** Use `**mutation.variables`** and `**mutation.isPending`** to show a temporary item in the list (e.g. `{isPending && <li>{variables}</li>`). No cache interaction; on success invalidation refetches and item appears “real”; on error item can disappear or show retry. **Cross-component:** use `**useMutationState({ filters: { mutationKey: ['addTodo'], status: 'pending' }, select: (m) => m.state.variables })`** with a `**mutationKey`** on the mutation so other components can show optimistic UI; `submittedAt` for unique keys when multiple mutations run.
- **Via the cache:** In `**onMutate`**: (1) `**await context.client.cancelQueries({ queryKey })`** so refetches don’t overwrite; (2) snapshot previous with `**getQueryData**`; (3) `**setQueryData**` with optimistic value; (4) return `{ previousTodos }` (or similar). In `**onError**`: **rollback** with `setQueryData(..., onMutateResult.previousTodos)`. In `**onSettled`**: **invalidateQueries** to refetch. Use **onSettled** for “always refetch” instead of separate onError/onSuccess if desired.
- **When to use:** UI-only (variables + isPending) = less code, no rollback, good for single place. Cache = multiple places update automatically; need rollback and cancelQueries.

### Query cancellation (from docs)

- Query function receives `**AbortSignal`** in context. By default, unmount/unused queries are **not** cancelled (data stays in cache). If you **use the signal** (e.g. pass to `fetch` or `axios`), the request is aborted and the query is **cancelled** (state reverted to previous). **Manual:** `**queryClient.cancelQueries({ queryKey })`**. **Cancel options:** `silent: true` (suppress CancelledError to observers), `revert: true` (default; restore state from before in-flight fetch). **Limitation:** Cancellation does not work with Suspense hooks (useSuspenseQuery, etc.).

### Scroll restoration (from docs)

- TanStack Query doesn’t implement scroll restoration; it **avoids refetch-induced resets** by keeping data in cache (and optional placeholderData). With cache + router scroll restoration (e.g. React Router, TanStack Router), scroll restoration “just works” as long as queries are cached (default gcTime 5 min) and not GC’d.

### Filters (from docs)

- **QueryFilters:** `queryKey`, `exact`, `**type: 'active' | 'inactive' | 'all'`**, `**stale: boolean`**, `**fetchStatus**`, `**predicate: (query) => boolean**`. Used by cancelQueries, removeQueries, refetchQueries, etc. **MutationFilters:** `mutationKey`, `exact`, `status`, `predicate`. **Utils:** `matchQuery(filters, query)`, `matchMutation(filters, mutation)`.

### Performance & request waterfalls (from docs)

- **Waterfall** = a request doesn’t start until another finishes (serial roundtrips). Each hop adds latency (e.g. 4 × 250ms = 1000ms). Use Network tab to spot them.
- **Single component / serial queries:** Two queries in one component where the second is **enabled** only after the first (e.g. user then projects) = waterfall. Prefer: **restructure API** (e.g. `getProjectsByUserEmail`) so one query fetches both, or move to server (Server Components). With **Suspense:** multiple `**useSuspenseQuery`** in one component run **in serial**; use `**useSuspenseQueries`** to run in parallel.
- **Nested component waterfalls:** Parent has a query and doesn’t render child until parent is done; child has its own query = serial. If the child **doesn’t** depend on parent result (e.g. `id` is already available when parent renders), **hoist** the child’s query to the parent so both run in parallel. Or **prefetch** at router level. If the child **does** depend on parent (e.g. needs `feedItem.id` from list), options are: refactor API to include the nested data in the parent query, or Server Components.
- **Code splitting:** A **lazy** component that contains a query adds: load chunk → then run query (and possibly parent query first). That can be 5 roundtrips (markup → JS route → query → JS lazy → nested query). Option: **hoist** the nested query to the parent (conditional) so it runs in parallel with loading the lazy chunk; tradeoff is data-fetching code in the main bundle.
- **Takeaways:** Waterfalls are easy to introduce (parent/child queries, moving components). Regularly check Network tab; flatten high-impact ones; prefetching and SSR can help (see Prefetching & SSR guides).

### Prefetching & router integration (from docs)

- **prefetchQuery / prefetchInfiniteQuery:** Use queryClient default **staleTime** to decide if fetch runs; can pass **staleTime** per call (prefetch only; useQuery needs its own). **ensureQueryData** = return cache if present, ignore staleTime. On server, set higher default staleTime so each prefetch doesn’t need it. Prefetched data is GC’d after **gcTime** if no useQuery subscribes. Return **Promise****; ****never throw** (useQuery will refetch). Use **fetchQuery** / **fetchInfiniteQuery** if you need data or errors. **prefetchInfiniteQuery:** first page by default; **pages** option + getNextPageParam for more.
- **Prefetch in event handlers:** e.g. **onMouseEnter** / **onFocus** call prefetchQuery; set **staleTime** so prefetch isn’t skipped when cache exists.
- **Prefetch in components (flatten nested waterfall):** (1) In parent, call **useQuery** for the child’s query and ignore result (use **notifyOnChangeProps: []** to avoid rerenders) so both queries run in parallel. (2) With **Suspense:** **usePrefetchQuery** / usePrefetchInfiniteQuery **before** the suspense boundary; or prefetch **inside the query function** of the primary query; or in **useEffect** (note: with useSuspenseQuery in same component, effect runs after query resolves). (3) **Conditional/dependent:** in the parent’s queryFn, after fetching, call **prefetchQuery** for dependent queries (e.g. for each GRAPH item prefetch getGraphDataById); tradeoff is dependent query code in parent bundle. Code and data then load in parallel.
- **Router integration:** Per **route**, declare needed data; in **loader** (or equivalent): **prefetchQuery** without await for secondary data, **await prefetchQuery** for critical data so route doesn’t render until ready. Component uses same queryOptions with useQuery. Mix: await critical, non-blocking prefetch for rest.
- **Manual priming:** If data is already available, **queryClient.setQueryData(key, data)** to prime cache (no prefetch).

### Server rendering & hydration (from docs)

- **SSR + React Query:** Prefetch on server → **dehydrate** → embed in markup → on client **hydrate** into cache so step “Query” doesn’t run until revalidation. User sees content after markup; after JS loads, page is interactive without an extra data roundtrip.
- **Suspense:** You can use useSuspenseQuery if you **always prefetch every query**; if one is missed, data can suspend on server but not hydrate to client (double fetch, hydration mismatch).
- **Initial setup:** Create **queryClient inside the app** (e.g. **useState(() => new QueryClient(...))**), not at module scope, so **each request has its own cache** (no cross-user leakage). Set **staleTime > 0** (e.g. 60s) so client doesn’t refetch immediately.
- **Quick start with initialData:** Pass server-fetched data as **initialData** to useQuery. Tradeoffs: must pass to every nested useQuery; removing the component with initialData can leave others without data; no server **dataUpdatedAt**; **initialData never overwrites** existing cache (even if fresher) — bad for repeated navigations. Prefer full hydration.
- **Full hydration flow:** In loader: **const queryClient = new QueryClient()** → **await queryClient.prefetchQuery(...)** (or **Promise.all** for parallel) → return **dehydrate(queryClient)**. Wrap tree with **HydrationBoundary** with state={dehydratedState} (per-route or once in _app). Three queryClients: preload (prefetch), server render, client — all start from same dehydrated state.
- **Dependent queries in loader:** Use **fetchQuery** for the first (e.g. user), then **prefetchQuery** for the second (e.g. projects) if needed; then dehydrate.
- **Error handling:** **prefetchQuery** never throws; **dehydrate** only includes successful queries. Failed = retry on client, loading in markup. For critical: use **fetchQuery** (throws), handle 404/500. **shouldDehydrateQuery** to include failed queries if desired.
- **Serialization:** Dehydrated state is serialized by the framework; default doesn’t support undefined, Error, Date, Map, Set, BigInt, etc. Use **superjson** or similar. Custom SSR: avoid raw **JSON.stringify** (XSS); use **serialize-javascript** or **devalue**.
- **Server memory:** On server **gcTime** defaults to **Infinity** (cache cleared when request ends). If you set non-Infinity gcTime you must clear; **avoid gcTime 0** (hydration errors); min ~2*1000. **queryClient.clear()** after sending response to free memory.
- **Staleness:** Based on **dataUpdatedAt** (server time in UTC). **staleTime: 0** = refetch on load; set higher to avoid double fetch. Works well with CDN: cache page long, staleTime shorter so data refetches on visit if old.
- **Next.js rewrites + static:** Can cause second hydration and referential equality issues (router.query after hydration).

### Advanced server rendering (from docs)

- **Server Components** run only on the server (initial + **page transitions**). Think of them as another “loader”: prefetch in Server Component, dehydrate, pass to client via HydrationBoundary. **Client Components** can run on server (SSR) and client; **Server Components** = loader phase, **Client Components** = application phase.
- **App router setup:** Providers file `'use client'` with **getQueryClient()**: on **isServer** always **new QueryClient()**; in browser **singleton** (so React suspend doesn’t re-create). Avoid **useState** for queryClient if there’s no suspense boundary below (React may throw away client). **staleTime** > 0. Layout wraps with Providers.
- **Prefetch in Server Component:** Async page creates **new QueryClient()**, **await prefetchQuery(...)**, return **HydrationBoundary** with state={dehydrate(queryClient)} wrapping Client Component. Client uses **useQuery** (same key/fn). **Cannot** hoist HydrationBoundary to one place; each route needs it with Server Components. **Don’t pass queryFn as reference** to Server Actions (serialization); call the function. TypeScript: update TS/react types or use workaround for async Server Component.
- **Nesting:** Multiple Server Components can each create QueryClient, prefetch, dehydrate, HydrationBoundary. Awaiting one then rendering another = **server waterfall**. Next.js: prefetch in **layout**, **page**, or **parallel routes** so Next fetches in parallel and flattens waterfall.
- **Single getQueryClient:** Alternatively **cache()** from React for per-request QueryClient; **dehydrate(getQueryClient())** then serializes **entire** cache every time (overhead). Use when request dedupe isn’t automatic.
- **Data ownership:** Don’t **render** **fetchQuery** result in Server Component or pass to children — when client revalidates, server-rendered output goes out of sync. **Use Server Components only to prefetch**; avoid fetchQuery unless you need to catch errors; if you use it, don’t render its result on server. New Server Components app: consider framework data fetching first; add React Query when needed.
- **Streaming (v5.40+):** Can **dehydrate pending** queries: set **shouldDehydrateQuery** to include **status === 'pending'**. Don’t await prefetch; stream resolves to client. Client uses **useSuspenseQuery** to consume the Promise. **serializeData** / **deserializeData** on QueryClient for non-JSON. **Persist adapter:** use **defaultShouldDehydrateQuery** so pending promises aren’t persisted.
- **Experimental:** **@tanstack/react-query-next-experimental** + **ReactQueryStreamedHydration**: use **useSuspenseQuery** in Client Component without prefetch; streams. **Downside:** only flattens waterfall on **initial** load; client navigation stays deep waterfall. Tradeoff: DX vs navigation performance.

### Caching examples (from docs)

- **Same queryKey = shared cache and shared status:** Multiple **useQuery({ queryKey: ['todos'], ... })** instances share one cache entry. When a second instance mounts, it gets cached data immediately and triggers a **background refetch**; when that completes, **both** instances see the new data and shared **status** / **isFetching** / **isPending** (same key → same observer state). Query function identity doesn’t change this.
- **Inactive → GC:** When all instances unmount, the query becomes **inactive** and a **gcTime** timeout is set (default 5 min). If another instance mounts **before** gcTime, it gets cached data and refetches in background. If no instance mounts within gcTime, the cache entry is **deleted and garbage collected**.
- **Lifecycle:** First mount (no cache) → hard loading, fetch, cache, mark stale. Second mount (cache) → immediate data + background refetch → both get update. Unmount all → gcTime countdown. Remount before GC → instant cache + background refetch.

### Render optimizations (from docs)

- **Structural sharing:** React Query keeps **references stable** when data is unchanged; if a subset changed, only that part is replaced. **Only for JSON-compatible** data. Disable with **structuralSharing: false** (global or per-query) or pass a custom function.
- **Referential identity:** The **top-level object** returned from useQuery, useInfiniteQuery, useMutation and the **array** from useQueries is **not** referentially stable (new ref every render). The `**data`** property is as stable as possible.
- **Tracked properties:** Re-render only when a **used** property changes (via **Proxy**). Unused props (e.g. isFetching, isStale) don’t trigger re-renders. Set **notifyOnChangeProps** to customize, or **'all'** to disable. **Object rest destructuring** (e.g. `const { data, ...rest }`) **disables** this optimization; use direct access or destructure only what you use. Lint rule available.
- **select:** Subscribe to a **subset or derived value**; component re-renders only when that value changes. **select** runs on cached success data; **don’t throw** in select (errors belong in queryFn; select returning error → data undefined, isSuccess true). **Memoization:** select re-runs only when **select ref** or **data** changes; **inline select** runs every render — use **useCallback** or a **stable function reference**.

### Suspense (from docs)

- **Hooks:** useSuspenseQuery, useSuspenseInfiniteQuery, useSuspenseQueries; or **experimental** useQuery().promise + React.use() (requires experimental_prefetchInRender).
- **Loading/errors:** With Suspense, status/error are replaced by **React.Suspense** (fallback) and **Error Boundaries**; mutations can use **throwOnError: true** to propagate to boundary.
- **Constraints:** Can’t conditionally **enable/disable** a suspense query; **placeholderData** doesn’t exist. To avoid fallback flash when query key changes, wrap updates in **startTransition**.
- **throwOnError default:** Only throws when there’s no data to show: `(error, query) => typeof query.state.data === 'undefined'`. To throw all errors to boundary, check manually and rethrow: `if (error && !isFetching) throw error`.
- **Resetting errors:** Use **QueryErrorResetBoundary** (component) or **useQueryErrorResetBoundary** (hook); pass **reset** to Error Boundary’s **onReset** so “Try again” clears query error and retries.
- **Fetch-on-render vs Render-as-you-fetch:** Default suspense is fetch-on-render. For render-as-you-fetch, use **prefetching** on route callbacks or user interactions.
- **Next.js streaming (experimental):** `@tanstack/react-query-next-experimental` + **ReactQueryStreamedHydration**; useSuspenseQuery in client components streams from server. getQueryClient: server = new each request, browser = singleton (avoid re-create if suspense boundary is below client creation).

### Audit checklist derived from docs


| Doc guidance                                                                                                              | Our codebase check                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Use `staleTime` to avoid aggressive refetch                                                                               | We set global 30s + per-query overrides; verify no critical queries lack staleTime where refetch is unwanted.                                                                                                                               |
| Prefer `**isPending`** for “no data yet”                                                                                  | We use `isLoading` in many places; plan migration to `isPending` and update prop names (e.g. `isLoading` → `isPending` in component APIs) if we adopt doc convention.                                                                       |
| Query key includes variables that change                                                                                  | tRPC encodes input in key; confirm pagination/offset (e.g. trade-history) is in key so refetches are correct.                                                                                                                               |
| Use **queryOptions** to share key + fn + options                                                                          | We use `trpc.path.queryOptions(input)` and spread overrides; aligns. Prefer overriding at call site (e.g. `select`) rather than redefining.                                                                                                 |
| gcTime for inactive cache (default 5 min)                                                                                 | We use 300_000 (5 min) globally; doc default is same. Server getQueryClient has no gcTime; consider adding if docs recommend.                                                                                                               |
| Retry: default 3 with backoff                                                                                             | We use custom retry (max 2, skip UNAUTHORIZED etc.); intentional override; no change unless we want default.                                                                                                                                |
| **Parallel:** fixed count → multiple useQuery side-by-side                                                                | We do this (e.g. use-portfolio-data, profile-hover-card, leaderboard-profile-modal); no change.                                                                                                                                             |
| **Parallel:** dynamic count → useQueries with `queries` array                                                             | use-orderbook uses useQueries for dynamic token list; confirm shape is `{ queries: [...] }` and return is array of results.                                                                                                                 |
| **Dependent:** use `enabled` when query needs prior data                                                                  | We use `enabled: Boolean(x)` widely; confirm dependent chains (e.g. user then projects) use `enabled: !!derivedValue`, not missing.                                                                                                         |
| **Dependent:** avoid waterfalls when feasible                                                                             | Where we have A then B (e.g. eventIds then tradeCounts), note for future: consider backend API that returns both if latency is an issue.                                                                                                    |
| **Background fetch:** use `isFetching` for “refreshing” indicator                                                         | We use isFetching in some places (e.g. global-search, events-discovery, search-results); confirm any paginated/refetching views that need a subtle “Refreshing…” use `isFetching`.                                                          |
| **Global fetch indicator:** `useIsFetching()`                                                                             | Check if we want a global loading indicator when any query is fetching; we don’t currently use useIsFetching.                                                                                                                               |
| **Window focus:** refetch on focus (default true)                                                                         | We don’t set refetchOnWindowFocus; default is on. Disable per-query or globally only if we have a reason.                                                                                                                                   |
| **enabled: false** behavior (no auto fetch, refetch() works)                                                              | events-discovery nextPage uses `enabled: false` + manual refetch(); doc says refetch() works with enabled: false but not with skipToken. We don’t use skipToken there; OK.                                                                  |
| **Lazy queries:** `enabled: !!value` to defer first fetch                                                                 | We use this (e.g. search enabled when query.trim().length >= 2, filters). No change.                                                                                                                                                        |
| **isLoading** = isPending && isFetching (first-time fetch only)                                                           | If we adopt isPending for “no data”, keep isLoading where we need “currently fetching for the first time” (e.g. lazy queries). Doc clarifies both have a role.                                                                              |
| **skipToken:** refetch() does not work                                                                                    | If we introduce skipToken anywhere, avoid calling refetch() on that query; use enabled: false if manual refetch is needed.                                                                                                                  |
| **Retries:** server default 0                                                                                             | getQueryClient() for RSC doesn’t set retry; doc says server retries default to 0. Confirm we don’t need explicit retry: 0 for SSR.                                                                                                          |
| **Paginated:** page in query key + placeholderData                                                                        | trade-history uses offset in key; leaderboard-page and event-table-cells use keepPreviousData. Verify trade-history pagination uses placeholderData or similar so UI doesn’t jump; use isPlaceholderData for Next button if applicable.     |
| **Infinite:** data.pages/pageParams, initialPageParam, getNextPageParam                                                   | trades-tab uses useInfiniteQuery; confirm initialPageParam and getNextPageParam; data shape is { pages, pageParams }.                                                                                                                       |
| **Infinite:** avoid fetchNextPage while isFetching                                                                        | trades-tab: confirm we call fetchNextPage only when `hasNextPage && !isFetching` (or use cancelRefetch: false intentionally).                                                                                                               |
| **Infinite:** refetch is sequential from first page                                                                       | No change; note for behavior. Optional: maxPages if we have very long lists.                                                                                                                                                                |
| **initialData** persisted to cache; use placeholderData for partial                                                       | We don’t use initialData in inventory; if we add any, use placeholderData for partial/fake data and initialData only for full, cacheable data.                                                                                              |
| **initialDataUpdatedAt** when initialData isn’t fresh                                                                     | If we use initialData, set initialDataUpdatedAt (or from cache: queryClient.getQueryState(...)?.dataUpdatedAt) so refetch-on-mount is correct.                                                                                              |
| **placeholderData** not persisted; isPlaceholderData to distinguish                                                       | We use keepPreviousData (placeholder) in leaderboard and event-table-cells; ensure we don’t persist partial data via initialData. Use isPlaceholderData where we need to treat placeholder differently (e.g. disable Next).                 |
| **Mutations:** use **isPending** (not isLoading) for “running”                                                            | We use isPending in mutation UIs (e.g. add-track-wallet, wallet-tracker, use-watchlist); confirm we don’t use deprecated mutation loading names.                                                                                            |
| **Mutations:** invalidate in onSuccess (or onSettled)                                                                     | We invalidate in onSuccess in user-menu, add-track-wallet, wallet-tracker, use-watchlist; align. Return Promise from onSuccess if we need refetch to finish before “done”.                                                                  |
| **Mutations:** callbacks on mutate() run after hook callbacks, once per observer                                          | If we pass onSuccess to mutate(), note it runs after useMutation onSuccess and only once (e.g. last mutation if multiple). No change unless we rely on per-mutate callbacks.                                                                |
| **Invalidation:** prefix match by queryKey; use exact or predicate if needed                                              | We use trpc.path.queryKey() (prefix); confirm we don’t need exact: true or predicate for narrow invalidation.                                                                                                                               |
| **Updates from mutation:** setQueryData when mutation returns updated object                                              | Where we have update mutations that return the new entity, prefer setQueryData in onSuccess over invalidateQueries to avoid extra request. We don’t currently use setQueryData from mutations in inventory; consider for edit/update flows. |
| **setQueryData:** immutable updates only                                                                                  | Any setQueryData (manual or in mutation onSuccess) must return new object; never mutate oldData in place.                                                                                                                                   |
| **Optimistic (UI):** variables + isPending for single-place temp UI                                                       | Where we want “add in progress” without cache: use mutation.variables and isPending; optional useMutationState + mutationKey if mutation lives elsewhere. We don’t use optimistic UI in inventory; consider for add-todo–style flows.       |
| **Optimistic (cache):** onMutate cancelQueries → snapshot → setQueryData → return; onError rollback; onSettled invalidate | If we add cache-based optimistic updates: cancelQueries first, snapshot, setQueryData, return rollback data; rollback in onError; invalidate in onSettled.                                                                                  |
| **Query cancellation:** pass signal to fetch/axios when we want cancel on unmount                                         | tRPC/queryFn may or may not forward signal; if we need cancel-on-unmount, ensure queryFn uses the provided signal. Manual cancelQueries for “Cancel” buttons.                                                                               |
| **Scroll restoration:** cache + gcTime keep data so router restoration works                                              | We use default gcTime 300_000; scroll restoration should work with router. No change unless we shorten gcTime and see issues.                                                                                                               |
| **Filters:** queryKey, type, stale, fetchStatus, predicate for cancel/refetch/remove                                      | When we use cancelQueries, refetchQueries, removeQueries: we can pass type: 'active'                                                                                                                                                        |
| **Waterfalls:** dependent queries in one component = serial                                                               | We have A-then-B (e.g. eventIds then tradeCountsByMarket in events-discovery); document as known waterfall; consider API that returns both or prefetch if high impact.                                                                      |
| **Waterfalls:** parent then child query when child doesn’t need parent data                                               | Where parent and child both have queries and child only needs e.g. id (already available): hoist child query to parent so they run in parallel. Audit nested layouts (e.g. market tabs, portfolio sections).                                |
| **Waterfalls:** lazy component with query = chunk load then query                                                         | If we lazy-load a component that uses useQuery, we get an extra hop. Consider conditional prefetch/hoist in parent or accept tradeoff.                                                                                                      |
| **Suspense:** use useSuspenseQueries for multiple suspense queries in one component                                       | We don’t use Suspense hooks in inventory; if we add them, use useSuspenseQueries so they run in parallel, not serial.                                                                                                                       |
| **Suspense:** no conditional enable/disable; no placeholderData                                                           | If we adopt useSuspenseQuery, don’t rely on enabled: false or placeholderData; use startTransition when changing query key to avoid fallback flash.                                                                                         |
| **Suspense:** reset query errors in Error Boundary                                                                        | If we use suspense or throwOnError: wrap with QueryErrorResetBoundary (or useQueryErrorResetBoundary) and pass reset to Error Boundary onReset so “Try again” retries.                                                                      |
| **Suspense (mutations):** throwOnError: true to propagate to boundary                                                     | For mutations that should bubble to Error Boundary, set throwOnError: true.                                                                                                                                                                 |
| **Suspense (Next.js streaming):** ReactQueryStreamedHydration + getQueryClient server/new, browser/singleton              | If we use @tanstack/react-query-next-experimental: wrap app in ReactQueryStreamedHydration; ensure getQueryClient uses new client on server and singleton on browser (no useState for client init if suspense boundary is above).           |
| **Prefetch:** staleTime for prefetch vs useQuery                                                                          | prefetch uses client default staleTime; we can pass staleTime to prefetchQuery. ensureQueryData if we want “return cache if present”. explore/page and use-prefetch-market use prefetch; confirm staleTime where needed.                    |
| **Prefetch in parent to flatten waterfall:** useQuery + notifyOnChangeProps: []                                           | Where we have parent→child query waterfall and can’t hoist: add useQuery for child’s key in parent, ignore result, notifyOnChangeProps: [] so both run in parallel.                                                                         |
| **Prefetch in queryFn for dependent + code split:** prefetch after parent fetch                                           | For feed→GraphFeedItem pattern: in getFeed queryFn, after result, prefetch getGraphDataById for relevant items so chunk and data load in parallel; tradeoff is fetch code in parent bundle.                                                 |
| **Router/route loader:** await critical prefetch, non-blocking for secondary                                              | If we add route-level loaders (e.g. Next.js or TanStack Router), await prefetchQuery for critical data; prefetchQuery without await for secondary. We only have explore/page prefetch today.                                                |
| **Manual priming:** setQueryData when data already available                                                              | If we have sync data (e.g. from router or SSR), setQueryData to prime cache instead of prefetching.                                                                                                                                         |
| **SSR:** queryClient per request, not shared                                                                              | We use getQueryClient() per RSC request (explore); client uses singleton. For full SSR/hydration, ensure loader/preload creates new QueryClient per request and never at module scope.                                                      |
| **SSR:** prefetch → dehydrate → HydrationBoundary                                                                         | Full pattern: loader prefetchQuery (or Promise.all), return dehydrate(queryClient), wrap with HydrationBoundary. We only prefetch on explore page, no dehydrate/hydrate yet.                                                                |
| **SSR:** initialData tradeoffs                                                                                            | If we pass initialData: it never overwrites cache; no dataUpdatedAt from server; must pass to all useQuery that need it. Prefer dehydrate/hydrate for full hydration.                                                                       |
| **SSR:** dependent queries in loader                                                                                      | Use fetchQuery for first, then prefetchQuery for second; dehydrate.                                                                                                                                                                         |
| **SSR:** prefetchQuery never throws; use fetchQuery for critical                                                          | For 404/500 on critical content use fetchQuery and handle errors; prefetchQuery fails gracefully (retry on client).                                                                                                                         |
| **SSR:** server gcTime, memory                                                                                            | On server gcTime defaults Infinity (clear when request ends). Don’t set gcTime 0 (hydration errors); queryClient.clear() after send if needed.                                                                                              |
| **SSR:** staleTime > 0 to avoid immediate refetch                                                                         | With hydration, set default staleTime > 0 so client doesn’t refetch right away. We have staleTime 30_000 in getQueryClient.                                                                                                                 |
| **Advanced SSR (App Router):** getQueryClient server=new, browser=singleton                                               | We have getQueryClient() in query-client.ts (server always new); client uses singleton from lib/trpc. For full app-router RSC, ensure provider uses isServer check and browser singleton to avoid re-create on suspend.                     |
| **Advanced SSR:** prefetch in Server Component, HydrationBoundary per route                                               | With RSC: async page prefetchQuery, return HydrationBoundary state={dehydrate(queryClient)}; can’t hoist to one place. We only prefetch in explore page; no HydrationBoundary yet.                                                          |
| **Advanced SSR:** don’t render fetchQuery result on server                                                                | Avoid rendering or passing fetchQuery result from Server Component — client revalidation will desync. Prefetch only; use useQuery in Client Component.                                                                                      |
| **Advanced SSR:** nesting = server waterfall unless parallel                                                              | Multiple Server Components each prefetching = serial unless framework runs them in parallel (e.g. Next parallel routes).                                                                                                                    |
| **Streaming (pending dehydrate):** shouldDehydrateQuery include pending                                                   | If we want to not await prefetch and stream: configure shouldDehydrateQuery to include status === 'pending'; client useSuspenseQuery. We don’t use this yet.                                                                                |
| **Experimental streaming:** no prefetch, useSuspenseQuery + ReactQueryStreamedHydration                                   | Tradeoff: no manual prefetch but client nav keeps deep waterfall. Only consider if DX over nav perf.                                                                                                                                        |
| **Caching:** same queryKey = shared cache and status                                                                      | Multiple useQuery with same key share one entry; second mount gets cache + triggers refetch; both get updated. Don’t rely on “my component’s” query in isolation when same key is used elsewhere.                                           |
| **Caching:** inactive queries GC after gcTime                                                                             | Unmounted queries stay in cache for gcTime (we use 300_000); then deleted. Remount before GC = instant cache + background refetch.                                                                                                          |
| **Render:** avoid object rest destructuring from useQuery                                                                 | Destructuring like `const { data, ...rest }` disables tracked-properties optimization; destructure only what you use or access props directly.                                                                                              |
| **Render:** use select for subset/derived subscription                                                                    | Where we only need a slice or derived value, use **select** so re-renders happen only when that value changes; memoize select with useCallback or stable ref. Don’t throw in select.                                                        |
| **Render:** notifyOnChangeProps for prefetch-only useQuery                                                                | When using useQuery in parent only to prefetch (ignore result), set **notifyOnChangeProps: []** to avoid rerenders. We already use this in plan’s prefetch-in-component pattern.                                                            |


---

## Files to audit in detail (by category)


| Category                    | Files                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider / client**       | [providers.tsx](apps/web/src/components/providers.tsx), [lib/trpc/index.ts](apps/web/src/lib/trpc/index.ts), [lib/trpc/query-client.ts](apps/web/src/lib/trpc/query-client.ts)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **Portfolio / positions**   | [use-portfolio-data.ts](apps/web/src/app/portfolio/use-portfolio-data.ts), [position-table.tsx](apps/web/src/components/portfolio/position-table.tsx), [orders-table.tsx](apps/web/src/components/portfolio/orders-table.tsx), [redeem-tab.tsx](apps/web/src/components/portfolio/redeem-tab.tsx), [trade-history.tsx](apps/web/src/components/portfolio/trade-history.tsx), [closed-positions.tsx](apps/web/src/components/portfolio/closed-positions.tsx), [activity-history.tsx](apps/web/src/components/portfolio/activity-history.tsx), [activity-feed.tsx](apps/web/src/components/portfolio/activity-feed.tsx), [bridge-activity-table.tsx](apps/web/src/components/portfolio/bridge-activity-table.tsx) |
| **Trading / order form**    | [order-form.hooks.ts](apps/web/src/components/trading/orders/order-form.hooks.ts), [quick-sell-modal.tsx](apps/web/src/components/market/quick-sell-modal.tsx), [positions-tab.tsx](apps/web/src/components/market/tabs/positions-tab.tsx), [orders-tab.tsx](apps/web/src/components/market/tabs/orders-tab.tsx), [trades-tab.tsx](apps/web/src/components/market/tabs/trades-tab.tsx), [use-orderbook.ts](apps/web/src/hooks/use-orderbook.ts)                                                                                                                                                                                                                                                                 |
| **Discovery / explore**     | [events-discovery.tsx](apps/web/src/components/explore/events-discovery.tsx), [event-table-cells.tsx](apps/web/src/components/explore/event-table-cells.tsx), [explore/page.tsx](apps/web/src/app/explore/page.tsx)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| **Auth / profile / layout** | [user-menu.tsx](apps/web/src/components/auth/user-menu.tsx), [profile-hover-card.tsx](apps/web/src/components/profile/profile-hover-card.tsx), [notifications-bell.tsx](apps/web/src/components/layout/notifications-bell.tsx), [global-search.tsx](apps/web/src/components/layout/global-search.tsx), [header-wallet-balance.tsx](apps/web/src/components/layout/header-wallet-balance.tsx)                                                                                                                                                                                                                                                                                                                    |
| **Bridge / wallet**         | [deposit-flow.tsx](apps/web/src/components/bridge/deposit-flow.tsx), [withdraw-flow.tsx](apps/web/src/components/bridge/withdraw-flow.tsx), [deposit-status-tracker.tsx](apps/web/src/components/bridge/deposit-status-tracker.tsx), [withdraw-status-tracker.tsx](apps/web/src/components/bridge/withdraw-status-tracker.tsx)                                                                                                                                                                                                                                                                                                                                                                                  |
| **Hooks**                   | [use-watchlist.ts](apps/web/src/hooks/use-watchlist.ts), [use-prefetch-market.ts](apps/web/src/hooks/use-prefetch-market.ts), [use-safe-balance.ts](apps/web/src/hooks/use-safe-balance.ts), [use-split-merge.ts](apps/web/src/hooks/use-split-merge.ts), [use-trading-init.ts](apps/web/src/hooks/use-trading-init.ts), [use-open-interest.ts](apps/web/src/hooks/use-open-interest.ts), [use-comments.ts](apps/web/src/hooks/use-comments.ts)                                                                                                                                                                                                                                                                 |
| **Other**                   | [add-track-wallet-modal-provider.tsx](apps/web/src/components/add-track-wallet-modal-provider.tsx), [wallet-tracker-content.tsx](apps/web/src/components/wallet-tracker/wallet-tracker-content.tsx), [leaderboard-page.tsx](apps/web/src/app/leaderboard/leaderboard-page.tsx), [leaderboard-profile-modal.tsx](apps/web/src/components/leaderboard/leaderboard-profile-modal.tsx), [calendar-widget.tsx](apps/web/src/components/calendar/calendar-widget.tsx)                                                                                                                                                                                                                                                 |


---

## Next step

Docs in the plan: Important Defaults, Queries, Query Keys, Query Functions, Query Options, Parallel Queries, Dependent Queries, Background Fetching Indicators, Window Focus Refetching, Disabling/Pausing Queries, Query Retries, Paginated/Lagged Queries, Infinite Queries, Initial Query Data, Placeholder Query Data, Mutations, Query Invalidation, Invalidations from Mutations, Updates from Mutation Responses, Optimistic Updates, Query Cancellation, Scroll Restoration, Filters, Performance & Request Waterfalls, Prefetching & Router Integration, Server Rendering & Hydration, Advanced Server Rendering, Caching Examples, Render Optimizations, Suspense. The **Audit checklist derived from docs** maps that guidance to concrete checks. You can:

1. **Add more doc sections** (e.g. “Mutations, Query Invalidation, Infinite Queries) — paste them and we'll add them to this plan and extend the checklist.
2. **Run the audit** — apply the current checklist and audit dimensions to the listed files and produce a file-by-file change list (e.g. `isLoading` → `isPending`, keys, events-discovery pattern).
3. **Narrow scope** — e.g. only defaults + query options, or only status/isPending renames.

