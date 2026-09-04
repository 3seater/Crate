/**
 * Unit tests for WebSocketManager (CLOB market/user channel).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WebSocketEvent } from "../../../apps/web/src/lib/websocket/manager";
import { WebSocketManager } from "../../../apps/web/src/lib/websocket/manager";

/** Creates a controllable WebSocket mock. */
function createMockWebSocket(): {
  instance: { readyState: number; send: ReturnType<typeof vi.fn> };
  triggerOpen: () => void;
  triggerClose: () => void;
  triggerMessage: (data: string | string[]) => void;
  MockClass: new (url: string) => unknown;
} {
  const OPEN = 1;
  const send = vi.fn();
  let onopen: (() => void) | null = null;
  let onclose: (() => void) | null = null;
  let onmessage: ((e: MessageEvent) => void) | null = null;

  const close = vi.fn();
  const instance = {
    readyState: OPEN,
    send,
    close,
    set onopen(fn: () => void) {
      onopen = fn;
    },
    set onclose(fn: () => void) {
      onclose = fn;
    },
    set onmessage(fn: (e: MessageEvent) => void) {
      onmessage = fn;
    },
  };

  function MockWS() {
    return instance;
  }
  (MockWS as unknown as { OPEN: number }).OPEN = 1;

  return {
    instance: instance as {
      readyState: number;
      send: ReturnType<typeof vi.fn>;
    },
    triggerOpen: () => onopen?.(),
    triggerClose: () => onclose?.(),
    triggerMessage: (data: string | string[]) => {
      const payload = typeof data === "string" ? data : JSON.stringify(data);
      onmessage?.({ data: payload } as MessageEvent);
    },
    MockClass: MockWS as unknown as typeof WebSocket,
  };
}

describe("WebSocketManager", () => {
  let manager: WebSocketManager;

  afterEach(() => {
    manager?.disconnect();
    vi.useRealTimers();
  });

  it("starts disconnected", () => {
    manager = new WebSocketManager();
    expect(manager.isConnected()).toBe(false);
  });

  it("tracks asset and market subscriptions without connecting", () => {
    manager = new WebSocketManager();
    manager.subscribeAssets(["asset-1", "asset-2"]);
    manager.subscribeMarkets(["market-1"]);
    expect(manager.getAssetSubscriptions().has("asset-1")).toBe(true);
    expect(manager.getMarketSubscriptions().has("market-1")).toBe(true);
  });

  it("sends initial MARKET subscription with assets on connect", () => {
    const mock = createMockWebSocket();
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      mock.MockClass;

    const onMessage = vi.fn();
    manager = new WebSocketManager();
    manager.connect({
      url: "wss://test.example.com/ws",
      channel: "market",
      assetIds: ["asset-1"],
      onMessage,
    });

    mock.triggerOpen();

    expect(mock.instance.send).toHaveBeenCalled();
    const sent = JSON.parse(mock.instance.send.mock.calls[0][0] as string);
    expect(sent.type).toBe("MARKET");
    expect(sent.assets_ids).toEqual(["asset-1"]);
  });

  it("sends initial USER subscription with auth on connect", () => {
    const mock = createMockWebSocket();
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      mock.MockClass;

    const onMessage = vi.fn();
    manager = new WebSocketManager();
    manager.connect({
      url: "wss://test.example.com/ws",
      channel: "user",
      auth: {
        apiKey: "key",
        secret: "secret",
        passphrase: "pass",
      },
      markets: ["m1"],
      onMessage,
    });

    mock.triggerOpen();

    const sent = JSON.parse(mock.instance.send.mock.calls[0][0] as string);
    expect(sent.type).toBe("USER");
    expect(sent.auth).toEqual({
      apiKey: "key",
      secret: "secret",
      passphrase: "pass",
    });
    expect(sent.markets).toEqual(["m1"]);
  });

  it("dispatches messages to onMessage", () => {
    const mock = createMockWebSocket();
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      mock.MockClass;

    const received: WebSocketEvent[] = [];
    manager = new WebSocketManager();
    manager.connect({
      url: "wss://test.example.com/ws",
      channel: "market",
      onMessage: (msg) => received.push(msg),
    });

    mock.triggerOpen();

    const event = {
      event_type: "last_trade_price",
      asset_id: "123",
      market: "0xabc",
      price: "0.5",
      side: "BUY",
      size: "10",
      fee_rate_bps: "0",
      timestamp: "1704067200",
    };
    mock.triggerMessage(event);

    expect(received).toHaveLength(1);
    expect((received[0] as { event_type: string }).event_type).toBe(
      "last_trade_price"
    );
  });

  it("disconnect clears connection and prevents reconnect", () => {
    const mock = createMockWebSocket();
    (globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket =
      mock.MockClass;

    manager = new WebSocketManager();
    manager.connect({
      url: "wss://test.example.com/ws",
      channel: "market",
      onMessage: vi.fn(),
    });

    mock.triggerOpen();
    expect(manager.isConnected()).toBe(true);

    manager.disconnect();
    mock.triggerClose();

    expect(manager.isConnected()).toBe(false);
  });
});
