import { describe, expect, it } from "vitest";

import {
  appendTradePoint,
  getStartTimestamp,
  INTERVALS,
  toChartData,
} from "@/features/trading/components/charts/time-series-chart-utils";

// --- toChartData Tests ---

describe("toChartData", () => {
  it("converts PriceHistoryPoint array to chart data format", () => {
    const points = [
      { t: 1_700_000_000, p: 0.55 },
      { t: 1_700_003_600, p: 0.62 },
      { t: 1_700_007_200, p: 0.58 },
    ];
    const result = toChartData(points);
    expect(result).toHaveLength(3);
    expect(result[0].time).toBe(1_700_000_000);
    expect(result[0].value).toBeCloseTo(55, 5);
    expect(result[1].time).toBe(1_700_003_600);
    expect(result[1].value).toBeCloseTo(62, 5);
    expect(result[2].time).toBe(1_700_007_200);
    expect(result[2].value).toBeCloseTo(58, 5);
  });

  it("returns empty array for empty input", () => {
    expect(toChartData([])).toEqual([]);
  });

  it("handles single data point", () => {
    const result = toChartData([{ t: 1_700_000_000, p: 0.99 }]);
    expect(result).toEqual([{ time: 1_700_000_000, value: 99 }]);
  });

  it("preserves decimal precision", () => {
    const result = toChartData([{ t: 1_700_000_000, p: 0.001 }]);
    expect(result[0].value).toBeCloseTo(0.1);
  });

  it("normalises millisecond timestamps to seconds", () => {
    const points = [
      { t: 1_700_000_000_000, p: 0.55 },
      { t: 1_700_003_600_000, p: 0.62 },
    ];
    const result = toChartData(points);
    expect(result).toHaveLength(2);
    expect(result[0].time).toBe(1_700_000_000);
    expect(result[1].time).toBe(1_700_003_600);
  });

  it("handles mixed second and millisecond timestamps", () => {
    const points = [
      { t: 1_700_000_000, p: 0.5 },
      { t: 1_700_003_600_000, p: 0.6 },
    ];
    const result = toChartData(points);
    expect(result).toHaveLength(2);
    expect(result[0].time).toBe(1_700_000_000);
    expect(result[1].time).toBe(1_700_003_600);
  });

  it("deduplicates points with same timestamp", () => {
    const points = [
      { t: 1_700_000_000, p: 0.5 },
      { t: 1_700_000_000, p: 0.6 },
      { t: 1_700_003_600, p: 0.7 },
    ];
    const result = toChartData(points);
    expect(result).toHaveLength(2);
    expect(result[0].value).toBeCloseTo(60, 5);
    expect(result[1].value).toBeCloseTo(70, 5);
  });

  it("sorts unsorted points into ascending order", () => {
    const points = [
      { t: 1_700_007_200, p: 0.3 },
      { t: 1_700_000_000, p: 0.5 },
      { t: 1_700_003_600, p: 0.7 },
    ];
    const result = toChartData(points);
    expect(result.map((r) => r.time)).toEqual([
      1_700_000_000, 1_700_003_600, 1_700_007_200,
    ]);
  });

  it("returns empty array for non-array input", () => {
    expect(toChartData(null as unknown as [])).toEqual([]);
    expect(toChartData(undefined as unknown as [])).toEqual([]);
  });

  it("skips points with invalid timestamp (object)", () => {
    const points = [
      { t: 1_700_000_000, p: 0.5 },
      { t: { invalid: true } as unknown as number, p: 0.6 },
      { t: 1_700_003_600, p: 0.7 },
    ];
    const result = toChartData(points);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ time: 1_700_000_000, value: 50 });
    expect(result[1]).toEqual({ time: 1_700_003_600, value: 70 });
  });
});

// --- appendTradePoint Tests ---

