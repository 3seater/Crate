/**
 * Property 5: Builder code format validation
 *
 * **Validates: Requirements 3.5, 5.5, 6.1**
 *
 * For any string value used as a builder code, only strings matching
 * the bytes32 hex pattern SHALL be accepted. All other strings SHALL be
 * rejected with a descriptive validation error.
 */

import { isValidBuilderCode } from "@doji/types";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

/** Generates a valid builder code: "0x" + exactly 64 hex characters. */
const validBuilderCodeArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[0-9a-f]{64}$/)
  .map((hex) => `0x${hex}`);

const BYTES32_HEX_REGEX = /^0x[a-fA-F0-9]{64}$/;

const HEX64_REGEX = /^[0-9a-f]{64}$/;
const HEX_PLUS_REGEX = /^[0-9a-f]+$/;
const NON_HEX_REGEX = /^[g-zG-Z!@#$%^& _-]{1,10}$/;

describe("Property 5: Builder code format validation", () => {
  it("valid builder codes (0x + 64 hex chars) always pass", () => {
    fc.assert(
      fc.property(validBuilderCodeArb, (code) => {
        expect(isValidBuilderCode(code)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("arbitrary strings pass only if they match the bytes32 hex pattern", () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(isValidBuilderCode(s)).toBe(BYTES32_HEX_REGEX.test(s));
      }),
      { numRuns: 500 }
    );
  });

  it("wrong prefix (missing 0x) is rejected", () => {
    const noPrefixArb = fc.stringMatching(HEX64_REGEX);
    fc.assert(
      fc.property(noPrefixArb, (code) => {
        expect(isValidBuilderCode(code)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("wrong length (not 64 hex chars after 0x) is rejected", () => {
    const wrongLengthArb = fc
      .stringMatching(HEX_PLUS_REGEX)
      .filter((hex) => hex.length > 0 && hex.length !== 64)
      .map((hex) => `0x${hex}`);
    fc.assert(
      fc.property(wrongLengthArb, (code) => {
        expect(isValidBuilderCode(code)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("non-hex characters after 0x prefix are rejected", () => {
    const nonHexArb = fc
      .stringMatching(NON_HEX_REGEX)
      .map(
        (nonHex) => `0x${nonHex}${"0".repeat(Math.max(0, 64 - nonHex.length))}`
      );
    fc.assert(
      fc.property(nonHexArb, (code) => {
        expect(isValidBuilderCode(code)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});
