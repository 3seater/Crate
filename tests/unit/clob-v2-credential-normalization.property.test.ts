/**
 * Property 8: Credential normalization
 *
 * **Validates: Requirements 7.4**
 *
 * For any credentials object that uses either `apiKey` or `key` as the field name
 * for the API key, `normalizeCreds` SHALL produce an object with non-empty `key`,
 * `secret`, and `passphrase` fields.
 */

import { normalizeCreds } from "@doji/api/lib/clob";
import type { ApiKeyCreds } from "@doji/types";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

/** Generates a non-empty alphanumeric string (simulates credential values). */
const nonEmptyCredString = fc.stringMatching(/^[a-zA-Z0-9]{1,64}$/);

/** Generates a valid ApiKeyCreds object using the standard `key` field. */
const credsWithKeyArb: fc.Arbitrary<ApiKeyCreds> = fc.record({
  key: nonEmptyCredString,
  secret: nonEmptyCredString,
  passphrase: nonEmptyCredString,
});

/** Generates a credential-like object using the legacy `apiKey` field instead of `key`. */
const credsWithApiKeyArb = fc
  .record({
    apiKey: nonEmptyCredString,
    secret: nonEmptyCredString,
    passphrase: nonEmptyCredString,
  })
  .map((c) => c as unknown as ApiKeyCreds);

describe("Property 8: Credential normalization", () => {
  it("creds with `key` field → output has non-empty key, secret, passphrase", () => {
    fc.assert(
      fc.property(credsWithKeyArb, (creds) => {
        const result = normalizeCreds(creds);
        expect(result.key).toBeTruthy();
        expect(result.secret).toBeTruthy();
        expect(result.passphrase).toBeTruthy();
      }),
      { numRuns: 200 }
    );
  });

  it("creds with `apiKey` field → output has non-empty key, secret, passphrase", () => {
    fc.assert(
      fc.property(credsWithApiKeyArb, (creds) => {
        const result = normalizeCreds(creds);
        expect(result.key).toBeTruthy();
        expect(result.secret).toBeTruthy();
        expect(result.passphrase).toBeTruthy();
      }),
      { numRuns: 200 }
    );
  });

  it("output always uses `key` field, never `apiKey`", () => {
    const anyCreds = fc.oneof(credsWithKeyArb, credsWithApiKeyArb);
    fc.assert(
      fc.property(anyCreds, (creds) => {
        const result = normalizeCreds(creds);
        expect(result).toHaveProperty("key");
        expect(result).not.toHaveProperty("apiKey");
        expect(typeof result.key).toBe("string");
        expect(result.key.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });
});
