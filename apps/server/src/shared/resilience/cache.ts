/**
 * In-memory TTL cache with LRU eviction.
 *
 * Stores API responses keyed by a deterministic cache key derived from
 * the API source, path, and query parameters. Supports per-entry TTL
 * overrides and prefix-based invalidation.
 */

export interface CacheConfig {
  defaultTtlMs: number;
  maxEntries: number;
}

export interface CacheEntry<T> {
  expiresAt: number;
  lastAccessed: number;
  value: T;
}

export class TtlCache {
  private readonly entries = new Map<string, CacheEntry<unknown>>();
  private readonly config: CacheConfig;

  constructor(config: CacheConfig) {
    this.config = config;
  }

  /**
   * Retrieve a cached value by key.
   *
   * Returns the cached value if the entry exists and has not expired.
   * Updates `lastAccessed` on hit. Returns `undefined` if the entry
   * is missing or expired (expired entries are evicted on access).
   */
  get<T>(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) {
      return;
    }

    if (Date.now() >= entry.expiresAt) {
      this.entries.delete(key);
      return;
    }

    entry.lastAccessed = Date.now();
    return entry.value as T;
  }

  /**
   * Store a value in the cache.
   *
   * If the cache is at capacity, the least-recently-used entry is evicted
   * before inserting the new entry. An optional `ttlMs` overrides the
   * default TTL for this specific entry.
   */
  set<T>(key: string, value: T, ttlMs?: number): void {
    // If the key already exists, delete it first so the new entry
    // is appended at the end of the Map (preserving insertion order).
    if (this.entries.has(key)) {
      this.entries.delete(key);
    }

    // Evict LRU entries if at capacity
    while (this.entries.size >= this.config.maxEntries) {
      this.evictLru();
    }

    const now = Date.now();
    const effectiveTtl = ttlMs ?? this.config.defaultTtlMs;

    this.entries.set(key, {
      value,
      expiresAt: now + effectiveTtl,
      lastAccessed: now,
    });
  }

  /**
   * Invalidate cache entries.
   *
   * If `keyPrefix` is provided, only entries whose keys start with the
   * prefix are removed. If omitted, all entries are cleared.
   */
  invalidate(keyPrefix?: string): void {
    if (keyPrefix === undefined) {
      this.entries.clear();
      return;
    }

    for (const key of this.entries.keys()) {
      if (key.startsWith(keyPrefix)) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Returns the current number of entries in the cache.
   */
  size(): number {
    return this.entries.size;
  }

  /**
   * Evict the least-recently-used entry from the cache.
   */
  private evictLru(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.entries) {
      if (entry.lastAccessed < oldestAccess) {
        oldestAccess = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.entries.delete(oldestKey);
    }
  }
}

/**
 * Build a deterministic cache key from an API source, path, and query parameters.
 *
 * Parameters are sorted alphabetically by key to ensure the same set of
 * parameters always produces the same cache key regardless of insertion order.
 *
 * Format: `${source}:${path}?${key1=val1&key2=val2}`
 *
 * If no parameters are provided, the key is `${source}:${path}`.
 */
export type QueryParams = Record<string, string | string[] | undefined>;

export function buildCacheKey(
  source: string,
  path: string,
  params?: QueryParams
): string {
  const base = `${source}:${path}`;

  if (!params || Object.keys(params).length === 0) {
    return base;
  }

  const sortedQuery = Object.keys(params)
    .sort()
    .map((key) => {
      const v = params[key];
      const val = Array.isArray(v)
        ? v.filter(Boolean).join(",")
        : String(v ?? "");
      return val === "" ? null : `${key}=${val}`;
    })
    .filter(Boolean)
    .join("&");

  return sortedQuery ? `${base}?${sortedQuery}` : base;
}
