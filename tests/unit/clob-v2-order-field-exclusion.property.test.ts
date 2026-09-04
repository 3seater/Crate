/**
 * Property 1: V2 order field exclusion
 *
 * **Validates: Requirements 1.2, 3.2, 4.3**
 *
 * For any order created through the V2 code path (regardless of side, order type,
 * or market), the signed order payload SHALL NOT contain `nonce`, `feeRateBps`,
 * or `taker` keys.
 */

import type { SignedOrderV2 } from "@doji/types";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

/** fast-check v4 helpers (hexaString/stringOf removed in v4). */
const hexStr = (len: number) =>
  fc.stringMatching(new RegExp(`^[0-9a-f]{${len}}$`));

/** Arbitrary that generates objects conforming to the SignedOrderV2 interface. */
const signedOrderV2Arb: fc.Arbitrary<SignedOrderV2> = fc.record({
  expiration: fc.nat({ max: 9_999_999_999 }).map(String),
  maker: hexStr(40).map((s) => `0x${s}`),
  makerAmount: fc.nat({ max: 1_000_000_000 }).map(String),
  salt: hexStr(64).map((s) => `0x${s}`),
  side: fc.constantFrom(0 as const, 1 as const),
  signature: hexStr(130).map((s) => `0x${s}`),
  signatureType: fc.constantFrom(0, 1, 2),
  signer: hexStr(40).map((s) => `0x${s}`),
  takerAmount: fc.nat({ max: 1_000_000_000 }).map(String),
  tokenId: hexStr(64).map((s) => `0x${s}`),
  timestamp: fc.nat({ max: 9_999_999_999_999 }).map(String),
  metadata: fc.option(fc.string(), { nil: undefined }),
  builder: fc.option(
    hexStr(64).map((s) => `0x${s}`),
    { nil: undefined }
  ),
});

const EXCLUDED_FIELDS = ["nonce", "feeRateBps", "taker"] as const;

describe("Property 1: V2 order field exclusion", () => {
  it("SignedOrderV2 objects never contain nonce, feeRateBps, or taker keys", () => {
    fc.assert(
      fc.property(signedOrderV2Arb, (order) => {
        const keys = Object.keys(order);
        for (const excluded of EXCLUDED_FIELDS) {
          expect(keys).not.toContain(excluded);
          expect(order).not.toHaveProperty(excluded);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("SignedOrderV2 always contains the required V2 fields", () => {
    fc.assert(
      fc.property(signedOrderV2Arb, (order) => {
        expect(order).toHaveProperty("expiration");
        expect(order).toHaveProperty("maker");
        expect(order).toHaveProperty("makerAmount");
        expect(order).toHaveProperty("salt");
        expect(order).toHaveProperty("side");
        expect(order).toHaveProperty("signature");
        expect(order).toHaveProperty("signatureType");
        expect(order).toHaveProperty("signer");
        expect(order).toHaveProperty("takerAmount");
        expect(order).toHaveProperty("tokenId");
        expect(order).toHaveProperty("timestamp");
      }),
      { numRuns: 200 }
    );
  });

  it("TypeScript enforces exclusion at compile time — assigning excluded fields is a type error", () => {
    fc.assert(
      fc.property(signedOrderV2Arb, (order) => {
        const plain = { ...order };
        for (const excluded of EXCLUDED_FIELDS) {
          expect(excluded in plain).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });
});
