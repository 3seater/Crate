import type { UseQueryResult } from "@tanstack/react-query";

/**
 * TanStack Query v5: `isPending` is not equivalent to “network in flight”.
 * Tables that gate skeleton vs empty on `isPending` alone can flash
 * skeleton → empty → data. Use this (or the same conditions inline) for
 * any list/tab that shows an empty state when `data` is still resolving.
 *
 * Uses `isLoading` (pending + fetching) and `!isFetched`, not raw
 * `fetchStatus === "fetching"`. Background refetches (e.g. `refetchOnWindowFocus`
 * after `staleTime`) also set `fetching` and would otherwise flash skeletons
 * over existing rows/cards.
 *
 * @see `useWatchlist` — additional “enrichment” and RSC snapshot guards for multi-query flows.
 */
export function queryTableLoading<T>(
  query: Pick<
    UseQueryResult<T>,
    "isPending" | "isFetched" | "isError" | "isLoading"
  >,
  options?: { enabled?: boolean }
): boolean {
  const enabled = options?.enabled ?? true;
  if (!enabled || query.isError) {
    return false;
  }
  return query.isLoading || !query.isFetched;
}
