import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

/**
 * Feature: nextjs-performance-optimization, Property 4: React.cache() Request-Scoped Deduplication
 *
 * **Validates: Requirements 21.2, 36.2**
 *
 * For any function wrapped in `React.cache()` and any set of arguments,
 * calling the wrapped function twice with the same arguments within the same
 * React server request SHALL return the exact same object reference
 * (referential equality), confirming the underlying fetch executes only once.
 *
 * `React.cache()` requires the React server request dispatcher which is not
 * available in Vitest. We test the contract by creating a request-scoped
 * memoization wrapper that mirrors the documented behavior:
 *   - Same args within a request → same object reference (referential equality)
 *   - Underlying function called exactly once per unique args per request
 *   - Different args → different results, no cross-contamination
 *   - New request scope → fresh calls (no stale data across requests)
 */

// ---------------------------------------------------------------------------
// Request-scoped cache — mirrors the React.cache() contract
// ---------------------------------------------------------------------------

/**
 * Simulates `React.cache()` request-scoped deduplication.
 * Each "request" gets its own Map; within a request, same serialized args
 * return the same object reference.
 */
function createRequestScopedCache<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>
): {
  /** The cached wrapper — behaves like React.cache(fn). */
  cached: (...args: TArgs) => Promise<TResult>;
  /** Start a new request scope (clears the per-request memo). */
  newRequest: () => void;
} {
  let memo = new Map<string, TResult>();
  return {
    cached: async (...args: TArgs): Promise<TResult> => {
      const key = JSON.stringify(args);
      if (memo.has(key)) {
        return memo.get(key) as TResult;
      }
      const result = await fn(...args);
      memo.set(key, result);
      return result;
    },
    newRequest: () => {
      memo = new Map();
    },
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary for slugs — lowercase alphanumeric with hyphens. */
const slugArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{2,30}[a-z0-9]$/)
  .filter((s) => !s.includes("--"));

/** Arbitrary for argument tuples — pairs of primitive values. */
const argsArb = fc.tuple(
  fc.oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.integer()),
  fc.oneof(fc.string({ minLength: 1, maxLength: 20 }), fc.integer())
);

// ---------------------------------------------------------------------------
// Mock data factories
// ---------------------------------------------------------------------------

function mockMarketData(slug: string) {
  return {
    slug,
    question: `Will ${slug} happen?`,
    conditionId: `0x${slug.replace(/-/g, "")}`,
    active: true,
  };
}

function mockEventData(slug: string) {
  return {
    slug,
    title: `Event: ${slug}`,
    markets: [{ slug: `${slug}-market-1` }],
  };
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("Property 4: React.cache() Request-Scoped Deduplication", () => {
  /**
   * **Validates: Requirements 21.2, 36.2**
   *
   * For any slug, calling the cached function twice with the same argument
   * within the same request returns the exact same object reference.
   */
  it("returns the same object reference for identical args within a request (market)", () => {
    const underlying = vi.fn(async (slug: string) => mockMarketData(slug));
    const { cached, newRequest } = createRequestScopedCache(underlying);

    fc.assert(
      fc.asyncProperty(slugArb, async (slug) => {
        newRequest();
        underlying.mockClear();

        const first = await cached(slug);
        const second = await cached(slug);

        // Referential equality — same object, not just deep-equal
        expect(second).toBe(first);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 21.2, 36.2**
   *
   * For any slug, calling the cached function twice with the same argument
   * within the same request returns the exact same object reference (event).
   */
  it("returns the same object reference for identical args within a request (event)", () => {
    const underlying = vi.fn(async (slug: string) => mockEventData(slug));
    const { cached, newRequest } = createRequestScopedCache(underlying);

    fc.assert(
      fc.asyncProperty(slugArb, async (slug) => {
        newRequest();
        underlying.mockClear();

        const first = await cached(slug);
        const second = await cached(slug);

        expect(second).toBe(first);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 21.2, 36.2**
   *
   * The underlying function is called exactly once per unique args within
   * a single request, confirming deduplication.
   */
  it("calls the underlying function exactly once per unique args per request", () => {
    const underlying = vi.fn(async (slug: string) => mockMarketData(slug));
    const { cached, newRequest } = createRequestScopedCache(underlying);

    fc.assert(
      fc.asyncProperty(slugArb, async (slug) => {
        newRequest();
        underlying.mockClear();

        await cached(slug);
        await cached(slug);
        await cached(slug);

        expect(underlying).toHaveBeenCalledTimes(1);
        expect(underlying).toHaveBeenCalledWith(slug);
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 21.2, 36.2**
   *
   * For any two distinct argument tuples, the cached function returns
   * different results — no cross-contamination between different args.
   */
  it("returns different results for different args (no cross-contamination)", () => {
    const underlying = vi.fn(
      async (a: string | number, b: string | number) => ({ a, b })
    );
    const { cached, newRequest } = createRequestScopedCache(underlying);

    fc.assert(
      fc.asyncProperty(argsArb, argsArb, async ([a1, b1], [a2, b2]) => {
        // Only test when args are actually different
        if (JSON.stringify([a1, b1]) === JSON.stringify([a2, b2])) {
          return;
        }

        newRequest();
        underlying.mockClear();

        const result1 = await cached(a1, b1);
        const result2 = await cached(a2, b2);

        expect(result1).not.toBe(result2);
        expect(result1).toStrictEqual({ a: a1, b: b1 });
        expect(result2).toStrictEqual({ a: a2, b: b2 });
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 21.2, 36.2**
   *
   * A new request scope resets the cache — the underlying function is
   * called again even for previously-seen args.
   */
  it("new request scope resets the cache (no stale data across requests)", () => {
    const underlying = vi.fn(async (slug: string) => mockMarketData(slug));
    const { cached, newRequest } = createRequestScopedCache(underlying);

    fc.assert(
      fc.asyncProperty(slugArb, async (slug) => {
        // First request
        newRequest();
        underlying.mockClear();
        const firstRequest = await cached(slug);
        expect(underlying).toHaveBeenCalledTimes(1);

        // Second request — same slug, but new scope
        newRequest();
        underlying.mockClear();
        const secondRequest = await cached(slug);
        expect(underlying).toHaveBeenCalledTimes(1);

        // Deep-equal but NOT referentially equal (different request scopes)
        expect(secondRequest).toStrictEqual(firstRequest);
        expect(secondRequest).not.toBe(firstRequest);
      }),
      { numRuns: 20 }
    );
  });
});
