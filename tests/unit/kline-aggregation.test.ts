import { describe, expect, it } from "vitest";

import {
  aggregatePricePointsForKlinePeriod,
  aggregatePricePointsToKLineData,
  clampKLineWicksNearBody,
  filterSamplesForWickTukey,
  intervalToPeriod,
  mondayUtcWeekStartMs,
  normalizePriceHistoryPoints,
  periodBarStartMs,
  periodToMs,
  thinConstantPriceRuns,
} from "@/features/trading/components/charts/kline-aggregation";

describe("periodToMs", () => {
  it("converts minute span to milliseconds", () => {
    expect(periodToMs({ type: "minute", span: 1 })).toBe(60_000);
    expect(periodToMs({ type: "minute", span: 5 })).toBe(300_000);
  });

  it("converts hour and day", () => {
    expect(periodToMs({ type: "hour", span: 1 })).toBe(3_600_000);
    expect(periodToMs({ type: "day", span: 1 })).toBe(86_400_000);
  });
});

describe("intervalToPeriod", () => {
  it("maps max to daily bars", () => {
    expect(intervalToPeriod("max")).toEqual({ type: "day", span: 1 });
  });

  it("maps chips to candle period (label = bar width)", () => {
    expect(intervalToPeriod("1min")).toEqual({ type: "minute", span: 1 });
    expect(intervalToPeriod("15m")).toEqual({ type: "minute", span: 15 });
    expect(intervalToPeriod("1h")).toEqual({ type: "hour", span: 1 });
    expect(intervalToPeriod("6h")).toEqual({ type: "hour", span: 6 });
    expect(intervalToPeriod("1d")).toEqual({ type: "day", span: 1 });
    expect(intervalToPeriod("1w")).toEqual({ type: "week", span: 1 });
    expect(intervalToPeriod("1m")).toEqual({ type: "month", span: 1 });
  });
});

describe("clampKLineWicksNearBody", () => {
  it("pulls extreme wicks toward open/close band", () => {
    const bars = clampKLineWicksNearBody(
      [
        {
          timestamp: 1,
          open: 50,
          high: 52,
          low: 5,
          close: 51,
        },
      ],
      10
    );
    expect(bars[0]?.low).toBe(40);
    expect(bars[0]?.high).toBe(52);
  });
});

describe("thinConstantPriceRuns", () => {
  it("keeps first and last of a long same-price run", () => {
    const r = thinConstantPriceRuns([
      { t: 100, p: 0.5 },
      { t: 200, p: 0.5 },
      { t: 300, p: 0.5 },
      { t: 400, p: 0.6 },
    ]);
    expect(r).toEqual([
      { t: 100, p: 0.5 },
      { t: 300, p: 0.5 },
      { t: 400, p: 0.6 },
    ]);
  });

  it("returns empty for empty input", () => {
    expect(thinConstantPriceRuns([])).toEqual([]);
  });
});

describe("normalizePriceHistoryPoints", () => {
  it("deduplicates same timestamp keeping last", () => {
    const r = normalizePriceHistoryPoints([
      { t: 1000, p: 0.5 },
      { t: 1000, p: 0.6 },
    ]);
    expect(r).toEqual([{ t: 1000, cents: 60 }]);
  });

  it("sorts and converts to cents", () => {
    const r = normalizePriceHistoryPoints([
      { t: 2000, p: 0.2 },
      { t: 1000, p: 0.1 },
    ]);
    expect(r).toEqual([
      { t: 1000, cents: 10 },
      { t: 2000, cents: 20 },
    ]);
  });

  it("normalises millisecond unix timestamps to seconds", () => {
    const r = normalizePriceHistoryPoints([{ t: 1_700_000_000_000, p: 0.5 }]);
    expect(r[0]?.t).toBe(1_700_000_000);
  });
});

