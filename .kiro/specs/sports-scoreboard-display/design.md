# Design Document: Sports Scoreboard Display

## Overview

This feature surfaces real-time sports game data (scores, periods, game status) from the Polymarket Sports WebSocket across two UI surfaces in the Doji app:

1. **Trading Terminal Header Scoreboard** — A compact inline scoreboard placed between the market stats section and the action buttons in `MarketHeaderTrading`, showing team logos, abbreviations, live score, and game period.
2. **Explore Card Score/Period Overlay** — Score and period information integrated into the existing `EventCard` sports layout, enhancing team rows with live scores and the card footer with formatted period strings.

Both surfaces consume the same pure utility functions (`parseScore`, `formatPeriod`, `resolveGameState`) to ensure consistent display. The utilities are pure functions with no side effects, making them straightforward to test with property-based testing.

Additionally, the existing game state resolution logic (`resolveSportsLiveStatus`, `isEventLive`, `exploreSportsRowShowsLive`) is enhanced to incorporate the WebSocket `status` field alongside the existing `live` and `ended` booleans, improving accuracy for edge cases where booleans are stale or absent.

### Design Decisions

- **Pure utility functions over React hooks**: Score parsing, period formatting, and game state resolution are implemented as pure functions in a shared utility module. This keeps them testable, composable, and reusable across both the trading header and explore cards without introducing hook coupling.
- **No new WebSocket subscriptions**: The trading header scoreboard reuses `useSportsLive` (which already subscribes per-game via `sportsChannel.addHandler`). Explore cards continue using the batched `useSportsLiveReadOnly` + `useSportsChannelTick` pattern. No new subscription mechanism is needed.
- **Shared module location**: Utilities live in `apps/web/src/features/trading/lib/sports/` since they are pure logic consumed by both trading and explore features, and the existing sports hooks already live under `features/trading/hooks/sports/`.

## Architecture

```mermaid
graph TD
    WS["Sports WebSocket<br/>(SportsChannel singleton)"] -->|SportResult| Hook1["useSportsLive<br/>(trading page)"]
    WS -->|SportResult| Hook2["useSportsLiveReadOnly<br/>(explore cards)"]

    Hook1 -->|SportsLiveStatus| SB["Scoreboard Component<br/>(MarketHeaderTrading)"]
    Hook2 -->|SportsLiveStatus| EC["EventCard<br/>(Explore page)"]

    SB -->|raw score string| SP["parseScore()"]
    SB -->|period, status, elapsed, live, ended| PF["formatPeriod()"]
    EC -->|raw score string| SP
    EC -->|period, status, elapsed, live, ended| PF

    SP -->|ParsedScore | null| SB
    PF -->|string | null| SB
    SP -->|ParsedScore | null| EC
    PF -->|string | null| EC

    subgraph "Pure Utilities (sports-display-utils.ts)"
        SP
        PF
        FS["formatScore()"]
        RGS["resolveGameState()"]
    end

    RGS -->|"live" | "ended" | null| Hook1
    RGS -->|"live" | "ended" | null| Hook2
```

### Data Flow

1. `SportsChannel` receives `SportResult` messages via WebSocket and stores them in its `results` Map.
2. Hooks (`useSportsLive` / `useSportsLiveReadOnly`) resolve a `SportsLiveStatus` object containing `score`, `period`, `elapsed`, and `live` fields.
3. UI components pass the raw `score` string to `parseScore()` and the period/status/elapsed/live/ended fields to `formatPeriod()`.
4. `parseScore()` returns a `ParsedScore` object (`{ home: string; away: string }`) or `null`.
5. `formatPeriod()` returns a human-readable status string (e.g., `"LIVE · Q3"`, `"FINAL"`, `"LIVE · 1H 45:00"`) or `null`.
6. `formatScore()` converts a `ParsedScore` back to a display string (`"63 - 85"`).
7. `resolveGameState()` combines `status`, `live`, and `ended` fields to produce a definitive `"live" | "ended" | null` signal, used by the existing resolution functions.

## Components and Interfaces

### New Pure Utility Module

**File**: `apps/web/src/features/trading/lib/sports/sports-display-utils.ts`

