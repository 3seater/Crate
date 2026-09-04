# Implementation Plan: Sports Scoreboard Display

## Overview

Implement real-time sports scoreboard display across the Doji trading terminal and Explore page. The approach starts with pure utility functions (parseScore, formatScore, formatPeriod, resolveGameState), then builds the Scoreboard component, integrates it into the trading header, enhances Explore cards, and wires up the enhanced game state resolution. Property-based tests validate correctness properties throughout.

## Tasks

- [x] 1. Implement pure utility module (`sports-display-utils.ts`)
  - [x] 1.1 Create `parseScore` and `formatScore` functions
    - Create file `apps/web/src/features/trading/lib/sports/sports-display-utils.ts`
    - Define `ParsedScore` interface with `home` and `away` string fields
    - Implement `parseScore(raw)` handling simple "X-Y" format, esports "X-Y|A-B|suffix" format, and null/empty/malformed → null
    - Implement `formatScore(parsed)` returning "home - away" display string
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 6.3_

  - [ ]* 1.2 Write property tests for `parseScore` (Properties 1–4)
    - **Property 1: Simple score parsing extracts correct home and away values**
    - **Validates: Requirements 1.1**
    - **Property 2: Esports score parsing extracts map score from second pipe segment**
    - **Validates: Requirements 1.2**
    - **Property 3: Malformed score strings return null**
    - **Validates: Requirements 1.4**
    - **Property 4: Score parse-format round-trip**
    - **Validates: Requirements 6.2, 6.1, 6.3**

  - [x] 1.3 Implement `formatPeriod` function
    - Handle priority: ended/ENDED_STATUSES → "FINAL" (with OT suffix), live+period+elapsed → "LIVE · {period} {elapsed}", live+period → "LIVE · {period}", live only → "LIVE", period only → period as-is, nothing → null
    - Import `ENDED_STATUSES` from `@/shared/lib/websocket/sports-schemas`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 1.4 Write property tests for `formatPeriod` (Properties 5–7)
    - **Property 5: Ended games produce FINAL status**
    - **Validates: Requirements 2.1**
    - **Property 6: Live games include LIVE prefix and period in formatted output**
    - **Validates: Requirements 2.2, 2.3**
    - **Property 7: Non-live non-ended period passthrough**
    - **Validates: Requirements 2.5**

  - [x] 1.5 Implement `resolveGameState` function
    - Return "ended" when status ∈ ENDED_STATUSES (regardless of live/ended booleans)
    - Return "live" when ended !== true AND (live === true OR status ∈ LIVE_STATUSES)
    - Return null when no definitive signal
    - Import `LIVE_STATUSES` and `ENDED_STATUSES` from `@/shared/lib/websocket/sports-schemas`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ]* 1.6 Write property tests for `resolveGameState` (Properties 8–10)
    - **Property 8: ENDED_STATUSES in resolveGameState always produces "ended"**
    - **Validates: Requirements 5.2, 5.3**
    - **Property 9: Live game state resolution**
    - **Validates: Requirements 5.1, 5.4**
    - **Property 10: Unknown game state returns null**
    - **Validates: Requirements 5.5**

- [x] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement Scoreboard component
  - [x] 3.1 Create `Scoreboard` component
    - Create file `apps/web/src/features/trading/components/market/scoreboard.tsx`
    - Add `"use client"` directive
    - Define `ScoreboardProps` interface (score, period, elapsed, status, live, ended, homeAbbrev, awayAbbrev, homeLogoUrl, awayLogoUrl)
    - Render horizontal layout: [HomeLogo] HOM score AWY [AwayLogo] with period/status below
    - Use `ImageWithFallback` for team logos (20×20px) with abbreviation as fallback
    - Use design system tokens: `text-xs`, `text-sm`, `font-medium`, `text-text-primary`, `text-text-secondary`, `text-red-500` for live
    - Call `parseScore`, `formatScore`, `formatPeriod` internally
    - Show animated ping dot + "LIVE" prefix when live, "FINAL" when ended
    - Handle partial data: score-only, period-only, live-only
    - _Requirements: 3.2, 3.3, 3.4, 3.9, 3.10, 7.1, 7.2, 7.3_

  - [ ]* 3.2 Write unit tests for Scoreboard component
    - Test renders all elements (logo, abbreviation, score, period)
    - Test shows LIVE indicator when live
    - Test shows FINAL when ended
    - Test handles partial data (score only, period only, live only)
    - _Requirements: 3.2, 3.3, 3.4, 7.1, 7.2, 7.3_

- [x] 4. Integrate Scoreboard into trading terminal header
  - [x] 4.1 Create `useMarketSportsData` hook for trading header
    - Detect sports matchup market via `isSportsMatchupMarket`
    - Extract gameId, team abbreviations (from slug), team names (from token outcomes)
    - Call `useSportsLive` for real-time WS data
    - Call `useTeamImages` for team logos
    - Return scoreboard props or null when not applicable
    - _Requirements: 3.1, 3.5, 3.6, 3.7, 3.8, 7.4, 7.5_

  - [x] 4.2 Add Scoreboard to `MarketHeaderTrading`
    - Import and call `useMarketSportsData` hook
    - Conditionally render `<Scoreboard />` between stats section and action buttons
    - Only render when hook returns non-null data (sports matchup market with WS data)
    - _Requirements: 3.1, 3.5, 3.6_

- [x] 5. Enhance Explore card with score and period display
  - [x] 5.1 Add parsed score display to EventCard team rows
    - Use `parseScore()` + `formatScore()` to display structured score between team rows
    - Only show when WS score data is available; otherwise keep existing percentage display
    - _Requirements: 4.1, 4.4, 4.5_

  - [x] 5.2 Add formatted period to EventCard footer
    - Use `formatPeriod()` to produce status string alongside existing LIVE indicator
    - Show "FINAL" for ended games in place of LIVE indicator
    - _Requirements: 4.2, 4.3, 4.5_

- [x] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integrate `resolveGameState` into existing game state resolution
  - [x] 7.1 Update `resolveSportsLiveStatus` to use `resolveGameState`
    - Replace direct `wsMatch.live === true && wsMatch.ended !== true` check with `resolveGameState` call
    - Pass `status` field from `SportResult` through to the resolution
    - Update `SportsLiveStatus` interface if needed to include `status` and `ended` fields
    - _Requirements: 5.6_

  - [x] 7.2 Update `isEventLive` to use `resolveGameState`
    - Replace direct `bySlug.live === true && !bySlug.ended` checks with `resolveGameState`
    - Ensure ENDED_STATUSES from `status` field takes precedence over stale `live: true`
    - _Requirements: 5.6_

  - [x] 7.3 Update `exploreSportsRowShowsLive` to use `resolveGameState`
    - Ensure the enhanced resolution propagates through the explore sorting logic
    - _Requirements: 5.6_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Test file: `tests/unit/sports-display-utils.test.ts`
- Run tests with: `pnpm vitest run tests/unit/sports-display-utils.test.ts`
- All code is TypeScript, matching the design document
