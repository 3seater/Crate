/**
 * Spec-alignment tests: verify schemas accept messages that match the
 * official Polymarket API docs (docs/POLYMARKET.md).
 *
 * Fixtures are taken verbatim from the documented examples. If a fixture
 * fails, either our schema is wrong or the docs have drifted—investigate.
 */
import { describe, expect, it } from "vitest";
import { safeParseRtdsEvent } from "../../../apps/web/src/lib/websocket/rtds-schemas";
import {
  safeParseMarketChannelMessage,
  safeParseUserChannelMessage,
} from "../../../apps/web/src/lib/websocket/schemas";
import { safeParseSportResult } from "../../../apps/web/src/lib/websocket/sports-schemas";
import {
  CLOB_BEST_BID_ASK_DOC,
  CLOB_BOOK_DOC,
  CLOB_LAST_TRADE_PRICE_DOC,
  CLOB_ORDER_PLACEMENT_DOC,
  CLOB_PRICE_CHANGE_DOC,
  CLOB_TICK_SIZE_CHANGE_DOC,
  CLOB_TRADE_DOC,
  RTDS_COMMENT_CREATED_DOC,
  RTDS_CRYPTO_BINANCE_DOC,
  RTDS_CRYPTO_CHAINLINK_DOC,
  RTDS_TOP_LEVEL_COMMENT_DOC,
  SPORTS_CS2_FINISHED_DOC,
  SPORTS_NFL_IN_PROGRESS_DOC,
} from "./fixtures";

