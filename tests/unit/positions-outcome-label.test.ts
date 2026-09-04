/**
 * Position outcome labeling: token id → display name for single-market moneylines
 * and WebSocket local position rows.
 */

import type { UserTradeEvent } from "@doji/types";
import { describe, expect, it } from "vitest";
import { getOutcomeLabelForPosition } from "@/features/trading/lib/trading-utils";
import {
  applyTradeToPositions,
  type LocalPosition,
} from "@/features/trading/stores/positions";

function tradeEvent(partial: Partial<UserTradeEvent>): UserTradeEvent {
  return {
    event_type: "trade",
    type: "TRADE",
    id: partial.id ?? "t1",
    asset_id: partial.asset_id ?? "",
    market: partial.market ?? "0xcond",
    side: partial.side ?? "BUY",
    size: partial.size ?? "1",
    price: partial.price ?? "0.5",
    status: partial.status ?? "MATCHED",
    taker_order_id: partial.taker_order_id ?? "o1",
    last_update: partial.last_update ?? "",
    outcome: partial.outcome ?? "",
    owner: partial.owner ?? "",
    trade_owner: partial.trade_owner ?? "",
    timestamp: partial.timestamp ?? "",
    maker_orders: partial.maker_orders ?? [],
  };
}

describe("getOutcomeLabelForPosition", () => {
  const vcuId = "111";
  const uncId = "222";

  const moneylineMarket = {
    question: "VCU vs UNC",
    tokens: [
      { token_id: vcuId, outcome: "VCU Rams" },
      { token_id: uncId, outcome: "North Carolina" },
    ],
    clobTokenIds: [vcuId, uncId],
  };

  it("returns the second team's label when asset is tokens[1] (moneyline)", () => {
    expect(
      getOutcomeLabelForPosition({ asset: uncId, outcome: "" }, [
        moneylineMarket,
      ])
    ).toBe("North Carolina");
  });

  it("returns the first team's label when asset is tokens[0]", () => {
    expect(
      getOutcomeLabelForPosition({ asset: vcuId, outcome: "" }, [
        moneylineMarket,
      ])
    ).toBe("VCU Rams");
  });

  it("resolves via clobTokenIds index when tokens lack outcome", () => {
    expect(
      getOutcomeLabelForPosition({ asset: uncId, outcome: "" }, [
        {
          clobTokenIds: [vcuId, uncId],
          outcomes: ["VCU Rams", "North Carolina"],
          tokens: [{ token_id: vcuId }, { token_id: uncId }],
        },
      ])
    ).toBe("North Carolina");
  });

  it("falls back to position.outcome when asset does not match", () => {
    expect(
      getOutcomeLabelForPosition(
        { asset: "unknown", outcome: "Backup label" },
        [moneylineMarket]
      )
    ).toBe("Backup label");
  });
});

describe("applyTradeToPositions", () => {
  it("sets outcome from WebSocket event for new local rows", () => {
    const ev = tradeEvent({
      asset_id: "tok-unc",
      outcome: "North Carolina",
      size: "10",
    });
    const next = applyTradeToPositions([], ev);
    expect(next).toHaveLength(1);
    expect(next[0]?.outcome).toBe("North Carolina");
    expect(next[0]?.asset).toBe("tok-unc");
  });

  it("fills empty outcome on merge when event carries outcome", () => {
    const existing: LocalPosition[] = [
      {
        asset: "tok-unc",
        conditionId: "0xcond",
        size: 5,
        curPrice: 0.4,
        outcome: "",
      },
    ];
    const ev = tradeEvent({
      asset_id: "tok-unc",
      outcome: "North Carolina",
      size: "5",
      side: "BUY",
    });
    const next = applyTradeToPositions(existing, ev);
    expect(next[0]?.size).toBe(10);
    expect(next[0]?.outcome).toBe("North Carolina");
  });
});
