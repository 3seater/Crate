import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";

import { eventCache, marketCache } from "@/shared/lib/server-cache";

/**
 * Feature: nextjs-performance-optimization, Property 3: LRU Cache Round-Trip
 *
 * **Validates: Requirements 16.3**
 *
 * For any cache key (string) and value (serializable object), setting a value
 * in the LRU cache and then immediately getting it SHALL return the same value.
 * Additionally, for any key not in the cache, `get` SHALL return `undefined`.
 */

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary for cache keys — non-empty strings resembling slugs or identifiers. */
const cacheKeyArb = fc.string({ minLength: 1, maxLength: 100 });

/** Arbitrary for serializable object values stored in the cache. */
const cacheValueArb = fc.dictionary(
  fc.string({ minLength: 1, maxLength: 20 }),
  fc.oneof(
    fc.string(),
    fc.integer(),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.boolean(),
    fc.constant(null)
  ),
  { minKeys: 1, maxKeys: 10 }
) as fc.Arbitrary<Record<string, unknown>>;

/** Arbitrary for keys guaranteed not to collide with set keys. */
const missingKeyArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .map((s) => `__missing__${s}`);

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("Property 3: LRU Cache Round-Trip", () => {
  beforeEach(() => {
    marketCache.clear();
    eventCache.clear();
  });

  /**
   * **Validates: Requirements 16.3**
   *
   * For any key and serializable value, marketCache.set then marketCache.get
   * returns the same value.
   */
  it("marketCache round-trips: set then get returns the same value", () => {
    fc.assert(
      fc.property(cacheKeyArb, cacheValueArb, (key, value) => {
        marketCache.clear();
        marketCache.set(key, value);
        const retrieved = marketCache.get(key);
        expect(retrieved).toStrictEqual(value);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 16.3**
   *
   * For any key and serializable value, eventCache.set then eventCache.get
   * returns the same value.
   */
  it("eventCache round-trips: set then get returns the same value", () => {
    fc.assert(
      fc.property(cacheKeyArb, cacheValueArb, (key, value) => {
        eventCache.clear();
        eventCache.set(key, value);
        const retrieved = eventCache.get(key);
        expect(retrieved).toStrictEqual(value);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 16.3**
   *
   * For any key not in the cache, get returns undefined.
   */
  it("marketCache returns undefined for keys not in the cache", () => {
    fc.assert(
      fc.property(missingKeyArb, (key) => {
        marketCache.clear();
        expect(marketCache.get(key)).toBeUndefined();
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 16.3**
   *
   * For any key not in the cache, get returns undefined.
   */
  it("eventCache returns undefined for keys not in the cache", () => {
    fc.assert(
      fc.property(missingKeyArb, (key) => {
        eventCache.clear();
        expect(eventCache.get(key)).toBeUndefined();
      }),
      { numRuns: 20 }
    );
  });
});
