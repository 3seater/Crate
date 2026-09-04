import { describe, expect, it } from "vitest";
import { expandTeamNamesForGammaQuery } from "@/features/trading/hooks/sports/merge-gamma-team-row";

describe("expandTeamNamesForGammaQuery", () => {
  it("adds ascii-folded variant for accented names (UFC / intl rosters)", () => {
    const out = expandTeamNamesForGammaQuery([
      "Jiří Procházka",
      "Carlos Ulberg",
    ]);
    expect(out).toContain("Jiří Procházka");
    expect(out).toContain("jiri prochazka");
    expect(out).toContain("Carlos Ulberg");
    // No extra accents → folded name equals lowercased; no duplicate entry.
    expect(out.filter((x) => x.toLowerCase() === "carlos ulberg").length).toBe(
      1
    );
  });

  it("adds variants for leading FC and trailing FC club names", () => {
    const out = expandTeamNamesForGammaQuery([
      "FC Seoul",
      "Jeonbuk Hyundai Motors FC",
    ]);
    expect(out).toContain("FC Seoul");
    expect(out).toContain("Seoul");
    expect(out).toContain("Jeonbuk Hyundai Motors FC");
    expect(out).toContain("Jeonbuk Hyundai Motors");
    expect(out).toContain("Hyundai Motors FC");
  });
});