```typescript
/** Parsed score with home and away values as strings (preserves leading zeros for esports). */
export interface ParsedScore {
  home: string;
  away: string;
}

/**
 * Parse a raw Sports WebSocket score string into structured home/away values.
 *
 * Formats:
 * - Simple: "63-85" → { home: "63", away: "85" }
 * - Esports: "000-000|2-0|Bo3" → { home: "2", away: "0" } (second pipe segment)
 * - Empty/null/undefined → null
 * - Unrecognized format → null
 */
export function parseScore(raw: string | null | undefined): ParsedScore | null;

/**
 * Format a ParsedScore into a display string: "home - away".
 * e.g. { home: "63", away: "85" } → "63 - 85"
 */
export function formatScore(parsed: ParsedScore): string;

/**
 * Format period, status, elapsed, live, and ended fields into a human-readable
 * game status string.
 *
 * Priority:
 * 1. ended === true OR status ∈ ENDED_STATUSES → "FINAL" (+ OT suffix if applicable)
 * 2. live === true AND period present AND elapsed present → "LIVE · {period} {elapsed}"
 * 3. live === true AND period present → "LIVE · {period}"
 * 4. live === true AND no period → "LIVE"
 * 5. period present (not live, not ended) → period as-is
 * 6. No meaningful fields → null
 */
export function formatPeriod(fields: {
  period?: string | null;
  status?: string | null;
  elapsed?: string | null;
  live?: boolean;
  ended?: boolean;
}): string | null;

/**
 * Resolve definitive game state from WebSocket fields.
 * Uses status field as additional signal alongside live/ended booleans.
 *
 * Returns "live", "ended", or null (unknown).
 */
export function resolveGameState(fields: {
  status?: string | null;
  live?: boolean;
  ended?: boolean;
}): "live" | "ended" | null;
```

### New React Component: Scoreboard

**File**: `apps/web/src/features/trading/components/market/scoreboard.tsx`

A `"use client"` component rendered inside `MarketHeaderTrading` between the stats section and the action buttons.

```typescript
interface ScoreboardProps {
  /** Raw score string from SportsLiveStatus (e.g. "63-85", "000-000|2-0|Bo3") */
  score?: string | null;
  /** Raw period string from SportsLiveStatus */
  period?: string | null;
  /** Elapsed time string */
  elapsed?: string | null;
  /** WebSocket status field */
  status?: string | null;
  /** Whether the game is live */
  live?: boolean;
  /** Whether the game has ended */
  ended?: boolean;
  /** Home team abbreviation (e.g. "CLE") */
  homeAbbrev: string;
  /** Away team abbreviation (e.g. "LAL") */
  awayAbbrev: string;
  /** Home team logo URL */
  homeLogoUrl?: string | null;
  /** Away team logo URL */
  awayLogoUrl?: string | null;
}
```

**Layout** (horizontal, compact):

```
[HomeLogo] HOM  63 - 85  AWY [AwayLogo]
              LIVE · Q3
```

- Team logos: 20×20px `ImageWithFallback` with abbreviation as fallback character
- Team abbreviations: `text-xs font-medium text-text-primary`
- Score: `text-sm font-medium text-text-primary`
- Period/status: `text-xs font-normal text-text-secondary` (or `text-red-500` when live)
- "LIVE" prefix: `text-xs font-medium text-red-500` with animated ping dot
- "FINAL": `text-xs font-normal text-text-secondary`

### Modified Components

**`MarketHeaderTrading`** — Add a `<Scoreboard />` between the stats `<div>` and the actions `<div>`, conditionally rendered when:
1. The market is a sports matchup market (`isSportsMatchupMarket`)
2. `useSportsLive` returns non-null data for the matched game

The hook call uses the same matching strategy as `EventCard`: gameId → slug abbreviations → team names.

**`EventCard`** — The existing `SportsTeamRows` and card footer already have partial score/period rendering. Enhancements:
1. Use `parseScore()` to structure the raw score for display between team rows
2. Use `formatPeriod()` to produce the status string shown in the footer alongside the LIVE indicator
3. When the game has ended, replace the LIVE indicator with "FINAL" using `formatPeriod()` output

### Hook Integration for Trading Header

The `MarketHeaderTrading` component needs to resolve sports data for the current market. A new internal hook `useMarketSportsData` (defined inline or in a small helper) will:

1. Detect if the current market is a sports matchup via `isSportsMatchupMarket(market)`
2. Extract `gameId`, team abbreviations (from slug), and team names (from token outcomes)
3. Call `useSportsLive(abbrevA, abbrevB, nameA, nameB, gameId, gameStartTime, marketClosed)`
4. Call `useTeamImages([nameA, nameB], league)` for logos
5. Return the data needed by `<Scoreboard />`

## Data Models

### Existing Types (unchanged)

