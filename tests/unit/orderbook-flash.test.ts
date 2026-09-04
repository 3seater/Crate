import { describe, expect, it } from "vitest";
import {
  applyFlashCooldown,
  clobSideToRowSide,
  dedupePriceChangeFlashKeys,
  getOrderbookRowFlashKey,
  ORDERBOOK_FLASH_COOLDOWN_MS,
} from "@/features/trading/lib/orderbook-flash-logic";

describe("getOrderbookRowFlashKey", () => {
  it("uses bid or ask prefix with price string", () => {
    expect(getOrderbookRowFlashKey("bid", "0.45")).toBe("bid:0.45");
    expect(getOrderbookRowFlashKey("ask", "0.55")).toBe("ask:0.55");
  });
});

describe("clobSideToRowSide", () => {
  it("maps BUY to bid and SELL to ask", () => {
    expect(clobSideToRowSide("BUY")).toBe("bid");
    expect(clobSideToRowSide("SELL")).toBe("ask");
  });
});

describe("dedupePriceChangeFlashKeys", () => {
  it("dedupes same level in one batch", () => {
    expect(
      dedupePriceChangeFlashKeys([
        { price: "0.5", side: "BUY" },
        { price: "0.5", side: "BUY" },
        { price: "0.5", side: "SELL" },
      ]).sort()
    ).toEqual(["ask:0.5", "bid:0.5"].sort());
  });
});

describe("applyFlashCooldown", () => {
  const cd = ORDERBOOK_FLASH_COOLDOWN_MS;

  it("pulses every key when no prior pulse", () => {
    const { keysToPulse, nextLastPulseAt } = applyFlashCooldown(
      ["bid:0.5", "ask:0.6"],
      1000,
      {},
      cd
    );
    expect(keysToPulse.sort()).toEqual(["ask:0.6", "bid:0.5"].sort());
    expect(nextLastPulseAt["bid:0.5"]).toBe(1000);
    expect(nextLastPulseAt["ask:0.6"]).toBe(1000);
  });

  it("skips key inside cooldown window", () => {
    const last = { "bid:0.5": 1000 };
    const { keysToPulse, nextLastPulseAt } = applyFlashCooldown(
      ["bid:0.5"],
      1000 + cd - 1,
      last,
      cd
    );
    expect(keysToPulse).toEqual([]);
    expect(nextLastPulseAt["bid:0.5"]).toBe(1000);
  });

  it("allows same key after cooldown", () => {
    const last = { "bid:0.5": 1000 };
    const { keysToPulse, nextLastPulseAt } = applyFlashCooldown(
      ["bid:0.5"],
      1000 + cd,
      last,
      cd
    );
    expect(keysToPulse).toEqual(["bid:0.5"]);
    expect(nextLastPulseAt["bid:0.5"]).toBe(1000 + cd);
  });
});
