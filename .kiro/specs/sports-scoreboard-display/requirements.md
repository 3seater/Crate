# Requirements Document

## Introduction

Display real-time sports game data (scores, periods, game status) from the Polymarket Sports WebSocket throughout the Doji app. This includes a scoreboard component in the trading terminal header bar, score/period overlays on Explore page sports cards, and using the WebSocket `status` field as an additional signal for determining live/ended game state. The Sports WebSocket (`wss://sports-api.polymarket.com/ws`) already broadcasts `score`, `period`, `elapsed`, `status`, `live`, and `ended` fields via the existing `SportsChannel` singleton; this feature surfaces that data in the UI.

## Glossary

- **Scoreboard**: A compact UI component displaying team names, logos, live score, and game period/status for a sports event.
- **Score_Parser**: A pure utility function that takes a raw score string from the Sports WebSocket and returns a structured object with home and away scores suitable for display.
- **Period_Formatter**: A pure utility function that takes raw `period`, `status`, `elapsed`, `live`, and `ended` fields and returns a human-readable game status string (e.g., "LIVE · End Q3", "FINAL", "2H 45:00").
- **Trading_Header**: The top bar of the trading terminal page (`MarketHeaderTrading` component) containing the market name pill, stats (Volume, 24h Volume, Liquidity, O.I., Ends), watchlist star, rewards badge, and Polymarket external link.
- **Explore_Card**: The `EventCard` component on the Explore page that displays event information in a card layout, including team rows, prices, and action buttons for sports events.
- **Sports_WebSocket**: The Polymarket Sports WebSocket at `wss://sports-api.polymarket.com/ws`, managed by the `SportsChannel` singleton class, broadcasting `SportResult` messages with score, period, elapsed, status, live, ended, homeTeam, awayTeam, and other fields.
- **SportResult**: The Zod-validated type representing a single game update from the Sports_WebSocket, keyed by slug.
- **Game_Status_Resolver**: Logic that combines the `status` field from the Sports_WebSocket with the existing `live` and `ended` boolean fields to determine whether a game is in-progress, finished, or in an unknown state.
- **LIVE_STATUSES**: The existing `Set` in `sports-schemas.ts` containing sport-specific status strings that indicate a game is in progress (e.g., "InProgress", "running", "inprogress").
- **ENDED_STATUSES**: The existing `Set` in `sports-schemas.ts` containing sport-specific status strings that indicate a game has finished (e.g., "Final", "F/OT", "finished").

## Requirements

### Requirement 1: Score Parsing

**User Story:** As a developer, I want a pure utility that parses raw Sports WebSocket score strings into structured home/away score values, so that scores can be displayed consistently across all UI surfaces.

#### Acceptance Criteria

1. WHEN a simple score string in the format "X-Y" is provided (e.g., "63-85", "2-1", "0-0"), THE Score_Parser SHALL return an object with `home` and `away` string fields representing the respective scores.
2. WHEN a complex esports score string containing pipe-delimited segments is provided (e.g., "000-000|2-0|Bo3"), THE Score_Parser SHALL extract the map/round score from the second segment and return it as the home and away scores.
3. WHEN an empty string, null, or undefined value is provided, THE Score_Parser SHALL return null.
4. WHEN a score string does not match any known format, THE Score_Parser SHALL return null rather than displaying malformed data.
5. FOR ALL valid score strings, parsing then formatting back to a display string SHALL produce a string equivalent to the original simple score representation (round-trip property).

### Requirement 2: Period and Game Status Formatting

**User Story:** As a developer, I want a pure utility that formats raw period, status, elapsed, live, and ended fields into a human-readable game status string, so that game state is displayed consistently across all UI surfaces.

#### Acceptance Criteria

1. WHEN the `ended` field is true OR the `status` field is a member of ENDED_STATUSES, THE Period_Formatter SHALL return a string starting with "FINAL" (e.g., "FINAL", "FINAL OT").
2. WHEN the `live` field is true AND the `period` field is present, THE Period_Formatter SHALL return a string combining "LIVE" with the period (e.g., "LIVE · Q3", "LIVE · End 5", "LIVE · 1/3").
3. WHEN the `live` field is true AND the `period` field is present AND the `elapsed` field is present, THE Period_Formatter SHALL include the elapsed time in the formatted string (e.g., "LIVE · 1H 45:00").
4. WHEN the `live` field is true AND the `period` field is absent, THE Period_Formatter SHALL return "LIVE".
5. WHEN neither live nor ended conditions are met AND a `period` field is present, THE Period_Formatter SHALL return the period value as-is.
6. WHEN no meaningful fields are present, THE Period_Formatter SHALL return null.

### Requirement 3: Trading Terminal Header Scoreboard

**User Story:** As a trader viewing a sports market, I want to see a live scoreboard in the trading terminal header showing team logos, names, the current score, and game period, so that I can make informed trading decisions without leaving the page.

#### Acceptance Criteria

