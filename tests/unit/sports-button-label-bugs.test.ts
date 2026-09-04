/**
 * Bug condition exploration tests for Sports Button Label Bugs.
 *
 * These tests are EXPECTED TO FAIL on unfixed code — failure confirms the bugs exist.
 * DO NOT attempt to fix the test or the code when it fails.
 *
 * Bug: Overly permissive fuzzy matching in `requestMatchesOfficialRow()` and
 * `tokenOverlap()` causes unrelated teams to map to the same Gamma API row,
 * producing duplicate or wrong abbreviations on outcome buttons.
 *
 * Validates: Requirements 1.1, 1.2
 */

import { describe, expect, it } from "vitest";
import {
  collectTeamLookupKeys,
  mergeGammaTeamRowIntoCaches,
} from "@/features/trading/hooks/sports/merge-gamma-team-row";

describe("Sports Button Label Bugs — Bug Condition Exploration", () => {
  it('shared token "Gaming" false positive: collectTeamLookupKeys should NOT match "bilibili gaming" to JDG row', () => {
    /**
     * "JD Gaming" and "Bilibili Gaming" share the token "Gaming" (≥4 chars).
     * On unfixed code, tokenOverlap() matches on "gaming" and returns both
     * names as keys for the JDG row → both buttons show "JDG".
     */
    const keys = collectTeamLookupKeys(
      { name: "JD Gaming", abbreviation: "JDG" },
      ["jd gaming", "bilibili gaming"]
    );

    expect(keys).not.toContain("bilibili gaming");
  });

  it('shared token "United" false positive: collectTeamLookupKeys should NOT match "newcastle united" to MUN row', () => {
    /**
     * "Manchester United" and "Newcastle United" share the token "United" (≥4 chars).
     * On unfixed code, tokenOverlap() matches on "united" and returns both
     * names as keys for the MUN row.
     */
    const keys = collectTeamLookupKeys(
      { name: "Manchester United", abbreviation: "MUN" },
      ["manchester united", "newcastle united"]
    );

    expect(keys).not.toContain("newcastle united");
  });

  it('substring false positive via collectTeamLookupKeys: "real" should NOT match "Real Madrid" row', () => {
    /**
     * On unfixed code, requestMatchesOfficialRow has `officialLower.includes(r)`
     * with no length guard — "real" is a substring of "real madrid", so it matches.
     * collectTeamLookupKeys would add "real" as a key for the Real Madrid row.
     */
    const keys = collectTeamLookupKeys(
      { name: "Real Madrid", abbreviation: "RMA" },
      ["real madrid", "real"]
    );

    expect(keys).not.toContain("real");
  });

  it('short name substring false positive: "arse" should NOT match "Arsenal" row', () => {
    /**
     * On unfixed code, requestMatchesOfficialRow has `officialLower.includes(r)`
     * with no length guard — "arse" is a substring of "arsenal", so it matches.
     */
    const keys = collectTeamLookupKeys(
      { name: "Arsenal", abbreviation: "ARS" },
      ["arsenal", "arse"]
    );

    expect(keys).not.toContain("arse");
  });

  it("end-to-end duplicate abbreviation: JDG and BLG should have distinct buttonLabels", () => {
    /**
     * Process two Gamma rows (JDG and BLG) with requested names that share
     * the "Gaming" token. On unfixed code, both requested names get mapped
     * to whichever row is processed first → both buttons show the same abbreviation.
     */
    const images: Record<string, string | null> = {};
    const abbrevs: Record<string, string | null> = {};
    const buttonLabels: Record<string, string> = {};
    const requestedChunk = ["jd gaming", "bilibili gaming"];

    mergeGammaTeamRowIntoCaches(
      { name: "JD Gaming", abbreviation: "JDG" },
      requestedChunk,
      images,
      abbrevs,
      buttonLabels
    );

    mergeGammaTeamRowIntoCaches(
      { name: "Bilibili Gaming", abbreviation: "BLG" },
      requestedChunk,
      images,
      abbrevs,
      buttonLabels
    );

    // Each team should have its own distinct abbreviation
    expect(buttonLabels["jd gaming"]).toBeDefined();
    expect(buttonLabels["bilibili gaming"]).toBeDefined();
    expect(buttonLabels["jd gaming"]).not.toBe(buttonLabels["bilibili gaming"]);
  });
});
