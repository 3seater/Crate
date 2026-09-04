/**
 * Property 6: Query client omits builder config
 *
 * **Validates: Requirements 5.2**
 *
 * For any client created by `createUserClobClientForQueries`, the client
 * configuration SHALL NOT include a `builderConfig` property, preventing the
 * client from returning all builder-attributed orders.
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

const TEST_ENCRYPTION_KEY = "a".repeat(64);

vi.mock("@doji/env/server", () => ({
  env: {
    CLOB_API_URL: "https://clob.polymarket.com",
    CHAIN_ID: 137,
    CREDENTIAL_ENCRYPTION_KEY: TEST_ENCRYPTION_KEY,
    POLY_BUILDER_CODE:
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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

import { createUserClobClientForQueries } from "../../packages/api/src/lib/clob-factory";

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

describe("Property 6: Query client omits builder config", () => {
  beforeEach(() => {
    constructorCalls.length = 0;
  });

  afterEach(() => {
    constructorCalls.length = 0;
  });

  it("createUserClobClientForQueries never includes builderConfig", () => {
    fc.assert(
      fc.property(userRecordArb, (user) => {
        constructorCalls.length = 0;
        createUserClobClientForQueries(user);

        expect(constructorCalls).toHaveLength(1);
        const opts = constructorCalls[0]?.[0] as Record<string, unknown>;

        // builderConfig must be absent (undefined) — not just falsy
        expect(opts.builderConfig).toBeUndefined();
      }),
      { numRuns: 100 }
    );
  });
});
