import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/trpc", () => ({
  trpcClient: {
    clob: {
      getPricesHistory: { query: queryMock },
    },
  },
}));

import {
  fetchPricesHistoryWithLadder,
  normalizePriceHistoryPoints,
} from "@/features/trading/components/charts/polymarket-kline-fetch";

describe("fetchPricesHistoryWithLadder", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("retries coarser fidelity when the API returns an empty array (fine fidelity rejected without throw)", async () => {
    queryMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ t: 1_700_000_000, p: 0.5 }]);

    const result = await fetchPricesHistoryWithLadder({
      market:
        "54533043819946592547517511176940999955633860128497669742211153063842200957669",
      interval: "1d",
    });

    expect(result).toEqual([{ t: 1_700_000_000, p: 0.5 }]);
    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(queryMock.mock.calls[0]?.[0]).toMatchObject({
      interval: "1d",
      fidelity: 1,
    });
    expect(queryMock.mock.calls[1]?.[0]).toMatchObject({
      interval: "1d",
      fidelity: 5,
    });
  });

  it("returns [] only after exhausting the fidelity ladder when all responses are empty", async () => {
    queryMock.mockResolvedValue([]);

    const result = await fetchPricesHistoryWithLadder({
      market: "token-id",
      interval: "1m",
    });

    expect(result).toEqual([]);
    // 1m (month) preset: CLOB min fidelity 10 → ladder [10, 60, 360, 1440]
    expect(queryMock).toHaveBeenCalledTimes(4);
    expect(queryMock.mock.calls[0]?.[0]).toMatchObject({
      interval: "1m",
      fidelity: 10,
    });
  });

  it("returns first non-empty response and does not call coarser fidelities", async () => {
    queryMock.mockResolvedValue([{ t: 100, p: 0.25 }]);

    const result = await fetchPricesHistoryWithLadder({
      market: "token-id",
      interval: "1h",
    });

    expect(result).toEqual([{ t: 100, p: 0.25 }]);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]?.[0]).toMatchObject({
      interval: "1h",
      fidelity: 1,
    });
  });

  it("tries coarsest fidelity first for interval max (full history, not a short recent slice)", async () => {
    queryMock.mockResolvedValue([{ t: 1_700_000_000, p: 0.5 }]);

    const result = await fetchPricesHistoryWithLadder({
      market: "token-id",
      interval: "max",
    });

    expect(result).toEqual([{ t: 1_700_000_000, p: 0.5 }]);
    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(queryMock.mock.calls[0]?.[0]).toMatchObject({
      interval: "max",
      fidelity: 1440,
    });
  });
});

describe("normalizePriceHistoryPoints", () => {
  it("converts millisecond timestamps to unix seconds", () => {
    const ms = 1_700_000_000_000;
    expect(normalizePriceHistoryPoints([{ t: ms, p: 0.5 }])).toEqual([
      { t: 1_700_000_000, p: 0.5 },
    ]);
  });
});
