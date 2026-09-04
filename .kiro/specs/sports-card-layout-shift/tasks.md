# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Cascading Visual Shifts on Cold Sports Card Render
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate cascading layout shifts exist
  - **Scoped PBT Approach**: Scope the property to sports cards rendered with empty caches (no sessionStorage team data, no module-level paletteCache entries)
  - Test that rendering an `EventCardComponent` with `isBugCondition(input) = true` (isSportsEvent AND (teamImagesCached = false OR teamColorsCached = false)) produces at most 1 visual state change
  - Generate random `SportsCardRenderContext` objects where `teamImagesCached = false` OR `teamColorsCached = false`
  - Assert: `countVisualStateChanges(renderedStates) <= 1` (skeleton → final only)
  - Assert: `noIntermediateContentSwaps(renderedStates)` — no logo swap, no label swap, no color flash
  - Mock empty sessionStorage and cleared `paletteCache` Map to simulate cold load
  - Mock delayed Gamma `/teams` API response to observe sequential resolution
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (cards pass through 3–5 distinct visual states: letter fallback → logo, slug label → API label, green/red fallback → team OKLCH colors)
  - Document counterexamples found (e.g., "NBA card renders 4 intermediate states before final appearance")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Cached Sports Cards Render Instantly Without Skeleton
  - **IMPORTANT**: Follow observation-first methodology
  - **IMPORTANT**: Write these tests BEFORE implementing the fix
  - Observe: Sports card with sessionStorage team data + module-level paletteCache entries renders immediately with correct logos, labels, and colors on UNFIXED code
  - Observe: Non-sports binary event cards render with current behavior on UNFIXED code
  - Observe: Non-sports multi-outcome event cards render with current behavior on UNFIXED code
  - Write property-based test: for all `SportsCardRenderContext` where `isBugCondition(input) = false` (teamImagesCached = true AND teamColorsCached = true), card renders identically — no skeleton delay, correct logos/labels/colors from first paint
  - Write property-based test: for all non-sports events, rendering is completely unaffected
  - Generate random team names, slug formats, and cached palette entries to verify instant render path
  - Verify `extractSlugButtonLabels` output matches expected abbreviation format for various slug patterns
  - Verify batched team image data from parent `EventsDiscovery` is still used (no per-card API calls)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (cached path already works correctly — this is the behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Fix for sports card cascading layout shift

  - [x] 3.1 Export `hasCachedPalette` helper from `use-team-colors.ts`
    - Add exported function `hasCachedPalette(url: string | null): boolean` that checks the module-level `paletteCache` Map synchronously
    - Returns `true` if `url` is non-null and `paletteCache.has(url)` is true
    - Returns `false` for null/undefined URLs or uncached URLs
    - This enables `EventCard` to determine color readiness without waiting for async extraction
    - File: `apps/web/src/domains/trading/hooks/sports/use-team-colors.ts`
    - _Requirements: 2.3, 3.4_

  - [x] 3.2 Lift `useTeamColors` from `SportsButtons` to `useSportsCardData` hook
    - Move the `useTeamColors` call from inside `SportsButtons` up to the `useSportsCardData` hook (or equivalent card-level data hook)
    - Pass `paletteA` and `paletteB` down as props to `SportsButtons` instead of calling the hook internally
    - This allows the data-ready gate to check color availability at the `EventCardComponent` level before rendering any sports content
    - File: `apps/web/src/domains/explore/components/event-card.tsx`
    - _Bug_Condition: isBugCondition(input) where teamColorsCached = false causes color flash when useTeamColors resolves inside SportsButtons_
    - _Expected_Behavior: Colors available at card level before rendering sports content_
    - _Preservation: Cached palettes still applied synchronously via useState initializer in useTeamColors_
    - _Requirements: 2.1, 2.3, 2.4, 3.4_

  - [x] 3.3 Add data-ready gate in `CardBody` (sports path)
    - Before rendering `SportsTeamRows` and `SportsButtons`, check: team images loaded (non-empty for relevant teams) AND team colors resolved (paletteA/paletteB non-null or explicitly neutral via `hasCachedPalette`)
    - If not ready: render a sports card skeleton (same dimensions as final card) instead of live content
    - If ready (cached path): skip skeleton entirely and render final card immediately
    - Use `hasCachedPalette(logoUrlA) && hasCachedPalette(logoUrlB)` alongside team images availability for the synchronous cache check
    - File: `apps/web/src/domains/explore/components/event-card.tsx`
    - _Bug_Condition: isBugCondition(input) where isSportsEvent = true AND (teamImagesCached = false OR teamColorsCached = false)_
    - _Expected_Behavior: Card transitions at most once (skeleton → final) with no intermediate content swaps_
    - _Preservation: Cards with cached data skip skeleton entirely — no delay for warm cache path_
    - _Requirements: 2.1, 2.3, 2.5, 3.1_

  - [x] 3.4 Use slug abbreviations as final button labels (remove label swap pattern)
    - In `SportsButtons`, use `extractSlugButtonLabels(event)` as the canonical and final label source
    - Remove the fallback-then-replace pattern where slug labels render first and then swap with API `buttonLabels`
    - The slug-parsed abbreviations ARE the final labels (they match Polymarket's display format)
    - This eliminates the text content swap re-render entirely
    - File: `apps/web/src/domains/explore/components/event-card.tsx`
    - File: `apps/web/src/domains/explore/components/event-card-sports-utils.ts` (no changes needed — already correct)
    - _Bug_Condition: isBugCondition(input) where slug label "CLE" swaps to API label "CLE" causing wasted re-render_
    - _Expected_Behavior: Single stable label from slug parsing, no swap_
    - _Preservation: Slug-parsed abbreviations continue as primary label source (requirement 3.5)_
    - _Requirements: 2.2, 3.5_

  - [x] 3.5 Add CSS transition for color application on sports buttons
    - Add `transition-[background-color,color]` and `duration-200` Tailwind classes to button elements in `SportsButtons`
    - When colors are applied (from cache on mount or after extraction), the visual change is a smooth 200ms fade
    - For the cached path, the transition is imperceptible (colors present from first paint)
    - File: `apps/web/src/domains/explore/components/event-card.tsx`
    - _Bug_Condition: Abrupt inline style override from bg-positive/10 to OKLCH team color_
    - _Expected_Behavior: Smooth CSS transition instead of jarring flash_
    - _Preservation: Cached colors still applied synchronously — transition imperceptible on warm path_
    - _Requirements: 2.4, 3.4_

  - [x] 3.6 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - No Cascading Visual Shifts After Fix
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (at most 1 visual state change)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed — card transitions at most once from skeleton to final state)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.7 Verify preservation tests still pass
    - **Property 2: Preservation** - Cached Data Still Renders Instantly
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — cached cards still instant, non-sports cards unaffected)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `pnpm test --run`
  - Ensure bug condition exploration test (Property 1) passes
  - Ensure preservation property tests (Property 2) pass
  - Ensure no regressions in existing test suites
  - Verify `hasCachedPalette` unit tests pass
  - Verify `extractSlugButtonLabels` unit tests pass
  - Ask the user if questions arise
