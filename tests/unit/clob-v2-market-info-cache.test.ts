/**
 * Unit tests for getClobMarketInfo caching behavior.
 *
 * Tests cover:
 * 1. LRU cache behavior — hit within TTL, miss after TTL, separate keys
 *
 * Note: getClobMarketInfo is now inherited from the V2 SDK base class
 * (returns MarketDetails). The Doji wrapper no longer overrides it.
 *
 * _Requirements: 4.5, 4.6, 9.2_
 */

import type { ClobMarketInfo } from "@doji/types";
import { LRUCache } from "lru-cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const CONDITION_ID = "0xabc123def456";

const MOCK_MARKET_INFO: ClobMarketInfo = {
  c: CONDITION_ID,
  mts: 0.01,
  nr: false,
  fd: { r: 100, e: 6, to: true },
  t: [
    { t: "0xtoken1", o: "Yes" },
    { t: "0xtoken2", o: "No" },
  ],
};

// ─── LRU Cache Behavior ─────────────────────────────────────────────────────

describe("LRU cache for ClobMarketInfo", () => {
  let cache: LRUCache<string, ClobMarketInfo>;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new LRUCache<string, ClobMarketInfo>({
      max: 500,
      ttl: 60_000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns cached result within TTL (cache hit)", () => {
    cache.set(CONDITION_ID, MOCK_MARKET_INFO);

    // Advance 30s — still within 60s TTL
    vi.advanceTimersByTime(30_000);

    const result = cache.get(CONDITION_ID);
    expect(result).toEqual(MOCK_MARKET_INFO);
  });

  it("returns undefined after TTL expires (cache miss)", () => {
    cache.set(CONDITION_ID, MOCK_MARKET_INFO);

    // Advance past 60s TTL
    vi.advanceTimersByTime(61_000);

    const result = cache.get(CONDITION_ID);
    expect(result).toBeUndefined();
  });

  it("caches different condition IDs independently", () => {
    const otherInfo: ClobMarketInfo = {
      ...MOCK_MARKET_INFO,
      mts: 0.001,
      nr: true,
    };

    cache.set("condition-a", MOCK_MARKET_INFO);
    cache.set("condition-b", otherInfo);

    expect(cache.get("condition-a")).toEqual(MOCK_MARKET_INFO);
    expect(cache.get("condition-b")).toEqual(otherInfo);
  });

  it("simulates the router caching pattern: hit avoids fetch, miss triggers fetch", async () => {
    const fetchMarketInfo = vi.fn().mockResolvedValue(MOCK_MARKET_INFO);

    // Simulate the router's getClobMarketInfo logic
    async function getClobMarketInfoCached(
      conditionId: string
    ): Promise<ClobMarketInfo> {
      const cached = cache.get(conditionId);
      if (cached) {
        return cached;
      }
      const result = await fetchMarketInfo(conditionId);
      cache.set(conditionId, result);
      return result;
    }

    // First call — cache miss, triggers fetch
    const first = await getClobMarketInfoCached(CONDITION_ID);
    expect(first).toEqual(MOCK_MARKET_INFO);
    expect(fetchMarketInfo).toHaveBeenCalledOnce();

    // Second call within TTL — cache hit, no fetch
    const second = await getClobMarketInfoCached(CONDITION_ID);
    expect(second).toEqual(MOCK_MARKET_INFO);
    expect(fetchMarketInfo).toHaveBeenCalledOnce(); // still 1

    // Advance past TTL
    vi.advanceTimersByTime(61_000);

    // Third call — cache miss again, triggers fresh fetch
    const freshInfo: ClobMarketInfo = { ...MOCK_MARKET_INFO, mts: 0.001 };
    fetchMarketInfo.mockResolvedValueOnce(freshInfo);

    const third = await getClobMarketInfoCached(CONDITION_ID);
    expect(third).toEqual(freshInfo);
    expect(fetchMarketInfo).toHaveBeenCalledTimes(2);
  });
});
