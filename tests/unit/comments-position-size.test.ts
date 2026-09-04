/**
 * Position Size Formatting Tests
 *
 * The Gamma API returns positionSize in micro-units (6 decimals).
 * formatPositionSize divides by 10^6 first, then applies compact notation.
 *
 * Examples from Polymarket:
 * - "Another-Mama" has 171 shares → API returns "171000000" → displays "171"
 * - "DanielAriel" has 1.3K shares → API returns "1307200000" → displays "1.3K"
 * - Someone with 10K shares → API returns "10000000000" → displays "10K"
 */

import { describe, expect, it } from "vitest";

import { formatPositionSize } from "../../apps/web/src/domains/trading/components/market/comments-utils";

describe("formatPositionSize — micro-unit conversion + compact formatting", () => {
  it("formats 171000000 (171 shares) as '171'", () => {
    expect(formatPositionSize(171_000_000)).toBe("171");
  });

  it("formats 1307200000 (~1.3K shares) as '1.3K'", () => {
    expect(formatPositionSize(1_307_200_000)).toBe("1.3K");
  });

  it("formats 10000000000 (10K shares) as '10K'", () => {
    expect(formatPositionSize(10_000_000_000)).toBe("10K");
  });

  it("formats 354821000000 (~354.8K shares) as '354.8K'", () => {
    expect(formatPositionSize(354_821_000_000)).toBe("354.8K");
  });

  it("formats 56000000 (56 shares) as '56'", () => {
    expect(formatPositionSize(56_000_000)).toBe("56");
  });

  it("formats 2500000000000 (2.5M shares) as '2.5M'", () => {
    expect(formatPositionSize(2_500_000_000_000)).toBe("2.5M");
  });

  it("formats 999000000 (999 shares) as '999'", () => {
    expect(formatPositionSize(999_000_000)).toBe("999");
  });

  it("formats 1000000000 (1K shares) as '1K'", () => {
    expect(formatPositionSize(1_000_000_000)).toBe("1K");
  });

  it("formats 500000 (0.5 shares) as '0.5'", () => {
    expect(formatPositionSize(500_000)).toBe("0.5");
  });

  it("formats 0 as '0'", () => {
    expect(formatPositionSize(0)).toBe("0");
  });
});
