# Sports Game Aggregation Bugfix Design

## Overview

The sports trading dropdown (`TradingSelectorCard` → `SportsDropdownContent`) fails to aggregate markets across sibling Polymarket events that share a `game_id`. Polymarket structures sports games as multiple events — one for moneyline, another for spreads, another for totals — all linked by `game_id`. The dropdown should show all market types with tabs, but currently only shows moneyline from the single event. Two root causes: (1) the `gameId` field passes through `.loose()` without explicit schema validation, making extraction fragile, and the `showDropdown` gate uses pre-merge market count; (2) the `ThreeWayMoneylineRow` component renders 3-way outcomes (soccer/draws) as cramped inline pills instead of full-width rows. The fix adds `gameId`/`game_id` to `MarketSchema`, recomputes `showDropdown` from merged markets, and replaces the inline pill layout with individual outcome rows for 3-way sports.

## Glossary

- **Bug_Condition (C)**: A sports market has a valid `game_id` linking to sibling events with additional market types, but the dropdown either doesn't appear or only shows single-event markets; OR a 3-way moneyline sport renders cramped inline pills instead of full-width rows
- **Property (P)**: All game-wide markets appear in the dropdown with tabs, and 3-way moneyline outcomes render as individual full-width rows
- **Preservation**: Non-sports dropdowns, single-market events, esports tab layout, 2-way moneyline single-row rendering, and `listByGameId` error handling must remain unchanged
- **`game_id`**: A Polymarket identifier that links multiple events belonging to the same sports game (e.g. moneyline event + spreads event + totals event for Lakers vs Celtics)
- **`gameId`**: The camelCase variant of `game_id` returned by Gamma API on market objects via `.loose()` passthrough
- **`MarketSchema`**: Zod schema in `apps/server/src/lib/polymarket/schemas/gamma.ts` that validates Gamma API market responses; uses `.loose()` to allow extra fields
- **`showDropdown`**: Boolean in `TradingSelectorCard` that gates whether the dropdown chevron and overlay are rendered; currently `hasEvent && selectorItems.length > 1`
- **`selectorItems`**: Array of `SelectorMarket` objects derived from `prepareSelectorMarkets(eventMarkets)` — used for non-sports dropdown rendering
- **`ThreeWayMoneylineRow`**: Component in `sports-selector-card.tsx` that renders 3-outcome moneyline markets (Team A / Draw / Team B) as inline pills

## Bug Details

### Bug Condition

The bug manifests in two distinct scenarios:

**Scenario A — Game aggregation failure**: A user views a sports market at `/market/{slug}` where the game spans multiple Polymarket events sharing a `game_id`. The `gameId` field is not explicitly validated in `MarketSchema` (passes through `.loose()`), so it may not survive normalization reliably. Even when `gameMarkets` are fetched successfully, `showDropdown` is computed from `selectorItems.length` which derives from pre-merge `eventMarkets` — if the single event has only 1 market (e.g. a moneyline-only event), `showDropdown` is `false` and the dropdown never renders.

**Scenario B — 3-way moneyline rendering**: When a soccer/draw sport has 3 moneyline outcomes, `ThreeWayMoneylineRow` renders them as cramped inline flex pills under a "Moneyline" header. Labels truncate (e.g. "Los Ange..."), and the layout is inconsistent with how 2-way sports render moneyline as a single clickable row.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { market: Market, eventMarkets: Market[], gameMarkets: Market[] }
  OUTPUT: boolean

  // Scenario A: Game aggregation — dropdown hidden despite game-wide markets existing
  hasGameId := input.market.gameId != null OR input.market.game_id != null
  gameMarketsExist := input.gameMarkets.length > input.eventMarkets.length
  singleEventCount := prepareSelectorMarkets(input.eventMarkets).length
  dropdownHidden := singleEventCount <= 1
  scenarioA := hasGameId AND gameMarketsExist AND dropdownHidden

  // Scenario B: 3-way moneyline rendered as inline pills instead of full-width rows
  moneylineMarkets := input.eventMarkets.filter(m => classifySportsMarketType(m) == "moneyline")
  isThreeWay := moneylineMarkets.length > 2
  scenarioB := isThreeWay  // ThreeWayMoneylineRow always renders cramped pills

  RETURN scenarioA OR scenarioB
