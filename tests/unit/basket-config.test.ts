import type { BasketConfig } from "@doji/types";
import { describe, expect, it } from "vitest";
import { BASKETS, validateBaskets } from "../../apps/web/src/config/baskets";

// Top-level regex constants (Biome useTopLevelRegex)
const RE_TOO_HEAVY = /too-heavy/;
const RE_TOO_LIGHT = /too-light/;
const RE_VALID_BASKET = /valid-basket/;

// Minimal helper to build a BasketConfig with arbitrary weights
function makeBasket(id: string, weights: number[]): BasketConfig {
  return {
    id,
    name: id,
    description: "",
    constituents: weights.map((weight, i) => ({
      symbol: `T${i}`,
      name: `Token ${i}`,
      address: `0x${"0".repeat(39)}${i}`,
      poolAddress: `0x${"1".repeat(39)}${i}`,
      weight,
    })),
  };
}

describe("validateBaskets()", () => {
  it("should return baskets unchanged when weights sum exactly to 1.0", () => {
    const basket = makeBasket("exact", [0.5, 0.3, 0.2]);
    const result = validateBaskets([basket]);
    expect(result).toEqual([basket]);
  });

  it("should pass when weight sum is slightly above 1.0 but within tolerance (sum ≈ 1.0009)", () => {
    // |1.0009 - 1.0| = 0.0009 < WEIGHT_TOLERANCE (0.001) → should pass
    const basket = makeBasket("upper-within-tolerance", [0.5, 0.5009]);
    expect(() => validateBaskets([basket])).not.toThrow();
  });

  it("should pass when weight sum is slightly below 1.0 but within tolerance (sum ≈ 0.9991)", () => {
    // |0.9991 - 1.0| = 0.0009 < WEIGHT_TOLERANCE (0.001) → should pass
    const basket = makeBasket("lower-within-tolerance", [0.5, 0.4991]);
    expect(() => validateBaskets([basket])).not.toThrow();
  });

  it("should throw when weight sum exceeds tolerance (sum = 1.002)", () => {
    const basket = makeBasket("too-heavy", [0.5, 0.502]);
    expect(() => validateBaskets([basket])).toThrow(RE_TOO_HEAVY);
  });

  it("should throw when weight sum is below tolerance (sum = 0.998)", () => {
    const basket = makeBasket("too-light", [0.5, 0.498]);
    expect(() => validateBaskets([basket])).toThrow(RE_TOO_LIGHT);
  });

  it("should throw with the basket id in the error message", () => {
    const basket = makeBasket("my-unique-basket-id", [0.4, 0.4]);
    expect(() => validateBaskets([basket])).toThrow("my-unique-basket-id");
  });

  it("should identify the invalid basket when only the second basket is invalid", () => {
    const valid = makeBasket("valid-basket", [0.6, 0.4]);
    const invalid = makeBasket("bad-second-basket", [0.6, 0.6]);
    expect(() => validateBaskets([valid, invalid])).toThrow(
      "bad-second-basket"
    );
    // The first basket is fine — error must reference the second one
    expect(() => validateBaskets([valid, invalid])).not.toThrow(
      RE_VALID_BASKET
    );
  });

  it("should export a non-empty BASKETS array (module loads correctly)", () => {
    expect(Array.isArray(BASKETS)).toBe(true);
    expect(BASKETS.length).toBeGreaterThan(0);
  });
});
