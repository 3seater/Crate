/**
 * Preservation property tests for Sports Button Label Bugs.
 *
 * These tests verify EXISTING correct behavior that must be preserved after the fix.
 * They should PASS on unfixed code — confirming baseline behavior to preserve.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import { describe, expect, it } from "vitest";
import {
  asciiFold,
  collectTeamLookupKeys,
  expandTeamNamesForGammaQuery,
} from "../../apps/web/src/features/trading/hooks/sports/merge-gamma-team-row";
import { resolveButtonLabel } from "../../apps/web/src/features/trading/lib/markets/polymarket-button-labels";

// ---------------------------------------------------------------------------
// 1. collectTeamLookupKeys preservation
// ---------------------------------------------------------------------------

describe("Preservation: collectTeamLookupKeys", () => {
  /**
   * Validates: Requirements 3.1, 3.2, 3.3
   */

  it("exact match: returns keys including the requested name", () => {
    const keys = collectTeamLookupKeys(
      { name: "Clippers", abbreviation: "LAC" },
      ["clippers"]
    );
    expect(keys).toContain("clippers");
  });

  it("ASCII-fold match: returns keys including the folded form", () => {
    const keys = collectTeamLookupKeys(
      { name: "Jiri Prochazka", abbreviation: "JIP" },
      ["jiří procházka"]
    );
    const foldedForm = asciiFold("jiří procházka");
    expect(keys).toContain(foldedForm);
  });

  it("alias match: returns keys including the alias", () => {
    const keys = collectTeamLookupKeys(
      { name: "LA Clippers", abbreviation: "LAC", alias: "Clippers" },
      ["clippers"]
    );
    expect(keys).toContain("clippers");
  });

  it("abbreviation as key: returns keys including the lowercased abbreviation", () => {
    const keys = collectTeamLookupKeys(
      { name: "Brooklyn Nets", abbreviation: "BKN" },
      []
    );
    expect(keys).toContain("bkn");
  });

  it("official name always included: returns keys including the lowercased official name", () => {
    const keys = collectTeamLookupKeys(
      { name: "Brooklyn Nets", abbreviation: "BKN" },
      []
    );
    expect(keys).toContain("brooklyn nets");
  });
});

// ---------------------------------------------------------------------------
// 2. resolveButtonLabel preservation
// ---------------------------------------------------------------------------

describe("Preservation: resolveButtonLabel", () => {
  /**
   * Validates: Requirements 3.4, 3.5, 3.6
   */

  it('totals "Over": resolves to "O 218.5"', () => {
    expect(resolveButtonLabel("Over 218.5", {})).toBe("O 218.5");
  });

  it('totals "Under": resolves to "U 145.5"', () => {
    expect(resolveButtonLabel("Under 145.5", {})).toBe("U 145.5");
  });

  it('spread with abbreviation: resolves to "BKN +4.5"', () => {
    expect(resolveButtonLabel("Nets +4.5", { nets: "BKN" })).toBe("BKN +4.5");
  });

  it('non-sports "Yes": passes through unchanged', () => {
    expect(resolveButtonLabel("Yes", {})).toBe("Yes");
  });

  it('non-sports "No": passes through unchanged', () => {
    expect(resolveButtonLabel("No", {})).toBe("No");
  });

  it('moneyline with abbreviation: resolves to "BKN"', () => {
    expect(resolveButtonLabel("Nets", { nets: "BKN" })).toBe("BKN");
  });

  it("no abbreviation found: returns original label", () => {
    expect(resolveButtonLabel("Unknown Team", {})).toBe("Unknown Team");
  });
});

// ---------------------------------------------------------------------------
// 3. expandTeamNamesForGammaQuery preservation
// ---------------------------------------------------------------------------

describe("Preservation: expandTeamNamesForGammaQuery", () => {
  /**
   * Validates: Requirements 3.7
   */

  it('FC prefix strip: includes "Barcelona"', () => {
    const result = expandTeamNamesForGammaQuery(["FC Barcelona"]);
    expect(result).toContain("Barcelona");
  });

  it('ordinal prefix strip: includes "FC Union Berlin"', () => {
    const result = expandTeamNamesForGammaQuery(["1. FC Union Berlin"]);
    expect(result).toContain("FC Union Berlin");
  });

  it('FC suffix strip: includes "Barcelona"', () => {
    const result = expandTeamNamesForGammaQuery(["Barcelona FC"]);
    expect(result).toContain("Barcelona");
  });

  it('drop first token for 3+ word names: includes "Rapids Griffins"', () => {
    const result = expandTeamNamesForGammaQuery(["Grand Rapids Griffins"]);
    expect(result).toContain("Rapids Griffins");
  });
});