END FUNCTION
```

### Examples

- **Soccer game (Austin FC vs LA FC)**: User navigates to `/market/austin-fc-vs-lafc-moneyline`. The event has 3 moneyline markets (Austin FC, Draw, LAFC). `game_id` links to sibling events with spreads/totals. Actual: dropdown shows only 3 moneyline pills, no tabs. Expected: dropdown shows tabs (Game Lines, 1st Half, etc.) with all market types, moneyline outcomes as individual rows.
- **NBA game (Warriors vs Hawks)**: User navigates to `/market/warriors-vs-hawks-moneyline`. The event has 1 moneyline market. `game_id` links to spreads/totals events. Actual: works correctly because NBA moneyline events may have enough markets in the single event to trigger `showDropdown`. Expected: continues working.
- **Soccer moneyline rendering**: `ThreeWayMoneylineRow` renders "Austin FC 16¢ | Draw 63¢ | Los Ange..." as cramped pills. Expected: three full-width rows — "Austin FC" with price, "Draw" with price, "Los Angeles FC" with price.
- **Single-market non-sports event**: No `game_id`, single market. `showDropdown` is `false`. Expected: no dropdown (unchanged).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Non-sports market dropdowns continue using `selectorItems` for the standard option list
- Single-market events without `game_id` continue hiding the dropdown
- Multi-market non-sports events (political, crypto) continue showing the standard dropdown list
- Esports events continue rendering with `EsportsTabContent` (Series Lines, Game 1, etc.)
- 2-way sports (NBA, NFL) continue rendering "Moneyline" as a single clickable row via `MoneylineRow`
- `listByGameId` with empty/invalid `game_id` continues returning empty array without errors
- Mouse clicks, navigation, prefetch-on-hover all continue working

**Scope:**
All inputs that do NOT involve (a) a sports market with a `game_id` linking to additional sibling events, or (b) a 3-way moneyline rendering, should be completely unaffected by this fix. This includes:
- All non-sports markets
- Sports markets without `game_id`
- 2-way moneyline sports (NBA, NFL, etc.)
- Esports events

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **`gameId` not in `MarketSchema`**: The `MarketSchema` in `gamma.ts` does not explicitly declare `gameId` or `game_id` as optional fields. While `.loose()` allows extra fields to pass through, the typed output (`ValidatedMarket`) does not include `gameId`, so TypeScript casts are required and the field may be stripped during normalization steps like `sanitizeImageUrls` or `synthesizeTokens`. Adding `gameId: z.string().optional()` and `game_id: z.string().optional()` to `MarketSchema` ensures the field survives validation and is available in the typed output.

2. **`showDropdown` uses pre-merge count**: In `TradingSelectorCard`, `showDropdown` is `hasEvent && selectorItems.length > 1`. But `selectorItems` is derived from `eventMarkets`, which is the merged array. The real issue is timing — `selectorItems` is computed from `eventMarkets` which starts as `singleEventMarkets` and only becomes the merged array after `gameMarkets` loads asynchronously. If the single event has only 1 market, `showDropdown` is `false` on initial render and the dropdown never appears. The fix should compute `showDropdown` from the final merged `eventMarkets` count (which includes game-wide markets once loaded).

3. **`ThreeWayMoneylineRow` inline pill layout**: The component uses `flex gap-1.5` with `flex-1` pills, causing each outcome to compete for horizontal space. With 3 outcomes + prices, labels truncate. The fix replaces this with a vertical stack of full-width rows, each showing the outcome label and price — matching the `OptionRow` pattern used elsewhere.

4. **Soccer vs NBA structural difference**: NBA moneyline events on Polymarket may include multiple markets within a single event (moneyline + spreads in one event), so `singleEventMarkets` already has enough markets for `showDropdown` to be `true`. Soccer events may be structured with moneyline in one event and spreads/totals in separate events, so the single event has only 1-3 markets. This means the `game_id` aggregation path is critical for soccer but less so for NBA.

## Correctness Properties

Property 1: Bug Condition - Game-Wide Market Aggregation

_For any_ sports market with a valid `game_id` that maps to additional markets across sibling events, the fixed `TradingSelectorCard` SHALL display a dropdown containing all game-wide markets organized into tabs (Game Lines, 1st Half, Player Props, etc.), using the merged market count (including game-wide markets) to determine dropdown visibility.

**Validates: Requirements 2.1, 2.3, 2.4**

Property 2: Bug Condition - Three-Way Moneyline Rendering

_For any_ 3-way moneyline sport (soccer, draws) where `moneylineMarkets.length > 2`, the fixed `SportsTabContent` SHALL render each outcome as its own full-width row with outcome label and Yes price, NOT as cramped inline pills under a "Moneyline" header.

**Validates: Requirements 2.5**

Property 3: Preservation - Non-Sports and 2-Way Sports Behavior

_For any_ input where the bug condition does NOT hold (non-sports markets, single-market events without `game_id`, 2-way sports like NBA/NFL, esports events), the fixed code SHALL produce exactly the same behavior as the original code, preserving dropdown visibility logic, tab rendering, moneyline single-row display, and esports tab layout.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/server/src/lib/polymarket/schemas/gamma.ts`

