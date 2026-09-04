import { describe, expect, it } from "vitest";
import { formatPriceCents } from "../../apps/web/src/lib/trading/trading-utils";

describe("formatPriceCents", () => {
  it("rounds high-near-par VWAPs instead of flooring (99.88¢ → 99.9¢)", () => {
    expect(formatPriceCents(0.9988)).toBe("99.9¢");
  });

  it("keeps true lower averages (99.7¢)", () => {
    expect(formatPriceCents(0.997)).toBe("99.7¢");
  });

  it("shows 99.9¢ for 0.999", () => {
    expect(formatPriceCents(0.999)).toBe("99.9¢");
  });

  it("clamps sub-1 prices that round to 100¢ down to 99.9¢", () => {
    expect(formatPriceCents(0.9995)).toBe("99.9¢");
  });
});
