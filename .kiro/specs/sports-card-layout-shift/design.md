# Sports Card Layout Shift Bugfix Design

## Overview

Sports event cards in the Explore grid suffer from cascading layout shift caused by three independent async data pipelines (team logos, button labels, team colors) resolving sequentially and each triggering a visible re-render. The fix introduces a unified "data ready" gate that holds sports card rendering in a skeleton state until all visual dependencies are available, uses slug-parsed abbreviations as the stable final label (eliminating the label swap), and applies team colors atomically via CSS transition instead of an abrupt inline style override.

## Glossary

- **Bug_Condition (C)**: A sports card renders when `teamImagesCached = false` OR `teamColorsCached = false` — the card lacks the data needed for its final visual state
- **Property (P)**: The card transitions at most once (skeleton → final) with no intermediate content swaps or color flashes
- **Preservation**: Cards with cached data (sessionStorage team images + module-level color palette Map) render instantly with correct logos, labels, and colors — no skeleton shown
- **`useBatchedTeamImages`**: Hook in `use-batched-team-images.ts` that fetches team logos for all sports events in a single batched query; results persisted to sessionStorage
- **`useTeamColors`**: Hook in `use-team-colors.ts` that extracts dominant color from team logo via Canvas pixel sampling, caches in module-level Map + sessionStorage
- **`extractSlugButtonLabels`**: Pure function in `event-card-sports-utils.ts` that parses `{league}-{abbrevA}-{abbrevB}-{date}` slugs into uppercase abbreviations keyed by team name
- **`SportsButtons`**: Component rendering moneyline action buttons with team abbreviation labels and team-colored backgrounds
- **`SportsTeamRows`**: Component rendering team logo + name rows above the buttons

## Bug Details

### Bug Condition

The bug manifests when a sports card renders without cached team data. The rendering pipeline resolves three dependencies sequentially — team images (Gamma `/teams` API), button labels (API abbreviations replacing slug-parsed ones), and team colors (Canvas extraction from loaded logo) — each triggering a visible re-render with content replacement.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type SportsCardRenderContext
  OUTPUT: boolean

  RETURN input.isSportsEvent = true
         AND (input.teamImagesCached = false OR input.teamColorsCached = false)
         // When either dependency is missing, the card renders with fallback
         // content that will be visibly replaced when the async data arrives
END FUNCTION
```

### Examples

- **NBA card, cold load**: Card renders with letter fallback "C" for Cavaliers → swaps to team logo once `/teams` responds → button shows "CLE" from slug → swaps to "CLE" from API (same text, still a re-render) → button bg is `bg-positive/10` green → flashes to dark wine-red once Canvas extracts Cavaliers' color
- **Soccer card, cold load**: Card renders with generic soccer ball → swaps to club crest → button label "BAR" from slug → swaps to "BAR" from API → button bg flashes from green to blue/red
- **Esports card, cold load**: Card renders with letter "F" for FaZe → swaps to FaZe logo → button colors flash from green/red to team-specific palette
- **NBA card, warm cache (NOT a bug)**: sessionStorage has team data + module Map has palette → card renders instantly with correct logo, label, and color — no shifts

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Cards with cached team data (sessionStorage images + module-level color Map) render instantly with final appearance — no skeleton delay
- Non-sports event cards (binary, multi-outcome) render with their current behavior unaffected
- Team data continues to be cached in sessionStorage with 7-day staleTime
- Color palettes continue to be cached in module-level Map + sessionStorage and applied synchronously on subsequent renders
- Slug-parsed abbreviations continue to be the primary button label source (they match Polymarket's display format)
- Batched team image fetching from the parent `EventsDiscovery` grid continues to be used over per-card API calls
- The `useTeamColors` Canvas extraction pipeline continues to work identically — only the application timing changes

**Scope:**
All inputs that do NOT involve uncached sports card rendering should be completely unaffected by this fix. This includes:
- Sports cards with fully cached data (instant render path)
- Non-sports binary event cards
- Non-sports multi-outcome event cards
- Mouse clicks, navigation, and all interactive behaviors on cards

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **No Unified Data-Ready Gate**: `EventCardComponent` renders `SportsTeamRows` and `SportsButtons` immediately regardless of whether team images or colors are available. Each hook (`useTeamImages`/`useBatchedTeamImages`, `useTeamColors`) resolves independently, causing sequential re-renders that each swap visible content.

2. **Label Double-Write**: `SportsButtons` first renders with slug-parsed abbreviations (available synchronously from `extractSlugButtonLabels`), then re-renders with API-provided `buttonLabels` once the Gamma `/teams` response arrives. Since both sources produce the same abbreviation for most leagues, this is a wasted re-render that can cause a brief text flicker if the API returns a different casing or format.

3. **Abrupt Color Application**: `SportsButtons` applies team colors via inline `style={{ backgroundColor, color }}` the moment `useTeamColors` resolves. There is no CSS transition on the button's background/color properties, so the switch from Tailwind fallback (`bg-positive/10`) to inline OKLCH color is an instantaneous visual jump.

4. **Sequential Dependency Chain**: Colors depend on logo URLs (Canvas needs the image to sample), and logos depend on the `/teams` API response. This creates a waterfall: API fetch → image load → Canvas extraction → color state update → re-render with inline styles. Each stage is a separate React state update.

## Correctness Properties

Property 1: Bug Condition - No Cascading Visual Shifts

_For any_ sports card render where the bug condition holds (team images or team colors are not cached), the fixed card SHALL transition at most once from a skeleton/placeholder state to its final visual state, with no intermediate logo swaps, label replacements, or color flashes.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

Property 2: Preservation - Cached Data Renders Instantly

_For any_ sports card render where the bug condition does NOT hold (team images AND team colors are already cached), the fixed card SHALL render identically to the original — immediately showing correct logos, labels, and colors with no skeleton delay, preserving the instant-render experience for returning users.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/web/src/domains/explore/components/event-card.tsx`