describe("aggregatePricePointsToKLineData", () => {
  const min = 60_000;

  it("returns empty for empty input", () => {
    expect(aggregatePricePointsToKLineData([], min)).toEqual([]);
  });

  it("builds single doji bar for one point", () => {
    const t0 = 1000;
    const bars = aggregatePricePointsToKLineData([{ t: t0, p: 0.55 }], min);
    expect(bars).toHaveLength(1);
    expect(bars[0]?.timestamp).toBe(Math.floor((t0 * 1000) / min) * min);
    expect(bars[0]?.open).toBeCloseTo(55);
    expect(bars[0]?.high).toBeCloseTo(55);
    expect(bars[0]?.low).toBeCloseTo(55);
    expect(bars[0]?.close).toBeCloseTo(55);
  });

  it("aggregates multiple points in one bucket", () => {
    const base = 1_700_000_000 - (1_700_000_000 % 60);
    const start = Math.floor((base * 1000) / min) * min;
    const bars = aggregatePricePointsToKLineData(
      [
        { t: base, p: 0.5 },
        { t: base + 30, p: 0.7 },
        { t: base + 45, p: 0.6 },
      ],
      min
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]?.timestamp).toBe(start);
    expect(bars[0]?.open).toBeCloseTo(50);
    expect(bars[0]?.close).toBeCloseTo(60);
    expect(bars[0]?.high).toBeCloseTo(70);
    expect(bars[0]?.low).toBeCloseTo(50);
  });

  it("carryOpen links bars with previous close", () => {
    const minMs = 60_000;
    const t1 = 1000;
    const t2 = t1 + 120;
    const b1 = Math.floor((t1 * 1000) / minMs) * minMs;
    const b2 = Math.floor((t2 * 1000) / minMs) * minMs;
    const bars = aggregatePricePointsToKLineData(
      [
        { t: t1, p: 0.4 },
        { t: t2, p: 0.5 },
      ],
      minMs,
      { carryOpen: true }
    );
    expect(bars).toHaveLength(2);
    expect(bars[0]?.timestamp).toBe(b1);
    expect(bars[1]?.timestamp).toBe(b2);
    expect(bars[1]?.open).toBeCloseTo(bars[0]?.close ?? 0);
  });

  it("carryOpen false uses first tick as open", () => {
    const b = 1_700_000_000 - (1_700_000_000 % 60);
    const bars = aggregatePricePointsToKLineData(
      [
        { t: b, p: 0.5 },
        { t: b + 30, p: 0.6 },
      ],
      60_000,
      { carryOpen: false }
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]?.open).toBeCloseTo(50);
  });

  it("utc-week buckets same ISO week into one bar", () => {
    const weekMs = 7 * 86_400_000;
    const mon = mondayUtcWeekStartMs(Date.UTC(2025, 0, 6, 12, 0, 0, 0));
    const wedSec = Math.floor((mon + 2 * 86_400_000) / 1000);
    const friSec = Math.floor((mon + 4 * 86_400_000) / 1000);
    const bars = aggregatePricePointsToKLineData(
      [
        { t: wedSec, p: 0.5 },
        { t: friSec, p: 0.7 },
      ],
      weekMs,
      { carryOpen: true, timeAlignment: "utc-week" }
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]?.timestamp).toBe(mon);
    expect(bars[0]?.open).toBeCloseTo(50);
    expect(bars[0]?.close).toBeCloseTo(70);
  });

  it("ignores isolated bucket outlier for low when tukey filter is on", () => {
    const base = 1_700_000_000 - (1_700_000_000 % 60);
    const bars = aggregatePricePointsToKLineData(
      [
        { t: base, p: 0.26 },
        { t: base + 10, p: 0.26 },
        { t: base + 20, p: 0.26 },
        { t: base + 30, p: 0.26 },
        { t: base + 40, p: 0.2005 },
        { t: base + 50, p: 0.27 },
      ],
      min,
      { carryOpen: true }
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]?.low).toBeCloseTo(26);
    expect(bars[0]?.close).toBeCloseTo(27);
  });

  it("keeps true range when tukey filter is off", () => {
    const base = 1_700_000_000 - (1_700_000_000 % 60);
    const bars = aggregatePricePointsToKLineData(
      [
        { t: base, p: 0.26 },
        { t: base + 10, p: 0.26 },
        { t: base + 20, p: 0.26 },
        { t: base + 30, p: 0.26 },
        { t: base + 40, p: 0.2005 },
        { t: base + 50, p: 0.27 },
      ],
      min,
      { carryOpen: true, tukeyWickFilter: false }
    );
    expect(bars[0]?.low).toBeCloseTo(20.05);
  });
});

describe("filterSamplesForWickTukey", () => {
  it("returns samples unchanged when fewer than 3 points", () => {
    expect(filterSamplesForWickTukey([10, 50])).toEqual([10, 50]);
  });

  it("drops a lone lower outlier for wick range", () => {
    const filtered = filterSamplesForWickTukey([26, 26, 26, 26, 20.05]);
    expect(filtered).toEqual([26, 26, 26, 26]);
  });
});

describe("aggregatePricePointsForKlinePeriod", () => {
  it("uses UTC Monday alignment for week period", () => {
    const mon = mondayUtcWeekStartMs(Date.UTC(2025, 0, 8, 0, 0, 0, 0));
    const tSec = Math.floor(mon / 1000) + 3600;
    const bars = aggregatePricePointsForKlinePeriod(
      [{ t: tSec, p: 0.4 }],
      { type: "week", span: 1 },
      { carryOpen: true }
    );
    expect(bars).toHaveLength(1);
    expect(bars[0]?.timestamp).toBe(mon);
  });
});

describe("periodBarStartMs", () => {
  it("matches week bucket start", () => {
    const tMs = Date.UTC(2025, 0, 8, 15, 0, 0, 0);
    expect(periodBarStartMs(tMs, { type: "week", span: 1 })).toBe(
      mondayUtcWeekStartMs(tMs)
    );
  });

  it("uses epoch floors for hour period", () => {
    const period = { type: "hour" as const, span: 1 };
    const ms = periodToMs(period);
    const tMs = 1_765_000_000_123;
    expect(periodBarStartMs(tMs, period)).toBe(Math.floor(tMs / ms) * ms);
  });
});
