/**
 * Integration tests for CLOB API (read-only public endpoints)
 *
 * Note: These tests only cover public endpoints that don't require authentication.
 * Trading endpoints (place order, cancel order, etc.) require API keys and are not tested here.
 *
 * Skipped in CI: calls live Polymarket APIs (rate limits, network required).
 */

import { describe, expect, it } from "vitest";
import {
  calculateMarketPrice,
  getBook,
  getClobMarket,
  getClobMarkets,
  getFeeRate,
  getGeoblock,
  getHeartbeat,
  getLastTradePrice,
  getLastTradePrices,
  getLiquidityMetrics,
  getMidpoint,
  getMidpoints,
  getNegRisk,
  getOrderBooks,
  getPrice,
  getPriceHistory,
  getPrices,
  getSamplingMarkets,
  getSamplingSimplifiedMarkets,
  getServerTime,
  getSimplifiedMarkets,
  getSpread,
  getSpreads,
  getTickSize,
} from "../../apps/server/src/lib/polymarket/clob-read";
import { getMarkets } from "../../apps/server/src/lib/polymarket/gamma";
import { hasServerEnv } from "../helpers";

// Get a real token ID from a high-volume active market with an orderbook
const getTestTokenId = async (): Promise<string> => {
  const markets = await getMarkets({
    active: true,
    closed: false,
    limit: 50, // Get more markets to increase chances of finding one with orderbook
    order: "volume24hr",
    ascending: false,
  });

  // Try to find a market with an actual orderbook
  for (const market of markets) {
    const tokenId = market.clobTokenIds?.[0];
    if (!tokenId) {
      continue;
    }

    try {
      // Test if orderbook exists by trying to fetch it
      const book = await getBook(tokenId);
      if (book.bids.length > 0 || book.asks.length > 0) {
        return tokenId;
      }
    } catch {
      // Ignore 404 / no orderbook for this token; try next market
    }
  }

  // Fallback to first available token if none have orderbooks
  const fallback = markets[0]?.clobTokenIds?.[0];
  if (!fallback) {
    throw new Error("No active market with token IDs found");
  }
  return fallback;
};

