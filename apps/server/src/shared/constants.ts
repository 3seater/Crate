/**
 * Server-only constants: liquidity tiers, subgraph limits, enrich, price history fidelity.
 *
 * Shared CLOB/Polymarket constants (prices, tick sizes, geoblock URL) live in @doji/types.
 * Liquidity: spread in decimal 0–1 (bid-ask), depth in USD; health = first matching tier HIGH→MEDIUM→LOW.
 * Fidelity: minutes between CLOB price-history data points (Polymarket timeseries API).
 */

// ─── Liquidity (order book health) ───────────────────────────────────────────

/** Max spread (decimal 0–1) for HIGH health. With depth ≥ LIQUIDITY_DEPTH_HIGH_MIN_USD → HIGH. */
export const LIQUIDITY_SPREAD_HIGH_MAX = 0.02;

/** Max spread for MEDIUM health (else HIGH). */
export const LIQUIDITY_SPREAD_MEDIUM_MAX = 0.05;

/** Max spread for LOW health (else CRITICAL). */
export const LIQUIDITY_SPREAD_LOW_MAX = 0.1;

/** Min order book depth (USD) for HIGH health. */
export const LIQUIDITY_DEPTH_HIGH_MIN_USD = 1000;

/** Min depth (USD) for MEDIUM health. */
export const LIQUIDITY_DEPTH_MEDIUM_MIN_USD = 500;

/** Min depth (USD) for LOW health. */
export const LIQUIDITY_DEPTH_LOW_MIN_USD = 100;

/** Order book levels (each side) used to compute spread and depth. */
export const LIQUIDITY_TOP_LEVELS = 3;

// ─── Subgraph ────────────────────────────────────────────────────────────────

/** Max `first` argument for Polymarket subgraph GraphQL queries. */
export const SUBGRAPH_FIRST_MAX = 200;

/**
 * Orderbook subgraph `orderbooks(where: { id_in: ... })` times out with large `id_in` lists
 * (Goldsky: "canceling statement due to statement timeout"). Query in chunks and merge.
 */
export const SUBGRAPH_ORDERBOOK_TRADE_COUNT_CHUNK = 5;

/** Parallel orderbook subgraph chunk requests; keep low to avoid Goldsky timeouts. */
export const SUBGRAPH_ORDERBOOK_TRADE_COUNT_CONCURRENCY = 2;

// ─── Enrich ───────────────────────────────────────────────────────────────────

/** Leaderboard: number of top entries to enrich with trade/position stats.
 * Keep in sync with web `ITEMS_PER_PAGE` in `apps/web/src/app/leaderboard/leaderboard-page.tsx` (50). */
export const ENRICH_TOP_N = 50;

/** Leaderboard stats cache TTL (ms). Per-address stats are cached to limit Data API calls. */
export const ENRICH_CACHE_TTL_MS = 5 * 60_000;

/** Max Gamma events when fetching event context for market sorting (e.g. "X others" badge). */
export const ENRICH_MAX_EVENTS_SORT = 200;

/** Max events when building conditionId→marketCount map. Cap to avoid excessive Gamma usage. */
export const ENRICH_MAX_EVENTS_CAP = 300;

// ─── Price history fidelity (minutes between data points) ─────────────────────

/** CLOB price-history fidelity for 1h interval. Minutes between points. */
export const CLOB_PRICE_HISTORY_FIDELITY_1M = 1;

/** Fidelity for 6h interval. */
export const CLOB_PRICE_HISTORY_FIDELITY_6H = 2;

/** Fidelity for 1d/1w intervals and explicit short time ranges (≤1h span → 1, else 5). */
export const CLOB_PRICE_HISTORY_FIDELITY_5M = 5;

/** Fidelity for 1m (month) interval. */
export const CLOB_PRICE_HISTORY_FIDELITY_1M_INTERVAL = 10;

/** Fidelity for max interval (one point per day = 1440 min). */
export const CLOB_PRICE_HISTORY_FIDELITY_MAX = 1440;
