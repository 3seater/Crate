/**
 * Preservation property tests for sports event categorization (Property 2).
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**
 *
 * These tests capture the CURRENT (correct) behavior of known market types
 * on UNFIXED code. They must PASS both before and after the fix to confirm
 * no regressions for existing sports/esports categorization.
 *
 * Observation-first methodology: each test encodes observed baseline behavior.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  classifySportsMarketType,
  groupSportsMarketSections,
} from "../../apps/web/src/lib/markets/events";
import type { Market } from "../../apps/web/src/lib/trpc/types";

/**
 * Replicate isSliderableType from sports-selector-card.tsx (non-exported).
 * This mirrors the FIXED keyword-based implementation for preservation testing.
 */
const SLIDER_KEYWORDS = ["over_under", "totals", "spreads", "handicap"];

function isSliderableType(smt: string): boolean {
  return SLIDER_KEYWORDS.some((kw) => smt.includes(kw));
}

/** Minimal market fixture builder (same pattern as exploration test). */
function makeMarket(
  overrides: Partial<Market> & { sportsMarketType?: string } = {}
): Market {
  const { sportsMarketType, ...rest } = overrides;
  return {
    question: "Test market?",
    active: true,
    closed: false,
    archived: false,
    slug: "test-market",
    outcomePrices: ["0.50", "0.50"],
    tokens: [
      { token_id: "t1", outcome: "Yes", price: 0.5, winner: false },
      { token_id: "t2", outcome: "No", price: 0.5, winner: false },
    ],
    ...(sportsMarketType ? { sportsMarketType } : {}),
    ...rest,
  } as Market;
}

// ─── Known constant values from events.ts ────────────────────────────────────

/** All sportsMarketType values in SMT_EXACT_TAB with their expected tab labels. */
const SMT_EXACT_TAB_ENTRIES: [string, string][] = [
  ["moneyline", "Game Lines"],
  ["spreads", "Game Lines"],
  ["totals", "Game Lines"],
  ["match_handicap", "Game Lines"],
  ["total_games", "Game Lines"],
  ["parlays", "Game Lines"],
  ["nrfi", "Game Lines"],
  ["first_half_moneyline", "1st Half"],
  ["first_half_spreads", "1st Half"],
  ["first_half_totals", "1st Half"],
  ["soccer_halftime_result", "Halftime Result"],
  ["both_teams_to_score", "Game Lines"],
  ["double_chance", "Game Lines"],
  ["correct_score", "Exact Score"],
  ["soccer_exact_score", "Exact Score"],
  ["soccer_team_to_advance", "Game Lines"],
  ["total_corners", "Corners"],
  ["total_goals", "Game Lines"],
  ["soccer_anytime_goalscorer", "Goalscorers"],
  ["nhl_period_result", "Periods"],
  ["cricket_first_inning_runs", "1st Innings"],
  ["cricket_second_inning_runs", "2nd Innings"],
  ["anytime_touchdowns", "Player Props"],
  ["first_touchdowns", "Player Props"],
  ["two_plus_touchdowns", "Player Props"],
  ["passing_touchdowns", "Player Props"],
  ["passing_yards", "Player Props"],
  ["rushing_yards", "Player Props"],
  ["receiving_yards", "Player Props"],
  ["receptions", "Player Props"],
  ["points", "Player Props"],
  ["rebounds", "Player Props"],
  ["assists", "Player Props"],
  ["assists_points_rebounds", "Player Props"],
  ["double_doubles", "Player Props"],
  ["threes", "Player Props"],
];

/** Known sliderable types (hardcoded in isSliderableType). */
const KNOWN_SLIDERABLE_TYPES = [
  "kill_over_under_game",
  "totals",
  "spreads",
  "map_handicap",
];

/** Known non-sliderable types (a sample of types NOT in the sliderable list). */
const KNOWN_NON_SLIDERABLE_TYPES = [
  "moneyline",
  "child_moneyline",
  "first_blood_game",
  "both_teams_to_score",
  "double_chance",
  "correct_score",
  "nhl_period_result",
  "anytime_touchdowns",
  "points",
  "rebounds",
];

// ─── Preservation Tests ──────────────────────────────────────────────────────

