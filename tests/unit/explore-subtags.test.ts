import { describe, expect, it } from "vitest";
import { parseExploreSubTagSlugsFromSearchParams } from "@/features/explore/components/explore-constants";
import { eventMatchesExploreSubTags } from "@/features/explore/components/explore-utils";

describe("parseExploreSubTagSlugsFromSearchParams", () => {
  it("parses CSV and lowercases", () => {
    expect(
      parseExploreSubTagSlugsFromSearchParams({ sub_tags: "Trump, NBA " })
    ).toEqual(["trump", "nba"]);
  });

  it("dedupes", () => {
    expect(
      parseExploreSubTagSlugsFromSearchParams({ sub_tags: "a,b,a" })
    ).toEqual(["a", "b"]);
  });

  it("empty when missing", () => {
    expect(parseExploreSubTagSlugsFromSearchParams({})).toEqual([]);
  });
});

describe("eventMatchesExploreSubTags", () => {
  it("allows all when no sub-tags", () => {
    expect(eventMatchesExploreSubTags({ tags: [] } as never, [])).toBe(true);
  });

  it("matches OR on event.tags", () => {
    const event = {
      tags: [{ slug: "nba" }, { slug: "other" }],
    } as never;
    expect(eventMatchesExploreSubTags(event, ["nfl"])).toBe(false);
    expect(eventMatchesExploreSubTags(event, ["nba"])).toBe(true);
    expect(eventMatchesExploreSubTags(event, ["nba", "nfl"])).toBe(true);
  });
});
