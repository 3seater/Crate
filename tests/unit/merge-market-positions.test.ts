import { describe, expect, it } from "vitest";
import { mergeMarketPositionsForCondition } from "@/features/trading/lib/merge-market-positions";
import type { LocalPosition } from "@/features/trading/stores/positions";

describe("mergeMarketPositionsForCondition", () => {
  const conditionId = "0xabc";

  it("returns one row when API has a position for the condition", () => {
    const merged = mergeMarketPositionsForCondition({
      user: "0xuser",
      conditionId,
      scopedPositions: [
        {
          asset: "tok1",
          conditionId,
          size: 10,
          avgPrice: 0.5,
        },
      ],
      localPositions: [],
      onChainBalances: undefined,
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.asset).toBe("tok1");
  });

  it("adds a synthetic row from local WebSocket state when API has not indexed the asset", () => {
    const local: LocalPosition[] = [
      {
        asset: "tok-new",
        conditionId,
        size: 5,
        curPrice: 0.55,
        outcome: "Yes",
      },
    ];
    const merged = mergeMarketPositionsForCondition({
      user: "0xuser",
      conditionId,
      scopedPositions: [],
      localPositions: local,
      onChainBalances: { "tok-new": 5 },
    });
    expect(merged.some((p) => p.asset === "tok-new")).toBe(true);
  });

  it("adds synthetic Yes/No rows from chain when Data API has not indexed split yet", () => {
    const merged = mergeMarketPositionsForCondition({
      user: "0xuser",
      conditionId,
      scopedPositions: [],
      localPositions: [],
      onChainBalances: { tYes: 10, tNo: 10 },
      yesNoTokenIds: { yes: "tYes", no: "tNo" },
      outcomeLabels: { yes: "Yes", no: "No" },
      outcomePriceHint: { yes: 0.4, no: 0.6 },
    });
    expect(merged).toHaveLength(2);
    expect(merged.find((p) => p.asset === "tYes")?.avgPrice).toBe(0.5);
    expect(merged.find((p) => p.asset === "tYes")?.curPrice).toBe(0.4);
    expect(merged.find((p) => p.asset === "tNo")?.avgPrice).toBe(0.5);
    expect(merged.find((p) => p.asset === "tNo")?.curPrice).toBe(0.6);
  });

  it("overlays outcomePriceHint on API rows for Yes/No tokens (live mark for PnL/value)", () => {
    const merged = mergeMarketPositionsForCondition({
      user: "0xuser",
      conditionId,
      scopedPositions: [
        {
          asset: "tYes",
          conditionId,
          size: 10,
          avgPrice: 0.4,
          curPrice: 0.25,
        },
      ],
      localPositions: [],
      onChainBalances: undefined,
      yesNoTokenIds: { yes: "tYes", no: "tNo" },
      outcomeLabels: { yes: "Yes", no: "No" },
      outcomePriceHint: { yes: 0.62, no: 0.38 },
    });
    expect(merged).toHaveLength(1);
    expect(merged[0]?.curPrice).toBe(0.62);
  });

  it("prefers outcomeBidHint over outcomePriceHint when both set (Instant Trade / Positions sync)", () => {
    const merged = mergeMarketPositionsForCondition({
      user: "0xuser",
      conditionId,
      scopedPositions: [
        {
          asset: "tYes",
          conditionId,
          size: 10,
          avgPrice: 0.4,
          curPrice: 0.9,
        },
      ],
      localPositions: [],
      onChainBalances: undefined,
      yesNoTokenIds: { yes: "tYes", no: "tNo" },
      outcomeLabels: { yes: "Yes", no: "No" },
      outcomeBidHint: { yes: 0.55, no: 0.44 },
      outcomePriceHint: { yes: 0.62, no: 0.38 },
    });
    expect(merged[0]?.curPrice).toBe(0.55);
  });

  it("uses avgCost for Bought basis when last trade was a SELL (curPrice is exit mark)", () => {
    const local: LocalPosition[] = [
      {
        asset: "tok-up",
        conditionId,
        size: 2,
        curPrice: 0.94,
        avgCost: 0.67,
        outcome: "Up",
      },
    ];
    const merged = mergeMarketPositionsForCondition({
      user: "0xuser",
      conditionId,
      scopedPositions: [],
      localPositions: local,
      onChainBalances: { "tok-up": 2 },
    });
    const row = merged.find((p) => p.asset === "tok-up");
    expect(row?.avgPrice).toBe(0.67);
    expect(row?.curPrice).toBe(0.94);
  });
});
