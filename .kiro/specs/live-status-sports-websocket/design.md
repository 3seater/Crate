# Live Status Sports WebSocket Bugfix Design

## Overview

Sports events on the Explore page incorrectly display as "live" when they have finished or not yet started. Three functions — `resolveSportsLiveStatus()`, `isEventLive()`, and `exploreSportsRowShowsLive()` — use `game_start_time` and slug date heuristics as primary/fallback indicators of live status. When no Sports WebSocket data exists for a game, these functions assume the game is live simply because its start time is in the past. The fix makes the Sports WebSocket the authoritative source: absence of WS data means "not live" (with an optional 5-minute grace period after `game_start_time`).

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when `game_start_time` is in the past (or slug date is today/yesterday) AND no Sports WebSocket data exists, the system incorrectly returns `live: true`
- **Property (P)**: The desired behavior — absence of WebSocket data should mean "not live"; only `live: true` + `ended !== true` from the WS confirms a game is in progress
- **Preservation**: Existing behavior that must remain unchanged — WS-confirmed live games continue to show live with scores; ended/closed/resolved games continue to show not-live; non-sports events are unaffected; WS matching priority (gameId → abbreviations → team names) is preserved
- **`resolveSportsLiveStatus()`**: Pure function in `use-sports-live.ts` that resolves live status from WS data + `gameStartTime` fallback. Used by both the `useSportsLive` hook and `exploreSportsRowShowsLive()`
- **`isEventLive()`**: Pure function in `event-card-sports-utils.ts` that checks whether an event is currently live using `game_start_time` as primary signal with WS override
- **`exploreSportsRowShowsLive()`**: Pure function in `event-card-sports-utils.ts` that combines `isEventLive()` and `resolveSportsLiveStatus()` for Explore row sorting
- **`SportsChannel`**: WebSocket client class in `sports-channel.ts` that maintains a `results` map of `SportResult` objects keyed by slug
- **`SportResult`**: Zod-validated message from `wss://sports-api.polymarket.com/ws` containing `slug`, `live`, `ended`, `score`, `period`, `elapsed`, and other fields
- **Grace Period**: An optional 5-minute window after `game_start_time` where the system may treat a game as live even without WS data, to cover the gap between scheduled start and first WS broadcast

## Bug Details

### Bug Condition

The bug manifests when a sports game's `game_start_time` is in the past (or its slug date is today/yesterday) and no Sports WebSocket data exists for the game. The three affected functions assume the game is live based solely on time heuristics, without requiring confirmation from the authoritative WebSocket source.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { event: Event, channel: SportsChannel, gameStartTime: string | null }
  OUTPUT: boolean

  hasWsData := channel.getByGameId(input.event.gameId) != null
               OR channel.getByAbbrevs(abbrevA, abbrevB) != null
               OR channel.getByTeamNames(nameA, nameB) != null
               OR channel.getByEventSlug(input.event.slug) != null

  gameStartInPast := input.gameStartTime != null
                     AND Date.parse(input.gameStartTime) <= Date.now()
                     AND NOT input.event.marketClosed
                     AND NOT isMarketResolved(input.event)

  slugDateIsRecent := extractDateFromSlug(input.event.slug) != null
                      AND slugDate <= now
                      AND (now - slugDate) < 2 days
                      AND NOT input.event.marketClosed

  RETURN (gameStartInPast OR slugDateIsRecent)
         AND NOT hasWsData
