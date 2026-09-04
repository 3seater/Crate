/**
 * Unit tests for WebSocket message schemas (market and user channels).
 */
import { describe, expect, it } from "vitest";
import {
  safeParseMarketChannelMessage,
  safeParseUserChannelMessage,
} from "../../../apps/web/src/lib/websocket/schemas";

describe("safeParseMarketChannelMessage", () => {
  describe("book", () => {
    it("parses valid book message", () => {
      const msg = {
        event_type: "book",
        asset_id: "123",
        market: "0xabc",
        bids: [{ price: "0.5", size: "100" }],
        asks: [{ price: "0.6", size: "50" }],
        timestamp: "1704067200",
        hash: "hash1",
      };
      const result = safeParseMarketChannelMessage(msg);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.event_type).toBe("book");
      }
    });
  });

  describe("last_trade_price", () => {
    it("parses valid last_trade_price", () => {
      const msg = {
        event_type: "last_trade_price",
        asset_id: "123",
        market: "0xabc",
        price: "0.55",
        side: "BUY",
        size: "10",
        fee_rate_bps: "0",
        timestamp: "1704067200",
      };
      const result = safeParseMarketChannelMessage(msg);
      expect(result.success).toBe(true);
    });
  });

  describe("best_bid_ask", () => {
    it("parses valid best_bid_ask", () => {
      const msg = {
        event_type: "best_bid_ask",
        asset_id: "123",
        market: "0xabc",
        best_bid: "0.5",
        best_ask: "0.6",
        spread: "0.1",
        timestamp: "1704067200",
      };
      const result = safeParseMarketChannelMessage(msg);
      expect(result.success).toBe(true);
    });
  });

  describe("price_change", () => {
    it("parses valid price_change", () => {
      const msg = {
        event_type: "price_change",
        market: "0xabc",
        price_changes: [
          {
            asset_id: "123",
            price: "0.55",
            size: "10",
            side: "BUY",
            hash: "h",
            best_bid: "0.5",
            best_ask: "0.6",
          },
        ],
        timestamp: "1704067200",
      };
      const result = safeParseMarketChannelMessage(msg);
      expect(result.success).toBe(true);
    });
  });

  describe("new_market", () => {
    it("parses valid new_market", () => {
      const msg = {
        event_type: "new_market",
        id: "1",
        question: "Will X happen?",
        market: "0xabc",
        slug: "will-x-happen",
        description: "Desc",
        assets_ids: ["a", "b"],
        outcomes: ["Yes", "No"],
        event_message: {
          id: "1",
          ticker: "X",
          slug: "will-x-happen",
          title: "Will X happen?",
          description: "Desc",
        },
        timestamp: "1704067200",
      };
      const result = safeParseMarketChannelMessage(msg);
      expect(result.success).toBe(true);
    });
  });

  describe("market_resolved", () => {
    it("parses valid market_resolved", () => {
      const msg = {
        event_type: "market_resolved",
        id: "1",
        question: "Will X happen?",
        market: "0xabc",
        slug: "will-x-happen",
        description: "Desc",
        assets_ids: ["a", "b"],
        outcomes: ["Yes", "No"],
        winning_asset_id: "a",
        winning_outcome: "Yes",
        event_message: {
          id: "1",
          ticker: "X",
          slug: "will-x-happen",
          title: "Will X happen?",
          description: "Desc",
        },
        timestamp: "1704067200",
      };
      const result = safeParseMarketChannelMessage(msg);
      expect(result.success).toBe(true);
    });
  });

  it("rejects unknown event_type", () => {
    const result = safeParseMarketChannelMessage({
      event_type: "unknown",
      asset_id: "123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid structure", () => {
    expect(safeParseMarketChannelMessage(null).success).toBe(false);
    expect(safeParseMarketChannelMessage({}).success).toBe(false);
  });
});

describe("safeParseUserChannelMessage", () => {
  describe("trade", () => {
    it("parses valid trade event", () => {
      const msg = {
        event_type: "trade",
        type: "TRADE",
        id: "t1",
        asset_id: "123",
        market: "0xabc",
        side: "BUY",
        size: "10",
        price: "0.55",
        status: "MATCHED",
        taker_order_id: "o1",
        last_update: "2024-01-01",
        matchtime: "2024-01-01",
        outcome: "Yes",
        owner: "0x1",
        trade_owner: "0x2",
        timestamp: "1704067200",
        fee_rate_bps: "0",
        maker_orders: [],
      };
      const result = safeParseUserChannelMessage(msg);
      expect(result.success).toBe(true);
    });

    it("parses trade event without matchtime (Polymarket can omit)", () => {
      const msg = {
        event_type: "trade",
        type: "TRADE",
        id: "t2",
        asset_id: "456",
        market: "0xdef",
        side: "SELL",
        size: "5",
        price: "0.42",
        status: "MATCHED",
        taker_order_id: "o2",
        last_update: "2024-01-02",
        outcome: "No",
        owner: "0xa",
        trade_owner: "0xb",
        timestamp: "1704153600",
        maker_orders: [],
      };
      const result = safeParseUserChannelMessage(msg);
      expect(result.success).toBe(true);
    });
  });

  describe("order", () => {
    it("parses valid order PLACEMENT", () => {
      const msg = {
        event_type: "order",
        type: "PLACEMENT",
        id: "o1",
        asset_id: "123",
        market: "0xabc",
        side: "BUY",
        original_size: "10",
        size_matched: "0",
        price: "0.55",
        associate_trades: null,
        owner: "0x1",
        order_owner: "0x1",
        outcome: "Yes",
        timestamp: "1704067200",
      };
      const result = safeParseUserChannelMessage(msg);
      expect(result.success).toBe(true);
    });

    it("parses valid order CANCELLATION", () => {
      const msg = {
        event_type: "order",
        type: "CANCELLATION",
        id: "o1",
        asset_id: "123",
        market: "0xabc",
        side: "BUY",
        original_size: "10",
        size_matched: "5",
        price: "0.55",
        associate_trades: null,
        owner: "0x1",
        order_owner: "0x1",
        outcome: "Yes",
        timestamp: "1704067200",
      };
      const result = safeParseUserChannelMessage(msg);
      expect(result.success).toBe(true);
    });
  });

  it("rejects unknown event_type", () => {
    const result = safeParseUserChannelMessage({
      event_type: "unknown",
    });
    expect(result.success).toBe(false);
  });
});
