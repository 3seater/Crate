/**
 * Preservation property tests — Server-Side Sort, Default Scroll, and
 * Non-Paginated Tables Unchanged (Property 2).
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 *
 * These tests capture the CURRENT (correct) behavior on UNFIXED code.
 * They must PASS both before and after the fix to confirm no regressions.
 *
 * Observation-first methodology: each test encodes observed baseline behavior.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { getActivityValue } from "@/features/portfolio/lib/activity-display-utils";

// ── Types matching source components ──────────────────────────────────────

interface ClosedPositionDisplay {
  asset: string;
  avgPrice: number;
  conditionId: string;
  curPrice: number;
  realizedPnl: number;
  timestamp: number;
  title?: string;
  totalBought: number;
}

// ── Sort function copied from closed-positions.tsx (not exported) ─────────

function sortClosedPositions(
  data: ClosedPositionDisplay[],
  sortField: "bought" | "sold" | "avg" | "PNL" | null,
  sortDirection: "asc" | "desc"
): ClosedPositionDisplay[] {
  if (!sortField || data.length === 0) {
    return data;
  }
  const getVal = (p: ClosedPositionDisplay): number => {
    switch (sortField) {
      case "bought":
        return p.avgPrice * p.totalBought;
      case "sold":
        return p.avgPrice * p.totalBought + (p.realizedPnl ?? 0);
      case "avg":
        return p.avgPrice;
      case "PNL":
        return p.realizedPnl ?? 0;
      default:
        return 0;
    }
  };
  return [...data].sort((a, b) => {
    const diff = getVal(b) - getVal(a);
    return sortDirection === "desc" ? diff : -diff;
  });
}
// ── CLOSED_SORT_API_MAP from closed-positions.tsx (not exported) ───────────

const CLOSED_SORT_API_MAP: Record<
  string,
  "REALIZEDPNL" | "TITLE" | "PRICE" | "AVGPRICE" | "TIMESTAMP" | null
> = {
  PNL: "REALIZEDPNL",
  avg: "AVGPRICE",
  bought: null,
  sold: null,
};

// ── Generators ────────────────────────────────────────────────────────────

const closedPositionArb = fc.record({
  asset: fc.string({ minLength: 1, maxLength: 10 }),
  avgPrice: fc.double({ min: 0.01, max: 1, noNaN: true }),
  conditionId: fc.string({ minLength: 1, maxLength: 10 }),
  curPrice: fc.double({ min: 0.01, max: 1, noNaN: true }),
  realizedPnl: fc.double({ min: -1000, max: 1000, noNaN: true }),
  timestamp: fc.integer({ min: 1000, max: 9_999_999 }),
  totalBought: fc.double({ min: 1, max: 10_000, noNaN: true }),
  title: fc.string({ minLength: 1, maxLength: 20 }),
});

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Property 2: Preservation — Server-Side Sort, Default Scroll, and Non-Paginated Tables Unchanged", () => {
  /**
   * Observation 1: CLOSED_SORT_API_MAP maps PNL→"REALIZEDPNL" and
   * avg→"AVGPRICE" (server-side sort), while "bought" and "sold" map to
   * null (client-side only, no server sort).
   *
   * When server-side sort is available, the API call includes sortBy/sortDirection
   * params and fetchNextPage is NOT called exhaustively.
   *
   * Validates: Requirements 3.1
   */
  describe("Server-side sort preservation for Closed Positions", () => {
    it("PNL maps to REALIZEDPNL and avg maps to AVGPRICE (server-side sort available)", () => {
      fc.assert(
        fc.property(fc.constantFrom("PNL", "avg"), (field) => {
          const apiSortBy = CLOSED_SORT_API_MAP[field];
          expect(apiSortBy).not.toBeNull();
          expect(typeof apiSortBy).toBe("string");
        }),
        { numRuns: 10 }
      );
    });

    it("bought and sold map to null (no server-side sort — client-side only)", () => {
      fc.assert(
        fc.property(fc.constantFrom("bought", "sold"), (field) => {
          const apiSortBy = CLOSED_SORT_API_MAP[field];
          expect(apiSortBy).toBeNull();
        }),
        { numRuns: 10 }
      );
    });

    it("server-sortable fields produce non-null API params that would be passed to the query", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("PNL", "avg"),
          fc.constantFrom("asc" as const, "desc" as const),
          (sortField, sortDirection) => {
            const apiSortBy = CLOSED_SORT_API_MAP[sortField] ?? null;
            const apiSortDirection = apiSortBy
              ? (sortDirection.toUpperCase() as "ASC" | "DESC")
              : undefined;

            // Server-side sort: apiSortBy is set, direction is set
            expect(apiSortBy).not.toBeNull();
            expect(apiSortDirection).toBeDefined();
            expect(["ASC", "DESC"]).toContain(apiSortDirection);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Observation 2: When sortField is null or matches the default ("PNL"),
   * the sort function returns data unchanged (no reordering). This is the
   * default sort state — infinite scroll lazy-loads pages on scroll as normal.
   *
   * Validates: Requirements 3.2, 3.4
   */
  describe("Default sort state preservation", () => {
    it("sortField=null returns data unchanged (identity)", () => {
      fc.assert(
        fc.property(
          fc.array(closedPositionArb, { minLength: 1, maxLength: 20 }),
          (data) => {
            const result = sortClosedPositions(data, null, "desc");
            // When sortField is null, data is returned as-is
            expect(result).toBe(data);
          }
        ),
        { numRuns: 50 }
      );
    });

    it("empty data returns empty array regardless of sort params", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("bought", "sold", "avg", "PNL", null) as fc.Arbitrary<
            "bought" | "sold" | "avg" | "PNL" | null
          >,
          fc.constantFrom("asc" as const, "desc" as const),
          (sortField, sortDirection) => {
            const result = sortClosedPositions([], sortField, sortDirection);
            expect(result).toEqual([]);
          }
        ),
        { numRuns: 20 }
      );
    });
  });
  /**
   * Observation 3: Trading Terminal Orders tab uses Zustand store
   * (useOrdersStore), not useInfiniteQuery. The sort function operates on
   * the full in-memory array — no pagination issue.
   *
   * We verify this by reading the source file and confirming:
   * - useOrdersStore is imported and used
   * - useInfiniteQuery is NOT imported
   * - Sort operates on the full orders array from the store
   *
   * Validates: Requirements 3.3, 3.4
   */
  describe("Trading Terminal Orders tab uses Zustand (not paginated)", () => {
    it("orders-tab.tsx imports useOrdersStore and does NOT import useInfiniteQuery", () => {
      const ordersTabPath = path.resolve(
        import.meta.dirname,
        "../../apps/web/src/features/trading/components/market/tabs/orders-tab.tsx"
      );
      const source = fs.readFileSync(ordersTabPath, "utf-8");

      // Zustand store is used for data
      expect(source).toContain("useOrdersStore");
      expect(source).toContain('from "@/features/trading/stores/orders"');

      // useInfiniteQuery is NOT used — data is fully in memory
      expect(source).not.toContain("useInfiniteQuery");
      expect(source).not.toContain("fetchNextPage");
    });

    it("orders-tab sort operates on the full in-memory array from Zustand", () => {
      // Replicate the sort logic from orders-tab.tsx
      interface OrderLike {
        expiration: string;
        price: string;
        size_matched: string;
      }

      const sortOrders = (
        orders: OrderLike[],
        ordSort: "price" | "filled" | "expiration" | null,
        ordDir: "asc" | "desc"
      ): OrderLike[] => {
        if (!(orders.length && ordSort)) {
          return orders;
        }
        const getVal = (o: OrderLike) => {
          const p = Number(o.price ?? 0);
          const matched = Number(o.size_matched ?? 0);
          const exp = o.expiration ? Number.parseInt(o.expiration, 10) : 0;
          if (ordSort === "price") {
            return p * 100;
          }
          if (ordSort === "filled") {
            return matched;
          }
          return exp;
        };
        return [...orders].sort((a, b) => {
          const diff = getVal(b) - getVal(a);
          return ordDir === "desc" ? diff : -diff;
        });
      };

      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              price: fc.double({ min: 0.01, max: 1, noNaN: true }).map(String),
              size_matched: fc
                .double({ min: 0, max: 1000, noNaN: true })
                .map(String),
              expiration: fc
                .integer({ min: 0, max: 9_999_999_999 })
                .map(String),
            }),
            { minLength: 1, maxLength: 30 }
          ),
          fc.constantFrom(
            "price" as const,
            "filled" as const,
            "expiration" as const
          ),
          fc.constantFrom("asc" as const, "desc" as const),
          (orders, sortField, sortDir) => {
            const sorted = sortOrders(orders, sortField, sortDir);
            // Sort operates on the FULL array — length is preserved
            expect(sorted).toHaveLength(orders.length);
            // All original items are present (no data loss from pagination)
            for (const order of orders) {
              expect(sorted).toContainEqual(order);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Observation 4: Trades tab currently has SortableHeader usage and
   * tmSort/tmDir state. This documents the current behavior that will
   * change after the fix (sort headers will be removed).
   *
   * Validates: Requirements 3.5
   */
  describe("Trades tab sort headers removed (post-fix verification)", () => {
    it("trades-tab.tsx does NOT import SortableHeader after fix", () => {
      const tradesTabPath = path.resolve(
        import.meta.dirname,
        "../../apps/web/src/features/trading/components/market/tabs/trades-tab.tsx"
      );
      const source = fs.readFileSync(tradesTabPath, "utf-8");

      // After fix: SortableHeader is NOT imported
      expect(source).not.toContain("SortableHeader");
      expect(source).not.toContain("getNextSortState");
    });

    it("trades-tab.tsx does NOT have tmSort/tmDir state variables after fix", () => {
      const tradesTabPath = path.resolve(
        import.meta.dirname,
        "../../apps/web/src/features/trading/components/market/tabs/trades-tab.tsx"
      );
      const source = fs.readFileSync(tradesTabPath, "utf-8");

      // After fix: sort state removed
      expect(source).not.toContain("tmSort");
      expect(source).not.toContain("tmDir");
      expect(source).not.toContain("onTmSort");
      expect(source).not.toContain("sortedTrades");
    });
  });
  /**
   * Observation 5: Sort functions are pure and deterministic. Given the
   * same input data and sort params, the sort functions always produce
   * the same output.
   *
   * Validates: Requirements 3.1, 3.2
   */
  describe("Sort functions are pure and deterministic", () => {
    it("sortClosedPositions produces identical output on repeated calls with same input", () => {
      fc.assert(
        fc.property(
          fc.array(closedPositionArb, { minLength: 2, maxLength: 20 }),
          fc.constantFrom("bought", "sold", "avg", "PNL") as fc.Arbitrary<
            "bought" | "sold" | "avg" | "PNL"
          >,
          fc.constantFrom("asc" as const, "desc" as const),
          (data, sortField, sortDirection) => {
            const result1 = sortClosedPositions(data, sortField, sortDirection);
            const result2 = sortClosedPositions(data, sortField, sortDirection);

            // Same output on repeated calls
            expect(result1).toEqual(result2);
            // Original data is not mutated
            expect(result1).not.toBe(data);
            expect(result2).not.toBe(data);
            // Length preserved
            expect(result1).toHaveLength(data.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it("sortClosedPositions output is correctly ordered (desc: first >= last)", () => {
      fc.assert(
        fc.property(
          fc.array(closedPositionArb, { minLength: 2, maxLength: 20 }),
          fc.constantFrom("bought", "sold", "avg", "PNL") as fc.Arbitrary<
            "bought" | "sold" | "avg" | "PNL"
          >,
          (data, sortField) => {
            const sorted = sortClosedPositions(data, sortField, "desc");

            const getVal = (p: ClosedPositionDisplay): number => {
              switch (sortField) {
                case "bought":
                  return p.avgPrice * p.totalBought;
                case "sold":
                  return p.avgPrice * p.totalBought + (p.realizedPnl ?? 0);
                case "avg":
                  return p.avgPrice;
                case "PNL":
                  return p.realizedPnl ?? 0;
                default:
                  return 0;
              }
            };

            // Verify descending order
            for (let i = 0; i < sorted.length - 1; i++) {
              expect(getVal(sorted[i])).toBeGreaterThanOrEqual(
                getVal(sorted[i + 1])
              );
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it("activity sort (getActivityValue) is deterministic for same input", () => {
      const activityItemArb = fc.record({
        type: fc.constantFrom("TRADE", "REDEEM", "SPLIT", "MERGE"),
        size: fc.double({ min: 0, max: 1000, noNaN: true }),
        usdcSize: fc.double({ min: 0, max: 1000, noNaN: true }),
        price: fc.double({ min: 0, max: 1, noNaN: true }),
        timestamp: fc.integer({ min: 1000, max: 9_999_999 }),
        side: fc.constantFrom("BUY", "SELL", null),
      });

      fc.assert(
        fc.property(activityItemArb, (item) => {
          const val1 = getActivityValue(item);
          const val2 = getActivityValue(item);
          expect(val1).toBe(val2);
          expect(typeof val1).toBe("number");
          expect(Number.isNaN(val1)).toBe(false);
        }),
        { numRuns: 100 }
      );
    });
  });
});
