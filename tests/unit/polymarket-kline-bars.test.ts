import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/trpc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/lib/trpc")>();
  return {
    ...actual,
    queryClient: {
      ...actual.queryClient,
      fetchQuery: (opts: { queryKey?: readonly unknown[] }) => {
        const meta = opts.queryKey?.[1] as { input?: Record<string, unknown> };
        return Promise.resolve(queryMock(meta?.input ?? {}));
      },
    },
  };
});

vi.mock(
  "@/features/trading/components/charts/polymarket-kline-fetch",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/trading/components/charts/polymarket-kline-fetch")
      >();
    return {
      ...actual,
      fetchPricesHistoryWithLadder: vi.fn().mockResolvedValue([
        { t: 1_700_000_000, p: 0.5 },
        { t: 1_700_086_400, p: 0.51 },
      ]),
    };
  }
);

import { intervalToPeriod } from "@/features/trading/components/charts/kline-aggregation";
import { loadPolymarketKlineBars } from "@/features/trading/components/charts/polymarket-kline-bars";

describe("loadPolymarketKlineBars", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("returns no bars for update", async () => {
    const r = await loadPolymarketKlineBars({
      market: "m",
      chartInterval: "1h",
      period: intervalToPeriod("1h"),
      loadType: "update",
      timestampMs: null,
      seedForMax: [],
    });
    expect(r.bars).toEqual([]);
    expect(r.more).toEqual({});
  });

  it("forward load fetches older range before oldest bar (KLine prepends)", async () => {
    queryMock.mockResolvedValueOnce([{ t: 1_699_000_000, p: 0.3 }]);
    const oldestBarMs = 1_700_000_000_000;
    const r = await loadPolymarketKlineBars({
      market: "token",
      chartInterval: "1h",
      period: intervalToPeriod("1h"),
      loadType: "forward",
      timestampMs: oldestBarMs,
      seedForMax: [],
    });
    expect(r.bars.length).toBeGreaterThan(0);
    expect(r.more.forward).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const arg = queryMock.mock.calls[0]?.[0] as { endTs: number };
    expect(arg?.endTs).toBeLessThan(1_700_000_000);
  });

  it("uses max preset for 1d (no backward)", async () => {
    const r = await loadPolymarketKlineBars({
      market: "m",
      chartInterval: "1d",
      period: intervalToPeriod("1d"),
      loadType: "init",
      timestampMs: null,
      seedForMax: [],
    });
    expect(r.bars.length).toBeGreaterThan(0);
    expect(r.more.backward).toBe(false);
    expect(queryMock).not.toHaveBeenCalled();
  });

  it("1h init uses explicit startTs/endTs", async () => {
    queryMock.mockResolvedValueOnce([{ t: 1_700_000_000, p: 0.4 }]);
    const r = await loadPolymarketKlineBars({
      market: "token",
      chartInterval: "1h",
      period: intervalToPeriod("1h"),
      loadType: "init",
      timestampMs: null,
      seedForMax: [],
    });
    expect(r.bars.length).toBeGreaterThan(0);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const arg = queryMock.mock.calls[0]?.[0] as {
      startTs: number;
      endTs: number;
      fidelity: number;
      market: string;
    };
    expect(arg).toMatchObject({
      market: "token",
      fidelity: 5,
    });
    expect(arg.endTs - arg.startTs).toBeGreaterThanOrEqual(86_400 * 6);
    expect(r.more.forward).toBe(true);
  });

  it("1min init requests fidelity 1 first (not 5) for wide windows", async () => {
    queryMock.mockResolvedValueOnce([{ t: 1_700_000_000, p: 0.41 }]);
    const r = await loadPolymarketKlineBars({
      market: "token",
      chartInterval: "1min",
      period: intervalToPeriod("1min"),
      loadType: "init",
      timestampMs: null,
      seedForMax: [],
    });
    expect(r.bars.length).toBeGreaterThan(0);
    expect(queryMock).toHaveBeenCalledTimes(1);
    const arg = queryMock.mock.calls[0]?.[0] as { fidelity: number };
    expect(arg.fidelity).toBe(1);
  });
});
