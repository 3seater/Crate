# Evaluation: useSuspenseQuery for Prefetched Pages

> Task 13.4 — Requirements 33.1, 33.2, 33.3, 33.4

## Summary

**Recommendation: Do NOT adopt `useSuspenseQuery` at this time.** The current
architecture already eliminates loading flashes via HydrationBoundary + streaming
dehydration, and the primary query patterns on prefetched pages are incompatible
with the suspense variants.

## Pages Evaluated

### Explore (`/explore`)

- **Server prefetch:** `getCachedEventsList` → `queryClient.setQueryData` → `HydrationBoundary`
- **Client query:** `useInfiniteQuery` with `placeholderData: keepPreviousData` and `select`
- **Verdict:** Not a candidate. Uses `useInfiniteQuery` (not `useQuery`), relies on
  `keepPreviousData` for tab/filter switches, and `initialData` seeding pattern.
  `useSuspenseInfiniteQuery` exists but drops `placeholderData` support and would
  require wrapping every filter change in a new Suspense boundary.

### Market (`/market/[slug]`)

- **Server prefetch:** Orderbook data via `queryClient.prefetchQuery` → `HydrationBoundary`
- **Client query:** `useQueries` in `use-orderbook.ts` with `enabled: Boolean(tokenId) && hookEnabled`
- **Secondary queries:** `useQuery` with `enabled: Boolean(safeAddress)` for positions,
  balances, midpoint, tick size — all conditionally fetched based on auth state.
- **Verdict:** Not a candidate. Primary query uses `useQueries` with conditional `enabled`
  flags. `useSuspenseQuery` does not support `enabled` — it always fetches. Switching
  would break the conditional fetching pattern for auth-gated data.

### Event (`/event/[slug]`)

- **Server prefetch:** Event data fetched directly via `getCachedEventBySlug` (not via
  queryClient prefetch). Data passed as props to client components.
- **Client query:** No primary `useQuery` for event data — it arrives as props.
- **Verdict:** Not a candidate. Data flows via props, not React Query hydration.
  No `useQuery` to replace.

### Leaderboard (`/leaderboard`)

- **Server prefetch:** `getCachedLeaderboard` → `queryClient.setQueryData` (infinite query
  format) → `HydrationBoundary`
- **Client query:** `useInfiniteQuery` with `placeholderData: keepPreviousData`
- **Verdict:** Not a candidate. Same reasoning as explore — `useInfiniteQuery` with
  `keepPreviousData` for period/sort switches.

## Why the Current Architecture Already Solves the Problem

1. **Streaming dehydration** (task 1.3): `shouldDehydrateQuery` includes `status === 'pending'`
   queries, so prefetched data streams to the client as it resolves — no loading flash.
2. **HydrationBoundary**: Transfers server-prefetched data to the client QueryClient
   before the component renders, so `useQuery`/`useInfiniteQuery` find data in cache
   immediately.
3. **`keepPreviousData`**: Prevents loading flashes during filter/sort/period changes
   by showing stale data until fresh data arrives.

## Tradeoffs of useSuspenseQuery

| Benefit | Drawback |
|---------|----------|
| Eliminates `isPending` / `isLoading` checks | Requires Suspense boundary above every query consumer |
| Type-safe `data` (never undefined) | No `enabled` option — always fetches, breaks conditional queries |
| Integrates with React Suspense streaming | Serial execution unless using `useSuspenseQueries` |
| — | `keepPreviousData` / `placeholderData` not supported |
| — | Error handling shifts to Error Boundaries (less granular) |

## When to Reconsider

- If new pages are added with simple `useQuery` calls (not infinite, not conditional)
  that are guaranteed to have server-prefetched data via HydrationBoundary.
- If the market page is refactored to separate auth-gated queries from public queries
  into distinct components with their own Suspense boundaries.
- If React Query adds `enabled` support to `useSuspenseQuery` (currently not planned).

## Requirement Compliance

- **33.1** ✅ Evaluated — no pages are good candidates for the switch.
- **33.2** ✅ Acknowledged — streaming dehydration already achieves this benefit.
- **33.3** ✅ Evaluated — `useSuspenseQueries` would only help if multiple non-conditional
  queries existed in the same component; current pattern is one primary + many conditional.
- **33.4** ✅ Confirmed — `useQuery` is retained for all conditionally-fetched queries.
