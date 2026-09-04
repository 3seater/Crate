/**
 * Property-based tests for activity feed logic (Properties 10–12).
 *
 * Tests pure merge/sort, enrichment, and pagination logic without
 * hitting the database or external APIs.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Pure logic functions extracted from the wallets router
// ---------------------------------------------------------------------------

interface Trade {
  timestamp: number;
  [key: string]: unknown;
}

interface EnrichedTrade extends Trade {
  walletAddress: string;
  walletLabel: string;
}

interface TrackedWallet {
  address: string;
  id: string;
  label: string;
}

/**
 * Merge trades from multiple wallets, enrich with wallet metadata,
 * and sort by timestamp DESC.
 */
function mergeAndSortTrades(
  walletTrades: { wallet: TrackedWallet; trades: Trade[] }[]
): EnrichedTrade[] {
  const allTrades: EnrichedTrade[] = [];
  for (const { wallet, trades } of walletTrades) {
    for (const trade of trades) {
      allTrades.push({
        ...trade,
        walletLabel: wallet.label,
        walletAddress: wallet.address,
      });
    }
  }
  allTrades.sort((a, b) => {
    const tsA = typeof a.timestamp === "number" ? a.timestamp : 0;
    const tsB = typeof b.timestamp === "number" ? b.timestamp : 0;
    return tsB - tsA;
  });
  return allTrades;
}

/**
 * Apply pagination to a sorted trade list.
 */
function paginateTrades(
  trades: EnrichedTrade[],
  limit: number,
  offset: number
): { trades: EnrichedTrade[]; total: number; hasMore: boolean } {
  const total = trades.length;
  const paginated = trades.slice(offset, offset + limit);
  const hasMore = offset + limit < total;
  return { trades: paginated, total, hasMore };
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Random trade with a numeric timestamp */
const tradeArb = fc.record({
  timestamp: fc.integer({ min: 0, max: 2_000_000_000 }),
  conditionId: fc.stringMatching(/^[0-9a-f]{10}$/),
  side: fc.constantFrom("BUY", "SELL"),
  size: fc.float({
    min: Math.fround(0.01),
    max: Math.fround(10_000),
    noNaN: true,
  }),
});

/** Random tracked wallet */
const walletArb = fc.record({
  id: fc.uuid(),
  address: fc.stringMatching(/^[0-9a-f]{40}$/).map((hex) => `0x${hex}`),
  label: fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => s.trim().length > 0),
});

/** A wallet with its list of trades */
const walletWithTradesArb = fc.record({
  wallet: walletArb,
  trades: fc.array(tradeArb, { minLength: 0, maxLength: 20 }),
});

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

// Feature: wallet-tracking, Property 10: Activity feed merge sort
describe("Property 10: Activity feed merge sort", () => {
  /**
   * **Validates: Requirements 6.2**
   *
   * For any set of trade lists from multiple wallets, the merged feed
   * is sorted by timestamp DESC.
   */
  it("merged feed is sorted by timestamp descending for any set of wallet trades", () => {
    fc.assert(
      fc.property(
        fc.array(walletWithTradesArb, { minLength: 0, maxLength: 5 }),
        (walletTrades) => {
          const merged = mergeAndSortTrades(walletTrades);

          // Total trade count matches sum of all input trades
          const expectedCount = walletTrades.reduce(
            (sum, wt) => sum + wt.trades.length,
            0
          );
          expect(merged.length).toBe(expectedCount);

          // Sorted by timestamp DESC
          for (let i = 0; i < merged.length - 1; i++) {
            expect(merged[i]?.timestamp).toBeGreaterThanOrEqual(
              merged[i + 1]?.timestamp
            );
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});

// Feature: wallet-tracking, Property 11: Wallet label enrichment
describe("Property 11: Wallet label enrichment", () => {
  /**
   * **Validates: Requirements 6.3**
   *
   * For any trade in the feed, walletLabel matches the tracked wallet's label.
   */
  it("every trade's walletLabel matches its source wallet's label", () => {
    fc.assert(
      fc.property(
        fc.array(walletWithTradesArb, { minLength: 1, maxLength: 5 }),
        (walletTrades) => {
          const merged = mergeAndSortTrades(walletTrades);

          // Build a lookup: address → label
          const labelByAddress = new Map<string, string>();
          for (const { wallet } of walletTrades) {
            labelByAddress.set(wallet.address, wallet.label);
          }

          // Every trade's walletLabel must match its walletAddress's label
          for (const trade of merged) {
            const expectedLabel = labelByAddress.get(trade.walletAddress);
            expect(trade.walletLabel).toBe(expectedLabel);
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});

// Feature: wallet-tracking, Property 12: Pagination respects bounds
describe("Property 12: Pagination respects bounds", () => {
  /**
   * **Validates: Requirements 6.4**
   *
   * For any valid limit/offset, result has at most `limit` trades;
   * offset beyond total returns empty.
   */
  it("returns at most `limit` trades and empty when offset exceeds total", () => {
    fc.assert(
      fc.property(
        fc.array(walletWithTradesArb, { minLength: 0, maxLength: 5 }),
        fc.integer({ min: 1, max: 500 }),
        fc.integer({ min: 0, max: 2000 }),
        (walletTrades, limit, offset) => {
          const merged = mergeAndSortTrades(walletTrades);
          const result = paginateTrades(merged, limit, offset);

          // At most `limit` trades
          expect(result.trades.length).toBeLessThanOrEqual(limit);

          // Total reflects the full merged list
          expect(result.total).toBe(merged.length);

          // When offset >= total, result is empty
          if (offset >= merged.length) {
            expect(result.trades.length).toBe(0);
          }

          // hasMore is correct
          expect(result.hasMore).toBe(offset + limit < merged.length);
        }
      ),
      { numRuns: 10 }
    );
  });
});
