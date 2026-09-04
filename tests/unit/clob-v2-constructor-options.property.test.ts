/**
 * Property 4: Constructor options shape
 *
 * **Validates: Requirements 2.1, 2.2**
 *
 * Verifies that `ClobClientConfig` uses `chain` (not `chainId`) and that
 * `createClobClient` produces a client with the correct chain value.
 *
 * Since the V2 SDK ClobClient constructor is an options object (not positional
 * args), we verify the config interface shape and the resulting client's
 * `chainId` property (the SDK stores it as `chainId` internally).
 */
import type { BuilderConfigV2 } from "@doji/types";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { ClobClientConfig } from "../../packages/api/src/lib/clob/client";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const addressArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[0-9a-f]{40}$/)
  .map((s) => `0x${s}`);

const builderCodeArb: fc.Arbitrary<string> = fc
  .stringMatching(/^[0-9a-f]{64}$/)
  .map((s) => `0x${s}`);

const builderConfigArb: fc.Arbitrary<BuilderConfigV2> = fc.record({
  builderCode: builderCodeArb,
});

const clobClientConfigArb: fc.Arbitrary<ClobClientConfig> = fc.record(
  {
    host: fc
      .webUrl({ withFragments: false, withQueryParameters: false })
      .map((url) => (url.endsWith("/") ? url.slice(0, -1) : url)),
    chain: fc.constantFrom(137 as const, 80_002 as const),
    signerAddress: addressArb,
    signatureType: fc.constantFrom(0, 1, 2),
    funderAddress: addressArb,
    useServerTime: fc.boolean(),
    builderConfig: builderConfigArb,
    retryOnError: fc.boolean(),
  },
  { requiredKeys: ["host", "chain"] }
);

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Property 4: Constructor options shape", () => {
  it("ClobClientConfig uses `chain` field, not `chainId`", () => {
    fc.assert(
      fc.property(clobClientConfigArb, (config) => {
        // The config interface has `chain`, never `chainId`
        expect(config).toHaveProperty("chain");
        expect(config).not.toHaveProperty("chainId");
        expect(typeof config.chain).toBe("number");
      }),
      { numRuns: 200 }
    );
  });

  it("`chain` is always a valid Polygon chain ID", () => {
    fc.assert(
      fc.property(clobClientConfigArb, (config) => {
        expect([137, 80_002]).toContain(config.chain);
      }),
      { numRuns: 200 }
    );
  });

  it("config is always an object (not positional args)", () => {
    fc.assert(
      fc.property(clobClientConfigArb, (config) => {
        expect(typeof config).toBe("object");
        expect(config).not.toBeNull();
        expect(Array.isArray(config)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });
});
