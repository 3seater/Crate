# Comments Position Badge Fixes — Bugfix Design

## Overview

The position badges in the Comments tab have three interrelated bugs: (1) `formatPositionSize` incorrectly divides by 10^6 when the Gamma API already returns human-readable share counts, (2) positions in non-current markets show no market name label, and (3) there is no dropdown to view all of a commenter's holdings across the event. The fix involves correcting the formatting math, building a tokenId → market name mapping from the event's markets data (already available in `MarketTabs` via `useAllMarketsTabEventData`), and redesigning `PositionBadge` to show the largest position as the primary badge with a chevron-triggered popover listing all positions.

## Glossary

- **Bug_Condition (C)**: The conditions that trigger incorrect behavior — specifically: (1) any position size being formatted, (2) a position whose tokenId does not match the current market's yes/no tokens
- **Property (P)**: The desired behavior — correct compact formatting without 10^6 division, market name labels for non-current-market positions, and a dropdown showing all positions sorted by size
- **Preservation**: Existing behavior for current-market positions (green/red/grey badge with outcome label) must remain unchanged
- **formatPositionSize**: The function in `comments-utils.ts` that formats raw position sizes into compact notation (K/M suffixes)
- **matchPosition**: The function in `comments-utils.ts` that matches a commenter's positions against the current market's token IDs
- **PositionBadge**: The component in `position-badge.tsx` that renders the colored pill next to commenter names
- **tokenId → market mapping**: A `Map<string, { marketName: string; side: "yes" | "no" }>` built from the event's markets data, mapping each token ID to its market name and outcome side
- **allEventMarkets**: The array of all markets in the current event, available via `useAllMarketsTabEventData` in `MarketTabs`

## Bug Details

### Bug Condition

The bug manifests in three scenarios: (1) ALL position sizes are incorrectly formatted because `formatPositionSize` unconditionally divides by 10^6, (2) positions in non-current markets show no market name because the component only handles current-market token matching, and (3) multiple positions are not surfaced because only the first match or first fallback is shown.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { positions: CommentPosition[], currentYesTokenId: string, currentNoTokenId: string }
  OUTPUT: boolean

  // Bug 1: ALL positions trigger incorrect formatting (universal)
  // Bug 2 & 3: positions in non-current markets have no name/dropdown
  hasAnyPosition := positions.some(p => p.tokenId != null AND Number(p.positionSize) > 0)
  hasNonCurrentMarketPosition := positions.some(p =>
    p.tokenId != null
    AND p.tokenId ≠ currentYesTokenId
    AND p.tokenId ≠ currentNoTokenId
    AND Number(p.positionSize) > 0
  )
  hasMultiplePositions := positions.filter(p => p.tokenId != null AND Number(p.positionSize) > 0).length > 1

  RETURN hasAnyPosition  // Bug 1 affects all
         OR hasNonCurrentMarketPosition  // Bug 2
         OR hasMultiplePositions  // Bug 3
