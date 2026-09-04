/**
 * Unit tests for Safe onboarding utilities.
 *
 * Tests verify the behavior we NEED for the onboarding flow to work correctly:
 * - Error recovery routing (server vs manual-entry vs retry)
 * - Security: never accept EOA as Safe address
 * - Credential mapping for server storage
 */
import { describe, expect, it } from "vitest";
import {
  ERROR_PATTERNS,
  ETH_ADDRESS_REGEX,
  mapCredentialsToServerFormat,
  matchesAny,
  validateManualSafeAddressInput,
} from "../../apps/web/src/components/onboarding/safe-onboarding-utils";

// ─── Error recovery routing ──────────────────────────────────────────────────
// Deploy failures reach safe-onboarding with messages from mapRelayerOrBuilderMessage
// or raw API errors. Patterns must route them to the correct recovery path.

describe("Error recovery routing", () => {
  describe("suggestsAlreadyDeployed — should trigger server + on-chain recovery", () => {
    const patterns = ERROR_PATTERNS.suggestsAlreadyDeployed;

    it("matches raw relayer error 'safe already deployed!'", () => {
      expect(matchesAny("safe already deployed!", patterns)).toBe(true);
    });

    it("matches mapped message from relayer-errors", () => {
      // mapRelayerOrBuilderMessage maps "safe already deployed!" → this
      expect(matchesAny("Your Safe wallet is already set up.", patterns)).toBe(
        true
      );
    });

    it("matches 'could not be retrieved' (retrieval failure, Safe may exist)", () => {
      expect(
        matchesAny("Safe address could not be retrieved from relayer", patterns)
      ).toBe(true);
    });
  });

  describe("suggestsManualEntry — should show manual-entry UI", () => {
    const patterns = ERROR_PATTERNS.suggestsManualEntry;

    it("matches 'could not be retrieved' (user can paste from Polygonscan)", () => {
      expect(
        matchesAny("Address could not be retrieved from API", patterns)
      ).toBe(true);
    });

    it("matches 'check polygonscan' (we are telling user where to look)", () => {
      expect(
        matchesAny("Check Polygonscan for your Safe address", patterns)
      ).toBe(true);
    });
  });

  describe("must NOT trigger recovery (would show wrong UI)", () => {
    it("User cancellation must not suggest manual-entry", () => {
      expect(
        matchesAny(
          "User denied transaction",
          ERROR_PATTERNS.suggestsManualEntry
        )
      ).toBe(false);
      expect(
        matchesAny(
          "User rejected the request",
          ERROR_PATTERNS.suggestsManualEntry
        )
      ).toBe(false);
    });

    it("Generic deploy failure must not suggest manual-entry (retry is correct)", () => {
      expect(
        matchesAny("Failed to deploy Safe", ERROR_PATTERNS.suggestsManualEntry)
      ).toBe(false);
      expect(
        matchesAny(
          "Safe deployment failed - no address returned",
          ERROR_PATTERNS.suggestsManualEntry
        )
      ).toBe(false);
    });

    it("Wallet/signer errors must not suggest manual-entry", () => {
      expect(
        matchesAny(
          "Please connect your wallet to continue.",
          ERROR_PATTERNS.suggestsManualEntry
        )
      ).toBe(false);
    });

    it("Network errors must not suggest manual-entry", () => {
      expect(
        matchesAny("Network timeout", ERROR_PATTERNS.suggestsManualEntry)
      ).toBe(false);
    });
  });
});

// ─── Manual Safe validation (security) ────────────────────────────────────────
// User pastes address; we must never accept EOA as Safe (would break trading).

describe("validateManualSafeAddressInput", () => {
  const VALID_SAFE = "0x1234567890123456789012345678901234567890";
  const VALID_EOA = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";

  it("SECURITY: rejects when user pastes EOA address (case-insensitive)", () => {
    const result = validateManualSafeAddressInput(
      VALID_EOA.toLowerCase(),
      VALID_EOA.toUpperCase()
    );
    expect(result.valid).toBe(false);
    expect((result as { error: string }).error).toContain("EOA");
    expect((result as { error: string }).error).toContain(
      "separate contract address"
    );
  });

  it("accepts valid Safe address when it differs from EOA", () => {
    expect(validateManualSafeAddressInput(VALID_SAFE, VALID_EOA)).toEqual({
      valid: true,
    });
  });

  it("accepts valid Safe when no wallet connected (eoaAddress null)", () => {
    expect(validateManualSafeAddressInput(VALID_SAFE, null)).toEqual({
      valid: true,
    });
  });

  it("rejects empty or whitespace", () => {
    expect(validateManualSafeAddressInput("", VALID_EOA).valid).toBe(false);
    expect(validateManualSafeAddressInput("   ", VALID_EOA).valid).toBe(false);
  });

  it("rejects invalid format (wrong length, no 0x, non-hex)", () => {
    expect(validateManualSafeAddressInput("0x1234", VALID_EOA).valid).toBe(
      false
    );
    expect(
      validateManualSafeAddressInput(
        "1234567890123456789012345678901234567890",
        VALID_EOA
      ).valid
    ).toBe(false);
    expect(
      validateManualSafeAddressInput(
        "0x123456789012345678901234567890123456789g",
        VALID_EOA
      ).valid
    ).toBe(false);
  });
});

// ─── Credential mapping ──────────────────────────────────────────────────────
// Server storeCredentials expects { key, secret, passphrase }. Polymarket returns
// { key, secret, passphrase }; some paths may use apiKey.

describe("mapCredentialsToServerFormat", () => {
  it("maps Polymarket ApiKeyCreds shape (key, secret, passphrase) for server", () => {
    const creds = {
      key: "pmkt-abc123",
      secret: "secret456",
      passphrase: "pass789",
    };
    expect(mapCredentialsToServerFormat(creds)).toEqual(creds);
  });

  it("uses apiKey as key when key is missing (alternative credential source)", () => {
    const result = mapCredentialsToServerFormat({
      apiKey: "apiKey-789",
      secret: "s",
      passphrase: "p",
    });
    expect(result.key).toBe("apiKey-789");
  });

  it("prefers key over apiKey when both present", () => {
    const result = mapCredentialsToServerFormat({
      key: "key-123",
      apiKey: "apiKey-456",
      secret: "s",
      passphrase: "p",
    });
    expect(result.key).toBe("key-123");
  });

  it("uses empty string for missing fields (component checks before store)", () => {
    const result = mapCredentialsToServerFormat({});
    expect(result.key).toBe("");
    expect(result.secret).toBe("");
    expect(result.passphrase).toBe("");
  });
});

// ─── ETH_ADDRESS_REGEX ──────────────────────────────────────────────────────
// Used by validation; must accept valid Ethereum addresses, reject invalid.

describe("ETH_ADDRESS_REGEX", () => {
  it("accepts valid 40-char hex with 0x prefix", () => {
    expect(
      ETH_ADDRESS_REGEX.test("0x1234567890123456789012345678901234567890")
    ).toBe(true);
  });

  it("rejects invalid: wrong length, no 0x, non-hex char", () => {
    expect(ETH_ADDRESS_REGEX.test("0x1234")).toBe(false);
    expect(
      ETH_ADDRESS_REGEX.test("1234567890123456789012345678901234567890")
    ).toBe(false);
    expect(
      ETH_ADDRESS_REGEX.test("0x123456789012345678901234567890123456789g")
    ).toBe(false);
  });
});
