# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Unknown Market Types Fall Through to "Game Lines"
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate hardcoded constants cause misclassification for unknown `sportsMarketType` values
  - **Scoped PBT Approach**: Scope the property to concrete failing cases that exercise all 4 bug condition branches from the design:
    1. Unknown tab assignment: market with `sportsMarketType: "soccer_halftime_fulltime"` — `groupSportsMarketSections()` assigns to "Game Lines" instead of a meaningful tab derived from prefix
    2. Unknown esports detection: market with `sportsMarketType: "valorant_first_blood_game"` and "Game 1" in question — `isEsports` is `false` instead of `true`
    3. Unknown slider type: multiple markets with `sportsMarketType: "valorant_kill_over_under_game"` with different numeric values — `isSliderableType()` returns `false`
    4. New prefix type: market with `sportsMarketType: "second_half_moneyline"` — falls through to "Game Lines" instead of "2nd Half"
  - Write property-based test using `fast-check` in `tests/unit/sports-categorization-exploration.property.test.ts`
  - Generate markets with unknown `sportsMarketType` values using `fc.constantFrom(...)` for the concrete failing cases
  - Assert expected behavior: correct tab derivation from prefix, esports detection from question patterns, slider eligibility from data patterns
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists in all 4 dimensions)
  - Document counterexamples found (e.g., `groupSportsMarketSections([{sportsMarketType: "valorant_first_blood_game", question: "Game 1 First Blood"}])` returns `isEsports: false`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Known Market Types Produce Identical Output
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for all known market type configurations:
    - Observe: NBA event with `moneyline`/`spreads`/`totals` → "Game Lines" tab + "1st Half" tab structure
    - Observe: LoL esports event with `child_moneyline`/`first_blood_game`/`kill_over_under_game` + "Game N" questions → `isEsports: true`, "Series Lines" + "Game N" tabs
    - Observe: CS2 esports event with `cs2_first_blood_game`/`cs2_kill_over_under_game` + "Map N" questions → `isEsports: true`, "Series Lines" + "Map N" tabs
    - Observe: Single-tab event with only `moneyline`/`spreads`/`totals` → `tabs: []`, `sportsSections` with one entry (flat layout)
    - Observe: Markets without `sportsMarketType` → question text heuristic fallback ("1st Half" from "1st half" in question)
    - Observe: `isSliderableType("kill_over_under_game")` returns `true`, `isSliderableType("totals")` returns `true`
  - Write property-based test using `fast-check` in `tests/unit/sports-categorization-preservation.property.test.ts`
  - Generate market arrays from known `sportsMarketType` values using `fc.constantFrom(...)` over all values in `SMT_EXACT_TAB`, `ESPORTS_ONLY_TYPES`, `SERIES_LEVEL_TYPES`, `PER_GAME_TYPES`
  - Assert: `groupSportsMarketSections()` output matches observed baseline (same tabs, same tab labels, same market assignments, same `isEsports` flag)
  - Assert: `classifySportsMarketType()` returns same category for all known types
  - Assert: `isSliderableType()` returns same result for all 4 known sliderable types
  - Verify test passes on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [x] 3. Implement dynamic prefix-pattern-based tab derivation system

  - [x] 3.1 Replace `SMT_EXACT_TAB` map and prefix function with ordered `TAB_RULES` array in `events.ts`
    - Replace the flat `SMT_EXACT_TAB: Record<string, string>` and `getSportsTabByPrefix()` with an ordered `TAB_RULES` array of `{ match: string | ((smt: string) => boolean); tab: string }` rules
    - Preserve all existing exact mappings as rules at the top of the list (backward compat)
    - Add prefix-pattern rules: `first_half_*` → "1st Half", `second_half_*` → "2nd Half", `tennis_first_set_*` → "1st Set", `cricket_first_inning*` → "1st Innings", `cricket_second_inning*` → "2nd Innings"
    - Add player prop keyword detection rule
    - Add fallback rule that derives tab from prefix (e.g. `nhl_period_result` → "Periods")
    - Update `getSportsTabLabel()` to iterate `TAB_RULES` in order (first match wins) instead of using `SMT_EXACT_TAB` + `getSportsTabByPrefix()`
    - _Bug_Condition: isBugCondition(input) where sportsMarketType NOT IN SMT_EXACT_TAB AND getSportsTabByPrefix returns null_
    - _Expected_Behavior: Tab derived from sportsMarketType prefix pattern or question text, not defaulting to "Game Lines"_
    - _Preservation: All existing SMT_EXACT_TAB mappings become exact-match rules at top of TAB_RULES, producing identical output_
    - _Requirements: 2.1, 2.2, 2.5, 3.1, 3.2, 3.3_

  - [x] 3.2 Replace hardcoded esports detection with pattern-based detection in `events.ts`
    - Replace `ESPORTS_ONLY_TYPES` set check in `isEsportsMarketType()` with pattern-based detection:
      - Known esports prefixes: `lol_`, `cs2_`, `valorant_`, `dota2_`, etc.
      - Known esports-only type keywords: `child_moneyline`, `map_handicap`, `first_blood`, `kill_over_under`
      - Question text patterns: presence of "Game N" or "Map N" in any market's question
    - Update `groupSportsMarketSections()` esports detection to use the new pattern-based approach
    - _Bug_Condition: isBugCondition(input) where hasEsportsPatterns(markets) AND NOT markets.some(m => ESPORTS_ONLY_TYPES.has(m.sportsMarketType))_
    - _Expected_Behavior: Esports events detected via prefix patterns and question text, not hardcoded set membership_
    - _Preservation: Existing LoL/CS2 events still detected as esports (lol_/cs2_ prefixes still match)_
    - _Requirements: 2.3, 2.6, 3.2, 3.3_

  - [x] 3.3 Replace `SERIES_LEVEL_TYPES` and `PER_GAME_TYPES` with dynamic classification in `events.ts`
    - Replace hardcoded `SERIES_LEVEL_TYPES` and `PER_GAME_TYPES` sets with dynamic classification:
      - If market question contains "Game N" or "Map N" → per-game (goes to "Game N" / "Map N" tab)
      - If market `sportsMarketType` is a known series type OR has no game number → series-level
    - Update the esports branch of `groupSportsMarketSections()` to use dynamic classification instead of set membership
    - _Bug_Condition: isBugCondition(input) where sportsMarketType NOT IN PER_GAME_TYPES AND NOT IN SERIES_LEVEL_TYPES_
    - _Expected_Behavior: Markets classified as series-level vs per-game based on question text game/map numbers_
    - _Preservation: Existing LoL "Game N" and CS2 "Map N" tab structure unchanged_
    - _Requirements: 2.5, 2.6, 3.2, 3.3_

  - [x] 3.4 Unify sports/esports code paths in `groupSportsMarketSections()` in `events.ts`
    - Merge the separate esports and traditional sports branches into a single unified flow:
      - Step 1: Detect if event has per-game/map structure (esports-like) using pattern-based detection
      - Step 2: For each market, derive tab label using unified `TAB_RULES` system
      - Step 3: Group markets by tab label
      - Step 4: Sort tabs ("Game Lines" or "Series Lines" first, then alphabetical or by game number)
    - Keep `isEsports` flag for UI rendering choice (`EsportsTabContent` vs `SportsTabContent`)
    - _Bug_Condition: Separate code paths mean fixes must be applied twice; new sports/esports types may hit wrong path_
    - _Expected_Behavior: Single code path handles all sports and esports events_
    - _Preservation: Output structure (tabs, isEsports, sportsSections) remains identical for all known market types_
    - _Requirements: 2.1, 2.5, 2.6, 3.1, 3.2, 3.3, 3.7_

  - [x] 3.5 Make `isSliderableType()` data-driven in `sports-selector-card.tsx`
    - Replace the hardcoded 4-type check in `isSliderableType()` with a data-driven approach:
      - Check if the `sportsMarketType` contains known slider keywords: `over_under`, `totals`, `spreads`, `handicap`
      - OR check if multiple markets of the same type exist with numeric variation in outcomes
    - Update `EsportsTabContent` to pass market context if needed for dynamic slider detection
    - _Bug_Condition: isBugCondition(input) where markets have numeric variation AND sportsMarketType NOT IN hardcoded 4 types_
    - _Expected_Behavior: Slider eligibility determined by market data patterns (multiple markets + numeric variation) or type keywords_
    - _Preservation: Existing 4 types (kill_over_under_game, totals, spreads, map_handicap) still return true_
    - _Requirements: 2.8, 3.4, 3.5, 3.6_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Unknown Market Types Get Correct Tab Derivation
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior for all 4 bug condition branches
    - When this test passes, it confirms:
      1. Unknown types get tabs derived from prefix patterns
      2. New esports titles detected via question text and prefix patterns
      3. New slider types get slider treatment based on data patterns
      4. New prefix types get correct tab labels
    - Run bug condition exploration test from step 1: `pnpm vitest run tests/unit/sports-categorization-exploration.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed across all 4 dimensions)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Known Market Types Still Produce Identical Output
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2: `pnpm vitest run tests/unit/sports-categorization-preservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions for NBA, LoL, CS2, single-tab, question-text fallback)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run full test suite: `pnpm vitest run tests/unit/sports-categorization-exploration.property.test.ts tests/unit/sports-categorization-preservation.property.test.ts`
  - Ensure both Property 1 (bug condition → expected behavior) and Property 2 (preservation) pass
  - Run `pnpm test` to ensure no other tests are broken by the changes
  - Ensure all tests pass, ask the user if questions arise
