/**
 * Unit tests for RTDS WebSocket message schemas (safeParseRtdsEvent).
 */
import { describe, expect, it } from "vitest";
import {
  CommentPayloadSchema,
  CryptoPricePayloadSchema,
  safeParseRtdsEvent,
} from "../../../apps/web/src/lib/websocket/rtds-schemas";

const validCommentPayload = {
  body: "Hello",
  createdAt: "2024-01-01T00:00:00Z",
  id: "cm-1",
  parentCommentID: null,
  parentEntityID: 123,
  parentEntityType: "Event",
  profile: {
    baseAddress: "0x123",
    displayUsernamePublic: true,
    name: "User",
    proxyWallet: "0x456",
    pseudonym: "pseudo",
  },
  reactionCount: 0,
  replyAddress: "0x0",
  reportCount: 0,
  userAddress: "0x789",
};

const validCryptoPayload = {
  symbol: "BTC",
  timestamp: 1_704_067_200,
  value: 42_000.5,
};

describe("safeParseRtdsEvent", () => {
  describe("comments topic", () => {
    it("parses valid comment_created", () => {
      const result = safeParseRtdsEvent({
        topic: "comments",
        type: "comment_created",
        timestamp: 1_704_067_200,
        payload: validCommentPayload,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.topic).toBe("comments");
        expect(result.data.type).toBe("comment_created");
        expect(result.data.payload).toEqual(validCommentPayload);
      }
    });

    it("parses valid comment_removed", () => {
      const result = safeParseRtdsEvent({
        topic: "comments",
        type: "comment_removed",
        timestamp: 1_704_067_200,
        payload: validCommentPayload,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid comment payload (missing profile)", () => {
      const result = safeParseRtdsEvent({
        topic: "comments",
        type: "comment_created",
        timestamp: 1_704_067_200,
        payload: { ...validCommentPayload, profile: undefined },
      });
      expect(result.success).toBe(false);
    });

    it("rejects comment payload with wrong parentEntityID type", () => {
      const result = safeParseRtdsEvent({
        topic: "comments",
        type: "comment_created",
        timestamp: 1_704_067_200,
        payload: { ...validCommentPayload, parentEntityID: "123" },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("crypto_prices topic", () => {
    it("parses valid crypto_prices update", () => {
      const result = safeParseRtdsEvent({
        topic: "crypto_prices",
        type: "update",
        timestamp: 1_704_067_200,
        payload: validCryptoPayload,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.topic).toBe("crypto_prices");
        expect(result.data.payload).toEqual(validCryptoPayload);
      }
    });

    it("parses valid crypto_prices_chainlink update", () => {
      const result = safeParseRtdsEvent({
        topic: "crypto_prices_chainlink",
        type: "update",
        timestamp: 1_704_067_200,
        payload: validCryptoPayload,
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid crypto payload (missing value)", () => {
      const result = safeParseRtdsEvent({
        topic: "crypto_prices",
        type: "update",
        timestamp: 1_704_067_200,
        payload: { symbol: "BTC", timestamp: 1_704_067_200 },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("unknown topic", () => {
    it("rejects unknown topic", () => {
      const result = safeParseRtdsEvent({
        topic: "unknown_topic",
        type: "update",
        timestamp: 1_704_067_200,
        payload: {},
      });
      expect(result.success).toBe(false);
    });
  });

  describe("base structure", () => {
    it("rejects missing topic", () => {
      const result = safeParseRtdsEvent({
        type: "update",
        timestamp: 1_704_067_200,
        payload: validCryptoPayload,
      });
      expect(result.success).toBe(false);
    });

    it("rejects missing timestamp", () => {
      const result = safeParseRtdsEvent({
        topic: "crypto_prices",
        type: "update",
        payload: validCryptoPayload,
      });
      expect(result.success).toBe(false);
    });

    it("rejects non-object input", () => {
      expect(safeParseRtdsEvent(null).success).toBe(false);
      expect(safeParseRtdsEvent("string").success).toBe(false);
      expect(safeParseRtdsEvent([]).success).toBe(false);
    });
  });
});

describe("CommentPayloadSchema", () => {
  it("accepts valid payload with parentCommentID null", () => {
    const result = CommentPayloadSchema.safeParse(validCommentPayload);
    expect(result.success).toBe(true);
  });

  it("accepts parentCommentID as string", () => {
    const result = CommentPayloadSchema.safeParse({
      ...validCommentPayload,
      parentCommentID: "parent-123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts parentCommentID and replyAddress undefined (Polymarket omits them)", () => {
    const payload = { ...validCommentPayload };
    // API may omit these; simulate with undefined
    (payload as { parentCommentID?: string | null }).parentCommentID =
      undefined;
    (payload as { replyAddress?: string }).replyAddress = undefined;
    const result = CommentPayloadSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.parentCommentID).toBeNull();
      expect(result.data.replyAddress).toBe("");
    }
  });
});

describe("CryptoPricePayloadSchema", () => {
  it("accepts valid payload", () => {
    const result = CryptoPricePayloadSchema.safeParse(validCryptoPayload);
    expect(result.success).toBe(true);
  });

  it("rejects string value", () => {
    const result = CryptoPricePayloadSchema.safeParse({
      ...validCryptoPayload,
      value: "42000",
    });
    expect(result.success).toBe(false);
  });
});
