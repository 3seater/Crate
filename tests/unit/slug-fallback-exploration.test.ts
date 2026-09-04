/**
 * Exploratory test for gammaMarketToDiscoveryCard() slug fallback (Property 3).
 *
 * **Validates: Requirements 2.3**
 *
 * Bug: When slug was undefined, the original code fell back to condition_id or
 * numeric id, producing invalid route slugs like "/market/0xabc". The fix uses
 * `market.slug ?? market.market_slug ?? ""` so the slug is always a valid
 * Gamma route slug or an empty string.
 *
 * Since the fix is already applied, this test confirms the fix works:
 * - slug: undefined + condition_id: "0xabc" → slug should be "" (not "0xabc")
 * - slug: undefined + market_slug: "will-x-happen" → slug should be "will-x-happen"
 * - slug: "valid-slug" → slug should be "valid-slug"
 */
import { describe, expect, it } from "vitest";
import { gammaMarketToDiscoveryCard } from "../../apps/web/src/lib/markets/gamma-to-ui";
import type { Market } from "../../apps/web/src/lib/trpc/types";

/** Minimal market fixture for slug fallback testing. */
function makeMarket(overrides: Partial<Market> = {}): Market {
  return {
    question: "Will it rain tomorrow?",
    active: true,
    closed: false,
    archived: false,
    outcomePrices: ["0.50", "0.50"],
    ...overrides,
  } as Market;
}

describe("gammaMarketToDiscoveryCard slug fallback exploration (Property 3)", () => {
  it('returns "" when slug is undefined and condition_id is "0xabc" (was bug: returned "0xabc")', () => {
    const card = gammaMarketToDiscoveryCard(
      makeMarket({
        slug: undefined,
        condition_id: "0xabc",
      })
    );
    expect(card.slug).toBe("");
  });

  it('returns "will-x-happen" when slug is undefined but market_slug is set', () => {
    const card = gammaMarketToDiscoveryCard(
      makeMarket({
        slug: undefined,
        market_slug: "will-x-happen",
        condition_id: "0xdef",
      } as Partial<Market>)
    );
    expect(card.slug).toBe("will-x-happen");
  });

  it('returns "valid-slug" when slug is present', () => {
    const card = gammaMarketToDiscoveryCard(
      makeMarket({
        slug: "valid-slug",
        condition_id: "0x123",
      })
    );
    expect(card.slug).toBe("valid-slug");
  });

  it('returns "" when both slug and market_slug are undefined', () => {
    const card = gammaMarketToDiscoveryCard(
      makeMarket({
        slug: undefined,
        condition_id: "0xfoo",
        id: "12345" as unknown as number,
      })
    );
    expect(card.slug).toBe("");
  });

  it("prefers slug over market_slug when both are present", () => {
    const card = gammaMarketToDiscoveryCard(
      makeMarket({
        slug: "primary-slug",
        market_slug: "secondary-slug",
      } as Partial<Market>)
    );
    expect(card.slug).toBe("primary-slug");
  });
});
