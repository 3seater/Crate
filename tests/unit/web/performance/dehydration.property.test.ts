import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { getQueryClient } from "@/shared/lib/trpc/query-client";

/**
 * Feature: nextjs-performance-optimization, Property 1: Streaming Dehydration Includes Pending Queries
 *
 * **Validates: Requirements 5.1**
 *
 * For any TanStack Query with `status === 'pending'`, the server QueryClient's
 * `shouldDehydrateQuery` function SHALL return `true`, ensuring pending queries
 * are included in the dehydrated state for streaming to the client.
 */

type QueryStatus = "pending" | "success" | "error";

/**
 * Arbitrary for query status values — the three possible TanStack Query statuses.
 */
const queryStatusArb = fc.constantFrom<QueryStatus>(
  "pending",
  "success",
  "error"
);

/**
 * Arbitrary for a minimal query-like object that satisfies the shape
 * expected by `shouldDehydrateQuery`. Only `state.status` is inspected
 * by both `defaultShouldDehydrateQuery` and the custom override.
 */
const queryStateArb = fc.record({
  state: fc.record({
    status: queryStatusArb,
    data: fc.oneof(fc.constant(undefined), fc.anything()),
    dataUpdatedAt: fc.nat(),
    error: fc.constant(null),
    errorUpdatedAt: fc.constant(0),
    fetchFailureCount: fc.constant(0),
    fetchFailureReason: fc.constant(null),
    fetchMeta: fc.constant(null),
    isInvalidated: fc.constant(false),
    fetchStatus: fc.constantFrom("idle", "fetching", "paused"),
    errorUpdateCount: fc.constant(0),
    dataUpdateCount: fc.nat(),
  }),
});

/**
 * Extract the shouldDehydrateQuery function from the QueryClient
 * created by getQueryClient().
 */
function getShouldDehydrateQuery(): (query: unknown) => boolean {
  const queryClient = getQueryClient();
  const dehydrateOpts = queryClient.getDefaultOptions().dehydrate;
  const shouldDehydrateQuery = dehydrateOpts?.shouldDehydrateQuery;
  if (!shouldDehydrateQuery) {
    throw new Error("shouldDehydrateQuery not configured on QueryClient");
  }
  return shouldDehydrateQuery as (query: unknown) => boolean;
}

describe("Property 1: Streaming Dehydration Includes Pending Queries", () => {
  /**
   * **Validates: Requirements 5.1**
   *
   * For any query with status === 'pending', shouldDehydrateQuery must return true.
   */
  it("returns true for all queries with status === 'pending'", () => {
    const shouldDehydrateQuery = getShouldDehydrateQuery();

    fc.assert(
      fc.property(queryStateArb, (query) => {
        if (query.state.status === "pending") {
          expect(shouldDehydrateQuery(query)).toBe(true);
        }
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 5.1**
   *
   * For any query with status === 'success', shouldDehydrateQuery must return true
   * (preserving default TanStack Query behavior).
   */
  it("preserves default behavior: returns true for success queries", () => {
    const shouldDehydrateQuery = getShouldDehydrateQuery();

    fc.assert(
      fc.property(queryStateArb, (query) => {
        if (query.state.status === "success") {
          expect(shouldDehydrateQuery(query)).toBe(true);
        }
      }),
      { numRuns: 20 }
    );
  });

  /**
   * **Validates: Requirements 5.1**
   *
   * For any query status, shouldDehydrateQuery returns true if and only if
   * the status is 'pending' or 'success' (the union of default + pending).
   */
  it("returns true iff status is 'pending' or 'success'", () => {
    const shouldDehydrateQuery = getShouldDehydrateQuery();

    fc.assert(
      fc.property(queryStateArb, (query) => {
        const result = shouldDehydrateQuery(query);
        const expected =
          query.state.status === "pending" || query.state.status === "success";

        expect(result).toBe(expected);
      }),
      { numRuns: 20 }
    );
  });
});