```typescript
// From sports-schemas.ts
interface SportResult {
  slug: string;
  live?: boolean;
  ended?: boolean;       // defaults to false
  score?: string;
  period?: string;
  elapsed?: string;
  status?: string;
  gameId?: number;
  homeTeam?: string;
  awayTeam?: string;
  turn?: string;
  leagueAbbreviation?: string;
  last_update?: string;
  finished_timestamp?: string;
}

// From use-sports-live.ts
interface SportsLiveStatus {
  live: boolean;
  score?: string;
  period?: string;
  elapsed?: string;
}
```

### New Types

```typescript
// In sports-display-utils.ts
interface ParsedScore {
  home: string;
  away: string;
}
```

### Score Format Examples

| Sport | Raw `score` | `parseScore()` output | `formatScore()` output |
|-------|------------|----------------------|----------------------|
| NBA | `"63-85"` | `{ home: "63", away: "85" }` | `"63 - 85"` |
| Soccer | `"0-0"` | `{ home: "0", away: "0" }` | `"0 - 0"` |
| NFL | `"21-14"` | `{ home: "21", away: "14" }` | `"21 - 14"` |
| Esports | `"000-000\|2-0\|Bo3"` | `{ home: "2", away: "0" }` | `"2 - 0"` |
| Empty | `""` | `null` | N/A |
| Null | `null` | `null` | N/A |
| Malformed | `"abc"` | `null` | N/A |

### Period Format Examples

| Input | Output |
|-------|--------|
| `{ ended: true }` | `"FINAL"` |
| `{ status: "Final" }` | `"FINAL"` |
| `{ status: "F/OT" }` | `"FINAL OT"` |
| `{ live: true, period: "Q3" }` | `"LIVE · Q3"` |
| `{ live: true, period: "1H", elapsed: "45:00" }` | `"LIVE · 1H 45:00"` |
| `{ live: true, period: "1/3" }` | `"LIVE · 1/3"` |
| `{ live: true }` | `"LIVE"` |
| `{ period: "Q1" }` | `"Q1"` |
| `{}` | `null` |


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Simple score parsing extracts correct home and away values

*For any* pair of non-negative integer strings `h` and `a`, `parseScore(h + "-" + a)` SHALL return `{ home: h, away: a }`.

**Validates: Requirements 1.1**

### Property 2: Esports score parsing extracts map score from second pipe segment

*For any* esports score string in the format `"X-Y|A-B|suffix"` where `A` and `B` are non-negative integer strings, `parseScore(raw)` SHALL return `{ home: A, away: B }`.

**Validates: Requirements 1.2**

### Property 3: Malformed score strings return null

*For any* string that does not contain a `"-"` character separating two numeric-like tokens (and is not a valid esports pipe-delimited format), `parseScore(raw)` SHALL return `null`.

**Validates: Requirements 1.4**

### Property 4: Score parse-format round-trip

*For any* simple score string in `"X-Y"` format where X and Y are non-negative integers, parsing with `parseScore`, formatting with `formatScore`, then parsing again SHALL produce a `ParsedScore` equivalent to the first parse result. That is: `parseScore(formatScore(parseScore(s)!))` deep-equals `parseScore(s)`.

**Validates: Requirements 6.2, 6.1, 6.3**

### Property 5: Ended games produce FINAL status

*For any* input where `ended === true` OR `status` is a member of `ENDED_STATUSES`, `formatPeriod(input)` SHALL return a string that starts with `"FINAL"`.

**Validates: Requirements 2.1**

### Property 6: Live games include LIVE prefix and period in formatted output

*For any* input where `live === true`, `ended !== true`, `status` is not in `ENDED_STATUSES`, and `period` is a non-empty string, `formatPeriod(input)` SHALL return a string containing both `"LIVE"` and the `period` value. Additionally, if `elapsed` is a non-empty string, the output SHALL also contain the `elapsed` value.

**Validates: Requirements 2.2, 2.3**

### Property 7: Non-live non-ended period passthrough

*For any* input where `live` is falsy, `ended` is falsy, `status` is not in `ENDED_STATUSES` or `LIVE_STATUSES`, and `period` is a non-empty string, `formatPeriod(input)` SHALL return the `period` value as-is.

**Validates: Requirements 2.5**

### Property 8: ENDED_STATUSES in resolveGameState always produces "ended"

*For any* input where `status` is a member of `ENDED_STATUSES`, `resolveGameState(input)` SHALL return `"ended"`, regardless of the values of `live` and `ended` booleans.

**Validates: Requirements 5.2, 5.3**

### Property 9: Live game state resolution

