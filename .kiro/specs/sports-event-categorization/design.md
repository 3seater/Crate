# Sports Event Categorization Bugfix Design

## Overview

The sports event categorization system in `events.ts` hardcodes NBA-centric constants (`SMT_EXACT_TAB`, `ESPORTS_ONLY_TYPES`, `SERIES_LEVEL_TYPES`, `PER_GAME_TYPES`) and rigid classification logic (`classifySportsMarketType`, `isSliderableType`) that fails for soccer, cricket, tennis, UFC, NHL, and new esports titles. The fix replaces all hardcoded mappings with a dynamic prefix-pattern-based tab derivation system that infers tab names from `sportsMarketType` string values and question text, unifies the sports/esports code paths, and dynamically determines slider eligibility from market data patterns.

## Glossary

- **Bug_Condition (C)**: An event contains markets whose `sportsMarketType` values are NOT present in the hardcoded `SMT_EXACT_TAB` map, `ESPORTS_ONLY_TYPES` set, `SERIES_LEVEL_TYPES` set, or `PER_GAME_TYPES` set — causing misclassification, wrong tab assignment, or missing slider grouping
- **Property (P)**: All markets in an event are assigned to the correct tab and rendering category based on their `sportsMarketType` prefix pattern and question text, regardless of whether the type was known at build time
- **Preservation**: Existing NBA/basketball tab structure (Game Lines, 1st Half), existing LoL/CS2 esports tab structure (Series Lines, Game N, Map N), moneyline/spreads/totals slider rendering, single-tab flat layout, and question-text fallback heuristics must all continue to work identically
- **`sportsMarketType`**: A string field on each market (passed through via `.loose()`) that identifies the market category (e.g. `moneyline`, `first_half_spreads`, `kill_over_under_game`). ~97 known values from the Polymarket API
- **Tab derivation**: The process of mapping a `sportsMarketType` string to a UI tab label using prefix patterns (e.g. `first_half_*` → "1st Half") and question text parsing (e.g. "Game 3" → "Game 3" tab)
- **`groupSportsMarketSections()`**: The core function in `events.ts` that takes an array of markets and returns `SportsMarketSections` with tabs, isEsports flag, and sportsSections
- **`classifySportsMarketType()`**: Function that classifies a market into moneyline/spread/total/other for rendering within a tab
- **`isSliderableType()`**: Function in `sports-selector-card.tsx` that determines if a market type supports slider grouping (multiple numeric values in a row)

## Bug Details

### Bug Condition

The bug manifests when an event contains markets with `sportsMarketType` values that are not present in the hardcoded constants. The system either assigns them to the wrong tab (defaulting to "Game Lines"), fails to detect esports events, renders markets as individual rows instead of sliders, or classifies them as "other" losing special rendering treatment.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { markets: Market[], sportsMarketType: string }
  OUTPUT: boolean

  // Condition 1: Unknown sportsMarketType for tab assignment
  unknownTab := input.sportsMarketType NOT IN SMT_EXACT_TAB
                AND getSportsTabByPrefix(input.sportsMarketType) = null

  // Condition 2: Esports event with unknown esports types
  unknownEsports := hasEsportsPatterns(input.markets)
                    AND NOT input.markets.some(m => ESPORTS_ONLY_TYPES.has(m.sportsMarketType))

  // Condition 3: Sliderable type not in hardcoded list
  unknownSlider := input.markets.filter(m => m.sportsMarketType = input.sportsMarketType).length > 1
                   AND hasNumericVariation(input.markets, input.sportsMarketType)
                   AND input.sportsMarketType NOT IN ['kill_over_under_game', 'totals', 'spreads', 'map_handicap']

  // Condition 4: Classification falls to "other" for a categorizable type
  unknownCategory := input.sportsMarketType NOT IN ['moneyline', 'spreads', 'totals']
                     AND isCategorizable(input.sportsMarketType)

  RETURN unknownTab OR unknownEsports OR unknownSlider OR unknownCategory
