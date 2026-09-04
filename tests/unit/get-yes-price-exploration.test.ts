/**
 * Exploratory test for getYesPrice() bug condition (Property 1).
 *
 * **Validates: Requirements 2.1**
 *
 * Bug: When outcomePrices is a string[] (post-Zod preprocessing), the original
 * getYesPrice() fell through to fallback values and returned 0. The fix adds
 * an Array.isArray(raw) check to correctly extract the first element.
 *
 * Since the fix is already applied, this test confirms the fix works:
 * gammaMarketToDiscoveryCard() with outcomePrices: ["0.65", "0.35"] should
 * return yesPrice of 0.65 (not 0 as it would on unfixed code).
 */
import { describe, expect, it } from "vitest";
import { gammaMarketToDiscoveryCard } from "../../apps/web/src/lib/markets/gamma-to-ui";
import type { Market } from "../../apps/web/src/lib/trpc/types";

/** Minimal market fixture with string[] outcomePrices (post-Zod format). */
function makeMarket(overrides: Partial<Market> = {}): Market {
  return {
    question: "Will it rain tomorrow?",
    active: true,
    closed: false,
    archived: false,
    slug: "will-it-rain-tomorrow",
    outcomePrices: ["0.65", "0.35"],
    ...overrides,
  } as Market;
}

describe("getYesPrice exploration — string[] outcomePrices (Property 1)", () => {
  it('returns yesPrice 0.65 when outcomePrices is ["0.65", "0.35"]', () => {
    const card = gammaMarketToDiscoveryCard(makeMarket());
    expect(card.yesPrice).toBeCloseTo(0.65);
  });

  it("returns yesPrice 0 when outcomePrices is an empty array", () => {
    const card = gammaMarketToDiscoveryCard(
      makeMarket({ outcomePrices: [] as string[] })
    );
    expect(card.yesPrice).toBe(0);
  });

  it("returns yesPrice 0.99 for high-probability market", () => {
    const card = gammaMarketToDiscoveryCard(
      makeMarket({ outcomePrices: ["0.99", "0.01"] })
    );
    expect(card.yesPrice).toBeCloseTo(0.99);
  });

  it("returns yesPrice 0.01 for low-probability market", () => {
    const card = gammaMarketToDiscoveryCard(
      makeMarket({ outcomePrices: ["0.01", "0.99"] })
    );
    expect(card.yesPrice).toBeCloseTo(0.01);
  });
});
