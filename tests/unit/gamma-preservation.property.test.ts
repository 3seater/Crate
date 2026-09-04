/**
 * Preservation property test for getMarkets() and getMarketBySlug() — Property 5.
 *
 * **Validates: Requirements 3.7**
 *
 * The fix only changed searchMarkets(). These tests verify that getMarkets()
 * and getMarketBySlug() continue to apply all three post-processing
 * transformations (normalizeMarketAtBoundary, synthesizeTokens, sanitizeImageUrls)
 * exactly as before.
 */
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getMarketBySlug,
  getMarkets,
} from "../../apps/server/src/lib/polymarket/gamma";
import { getSharedCache } from "../../apps/server/src/lib/polymarket/resilient-fetch";

function makeRawApiMarket(overrides: Record<string, unknown> = {}) {
  return {
    question: "Will it rain?",
    active: true,
    closed: false,
    archived: false,
    slug: "will-it-rain",
    outcomes: '["Yes","No"]',
    outcomePrices: '["0.60","0.40"]',
    clobTokenIds: '["tok-yes","tok-no"]',
    ...overrides,
  };
}

const priceStringArb = fc
  .integer({ min: 1, max: 99 })
  .map((n) => (n / 100).toFixed(2));
const rawPricePairArb = fc
  .tuple(priceStringArb, priceStringArb)
  .map(([y, n]) => JSON.stringify([y, n]));
const tokenIdPairArb = fc
  .tuple(
    fc.stringMatching(/^[a-z0-9]{4,12}$/),
    fc.stringMatching(/^[a-z0-9]{4,12}$/)
  )
  .map(([a, b]) => JSON.stringify([`tok-${a}`, `tok-${b}`]));
const trailingWsArb = fc.constantFrom("", " ", "\n", "\t\n", "  \r\n");

describe("Property 5 (preservation): getMarkets() applies all three transformations", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("synthesizes tokens from clobTokenIds + outcomePrices for any price pair", async () => {
    await fc.assert(
      fc.asyncProperty(rawPricePairArb, tokenIdPairArb, async (prices, ids) => {
        getSharedCache().invalidate();
        fetchSpy.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [
            makeRawApiMarket({ outcomePrices: prices, clobTokenIds: ids }),
          ],
        });
        const markets = await getMarkets();
        expect(markets).toHaveLength(1);
        const market = markets[0];
        expect(Array.isArray(market.outcomes)).toBe(true);
        expect(Array.isArray(market.outcomePrices)).toBe(true);
        expect(Array.isArray(market.clobTokenIds)).toBe(true);
        expect(market.tokens).toBeDefined();
        expect(market.tokens).toHaveLength(2);
        const pp = JSON.parse(prices) as string[];
        const pi = JSON.parse(ids) as string[];
        expect(market.tokens?.[0]?.token_id).toBe(pi[0]);
        expect(market.tokens?.[0]?.outcome).toBe("Yes");
        expect(market.tokens?.[0]?.price).toBeCloseTo(
          Number.parseFloat(pp[0]),
          2
        );
        expect(market.tokens?.[1]?.token_id).toBe(pi[1]);
        expect(market.tokens?.[1]?.outcome).toBe("No");
        expect(market.tokens?.[1]?.price).toBeCloseTo(
          Number.parseFloat(pp[1]),
          2
        );
      }),
      { numRuns: 50 }
    );
  });

  it("sanitizes trailing whitespace from image and icon URLs", async () => {
    await fc.assert(
      fc.asyncProperty(trailingWsArb, trailingWsArb, async (imgWs, iconWs) => {
        getSharedCache().invalidate();
        const baseImg = "https://example.com/market.png";
        const baseIcon = "https://example.com/icon.svg";
        fetchSpy.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => [
            makeRawApiMarket({
              image: baseImg + imgWs,
              icon: baseIcon + iconWs,
            }),
          ],
        });
        const markets = await getMarkets();
        expect(markets[0].image).toBe(baseImg);
        expect(markets[0].icon).toBe(baseIcon);
      }),
      { numRuns: 25 }
    );
  });
});

describe("Property 5 (preservation): getMarketBySlug() applies all three transformations", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("synthesizes tokens from clobTokenIds + outcomePrices for any price pair", async () => {
    await fc.assert(
      fc.asyncProperty(rawPricePairArb, tokenIdPairArb, async (prices, ids) => {
        getSharedCache().invalidate();
        fetchSpy.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () =>
            makeRawApiMarket({ outcomePrices: prices, clobTokenIds: ids }),
        });
        const market = await getMarketBySlug("test-slug");
        expect(Array.isArray(market.outcomes)).toBe(true);
        expect(Array.isArray(market.outcomePrices)).toBe(true);
        expect(Array.isArray(market.clobTokenIds)).toBe(true);
        expect(market.tokens).toBeDefined();
        expect(market.tokens).toHaveLength(2);
        const pp = JSON.parse(prices) as string[];
        const pi = JSON.parse(ids) as string[];
        expect(market.tokens?.[0]?.token_id).toBe(pi[0]);
        expect(market.tokens?.[0]?.outcome).toBe("Yes");
        expect(market.tokens?.[0]?.price).toBeCloseTo(
          Number.parseFloat(pp[0]),
          2
        );
        expect(market.tokens?.[1]?.token_id).toBe(pi[1]);
        expect(market.tokens?.[1]?.outcome).toBe("No");
        expect(market.tokens?.[1]?.price).toBeCloseTo(
          Number.parseFloat(pp[1]),
          2
        );
      }),
      { numRuns: 50 }
    );
  });

  it("sanitizes trailing whitespace from image and icon URLs", async () => {
    await fc.assert(
      fc.asyncProperty(trailingWsArb, trailingWsArb, async (imgWs, iconWs) => {
        getSharedCache().invalidate();
        const baseImg = "https://example.com/slug-market.png";
        const baseIcon = "https://example.com/slug-icon.svg";
        fetchSpy.mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () =>
            makeRawApiMarket({
              image: baseImg + imgWs,
              icon: baseIcon + iconWs,
            }),
        });
        const market = await getMarketBySlug("test-slug");
        expect(market.image).toBe(baseImg);
        expect(market.icon).toBe(baseIcon);
      }),
      { numRuns: 25 }
    );
  });

  it("preserves existing tokens when already present", async () => {
    getSharedCache().invalidate();
    const existingTokens = [
      { token_id: "existing-yes", outcome: "Yes", price: 0.7, winner: false },
      { token_id: "existing-no", outcome: "No", price: 0.3, winner: false },
    ];
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => makeRawApiMarket({ tokens: existingTokens }),
    });
    const market = await getMarketBySlug("has-tokens");
    expect(market.tokens).toHaveLength(2);
    expect(market.tokens?.[0]?.token_id).toBe("existing-yes");
    expect(market.tokens?.[1]?.token_id).toBe("existing-no");
  });
});
