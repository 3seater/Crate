import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  computeCompositeIndex,
  type TokenCandles,
} from "../../apps/web/src/domains/baskets/lib/composite-index";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const candleArb = fc.record({
  timestamp: fc.integer({ min: 0, max: 1e9 }),
  open: fc.float({
    min: Math.fround(0.01),
    max: Math.fround(1000),
    noNaN: true,
  }),
  high: fc.float({
    min: Math.fround(0.01),
    max: Math.fround(1000),
    noNaN: true,
  }),
  low: fc.float({
    min: Math.fround(0.01),
    max: Math.fround(1000),
    noNaN: true,
  }),
  close: fc.float({
    min: Math.fround(0.01),
    max: Math.fround(1000),
    noNaN: true,
  }),
  volume: fc.float({ min: 0, max: Math.fround(1e9), noNaN: true }),
});

const tokenCandlesArb: fc.Arbitrary<TokenCandles> = fc.record({
  symbol: fc.string({ minLength: 1 }),
  weight: fc.float({ min: Math.fround(0.01), max: 1, noNaN: true }),
  candles: fc.array(candleArb, { minLength: 1 }),
});

/**
 * A valid non-empty token list: at least one token, each token has at least one
 * candle with a positive close price (guaranteed by candleArb's min: 0.01).
 */
const validTokensArb: fc.Arbitrary<TokenCandles[]> = fc.array(tokenCandlesArb, {
  minLength: 1,
});

// ─── Property test ────────────────────────────────────────────────────────────

describe("Property 1: first composite index point always equals 100.0", () => {
  /**
   * **Validates: Requirements 7.2, 7.3**
   *
   * For any non-empty valid input (at least one token with at least one candle
   * with a positive close price), the first returned point from
   * `computeCompositeIndex` SHALL have `value === 100.0` (within floating-point
   * tolerance of 0.0001).
   *
   * This holds because each token is normalized to its anchor price at t₀, so
   * at t₀ every contributing token's normalized value is exactly 1.0, and the
   * weighted sum × 100 = 100.0.
   */
  it("result[0].value is approximately 100.0 for any non-empty valid input", () => {
    fc.assert(
      fc.property(validTokensArb, (tokens) => {
        const result = computeCompositeIndex(tokens);

        // The input is always valid (positive closes, non-empty candles),
        // so the result must be non-empty.
        expect(result.length).toBeGreaterThan(0);

        const firstValue = result[0].value;
        expect(Math.abs(firstValue - 100.0)).toBeLessThan(0.0001);
      }),
      { numRuns: 200 }
    );
  });
});

// ─── Concrete unit tests ──────────────────────────────────────────────────────

describe("computeCompositeIndex — unit tests", () => {
  it("single token, single candle returns [{timestamp, value: 100.0}]", () => {
    const tokens: TokenCandles[] = [
      {
        symbol: "ETH",
        weight: 1.0,
        candles: [
          {
            timestamp: 1000,
            open: 2,
            high: 3,
            low: 1,
            close: 2.5,
            volume: 100,
          },
        ],
      },
    ];

    const result = computeCompositeIndex(tokens);

    expect(result).toHaveLength(1);
    expect(result[0].timestamp).toBe(1000);
    expect(result[0].value).toBeCloseTo(100.0, 4);
  });

  it("two tokens, two timestamps — first point is 100.0", () => {
    // Token A: weight 0.5, prices [2.0, 4.0] → doubles
    // Token B: weight 0.5, prices [10.0, 5.0] → halves
    // At t₀ (ts=1000): both normalized to 1.0 → composite = 100.0
    // At t=2000: (4/2)×0.5 + (5/10)×0.5 = 1.0 + 0.25 = 1.25 weighted by 0.5+0.5=1 → 125.0 / 1 = 125.0
    const tokens: TokenCandles[] = [
      {
        symbol: "A",
        weight: 0.5,
        candles: [
          { timestamp: 1000, open: 2, high: 2, low: 2, close: 2, volume: 0 },
          { timestamp: 2000, open: 4, high: 4, low: 4, close: 4, volume: 0 },
        ],
      },
      {
        symbol: "B",
        weight: 0.5,
        candles: [
          {
            timestamp: 1000,
            open: 10,
            high: 10,
            low: 10,
            close: 10,
            volume: 0,
          },
          { timestamp: 2000, open: 5, high: 5, low: 5, close: 5, volume: 0 },
        ],
      },
    ];

    const result = computeCompositeIndex(tokens);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0].value).toBeCloseTo(100.0, 4);
  });

  it("all tokens have empty candles — returns []", () => {
    const tokens: TokenCandles[] = [
      { symbol: "A", weight: 0.5, candles: [] },
      { symbol: "B", weight: 0.5, candles: [] },
    ];

    const result = computeCompositeIndex(tokens);

    expect(result).toEqual([]);
  });
});
