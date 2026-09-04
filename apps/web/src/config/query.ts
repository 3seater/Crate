/**
 * Centralized staleTime constants for TanStack Query.
 *
 * Pick the tier that matches how quickly the data changes:
 *   REALTIME → orderbook, prices, live trades
 *   DEFAULT  → general data (matches the global QueryClient default)
 *   STABLE   → profile, leaderboard, tags, categories, related markets
 *   STATIC   → rarely-changing reference data (feature flags, chain config)
 */

/** 10 s — orderbook, prices, live trades. */
export const STALE_REALTIME = 10_000;

/** 30 s — general data (current global default). */
export const STALE_DEFAULT = 30_000;

/** 5 min — profile, leaderboard, tags, categories. */
export const STALE_STABLE = 300_000;

/** 30 min — rarely changing reference data. */
export const STALE_STATIC = 1_800_000;

// ─── gcTime (garbage collection) ─────────────────────────────────────────────
//
// How long inactive query data stays in the cache after all observers unmount.
// Rule: gcTime >= staleTime for each tier, or the cache evicts before the data
// even goes stale (defeating the point of caching).

/** 2 min — fast-changing data; evict quickly to avoid stale orderbooks in memory. */
export const GC_REALTIME = 2 * 60_000;

/** 5 min — general data. */
export const GC_DEFAULT = 5 * 60_000;

/** 30 min — stable data worth keeping warm across navigations. */
export const GC_STABLE = 30 * 60_000;

/** 2 h — reference data; almost never needs refetching. */
export const GC_STATIC = 2 * 60 * 60_000;
