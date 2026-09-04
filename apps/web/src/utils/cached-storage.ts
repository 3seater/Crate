import "client-only";

/**
 * Module-level localStorage cache.
 *
 * Avoids repeated synchronous `localStorage.getItem` calls on hot render paths
 * by keeping an in-memory `Map` that is populated on first read per key.
 *
 * - `getCachedStorage(key)` — returns the cached value or reads from localStorage once.
 * - `invalidateStorageCache(key)` — evicts a key so the next read goes to localStorage.
 */

const cache = new Map<string, string | null>();

/**
 * Return the value for `key` from an in-memory cache, falling back to
 * `localStorage.getItem` on the first access. SSR-safe — returns `null`
 * when `window` is not available.
 */
export function getCachedStorage(key: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (cache.has(key)) {
    return cache.get(key) as string | null;
  }

  try {
    const value = localStorage.getItem(key);
    cache.set(key, value);
    return value;
  } catch {
    return null;
  }
}

/**
 * Remove `key` from the in-memory cache so the next `getCachedStorage` call
 * re-reads from `localStorage`.
 */
export function invalidateStorageCache(key: string): void {
  cache.delete(key);
}