END FUNCTION
```

### Examples

- **Finished NFL game**: `game_start_time` = "2025-01-26T18:00:00Z" (6 hours ago), market not closed yet, no WS data → current code returns `live: true`, should return `live: false` (or `null`)
- **Not-yet-started NBA game**: `game_start_time` = "2025-01-27T01:00:00Z" (30 minutes ago, game delayed), no WS data → current code returns `live: true`, should return `live: false`
- **Slug date fallback**: Event slug `nba-cle-lal-2025-01-26`, today is Jan 26, no WS data, no `game_start_time` → current code returns `live: true` via slug date heuristic, should return `live: false`
- **Edge case — just started**: `game_start_time` = 2 minutes ago, no WS data yet → current code returns `live: true`; with grace period fix, MAY return `live: true` for up to 5 minutes

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- When WS data has `live: true` and `ended: false`, the game continues to display as live with score, period, and elapsed time from the WebSocket
- When WS data has `ended: true`, the game continues to be treated as not live
- When a market is closed (`market.closed === true`), the game continues to be treated as not live regardless of other signals
- When a market has UMA resolution status "proposed" or "resolved", the game continues to be treated as not live
- Non-sports events on the Explore page continue to display without sports live status logic
- WS matching continues to use priority order: gameId → team abbreviations → team display names
- The `useSportsLive` hook continues to subscribe to the Sports WebSocket and re-render on matching game updates

**Scope:**
All inputs where the Sports WebSocket has data for the game (either confirming live or not-live) should be completely unaffected by this fix. The fix only changes behavior for the "no WS data" path. This includes:
- Games with WS `live: true` + `ended: false` (still live)
- Games with WS `live: false` or `ended: true` (still not live)
- Games with WS data and any `game_start_time` value (WS remains authoritative)
- Non-sports events (no sports logic applied)
- Markets that are closed or UMA-resolved (already filtered out before WS check)

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **`resolveSportsLiveStatus()` — `game_start_time` fallback returns `{ live: true }`**: When no WS match is found via gameId, abbreviations, or team names, the function falls back to checking `gameStartTime`. If the start time is in the past and the market isn't closed, it returns `{ live: true }` — treating absence of WS data as confirmation of live status. This is the primary defect in the trading page path.

   ```typescript
   // Current defective code (use-sports-live.ts, lines ~56-61):
   if (gameStartTime && !marketClosed) {
     const startMs = new Date(gameStartTime).getTime();
     if (Number.isFinite(startMs) && startMs <= Date.now()) {
       return { live: true };  // ← BUG: no WS data ≠ live
     }
   }
   ```

2. **`isEventLive()` — `game_start_time` as primary signal with "trust the date" fallback**: This function uses `game_start_time` as the *primary* signal (not fallback), then only checks WS as an override. If WS has no data, it returns `true` with the comment "No WS data to contradict — trust the date signal". The entire logic is inverted from what it should be.

   ```typescript
   // Current defective code (event-card-sports-utils.ts, end of isEventLive):
   // No WS data to contradict — trust the date signal
   return true;  // ← BUG: should be false
   ```

3. **`isEventLive()` — slug date fallback**: When no `game_start_time` is available, the function parses the date from the event slug. If the slug date is today or yesterday, it sets `hasStartTimeLive = true` and follows the same defective path.

4. **`exploreSportsRowShowsLive()` — compounds both defects**: This function calls `isEventLive()` first (defect #2/#3), and if that returns false, calls `resolveSportsLiveStatus()` (defect #1). Either path can produce a false positive.

## Correctness Properties

Property 1: Bug Condition — No WS Data Means Not Live

_For any_ sports event where no Sports WebSocket data exists (no match by gameId, abbreviations, team names, or event slug), and the `game_start_time` is more than 5 minutes in the past, the fixed functions SHALL NOT return `live: true`. Absence of WebSocket data means "unknown/not live", not "confirmed live".

**Validates: Requirements 2.1, 2.4, 2.5**

Property 2: Preservation — WS-Confirmed Live Games Unchanged

_For any_ sports event where the Sports WebSocket has data with `live: true` AND `ended !== true`, the fixed functions SHALL produce the same result as the original functions — returning `live: true` with score, period, and elapsed time from the WebSocket data, preserving all existing live game display behavior.

**Validates: Requirements 3.1, 3.6**

Property 3: Preservation — Non-Live and Closed Games Unchanged

_For any_ input where the Sports WebSocket has data with `live: false` OR `ended: true`, OR where the market is closed, OR where the market has UMA resolution status "proposed"/"resolved", the fixed functions SHALL produce the same result as the original functions — returning `live: false` or filtering the game out.

**Validates: Requirements 3.2, 3.3, 3.4**

Property 4: Bug Condition — Slug Date Without WS Does Not Mean Live

_For any_ sports event where the slug contains a recent date (today/yesterday) but no Sports WebSocket data exists, the fixed `isEventLive()` function SHALL return `false`, not fall back to the slug date heuristic.

**Validates: Requirements 2.5, 2.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/web/src/features/trading/hooks/sports/use-sports-live.ts`