END FUNCTION
```

### Examples

- **Soccer `both_teams_to_score`**: Currently mapped to "Game Lines" via `SMT_EXACT_TAB`. Should remain in "Game Lines" for now, but new soccer types like `soccer_halftime_fulltime` would fall through to the regex fallback and land in "Game Lines" by default instead of being grouped logically
- **New esports title (Valorant)**: If Polymarket adds `valorant_first_blood_game`, the system won't detect the event as esports because the type isn't in `ESPORTS_ONLY_TYPES`. Markets render using the traditional sports path with wrong tab structure
- **Cricket `cricket_first_inning_runs`**: Currently hardcoded in `SMT_EXACT_TAB` → "1st Innings". But `cricket_top_batsman` (hypothetical new type) would fall through to `getSportsTabByPrefix` which returns "Game Lines" for all `cricket_*` prefixes — wrong tab
- **Multiple `first_half_spreads` markets**: These have slider support because `spreads` is in `isSliderableType()`. But `first_half_totals` with multiple lines would also need slider support — it works because the inner `groupSportsMarkets` handles it. However, esports types like `cs2_kill_over_under_game` with multiple values DO get slider treatment because `kill_over_under_game` is checked. A new type like `valorant_kill_over_under_game` would NOT get slider treatment

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- NBA/basketball events with moneyline/spreads/totals render "Game Lines" and "1st Half" tabs with MoneylineRow, Spreads slider, Totals slider
- LoL esports events render "Series Lines" and "Game N" tabs with correct market grouping
- CS2 esports events render "Series Lines" and "Map N" tabs
- Markets with `sportsMarketType: "moneyline"` render as MoneylineRow
- Markets with `sportsMarketType: "spreads"` render as GameLineSliderRow with spread values
- Markets with `sportsMarketType: "totals"` render as GameLineSliderRow with over/under values
- Single-tab events render without TabBar (flat layout)
- Markets without `sportsMarketType` fall back to question text heuristics
- `events.sportsMarketTypes` tRPC endpoint continues returning valid types from Gamma API

**Scope:**
All inputs where every market's `sportsMarketType` is present in the current hardcoded constants should produce identical output. The fix only changes behavior for markets with unknown/new `sportsMarketType` values.

## Hypothesized Root Cause

Based on the bug description, the most likely issues are:

1. **Hardcoded `SMT_EXACT_TAB` map**: Contains ~40 explicit `sportsMarketType → tab` mappings. Any new type added by Polymarket requires a code change. The `getSportsTabByPrefix()` fallback only handles 5 prefix patterns and defaults unknown prefixes to "Game Lines"

2. **Hardcoded esports detection sets**: `ESPORTS_ONLY_TYPES` (13 values), `SERIES_LEVEL_TYPES` (5 values), `PER_GAME_TYPES` (12 values) are all static. New esports games with their own market type prefixes (e.g. `valorant_*`, `dota2_*`) won't be detected as esports

3. **Hardcoded `isSliderableType()`**: Only 4 types (`kill_over_under_game`, `totals`, `spreads`, `map_handicap`) support slider grouping. Any new type with multiple numeric values (e.g. `first_half_totals` with multiple lines in esports context, or new game-specific over/under types) won't get slider treatment

4. **Rigid sports/esports branching**: `groupSportsMarketSections()` has completely separate code paths for esports vs traditional sports. The esports path uses `PER_GAME_TYPES` and `SERIES_LEVEL_TYPES` sets; the sports path uses `getSportsTabLabel()`. This duplication means fixes/improvements must be applied twice

5. **No dynamic type discovery**: The `/sports/market-types` endpoint returns ~97 types but the frontend never uses this data to inform categorization. The types are fetched but only exposed as a tRPC endpoint — not consumed by the grouping logic

## Correctness Properties

Property 1: Bug Condition - Dynamic Tab Derivation for Unknown Market Types

_For any_ event containing markets with `sportsMarketType` values NOT present in the current hardcoded `SMT_EXACT_TAB` map, the fixed `groupSportsMarketSections()` function SHALL assign each market to a tab derived from its `sportsMarketType` prefix pattern (e.g. `first_half_*` → "1st Half", `tennis_first_set_*` → "1st Set", `cricket_first_inning_*` → "1st Innings") or from question text patterns (e.g. "Game N" → "Game N" tab), rather than defaulting to "Game Lines".

**Validates: Requirements 2.1, 2.2, 2.5**

Property 2: Preservation - Existing Tab Structure for Known Market Types

_For any_ event where ALL markets have `sportsMarketType` values that ARE present in the current hardcoded constants (NBA moneyline/spreads/totals, LoL/CS2 esports types, cricket innings, NHL periods, player props), the fixed `groupSportsMarketSections()` function SHALL produce the exact same `SportsMarketSections` output (same tabs, same tab labels, same market assignments, same isEsports flag) as the original function.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/web/src/lib/markets/events.ts`

