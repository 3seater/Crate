import type {
  AxisCreateRangeCallback,
  AxisRange,
  Chart,
  KLineData,
} from "klinecharts";

/** Runtime chart exposes the internal store (not on the public `Chart` type). */
type ChartWithStore = Chart & {
  getChartStore: () => {
    getVisibleRangeDataList: () => Array<{
      data: { current: KLineData | null | undefined };
    }>;
  };
};

function quantileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) {
    return Number.NaN;
  }
  const first = sorted[0];
  const last = sorted.at(-1);
  if (sorted.length === 1 || first === undefined || last === undefined) {
    return first ?? last ?? Number.NaN;
  }
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const vLo = sorted[lo];
  const vHi = sorted[hi];
  if (vLo === undefined || vHi === undefined) {
    return Number.NaN;
  }
  if (lo === hi) {
    return vLo;
  }
  const t = idx - lo;
  return vLo * (1 - t) + vHi * t;
}

function axisRangeFromMinMax(min: number, max: number): AxisRange {
  const diff = max - min;
  return {
    from: min,
    to: max,
    range: diff,
    realFrom: min,
    realTo: max,
    realRange: diff,
    displayFrom: min,
    displayTo: max,
    displayRange: diff,
  };
}

/**
 * KLineChart’s default Y range is **min/max high–low of visible candles**. One old spike on the
 * left (still visible after “Latest”) squashes normal prices. This uses a **trimmed** band
 * (percentiles of visible highs/lows), then expands slightly and **pins the last visible close**
 * so the current price stays in view — matching what users see after nudging scroll.
 */
export const createRobustCandleYAxisRange: AxisCreateRangeCallback = (
  params
) => {
  const { chart, defaultRange } = params;
  const store = (chart as ChartWithStore).getChartStore();
  const visible = store.getVisibleRangeDataList();
  const lows: number[] = [];
  const highs: number[] = [];
  for (const row of visible) {
    const d = row.data.current;
    if (d != null && Number.isFinite(d.low) && Number.isFinite(d.high)) {
      lows.push(d.low);
      highs.push(d.high);
    }
  }
  if (lows.length < 4) {
    return defaultRange;
  }
  lows.sort((a, b) => a - b);
  highs.sort((a, b) => a - b);
  let min = quantileSorted(lows, 0.07);
  let max = quantileSorted(highs, 0.93);
  // Always fully reveal the latest candle — pin its entire OHLC range so its
  // body and wicks are never clipped, regardless of the quantile trim above.
  //
  // IMPORTANT: visible.at(-1) is often a null-data slot because setOffsetRightDistance
  // adds empty padding slots to the right of the last real bar. We must scan backwards
  // to find the rightmost slot that actually has candle data.
  let lastCandle: KLineData | null | undefined;
  for (let i = visible.length - 1; i >= 0; i--) {
    const d = visible[i]?.data.current;
    if (d != null) {
      lastCandle = d;
      break;
    }
  }
  if (lastCandle != null) {
    if (Number.isFinite(lastCandle.close)) {
      min = Math.min(min, lastCandle.close);
      max = Math.max(max, lastCandle.close);
    }
    if (Number.isFinite(lastCandle.high)) {
      max = Math.max(max, lastCandle.high);
    }
    if (Number.isFinite(lastCandle.low)) {
      min = Math.min(min, lastCandle.low);
    }
  }
  const pad = Math.max((max - min) * 0.07, 0.25);
  min -= pad;
  max += pad;
  if (!(min < max && Number.isFinite(min) && Number.isFinite(max))) {
    return defaultRange;
  }
  return axisRangeFromMinMax(min, max);
};
