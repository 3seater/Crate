/**
 * Preservation Property Tests — Current Market Badge & Empty Position Behavior
 *
 * These tests capture the EXISTING behavior of `matchPosition` that must be
 * preserved through the bugfix. They should PASS on the unfixed code.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4
 */

import { describe, expect, it } from "vitest";

import { matchPosition } from "../../apps/web/src/domains/trading/components/market/comments-utils";

const YES_TOKEN_ID = "yes-token-abc123";
const NO_TOKEN_ID = "no-token-def456";
const YES_LABEL = "Yes";
const NO_LABEL = "No";

describe("matchPosition — preservation property tests", () => {
  describe("Property: position matching yesTokenId returns correct result", () => {
    it("returns {side: 'yes', size: Number(positionSize), outcomeLabel: yesLabel}", () => {
      const result = matchPosition(
        [{ tokenId: YES_TOKEN_ID, positionSize: "1000" }],
        YES_TOKEN_ID,
        NO_TOKEN_ID,
        YES_LABEL,
        NO_LABEL
      );

      expect(result).toEqual({
        side: "yes",
        size: 1000,
        outcomeLabel: "Yes",
      });
    });

    it("converts positionSize string to number correctly", () => {
      const result = matchPosition(
        [{ tokenId: YES_TOKEN_ID, positionSize: "354821" }],
        YES_TOKEN_ID,
        NO_TOKEN_ID,
        "Will win",
        "Will lose"
      );

      expect(result).toEqual({
        side: "yes",
        size: 354_821,
        outcomeLabel: "Will win",
      });
    });
  });

  describe("Property: position matching noTokenId returns correct result", () => {
    it("returns {side: 'no', size: Number(positionSize), outcomeLabel: noLabel}", () => {
      const result = matchPosition(
        [{ tokenId: NO_TOKEN_ID, positionSize: "500" }],
        YES_TOKEN_ID,
        NO_TOKEN_ID,
        YES_LABEL,
        NO_LABEL
      );

      expect(result).toEqual({
        side: "no",
        size: 500,
        outcomeLabel: "No",
      });
    });

    it("converts positionSize string to number for no-side", () => {
      const result = matchPosition(
        [{ tokenId: NO_TOKEN_ID, positionSize: "2500" }],
        YES_TOKEN_ID,
        NO_TOKEN_ID,
        "Approve",
        "Reject"
      );

      expect(result).toEqual({
        side: "no",
        size: 2500,
        outcomeLabel: "Reject",
      });
    });
  });

  describe("Property: empty positions array returns null", () => {
    it("returns null for empty array", () => {
      const result = matchPosition(
        [],
        YES_TOKEN_ID,
        NO_TOKEN_ID,
        YES_LABEL,
        NO_LABEL
      );

      expect(result).toBeNull();
    });
  });

  describe("Property: positions with null tokenIds returns null", () => {
    it("returns null when tokenId is null", () => {
      const result = matchPosition(
        [{ tokenId: null, positionSize: null }],
        YES_TOKEN_ID,
        NO_TOKEN_ID,
        YES_LABEL,
        NO_LABEL
      );

      expect(result).toBeNull();
    });

    it("returns null when positionSize is null even if tokenId matches", () => {
      const result = matchPosition(
        [{ tokenId: YES_TOKEN_ID, positionSize: null }],
        YES_TOKEN_ID,
        NO_TOKEN_ID,
        YES_LABEL,
        NO_LABEL
      );

      expect(result).toBeNull();
    });
  });

  describe("Property: positions with tokenId not matching either market token returns null", () => {
    it("returns null when tokenId does not match yes or no token", () => {
      const result = matchPosition(
        [{ tokenId: "other-token-xyz", positionSize: "100" }],
        YES_TOKEN_ID,
        NO_TOKEN_ID,
        YES_LABEL,
        NO_LABEL
      );

      expect(result).toBeNull();
    });

    it("returns null when multiple positions have non-matching tokenIds", () => {
      const result = matchPosition(
        [
          { tokenId: "unrelated-1", positionSize: "500" },
          { tokenId: "unrelated-2", positionSize: "1000" },
        ],
        YES_TOKEN_ID,
        NO_TOKEN_ID,
        YES_LABEL,
        NO_LABEL
      );

      expect(result).toBeNull();
    });
  });

  describe("Property: first matching position wins when multiple exist", () => {
    it("returns the first yes-matching position from the array", () => {
      const result = matchPosition(
        [
          { tokenId: "other-token", positionSize: "9999" },
          { tokenId: YES_TOKEN_ID, positionSize: "200" },
          { tokenId: NO_TOKEN_ID, positionSize: "300" },
        ],
        YES_TOKEN_ID,
        NO_TOKEN_ID,
        YES_LABEL,
        NO_LABEL
      );

      expect(result).toEqual({
        side: "yes",
        size: 200,
        outcomeLabel: "Yes",
      });
    });
  });
});