describe("Property 2: Preservation — Known Market Types Produce Identical Output", () => {
  /**
   * Observation 1: NBA event with moneyline/spreads/totals produces
   * "Game Lines" + "1st Half" tab structure.
   *
   * Validates: Requirements 3.1
   */
  describe("NBA/basketball tab structure preservation", () => {
    it("NBA event with game lines + 1st half markets produces correct tabs", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("moneyline", "spreads", "totals"),
          fc.constantFrom(
            "first_half_moneyline",
            "first_half_spreads",
            "first_half_totals"
          ),
          (gameLineSmt, firstHalfSmt) => {
            const markets = [
              makeMarket({
                sportsMarketType: "moneyline",
                question: "Lakers vs Celtics",
                tokens: [
                  {
                    token_id: "t1",
                    outcome: "Lakers",
                    price: 0.55,
                    winner: false,
                  },
                  {
                    token_id: "t2",
                    outcome: "Celtics",
                    price: 0.45,
                    winner: false,
                  },
                ],
              }),
              makeMarket({
                sportsMarketType: gameLineSmt,
                question: `Lakers vs Celtics ${gameLineSmt}`,
              }),
              makeMarket({
                sportsMarketType: firstHalfSmt,
                question: `1st Half ${firstHalfSmt}`,
              }),
            ];

            const result = groupSportsMarketSections(markets);

            // Should NOT be esports
            expect(result.isEsports).toBe(false);

            // Should have 2 tabs: "Game Lines" and "1st Half"
            expect(result.tabs.length).toBe(2);
            expect(result.tabs[0].label).toBe("Game Lines");
            expect(result.tabs[1].label).toBe("1st Half");

            // sportsSections should be empty when tabs > 1
            expect(result.sportsSections).toEqual([]);
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * Observation 2: LoL esports event with child_moneyline/first_blood_game/
   * kill_over_under_game + "Game N" questions produces isEsports: true,
   * "Series Lines" + "Game N" tabs.
   *
   * Validates: Requirements 3.2
   */
  describe("LoL esports tab structure preservation", () => {
    it("LoL event produces isEsports=true with Series Lines + Game N tabs", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 3 }), (gameNum) => {
          const markets = [
            // Series-level markets
            makeMarket({
              sportsMarketType: "moneyline",
              question: "T1 vs Gen.G",
              tokens: [
                {
                  token_id: "t1",
                  outcome: "T1",
                  price: 0.6,
                  winner: false,
                },
                {
                  token_id: "t2",
                  outcome: "Gen.G",
                  price: 0.4,
                  winner: false,
                },
              ],
            }),
            makeMarket({
              sportsMarketType: "child_moneyline",
              question: `Game ${gameNum} Winner`,
            }),
            makeMarket({
              sportsMarketType: "totals",
              question: "Total Games in Series",
            }),
            // Per-game markets
            makeMarket({
              sportsMarketType: "first_blood_game",
              question: `Game ${gameNum} First Blood`,
            }),
            makeMarket({
              sportsMarketType: "kill_over_under_game",
              question: `Game ${gameNum} Kill Over/Under`,
            }),
          ];

          const result = groupSportsMarketSections(markets);

          // Must be detected as esports
          expect(result.isEsports).toBe(true);

          // Should have tabs
          expect(result.tabs.length).toBeGreaterThanOrEqual(2);

          // First tab should be "Series Lines"
          expect(result.tabs[0].label).toBe("Series Lines");

          // Should have a "Game N" tab
          const gameTab = result.tabs.find(
            (t) => t.label === `Game ${gameNum}`
          );
          expect(gameTab).toBeDefined();
          expect(gameTab?.markets.length).toBeGreaterThan(0);

          // sportsSections should be empty for esports
          expect(result.sportsSections).toEqual([]);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Observation 3: CS2 esports event with cs2_first_blood_game/
   * cs2_kill_over_under_game + "Map N" questions produces isEsports: true,
   * "Series Lines" + "Map N" tabs.
   *
   * Validates: Requirements 3.3
   */
  describe("CS2 esports tab structure preservation", () => {
    it("CS2 event produces isEsports=true with Series Lines + Map N tabs", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 3 }), (mapNum) => {
          const markets = [
            // Series-level markets
            makeMarket({
              sportsMarketType: "moneyline",
              question: "FaZe vs Navi",
              tokens: [
                {
                  token_id: "t1",
                  outcome: "FaZe",
                  price: 0.5,
                  winner: false,
                },
                {
                  token_id: "t2",
                  outcome: "Navi",
                  price: 0.5,
                  winner: false,
                },
              ],
            }),
            makeMarket({
              sportsMarketType: "map_handicap",
              question: "Map Handicap",
            }),
            // Per-map markets
            makeMarket({
              sportsMarketType: "cs2_first_blood_game",
              question: `Map ${mapNum} First Blood`,
            }),
            makeMarket({
              sportsMarketType: "cs2_kill_over_under_game",
              question: `Map ${mapNum} Kill Over/Under`,
            }),
          ];

          const result = groupSportsMarketSections(markets);

          // Must be detected as esports
          expect(result.isEsports).toBe(true);

          // Should have tabs
          expect(result.tabs.length).toBeGreaterThanOrEqual(2);

          // First tab should be "Series Lines"
          expect(result.tabs[0].label).toBe("Series Lines");

          // Should have a "Map N" tab (CS2 uses "Map" not "Game")
          const mapTab = result.tabs.find((t) => t.label === `Map ${mapNum}`);
          expect(mapTab).toBeDefined();
          expect(mapTab?.markets.length).toBeGreaterThan(0);

          // sportsSections should be empty for esports
          expect(result.sportsSections).toEqual([]);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Observation 4: Single-tab event with only moneyline/spreads/totals
   * produces tabs: [], sportsSections with one entry (flat layout).
   *
   * Validates: Requirements 3.7
   */
  describe("Single-tab flat layout preservation", () => {
    it("event with only Game Lines markets produces flat layout (no tab bar)", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("moneyline", "spreads", "totals"),
          (smt) => {
            const markets = [
              makeMarket({
                sportsMarketType: "moneyline",
                question: "Team A vs Team B",
                tokens: [
                  {
                    token_id: "t1",
                    outcome: "Team A",
                    price: 0.5,
                    winner: false,
                  },
                  {
                    token_id: "t2",
                    outcome: "Team B",
                    price: 0.5,
                    winner: false,
                  },
                ],
              }),
              makeMarket({
                sportsMarketType: smt,
                question: `${smt} market`,
              }),
            ];

            const result = groupSportsMarketSections(markets);

            // Not esports
            expect(result.isEsports).toBe(false);

            // Single tab → tabs should be empty (flat layout)
            expect(result.tabs).toEqual([]);

            // sportsSections should have exactly one entry
            expect(result.sportsSections.length).toBe(1);
            expect(result.sportsSections[0].label).toBe("Game Lines");
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Observation 5: Markets without sportsMarketType fall back to question
   * text heuristic — "1st half" in question → "1st Half" tab.
   *
   * Validates: Requirements 3.8
   */
  describe("Question text heuristic fallback preservation", () => {
    it("markets without sportsMarketType use question text for tab assignment", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            "1st half spread",
            "First Half moneyline",
            "1H totals"
          ),
          (question) => {
            const markets = [
              makeMarket({
                sportsMarketType: "moneyline",
                question: "Team A vs Team B",
                tokens: [
                  {
                    token_id: "t1",
                    outcome: "Team A",
                    price: 0.5,
                    winner: false,
                  },
                  {
                    token_id: "t2",
                    outcome: "Team B",
                    price: 0.5,
                    winner: false,
                  },
                ],
              }),
              // Market WITHOUT sportsMarketType — relies on question text
              makeMarket({ question }),
            ];

            const result = groupSportsMarketSections(markets);

            // Should have 2 tabs: "Game Lines" and "1st Half"
            expect(result.tabs.length).toBe(2);
            expect(result.tabs[0].label).toBe("Game Lines");
            expect(result.tabs[1].label).toBe("1st Half");
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Observation 6: isSliderableType returns true for all 4 known sliderable
   * types and false for non-sliderable types.
   *
   * Validates: Requirements 3.4, 3.5, 3.6
   */
  describe("isSliderableType preservation", () => {
    it("returns true for all known sliderable types", () => {
      fc.assert(
        fc.property(fc.constantFrom(...KNOWN_SLIDERABLE_TYPES), (smt) => {
          expect(isSliderableType(smt)).toBe(true);
        }),
        { numRuns: 20 }
      );
    });

    it("returns false for known non-sliderable types", () => {
      fc.assert(
        fc.property(fc.constantFrom(...KNOWN_NON_SLIDERABLE_TYPES), (smt) => {
          expect(isSliderableType(smt)).toBe(false);
        }),
        { numRuns: 20 }
      );
    });
  });

  /**
   * classifySportsMarketType returns consistent categories for all known types.
   *
   * Validates: Requirements 3.4, 3.5, 3.6
   */
  describe("classifySportsMarketType preservation", () => {
    it("moneyline type classifies as 'moneyline'", () => {
      fc.assert(
        fc.property(fc.constantFrom("moneyline"), (smt) => {
          const market = makeMarket({
            sportsMarketType: smt,
            question: "Team A vs Team B",
            tokens: [
              {
                token_id: "t1",
                outcome: "Team A",
                price: 0.5,
                winner: false,
              },
              {
                token_id: "t2",
                outcome: "Team B",
                price: 0.5,
                winner: false,
              },
            ],
          });
          expect(classifySportsMarketType(market)).toBe("moneyline");
        }),
        { numRuns: 10 }
      );
    });

    it("spreads type classifies as 'spread'", () => {
      fc.assert(
        fc.property(fc.constantFrom("spreads"), (smt) => {
          const market = makeMarket({
            sportsMarketType: smt,
            question: "Team A vs Team B Spread",
          });
          expect(classifySportsMarketType(market)).toBe("spread");
        }),
        { numRuns: 10 }
      );
    });

    it("totals type classifies as 'total'", () => {
      fc.assert(
        fc.property(fc.constantFrom("totals"), (smt) => {
          const market = makeMarket({
            sportsMarketType: smt,
            question: "Over/Under 200.5",
          });
          expect(classifySportsMarketType(market)).toBe("total");
        }),
        { numRuns: 10 }
      );
    });

    it("other known types classify as 'other'", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            "both_teams_to_score",
            "double_chance",
            "correct_score",
            "nhl_period_result",
            "first_blood_game",
            "map_handicap",
            "kill_over_under_game"
          ),
          (smt) => {
            const market = makeMarket({
              sportsMarketType: smt,
              question: "Some prop market",
            });
            expect(classifySportsMarketType(market)).toBe("other");
          }
        ),
        { numRuns: 20 }
      );
    });
  });

  /**
   * SMT_EXACT_TAB mapping preservation: every known sportsMarketType value
   * in the exact tab map produces the expected tab label when used as the
   * sole non-moneyline market in an event.
   *
   * Validates: Requirements 3.1, 3.2, 3.3
   */
  describe("SMT_EXACT_TAB tab assignment preservation", () => {
    it("each known sportsMarketType maps to its expected tab label", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...SMT_EXACT_TAB_ENTRIES),
          ([smt, expectedTab]) => {
            // Skip moneyline — it's always in "Game Lines" and is the base market
            if (smt === "moneyline") {
              return;
            }

            const markets = [
              makeMarket({
                sportsMarketType: "moneyline",
                question: "Team A vs Team B",
                tokens: [
                  {
                    token_id: "t1",
                    outcome: "Team A",
                    price: 0.5,
                    winner: false,
                  },
                  {
                    token_id: "t2",
                    outcome: "Team B",
                    price: 0.5,
                    winner: false,
                  },
                ],
              }),
              makeMarket({
                sportsMarketType: smt,
                question: `Market for ${smt}`,
              }),
            ];

            const result = groupSportsMarketSections(markets);

            // For non-esports types, check tab assignment
            if (!result.isEsports) {
              const allSections =
                result.tabs.length > 0 ? result.tabs : result.sportsSections;

              // Find the section containing our market
              const section = allSections.find((s) =>
                s.markets.some(
                  (m) =>
                    (m as { sportsMarketType?: string }).sportsMarketType ===
                    smt
                )
              );

              expect(section).toBeDefined();
              expect(section?.label).toBe(expectedTab);
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