**Schema**: `MarketSchema`

**Specific Changes**:
1. **Add `gameId` and `game_id` to MarketSchema**: Add `gameId: z.string().optional()` and `game_id: z.string().optional()` as explicit optional fields in `MarketSchema`. This ensures the field survives Zod validation and appears in the `ValidatedMarket` type, eliminating the need for unsafe type casts in `TradingSelectorCard`.

---

**File**: `apps/web/src/components/trading/trading-selector-card.tsx`

**Component**: `TradingSelectorCard`

**Specific Changes**:
2. **Fix `showDropdown` to use merged market count**: Change `showDropdown` from `hasEvent && selectorItems.length > 1` to use the merged `eventMarkets` length. Since `eventMarkets` is already the merged array (game-wide when available, single-event fallback), the condition should be `hasEvent && (selectorItems.length > 1 || (gameId && eventMarkets.length > 1))` — or more simply, derive `selectorItems` and `showDropdown` from the final merged `eventMarkets` which already accounts for game-wide markets.

3. **Remove unsafe `gameId` type casts**: Once `gameId`/`game_id` are in `MarketSchema`, replace `(market as { gameId?: string }).gameId` casts with direct property access on the typed market object.

---

**File**: `apps/web/src/components/trading/sports-selector-card.tsx`

**Component**: `ThreeWayMoneylineRow`

**Specific Changes**:
4. **Replace inline pills with full-width rows**: Refactor `ThreeWayMoneylineRow` to render each outcome as a full-width button row (similar to `OptionRow`) instead of the current `flex gap-1.5` inline pill layout. Each row shows the full outcome label (no truncation) and the Yes price. Remove the "Moneyline" header since each row is self-explanatory.