describe.skipIf(!hasServerEnv)("CLOB API", () => {
  describe("Health Check", () => {
    it("fetches heartbeat status", async () => {
      const heartbeat = await getHeartbeat();
      expect(typeof heartbeat).toBe("string");
      expect(heartbeat.length).toBeGreaterThan(0);
    });
  });

  describe("Markets", () => {
    it("fetches markets list", async () => {
      const response = await getClobMarkets();

      expect(response).toHaveProperty("data");
      expect(response).toHaveProperty("limit");
      expect(response).toHaveProperty("count");
      expect(Array.isArray((response as any).data)).toBe(true);

      const markets = (response as any).data;
      if (markets.length > 0) {
        const market = markets[0];
        expect(market).toHaveProperty("condition_id");
        expect(market).toHaveProperty("question");
        expect(market).toHaveProperty("tokens");
        expect(market).toHaveProperty("active");
        expect(market).toHaveProperty("closed");
      }
    });

    it("fetches single market by condition ID", async () => {
      // Get a condition ID from markets list
      const response = await getClobMarkets();
      const markets = (response as any).data;
      expect(markets.length).toBeGreaterThan(0);

      const conditionId = markets[0].condition_id;
      const market = await getClobMarket(conditionId);

      expect(market).toHaveProperty("condition_id");
      expect((market as any).condition_id).toBe(conditionId);
      expect(market).toHaveProperty("question");
      expect(market).toHaveProperty("tokens");
      expect(Array.isArray((market as any).tokens)).toBe(true);
    });

    it("fetches simplified markets", async () => {
      const response = await getSimplifiedMarkets();

      expect(response).toHaveProperty("data");
      expect(Array.isArray((response as any).data)).toBe(true);

      const markets = (response as any).data;
      if (markets.length > 0) {
        const market = markets[0];
        expect(market).toHaveProperty("condition_id");
        expect(market).toHaveProperty("tokens");
        expect(market).toHaveProperty("active");
      }
    });

    it("fetches sampling markets", async () => {
      const response = await getSamplingMarkets();

      expect(response).toHaveProperty("data");
      expect(Array.isArray((response as any).data)).toBe(true);
    });

    it("fetches sampling simplified markets", async () => {
      const response = await getSamplingSimplifiedMarkets();

      expect(response).toHaveProperty("data");
      expect(Array.isArray((response as any).data)).toBe(true);
    });
  });

  describe("Order Book", () => {
    it("fetches order book for active token", async () => {
      const tokenId = await getTestTokenId();
      const book = await getBook(tokenId);

      expect(book).toHaveProperty("market");
      expect(book).toHaveProperty("asset_id");
      expect(book).toHaveProperty("bids");
      expect(book).toHaveProperty("asks");
      expect(Array.isArray(book.bids)).toBe(true);
      expect(Array.isArray(book.asks)).toBe(true);
      expect(book.asset_id).toBe(tokenId);
    });

    it("validates order book structure", async () => {
      const tokenId = await getTestTokenId();
      const book = await getBook(tokenId);

      // Check bid structure if bids exist
      if (book.bids.length > 0) {
        const bid = book.bids[0];
        expect(bid).toHaveProperty("price");
        expect(bid).toHaveProperty("size");
        expect(typeof bid.price).toBe("string");
        expect(typeof bid.size).toBe("string");
      }

      // Check ask structure if asks exist
      if (book.asks.length > 0) {
        const ask = book.asks[0];
        expect(ask).toHaveProperty("price");
        expect(ask).toHaveProperty("size");
        expect(typeof ask.price).toBe("string");
        expect(typeof ask.size).toBe("string");
      }
    });

    it("fetches batch order books", async () => {
      const tokenId = await getTestTokenId();
      const books = await getOrderBooks([
        { token_id: tokenId, side: "BUY" },
        { token_id: tokenId, side: "SELL" },
      ]);

      expect(Array.isArray(books)).toBe(true);
      expect((books as any).length).toBeGreaterThan(0);
    });

    it("calculates liquidity metrics from order book", async () => {
      const tokenId = await getTestTokenId();
      const metrics = await getLiquidityMetrics(tokenId);

      expect(metrics).toHaveProperty("health");
      expect(metrics).toHaveProperty("spread");
      expect(metrics).toHaveProperty("spreadCents");
      expect(metrics).toHaveProperty("spreadPercent");
      expect(metrics).toHaveProperty("availableDepthUsd");
      expect(metrics).toHaveProperty("bestBid");
      expect(metrics).toHaveProperty("bestAsk");

      expect(["HIGH", "MEDIUM", "LOW", "CRITICAL"]).toContain(
        (metrics as any).health
      );
      expect(typeof (metrics as any).spread).toBe("number");
      expect(typeof (metrics as any).availableDepthUsd).toBe("number");
    });
  });

  describe("Pricing", () => {
    it("fetches tick size", async () => {
      const tokenId = await getTestTokenId();
      const tickSize = await getTickSize(tokenId);

      expect(typeof tickSize).toBe("string");
      const tick = Number.parseFloat(tickSize);
      expect(tick).toBeGreaterThan(0);
      // Common tick sizes are 0.01 or 0.001
      expect([0.01, 0.001]).toContain(tick);
    });

    it("fetches best price for buy side", async () => {
      const tokenId = await getTestTokenId();
      const { price } = await getPrice(tokenId, "BUY");

      expect(typeof price).toBe("string");
      const priceNum = Number.parseFloat(price);
      expect(priceNum).toBeGreaterThanOrEqual(0);
      expect(priceNum).toBeLessThanOrEqual(1);
    });

    it("fetches best price for sell side", async () => {
      const tokenId = await getTestTokenId();
      const { price } = await getPrice(tokenId, "SELL");

      expect(typeof price).toBe("string");
      const priceNum = Number.parseFloat(price);
      expect(priceNum).toBeGreaterThanOrEqual(0);
      expect(priceNum).toBeLessThanOrEqual(1);
    });

    it("fetches batch prices", async () => {
      const tokenId = await getTestTokenId();
      const prices = await getPrices([
        { token_id: tokenId, side: "BUY" },
        { token_id: tokenId, side: "SELL" },
      ]);

      expect(typeof prices).toBe("object");
      expect(prices).toHaveProperty(tokenId);
    });

    it("fetches midpoint price", async () => {
      const tokenId = await getTestTokenId();
      const midpoint = await getMidpoint(tokenId);

      expect(typeof midpoint).toBe("string");
      const price = Number.parseFloat(midpoint);
      expect(price).toBeGreaterThanOrEqual(0);
      expect(price).toBeLessThanOrEqual(1);
    });

    it("fetches batch midpoints", async () => {
      const tokenId = await getTestTokenId();
      const midpoints = await getMidpoints([{ token_id: tokenId }]);

      expect(typeof midpoints).toBe("object");
      expect(midpoints).toHaveProperty(tokenId);
      expect(typeof midpoints[tokenId]).toBe("string");
    });

    it("fetches spread", async () => {
      const tokenId = await getTestTokenId();
      const spread = await getSpread(tokenId);

      expect(typeof spread).toBe("string");
      const spreadValue = Number.parseFloat(spread);
      expect(spreadValue).toBeGreaterThanOrEqual(0);
      expect(spreadValue).toBeLessThanOrEqual(1);
    });

    it("fetches batch spreads", async () => {
      const tokenId = await getTestTokenId();
      const spreads = await getSpreads([{ token_id: tokenId }]);

      expect(typeof spreads).toBe("object");
      expect(spreads).toHaveProperty(tokenId);
      expect(typeof spreads[tokenId]).toBe("string");
    });

    it("calculates market price for amount", async () => {
      const tokenId = await getTestTokenId();
      const price = await calculateMarketPrice(tokenId, "BUY", 10);

      expect(typeof price).toBe("number");
      expect(price).toBeGreaterThanOrEqual(0);
    });

    it("fetches price history", async () => {
      const tokenId = await getTestTokenId();
      const history = await getPriceHistory({
        market: tokenId,
        interval: "1d",
        fidelity: 10,
      });

      expect(Array.isArray(history)).toBe(true);
      if (history.length > 0) {
        const point = history[0];
        expect(point).toHaveProperty("t");
        expect(point).toHaveProperty("p");
        expect(typeof point.t).toBe("number");
        expect(typeof point.p).toBe("number");
      }
    });
  });

  describe("Trades", () => {
    it("fetches last trade price", async () => {
      const tokenId = await getTestTokenId();
      const { price, side } = await getLastTradePrice(tokenId);

      expect(typeof price).toBe("string");
      expect(typeof side).toBe("string");
      expect(["BUY", "SELL"]).toContain(side);

      const priceNum = Number.parseFloat(price);
      expect(priceNum).toBeGreaterThanOrEqual(0);
      expect(priceNum).toBeLessThanOrEqual(1);
    });

    it("fetches batch last trade prices", async () => {
      const tokenId = await getTestTokenId();
      const trades = await getLastTradePrices([{ token_id: tokenId }]);

      expect(Array.isArray(trades)).toBe(true);
      if (trades.length > 0) {
        const trade = trades[0];
        expect(trade).toHaveProperty("price");
        expect(trade).toHaveProperty("side");
        expect(trade).toHaveProperty("token_id");
      }
    });
  });

  describe("Market Parameters", () => {
    it("fetches fee rate", async () => {
      const tokenId = await getTestTokenId();
      const { fee_rate_bps } = await getFeeRate(tokenId);

      expect(typeof fee_rate_bps).toBe("number");
      expect(fee_rate_bps).toBeGreaterThanOrEqual(0);
    });

    it("checks negative risk status", async () => {
      const tokenId = await getTestTokenId();
      const negRisk = await getNegRisk(tokenId);

      expect(typeof negRisk).toBe("boolean");
    });
  });

  describe("Server Info", () => {
    it("fetches server time", async () => {
      const serverTime = await getServerTime();

      expect(typeof serverTime).toBe("number");
      expect(serverTime).toBeGreaterThan(0);
      // Should be a recent Unix timestamp (after 2020)
      expect(serverTime).toBeGreaterThan(1_577_836_800);
    });

    it("checks geoblock status", async () => {
      const geo = await getGeoblock();

      expect(geo).toHaveProperty("blocked");
      expect(geo).toHaveProperty("ip");
      expect(geo).toHaveProperty("country");
      expect(geo).toHaveProperty("region");
      expect(typeof geo.blocked).toBe("boolean");
      expect(typeof geo.ip).toBe("string");
      expect(typeof geo.country).toBe("string");
    });
  });
});
