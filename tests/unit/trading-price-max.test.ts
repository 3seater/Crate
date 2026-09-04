/**
 * Trading Safety Audit — CLOB_PRICE_MAX bugfix tests.
 *
 * Property-based tests verify roundPriceToTick and isPriceValidForTickSize
 * work correctly across all tick sizes including 0.0001, with prices up to 0.9999.
 *
 * Unit tests verify specific bug-condition inputs (prices in 0.9991–0.9999 range).
 */

import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeMarketBuyPrice } from "../../apps/web/src/lib/trading/market-sell-shared";
import { isPriceValidForTickSize } from "../../apps/web/src/lib/trading/order-validation";
import { roundPriceToTick } from "../../apps/web/src/lib/trading/trading-utils";
import { CLOB_PRICE_MAX } from "../../packages/types/src/constants";

const TICK_SIZES = [0.1, 0.01, 0.001, 0.0001] as const;

/** Decimal places for a tick size. */
function decimalsForTick(tick: number): number {
  if (tick >= 0.1) {
    return 1;
  }
  if (tick >= 0.01) {
    return 2;
  }
  if (tick >= 0.001) {
    return 3;
  }
  return 4;
}

/** Generate a valid price for a given tick size: a multiple of tick in [tick, 0.9999]. */
function validPriceForTick(tick: number) {
  const maxTicks = Math.floor(CLOB_PRICE_MAX / tick);
  return fc.integer({ min: 1, max: maxTicks }).map((n) => {
    const raw = n * tick;
    return Number.parseFloat(raw.toFixed(decimalsForTick(tick)));
  });
}

// ── Property-Based Tests ──────────────────────────────────────────────────

describe("Feature: trading-safety-audit, Property 1: roundPriceToTick produces valid tick-aligned prices up to 0.9999", () => {
  for (const tick of TICK_SIZES) {
    it(`tick=${tick}: output is within [${tick}, ${CLOB_PRICE_MAX}] and is a valid tick multiple`, () => {
      fc.assert(
        fc.property(validPriceForTick(tick), (price) => {
          const result = roundPriceToTick(price, tick);
          // Within bounds
          expect(result).toBeGreaterThanOrEqual(tick);
          expect(result).toBeLessThanOrEqual(CLOB_PRICE_MAX);
          // Valid tick multiple
          expect(isPriceValidForTickSize(result, tick)).toBe(true);
        }),
        { numRuns: 200 }
      );
    });
  }

  it("0.0001 tick: prices in the 0.999–0.9999 range are NOT clamped to 0.999", () => {
    const highPrices = [0.9991, 0.9993, 0.9995, 0.9997, 0.9999];
    for (const price of highPrices) {
      const result = roundPriceToTick(price, 0.0001);
      expect(result).toBe(price);
    }
  });
});

describe("Feature: trading-safety-audit, Property 2: roundPriceToTick ∘ isPriceValidForTickSize round-trip", () => {
  for (const tick of TICK_SIZES) {
    it(`tick=${tick}: isPriceValidForTickSize(roundPriceToTick(price, tick), tick) === true`, () => {
      // Generate any price in the valid range (not necessarily tick-aligned)
      const anyPrice = fc.double({
        min: tick,
        max: CLOB_PRICE_MAX,
        noNaN: true,
      });
      fc.assert(
        fc.property(anyPrice, (price) => {
          const rounded = roundPriceToTick(price, tick);
          expect(isPriceValidForTickSize(rounded, tick)).toBe(true);
        }),
        { numRuns: 200 }
      );
    });
  }
});

// ── Unit Tests: Bug Condition ─────────────────────────────────────────────

describe("roundPriceToTick — fine-tick (0.0001) bug condition", () => {
  it("does not clamp 0.9991 to 0.999", () => {
    expect(roundPriceToTick(0.9991, 0.0001)).toBe(0.9991);
  });

  it("does not clamp 0.9995 to 0.999", () => {
    expect(roundPriceToTick(0.9995, 0.0001)).toBe(0.9995);
  });

  it("does not clamp 0.9999 to 0.999", () => {
    expect(roundPriceToTick(0.9999, 0.0001)).toBe(0.9999);
  });

  it("clamps price > 0.9999 to 0.9999", () => {
    expect(roundPriceToTick(1.0, 0.0001)).toBe(0.9999);
    expect(roundPriceToTick(1.5, 0.0001)).toBe(0.9999);
  });

  it("preserves normal-range prices on 0.01 tick", () => {
    expect(roundPriceToTick(0.5, 0.01)).toBe(0.5);
    expect(roundPriceToTick(0.99, 0.01)).toBe(0.99);
    expect(roundPriceToTick(0.01, 0.01)).toBe(0.01);
  });

  it("preserves normal-range prices on 0.001 tick", () => {
    expect(roundPriceToTick(0.5, 0.001)).toBe(0.5);
    expect(roundPriceToTick(0.999, 0.001)).toBe(0.999);
    expect(roundPriceToTick(0.001, 0.001)).toBe(0.001);
  });
});

describe("isPriceValidForTickSize — fine-tick (0.0001) bug condition", () => {
  it("accepts 0.9991 with tick 0.0001", () => {
    expect(isPriceValidForTickSize(0.9991, 0.0001)).toBe(true);
  });

  it("accepts 0.9995 with tick 0.0001", () => {
    expect(isPriceValidForTickSize(0.9995, 0.0001)).toBe(true);
  });

  it("accepts 0.9999 with tick 0.0001", () => {
    expect(isPriceValidForTickSize(0.9999, 0.0001)).toBe(true);
  });

  it("rejects 0.99991 with tick 0.0001 (too many decimals)", () => {
    expect(isPriceValidForTickSize(0.999_91, 0.0001)).toBe(false);
  });
});

describe("computeMarketBuyPrice — fallback does not hardcode 0.999", () => {
  it("does not clamp bestAsk=0.9995 to 0.999", () => {
    const result = computeMarketBuyPrice(0.9995, 0.5, 0.0001);
    expect(result).toBe(0.9995);
  });

  it("does not clamp bestAsk=0.9999 to 0.999", () => {
    const result = computeMarketBuyPrice(0.9999, 0.5, 0.0001);
    expect(result).toBe(0.9999);
  });

  it("preserves normal bestAsk on 0.01 tick", () => {
    const result = computeMarketBuyPrice(0.65, 0.5, 0.01);
    expect(result).toBe(0.65);
  });
});

describe("CLOB_PRICE_MAX constant", () => {
  it("is 0.9999", () => {
    expect(CLOB_PRICE_MAX).toBe(0.9999);
  });
});
