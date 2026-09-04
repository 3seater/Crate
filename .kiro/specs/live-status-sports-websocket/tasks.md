# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — No WS Data Falsely Returns Live
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists in `resolveSportsLiveStatus()`, `isEventLive()`, and `exploreSportsRowShowsLive()`
  - **Scoped PBT Approach**: Scope the property to concrete failing cases — `game_start_time` in the past (>5 min ago) with an empty `SportsChannel` (no WS data), market not closed, not UMA-resolved
  - Create test file `tests/unit/sports-live-status-exploration.property.test.ts`
  - Import `resolveSportsLiveStatus` from `../../apps/web/src/features/trading/hooks/sports/use-sports-live`
  - Import `isEventLive`, `exploreSportsRowShowsLive` from `../../apps/web/src/features/explore/components/event-card-sports-utils`
  - Create a minimal `SportsChannel` mock with empty `results` map (all lookups return `null`)
  - Create minimal `Event` fixtures with `game_start_time` 2+ hours in the past, `closed: false`, no UMA resolution
  - **Property 1a**: `resolveSportsLiveStatus(null, null, null, null, null, pastGameStartTime, false)` should return `null` (no data) — NOT `{ live: true }`
  - **Property 1b**: `isEventLive(eventWithPastStartTime, emptyChannel)` should return `false` — NOT `true`
  - **Property 1c**: For events with slug date today/yesterday but no WS data, `isEventLive()` should return `false` — NOT `true` via slug date fallback
  - **Property 1d**: `exploreSportsRowShowsLive(eventWithPastStartTime, emptyChannel)` should return `false`
  - Use `fast-check` to generate random `game_start_time` values between 6 minutes and 48 hours in the past
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples found (e.g., `resolveSportsLiveStatus(null, null, null, null, null, "2025-01-26T18:00:00Z", false)` returns `{ live: true }` instead of `null`)
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.4, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — WS-Confirmed Live and Non-Live Games Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Create test file `tests/unit/sports-live-status-preservation.property.test.ts`
  - Import `resolveSportsLiveStatus` from `../../apps/web/src/features/trading/hooks/sports/use-sports-live`
  - Import `isEventLive`, `exploreSportsRowShowsLive`, `isMarketResolved` from `../../apps/web/src/features/explore/components/event-card-sports-utils`
  - Create a `SportsChannel` mock that can be populated with `SportResult` entries
  - **Observe on UNFIXED code first**, then write properties:
  - **Property 2a — WS Live Preservation**: For all events where WS has `live: true` AND `ended: false`, `resolveSportsLiveStatus()` returns `{ live: true, ... }` with score/period/elapsed from WS. Generate random `SportResult` objects with `live: true`, `ended: false`, random scores/periods. Verify `resolveSportsLiveStatus()` returns `live: true` with matching WS data fields.
  - **Property 2b — WS Ended Preservation**: For all events where WS has `ended: true`, `resolveSportsLiveStatus()` returns `{ live: false }`. Generate random `SportResult` objects with `ended: true` and various `live` values. Verify result has `live: false`.
  - **Property 2c — Closed Market Preservation**: For all events where `market.closed === true`, `isEventLive()` returns `false` regardless of WS data or `game_start_time`. Generate events with all markets closed.
  - **Property 2d — UMA Resolved Preservation**: For all events where market has `umaResolutionStatus: "proposed"` or `"resolved"`, `isEventLive()` returns `false`. Generate events with resolved markets.
  - **Property 2e — WS gameId Match Preservation**: For events matched by gameId with `live: true` + `ended: false`, `isEventLive()` returns `true`. Populate channel with matching gameId entries.
  - Verify all preservation tests PASS on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6_

- [x] 3. Fix live status functions to require WS confirmation

  - [x] 3.1 Fix `resolveSportsLiveStatus()` in `use-sports-live.ts`
    - Remove the `game_start_time` fallback block that returns `{ live: true }` when no WS match exists (lines ~56-61 in current code)
    - Add `GRACE_PERIOD_MS = 5 * 60 * 1000` constant at module level
    - When `wsMatch` is null and `gameStartTime` is present and within the last 5 minutes and `!marketClosed`: return `{ live: true }` (grace period)
    - When `wsMatch` is null and `gameStartTime` is older than 5 minutes (or absent): return `null`
    - _Bug_Condition: isBugCondition(input) where gameStartTime is in the past AND no WS data exists AND game_start_time > 5 min ago_
    - _Expected_Behavior: return null when no WS data and outside grace period; return { live: true } only during 5-min grace window_
    - _Preservation: WS-matched games continue to return { live: wsMatch.live === true && wsMatch.ended !== true, period, score, elapsed }_
    - _Requirements: 2.1, 2.4, 2.7, 3.1, 3.6_

  - [x] 3.2 Fix `isEventLive()` in `event-card-sports-utils.ts`
    - Remove the `game_start_time` primary check that sets `hasStartTimeLive = true` based solely on start time being in the past
    - Remove the slug date fallback block that sets `hasStartTimeLive = true` based on slug date being today/yesterday
    - Remove the final `return true` ("No WS data to contradict — trust the date signal")
    - Invert logic: make WS the primary signal — check WS by slug first, then by gameId
    - Only return `true` when WS confirms `live: true` AND `ended !== true`
    - Add optional grace period: if `game_start_time` is within last 5 minutes and no WS data, return `true`
    - Keep existing early returns for closed markets and UMA-resolved markets
    - _Bug_Condition: isBugCondition(input) where game_start_time in past OR slug date recent, AND no WS data_
    - _Expected_Behavior: return false when no WS data (outside grace period); return true only when WS confirms live_
    - _Preservation: WS slug match with ended=true still returns false; WS gameId match with live=true still returns true; closed/resolved markets still return false_
    - _Requirements: 2.1, 2.4, 2.5, 2.6, 2.7, 3.2, 3.3, 3.4_

  - [x] 3.3 Verify `exploreSportsRowShowsLive()` correctness
    - No direct code changes needed — delegates to `isEventLive()` and `resolveSportsLiveStatus()`
    - Verify the function still returns `true` only when one of its delegates confirms live via WS
    - Verify the resolved-market early return still works (`markets.some(m => isMarketResolved(m))`)
    - _Requirements: 2.6, 3.1, 3.2_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — No WS Data Means Not Live
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run `tests/unit/sports-live-status-exploration.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.4, 2.5_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** — WS-Confirmed Live and Non-Live Games Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run `tests/unit/sports-live-status-preservation.property.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix (no regressions)

- [x] 4. Checkpoint — Ensure all tests pass
  - Run full test suite: `pnpm test:unit --run`
  - Ensure all sports live status tests pass (exploration + preservation)
  - Ensure no other test regressions
  - Ask the user if questions arise