1. WHEN a sports market is loaded in the trading terminal AND Sports_WebSocket data is available for the game, THE Trading_Header SHALL display a Scoreboard component between the market stats section and the action buttons (watchlist, rewards, external link).
2. THE Scoreboard SHALL display the home team logo, home team abbreviation, the formatted score (e.g., "63 - 85"), the away team abbreviation, and the away team logo, arranged horizontally.
3. WHEN the game is live (Sports_WebSocket `live: true` AND `ended !== true`), THE Scoreboard SHALL display the Period_Formatter output below or beside the score (e.g., "LIVE · Q3").
4. WHEN the game has ended (Sports_WebSocket `ended: true` OR `status` is a member of ENDED_STATUSES), THE Scoreboard SHALL display "FINAL" as the game status label.
5. WHEN no Sports_WebSocket data is available for the current market, THE Trading_Header SHALL NOT display the Scoreboard component.
6. WHEN the market is not a sports matchup market (e.g., political, crypto), THE Trading_Header SHALL NOT display the Scoreboard component.
7. THE Scoreboard SHALL update in real time as new Sports_WebSocket messages arrive for the matched game, without requiring a page refresh.
8. THE Scoreboard SHALL use team logos from the existing `useBatchedTeamImages` / `useTeamImages` hook infrastructure.
9. THE Scoreboard SHALL use the project design system tokens for typography (`text-xs`, `text-sm`), colors (`text-text-primary`, `text-red-500` for live indicator), and spacing.
10. IF the team logo image fails to load, THEN THE Scoreboard SHALL display the `ImageWithFallback` component with the team abbreviation as the fallback character.

### Requirement 4: Explore Card Score and Period Display

**User Story:** As a user browsing the Explore page, I want to see live scores and game periods on sports event cards, so that I can quickly identify which games are in progress and their current state.

#### Acceptance Criteria

1. WHEN a sports event card is rendered AND Sports_WebSocket data with a score is available, THE Explore_Card SHALL display the formatted score between the team rows using the Score_Parser output.
2. WHEN a sports event card is rendered AND the game is live, THE Explore_Card SHALL display the Period_Formatter output alongside the existing LIVE indicator in the card footer.
3. WHEN a sports event card is rendered AND the game has ended, THE Explore_Card SHALL display "FINAL" as the status label in place of the LIVE indicator.
4. WHEN no Sports_WebSocket score data is available for a sports event, THE Explore_Card SHALL continue to display team rows with probability percentages as it does currently, without a score overlay.
5. THE Explore_Card score display SHALL use the same Score_Parser and Period_Formatter utilities as the Trading_Header Scoreboard to maintain consistency.

### Requirement 5: Enhanced Game State Resolution Using WebSocket Status Field

**User Story:** As a user, I want the app to use the Sports WebSocket `status` field alongside the `live` and `ended` booleans to determine game state more accurately, so that games are correctly shown as live, ended, or not-yet-started.

#### Acceptance Criteria

1. WHEN the Sports_WebSocket `status` field for a game is a member of LIVE_STATUSES AND the `ended` field is not true, THE Game_Status_Resolver SHALL treat the game as live, even if the `live` boolean is absent.
2. WHEN the Sports_WebSocket `status` field for a game is a member of ENDED_STATUSES, THE Game_Status_Resolver SHALL treat the game as ended, even if the `ended` boolean is false or absent.
3. WHEN the `live` boolean is true AND the `status` field is a member of ENDED_STATUSES, THE Game_Status_Resolver SHALL treat the game as ended (status field takes precedence for ended detection).
4. WHEN the `live` boolean is true AND the `ended` boolean is not true AND the `status` field is not a member of ENDED_STATUSES, THE Game_Status_Resolver SHALL treat the game as live.
5. WHEN neither `live`, `ended`, nor `status` provide a definitive signal, THE Game_Status_Resolver SHALL treat the game state as unknown and return null.
6. THE Game_Status_Resolver SHALL be used by `resolveSportsLiveStatus`, `isEventLive`, and `exploreSportsRowShowsLive` functions to replace direct `live`/`ended` boolean checks with the enhanced resolution logic.

### Requirement 6: Score Parser Pretty Printer and Round-Trip

**User Story:** As a developer, I want a pretty printer for parsed score objects and a round-trip guarantee, so that score parsing is reliable and testable.

#### Acceptance Criteria

1. THE Score_Parser SHALL provide a `formatScore` function that takes a parsed score object (`{ home: string; away: string }`) and returns a display string in the format "home - away" (e.g., "63 - 85").
2. FOR ALL simple score strings in "X-Y" format, parsing with Score_Parser then formatting with `formatScore` then parsing again SHALL produce an equivalent parsed score object (round-trip property).
3. FOR ALL valid parsed score objects, formatting with `formatScore` SHALL produce a non-empty string containing both the home and away values separated by " - ".

### Requirement 7: Graceful Handling of Missing or Partial Data

**User Story:** As a user, I want the scoreboard and score displays to handle missing or partial WebSocket data gracefully, so that the UI never shows broken or misleading information.

#### Acceptance Criteria

1. WHEN the Sports_WebSocket provides a `score` field but no `period` field, THE Scoreboard SHALL display the score without a period label.
2. WHEN the Sports_WebSocket provides a `period` field but no `score` field, THE Scoreboard SHALL display the period/status label without a score.
3. WHEN the Sports_WebSocket provides neither `score` nor `period` but `live` is true, THE Scoreboard SHALL display a "LIVE" indicator without score or period details.
4. WHEN the `homeTeam` or `awayTeam` abbreviation is unavailable from the Sports_WebSocket, THE Scoreboard SHALL fall back to slug-extracted abbreviations from the event slug using the existing `extractSlugAbbreviations` utility.
5. IF both Sports_WebSocket team abbreviations and slug-extracted abbreviations are unavailable, THEN THE Scoreboard SHALL display team names truncated to fit the available space.
