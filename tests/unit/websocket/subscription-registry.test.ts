/**
 * Unit tests for SubscriptionRegistry (reference-counted WebSocket subscriptions).
 */
import { afterEach, describe, expect, it } from "vitest";
import { subscriptionRegistry } from "../../../apps/web/src/lib/websocket/subscription-registry";

const CHANNEL = "market";
const ASSET_A = "asset-a";
const ASSET_B = "asset-b";

describe("SubscriptionRegistry", () => {
  afterEach(() => {
    subscriptionRegistry.clear(CHANNEL);
    subscriptionRegistry.clear("user");
    subscriptionRegistry.clear("other");
  });

  describe("subscribe / unsubscribe", () => {
    it("tracks single subscription", () => {
      subscriptionRegistry.subscribe(CHANNEL, ASSET_A);
      expect(subscriptionRegistry.isSubscribed(CHANNEL, ASSET_A)).toBe(true);
      expect(subscriptionRegistry.getRefCount(CHANNEL, ASSET_A)).toBe(1);
      expect(subscriptionRegistry.getSubscriptions(CHANNEL)).toEqual([ASSET_A]);
    });

    it("increments ref count on duplicate subscribe", () => {
      subscriptionRegistry.subscribe(CHANNEL, ASSET_A);
      subscriptionRegistry.subscribe(CHANNEL, ASSET_A);
      expect(subscriptionRegistry.getRefCount(CHANNEL, ASSET_A)).toBe(2);
    });

    it("decrements ref count on unsubscribe and returns true when last", () => {
      subscriptionRegistry.subscribe(CHANNEL, ASSET_A);
      subscriptionRegistry.subscribe(CHANNEL, ASSET_A);
      expect(subscriptionRegistry.unsubscribe(CHANNEL, ASSET_A)).toBe(false);
      expect(subscriptionRegistry.getRefCount(CHANNEL, ASSET_A)).toBe(1);
      expect(subscriptionRegistry.unsubscribe(CHANNEL, ASSET_A)).toBe(true);
      expect(subscriptionRegistry.isSubscribed(CHANNEL, ASSET_A)).toBe(false);
    });

    it("returns false when unsubscribing non-existent asset", () => {
      expect(subscriptionRegistry.unsubscribe(CHANNEL, ASSET_A)).toBe(false);
    });

    it("returns false when unsubscribing from non-existent channel", () => {
      subscriptionRegistry.subscribe("other", ASSET_A);
      expect(subscriptionRegistry.unsubscribe(CHANNEL, ASSET_A)).toBe(false);
    });
  });

  describe("getTotalCount", () => {
    it("counts subscription entries across channels", () => {
      subscriptionRegistry.subscribe(CHANNEL, ASSET_A);
      subscriptionRegistry.subscribe(CHANNEL, ASSET_B);
      subscriptionRegistry.subscribe("user", ASSET_A);
      // Each (channel, asset) pair counts; market: 2, user: 1
      expect(subscriptionRegistry.getTotalCount()).toBe(3);
    });
  });

  describe("clear", () => {
    it("removes all subscriptions for channel", () => {
      subscriptionRegistry.subscribe(CHANNEL, ASSET_A);
      subscriptionRegistry.subscribe(CHANNEL, ASSET_B);
      subscriptionRegistry.clear(CHANNEL);
      expect(subscriptionRegistry.getSubscriptions(CHANNEL)).toEqual([]);
      expect(subscriptionRegistry.isSubscribed(CHANNEL, ASSET_A)).toBe(false);
    });
  });

  describe("onChange", () => {
    it("notifies when subscriptions change", () => {
      const notified: string[] = [];
      const unsub = subscriptionRegistry.onChange(() => {
        notified.push("changed");
      });
      subscriptionRegistry.subscribe(CHANNEL, ASSET_A);
      subscriptionRegistry.unsubscribe(CHANNEL, ASSET_A);
      expect(notified).toEqual(["changed", "changed"]);
      unsub();
    });
  });

  describe("getDebugInfo", () => {
    it("returns subscription counts per channel", () => {
      subscriptionRegistry.subscribe(CHANNEL, ASSET_A);
      subscriptionRegistry.subscribe(CHANNEL, ASSET_B);
      const info = subscriptionRegistry.getDebugInfo();
      expect(info[CHANNEL]).toBe(2);
    });
  });
});
