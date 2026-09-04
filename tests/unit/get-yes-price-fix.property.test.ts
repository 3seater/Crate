/**
 * Fix-checking property test for getYesPrice() — Property 1.
 *
 * **Validates: Requirements 2.1**
 *
 * For any string[] of numeric strings (values between 0 and 1),
 * gammaMarketToDiscoveryCard() returns yesPrice === parseFloat(arr[0])
 * or 0 for empty arrays.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gammaMarketToDiscoveryCard } from "../../apps/web/src/lib/markets/gamma-to-ui";
import type { Market } from "../../apps/web/src/lib/trpc/types";

/** Minimal market fixture with configurable outcomePrices. */
function makeMarket(outcomePrices: string[]): Market {
  return {
    question: "Test market?",
    active: true,
    closed: false,
    archived: false,
    slug: "test-market",
    outcomePrices,
  } as Market;
}

/**
 * Arbitrary for a numeric string between 0 and 1 (matching Polymarket price range).
 * Generates values like "0.55", "0.01", "0.99", "0", "1".
 */
const numericPriceStringArb = fc
  .float({ min: 0, max: 1, noNaN: true })
  .map((v) => v.toString());

/**
 * Arbitrary for a non-empty string[] of numeric price strings.
 * Polymarket binary markets have 2 elements [yesPrice, noPrice],
 * but we test with 1–5 elements for robustness.
 */
const nonEmptyPriceArrayArb = fc.array(numericPriceStringArb, {
  minLength: 1,
  maxLength: 5,
});

describe("Property 1 (fix-checking): getYesPrice handles string[] outcomePrices", () => {
  it("returns parseFloat(arr[0]) for any non-empty string[] of numeric strings", () => {
    fc.assert(
      fc.property(nonEmptyPriceArrayArb, (prices) => {
        const card = gammaMarketToDiscoveryCard(makeMarket(prices));
        const expected = Number.parseFloat(prices[0]) || 0;
        expect(card.yesPrice).toBeCloseTo(expected, 5);
      }),
      { numRuns: 200 }
    );
  });

  it("returns 0 for empty arrays", () => {
    const card = gammaMarketToDiscoveryCard(makeMarket([]));
    expect(card.yesPrice).toBe(0);
  });
});
