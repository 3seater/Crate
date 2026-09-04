/**
 * Unit tests for utils/format.ts and lib/trading-utils (formatPnl).
 */
import { describe, expect, it } from "vitest";
import { formatPnl } from "../../apps/web/src/lib/trading/trading-utils";
import {
  formatCompactNumber,
  formatUsdCompact,
  formatVolumeLike,
} from "../../apps/web/src/utils/format";

describe("formatCompactNumber", () => {
  it("formats values >= 100 with 0 decimals", () => {
    expect(formatCompactNumber(100)).toBe("100");
    expect(formatCompactNumber(123.45)).toBe("123");
  });

  it("formats values 10-99 with 1 decimal", () => {
    expect(formatCompactNumber(10)).toBe("10.0");
    expect(formatCompactNumber(12.34)).toBe("12.3");
  });

  it("formats values < 10 with 2 decimals", () => {
    expect(formatCompactNumber(1)).toBe("1.00");
    expect(formatCompactNumber(1.234)).toBe("1.23");
  });
});

describe("formatUsdCompact", () => {
  it("formats zero with default $0", () => {
    expect(formatUsdCompact(0)).toBe("$0");
  });

  it("formats zero with custom zeroDisplay", () => {
    expect(formatUsdCompact(0, { zeroDisplay: "$0.00" })).toBe("$0.00");
  });

  it("formats millions with compact notation", () => {
    expect(formatUsdCompact(1_234_567)).toBe("$1.23M");
    expect(formatUsdCompact(10_000_000)).toBe("$10.0M");
  });

  it("formats thousands with compact notation", () => {
    expect(formatUsdCompact(1234)).toBe("$1.23K");
    expect(formatUsdCompact(50_000)).toBe("$50.0K");
  });

  it("formats small values with 2 decimals", () => {
    expect(formatUsdCompact(123.45)).toBe("$123.45");
    expect(formatUsdCompact(0.99)).toBe("$0.99");
  });

  it("handles negative values", () => {
    expect(formatUsdCompact(-1_500_000)).toBe("-$1.50M");
    expect(formatUsdCompact(-500)).toBe("-$500.00");
  });

  it("uses full Intl format when compact is false", () => {
    expect(formatUsdCompact(1_234_567, { compact: false })).toBe(
      "$1,234,567.00"
    );
    expect(formatUsdCompact(500, { compact: false })).toBe("$500.00");
  });
});

describe("formatVolumeLike", () => {
  it("formats millions with M suffix", () => {
    expect(formatVolumeLike(1_500_000)).toBe("1.5M");
    expect(formatVolumeLike(1_000_000)).toBe("1.0M");
  });

  it("formats thousands with K suffix", () => {
    expect(formatVolumeLike(1500)).toBe("1.5K");
    expect(formatVolumeLike(1000)).toBe("1.0K");
  });

  it("formats small values with default 0 decimals", () => {
    expect(formatVolumeLike(100)).toBe("100");
    expect(formatVolumeLike(1.5)).toBe("2");
  });

  it("formats small values with 1 decimal when specified", () => {
    expect(formatVolumeLike(100, 1)).toBe("100.0");
    expect(formatVolumeLike(1.5, 1)).toBe("1.5");
  });

  it("formats small values with 2 decimals when specified", () => {
    expect(formatVolumeLike(1.23, 2)).toBe("1.23");
  });
});

describe("formatPnl", () => {
  it("formats positive PnL with + and text-buy", () => {
    const result = formatPnl(123.45);
    expect(result.text).toBe("+$123.45");
    expect(result.className).toBe("text-buy");
  });

  it("formats negative PnL with - and text-sell", () => {
    const result = formatPnl(-50.25);
    expect(result.text).toBe("-$50.25");
    expect(result.className).toBe("text-sell");
  });

  it("formats zero PnL with text-text-secondary", () => {
    const result = formatPnl(0);
    expect(result.text).toBe("$0");
    expect(result.className).toBe("text-text-secondary");
  });

  it("uses compact notation by default for large values", () => {
    const result = formatPnl(1_500_000);
    expect(result.text).toBe("+$1.50M");
  });

  it("uses full format when compact is false", () => {
    const result = formatPnl(1_234_567, { compact: false });
    expect(result.text).toBe("+$1,234,567.00");
  });
});
