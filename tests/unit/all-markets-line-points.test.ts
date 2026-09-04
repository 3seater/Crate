import { describe, expect, it } from "vitest";
import {
  mergeCoarseWithViewportDetail,
  selectLinePointsForWindow,
} from "@/features/trading/components/charts/all-markets-line-points";
import type { PriceHistoryPoint } from "@/features/trading/components/charts/types";

describe("selectLinePointsForWindow", () => {
  it("returns bracket pair when no sample falls inside the window but two span across it", () => {
    const points: PriceHistoryPoint[] = [
      { t: 100, p: 0.4 },
      { t: 900, p: 0.6 },
    ];
    const ws = 200;
    const we = 800;
    const sel = selectLinePointsForWindow(points, ws, we);
    expect(sel).toHaveLength(2);
    expect(sel[0]).toEqual({ t: 100, p: 0.4 });
    expect(sel[1]).toEqual({ t: 900, p: 0.6 });
  });

  it("includes neighbors when samples exist inside the window", () => {
    const points: PriceHistoryPoint[] = [
      { t: 0, p: 0.1 },
      { t: 500, p: 0.5 },
      { t: 1000, p: 0.9 },
    ];
    const sel = selectLinePointsForWindow(points, 400, 600);
    expect(sel.map((p) => p.t)).toEqual([0, 500, 1000]);
  });

  it("returns empty when all data lies strictly before the window", () => {
    const points: PriceHistoryPoint[] = [
      { t: 10, p: 0.2 },
      { t: 20, p: 0.3 },
    ];
    const sel = selectLinePointsForWindow(points, 100, 200);
    expect(sel).toEqual([]);
  });
});

describe("mergeCoarseWithViewportDetail", () => {
  it("replaces coarse samples in the padded window with detail and keeps outer coarse", () => {
    const coarse: PriceHistoryPoint[] = [
      { t: 0, p: 0.1 },
      { t: 500, p: 0.5 },
      { t: 600, p: 0.55 },
      { t: 2000, p: 0.9 },
    ];
    const detail: PriceHistoryPoint[] = [
      { t: 520, p: 0.52 },
      { t: 580, p: 0.53 },
    ];
    const merged = mergeCoarseWithViewportDetail(coarse, detail, 500, 600);
    const times = merged.map((p) => p.t).sort((a, b) => a - b);
    expect(times).toEqual([0, 520, 580, 2000]);
  });
});
