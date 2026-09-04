/**
 * Bug condition exploration tests for Trading Experience Audit.
 *
 * These tests are EXPECTED TO FAIL on unfixed code — failure confirms the bugs exist.
 *
 * Bug 1: tradeRecordFromEvent ignores effectiveSide parameter (wrong side for resting limit fills)
 * Bug 2: usePortfolioData does not subscribe to usePositionsStore (stale badge count)
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { UserTradeEvent } from "@doji/types";
import { describe, expect, it } from "vitest";
import { tradeRecordFromEvent } from "../../apps/web/src/stores/positions";

function makeTradeEvent(
  overrides: Partial<UserTradeEvent> = {}
): UserTradeEvent {
  return {
    event_type: "trade",
    type: "TRADE",
    id: overrides.id ?? "trade-1",
    asset_id: overrides.asset_id ?? "asset-abc",
    market: overrides.market ?? "0xcondition",
    side: overrides.side ?? "BUY",
    size: overrides.size ?? "10",
    price: overrides.price ?? "0.50",
    status: overrides.status ?? "MATCHED",
    taker_order_id: overrides.taker_order_id ?? "order-1",
    last_update: overrides.last_update ?? "",
    outcome: overrides.outcome ?? "Yes",
    owner: overrides.owner ?? "0xowner",
    trade_owner: overrides.trade_owner ?? "0xowner",
    timestamp: overrides.timestamp ?? "1700000000",
    maker_orders: overrides.maker_orders ?? [],
  };
}

describe("Bug 1: tradeRecordFromEvent wrong side", () => {
  it("should use effectiveSide BUY when event.side is SELL (resting limit BUY fill)", () => {
    // Resting limit BUY filled by taker SELL — event.side = "SELL", effectiveSide = "BUY"
    const event = makeTradeEvent({ side: "SELL" });
    const effectiveSide = "BUY" as const;

    // Call with the EXPECTED fixed signature: (event, effectiveSide)
    // On unfixed code, the second arg is ignored — record.side will be "SELL"
    const record = tradeRecordFromEvent(event, effectiveSide);

    expect(record.side).toBe("BUY");
  });

  it("should use effectiveSide SELL when event.side is BUY (resting limit SELL fill)", () => {
    // Resting limit SELL filled by taker BUY — event.side = "BUY", effectiveSide = "SELL"
    const event = makeTradeEvent({ side: "BUY" });
    const effectiveSide = "SELL" as const;

    const record = tradeRecordFromEvent(event, effectiveSide);

    expect(record.side).toBe("SELL");
  });
});

describe("Bug 2: usePortfolioData stale badge — no usePositionsStore subscription", () => {
  it("usePortfolioData source should import usePositionsStore", () => {
    // Read the source file to verify it imports usePositionsStore
    const sourcePath = resolve(
      import.meta.dirname,
      "../../apps/web/src/app/portfolio/use-portfolio-data.ts"
    );
    const source = readFileSync(sourcePath, "utf-8");

    // On unfixed code, usePortfolioData does NOT import usePositionsStore
    expect(source).toContain("usePositionsStore");
  });
});
