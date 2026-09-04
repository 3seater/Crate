# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — Fuzzy Matching Produces Wrong/Duplicate Abbreviations
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the fuzzy matching bugs
  - **Scoped PBT Approach**: Scope the property to concrete failing cases:
    - Shared token false positive: Call `collectTeamLookupKeys({name: "JD Gaming", abbreviation: "JDG"}, ["jd gaming", "bilibili gaming"])` — assert "bilibili gaming" is NOT in the returned keys. On unfixed code, `tokenOverlap` matches on "gaming" (≥4 chars) and returns both names.
    - Shared token "United": Call `collectTeamLookupKeys({name: "Manchester United", abbreviation: "MUN"}, ["manchester united", "newcastle united"])` — assert "newcastle united" is NOT in the returned keys. On unfixed code, `tokenOverlap` matches on "united".
    - Substring false positive: Call `requestMatchesOfficialRow("real madrid", asciiFold("real madrid"), "real")` — assert returns `false`. On unfixed code, `officialLower.includes(r)` matches "real" inside "real madrid" with no length guard.
    - Short name substring: Call `requestMatchesOfficialRow("arsenal", asciiFold("arsenal"), "arse")` — assert returns `false`. On unfixed code, bare `officialLower.includes(r)` matches.
    - End-to-end duplicate: Call `mergeGammaTeamRowIntoCaches` with two Gamma rows (JDG and BLG) and requested names ["jd gaming", "bilibili gaming"] — assert `buttonLabels["jd gaming"] !== buttonLabels["bilibili gaming"]`. On unfixed code, both get the same abbreviation.
  - Test file: `tests/unit/sports-button-label-bugs.test.ts`
  - Import `collectTeamLookupKeys`, `mergeGammaTeamRowIntoCaches`, `asciiFold` from `merge-gamma-team-row.ts`
  - Run test on UNFIXED code — expect FAILURE (this confirms the bugs exist)
  - Document counterexamples found (e.g., "`collectTeamLookupKeys` returns both 'jd gaming' and 'bilibili gaming' as keys for the JDG row")
  - _Requirements: 1.1, 1.2_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Existing Matching and Label Resolution Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code**:
    - Exact match: `collectTeamLookupKeys({name: "Clippers", abbreviation: "LAC"}, ["clippers"])` returns keys including "clippers"
    - ASCII-fold match: `collectTeamLookupKeys({name: "Jiri Prochazka", abbreviation: "JIP"}, ["jiří procházka"])` returns keys including the folded form
    - Alias match: `collectTeamLookupKeys({name: "LA Clippers", abbreviation: "LAC", alias: "Clippers"}, ["clippers"])` returns keys including "clippers"
    - Abbreviation as key: `collectTeamLookupKeys({name: "Brooklyn Nets", abbreviation: "BKN"}, [])` returns keys including "bkn"
    - `resolveButtonLabel("Over 218.5", {})` returns "O 218.5"
    - `resolveButtonLabel("Under 145.5", {})` returns "U 145.5"
    - `resolveButtonLabel("Nets +4.5", {"nets": "BKN"})` returns "BKN +4.5"
    - `resolveButtonLabel("Yes", {})` returns "Yes"
    - `resolveButtonLabel("No", {})` returns "No"
    - `expandTeamNamesForGammaQuery(["FC Barcelona"])` includes "Barcelona" (FC strip)
    - `expandTeamNamesForGammaQuery(["1. FC Union Berlin"])` includes "FC Union Berlin" (ordinal strip)
  - Write property-based tests capturing observed behavior:
    - For all exact team name matches, `collectTeamLookupKeys` includes the requested name in returned keys
    - For all ASCII-folded matches, `collectTeamLookupKeys` includes the folded requested name
    - For all alias matches, `collectTeamLookupKeys` includes the alias as a key
    - For all totals labels matching "Over/Under X.Y", `resolveButtonLabel` returns "O X.Y" / "U X.Y"
    - For all spread labels matching "Team +/-X.Y" with a known abbreviation, `resolveButtonLabel` returns "ABBR +/-X.Y"
    - For all non-sports labels ("Yes", "No"), `resolveButtonLabel` passes through unchanged
    - For all FC-prefixed/suffixed names, `expandTeamNamesForGammaQuery` includes the stripped variant
  - Test file: `tests/unit/sports-button-label-preservation.test.ts`
  - Import from `merge-gamma-team-row.ts` and `polymarket-button-labels.ts`
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix fuzzy matching and add server-side team prefetch

  - [x] 3.1 Tighten matching in merge-gamma-team-row.ts
    - Remove `tokenOverlap()` calls from `requestMatchesOfficialRow()` — the remaining exact-match, ASCII-fold, and alias checks are sufficient
    - Remove the bare `officialLower.includes(r)` substring check (no length guard)
    - Remove `r.includes(officialLower) && officialLower.length >= 6` substring check
    - Remove `officialFolded.includes(asciiFold(r)) && r.length >= 4` folded substring check
    - Remove `asciiFold(r).includes(officialFolded) && officialFolded.length >= 6` folded substring check
    - Keep exact match: `r === officialLower`
    - Keep ASCII-fold exact match: `asciiFold(r) === officialFolded`
    - Keep alias matching in `collectTeamLookupKeys` (via `team.alias`)
    - Keep abbreviation as lookup key in `collectTeamLookupKeys` (via `team.abbreviation`)
    - Optionally remove or mark `tokenOverlap()` as unused (dead code after removal from `requestMatchesOfficialRow`)
    - _Bug_Condition: isBugCondition(input) where two requested names share a common token ≥4 chars or one is a substring of the other_
    - _Expected_Behavior: Each requested name maps only to its own Gamma row via exact, ASCII-fold, or alias match_
    - _Preservation: Exact matches, ASCII-fold matches, alias matches, abbreviation keys all unchanged_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3_

  - [x] 3.2 Add server-side team data prefetch in page.tsx
    - In `MarketContent`, after fetching the market via `getCachedMarketBySlug(slug)`:
      1. Extract team names from `market.tokens[].outcome` — strip spread suffixes, skip totals (reuse the same regex logic from `MarketTradingProviderInner`)
      2. Extract league from `market.events[0].slug` via `extractSportsLeagueFromEventSlug()`
      3. Expand names via `expandTeamNamesForGammaQuery()`
      4. Call `queryClient.prefetchQuery()` with `trpc.events.teams.queryOptions({ name: expandedNames, ...(league ? { league: [league] } : {}) })`
      5. Fire as a non-blocking background promise (like the OI prefetch) and race with a short timeout (~200ms)
    - Import `expandTeamNamesForGammaQuery` from `merge-gamma-team-row.ts`
    - Import `extractSportsLeagueFromEventSlug` from `event-card-sports-utils.ts`
    - Use same `staleTime`/`gcTime` as `useTeamImages` (7 days)
    - _Bug_Condition: isBugCondition(input) where input.isInitialRender AND teamNames.length > 0 AND buttonLabelsFromCache IS EMPTY_
    - _Expected_Behavior: React Query cache seeded with team data on first render, no flash of full names_
    - _Preservation: Explore page prefetch unchanged, non-sports markets unaffected_
    - _Requirements: 1.3, 1.4, 2.3, 2.4_

  - [x] 3.3 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — Fuzzy Matching Produces Wrong/Duplicate Abbreviations
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [x] 3.4 Verify preservation tests still pass
    - **Property 2: Preservation** — Existing Matching and Label Resolution Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `pnpm test:unit`
  - Ensure all tests pass, ask the user if questions arise.
