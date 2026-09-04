/**
 * Unit tests for Sports WebSocket message schemas.
 */
import { describe, expect, it } from "vitest";
import {
  SportResultSchema,
  safeParseSportResult,
} from "../../../apps/web/src/lib/websocket/sports-schemas";

const validSportResult = {
  gameId: 12_345,
  leagueAbbreviation: "NFL",
  homeTeam: "Team A",
  awayTeam: "Team B",
  status: "live",
  live: true,
  ended: false,
  score: "14-7",
  period: "2",
};

describe("safeParseSportResult", () => {
  it("parses valid sport_result", () => {
    const result = safeParseSportResult(validSportResult);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.gameId).toBe(12_345);
      expect(result.data.homeTeam).toBe("Team A");
      expect(result.data.score).toBe("14-7");
    }
  });

  it("accepts optional fields", () => {
    const withOptional = {
      ...validSportResult,
      elapsed: "12:34",
      finishedTimestamp: "1704067200",
      turn: "home",
    };
    const result = safeParseSportResult(withOptional);
    expect(result.success).toBe(true);
  });

  it("rejects missing required gameId", () => {
    const result = safeParseSportResult({
      ...validSportResult,
      gameId: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects string gameId when number expected", () => {
    const result = safeParseSportResult({
      ...validSportResult,
      gameId: "12345",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing score", () => {
    const result = safeParseSportResult({
      ...validSportResult,
      score: undefined,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-object input", () => {
    expect(safeParseSportResult(null).success).toBe(false);
    expect(safeParseSportResult("string").success).toBe(false);
  });
});

describe("SportResultSchema", () => {
  it("validates live and ended as booleans", () => {
    const result = SportResultSchema.safeParse({
      ...validSportResult,
      live: false,
      ended: true,
    });
    expect(result.success).toBe(true);
  });
});