**Function**: `EventCardComponent` / `CardBody` / `SportsButtons`

**Specific Changes**:

1. **Add Data-Ready Gate in CardBody (sports path)**: Before rendering `SportsTeamRows` and `SportsButtons`, check whether team images are loaded (non-empty map for the relevant teams) AND team colors are resolved (paletteA/paletteB are non-null or explicitly neutral). If not ready, render a sports card skeleton (same dimensions as final card) instead of the live content.

2. **Lift `useTeamColors` to `useSportsCardData`**: Move the `useTeamColors` call from inside `SportsButtons` up to the `useSportsCardData` hook so the palette is available at the `EventCardComponent` level. This allows the data-ready gate to check color availability before rendering any sports content.

3. **Use Slug Abbreviations as Final Label**: In `SportsButtons`, use `extractSlugButtonLabels(event)` as the canonical label source. Remove the fallback-then-replace pattern where slug labels are shown first and then swapped with API `buttonLabels`. The slug-parsed abbreviations ARE the final labels (requirement 2.2 / 3.5 confirms they match Polymarket's format).

4. **Add CSS Transition for Color Application**: On the button elements in `SportsButtons`, add `transition-[background-color,color]` and `duration-200` classes so that when colors are applied (either from cache on mount or after extraction), the visual change is a smooth fade rather than an abrupt jump. For the cached path, the transition is imperceptible (colors are present from first paint).

5. **Synchronous Cache Check for Skip-Skeleton**: At the top of the sports rendering path, check `paletteCache.has(logoUrlA)` and `paletteCache.has(logoUrlB)` (exported from `use-team-colors.ts`) alongside the team images availability. If all data is cached, skip the skeleton entirely and render the final card — preserving the instant-render behavior for warm caches.

**File**: `apps/web/src/domains/trading/hooks/sports/use-team-colors.ts`

**Function**: Module exports

**Specific Changes**:

6. **Export `hasCachedPalette` helper**: Add a simple exported function `hasCachedPalette(url: string | null): boolean` that checks the module-level `paletteCache` Map synchronously. This allows `EventCard` to determine color readiness without waiting for the async extraction.

**File**: `apps/web/src/domains/explore/components/event-card-sports-utils.ts`

**Function**: `extractSlugButtonLabels`

**Specific Changes**:

7. **No changes needed**: The function already correctly parses slug abbreviations keyed by team name. It will be used as the single source of truth for button labels instead of being a fallback.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that render a sports `EventCard` with empty caches (no sessionStorage, no module-level palette Map) and count the number of distinct visual states the card passes through. Run these tests on the UNFIXED code to observe failures and understand the root cause.

**Test Cases**:
1. **Cold NBA Card Test**: Render an NBA card with mocked empty caches and a delayed `/teams` API response — count re-renders that change visible content (will show 3+ state changes on unfixed code)
2. **Cold Soccer Card Test**: Render a 3-way soccer card with empty caches — observe logo swap + color flash sequence (will fail on unfixed code)
3. **Label Swap Test**: Render a card where slug abbreviation differs from API abbreviation (e.g. slug "lac" vs API "LAC") — observe text content replacement (will fail on unfixed code)
4. **Color Flash Test**: Render a card and observe the transition from `bg-positive/10` to inline OKLCH color — measure if it's instantaneous or transitioned (will fail on unfixed code)

**Expected Counterexamples**:
- Cards pass through 3–5 distinct visual states before reaching final appearance
- Possible causes: no data-ready gate, sequential hook resolution, abrupt inline style application

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  renderedStates := observeRenderStates(EventCard'(input))
  ASSERT countVisualStateChanges(renderedStates) <= 1
  ASSERT noIntermediateContentSwaps(renderedStates)
  ASSERT noColorFlash(renderedStates)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT EventCard(input) = EventCard'(input)
  // Cards with cached data render identically — same logos, labels, colors, no skeleton
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various team names, slug formats, cached/uncached states)
- It catches edge cases that manual unit tests might miss (unusual slug formats, partial cache states)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for cached-data renders, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Cached Image Preservation**: Verify that when sessionStorage has team data, the card renders immediately with correct logos — no skeleton shown before or after fix
2. **Cached Color Preservation**: Verify that when module-level paletteCache has entries, colors are applied synchronously on first render — no transition delay
3. **Non-Sports Card Preservation**: Verify that binary and multi-outcome cards render identically before and after the fix
4. **Batched Fetch Preservation**: Verify that cards in the Explore grid continue to use parent-provided batched data rather than per-card API calls

### Unit Tests

- Test `hasCachedPalette` returns correct boolean for cached vs uncached URLs
- Test `extractSlugButtonLabels` produces correct abbreviations for various slug formats
- Test data-ready gate logic: skeleton shown when images missing, skeleton shown when colors missing, no skeleton when both cached
- Test that CSS transition classes are present on button elements

### Property-Based Tests

- Generate random `SportsCardRenderContext` objects with varying cache states and verify the data-ready gate correctly distinguishes cached (instant) vs uncached (skeleton) paths
- Generate random team names and slug formats, verify `extractSlugButtonLabels` output matches expected abbreviation format
- Generate random RGB triples and verify `derivePaletteFromRgb` always produces WCAG AA compliant contrast ratios (existing property, preserved)

### Integration Tests

- Test full card render lifecycle: cold start → skeleton → single transition to final state
- Test warm cache path: card renders with final appearance on first paint, no skeleton flash
- Test grid-level behavior: multiple cards in Explore grid all show skeletons simultaneously, then transition to final state without cascading wave effect