describe("appendTradePoint", () => {
  it("appends a new point to existing data", () => {
    const data = [
      { time: 1000, value: 50 },
      { time: 2000, value: 60 },
    ];
    const result = appendTradePoint(data, 3000, 0.65);
    expect(result).toHaveLength(3);
    expect(result[2]).toEqual({ time: 3000, value: 65 });
  });

  it("creates array with single point when data is empty", () => {
    const result = appendTradePoint([], 1000, 0.5);
    expect(result).toEqual([{ time: 1000, value: 50 }]);
  });

  it("updates last point when timestamp matches", () => {
    const data = [
      { time: 1000, value: 50 },
      { time: 2000, value: 60 },
    ];
    const result = appendTradePoint(data, 2000, 0.65);
    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({ time: 2000, value: 65 });
  });

  it("skips out-of-order timestamps", () => {
    const data = [
      { time: 1000, value: 50 },
      { time: 2000, value: 60 },
    ];
    const result = appendTradePoint(data, 1500, 0.55);
    expect(result).toHaveLength(2);
    expect(result).toEqual(data);
  });

  it("does not mutate the original array", () => {
    const data = [{ time: 1000, value: 50 }];
    const result = appendTradePoint(data, 2000, 0.6);
    expect(data).toHaveLength(1);
    expect(result).toHaveLength(2);
  });

  it("does not mutate original array when updating last point", () => {
    const data = [{ time: 1000, value: 50 }];
    const original = [...data];
    appendTradePoint(data, 1000, 0.6);
    expect(data).toEqual(original);
  });
});

// --- getStartTimestamp Tests ---

describe("getStartTimestamp", () => {
  it("returns undefined for 'max' interval", () => {
    expect(getStartTimestamp("max")).toBeUndefined();
  });

  it("returns a timestamp ~1 hour ago for '1h'", () => {
    const now = Math.floor(Date.now() / 1000);
    const result = getStartTimestamp("1h");
    expect(result).toBeDefined();
    // Should be within a few seconds of (now - 3600)
    expect(Math.abs((result ?? 0) - (now - 3600))).toBeLessThan(5);
  });

  it("returns a timestamp ~1 day ago for '1d'", () => {
    const now = Math.floor(Date.now() / 1000);
    const result = getStartTimestamp("1d");
    expect(result).toBeDefined();
    expect(Math.abs((result ?? 0) - (now - 24 * 3600))).toBeLessThan(5);
  });

  it("returns a timestamp ~1 week ago for '1w'", () => {
    const now = Math.floor(Date.now() / 1000);
    const result = getStartTimestamp("1w");
    expect(result).toBeDefined();
    expect(Math.abs((result ?? 0) - (now - 7 * 24 * 3600))).toBeLessThan(5);
  });

  it("returns a timestamp ~30 days ago for '1m' (1 month)", () => {
    const now = Math.floor(Date.now() / 1000);
    const result = getStartTimestamp("1m");
    expect(result).toBeDefined();
    const thirtyDays = 30 * 24 * 3600;
    expect(Math.abs((result ?? 0) - (now - thirtyDays))).toBeLessThan(5);
  });

  it("returns a timestamp ~1 minute ago for '1min'", () => {
    const now = Math.floor(Date.now() / 1000);
    const result = getStartTimestamp("1min");
    expect(result).toBeDefined();
    expect(Math.abs((result ?? 0) - (now - 60))).toBeLessThan(5);
  });
});

// --- INTERVALS constant Tests ---

describe("INTERVALS", () => {
  it("has exactly 7 Polymarket-style intervals", () => {
    expect(INTERVALS).toHaveLength(7);
  });

  it("contains all expected interval values", () => {
    const values = INTERVALS.map((i) => i.value);
    expect(values).toEqual(["1min", "15m", "1h", "1d", "1w", "1m", "max"]);
  });

  it("has display labels for all intervals", () => {
    for (const interval of INTERVALS) {
      expect(interval.label).toBeTruthy();
    }
  });
});