END FUNCTION
```

### Examples

- **Bug 1**: Commenter holds 354,821 shares → API returns `positionSize: "354821"` → current code divides by 10^6 → displays "0" or "0.4" instead of "354.8K"
- **Bug 1**: Commenter holds 1,500 shares → API returns `positionSize: "1500"` → current code divides by 10^6 → displays "0" instead of "1.5K"
- **Bug 2**: Commenter holds position in "Will France win?" market (tokenId `abc123`) but user is viewing "Will Germany win?" market → badge shows "354.8K" with no market name label
- **Bug 3**: Commenter holds positions in 3 markets across the event → only the first non-null position is shown as a fallback badge, no way to see the other 2
- **Edge case**: Commenter holds position in current market (tokenId matches yesTokenId) → should continue showing "354.8K Yes" with green badge (unchanged)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Current-market positions (tokenId matches yesTokenId or noTokenId) must continue to display with the correct outcome label ("Yes"/"No"/named outcome) and color coding (green for Yes-side, red for No-side in binary, grey for non-binary No-side)
- Commenters with no positions (empty array or all null tokenIds) must continue to show no badge
- Commenters with zero or negative position sizes must continue to show no badge
- The existing `matchPosition` function behavior for current-market matching must remain unchanged
- Mouse clicks, comment threading, time formatting, and all other comment UI must be unaffected

**Scope:**
All inputs that do NOT involve position size formatting or non-current-market position display should be completely unaffected by this fix. This includes:
- Comment body rendering
- Reply threading and grouping
- Timestamp formatting
- Profile avatar display
- Reaction counts
- Filter bar (holders only, sort mode)

## Hypothesized Root Cause

Based on the bug description and code analysis, the issues are:

1. **Incorrect Division in formatPositionSize**: The function comment says "Gamma API returns position sizes in 6-decimal micro-units" and divides by `1_000_000`. However, the Gamma API actually returns human-readable share counts directly (e.g. `"354821"` means 354,821 shares). The division is wrong — the raw number should be formatted directly with compact notation.

2. **No tokenId → Market Name Mapping**: The `PositionBadge` component only receives the current market's yesTokenId/noTokenId and can only match against those. When a position belongs to a different market in the same event, `matchPosition` returns null and the fallback badge shows only a number with no context about which market it belongs to.

3. **Single Position Display**: The `Bubble` component in `comments.tsx` finds only the first matching position for the current market, or the first non-null fallback position. There is no mechanism to display multiple positions or sort by size.

4. **Missing Event Markets Data in Comments**: The `Comments` component does not receive the event's markets data (which `MarketTabs` already has via `useAllMarketsTabEventData`). Without this data, it cannot build the tokenId → market name mapping needed for non-current-market badges.

## Correctness Properties

Property 1: Bug Condition - Position Size Formatting

_For any_ position where `positionSize` is a non-null string representing a positive number, the fixed `formatPositionSize` function SHALL format the raw numeric value directly (without dividing by 10^6) using compact notation: ≥1M → "X.YM", ≥1K → "X.YK", <1K → integer string.

**Validates: Requirements 2.1**

Property 2: Bug Condition - Non-Current Market Name Resolution

_For any_ position whose tokenId does not match the current market's yesTokenId or noTokenId, and a tokenId → market mapping is available, the fixed PositionBadge SHALL display the resolved market name alongside the formatted position size.

**Validates: Requirements 2.2**

Property 3: Bug Condition - Multi-Position Dropdown

_For any_ commenter with multiple positions across the event (more than one position with non-null tokenId and positive size), the fixed PositionBadge SHALL display the largest position as the primary badge and provide a chevron that reveals a dropdown listing ALL positions sorted by size (largest first), each showing market name, size, and Yes/No outcome pill.

**Validates: Requirements 2.3, 2.4**

Property 4: Preservation - Current Market Badge Unchanged

_For any_ position whose tokenId matches the current market's yesTokenId or noTokenId, the fixed code SHALL produce the same badge appearance as the original code, preserving the outcome label, color coding (green/red/grey), and formatted size.

**Validates: Requirements 3.1, 3.4**

Property 5: Preservation - No Badge for Empty/Zero Positions

_For any_ commenter with no positions (empty array, all null tokenIds, or all zero/negative sizes), the fixed code SHALL continue to show no badge, identical to the original behavior.

**Validates: Requirements 3.2, 3.3**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/web/src/domains/trading/components/market/comments-utils.ts`

**Function**: `formatPositionSize`

**Specific Changes**:
1. **Remove 10^6 division**: Delete the line `const size = rawSize / 1_000_000;` and use `rawSize` directly as the value to format with compact notation. The function should format the input number as-is: ≥1M → "X.YM", ≥1K → "X.YK", <1K → integer.

---

**File**: `apps/web/src/domains/trading/components/market/comments-utils.ts`

**New Export**: `buildTokenMarketMap`

**Specific Changes**:
2. **Add tokenId → market mapping builder**: Create a utility function that takes an array of event markets and returns a `Map<string, { marketName: string; side: "yes" | "no" }>`. For each market, extract its tokens (yes at index 0, no at index 1) and map each token_id to the market's `groupItemTitle` or `question` and the token's side.

---

**File**: `apps/web/src/domains/trading/components/market/position-badge.tsx`

**Component**: `PositionBadge`

**Specific Changes**:
3. **Redesign props interface**: Accept `positions: CommentPosition[]` (all positions), `tokenMarketMap: Map<string, { marketName: string; side: "yes" | "no" }>` (the mapping), plus the existing current-market props (yesTokenId, noTokenId, yesOutcomeLabel, noOutcomeLabel).
4. **Resolve all positions**: For each position with non-null tokenId and positive size, resolve its market name and side using the tokenMarketMap (current-market positions use existing logic).
5. **Sort by size**: Sort resolved positions by size descending. Show the largest as the primary badge.
6. **Primary badge with market name**: If the largest position is in a non-current market, show market name + size. If in the current market, show size + outcome label (existing behavior).
7. **Chevron + Popover dropdown**: When multiple positions exist, add a ChevronDown icon that opens a Popover (from shadcn/ui or Radix). The dropdown lists all positions sorted by size, each row showing: market name, formatted size, and a small Yes/No pill indicating the side.

