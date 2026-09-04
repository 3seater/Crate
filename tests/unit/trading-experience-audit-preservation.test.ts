/**
 * Preservation property tests for Trading Experience Audit.
 *
 * These tests verify EXISTING correct behavior that must be preserved after the fix.
 * They should PASS on unfixed code.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.5
 */

import type { UserTradeEvent } from "@doji/types";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  applyTradeToPositions,
  type LocalPosition,
  tradeRecordFromEvent,
} from "@/features/trading/stores/positions";

// ---------------------------------------------------------------------------
// Arbitrary generators
// ---------------------------------------------------------------------------

const sideArb = fc.constantFrom("BUY" as const, "SELL" as const);

const statusArb = fc.constantFrom(
  "MATCHED" as const,
  "MINED" as const,
  "CONFIRMED" as const,
  "RETRYING" as const,
  "FAILED" as const
);

const userTradeEventArb: fc.Arbitrary<UserTradeEvent> = fc.record({
  event_type: fc.constant("trade" as const),
  type: fc.constant("TRADE" as const),
  id: fc.string({ minLength: 1, maxLength: 32 }),
  asset_id: fc.string({ minLength: 1, maxLength: 32 }),
  market: fc.string({ minLength: 1, maxLength: 32 }),
  side: sideArb,
  size: fc
    .float({ min: Math.fround(0.01), max: Math.fround(100_000), noNaN: true })
    .map((n) => n.toFixed(2)),
  price: fc
    .float({ min: Math.fround(0.01), max: Math.fround(1.0), noNaN: true })
    .map((n) => n.toFixed(2)),
  status: statusArb,
  taker_order_id: fc.string({ minLength: 1, maxLength: 32 }),
  last_update: fc.string(),
  outcome: fc.constantFrom("Yes", "No"),
  owner: fc.string({ minLength: 1, maxLength: 42 }),
  trade_owner: fc.string({ minLength: 1, maxLength: 42 }),
  timestamp: fc.nat().map(String),
  maker_orders: fc.constant([]),
});

// ---------------------------------------------------------------------------
// 1. Market order trade records: no effectiveSide → side = event.side
// ---------------------------------------------------------------------------

describe("Preservation: Market order trade records unchanged", () => {
  it("tradeRecordFromEvent with no effectiveSide returns side: event.side", () => {
    /**
     * Validates: Requirements 3.1
     *
     * For market orders (taker = user), effectiveSide is undefined.
     * tradeRecordFromEvent should use event.side directly.
     */
    fc.assert(
      fc.property(userTradeEventArb, (event) => {
        const record = tradeRecordFromEvent(event);
        expect(record.side).toBe(event.side);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// 2. All non-side fields preserved
// ---------------------------------------------------------------------------

describe("Preservation: All non-side fields preserved", () => {
  it("tradeRecordFromEvent preserves id, asset_id, market, size, price, status, outcome", () => {
    /**
     * Validates: Requirements 3.1
     *
     * All fields other than side and timestamp should be copied directly
     * from the event to the trade record.
     */
    fc.assert(
      fc.property(userTradeEventArb, (event) => {
        const record = tradeRecordFromEvent(event);
        expect(record.id).toBe(event.id);
        expect(record.asset_id).toBe(event.asset_id);
        expect(record.market).toBe(event.market);
        expect(record.size).toBe(event.size);
        expect(record.price).toBe(event.price);
        expect(record.status).toBe(event.status);
        expect(record.outcome).toBe(event.outcome);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// 3. applyTradeToPositions BUY adds size
// ---------------------------------------------------------------------------

describe("Preservation: applyTradeToPositions BUY adds size", () => {
  it("BUY on empty positions creates a position with positive size", () => {
    /**
     * Validates: Requirements 3.2
     *
     * When applying a BUY trade to an empty positions array,
     * the resulting position should have positive size.
     */
    fc.assert(
      fc.property(userTradeEventArb, (event) => {
        const result = applyTradeToPositions([], event, "BUY");
        expect(result).toHaveLength(1);
        expect(result[0].size).toBeGreaterThan(0);
        expect(result[0].avgCost).toBeCloseTo(
          Number.parseFloat(event.price),
          5
        );
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// 4. applyTradeToPositions SELL subtracts size
// ---------------------------------------------------------------------------

describe("Preservation: applyTradeToPositions SELL subtracts size", () => {
  it("SELL on existing position reduces the position size", () => {
    /**
     * Validates: Requirements 3.2
     *
     * When applying a SELL trade to an existing position,
     * the resulting position size should be less than the original.
     */
    fc.assert(
      fc.property(userTradeEventArb, (event) => {
        const existingPosition: LocalPosition = {
          asset: event.asset_id,
          conditionId: event.market,
          size: 1000, // large enough that any sell reduces it
          curPrice: 0.5,
          outcome: "Yes",
        };
        const result = applyTradeToPositions([existingPosition], event, "SELL");
        expect(result[0].size).toBeLessThan(existingPosition.size);
        expect(result[0].avgCost).toBe(0.5);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// 5. applyTradeToPositions uses effectiveSide for size math
// ---------------------------------------------------------------------------

describe("Preservation: applyTradeToPositions uses effectiveSide for size math", () => {
  it("effectiveSide BUY with event.side SELL still increases position size", () => {
    /**
     * Validates: Requirements 3.2
     *
     * When effectiveSide = "BUY" but event.side = "SELL",
     * position size should increase (effectiveSide governs the math).
     */
    fc.assert(
      fc.property(
        userTradeEventArb.map((e) => ({ ...e, side: "SELL" as const })),
        (event) => {
          const result = applyTradeToPositions([], event, "BUY");
          expect(result).toHaveLength(1);
          expect(result[0].size).toBeGreaterThan(0);
          expect(result[0].avgCost).toBeCloseTo(
            Number.parseFloat(event.price),
            5
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});
