# Bugfix Requirements Document

## Introduction

Sports events on the Explore page (card view and "Live" filter) incorrectly display as live when they have already finished or have not yet started. The root cause is that three interconnected functions — `resolveSportsLiveStatus()`, `isEventLive()`, and `exploreSportsRowShowsLive()` — use `game_start_time` and slug date heuristics as primary or fallback indicators of live status. When no Sports WebSocket (`wss://sports-api.polymarket.com/ws`) data is available for a game, these functions assume the game is live simply because its start time is in the past or its slug date is today/yesterday. The Sports WebSocket broadcasts a `live: boolean` field that is the authoritative source for whether a game is currently in progress, and the absence of WebSocket data should be treated as "not live" rather than as confirmation of live status.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a sports game's `game_start_time` is in the past AND the market is not closed AND no Sports WebSocket data exists for the game THEN the system marks the game as live in `resolveSportsLiveStatus()` (returns `{ live: true }`)

1.2 WHEN a sports game's `game_start_time` is in the past AND the market is not closed AND no Sports WebSocket data exists for the game THEN the system marks the game as live in `isEventLive()` (returns `true` with the comment "No WS data to contradict — trust the date signal")

1.3 WHEN a sports event's slug contains a date that is today or yesterday AND the market is not closed AND no Sports WebSocket data exists for the game THEN the system marks the game as live in `isEventLive()` via the slug date fallback

1.4 WHEN a sports game has finished (e.g., hours ago) but the market has not yet been closed/resolved THEN the system incorrectly shows the game as live because `game_start_time` is in the past and no WebSocket `ended: true` signal is checked in the fallback path

1.5 WHEN the Explore page "Live" filter is applied THEN finished and not-yet-started games appear in the live results because `isEventLive()` and `exploreSportsRowShowsLive()` both rely on the defective `game_start_time` / slug date heuristics

### Expected Behavior (Correct)

2.1 WHEN a sports game has no Sports WebSocket data available THEN the system SHALL NOT mark the game as live — absence of WebSocket data means "unknown/not live", not "confirmed live"

2.2 WHEN a sports game has Sports WebSocket data with `live: true` AND `ended: false` (or `ended` absent) THEN the system SHALL mark the game as live

2.3 WHEN a sports game has Sports WebSocket data with `live: false` OR `ended: true` THEN the system SHALL NOT mark the game as live

2.4 WHEN a sports game's `game_start_time` is in the past but no WebSocket data exists THEN the system SHALL NOT fall back to treating the game as live based solely on `game_start_time`

2.5 WHEN a sports event's slug date is today or yesterday but no WebSocket data exists THEN the system SHALL NOT fall back to treating the game as live based solely on the slug date

2.6 WHEN the Explore page "Live" filter is applied THEN only games confirmed as live by the Sports WebSocket (`live: true` AND `ended !== true`) SHALL appear in the results

2.7 WHEN a sports game's `game_start_time` was within the last 5 minutes AND no WebSocket data has arrived yet THEN the system MAY optionally treat the game as live as a brief grace period to cover the window between game start and the first WebSocket message

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a sports game has Sports WebSocket data with `live: true` AND `ended: false` THEN the system SHALL CONTINUE TO display the game as live with score, period, and elapsed time from the WebSocket

3.2 WHEN a sports game has Sports WebSocket data with `ended: true` THEN the system SHALL CONTINUE TO treat the game as not live (existing WS override for ended games already works correctly)

3.3 WHEN a market is closed (`market.closed === true`) THEN the system SHALL CONTINUE TO treat the game as not live regardless of any other signals

3.4 WHEN a market has UMA resolution status "proposed" or "resolved" THEN the system SHALL CONTINUE TO treat the game as not live (existing `isMarketResolved()` check)

3.5 WHEN a non-sports event is displayed on the Explore page THEN the system SHALL CONTINUE TO show it without any sports live status logic applied

3.6 WHEN the Sports WebSocket is connected and broadcasting results THEN the system SHALL CONTINUE TO match games by gameId, team abbreviations, and team display names in priority order

3.7 WHEN the `useSportsLive` hook is used on a trading page with valid match data THEN the system SHALL CONTINUE TO subscribe to the Sports WebSocket and re-render on matching game updates