---

**File**: `apps/web/src/domains/trading/components/market/market-tabs.tsx`

**Specific Changes**:
8. **Pass event markets to Comments**: Pass `allEventMarkets` (already computed by `useAllMarketsTabEventData`) as a prop to the `Comments` component.

---

**File**: `apps/web/src/domains/trading/components/market/comments.tsx`

**Specific Changes**:
9. **Accept event markets prop**: Add `eventMarkets?: Market[]` to `CommentsProps` and thread it down to `Bubble`.
10. **Build tokenMarketMap**: In the `Comments` component (or memoized at the top level), call `buildTokenMarketMap(eventMarkets)` to create the mapping.
11. **Replace fallback badge logic**: In `Bubble`, replace the current `badgePosition` / `fallbackPosition` logic with a single `PositionBadge` that receives all positions and the tokenMarketMap. The new `PositionBadge` handles all the logic internally (largest position, dropdown, market name resolution).

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests for `formatPositionSize` with known Gamma API values and assert correct compact formatting. Run these tests on the UNFIXED code to observe failures (values will be 10^6 too small).

**Test Cases**:
1. **Large Position Test**: `formatPositionSize(354821)` — expect "354.8K", unfixed code returns "0" (will fail on unfixed code)
2. **Medium Position Test**: `formatPositionSize(1500)` — expect "1.5K", unfixed code returns "0" (will fail on unfixed code)
3. **Small Position Test**: `formatPositionSize(56)` — expect "56", unfixed code returns "0" (will fail on unfixed code)
4. **Million Position Test**: `formatPositionSize(2500000)` — expect "2.5M", unfixed code returns "2.5" (will fail on unfixed code)

**Expected Counterexamples**:
- All formatted values are 10^6 too small because of the erroneous division
- Possible cause confirmed: the `/ 1_000_000` line in `formatPositionSize`

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := formatPositionSize'(Number(input.positionSize))
  size = Number(input.positionSize)
  IF size >= 1_000_000 THEN
    ASSERT result matches /^\d+(\.\d)?M$/
  ELSE IF size >= 1_000 THEN
    ASSERT result matches /^\d+(\.\d)?K$/
  ELSE
    ASSERT result matches /^\d+$/
  END IF
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold (current-market positions), the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition_MarketName(input) DO
  ASSERT renderPositionBadge_original(input) = renderPositionBadge_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for current-market positions (where matchPosition returns a valid result), then write property-based tests capturing that the badge output is identical after the fix for those inputs.

**Test Cases**:
1. **Current Market Yes Position Preservation**: Verify that positions matching yesTokenId continue to show green badge with outcome label and correctly formatted size
2. **Current Market No Position Preservation**: Verify that positions matching noTokenId continue to show red/grey badge with outcome label
3. **Empty Positions Preservation**: Verify that commenters with no positions continue to show no badge
4. **Zero Size Preservation**: Verify that positions with size 0 or negative continue to show no badge

### Unit Tests

- Test `formatPositionSize` with various inputs: 0, 1, 56, 999, 1000, 1500, 354821, 1000000, 2500000
- Test `buildTokenMarketMap` with mock event markets data
- Test `matchPosition` continues to work correctly for current-market tokens
- Test PositionBadge renders correctly with single position (current market)
- Test PositionBadge renders correctly with single position (non-current market, shows market name)
- Test PositionBadge renders correctly with multiple positions (shows largest, has chevron)
- Test PositionBadge dropdown lists all positions sorted by size

### Property-Based Tests

- Generate random position sizes (1 to 10^8) and verify `formatPositionSize` output matches the expected compact format pattern without 10^6 division
- Generate random sets of positions with random tokenIds and verify the largest is always shown as primary badge
- Generate random current-market positions and verify badge output matches the preservation contract (same color, same label)

### Integration Tests

- Test full Comments component with event markets data passed down, verifying non-current-market positions show market names
- Test chevron click opens popover with all positions listed
- Test that switching between sort modes and holders-only filter does not break position badge display