describe("RTDS schema alignment with docs.polymarket.com/developers/RTDS/*", () => {
  it("accepts comment_created with parentCommentID string (reply)", () => {
    const result = safeParseRtdsEvent(RTDS_COMMENT_CREATED_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topic).toBe("comments");
      expect(result.data.type).toBe("comment_created");
      expect(result.data.payload.parentCommentID).toBe("1763325");
      expect(result.data.payload.parentEntityType).toBe("Event");
    }
  });

  it("accepts comment_created with parentCommentID null (top-level)", () => {
    const result = safeParseRtdsEvent(RTDS_TOP_LEVEL_COMMENT_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.payload.parentCommentID).toBeNull();
    }
  });

  it("accepts crypto_prices Binance format (lowercase symbol)", () => {
    const result = safeParseRtdsEvent(RTDS_CRYPTO_BINANCE_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topic).toBe("crypto_prices");
      expect(result.data.payload.symbol).toBe("solusdt");
      expect(result.data.payload.value).toBe(189.55);
    }
  });

  it("accepts crypto_prices_chainlink format (slash-separated symbol)", () => {
    const result = safeParseRtdsEvent(RTDS_CRYPTO_CHAINLINK_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.topic).toBe("crypto_prices_chainlink");
      expect(result.data.payload.symbol).toBe("eth/usd");
    }
  });

  it("validates RTDS base structure per overview: topic, type, timestamp, payload", () => {
    const minimal = {
      topic: "crypto_prices",
      type: "update",
      timestamp: 1_753_314_064_237,
      payload: {
        symbol: "btcusdt",
        timestamp: 1_753_314_064_213,
        value: 67_234.5,
      },
    };
    const result = safeParseRtdsEvent(minimal);
    expect(result.success).toBe(true);
  });

  it("rejects unknown topic per RTDS overview (only comments, crypto_prices supported)", () => {
    const result = safeParseRtdsEvent({
      topic: "trades",
      type: "update",
      timestamp: 1_704_067_200,
      payload: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects comment payload missing required profile.baseAddress per docs", () => {
    const invalid = {
      ...RTDS_COMMENT_CREATED_DOC,
      payload: {
        ...RTDS_COMMENT_CREATED_DOC.payload,
        profile: {
          ...RTDS_COMMENT_CREATED_DOC.payload.profile,
          baseAddress: undefined,
        },
      },
    };
    const result = safeParseRtdsEvent(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects crypto payload with string value (docs: number)", () => {
    const result = safeParseRtdsEvent({
      ...RTDS_CRYPTO_BINANCE_DOC,
      payload: { ...RTDS_CRYPTO_BINANCE_DOC.payload, value: "189.55" },
    });
    expect(result.success).toBe(false);
  });
});

describe("CLOB market channel schema alignment with docs", () => {
  it("accepts book message with bids/asks per market-channel docs", () => {
    const result = safeParseMarketChannelMessage(CLOB_BOOK_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("book");
      expect(result.data.bids).toHaveLength(3);
      expect(result.data.asks).toHaveLength(3);
    }
  });

  it("accepts last_trade_price per docs", () => {
    const result = safeParseMarketChannelMessage(CLOB_LAST_TRADE_PRICE_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("last_trade_price");
      expect(result.data.side).toBe("BUY");
    }
  });

  it("accepts best_bid_ask per docs", () => {
    const result = safeParseMarketChannelMessage(CLOB_BEST_BID_ASK_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("best_bid_ask");
      expect(result.data.spread).toBe("0.04");
    }
  });

  it("accepts price_change per docs", () => {
    const result = safeParseMarketChannelMessage(CLOB_PRICE_CHANGE_DOC);
    expect(result.success).toBe(true);
  });

  it("accepts tick_size_change per docs", () => {
    const result = safeParseMarketChannelMessage(CLOB_TICK_SIZE_CHANGE_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("tick_size_change");
      expect(result.data.old_tick_size).toBe("0.01");
      expect(result.data.new_tick_size).toBe("0.001");
    }
  });

  it("rejects market message with wrong event_type per docs", () => {
    const result = safeParseMarketChannelMessage({
      event_type: "unknown_event",
      asset_id: "123",
      market: "0xabc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects book with missing bids (docs require bids and asks)", () => {
    const result = safeParseMarketChannelMessage({
      ...CLOB_BOOK_DOC,
      bids: undefined,
    });
    expect(result.success).toBe(false);
  });
});

describe("CLOB user channel schema alignment with docs", () => {
  it("accepts trade message with maker_orders per user-channel docs", () => {
    const result = safeParseUserChannelMessage(CLOB_TRADE_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("trade");
      expect(result.data.type).toBe("TRADE");
      expect(result.data.status).toBe("MATCHED");
      expect(result.data.maker_orders).toHaveLength(1);
      // Doc MakerOrder: asset_id, matched_amount, order_id, outcome, owner, price
      expect(result.data.maker_orders[0]).toHaveProperty("order_id");
      expect(result.data.maker_orders[0]).toHaveProperty("matched_amount");
    }
  });

  it("accepts order PLACEMENT per docs", () => {
    const result = safeParseUserChannelMessage(CLOB_ORDER_PLACEMENT_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.event_type).toBe("order");
      expect(result.data.type).toBe("PLACEMENT");
      expect(result.data.associate_trades).toBeNull();
    }
  });

  it("rejects trade with invalid status per docs (MATCHED|MINED|CONFIRMED|RETRYING|FAILED)", () => {
    const result = safeParseUserChannelMessage({
      ...CLOB_TRADE_DOC,
      status: "PENDING",
    });
    expect(result.success).toBe(false);
  });
});

describe("Sports schema alignment with docs.polymarket.com/developers/sports-websocket/*", () => {
  it("accepts NFL in-progress sport_result per message-format docs", () => {
    const result = safeParseSportResult(SPORTS_NFL_IN_PROGRESS_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gameId).toBe(19_439);
      expect(result.data.leagueAbbreviation).toBe("nfl");
      expect(result.data.live).toBe(true);
      expect(result.data.ended).toBe(false);
      expect(result.data.turn).toBe("lac");
    }
  });

  it("accepts CS2 finished sport_result (no elapsed/turn per docs)", () => {
    const result = safeParseSportResult(SPORTS_CS2_FINISHED_DOC);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ended).toBe(true);
      expect(result.data.period).toBe("2/3");
    }
  });

  it("rejects sport_result with string gameId (docs: number)", () => {
    const result = safeParseSportResult({
      ...SPORTS_NFL_IN_PROGRESS_DOC,
      gameId: "19439",
    });
    expect(result.success).toBe(false);
  });

  it("rejects sport_result missing required score per docs", () => {
    const result = safeParseSportResult({
      ...SPORTS_NFL_IN_PROGRESS_DOC,
      score: undefined,
    });
    expect(result.success).toBe(false);
  });
});
