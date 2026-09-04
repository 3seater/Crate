/**
 * Unit tests for market-channel dispatch helpers (asset id extraction).
 */
import { describe, expect, it } from "vitest";
import { getMarketEventAssetIds } from "../../../apps/web/src/lib/websocket/market-channel";

describe("getMarketEventAssetIds", () => {
  it("returns single asset for book", () => {
    expect(
      getMarketEventAssetIds({
        event_type: "book",
        asset_id: "a1",
        market: "m",
        bids: [],
        asks: [],
        timestamp: "0",
        hash: "h",
      })
    ).toEqual(["a1"]);
  });

  it("dedupes assets from price_change", () => {
    const multi = getMarketEventAssetIds({
      event_type: "price_change",
      market: "m",
      price_changes: [
        {
          asset_id: "x",
          price: "0.5",
          size: "1",
          side: "BUY",
          hash: "h1",
          best_bid: "0.4",
          best_ask: "0.6",
        },
        {
          asset_id: "x",
          price: "0.51",
          size: "2",
          side: "SELL",
          hash: "h2",
          best_bid: "0.41",
          best_ask: "0.61",
        },
        {
          asset_id: "y",
          price: "0.4",
          size: "1",
          side: "BUY",
          hash: "h3",
          best_bid: "0.3",
          best_ask: "0.5",
        },
      ],
      timestamp: "0",
    });
    expect(new Set(multi)).toEqual(new Set(["x", "y"]));
    expect(multi).toHaveLength(2);

    const two = getMarketEventAssetIds({
      event_type: "price_change",
      market: "m",
      price_changes: [
        {
          asset_id: "x",
          price: "0.5",
          size: "1",
          side: "BUY",
          hash: "h1",
          best_bid: "0.4",
          best_ask: "0.6",
        },
        {
          asset_id: "y",
          price: "0.4",
          size: "1",
          side: "BUY",
          hash: "h3",
          best_bid: "0.3",
          best_ask: "0.5",
        },
      ],
      timestamp: "0",
    });
    expect(two).toHaveLength(2);
  });

  it("returns assets_ids for new_market and market_resolved", () => {
    const base = {
      id: "1",
      question: "q",
      market: "m",
      slug: "s",
      description: "d",
      assets_ids: ["t1", "t2"],
      outcomes: ["Y", "N"],
      event_message: {
        id: "e",
        ticker: "t",
        slug: "s",
        title: "t",
        description: "d",
      },
      timestamp: "0",
    };
    expect(
      getMarketEventAssetIds({ event_type: "new_market", ...base })
    ).toEqual(["t1", "t2"]);
    expect(
      getMarketEventAssetIds({
        event_type: "market_resolved",
        ...base,
        winning_asset_id: "t1",
        winning_outcome: "Y",
      })
    ).toEqual(["t1", "t2"]);
  });
});
