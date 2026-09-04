/**
 * Unit tests for RTDS client (subscriptionKey, RtdsClient with mocked WebSocket).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  RtdsClient,
  type RtdsSubscription,
  subscriptionKey,
} from "../../../apps/web/src/shared/lib/websocket/rtds";

/** Minimal WebSocket mock for Node tests. */
function createMockWebSocket(): {
  ws: { readyState: number; send: ReturnType<typeof vi.fn> };
  triggerOpen: () => void;
  triggerClose: () => void;
  triggerMessage: (data: string) => void;
  MockClass: typeof WebSocket;
} {
  const OPEN = 1;
  const send = vi.fn();
  let onopen: (() => void) | null = null;
  let onclose: (() => void) | null = null;
  let onmessage: ((e: { data: string }) => void) | null = null;

  const close = vi.fn();
  const ws = {
    readyState: OPEN,
    send,
    close,
    set onopen(fn: () => void) {
      onopen = fn;
    },
    set onclose(fn: () => void) {
      onclose = fn;
    },
    set onmessage(fn: (e: { data: string }) => void) {
      onmessage = fn;
    },
  };

  function MockWS() {
    return ws;
  }
  (MockWS as unknown as { OPEN: number }).OPEN = 1;

  return {
    ws: ws as unknown as { readyState: number; send: ReturnType<typeof vi.fn> },
    triggerOpen: () => onopen?.(),
    triggerClose: () => onclose?.(),
    triggerMessage: (data: string) => onmessage?.({ data }),
    MockClass: MockWS as unknown as typeof WebSocket,
  };
}

describe("subscriptionKey", () => {
  it("creates key from topic and type", () => {
    expect(
      subscriptionKey({ topic: "comments", type: "comment_created" })
    ).toBe("comments::comment_created::");
  });

  it("includes filters when present", () => {
    expect(
      subscriptionKey({
        topic: "comments",
        type: "comment_created",
        filters: "parent_entity_id=123",
      })
    ).toBe("comments::comment_created::parent_entity_id=123");
  });

  it("treats undefined filters as empty string", () => {
    expect(subscriptionKey({ topic: "crypto_prices", type: "update" })).toBe(
      "crypto_prices::update::"
    );
  });
});

describe("RtdsClient", () => {
  let OriginalWebSocket: typeof WebSocket;
  let client: RtdsClient;

  beforeAll(() => {
    OriginalWebSocket = globalThis.WebSocket as typeof WebSocket;
  });

  afterEach(() => {
    client.disconnect();
    vi.restoreAllMocks();
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      OriginalWebSocket;
  });

  it("starts disconnected", () => {
    client = new RtdsClient();
    expect(client.isConnected()).toBe(false);
  });

  it("tracks subscriptions without connecting", () => {
    client = new RtdsClient();
    const sub: RtdsSubscription = {
      topic: "comments",
      type: "comment_created",
      filters: "parent_entity_id=123",
    };
    client.subscribe([sub]);
    const subs = client.getSubscriptions();
    expect(subs.size).toBe(1);
    expect(subs.get(subscriptionKey(sub))).toEqual(sub);
  });

  it("deduplicates duplicate subscriptions", () => {
    client = new RtdsClient();
    const sub: RtdsSubscription = {
      topic: "comments",
      type: "comment_created",
    };
    client.subscribe([sub, sub]);
    expect(client.getSubscriptions().size).toBe(1);
  });

  it("unsubscribe removes from tracked subs", () => {
    client = new RtdsClient();
    const sub: RtdsSubscription = {
      topic: "crypto_prices",
      type: "update",
    };
    client.subscribe([sub]);
    client.unsubscribe([sub]);
    expect(client.getSubscriptions().size).toBe(0);
  });

  it("reference-counts duplicate subscribe before removing", () => {
    client = new RtdsClient();
    const sub: RtdsSubscription = {
      topic: "crypto_prices",
      type: "update",
    };
    client.subscribe([sub]);
    client.subscribe([sub]);
    expect(client.getSubscriptions().size).toBe(1);
    client.unsubscribe([sub]);
    expect(client.getSubscriptions().size).toBe(1);
    client.unsubscribe([sub]);
    expect(client.getSubscriptions().size).toBe(0);
  });

  it("dispatches events to handlers when connected", () => {
    const mock = createMockWebSocket();
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      mock.MockClass;

    client = new RtdsClient();
    const received: unknown[] = [];
    client.addHandler((e) => received.push(e));

    client.connect();
    mock.triggerOpen();

    const event = {
      topic: "crypto_prices",
      type: "update",
      timestamp: 1_704_067_200,
      payload: { symbol: "BTC", timestamp: 1_704_067_200, value: 42_000 },
    };
    mock.triggerMessage(JSON.stringify(event));

    expect(received).toHaveLength(1);
    expect((received[0] as { topic: string }).topic).toBe("crypto_prices");
  });

  it("invokes status handler on connect", () => {
    const mock = createMockWebSocket();
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      mock.MockClass;

    client = new RtdsClient();
    const statusChanges: boolean[] = [];
    client.onStatusChange((connected) => statusChanges.push(connected));

    client.connect();
    mock.triggerOpen();
    expect(statusChanges).toContain(true);

    client.disconnect();
    expect(statusChanges).toContain(false);
  });

  it("getDebugInfo returns connection state", () => {
    client = new RtdsClient();
    client.subscribe([{ topic: "comments", type: "comment_created" }]);
    const info = client.getDebugInfo();
    expect(info.connected).toBe(false);
    expect(info.subscriptions).toBe(1);
  });
});
