import "server-only";
import { LRUCache } from "lru-cache";

/**
 * Cross-request in-memory LRU caches for hot server data.
 *
 * These caches sit between the caller and `serverTrpc` inside `"use cache"`
 * functions. They deduplicate concurrent and closely-spaced requests for the
 * same key across different React server requests — complementary to:
 *
 * - `React.cache()` — deduplicates within a single request
 * - `"use cache"` / `cacheLife` — framework-level cache with disk persistence
 *
 * The LRU layer eliminates redundant HTTP round trips to the Hono API when
 * multiple concurrent requests hit the same market or event slug before the
 * framework cache has been populated.
 */

/** Market data cache — 200 entries max, 30s TTL. */
export const marketCache = new LRUCache<string, Record<string, unknown>>({
  max: 200,
  ttl: 30_000,
});

/** Event data cache — 200 entries max, 60s TTL. */
export const eventCache = new LRUCache<string, Record<string, unknown>>({
  max: 200,
  ttl: 60_000,
});