**Functions**: `groupSportsMarketSections()`, `getSportsTabLabel()`, `classifySportsMarketType()`, and related constants

**Specific Changes**:

1. **Replace `SMT_EXACT_TAB` with ordered prefix-pattern rules**: Instead of a flat `Record<string, string>`, use an ordered array of `{ pattern: string | RegExp, tab: string }` rules. Patterns are checked in order — first match wins. This allows both exact matches (for backward compat) and prefix/regex matches (for new types). The existing exact mappings become rules at the top of the list, preserving current behavior.

   ```typescript
   // Example rule structure (not exhaustive)
   const TAB_RULES: Array<{ match: string | ((smt: string) => boolean); tab: string }> = [
     // Exact matches for backward compat
     { match: "moneyline", tab: "Game Lines" },
     { match: "spreads", tab: "Game Lines" },
     { match: "totals", tab: "Game Lines" },
     // Prefix patterns
     { match: (smt) => smt.startsWith("first_half_"), tab: "1st Half" },
     { match: (smt) => smt.startsWith("tennis_first_set_"), tab: "1st Set" },
     { match: (smt) => smt.startsWith("cricket_first_inning"), tab: "1st Innings" },
     { match: (smt) => smt.startsWith("cricket_second_inning"), tab: "2nd Innings" },
     // Player props (any type containing known prop keywords)
     { match: (smt) => PLAYER_PROP_PATTERNS.some(p => smt.includes(p)), tab: "Player Props" },
     // Fallback: derive from prefix (e.g. "nhl_period_result" → "Periods")
   ];
   ```

2. **Replace hardcoded esports detection with pattern-based detection**: Instead of `ESPORTS_ONLY_TYPES` set, detect esports by:
   - Presence of game/map number patterns in question text ("Game N", "Map N")
   - Known esports prefixes (`lol_`, `cs2_`, `valorant_`, `dota2_`, etc.)
   - Presence of `child_moneyline`, `map_handicap`, `first_blood_game` types
   - The key insight: if ANY market in the event has a game/map number in its question, the event likely has per-game structure

3. **Replace `SERIES_LEVEL_TYPES` and `PER_GAME_TYPES` with dynamic classification**: Instead of hardcoded sets, classify markets as series-level vs per-game based on:
   - If the market's question contains "Game N" or "Map N" → per-game (goes to "Game N" / "Map N" tab)
   - If the market's `sportsMarketType` is a known series type (moneyline, totals, spreads, child_moneyline, map_handicap) OR has no game number → series-level
   - This naturally handles new esports game types without code changes

4. **Replace `isSliderableType()` with dynamic slider detection**: Instead of checking against 4 hardcoded types, determine slider eligibility by:
   - Multiple markets with the same `sportsMarketType` within a tab
   - Markets have numeric variation (different spread/total values extractable from outcomes or questions)
   - This is a data-driven check: `markets.filter(m => smt === getSportsMarketTypeField(m)).length > 1 && hasNumericVariation(markets)`

5. **Unify sports/esports code path in `groupSportsMarketSections()`**: Use a single flow:
   - Step 1: Detect if event has per-game/map structure (esports-like)
   - Step 2: For each market, derive its tab label using the unified rule system
   - Step 3: Group markets by tab label
   - Step 4: Sort tabs (Game Lines first, then alphabetical or by game number)
   - The `isEsports` flag is still set for the UI to choose `EsportsTabContent` vs `SportsTabContent` rendering

