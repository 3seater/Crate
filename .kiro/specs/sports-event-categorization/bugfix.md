# Bugfix Requirements Document

## Introduction

The sports event categorization system in the Doji app hardcodes market type classifications, tab structures, and esports detection logic that is NBA/basketball-centric. This causes incorrect or missing categorization for other sports (soccer, esports/LoL/CS2, cricket, tennis, UFC, NHL, etc.). Markets for non-NBA sports are either dumped into a generic "Game Lines" tab, misclassified into wrong categories, or silently dropped when their `sportsMarketType` values don't match the hardcoded constants.

The root cause is that `events.ts` uses hardcoded `Set` constants (`ESPORTS_ONLY_TYPES`, `SERIES_LEVEL_TYPES`, `PER_GAME_TYPES`), a hardcoded `SMT_EXACT_TAB` map, and rigid `classifySportsMarketType()` logic instead of dynamically deriving tab structure and categories from the actual `sportsMarketType` values present in an event's markets and the Polymarket `/sports/market-types` API.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN an event contains markets with `sportsMarketType` values not present in the `SMT_EXACT_TAB` map (e.g. a new esports game type, or a sport-specific type like `nfl_rushing_yards`) THEN the system falls through to the regex-based question text fallback and assigns the market to "Game Lines" regardless of its actual category

1.2 WHEN an event contains soccer-specific market types such as `both_teams_to_score`, `double_chance`, `correct_score`, `soccer_exact_score`, or `soccer_anytime_goalscorer` THEN the system dumps them all into the "Game Lines" tab instead of organizing them into meaningful sub-groups (e.g. a "Goal Markets" or "Match Specials" tab)

1.3 WHEN an event contains esports markets with `sportsMarketType` values not present in the `ESPORTS_ONLY_TYPES` set (e.g. a new esports game like Valorant or Dota 2 with its own market types) THEN the system fails to detect the event as esports and renders it using the traditional sports code path with incorrect tab structure

1.4 WHEN `classifySportsMarketType()` encounters a market with a `sportsMarketType` value other than `moneyline`, `spreads`, or `totals` (e.g. `both_teams_to_score`, `double_chance`, `map_handicap`, `first_blood_game`) THEN the system classifies it as `"other"` and it receives no slider grouping or special rendering treatment

1.5 WHEN `groupSportsMarketSections()` processes a traditional sports event THEN the system uses the hardcoded `getSportsTabLabel()` function which relies on `SMT_EXACT_TAB` and `getSportsTabByPrefix()`, meaning any new sport or market type added by Polymarket requires a code change to be properly categorized

1.6 WHEN `groupSportsMarketSections()` processes an esports event THEN the system uses hardcoded `SERIES_LEVEL_TYPES` and `PER_GAME_TYPES` sets to decide which tab a market belongs to, meaning new esports-specific market types (e.g. from a new game) are not routed to the correct tab

1.7 WHEN the Polymarket Gamma API adds new `sportsMarketType` values via the `/sports/market-types` endpoint THEN the system has no mechanism to discover or incorporate them — the hardcoded constants remain stale until a developer manually updates the code

1.8 WHEN `isSliderableType()` in `sports-selector-card.tsx` encounters a market type that should support slider grouping but is not in its hardcoded list (`kill_over_under_game`, `totals`, `spreads`, `map_handicap`) THEN the system renders individual rows instead of a consolidated slider row

### Expected Behavior (Correct)

2.1 WHEN an event contains markets with any `sportsMarketType` value THEN the system SHALL dynamically derive the tab structure from the actual `sportsMarketType` values present in the event's markets, without requiring those values to exist in a hardcoded map

2.2 WHEN an event contains soccer-specific market types such as `both_teams_to_score`, `double_chance`, `correct_score`, or `soccer_anytime_goalscorer` THEN the system SHALL group them into appropriate tabs derived from the market type metadata (e.g. grouping by a common prefix or category) rather than dumping them all into "Game Lines"

2.3 WHEN an event contains esports markets THEN the system SHALL detect the esports nature dynamically (e.g. from the presence of game/map number patterns in questions, or from the market type values themselves) rather than relying on a hardcoded `ESPORTS_ONLY_TYPES` set

2.4 WHEN `classifySportsMarketType()` encounters a market with any `sportsMarketType` value THEN the system SHALL use the market type metadata to determine the correct category and rendering treatment, supporting categories beyond just moneyline/spread/total/other

2.5 WHEN `groupSportsMarketSections()` processes any sports or esports event THEN the system SHALL use a single unified code path that derives tabs and groupings from the actual market data, eliminating the separate esports vs traditional sports branching

2.6 WHEN `groupSportsMarketSections()` processes an esports event THEN the system SHALL dynamically determine which markets are series-level vs per-game based on the market data (game/map numbers in questions, market type patterns) rather than hardcoded type sets

2.7 WHEN the Polymarket Gamma API adds new `sportsMarketType` values THEN the system SHALL automatically incorporate them into the categorization by fetching available types from the `/sports/market-types` endpoint and using them to inform tab/category derivation

2.8 WHEN multiple markets share the same `sportsMarketType` and have varying numeric values (e.g. multiple spread lines or total lines) THEN the system SHALL dynamically determine slider eligibility based on the market data pattern (multiple markets of same type with numeric variation) rather than a hardcoded type list

### Unchanged Behavior (Regression Prevention)

3.1 WHEN an NBA/basketball event contains moneyline, spreads, and totals markets with "Game Lines" and "1st Half" tabs THEN the system SHALL CONTINUE TO render the correct tab structure with Moneyline row, Spreads slider, and Totals slider within each tab

3.2 WHEN an esports LoL event contains series-level and per-game markets THEN the system SHALL CONTINUE TO render "Series Lines" and "Game N" tabs with correct market grouping (Moneyline, Game Winner slider, Game Handicap, Total Games in Series Lines; per-game props in Game tabs)

3.3 WHEN an esports CS2 event contains map-based markets THEN the system SHALL CONTINUE TO render "Series Lines" and "Map N" tabs with correct market grouping

3.4 WHEN a market has `sportsMarketType: "moneyline"` THEN the system SHALL CONTINUE TO render it as a MoneylineRow with team names and prices

3.5 WHEN a market has `sportsMarketType: "spreads"` with multiple spread lines THEN the system SHALL CONTINUE TO render it as a GameLineSliderRow with navigable spread values

3.6 WHEN a market has `sportsMarketType: "totals"` with multiple total lines THEN the system SHALL CONTINUE TO render it as a GameLineSliderRow with navigable over/under values

3.7 WHEN an event has only one logical tab of markets THEN the system SHALL CONTINUE TO render without the tab bar UI (flat layout)

3.8 WHEN a market has no `sportsMarketType` field THEN the system SHALL CONTINUE TO fall back to question text heuristics for classification

3.9 WHEN the `events.sportsMarketTypes` tRPC endpoint is called THEN the system SHALL CONTINUE TO return the valid sports market types from the Polymarket Gamma API
