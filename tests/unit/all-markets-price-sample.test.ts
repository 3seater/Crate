import { describe, expect, it } from "vitest";

import {
  ALL_MARKETS_LINE_BUCKET_SEC,
  bucketSecForAllMarketsHistory,
  buildAllMarketsPerMarketBucketMap,
  computeAllMarketsBucketSec,
  computeSharedAllMarketsBucketSec,
  downsamplePriceHistoryByBuckets,
} from "@/features/trading/components/charts/all-markets-price-sample";

describe("computeAllMarketsBucketSec", () => {
  it("uses finer buckets for short spans", () => {
    const oneDay = 86_400;
    expect(computeAllMarketsBucketSec(oneDay)).toBeLessThanOrEqual(600);
  });

  it("uses coarser buckets for long spans", () => {
    const twoYears = 730 * 86_400;
    expect(computeAllMarketsBucketSec(twoYears)).toBeGreaterThanOrEqual(86_400);
  });

  it("falls back for invalid input", () => {
    expect(computeAllMarketsBucketSec(0)).toBe(300);
    expect(computeAllMarketsBucketSec(Number.NaN)).toBe(300);
  });
});

describe("bucketSecForAllMarketsHistory", () => {
  it("uses a smaller bucket for a market that has only been open a few days", () => {
    const now = 1_000_000;
    const firstT = now - 3 * 86_400;
    const lastT = now;
    const short = bucketSecForAllMarketsHistory(firstT, lastT, now);
    const yearAgo = now - 400 * 86_400;
    const long = bucketSecForAllMarketsHistory(yearAgo, lastT, now);
    expect(short).toBeLessThanOrEqual(long);
  });
});

describe("computeSharedAllMarketsBucketSec", () => {
  it("returns fixed 4h bucket regardless of span (uniform overlay resolution)", () => {
    const now = 10_000_000;
    const m = new Map<string, PriceHistoryPoint[]>();
    m.set("long", [
      { t: now - 400 * 86_400, p: 0.4 },
      { t: now, p: 0.5 },
    ]);
    m.set("short", [
      { t: now - 5 * 86_400, p: 0.2 },
      { t: now, p: 0.3 },
    ]);
    expect(computeSharedAllMarketsBucketSec(m, now)).toBe(
      ALL_MARKETS_LINE_BUCKET_SEC
    );
  });

  it("returns 4h when no series", () => {
    expect(computeSharedAllMarketsBucketSec(new Map(), 100)).toBe(
      ALL_MARKETS_LINE_BUCKET_SEC
    );
  });
});

describe("buildAllMarketsPerMarketBucketMap", () => {
  it("returns one entry per non-empty series", () => {
    const m = new Map<string, PriceHistoryPoint[]>();
    m.set("a", [
      { t: 100, p: 0.5 },
      { t: 200, p: 0.6 },
    ]);
    m.set("b", []);
    const out = buildAllMarketsPerMarketBucketMap(m, 250);
    expect(out.size).toBe(1);
    expect(out.has("a")).toBe(true);
  });
});

describe("downsamplePriceHistoryByBuckets", () => {
  it("returns last price per bucket", () => {
    const pts = [
      { t: 0, p: 0.1 },
      { t: 30, p: 0.2 },
      { t: 70, p: 0.3 },
      { t: 120, p: 0.4 },
    ];
    const out = downsamplePriceHistoryByBuckets(pts, 60);
    expect(out).toEqual([
      { t: 30, p: 0.2 },
      { t: 70, p: 0.3 },
      { t: 120, p: 0.4 },
    ]);
  });

  it("passes through empty", () => {
    expect(downsamplePriceHistoryByBuckets([], 60)).toEqual([]);
  });
});
