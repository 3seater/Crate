/**
 * Preservation property tests for sports game aggregation (Property 2).
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 *
 * These tests capture the CURRENT (correct) behavior of non-buggy inputs
 * on UNFIXED code. They must PASS both before and after the fix to confirm
 * no regressions for non-sports dropdowns, 2-way moneyline, esports tabs,
 * and single-market events.
 *
 * Observation-first methodology: each test encodes observed baseline behavior.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  groupSportsMarketSections,
  groupSportsMarkets,
} from "../../apps/web/src/lib/markets/events";
import { prepareSelectorMarkets } from "../../apps/web/src/lib/markets/prepare-selector-markets";
import type { Market } from "../../apps/web/src/lib/trpc/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

let conditionCounter = 0;

/** Minimal market fixture builder for preservation tests. */
function makeMarket(
  overrides: Partial<Market> & {
    sportsMarketType?: string;
    gameId?: string;
    game_id?: string;
  } = {}
): Market {
  const { sportsMarketType, gameId, game_id, ...rest } = overrides;
  conditionCounter++;
  return {
    question: overrides.question ?? "Test market?",
    active: true,
    closed: false,
    archived: false,
    conditionId:
      overrides.conditionId ?? `cid_preservation_${conditionCounter}`,
    slug: overrides.slug ?? "test-market",
    outcomePrices: overrides.outcomePrices ?? ["0.50", "0.50"],
    tokens: overrides.tokens ?? [
      { token_id: "t1", outcome: "Yes", price: 0.5, winner: false },
      { token_id: "t2", outcome: "No", price: 0.5, winner: false },
    ],
    ...(sportsMarketType ? { sportsMarketType } : {}),
    ...(gameId === undefined ? {} : { gameId }),
    ...(game_id === undefined ? {} : { game_id }),
    ...rest,
  } as Market;
}

// ─── Preservation Tests ──────────────────────────────────────────────────────

