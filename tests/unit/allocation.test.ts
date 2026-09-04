import type { BasketConstituent } from "@doji/types";
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { computeAllocation } from "../../apps/web/src/domains/baskets/lib/allocation";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/**
 * Generates a non-empty array of BasketConstituents whose weights sum to
 * exactly 1.0. Raw floats are sampled then normalized so the invariant
 * holds for all generated inputs.
 */
const basketConstituentsArb = fc
  .array(
    fc.float({ min: Math.fround(0.01), max: Math.fround(1), noNaN: true }),
    { minLength: 1, maxLength: 8 }
  )
  .map((weights) => {
    const total = weights.reduce((a, b) => a + b, 0);
    const normalized = weights.map((w) => w / total);
    return normalized.map(
      (weight, i): BasketConstituent => ({
        symbol: `TKN${i}`,
        name: `Token ${i}`,
        address: `0x${"a".repeat(39)}${i}` as `0x${string}`,
        poolAddress: `0x${"b".repeat(39)}${i}` as `0x${string}`,
        weight,
      })
    );
  });

// ---------------------------------------------------------------------------
// Property test
// ---------------------------------------------------------------------------

describe("computeAllocation", () => {
  /**
   * **Validates: Requirements 8.3, 8.4**
   *
   * Property 3: For any valid basket (weights summing to 1.0) and any
   * positive ETH amount, the sum of all `ethAmount` values in the returned
   * AllocationLine[] must equal `amountEth` within floating-point tolerance
   * (relative error < 1e-10).
   */
  it("Property 3: sum of all ethAmount values equals amountEth within floating-point tolerance", () => {
    fc.assert(
      fc.property(
        basketConstituentsArb,
        fc.float({
          min: Math.fround(1e-4),
          max: Math.fround(1000),
          noNaN: true,
        }),
        (constituents, amountEth) => {
          const lines = computeAllocation(constituents, amountEth, {});
          const ethSum = lines.reduce((sum, l) => sum + l.ethAmount, 0);
          const tolerance = Math.abs(amountEth) * 1e-10;
          expect(Math.abs(ethSum - amountEth)).toBeLessThan(tolerance + 1e-15);
        }
      ),
      { numRuns: 500 }
    );
  });

  // -------------------------------------------------------------------------
  // Concrete unit tests
  // -------------------------------------------------------------------------

  it("equal-weight basket: each ethAmount equals amountEth / n", () => {
    const n = 4;
    const weight = 1 / n;
    const constituents: BasketConstituent[] = Array.from(
      { length: n },
      (_, i) => ({
        symbol: `T${i}`,
        name: `Token ${i}`,
        address: `0x${"0".repeat(39)}${i}` as `0x${string}`,
        poolAddress: `0x${"1".repeat(39)}${i}` as `0x${string}`,
        weight,
      })
    );

    const amountEth = 2;
    const lines = computeAllocation(constituents, amountEth, {});

    expect(lines).toHaveLength(n);
    for (const line of lines) {
      expect(line.ethAmount).toBeCloseTo(amountEth / n, 12);
    }
  });

  it("with price map: usdAmount is populated and tokenAmount is derived", () => {
    const constituents: BasketConstituent[] = [
      {
        symbol: "WETH",
        name: "Wrapped Ether",
        address: "0xWETH" as `0x${string}`,
        poolAddress: "0xPOOL_WETH" as `0x${string}`,
        weight: 0.6,
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        address: "0xUSDC" as `0x${string}`,
        poolAddress: "0xPOOL_USDC" as `0x${string}`,
        weight: 0.4,
      },
    ];

    const amountEth = 1;
    const ethPriceUsd = 3000;
    const priceMap = {
      "0xPOOL_WETH": { priceUsd: 3000 },
      "0xPOOL_USDC": { priceUsd: 1 },
    };

    const lines = computeAllocation(
      constituents,
      amountEth,
      priceMap,
      ethPriceUsd
    );

    // WETH line: ethAmount=0.6, usdAmount=1800, tokenAmount=1800/3000=0.6
    expect(lines[0].ethAmount).toBeCloseTo(0.6);
    expect(lines[0].usdAmount).toBeCloseTo(1800);
    expect(lines[0].tokenAmount).toBeCloseTo(0.6);

    // USDC line: ethAmount=0.4, usdAmount=1200, tokenAmount=1200/1=1200
    expect(lines[1].ethAmount).toBeCloseTo(0.4);
    expect(lines[1].usdAmount).toBeCloseTo(1200);
    expect(lines[1].tokenAmount).toBeCloseTo(1200);
  });

  it("missing price: tokenAmount and usdAmount are null when ethPriceUsd is absent", () => {
    const constituents: BasketConstituent[] = [
      {
        symbol: "ABC",
        name: "ABC Token",
        address: "0xABC" as `0x${string}`,
        poolAddress: "0xPOOL_ABC" as `0x${string}`,
        weight: 1,
      },
    ];

    const amountEth = 0.5;
    // No ethPriceUsd → usdAmount null → tokenAmount null even with a price entry
    const lines = computeAllocation(constituents, amountEth, {
      "0xPOOL_ABC": { priceUsd: 100 },
    });

    expect(lines[0].ethAmount).toBeCloseTo(0.5);
    expect(lines[0].usdAmount).toBeNull();
    expect(lines[0].tokenAmount).toBeNull();
  });
});
