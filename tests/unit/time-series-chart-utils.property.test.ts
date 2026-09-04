import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { appendTradePoint } from "@/features/trading/components/charts/time-series-chart-utils";

/**
 * Arbitrary for a single chart data point with a positive Unix timestamp and
 * a price between 0 (exclusive) and 1 (inclusive), matching Polymarket's
 * prediction market price range.
 */
const chartPointArb = fc.record({
  time: fc.integer({ min: 1, max: 2_000_000_000 }),
  value: fc.float({ min: Math.fround(0.001), max: 1, noNaN: true }),
});

/**
 * Arbitrary for a non-empty, time-sorted chart data array.
 * Points are generated and then sorted by time with duplicates removed,
 * ensuring the array is a valid chart data state.
 */
const sortedChartDataArb = fc
  .array(chartPointArb, { minLength: 1, maxLength: 50 })
  .map((points) => {
    const sorted = [...points].sort((a, b) => a.time - b.time);
    // Deduplicate by time — keep last value for each timestamp
    const seen = new Map<number, { time: number; value: number }>();
    for (const p of sorted) {
      seen.set(p.time, p);
    }
    return [...seen.values()].sort((a, b) => a.time - b.time);
  })
  .filter((arr) => arr.length > 0);

/**
 * Arbitrary that produces a sorted chart data array paired with a timestamp
 * strictly greater than the last element's time, ensuring the "append" case.
 */
const appendScenarioArb = sortedChartDataArb.chain((data) => {
  const lastTime = data.at(-1)?.time ?? 0;
  return fc.tuple(
    fc.constant(data),
    fc.integer({ min: lastTime + 1, max: lastTime + 1_000_000 }),
    fc.float({ min: Math.fround(0.001), max: 1, noNaN: true })
  );
});

describe("Property 19: Time-series chart data append", () => {
  /**
   * **Validates: Requirements 6.3**
   *
   * For any chart data state and any new `last_trade_price` event with a
   * timestamp strictly greater than the last point's time, appending the
   * event should increase the chart data length by exactly one, and the
   * last element should have the timestamp and price from the event.
   */
  it("appending event with new timestamp increases length by 1 and last element matches event", () => {
    fc.assert(
      fc.property(appendScenarioArb, ([data, timestamp, price]) => {
        const originalLength = data.length;
        const result = appendTradePoint(data, timestamp, price);

        // Length increases by exactly 1
        expect(result).toHaveLength(originalLength + 1);

        // Last element has the timestamp and price from the event
        const lastElement = result.at(-1);
        expect(lastElement).toBeDefined();
        expect(lastElement?.time).toBe(timestamp);
        expect(lastElement?.value).toBeCloseTo(price * 100);
      }),
      { numRuns: 100 }
    );
  });

  it("appending to empty array produces single-element array with event data", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2_000_000_000 }),
        fc.float({ min: Math.fround(0.001), max: 1, noNaN: true }),
        (timestamp, price) => {
          const result = appendTradePoint([], timestamp, price);

          expect(result).toHaveLength(1);
          expect(result[0].time).toBe(timestamp);
          expect(result[0].value).toBeCloseTo(price * 100);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("existing data points are preserved after append", () => {
    fc.assert(
      fc.property(appendScenarioArb, ([data, timestamp, price]) => {
        const result = appendTradePoint(data, timestamp, price);

        // All original points are preserved in order
        for (let i = 0; i < data.length; i++) {
          expect(result[i].time).toBe(data[i].time);
          expect(result[i].value).toBe(data[i].value);
        }
      }),
      { numRuns: 100 }
    );
  });
});
