import { describe, expect, it } from "vitest";
import { getPolymarketTradingHeaderUrl } from "../../apps/web/src/lib/markets/market-urls";

describe("getPolymarketTradingHeaderUrl", () => {
  it("uses parent event URL when the event has multiple markets (GMP)", () => {
    expect(
      getPolymarketTradingHeaderUrl({
        marketSlug: "will-candidate-a-win",
        eventSlug: "us-election-2028",
        eventMarketCount: 4,
      })
    ).toBe("https://polymarket.com/event/us-election-2028");
  });

  it("uses market URL for single-market context", () => {
    expect(
      getPolymarketTradingHeaderUrl({
        marketSlug: "btc-100k-by-2026",
        eventSlug: "btc-100k-by-2026",
        eventMarketCount: 1,
      })
    ).toBe("https://polymarket.com/market/btc-100k-by-2026");
  });

  it("uses market URL when no event is attached (standalone /market route)", () => {
    expect(
      getPolymarketTradingHeaderUrl({
        marketSlug: "some-market",
        eventSlug: null,
        eventMarketCount: 0,
      })
    ).toBe("https://polymarket.com/market/some-market");
  });

  it("falls back to event URL when market slug is missing", () => {
    expect(
      getPolymarketTradingHeaderUrl({
        marketSlug: "",
        eventSlug: "only-event",
        eventMarketCount: 1,
      })
    ).toBe("https://polymarket.com/event/only-event");
  });
});
