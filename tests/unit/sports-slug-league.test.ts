import { describe, expect, it } from "vitest";
import {
  extractOrderedSlugTeamTokens,
  extractSlugAbbreviations,
  extractSportsLeagueFromEventSlug,
  resolveSlugTeamTokenForLogoMap,
} from "@/features/explore/components/event-card-sports-utils";

describe("extractSportsLeagueFromEventSlug", () => {
  it("parses PSL toss slug with suffix after the game date", () => {
    expect(
      extractSportsLeagueFromEventSlug(
        "cricpsl-pes-lah-2026-04-11-toss-match-double"
      )
    ).toBe("cricpsl");
  });

  it("parses market-disambiguation tail after toss segment", () => {
    expect(
      extractSportsLeagueFromEventSlug(
        "cricpsl-pes-lah-2026-04-11-toss-match-double-lah"
      )
    ).toBe("cricpsl");
  });

  it("parses classic date-at-end slug", () => {
    expect(extractSportsLeagueFromEventSlug("nba-cle-lal-2026-03-31")).toBe(
      "nba"
    );
  });

  it("returns null when no ISO date in slug", () => {
    expect(extractSportsLeagueFromEventSlug("some-prop-market")).toBeNull();
  });
});

describe("extractSlugAbbreviations", () => {
  it("maps pes/lah from PSL toss slug with long tail", () => {
    expect(
      extractSlugAbbreviations(
        "cricpsl-pes-lah-2026-04-11-toss-match-double-lah"
      )
    ).toEqual({
      pes: "PES",
      lah: "LAH",
    });
  });
});

describe("resolveSlugTeamTokenForLogoMap", () => {
  const slug = "bun-hei-uni-2026-04-11";

  it("maps Heidenheim full label to slug token hei", () => {
    expect(resolveSlugTeamTokenForLogoMap(slug, "1. FC Heidenheim 1846")).toBe(
      "hei"
    );
  });

  it("maps Union Berlin full label to slug token uni", () => {
    expect(resolveSlugTeamTokenForLogoMap(slug, "1. FC Union Berlin")).toBe(
      "uni"
    );
  });

  it("returns null when no slug segment is a substring of the team name", () => {
    expect(
      resolveSlugTeamTokenForLogoMap(slug, "Tottenham Hotspur")
    ).toBeNull();
  });

  it("returns null when slug has no ISO date", () => {
    expect(
      resolveSlugTeamTokenForLogoMap("bun-hei-uni", "1. FC Heidenheim 1846")
    ).toBeNull();
  });
});

describe("extractOrderedSlugTeamTokens", () => {
  it("returns ner and dcu from MLS slug (substring match alone would miss ner)", () => {
    expect(extractOrderedSlugTeamTokens("mls-ner-dcu-2026-04-11")).toEqual([
      "ner",
      "dcu",
    ]);
  });

  it("strips date and market tail before reading tokens", () => {
    expect(extractOrderedSlugTeamTokens("mls-ner-dcu-2026-04-11-ner")).toEqual([
      "ner",
      "dcu",
    ]);
  });
});
