import { describe, expect, it } from "vitest";
import {
  getMarkToMarketUnrealizedPnlUsd,
  getPositionUnrealizedPnlDisplayUsd,
} from "../../apps/web/src/lib/trading/trading-utils";

describe("getMarkToMarketUnrealizedPnlUsd", () => {
  it("returns (cur - avg) * size for open positions", () => {
    expect(
      getMarkToMarketUnrealizedPnlUsd({
        size: 100,
        avgPrice: 0.4,
        curPrice: 0.5,
        redeemable: false,
      })
    ).toBeCloseTo(10, 10);
  });

  it("returns null when redeemable", () => {
    expect(
      getMarkToMarketUnrealizedPnlUsd({
        size: 100,
        avgPrice: 0.4,
        curPrice: 0.5,
        redeemable: true,
      })
    ).toBeNull();
  });
});

describe("getPositionUnrealizedPnlDisplayUsd", () => {
  it("prefers MTM when inputs are valid", () => {
    expect(
      getPositionUnrealizedPnlDisplayUsd({
        size: 10,
        avgPrice: 0.3,
        curPrice: 0.6,
        redeemable: false,
        cashPnl: 0,
        unrealizedPnl: 0,
      })
    ).toBe(3);
  });

  it("falls back to API when MTM not applicable", () => {
    expect(
      getPositionUnrealizedPnlDisplayUsd({
        size: 0,
        avgPrice: 0,
        curPrice: 0,
        redeemable: false,
        cashPnl: 1.5,
        unrealizedPnl: undefined,
      })
    ).toBe(1.5);
  });
});