**Function**: `resolveSportsLiveStatus()`

**Specific Changes**:
1. **Remove `game_start_time` fallback that returns `{ live: true }`**: Delete the block that checks `gameStartTime` and returns `{ live: true }` when no WS match exists. When `wsMatch` is null, the function should return `null` (no data) instead of assuming live.
2. **Optional grace period**: Add a 5-minute grace period constant (`GRACE_PERIOD_MS = 5 * 60 * 1000`). If `gameStartTime` is within the last 5 minutes AND no WS data exists, return `{ live: true }` as a brief buffer. After 5 minutes with no WS data, return `null`.

---

**File**: `apps/web/src/features/explore/components/event-card-sports-utils.ts`

**Function**: `isEventLive()`

**Specific Changes**:
3. **Invert the logic — make WS the primary signal**: Remove the `game_start_time` primary check and slug date fallback that set `hasStartTimeLive`. Instead, check WS data first. Only return `true` if WS confirms `live: true` AND `ended !== true`.
4. **Remove "trust the date signal" fallback**: Delete the final `return true` that fires when no WS data contradicts the date heuristic. Replace with `return false`.
5. **Remove slug date fallback block**: Delete the entire `extractDateFromSlug` fallback section that sets `hasStartTimeLive` based on slug parsing.
6. **Optional grace period in `isEventLive()`**: If the grace period is implemented, allow `game_start_time` within the last 5 minutes to return `true` even without WS data, consistent with `resolveSportsLiveStatus()`.

---

**Function**: `exploreSportsRowShowsLive()`

**Specific Changes**:
7. **No direct changes needed**: This function delegates to `isEventLive()` and `resolveSportsLiveStatus()`. Once those are fixed, `exploreSportsRowShowsLive()` will automatically produce correct results. However, verify that the function's logic still makes sense after the upstream fixes — it should still return `true` only when one of its delegates confirms live via WS.

---

**File**: `apps/web/src/shared/lib/websocket/sports-schemas.ts`

**Specific Changes**:
8. **No changes needed**: The `LIVE_STATUSES` and `ENDED_STATUSES` sets and the `SportResultSchema` are already correct. The `live` and `ended` boolean fields are properly defined as optional in the schema.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that call `resolveSportsLiveStatus()`, `isEventLive()`, and `exploreSportsRowShowsLive()` with inputs where `game_start_time` is in the past but no WS data exists. Run these tests on the UNFIXED code to observe that they incorrectly return `live: true`.

**Test Cases**:
1. **resolveSportsLiveStatus with no WS match**: Call with `gameStartTime` 2 hours ago, `marketClosed: false`, all WS lookups return null → expect `live: true` on unfixed code (will fail on unfixed code)
2. **isEventLive with game_start_time in past**: Create event with `game_start_time` 3 hours ago, empty SportsChannel → expect `true` on unfixed code (will fail on unfixed code)
3. **isEventLive with slug date today**: Create event with today's date in slug, no `game_start_time`, empty SportsChannel → expect `true` on unfixed code (will fail on unfixed code)
4. **exploreSportsRowShowsLive compounds both**: Create event with `game_start_time` in past, empty SportsChannel → expect `true` on unfixed code (will fail on unfixed code)

