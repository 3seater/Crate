/**
 * Request deduplicator that coalesces concurrent identical in-flight requests.
 *
 * When multiple callers request the same resource concurrently, only one
 * upstream call is made. All callers receive the same resolved value or
 * the same rejection. Once the request completes (resolves or rejects),
 * the in-flight entry is removed so subsequent calls trigger a fresh request.
 */

export class RequestDeduplicator {
  private readonly inFlight = new Map<string, Promise<unknown>>();

  /**
   * Execute `fn`, but if an identical key is already in-flight,
   * return the existing promise instead of calling `fn` again.
   *
   * The key should follow the cache key format:
   * `${source}:${path}?${sortedQueryParams}`
   *
   * When the promise resolves or rejects, the in-flight entry is removed
   * so that subsequent calls with the same key trigger a new invocation of `fn`.
   *
   * @param key - Unique identifier for the request (e.g., cache key)
   * @param fn - Async function that performs the actual request
   * @returns The result of the request
   */
  dedupe<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inFlight.get(key);
    if (existing) {
      return existing as Promise<T>;
    }

    const promise = fn().finally(() => {
      this.inFlight.delete(key);
    });

    this.inFlight.set(key, promise);

    return promise;
  }

  /**
   * Returns the number of currently in-flight requests.
   */
  inflight(): number {
    return this.inFlight.size;
  }
}