5. **Keep 2-way moneyline unchanged**: The `SportsTabContent` conditional `groups.moneylineMarkets.length > 2 ? <ThreeWayMoneylineRow> : <MoneylineRow>` stays, but `ThreeWayMoneylineRow` now renders vertically. 2-way sports continue using `MoneylineRow` (single "Moneyline" row).

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate the `TradingSelectorCard` logic with mock market data representing soccer games (3-way moneyline, game_id linking to sibling events) and verify that `showDropdown` evaluates correctly and `ThreeWayMoneylineRow` renders full-width rows. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Schema passthrough test**: Create a market object with `gameId: "abc123"`, validate through `MarketSchema`, check if `gameId` is present in the output (will fail — `.loose()` passes it but it's not in the typed output)
2. **showDropdown with single-event soccer**: Mock a soccer event with 3 moneyline markets in one event and `game_id` linking to 10 more markets. Verify `showDropdown` is `true` (will fail on unfixed code if selectorItems count is used before merge)
3. **ThreeWayMoneylineRow layout**: Render `ThreeWayMoneylineRow` with 3 soccer outcomes and verify each outcome gets a full-width row (will fail — current code renders inline pills)
4. **NBA game aggregation**: Mock an NBA event with 1 moneyline market and `game_id` linking to spreads/totals. Verify dropdown appears (may pass if NBA events already have enough markets)

**Expected Counterexamples**:
- `showDropdown` evaluates to `false` for soccer games with single-event moneyline + game-wide spreads/totals
- `ThreeWayMoneylineRow` renders cramped pills with truncated labels
- Possible causes: `gameId` not in schema typed output, `showDropdown` using pre-merge count

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  // Scenario A: game aggregation
  IF input.market.gameId != null AND gameMarketsExist THEN
    mergedMarkets := mergeGameMarkets(input.gameMarkets, input.eventMarkets)
    showDropdown := hasEvent AND prepareSelectorMarkets(mergedMarkets).length > 1
    ASSERT showDropdown == true
    ASSERT sportsDropdown.hasTabs == true
  END IF

  // Scenario B: 3-way moneyline rendering
  IF moneylineMarkets.length > 2 THEN
    rendered := renderThreeWayMoneyline(moneylineMarkets)
    ASSERT rendered.rows.length == moneylineMarkets.length
    ASSERT EACH row IS full-width with complete label (no truncation)
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT showDropdown_original(input) == showDropdown_fixed(input)
  ASSERT renderDropdown_original(input) == renderDropdown_fixed(input)
  ASSERT moneylineRow_original(input) == moneylineRow_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for non-sports markets, 2-way sports, and esports, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Non-sports dropdown preservation**: Verify that political/crypto events with multiple markets continue showing the standard dropdown list without sports tabs
2. **2-way moneyline preservation**: Verify NBA/NFL games continue rendering "Moneyline" as a single `MoneylineRow` (not individual team rows)
3. **Esports tab preservation**: Verify LoL/CS2 events continue rendering Series Lines / Game N tabs with `EsportsTabContent`
4. **Single-market no-dropdown preservation**: Verify single-market events without `game_id` continue hiding the dropdown
5. **listByGameId error handling**: Verify empty/invalid `game_id` returns empty array without UI breakage

### Unit Tests

- Test `MarketSchema` validation with `gameId` field present and absent
- Test `showDropdown` logic with various combinations of single-event and game-wide market counts
- Test `ThreeWayMoneylineRow` renders full-width rows for 3 outcomes
- Test `MoneylineRow` continues rendering single row for 2-way sports
- Test `groupSportsMarkets` correctly identifies 3-way vs 2-way moneyline

### Property-Based Tests

- Generate random market arrays with varying `game_id` presence and moneyline counts; verify `showDropdown` is `true` whenever merged market count > 1
- Generate random 2-way and 3-way moneyline configurations; verify 2-way always uses `MoneylineRow` and 3-way always uses full-width rows
- Generate random non-sports market arrays; verify sports tab UI is never triggered

### Integration Tests

- Test full flow: navigate to soccer market → verify dropdown shows all game-wide markets with tabs
- Test full flow: navigate to NBA market → verify dropdown continues working with tabs
- Test full flow: navigate to non-sports market → verify standard dropdown renders
- Test that switching between markets in the dropdown navigates correctly
