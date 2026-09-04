import { describe, expect, it } from "vitest";
import { buildSportImageUrlByLeague } from "@/features/trading/hooks/sports/sports-league-image-map";

describe("buildSportImageUrlByLeague", () => {
  it("indexes sport id lowercased and skips empty images", () => {
    const map = buildSportImageUrlByLeague([
      { sport: "NBA", image: "https://cdn.example/nba.png" },
      { sport: "ufc", image: "" },
      { sport: "kle", image: "  https://cdn.example/kle.png  " },
    ]);
    expect(map.nba).toBe("https://cdn.example/nba.png");
    expect(map.ufc).toBeUndefined();
    expect(map.kle).toBe("https://cdn.example/kle.png");
  });

  it("skips generic soccer-ball URLs", () => {
    const map = buildSportImageUrlByLeague([
      {
        sport: "epl",
        image: "https://polymarket-upload.s3.amazonaws.com/soccer-ball.png",
      },
      { sport: "epl", image: "https://cdn.example/epl-real.png" },
    ]);
    expect(map.epl).toBe("https://cdn.example/epl-real.png");
  });

  it("keeps first non-empty row per sport", () => {
    const map = buildSportImageUrlByLeague([
      { sport: "nba", image: "https://a.png" },
      { sport: "nba", image: "https://b.png" },
    ]);
    expect(map.nba).toBe("https://a.png");
  });
});