**File**: `apps/web/src/components/trading/sports-selector-card.tsx`

**Function**: `isSliderableType()`

**Specific Changes**:

6. **Make `isSliderableType()` data-driven**: Replace the hardcoded 4-type check with a function that takes the market array context and determines slider eligibility based on whether multiple markets of the same type exist with numeric variation in their outcomes.

**File**: `apps/server/src/routers/events.ts` (no changes needed)

The existing `sportsMarketTypes` endpoint already returns the full list from Gamma. The frontend can optionally fetch this for validation/discovery, but the core fix is in the prefix-pattern derivation which doesn't require the API list.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that call `groupSportsMarketSections()` and `classifySportsMarketType()` with markets containing unknown `sportsMarketType` values and verify the incorrect tab assignments and classifications. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Unknown soccer type test**: Create markets with `sportsMarketType: "soccer_halftime_fulltime"` and verify it falls through to "Game Lines" instead of a meaningful tab (will fail on unfixed code — it incorrectly assigns to "Game Lines")
2. **Unknown esports title test**: Create markets with `sportsMarketType: "valorant_first_blood_game"` with "Game 1" in question text and verify the event is NOT detected as esports (will fail on unfixed code — `isEsports` is false)
3. **Unknown slider type test**: Create multiple markets with `sportsMarketType: "valorant_kill_over_under_game"` with different numeric values and verify `isSliderableType()` returns false (will fail on unfixed code — renders individual rows)
4. **New prefix type test**: Create markets with `sportsMarketType: "second_half_moneyline"` and verify it falls through to "Game Lines" instead of "2nd Half" (will fail on unfixed code — no prefix rule for `second_half_`)

**Expected Counterexamples**:
- `groupSportsMarketSections()` assigns unknown types to "Game Lines" tab
- `isEsportsMarketType()` returns false for new esports game prefixes
- `isSliderableType()` returns false for new over/under type strings
- Possible causes: hardcoded constants, missing prefix patterns, rigid esports detection

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := groupSportsMarketSections_fixed(input.markets)
  ASSERT each market is assigned to a tab derived from its sportsMarketType prefix or question text
  ASSERT esports events with game/map patterns are detected as isEsports = true
  ASSERT markets with numeric variation get slider treatment
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT groupSportsMarketSections_original(input) = groupSportsMarketSections_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain of known market types
- It catches edge cases in tab ordering, market assignment, and slider grouping
- It provides strong guarantees that behavior is unchanged for all currently-working sports

**Test Plan**: Observe behavior on UNFIXED code first for NBA, LoL, CS2, and other known sports, then write property-based tests capturing that behavior.

**Test Cases**:
1. **NBA preservation**: Verify NBA events with moneyline/spreads/totals produce identical `SportsMarketSections` output before and after fix
2. **LoL preservation**: Verify LoL events with series-level and per-game markets produce identical tab structure
3. **CS2 preservation**: Verify CS2 events with map-based markets produce identical "Map N" tabs
4. **Single-tab preservation**: Verify events with only one logical tab still render without TabBar
5. **No-sportsMarketType preservation**: Verify markets without `sportsMarketType` still fall back to question text heuristics

### Unit Tests

- Test `deriveTabLabel()` (new function) with all known `sportsMarketType` values to verify backward compatibility
- Test `deriveTabLabel()` with unknown types to verify prefix-based derivation
- Test esports detection with new game prefixes
- Test dynamic slider eligibility with various market configurations
- Test unified `groupSportsMarketSections()` with mixed sports/esports events

### Property-Based Tests

- Generate random `sportsMarketType` strings from known prefixes and verify tab assignment follows prefix rules
- Generate random market configurations with known types and verify output matches original function
- Generate events with varying numbers of markets per type and verify slider eligibility is correctly determined

### Integration Tests

- Test full rendering flow with `SportsDropdownContent` for NBA, soccer, cricket, tennis, UFC, NHL events
- Test esports rendering for LoL, CS2, and hypothetical new game titles
- Test that TabBar appears/disappears correctly based on number of derived tabs
