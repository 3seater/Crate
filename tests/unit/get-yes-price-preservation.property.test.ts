/**
 * Preservation property test for getYesPrice() — Property 5.
 *
 * **Validates: Requirements 3.7**
 *
 * For any market with raw JSON string outcomePrices (e.g. '["0.55","0.45"]'),
 * getYesPrice() returns the same result as before the fix: it JSON.parses the
 * string and returns parseFloat of the first element.
 *
 * The fix only added an Array.isArray(raw) check BEFORE the existing
 * typeof raw !== "string" check, so string inputs still flow through the
 * original JSON.parse path unchanged.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gammaMarketToDiscoveryCard } from "../../apps/web/src/lib/markets/gamma-to-ui";
import type { Market } from "../../apps/web/src/lib/trpc/types";

/** Minimal market fixture with raw JSON string outcomePrices. */
function makeMarket(outcomePrices: string): Market {
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
 */
const numericPriceStringArb = fc
  .float({ min: 0, max: 1, noNaN: true })
  .map((v) => v.toString());

/**
 * Arbitrary for a pair of numeric price strings, JSON.stringified into a raw
 * JSON string — the format that arrives before Zod preprocessing.
 * E.g. '["0.55","0.45"]'
 */
const rawJsonPricePairArb = fc
  .tuple(numericPriceStringArb, numericPriceStringArb)
  .map(([yes, no]) => JSON.stringify([yes, no]));

/**
 * Arbitrary for a single-element numeric price array as raw JSON string.
 * E.g. '["0.72"]'
 */
const rawJsonSinglePriceArb = numericPriceStringArb.map((p) =>
  JSON.stringify([p])
);

describe("Property 5 (preservation): getYesPrice handles raw JSON string outcomePrices unchanged", () => {
  it("returns parseFloat of first element for any raw JSON pair string", () => {
    fc.assert(
      fc.property(rawJsonPricePairArb, (rawJson) => {
        const card = gammaMarketToDiscoveryCard(makeMarket(rawJson));
        const arr = JSON.parse(rawJson) as string[];
        const expected = Number.parseFloat(arr[0]) || 0;
        expect(card.yesPrice).toBeCloseTo(expected, 5);
      }),
      { numRuns: 200 }
    );
  });

  it("returns parseFloat of first element for any raw JSON single-element string", () => {
    fc.assert(
      fc.property(rawJsonSinglePriceArb, (rawJson) => {
        const card = gammaMarketToDiscoveryCard(makeMarket(rawJson));
        const arr = JSON.parse(rawJson) as string[];
        const expected = Number.parseFloat(arr[0]) || 0;
        expect(card.yesPrice).toBeCloseTo(expected, 5);
      }),
      { numRuns: 100 }
    );
  });

  it("returns 0 for raw JSON empty array string", () => {
    const card = gammaMarketToDiscoveryCard(makeMarket("[]"));
    expect(card.yesPrice).toBe(0);
  });

  it("returns 0 for malformed JSON string", () => {
    const card = gammaMarketToDiscoveryCard(makeMarket("not-json"));
    expect(card.yesPrice).toBe(0);
  });
});
