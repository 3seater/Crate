import { describe, expect, it } from "vitest";
import { sellableSharesAtTick } from "../../apps/web/src/lib/trading/trading-utils";

describe("sellableSharesAtTick", () => {
  it("floors chain balance to size tick so display matches max sell (1.279999 → 1.27 @ 0.01)", () => {
    expect(sellableSharesAtTick(1.279_999, 0.01)).toBeCloseTo(1.27, 8);
  });

  it("respects 0.001 tick", () => {
    expect(sellableSharesAtTick(1.279_999, 0.001)).toBeCloseTo(1.279, 8);
  });

  it("returns 0 for non-positive balance", () => {
    expect(sellableSharesAtTick(0, 0.01)).toBe(0);
    expect(sellableSharesAtTick(-1, 0.01)).toBe(0);
  });

  it("uses default tick when sizeTick is invalid", () => {
    expect(sellableSharesAtTick(1.279_999, Number.NaN)).toBeCloseTo(1.27, 8);
    expect(sellableSharesAtTick(1.279_999, 0)).toBeCloseTo(1.27, 8);
  });
});
