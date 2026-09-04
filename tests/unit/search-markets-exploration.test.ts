/**
 * Exploratory test for searchMarkets() post-processing (Property 2).
 *
 * **Validates: Requirements 2.2**
 *
 * Bug: searchMarkets() returned raw Zod-validated results without applying
 * normalizeMarketAtBoundary(), synthesizeTokens(), or sanitizeImageUrls().
 * Other code paths (getMarkets, getMarketBySlug) applied all three.
 *
 * Since the fix is already applied, this test confirms the fix works:
 * when the raw API response has markets without a `tokens` array,
 * searchMarkets() should synthesize tokens from clobTokenIds + outcomePrices.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchMarkets } from "../../apps/server/src/lib/polymarket/gamma";
import { getSharedCache } from "../../apps/server/src/lib/polymarket/resilient-fetch";

function makeFakeSearchResponse(markets: Record<string, unknown>[]) {
  return { markets, events: [], profiles: [] };
}

function makeRawMarket(overrides: Record<string, unknown> = {}) {
  return {
    question: "Will BTC hit 100k?",
    active: true,
    closed: false,
    archived: false,
    slug: "will-btc-hit-100k",
    outcomes: '["Yes","No"]',
    outcomePrices: '["0.72","0.28"]',
    clobTokenIds: '["token-id-yes-123","token-id-no-456"]',
    ...overrides,
  };
}

describe("searchMarkets exploration — missing synthesizeTokens (Property 2)", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getSharedCache().invalidate();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("synthesizes tokens when raw API response has no tokens array", async () => {
    const fakeResponse = makeFakeSearchResponse([makeRawMarket()]);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => fakeResponse,
    });

    const result = await searchMarkets("explore-synth");
    expect(result.markets).toHaveLength(1);

    const market = result.markets[0];
    // On unfixed code, tokens would be undefined (no synthesizeTokens call).
    // The fix generates tokens from clobTokenIds + outcomePrices.
    expect(market.tokens).toBeDefined();
    expect(market.tokens).toHaveLength(2);
    expect(market.tokens?.[0]).toMatchObject({
      token_id: "token-id-yes-123",
      outcome: "Yes",
      price: 0.72,
    });
    expect(market.tokens?.[1]).toMatchObject({
      token_id: "token-id-no-456",
      outcome: "No",
      price: 0.28,
    });
  });

  it("normalizes outcomePrices/outcomes/clobTokenIds to arrays", async () => {
    const fakeResponse = makeFakeSearchResponse([makeRawMarket()]);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => fakeResponse,
    });

    const result = await searchMarkets("explore-normalize");
    const market = result.markets[0];

    expect(Array.isArray(market.outcomePrices)).toBe(true);
    expect(Array.isArray(market.outcomes)).toBe(true);
    expect(Array.isArray(market.clobTokenIds)).toBe(true);
  });

  it("processes multiple markets in a single search result", async () => {
    const fakeResponse = makeFakeSearchResponse([
      makeRawMarket({
        question: "Market A?",
        slug: "market-a",
        outcomePrices: '["0.60","0.40"]',
        clobTokenIds: '["tok-a-yes","tok-a-no"]',
      }),
      makeRawMarket({
        question: "Market B?",
        slug: "market-b",
        outcomePrices: '["0.90","0.10"]',
        clobTokenIds: '["tok-b-yes","tok-b-no"]',
      }),
    ]);
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => fakeResponse,
    });

    const result = await searchMarkets("explore-multi");
    expect(result.markets).toHaveLength(2);

    expect(result.markets[0].tokens).toHaveLength(2);
    expect(result.markets[0].tokens?.[0].price).toBeCloseTo(0.6);

    expect(result.markets[1].tokens).toHaveLength(2);
    expect(result.markets[1].tokens?.[0].price).toBeCloseTo(0.9);
  });
});
