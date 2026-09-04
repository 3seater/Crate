# Bugfix Requirements Document

## Introduction

The sports trading dropdown (`TradingSelectorCard` → `SportsDropdownContent`) only displays moneyline markets from the current event when viewing a sports market at `/market/{slug}`. Polymarket structures sports games as multiple events sharing a `game_id` — e.g. one event for moneyline, another for spreads, another for totals. The dropdown should aggregate markets across all sibling events for the same game, but currently fails to do so due to multiple issues in the `gameId` extraction, fetch triggering, and `showDropdown` gating logic.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user views a sports market at `/market/{slug}` where the game spans multiple Polymarket events sharing a `game_id` THEN the dropdown only shows moneyline markets from the single event the current market belongs to, omitting spreads, totals, player props, and other market types from sibling events.

1.2 WHEN the `gameId` field is present on the market object returned by Gamma's `/markets/slug/{slug}` endpoint (passed through via `.loose()`) THEN the `gameId` value may not be reliably extracted because `MarketSchema` does not explicitly validate `gameId` or `game_id` — the field passes through `.loose()` but its presence is not guaranteed in the typed output, making the extraction in `TradingSelectorCard` fragile.

1.3 WHEN a sports market belongs to a 2-way event with only 1 market in that event (e.g. a single moneyline market) THEN the `showDropdown` condition (`hasEvent && selectorItems.length > 1`) evaluates to `false` because `selectorItems` is derived from the single-event markets before game-wide markets are merged, so the dropdown never renders even when game-wide markets exist via `game_id`.

1.4 WHEN `gameMarkets` are successfully fetched via `trpc.markets.listByGameId` and merged with `singleEventMarkets` THEN the merged `eventMarkets` array may still not trigger the sports dropdown because `showDropdown` is computed from `selectorItems` (which uses the pre-merge count) rather than from the merged `eventMarkets` array.

1.5 WHEN a soccer/draw-sport game is viewed (e.g. Austin FC vs Los Angeles FC) THEN the dropdown is missing tabs entirely (no Game Lines / 1st Half / Player Props tabs) even though the equivalent NBA games (e.g. Warriors vs Hawks) correctly show tabs with Moneyline, Spreads, Totals, and multiple tab sections. This indicates the game_id aggregation works for some sports but fails for soccer — the root cause difference between NBA (working) and soccer (broken) must be audited.

1.6 WHEN a 3-way moneyline sport (soccer, draws) is rendered in the dropdown THEN the `ThreeWayMoneylineRow` component displays all three outcomes (Team A, Draw, Team B) as cramped inline pills with truncated labels (e.g. "Austin FC 16¢ | Draw (Austin 63¢ | Los Ange...") under a "Moneyline" header. This is a poor UX — the pills are too small, labels get truncated, and it's inconsistent with how 2-way sports render individual team rows.

### Expected Behavior (Correct)

2.1 WHEN a user views a sports market at `/market/{slug}` where the game spans multiple Polymarket events sharing a `game_id` THEN the system SHALL display all market types (moneyline, spreads, totals, player props, etc.) from all sibling events in the sports dropdown, organized into tabs (Game Lines, 1st Half, Player Props, etc.) — consistently for ALL sports including soccer, not just NBA/NFL.

2.2 WHEN the Gamma API returns a market object with a `gameId` (or `game_id`) field via `.loose()` passthrough THEN the system SHALL reliably extract the `gameId` value by explicitly including `gameId` and/or `game_id` as optional fields in `MarketSchema`, ensuring the value is available in the typed output for downstream consumption.

2.3 WHEN a sports market belongs to a single-market event but has a valid `game_id` that maps to additional markets across sibling events THEN the system SHALL show the dropdown with all game-wide markets, using the merged market count (including game-wide markets) to determine dropdown visibility rather than the single-event market count.

2.4 WHEN `gameMarkets` are fetched and merged with single-event markets THEN the system SHALL use the merged `eventMarkets` array (or its length) to determine whether the dropdown should be shown, ensuring `showDropdown` is `true` whenever the total aggregated market count exceeds 1.

2.5 WHEN a 3-way moneyline sport (soccer, draws) is rendered in the dropdown THEN each outcome SHALL be rendered as its own full-width row — "Austin FC" with Yes price, "Draw" with Yes price, "Los Angeles FC" with Yes price — identical to how individual markets appear in the standard dropdown list. There SHALL NOT be a "Moneyline" header with cramped inline pills. This matches how 2-way sports show "Moneyline" as a single clickable row that loads the team buttons in the selector card above.

2.6 WHEN auditing why soccer differs from NBA THEN the investigation SHALL compare the Gamma API responses for a working NBA game vs a broken soccer game — specifically checking whether `gameId` is present on both, whether the `game_id` query returns markets for both, and whether the event structure differs (e.g. soccer moneyline events having 3 markets vs NBA having 1).

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a non-sports market is viewed at `/market/{slug}` (no `game_id` present) THEN the system SHALL CONTINUE TO display the standard event dropdown with all markets from the single event, using the existing `selectorItems` logic.

3.2 WHEN a sports event has only a single market and no `game_id` (or `game_id` returns no additional markets) THEN the system SHALL CONTINUE TO hide the dropdown and display the market without a selector, as it does today.

3.3 WHEN a multi-market non-sports event is viewed (e.g. a political event with multiple outcome markets) THEN the system SHALL CONTINUE TO display the standard (non-sports) dropdown list with all event markets, without triggering the sports tab UI.

3.4 WHEN the `listByGameId` endpoint is called with an empty or invalid `game_id` THEN the system SHALL CONTINUE TO gracefully fall back to single-event markets without errors or UI breakage.

3.5 WHEN an esports event is viewed THEN the system SHALL CONTINUE TO render the esports-specific tab layout (Series Lines, Game 1, Game 2, etc.) using the existing `EsportsTabContent` component and detection logic.

3.6 WHEN a 2-way sports game (NBA, NFL, etc.) is viewed THEN the system SHALL CONTINUE TO render "Moneyline" as a single clickable row in the dropdown (not individual team rows), since clicking it loads both team buttons in the selector card above. The current working behavior for NBA/NFL SHALL NOT regress.
