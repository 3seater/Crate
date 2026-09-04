/**
 * Bug condition exploration test for sports game aggregation & three-way moneyline (Property 1).
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.6**
 *
 * Bug Scenario A: The `gameId` field is not explicitly validated in `MarketSchema`
 * (passes through `.loose()`), so it does not appear in the `ValidatedMarket` type.
 * Additionally, `showDropdown` uses `selectorItems.length` from pre-merge single-event
 * markets, so a single-market event with valid `game_id` linking to 10+ game-wide
 * markets will have `showDropdown === false`.
 *
 * Bug Scenario B: `ThreeWayMoneylineRow` renders 3-way outcomes as cramped inline
 * pills (`flex gap-1.5`) instead of full-width rows.
 *
 * This test encodes the EXPECTED (correct) behavior. It MUST FAIL on unfixed code
 * to confirm the bug exists. DO NOT fix the test or the code when it fails.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { MarketSchema } from "../../apps/server/src/lib/polymarket/schemas/gamma";
import { prepareSelectorMarkets } from "../../apps/web/src/lib/markets/prepare-selector-markets";
import type { Market } from "../../apps/web/src/lib/trpc/types";

const SHOW_DROPDOWN_ASSIGN_RE = /const showDropdown\s*=\s*([^;]+);/;

/** Minimal market fixture builder for exploration tests. */
function makeMarket(
  overrides: Partial<Market> & {
    sportsMarketType?: string;
    gameId?: string;
    game_id?: string;
  } = {}
): Market {
  const { sportsMarketType, gameId, game_id, ...rest } = overrides;
  return {
    question: overrides.question ?? "Test market?",
    active: true,
    closed: false,
    archived: false,
    conditionId:
      overrides.conditionId ?? `cid_${Math.random().toString(36).slice(2, 10)}`,
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

describe("Property 1: Bug Condition — Game Aggregation & Three-Way Moneyline", () => {
  /**
   * Scenario A1: MarketSchema validation — gameId not in typed output.
   *
   * The MarketSchema uses `.loose()` which allows extra fields to pass through,
   * but `gameId` is not explicitly declared. The typed output `ValidatedMarket`
   * therefore does not include `gameId` as a known property.
   *
   * Expected (fixed): `gameId` should be an explicit optional field in MarketSchema,
   * so it appears in the typed output after validation.
   *
   * Bug: `.loose()` passes it through at runtime but the TypeScript type doesn't
   * include it, making extraction fragile and requiring unsafe casts.
   */
  it("MarketSchema typed output includes gameId after validation", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("abc123", "soccer-game-456", "nba-game-789"),
        (gameIdValue) => {
          const rawMarket = {
            question: "Austin FC vs LAFC - Moneyline",
            active: true,
            closed: false,
            archived: false,
            conditionId: "0xabc123",
            slug: "austin-fc-vs-lafc-moneyline",
            gameId: gameIdValue,
            outcomePrices: '["0.50","0.50"]',
            tokens: [
              { token_id: "t1", outcome: "Yes", price: 0.5, winner: false },
              { token_id: "t2", outcome: "No", price: 0.5, winner: false },
            ],
          };

          const parsed = MarketSchema.parse(rawMarket);

          // After parsing, gameId should be a known property on the typed output.
          // On unfixed code, `gameId` is NOT in the schema so it won't be in
          // the ValidatedMarket type — this assertion checks the TYPE-LEVEL contract.
          // We check that the parsed result has gameId as an explicit key
          // that TypeScript knows about (not just a .loose() passthrough).
          type ParsedType = typeof parsed;
          type HasGameId = ParsedType extends { gameId?: string }
            ? true
            : false;
          const typeCheck: HasGameId = true;
          expect(typeCheck).toBe(true);

          // Runtime check: gameId should survive parsing and be accessible
          // without unsafe casts
          const typedGameId = (parsed as { gameId?: string }).gameId;
          expect(typedGameId).toBe(gameIdValue);

          // The KEY test: on fixed code, `parsed.gameId` should work directly
          // without casting. We verify the schema explicitly declares it.
          const schemaShape = MarketSchema.shape;
          expect("gameId" in schemaShape).toBe(true);
        }
      ),
      { numRuns: 3 }
    );
  });

  /**
   * Scenario A2: showDropdown logic — single-market soccer event with game_id.
   *
   * Expected (fixed): `showDropdown` should account for game-wide markets,
   * using `eventMarkets.length > 1` as an additional condition beyond just
   * `selectorItems.length > 1`.
   *
   * Bug: `showDropdown` is `hasEvent && selectorItems.length > 1` ONLY. It does
   * not account for the case where `gameId` is present and game-wide markets
   * exist. The source code should include `eventMarkets.length` in the
   * showDropdown condition.
   */
  it("showDropdown accounts for game-wide markets via eventMarkets.length", async () => {
    // Read the source to verify the showDropdown logic accounts for game-wide markets
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sourcePath = path.resolve(
      import.meta.dirname,
      "../../apps/web/src/components/trading/trading-selector-card.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");

    // Find the showDropdown assignment
    const showDropdownMatch = source.match(SHOW_DROPDOWN_ASSIGN_RE);
    expect(showDropdownMatch).not.toBeNull();

    const showDropdownExpr = showDropdownMatch?.[1];

    // On UNFIXED code: showDropdown = hasEvent && selectorItems.length > 1
    // This does NOT account for eventMarkets (game-wide merged markets).
    //
    // On FIXED code: showDropdown should include eventMarkets.length > 1
    // (e.g. `hasEvent && (selectorItems.length > 1 || eventMarkets.length > 1)`)
    //
    // This assertion will FAIL on unfixed code because the expression
    // only references selectorItems, not eventMarkets.
    expect(showDropdownExpr).toContain("eventMarkets");
  });

  /**
   * Scenario A2b: Confirm the bug condition — single-market event produces
   * selectorItems.length === 1, which would hide the dropdown.
   */
  it("single-market event produces selectorItems.length of 1 (bug condition)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 5, max: 20 }), (gameMarketCount) => {
        // Single event has exactly 1 moneyline market
        const singleEventMarkets: Market[] = [
          makeMarket({
            conditionId: "cid_moneyline_1",
            question: "Austin FC vs LAFC - Moneyline",
            sportsMarketType: "moneyline",
            gameId: "soccer-game-123",
            game_id: "soccer-game-123",
          }),
        ];

        // Compute selectorItems from the SINGLE event markets
        const selectorItems = prepareSelectorMarkets(singleEventMarkets);

        // Confirm: single-market event has selectorItems.length === 1
        // This means showDropdown would be false on unfixed code
        expect(selectorItems.length).toBe(1);

        // Game-wide markets would have many more
        const gameMarkets: Market[] = [
          ...singleEventMarkets,
          ...Array.from({ length: gameMarketCount }, (_, i) =>
            makeMarket({
              conditionId: `cid_game_${i}`,
              question: `Game market ${i}`,
              sportsMarketType: i % 2 === 0 ? "spreads" : "totals",
            })
          ),
        ];
        const mergedSelectorItems = prepareSelectorMarkets(gameMarkets);
        expect(mergedSelectorItems.length).toBeGreaterThan(1);
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Scenario B: ThreeWayMoneylineRow renders full-width rows, not inline pills.
   *
   * When a soccer/draw sport has 3 moneyline outcomes, each outcome should render
   * as its own full-width row (like OptionRow) with the full label and price.
   *
   * Expected (fixed): Each outcome gets a full-width row element.
   *
   * Bug: Current code renders `<div class="flex gap-1.5">` with `flex-1` pills,
   * causing labels to truncate (e.g. "Los Ange...").
   *
   * Since ThreeWayMoneylineRow is a React component, we test the structural
   * expectation by examining the source code pattern. The component should NOT
   * use `flex gap-1.5` for the outcomes container — it should use a vertical
   * layout (flex-col or similar) with full-width rows.
   */
  it("ThreeWayMoneylineRow uses vertical full-width rows, not inline pills", async () => {
    // Read the source to verify the layout pattern
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sourcePath = path.resolve(
      import.meta.dirname,
      "../../apps/web/src/components/trading/sports-selector-card.tsx"
    );
    const source = fs.readFileSync(sourcePath, "utf-8");

    // Extract the ThreeWayMoneylineRow function body
    const fnStart = source.indexOf("function ThreeWayMoneylineRow(");
    expect(fnStart).toBeGreaterThan(-1);

    // Find the end of the function (next top-level function or end of file)
    const fnBody = source.slice(fnStart, fnStart + 2000);

    // Bug assertion: The component should NOT use "flex gap-1.5" for the
    // outcomes container. It should use full-width rows (flex-col or w-full).
    //
    // On UNFIXED code: the component has `<div className="flex gap-1.5">`
    // which renders cramped inline pills. This assertion will FAIL.
    //
    // On FIXED code: the component should use a vertical layout.
    const hasInlinePillLayout = fnBody.includes("flex gap-1.5");
    expect(hasInlinePillLayout).toBe(false);

    // The component should render each outcome as a full-width element
    // (either using w-full, flex-col for the container, or individual rows)
    const hasVerticalLayout =
      fnBody.includes("flex-col") || fnBody.includes("flex flex-col");

    // On unfixed code, the outer container has flex-col but the INNER
    // outcomes container uses "flex gap-1.5" (horizontal). We need to check
    // that the outcomes themselves are NOT in a horizontal flex container.
    // The presence of "flex gap-1.5" is the definitive bug marker.
    expect(hasVerticalLayout).toBe(true);
    expect(hasInlinePillLayout).toBe(false);
  });
});
