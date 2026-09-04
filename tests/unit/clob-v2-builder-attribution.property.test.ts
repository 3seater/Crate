/**
 * Property 3: Builder attribution consistency
 *
 * **Validates: Requirements 3.3, 5.1**
 *
 * For any order posted via a client created by `createUserClobClient` when
 * `POLY_BUILDER_CODE` is set, the `builderConfig` passed to the SDK SHALL be
 * `{ builderCode: env.POLY_BUILDER_CODE }`.
 */
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Capture constructor args ────────────────────────────────────────────────

const constructorCalls: unknown[][] = [];

vi.mock("@polymarket/clob-client-v2", () => {
  class MockClobClient {
    signer: unknown;
    creds: unknown;
    useServerTime: unknown;
    host: string;

    constructor(...args: unknown[]) {
      constructorCalls.push(args);
      const opts = args[0] as Record<string, unknown> | undefined;
      this.host = (opts?.host as string) ?? "";
      this.signer = opts?.signer;
      this.creds = opts?.creds;
      this.useServerTime = opts?.useServerTime;
    }

    get(_url: string, _opts?: unknown) {
      return Promise.resolve({});
    }
    post(_url: string, _opts?: unknown) {
      return Promise.resolve({});
    }
    getServerTime() {
      return Promise.resolve(String(Date.now()));
    }
  }

  return {
    ClobClient: MockClobClient,
    createL2Headers: vi.fn().mockResolvedValue({}),
    OrderType: { GTC: "GTC", FOK: "FOK", GTD: "GTD", FAK: "FAK" },
    Side: { BUY: "BUY", SELL: "SELL" },
  };
});

// ─── Mock env ────────────────────────────────────────────────────────────────

const TEST_BUILDER_CODE =
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const TEST_ENCRYPTION_KEY = "a".repeat(64);

vi.mock("@doji/env/server", () => ({
  env: {
    CLOB_API_URL: "https://clob.polymarket.com",
    CHAIN_ID: 137,
    CREDENTIAL_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
    POLY_BUILDER_CODE: TEST_BUILDER_CODE,
  },
}));

// ─── Mock crypto decrypt to return valid creds JSON ──────────────────────────

vi.mock("../../packages/api/src/lib/crypto", () => ({
  encrypt: vi.fn(),
  decrypt: vi.fn().mockReturnValue(
    JSON.stringify({
      key: "test-key",
      secret: "test-secret",
      passphrase: "test-passphrase",
    })
  ),
}));

import { createUserClobClient } from "../../packages/api/src/lib/clob-factory";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

const addressArb: fc.Arbitrary<string> = fc
  .hexaString({ minLength: 40, maxLength: 40 })
  .map((s) => `0x${s}`);

const userRecordArb = fc.record({
  safeAddress: addressArb,
  walletAddress: addressArb,
  encryptedCreds: fc.constant(
    JSON.stringify({ ciphertext: "aa", iv: "bb", tag: "cc" })
  ),
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Property 3: Builder attribution consistency", () => {
  beforeEach(() => {
    constructorCalls.length = 0;
  });

  afterEach(() => {
    constructorCalls.length = 0;
  });

  it("createUserClobClient always passes builderConfig.builderCode === env.POLY_BUILDER_CODE", () => {
    fc.assert(
      fc.property(userRecordArb, (user) => {
        constructorCalls.length = 0;
        createUserClobClient(user);

        expect(constructorCalls).toHaveLength(1);
        const opts = constructorCalls[0]?.[0] as Record<string, unknown>;

        expect(opts).toHaveProperty("builderConfig");
        const builderConfig = opts.builderConfig as { builderCode: string };
        expect(builderConfig).toEqual({ builderCode: TEST_BUILDER_CODE });
      }),
      { numRuns: 100 }
    );
  });
});