*For any* input where `ended` is not `true` and `status` is not a member of `ENDED_STATUSES`, if either `live === true` or `status` is a member of `LIVE_STATUSES`, then `resolveGameState(input)` SHALL return `"live"`.

**Validates: Requirements 5.1, 5.4**

### Property 10: Unknown game state returns null

*For any* input where `live` is falsy, `ended` is falsy, and `status` is neither a member of `LIVE_STATUSES` nor `ENDED_STATUSES`, `resolveGameState(input)` SHALL return `null`.

**Validates: Requirements 5.5**

## Error Handling

### Score Parsing Errors

- **Null/undefined/empty input**: `parseScore` returns `null`. No error thrown.
- **Malformed format**: `parseScore` returns `null`. The UI falls back to not displaying a score (Requirement 7.2 — period-only display, or Requirement 3.5 — no scoreboard).
- **Esports with missing second segment**: If the pipe-delimited string has fewer than 2 segments, `parseScore` returns `null`.

### Period Formatting Errors

- **All fields absent**: `formatPeriod` returns `null`. The UI omits the period/status label.
- **Conflicting signals** (e.g., `live: true` AND `status ∈ ENDED_STATUSES`): `formatPeriod` prioritizes ended status (FINAL) over live, matching `resolveGameState` precedence rules.

### WebSocket Data Errors

- **No WS connection**: `SportsChannel` handles reconnection with exponential backoff. Components receive no data and hide the scoreboard (Requirement 3.5).
- **Partial WS data**: Each field is independently optional. Components render whatever is available (Requirements 7.1–7.3).
- **Stale WS data**: The `resolveGameState` function uses the `status` field as an additional signal to catch cases where `live`/`ended` booleans are stale (Requirement 5.3).

### Team Data Fallbacks

- **No WS team abbreviations**: Fall back to `extractSlugAbbreviations` from the event slug (Requirement 7.4).
- **No slug abbreviations**: Fall back to truncated team names from token outcomes or event title (Requirement 7.5).
- **Logo load failure**: `ImageWithFallback` displays the team abbreviation as a letter fallback (Requirement 3.10).

## Testing Strategy

### Property-Based Tests (Vitest + fast-check)

Property-based testing is well-suited for this feature because the core logic consists of pure functions (`parseScore`, `formatScore`, `formatPeriod`, `resolveGameState`) with clear input/output behavior and universal properties that should hold across a wide input space.

**Library**: `fast-check` (already available in the ecosystem or easily added)
**Configuration**: Minimum 100 iterations per property test
**Tag format**: `Feature: sports-scoreboard-display, Property {N}: {title}`

Each of the 10 correctness properties above maps to a single property-based test:

1. **parseScore** — Properties 1–4 cover simple parsing, esports parsing, malformed rejection, and round-trip
2. **formatPeriod** — Properties 5–7 cover ended/live/passthrough formatting
3. **resolveGameState** — Properties 8–10 cover ended precedence, live detection, and unknown state

**Test file**: `tests/unit/sports-display-utils.test.ts`

### Unit Tests (Example-Based)

Complement property tests with specific examples for:

- `parseScore`: empty string, null, undefined (Requirement 1.3)
- `formatPeriod`: live with no period returns "LIVE" (Requirement 2.4), empty fields return null (Requirement 2.6)
- Specific sport format examples: NBA "Q3", Soccer "1H 45:00", MLB "End 5", Esports "1/3", NHL "2nd Period"
- `formatScore`: specific display format verification

### Component Tests (Example-Based)

- `Scoreboard` component renders all elements (logo, abbreviation, score, period) — Requirement 3.2
- `Scoreboard` shows LIVE indicator when live — Requirement 3.3
- `Scoreboard` shows FINAL when ended — Requirement 3.4
- `Scoreboard` hidden when no WS data — Requirement 3.5
- `Scoreboard` hidden for non-sports markets — Requirement 3.6
- `Scoreboard` handles partial data (score only, period only, live only) — Requirements 7.1–7.3
- `Scoreboard` falls back to slug abbreviations — Requirement 7.4
- `EventCard` displays parsed score between team rows — Requirement 4.1
- `EventCard` displays formatted period in footer — Requirement 4.2
- `EventCard` shows FINAL for ended games — Requirement 4.3
- `EventCard` shows percentages when no score data — Requirement 4.4

### Integration Tests

- Real-time update: mock WS message → verify Scoreboard re-renders — Requirement 3.7
- `resolveGameState` integration with `resolveSportsLiveStatus` — Requirement 5.6