**Expected Counterexamples**:
- `resolveSportsLiveStatus(null, null, null, null, null, "2025-01-26T18:00:00Z", false)` returns `{ live: true }` when it should return `null`
- `isEventLive(event, emptyChannel)` returns `true` when it should return `false`
- Possible causes: `game_start_time` fallback in `resolveSportsLiveStatus`, "trust the date signal" in `isEventLive`, slug date fallback in `isEventLive`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result_resolve := resolveSportsLiveStatus_fixed(input)
  ASSERT result_resolve IS null OR result_resolve.live IS false

  result_event := isEventLive_fixed(input.event, input.channel)
  ASSERT result_event IS false

  result_explore := exploreSportsRowShowsLive_fixed(input.event, input.channel)
  ASSERT result_explore IS false
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT resolveSportsLiveStatus_original(input) = resolveSportsLiveStatus_fixed(input)
  ASSERT isEventLive_original(input.event, input.channel) = isEventLive_fixed(input.event, input.channel)
  ASSERT exploreSportsRowShowsLive_original(input.event, input.channel) = exploreSportsRowShowsLive_fixed(input.event, input.channel)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of WS data states (live/ended/absent), game_start_time values, market closed states, and UMA resolution statuses
- It catches edge cases like `game_start_time` exactly at the 5-minute boundary, or WS data with `live: undefined`
- It provides strong guarantees that WS-confirmed live games, ended games, and closed markets behave identically before and after the fix

**Test Plan**: Observe behavior on UNFIXED code first for all non-bug-condition inputs (WS data present, markets closed, UMA resolved), then write property-based tests capturing that behavior.

**Test Cases**:
1. **WS Live Preservation**: Observe that events with WS `live: true` + `ended: false` return `live: true` on unfixed code, then verify this continues after fix
2. **WS Ended Preservation**: Observe that events with WS `ended: true` return `live: false` on unfixed code, then verify this continues after fix
3. **Closed Market Preservation**: Observe that events with `market.closed === true` return `live: false` on unfixed code, then verify this continues after fix
4. **UMA Resolved Preservation**: Observe that events with UMA "proposed"/"resolved" return `live: false` on unfixed code, then verify this continues after fix

### Unit Tests

- Test `resolveSportsLiveStatus()` with no WS match and various `gameStartTime` values (past, future, null)
- Test `resolveSportsLiveStatus()` with WS match confirming live, ended, and not-live states
- Test `isEventLive()` with empty SportsChannel and `game_start_time` in the past (should be false after fix)
- Test `isEventLive()` with slug date today/yesterday and no WS data (should be false after fix)
- Test `isEventLive()` with WS data confirming live (should be true)
- Test `isEventLive()` with WS data confirming ended (should be false)
- Test grace period boundary: `game_start_time` 4 minutes ago vs 6 minutes ago with no WS data
- Test `exploreSportsRowShowsLive()` delegates correctly to fixed functions

### Property-Based Tests

- Generate random `SportResult` objects with various `live`/`ended` combinations and verify `resolveSportsLiveStatus()` returns correct live status
- Generate random events with various `game_start_time` values, market states, and WS data presence/absence to verify `isEventLive()` only returns true when WS confirms live
- Generate random events with and without WS data to verify `exploreSportsRowShowsLive()` never returns true without WS confirmation (outside grace period)
- Preservation: generate inputs where WS data IS present and verify fixed functions produce identical results to original functions

### Integration Tests

- Test full Explore page flow: create events with mixed WS states, verify "Live" filter only shows WS-confirmed live games
- Test trading page: verify `useSportsLive` hook returns correct status when WS data arrives vs when it's absent
- Test transition: game starts (no WS data → grace period → WS data arrives with `live: true`) — verify smooth transition from grace period to confirmed live
