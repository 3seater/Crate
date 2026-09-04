# Bugfix Requirements Document

## Introduction

Sports and esports market outcome buttons display incorrect team abbreviations due to overly permissive fuzzy matching in the Gamma team-row merge logic, and full team names flash briefly before abbreviations load due to async data fetching without a loading placeholder. Three related bugs are addressed:

1. Both outcome buttons show the same abbreviation when team names share a common token (e.g. "Gaming")
2. Full outcome names flash before switching to abbreviations on initial load
3. Wrong abbreviations appear when the fuzzy matcher incorrectly associates unrelated teams

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN two team names share a token of ≥4 characters (e.g. "JD Gaming" and "Bilibili Gaming" both contain "Gaming") THEN the system maps both requested names to the same Gamma API row via `tokenOverlap()`, causing both outcome buttons to display the same abbreviation (e.g. both show "JDG")

1.2 WHEN a requested team name is a substring of an official Gamma team name, or vice versa, with loose length thresholds (e.g. ≥4 or ≥6 chars) THEN `requestMatchesOfficialRow()` incorrectly matches unrelated teams, causing wrong abbreviations to appear on outcome buttons (e.g. "ALAST" instead of "CHA" for Charlotte Hornets)

1.3 WHEN a sports market page loads and the Gamma `/teams` API query has not yet resolved THEN `useTeamImages()` returns empty `buttonLabels`, causing `resolveButtonLabel()` to fall through to the raw label (full team name), which then visibly flashes to the abbreviation once the query resolves

1.4 WHEN a user switches between sports markets THEN the React Query cache key changes, triggering a new fetch with empty `buttonLabels` during loading, causing the flash to recur on every market switch

### Expected Behavior (Correct)

2.1 WHEN two team names share a common token (e.g. "Gaming", "United", "City") THEN the system SHALL require a stronger match (e.g. exact name match, alias match, or abbreviation match) before mapping a requested name to a Gamma API row, so each team resolves to its own distinct abbreviation

2.2 WHEN the fuzzy matching logic evaluates a requested team name against a Gamma API row THEN the system SHALL use stricter matching criteria that prevent unrelated teams from being associated, ensuring only genuinely matching teams produce abbreviation mappings

2.3 WHEN a sports market page loads and team abbreviation data has not yet resolved THEN the system SHALL avoid displaying the raw full team name on outcome buttons, preventing the visible flash from full name to abbreviation

2.4 WHEN a user switches between sports markets THEN the system SHALL not display a flash of full team names while the new market's team data loads

### Unchanged Behavior (Regression Prevention)

3.1 WHEN team names exactly match Gamma API row names (e.g. "Clippers" matches official name "Clippers") THEN the system SHALL CONTINUE TO resolve the correct abbreviation and logo

3.2 WHEN team names match via ASCII folding (e.g. "Jiří Procházka" matches Gamma "Jiri Prochazka") THEN the system SHALL CONTINUE TO resolve the correct abbreviation

3.3 WHEN team names match via alias (e.g. Gamma row has alias that matches the requested name) THEN the system SHALL CONTINUE TO resolve the correct abbreviation

3.4 WHEN outcome labels are totals (e.g. "Over 218.5", "Under 218.5") THEN the system SHALL CONTINUE TO resolve to "O 218.5" / "U 218.5" without team lookup

3.5 WHEN outcome labels are spreads (e.g. "Nets +4.5") THEN the system SHALL CONTINUE TO resolve the team abbreviation and append the spread line (e.g. "BKN +4.5")

3.6 WHEN outcome labels are non-sports (e.g. "Yes", "No") THEN the system SHALL CONTINUE TO pass through unchanged

3.7 WHEN team names include FC prefix/suffix variants or leading ordinal prefixes THEN the system SHALL CONTINUE TO expand query names correctly for the Gamma API
