/**
 * Property 7: Credential encryption round-trip
 *
 * **Validates: Requirements 7.1**
 *
 * For any valid `ApiKeyCreds` object (with non-empty `key`, `secret`,
 * `passphrase`), encrypting with AES using `CREDENTIAL_ENCRYPTION_KEY` and
 * then decrypting SHALL produce an object equivalent to the original
 * credentials.
 */
import { randomBytes } from "node:crypto";
import type { ApiKeyCreds } from "@doji/types";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "../../packages/api/src/lib/crypto";

// ─── Arbitraries ─────────────────────────────────────────────────────────────

/** Generates a non-empty printable ASCII string (avoids control chars that could break JSON). */
const nonEmptyPrintableArb: fc.Arbitrary<string> = fc.string({
  minLength: 1,
  maxLength: 128,
  unit: fc.integer({ min: 0x20, max: 0x7e }).map(String.fromCharCode),
});

const apiKeyCredsArb: fc.Arbitrary<ApiKeyCreds> = fc.record({
  key: nonEmptyPrintableArb,
  secret: nonEmptyPrintableArb,
  passphrase: nonEmptyPrintableArb,
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Property 7: Credential encryption round-trip", () => {
  // Use a fixed 32-byte key for deterministic tests
  const encryptionKey = randomBytes(32);

  it("encrypt → decrypt produces equivalent ApiKeyCreds for any valid input", () => {
    fc.assert(
      fc.property(apiKeyCredsArb, (creds) => {
        const plaintext = JSON.stringify(creds);
        const encrypted = encrypt(plaintext, encryptionKey);
        const decrypted = decrypt(encrypted, encryptionKey);
        const roundTripped = JSON.parse(decrypted) as ApiKeyCreds;

        expect(roundTripped).toEqual(creds);
      }),
      { numRuns: 200 }
    );
  });
});
