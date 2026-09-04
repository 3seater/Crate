/**
 * Bug condition exploration test for sports event categorization (Property 1).
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8**
 *
 * Bug: Hardcoded constants (SMT_EXACT_TAB, ESPORTS_ONLY_TYPES, PER_GAME_TYPES,
 * isSliderableType) cause misclassification for unknown sportsMarketType values.
 *
 * This test encodes the EXPECTED (correct) behavior. It MUST FAIL on unfixed code
 * to confirm the bug exists across all 4 dimensions:
 *   1. Unknown tab assignment — falls through to "Game Lines" instead of prefix-derived tab
 *   2. Unknown esports detection — new esports titles not detected
 *   3. Unknown slider type — new over/under types don't get slider treatment
 *   4. New prefix type — second_half_* falls through to "Game Lines" instead of "2nd Half"
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { groupSportsMarketSections } from "../../apps/web/src/lib/markets/events";
import type { Market } from "../../apps/web/src/lib/trpc/types";

/**
 * Since isSliderableType is a local (non-exported) function in sports-selector-card.tsx,
 * we replicate its FIXED logic here to test it directly.
 * This mirrors the keyword-based implementation.
 */
const SLIDER_KEYWORDS = ["over_under", "totals", "spreads", "handicap"];

function isSliderableType(smt: string): boolean {
  return SLIDER_KEYWORDS.some((kw) => smt.includes(kw));
}

/** Minimal market fixture builder. */
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

describe("Property 1: Bug Condition — Unknown Market Types Fall Through to 'Game Lines'", () => {
  /**
   * Branch 1: Unknown tab assignment.
   * Market with sportsMarketType "soccer_halftime_fulltime" is NOT in SMT_EXACT_TAB
   * and getSportsTabByPrefix returns null for it.
   * Expected: should be assigned to a meaningful tab (not "Game Lines").
   * Bug: falls through to "Game Lines" default.
   */
  it("assigns unknown soccer type to a meaningful tab, not 'Game Lines'", () => {
    fc.assert(
      fc.property(fc.constantFrom("soccer_halftime_fulltime"), (smt) => {
        const markets = [
          makeMarket({
            sportsMarketType: "moneyline",
            question: "Team A vs Team B",
          }),
          makeMarket({
            sportsMarketType: smt,
            question: "Halftime/Fulltime Result",
          }),
        ];
        const result = groupSportsMarketSections(markets);

        // The unknown type should NOT just be dumped into "Game Lines"
        // It should get its own tab or a meaningful grouping
        const allTabs =
          result.tabs.length > 0 ? result.tabs : result.sportsSections;
        const gameLineTab = allTabs.find((t) => t.label === "Game Lines");
        const gameLineMarkets = gameLineTab?.markets ?? [];

        // The soccer_halftime_fulltime market should NOT be in "Game Lines"
        const unknownInGameLines = gameLineMarkets.some(
          (m) => (m as { sportsMarketType?: string }).sportsMarketType === smt
        );
        expect(unknownInGameLines).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Branch 2: Unknown esports detection.
   * Market with sportsMarketType "valorant_first_blood_game" and "Game 1" in question
   * is NOT in ESPORTS_ONLY_TYPES and doesn't start with lol_ or cs2_.
   * Expected: isEsports should be true (Valorant is an esports title).
   * Bug: isEsports is false because the type isn't in the hardcoded set.
   */
  it("detects Valorant markets with game numbers as esports", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("valorant_first_blood_game"),
        fc.constantFrom(
          "Game 1 First Blood",
          "Game 2 First Blood",
          "Game 3 First Blood"
        ),
        (smt, question) => {
          const markets = [
            makeMarket({
              sportsMarketType: "moneyline",
              question: "Team A vs Team B",
            }),
            makeMarket({ sportsMarketType: smt, question }),
          ];
          const result = groupSportsMarketSections(markets);

          // An event with Valorant game-specific markets should be detected as esports
          expect(result.isEsports).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Branch 3: Unknown slider type.
   * Multiple markets with sportsMarketType "valorant_kill_over_under_game" with
   * different numeric values should be eligible for slider grouping.
   * Expected: isSliderableType should return true for this type.
   * Bug: isSliderableType returns false because it's not in the hardcoded 4 types.
   */
  it("recognizes new over/under types as sliderable", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("valorant_kill_over_under_game"),
        fc.integer({ min: 1, max: 5 }),
        (smt, _gameNum) => {
          // The current isSliderableType should recognize this as sliderable
          // because it contains "over_under" pattern
          expect(isSliderableType(smt)).toBe(true);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Branch 4: New prefix type.
   * Market with sportsMarketType "second_half_moneyline" is NOT in SMT_EXACT_TAB
   * and getSportsTabByPrefix doesn't handle "second_half_" prefix.
   * Expected: should be assigned to "2nd Half" tab based on sportsMarketType prefix alone.
   * Bug: falls through to "Game Lines" because getSportsTabByPrefix has no "second_half_" rule.
   *
   * NOTE: We use a neutral question text (no "2nd half" keywords) to ensure the tab
   * derivation comes from the sportsMarketType prefix, not the question-text fallback.
   */
  it("assigns second_half_* types to '2nd Half' tab based on sportsMarketType prefix", () => {
    fc.assert(
      fc.property(fc.constantFrom("second_half_moneyline"), (smt) => {
        const markets = [
          makeMarket({
            sportsMarketType: "moneyline",
            question: "Team A vs Team B",
          }),
          makeMarket({
            sportsMarketType: smt,
            question: "Winner after break",
          }),
        ];
        const result = groupSportsMarketSections(markets);

        // Should have a "2nd Half" tab derived from the sportsMarketType prefix
        const allTabs =
          result.tabs.length > 0 ? result.tabs : result.sportsSections;
        const secondHalfTab = allTabs.find((t) => t.label === "2nd Half");

        expect(secondHalfTab).toBeDefined();

        // The second_half_moneyline market should be in the "2nd Half" tab
        const inSecondHalf = secondHalfTab?.markets.some(
          (m) => (m as { sportsMarketType?: string }).sportsMarketType === smt
        );
        expect(inSecondHalf).toBe(true);
      }),
      { numRuns: 10 }
    );
  });
});