describe("Property 2: Preservation — Non-Sports, 2-Way Sports, and Esports Behavior", () => {
  /**
   * Observation: Non-sports multi-market events (political, crypto) with no
   * sportsMarketType produce `groupSportsMarkets().isSports === false` and
   * `groupSportsMarketSections().isEsports === false` with no sports tab UI.
   *
   * **Validates: Requirements 3.1, 3.3**
   */
  describe("Non-sports markets produce isSports=false", () => {
    it("for all non-sports market arrays: groupSportsMarkets(markets).isSports === false", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 8 }),
          fc.constantFrom(
            "Will Biden win 2024?",
            "Bitcoin above $100k by March?",
            "Fed rate cut in June?",
            "Oscar Best Picture winner?",
            "Will TikTok be banned?"
          ),
          (marketCount, baseQuestion) => {
            // Build non-sports markets: no sportsMarketType, Yes/No outcomes
            const markets = Array.from({ length: marketCount }, (_, i) =>
              makeMarket({
                conditionId: `cid_nonsport_${Date.now()}_${i}`,
                question: `${baseQuestion} - Option ${i + 1}`,
                // No sportsMarketType — these are political/crypto markets
              })
            );

            const groups = groupSportsMarkets(markets);
            expect(groups.isSports).toBe(false);
            expect(groups.moneyline).toBeNull();
            expect(groups.moneylineMarkets).toHaveLength(0);

            const sections = groupSportsMarketSections(markets);
            expect(sections.isEsports).toBe(false);
          }
        ),
        { numRuns: 20 }
      );
    });

    it("non-sports multi-market event has showDropdown=true via selectorItems.length > 1", () => {
      fc.assert(
        fc.property(fc.integer({ min: 2, max: 6 }), (marketCount) => {
          const markets = Array.from({ length: marketCount }, (_, i) =>
            makeMarket({
              conditionId: `cid_political_${Date.now()}_${i}`,
              question: `Political outcome ${i + 1}`,
            })
          );

          const selectorItems = prepareSelectorMarkets(markets);
          // Multi-market non-sports event: selectorItems.length > 1
          expect(selectorItems.length).toBeGreaterThan(1);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Observation: 2-way sports events (NBA Warriors vs Hawks, 2 moneyline tokens)
   * produce `moneylineMarkets.length <= 2`, which triggers the `MoneylineRow`
   * path (single "Moneyline" row with price), NOT `ThreeWayMoneylineRow`.
   *
   * **Validates: Requirements 3.6**
   */
  describe("2-way moneyline uses MoneylineRow path", () => {
    it("for all 2-way moneyline configs: moneylineMarkets.length <= 2 → MoneylineRow used", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ["Warriors", "Hawks"],
            ["Lakers", "Celtics"],
            ["Chiefs", "Eagles"],
            ["Yankees", "Dodgers"]
          ),
          fc.constantFrom(0.45, 0.55, 0.6, 0.35),
          (teams, price) => {
            // NBA/NFL-style: 1 moneyline market with 2 team tokens
            const markets: Market[] = [
              makeMarket({
                conditionId: `cid_ml_2way_${Date.now()}`,
                question: `${teams[0]} vs ${teams[1]}`,
                sportsMarketType: "moneyline",
                tokens: [
                  {
                    token_id: "t_home",
                    outcome: teams[0],
                    price,
                    winner: false,
                  },
                  {
                    token_id: "t_away",
                    outcome: teams[1],
                    price: 1 - price,
                    winner: false,
                  },
                ],
              }),
            ];

            const groups = groupSportsMarkets(markets);
            expect(groups.isSports).toBe(true);
            // 2-way: moneylineMarkets.length <= 2
            expect(groups.moneylineMarkets.length).toBeLessThanOrEqual(2);
            // This means SportsTabContent uses MoneylineRow, not ThreeWayMoneylineRow
            // (the conditional is: groups.moneylineMarkets.length > 2 ? ThreeWay : Moneyline)
          }
        ),
        { numRuns: 15 }
      );
    });

    it("2-way sports with spreads/totals still has moneylineMarkets.length <= 2", () => {
      fc.assert(
        fc.property(fc.constantFrom("spreads", "totals"), (extraType) => {
          const markets: Market[] = [
            makeMarket({
              conditionId: `cid_nba_ml_${Date.now()}`,
              question: "Warriors vs Hawks - Moneyline",
              sportsMarketType: "moneyline",
              tokens: [
                {
                  token_id: "t_gsw",
                  outcome: "Warriors",
                  price: 0.55,
                  winner: false,
                },
                {
                  token_id: "t_atl",
                  outcome: "Hawks",
                  price: 0.45,
                  winner: false,
                },
              ],
            }),
            makeMarket({
              conditionId: `cid_nba_extra_${Date.now()}`,
              question: `Warriors vs Hawks - ${extraType}`,
              sportsMarketType: extraType,
            }),
          ];

          const groups = groupSportsMarkets(markets);
          expect(groups.isSports).toBe(true);
          expect(groups.moneylineMarkets.length).toBeLessThanOrEqual(2);
          expect(groups.moneyline).not.toBeNull();
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Observation: Esports events (LoL match with child_moneyline, map_handicap)
   * produce `isEsports === true` and tabs include "Series Lines".
   *
   * **Validates: Requirements 3.5**
   */
  describe("Esports detection and Series Lines tab", () => {
    it("for all esports market arrays with esports-specific types: detectEsportsEvent returns true and tabs include Series Lines", () => {
      fc.assert(
        fc.property(
          fc.constantFrom("child_moneyline", "map_handicap"),
          fc.integer({ min: 1, max: 3 }),
          (esportsType, gameNum) => {
            const markets: Market[] = [
              makeMarket({
                conditionId: `cid_esports_ml_${Date.now()}`,
                question: "T1 vs Gen.G",
                sportsMarketType: "moneyline",
                tokens: [
                  {
                    token_id: "t_t1",
                    outcome: "T1",
                    price: 0.6,
                    winner: false,
                  },
                  {
                    token_id: "t_geng",
                    outcome: "Gen.G",
                    price: 0.4,
                    winner: false,
                  },
                ],
              }),
              makeMarket({
                conditionId: `cid_esports_child_${Date.now()}`,
                question: `Game ${gameNum} Winner`,
                sportsMarketType: esportsType,
              }),
              makeMarket({
                conditionId: `cid_esports_fb_${Date.now()}`,
                question: `Game ${gameNum} First Blood`,
                sportsMarketType: "first_blood_game",
              }),
            ];

            const sections = groupSportsMarketSections(markets);
            expect(sections.isEsports).toBe(true);
            expect(sections.tabs.length).toBeGreaterThanOrEqual(1);
            expect(sections.tabs[0].label).toBe("Series Lines");
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Observation: Single-market events without `game_id` produce
   * `selectorItems.length === 1`, so `showDropdown` remains `false`.
   *
   * **Validates: Requirements 3.2**
   */
  describe("Single-market events without game_id hide dropdown", () => {
    it("for all single-market events without game_id: showDropdown remains false", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            "Will it rain tomorrow?",
            "Bitcoin above $50k?",
            "Austin FC vs LAFC - Moneyline"
          ),
          (question) => {
            // Single market, no game_id
            const markets: Market[] = [
              makeMarket({
                conditionId: `cid_single_${Date.now()}`,
                question,
                // No game_id, no gameId
              }),
            ];

            const selectorItems = prepareSelectorMarkets(markets);
            // Single market → selectorItems.length === 1
            expect(selectorItems.length).toBe(1);

            // showDropdown = hasEvent && selectorItems.length > 1
            // With selectorItems.length === 1, showDropdown is false
            const showDropdown = selectorItems.length > 1;
            expect(showDropdown).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Observation: `prepareSelectorMarkets` with empty array returns empty array.
   * This mirrors `listByGameId` with empty `game_id` returning no markets.
   *
   * **Validates: Requirements 3.4**
   */
  describe("Empty market arrays handled gracefully", () => {
    it("prepareSelectorMarkets with empty array returns empty array", () => {
      const result = prepareSelectorMarkets([]);
      expect(result).toHaveLength(0);
    });

    it("groupSportsMarkets with empty array returns isSports=false", () => {
      const result = groupSportsMarkets([]);
      expect(result.isSports).toBe(false);
      expect(result.moneylineMarkets).toHaveLength(0);
    });
  });

  /**
   * Observation: `groupSportsMarketSections` with non-sports markets
   * produces `isSports === false` (via isEsports check) and no tab UI
   * is triggered for sports.
   *
   * **Validates: Requirements 3.3**
   */
  describe("groupSportsMarketSections with non-sports markets", () => {
    it("non-sports markets produce isEsports=false and no esports tabs", () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 5 }), (count) => {
          const markets = Array.from({ length: count }, (_, i) =>
            makeMarket({
              conditionId: `cid_nonsport_sections_${Date.now()}_${i}`,
              question: `Political market ${i}`,
              // No sportsMarketType
            })
          );

          const sections = groupSportsMarketSections(markets);
          expect(sections.isEsports).toBe(false);
          // Non-sports markets all fall into "Game Lines" via question text fallback
          // With only one tab label, tabs is empty (flat layout)
          expect(sections.tabs).toEqual([]);
        }),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Observation: `groupSportsMarkets` with exactly 2 moneyline markets
   * produces `moneylineMarkets.length === 2`, which is <= 2, so the
   * `MoneylineRow` path is used (not `ThreeWayMoneylineRow`).
   *
   * **Validates: Requirements 3.6**
   */
  describe("groupSportsMarkets with 2 moneyline markets", () => {
    it("2 moneyline markets → moneylineMarkets.length <= 2, uses MoneylineRow path", () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            ["Team Alpha", "Team Beta"],
            ["Red Sox", "Blue Jays"]
          ),
          (teams) => {
            const markets: Market[] = [
              makeMarket({
                conditionId: `cid_ml1_${Date.now()}`,
                question: `${teams[0]} vs ${teams[1]} - ML 1`,
                sportsMarketType: "moneyline",
                tokens: [
                  {
                    token_id: "t_h",
                    outcome: teams[0],
                    price: 0.5,
                    winner: false,
                  },
                  {
                    token_id: "t_a",
                    outcome: teams[1],
                    price: 0.5,
                    winner: false,
                  },
                ],
              }),
              makeMarket({
                conditionId: `cid_ml2_${Date.now()}`,
                question: `${teams[0]} vs ${teams[1]} - ML 2`,
                sportsMarketType: "moneyline",
                tokens: [
                  {
                    token_id: "t_h2",
                    outcome: teams[0],
                    price: 0.45,
                    winner: false,
                  },
                  {
                    token_id: "t_a2",
                    outcome: teams[1],
                    price: 0.55,
                    winner: false,
                  },
                ],
              }),
            ];

            const groups = groupSportsMarkets(markets);
            expect(groups.isSports).toBe(true);
            expect(groups.moneylineMarkets.length).toBeLessThanOrEqual(2);
            // The conditional in SportsTabContent:
            // groups.moneylineMarkets.length > 2 ? ThreeWayMoneylineRow : MoneylineRow
            // With <= 2, MoneylineRow is used
          }
        ),
        { numRuns: 10 }
      );
    });
  });
});
