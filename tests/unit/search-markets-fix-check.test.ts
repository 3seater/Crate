/**
 * Fix-checking test for searchMarkets() post-processing (Property 2).
 *
 * **Validates: Requirements 2.2**
 *
 * Verifies that after the fix, searchMarkets() applies both synthesizeTokens()
 * and sanitizeImageUrls() to each market — matching the pipeline used by
 * getMarkets(), getMarketBySlug(), and other code paths.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchMarkets } from "../../apps/server/src/lib/polymarket/gamma";
import { getSharedCache } from "../../apps/server/src/lib/polymarket/resilient-fetch";

function makeFakeSearchResponse(markets: Record<string, unknown>[]) {
  return { markets, events: [], profiles: [] };
}

function makeRawMarket(overrides: Record<string, unknown> = {}) {
  return {
    question: "Will ETH hit 10k?",
    active: true,
    closed: false,
    archived: false,
    slug: "will-eth-hit-10k",
    outcomes: '["Yes","No"]',
    outcomePrices: '["0.45","0.55"]',
    clobTokenIds: '["tok-yes-eth","tok-no-eth"]',
    ...overrides,
  };
}

describe("searchMarkets fix-check — synthesizeTokens + sanitizeImageUrls (Property 2)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getSharedCache().invalidate();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sanitizes trailing whitespace from market image URLs", async () => {
    const fakeResponse = makeFakeSearchResponse([
      makeRawMarket({ image: "https://example.com/img.png \n" }),
    ]);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => fakeResponse,
    });

    const result = await searchMarkets("fix-image");
    const market = result.markets[0];

    expect(market.image).toBe("https://example.com/img.png");
  });

  it("sanitizes trailing whitespace from market icon URLs", async () => {
    const fakeResponse = makeFakeSearchResponse([
      makeRawMarket({ icon: "https://example.com/icon.svg\t\n" }),
    ]);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => fakeResponse,
    });

    const result = await searchMarkets("fix-icon");
    const market = result.markets[0];

    expect(market.icon).toBe("https://example.com/icon.svg");
  });

  it("synthesizes tokens AND sanitizes image URLs on the same market", async () => {
    const fakeResponse = makeFakeSearchResponse([
      makeRawMarket({
        image: "https://example.com/market.png  \n",
        icon: "https://example.com/market-icon.svg \r\n",
      }),
    ]);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => fakeResponse,
    });

    const result = await searchMarkets("fix-both");
    const market = result.markets[0];

    // Tokens synthesized from clobTokenIds + outcomePrices
    expect(market.tokens).toBeDefined();
    expect(market.tokens).toHaveLength(2);
    expect(market.tokens?.[0]).toMatchObject({
      token_id: "tok-yes-eth",
      outcome: "Yes",
      price: 0.45,
    });
    expect(market.tokens?.[1]).toMatchObject({
      token_id: "tok-no-eth",
      outcome: "No",
      price: 0.55,
    });

    // Image URLs sanitized (trailing whitespace removed)
    expect(market.image).toBe("https://example.com/market.png");
    expect(market.icon).toBe("https://example.com/market-icon.svg");
  });

  it("applies both transformations across multiple markets", async () => {
    const fakeResponse = makeFakeSearchResponse([
      makeRawMarket({
        question: "Market A?",
        slug: "market-a",
        image: "https://example.com/a.png\n",
        outcomePrices: '["0.80","0.20"]',
        clobTokenIds: '["tok-a-yes","tok-a-no"]',
      }),
      makeRawMarket({
        question: "Market B?",
        slug: "market-b",
        image: "https://example.com/b.png \t",
        outcomePrices: '["0.30","0.70"]',
        clobTokenIds: '["tok-b-yes","tok-b-no"]',
      }),
    ]);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => fakeResponse,
    });

    const result = await searchMarkets("fix-multi");
    expect(result.markets).toHaveLength(2);

    // Market A: tokens + sanitized image
    expect(result.markets[0].tokens).toHaveLength(2);
    expect(result.markets[0].tokens?.[0].price).toBeCloseTo(0.8);
    expect(result.markets[0].image).toBe("https://example.com/a.png");

    // Market B: tokens + sanitized image
    expect(result.markets[1].tokens).toHaveLength(2);
    expect(result.markets[1].tokens?.[0].price).toBeCloseTo(0.3);
    expect(result.markets[1].image).toBe("https://example.com/b.png");
  });
});
