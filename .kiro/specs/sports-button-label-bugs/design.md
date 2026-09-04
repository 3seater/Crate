# Sports Button Label Bugs — Bugfix Design

## Overview

Sports and esports market outcome buttons display incorrect or duplicate team abbreviations due to overly permissive fuzzy matching in `merge-gamma-team-row.ts`, and full team names flash briefly before abbreviations load because the Gamma `/teams` query runs client-side only. The fix has two parts:

1. **Tighten fuzzy matching** in `requestMatchesOfficialRow()` and `tokenOverlap()` so that teams sharing a common token (e.g. "Gaming") or having loose substring overlap no longer incorrectly map to the same Gamma API row.
2. **Server-side prefetch** of team data in `MarketContent` (the server component in `page.tsx`) so that `useTeamImages()` finds warm cache data on first render, eliminating the flash of full names.

## Glossary

- **Bug_Condition (C)**: The set of inputs where fuzzy matching produces wrong/duplicate abbreviations, OR where `buttonLabels` is empty during initial render causing a flash of full team names
- **Property (P)**: Each requested team name maps to exactly one correct Gamma API row (its own), and abbreviations are available on first paint without a loading gap
- **Preservation**: Existing exact-match, ASCII-folding, alias, FC-variant, totals, spreads, and non-sports label resolution must remain unchanged
- **`tokenOverlap()`**: Function in `merge-gamma-team-row.ts` that checks if two names share a "strong" token (≥4 chars) — currently too loose
- **`requestMatchesOfficialRow()`**: Function in `merge-gamma-team-row.ts` that determines if a requested name matches a Gamma API row — currently has loose substring checks
- **`collectTeamLookupKeys()`**: Function that builds the set of cache keys a Gamma row should populate — calls `requestMatchesOfficialRow()` for each requested name
- **`mergeGammaTeamRowIntoCaches()`**: Writes one Gamma team row into `images`, `abbrevs`, and `buttonLabels` maps using keys from `collectTeamLookupKeys()`
- **`resolveButtonLabel()`**: Function in `polymarket-button-labels.ts` that maps a raw outcome label to an abbreviated button label using the `buttonLabels` map
- **`useTeamImages()`**: Client hook that fires `GET /teams?name[]=...` and merges results into caches — currently the only source of `buttonLabels`
- **`MarketContent`**: Server component in `page.tsx` that prefetches market data and seeds React Query cache via `HydrationBoundary`

## Bug Details

### Bug Condition

The bugs manifest in two distinct scenarios:

**Scenario A (Wrong/Duplicate Abbreviations):** When two or more team names in a market share a common token of ≥4 characters (e.g. "JD Gaming" and "Bilibili Gaming" both contain "Gaming"), `tokenOverlap()` returns `true` for both names against the same Gamma API row. `collectTeamLookupKeys()` then adds both requested names as keys for that single row, causing both buttons to display the same abbreviation. Similarly, `requestMatchesOfficialRow()` has loose substring checks (`officialLower.includes(r)` with no length guard, `r.includes(officialLower)` with only a ≥6 char guard) that can match unrelated teams.

**Scenario B (Flash of Full Names):** When a sports market page loads, `useTeamImages()` returns empty `buttonLabels` until the client-side Gamma `/teams` query resolves. `resolveButtonLabel()` falls through to the raw label (full team name). Once the query resolves, labels update — producing a visible flash from "JD Gaming" → "JDG".

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { teamNames: string[], gammaRows: GammaTeamRow[], isInitialRender: boolean }
  OUTPUT: boolean

  // Scenario A: Fuzzy matching produces wrong/duplicate mappings
  LET hasDuplicateMapping = EXISTS row IN gammaRows SUCH THAT
    LET matchedNames = FILTER teamNames WHERE
      requestMatchesOfficialRow(row.name, asciiFold(row.name), name) == true
    matchedNames.length > 1
    AND NOT ALL names IN matchedNames ARE genuine aliases/variants of row.name

  // Scenario B: Flash of full names on initial render
  LET hasFlash = input.isInitialRender
    AND teamNames.length > 0
    AND buttonLabelsFromCache IS EMPTY

  RETURN hasDuplicateMapping OR hasFlash
END FUNCTION
```

### Examples

- **Duplicate abbreviation**: Market has outcomes "JD Gaming" and "Bilibili Gaming". Gamma returns rows `{name: "JD Gaming", abbreviation: "JDG"}` and `{name: "Bilibili Gaming", abbreviation: "BLG"}`. `tokenOverlap("jd gaming", "bilibili gaming")` returns `true` because both contain "gaming" (≥4 chars). Both requested names get mapped to whichever row is processed first → both buttons show "JDG" or both show "BLG".
- **Wrong abbreviation**: Market has outcome "Charlotte Hornets". Gamma returns a row `{name: "Alashkert", abbreviation: "ALAST"}`. `requestMatchesOfficialRow("alashkert", "alashkert", "charlotte hornets")` — the substring check `officialLower.includes(r)` doesn't match, but `tokenOverlap` could match on shared substrings. The loose matching produces "ALAST" instead of "CHA".
- **Flash of full names**: User navigates to `/market/nba-lakers-vs-celtics`. Server renders the page with `HydrationBoundary` containing market data but no team data. Client mounts, `useTeamImages(["Lakers", "Celtics"])` fires a query. For ~200-500ms, buttons show "LAKERS" / "CELTICS" (raw labels, CSS uppercased). Query resolves → buttons update to "LAL" / "BOS". User sees a visible flash.
- **No bug (exact match)**: Market has outcomes "Clippers" and "Pelicans". Gamma returns `{name: "Clippers", abbreviation: "LAC"}` and `{name: "Pelicans", abbreviation: "NOP"}`. Exact match works correctly → "LAC" and "NOP" on buttons. No flash if cache is warm.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Exact name matches (e.g. "Clippers" → Gamma row "Clippers") must continue to resolve correctly
- ASCII-folded matches (e.g. "Jiří Procházka" → Gamma "Jiri Prochazka") must continue to resolve correctly
- Alias matches (e.g. Gamma row has `alias` field matching the requested name) must continue to resolve correctly
- FC prefix/suffix variants and leading ordinal prefixes must continue to expand correctly in `expandTeamNamesForGammaQuery()`
- Totals resolution ("Over 218.5" → "O 218.5", "Under 218.5" → "U 218.5") must remain unchanged
- Spread resolution ("Nets +4.5" → "BKN +4.5") must remain unchanged
- Non-sports pass-through ("Yes" / "No") must remain unchanged
- The explore page's existing team prefetch (`prefetchSportsTeamImagesForExplore`) must not be broken
- Mouse clicks, orderbook, order form, and all non-label trading UI must remain unchanged

**Scope:**
All inputs that do NOT involve sports team name matching or sports market initial page load should be completely unaffected by this fix. This includes:
- Non-sports markets (Yes/No binary markets)
- Total/spread label resolution (these don't use team name matching for the O/U prefix)
- All trading interactions (order placement, position management, chart interactions)
- The explore page team image prefetch (uses the same `expandTeamNamesForGammaQuery` and `mergeGammaTeamRowIntoCaches` — tightening matching affects it too, but correctly)

## Hypothesized Root Cause

Based on the bug description and code analysis, the most likely issues are:

1. **`tokenOverlap()` matches on generic sport tokens**: The function splits both names into tokens ≥4 chars and checks for equality or substring inclusion. Tokens like "Gaming", "United", "City", "Racing", "Sporting" appear in many unrelated team names. When two requested names share such a token, both get mapped to the same Gamma row. The fix: `tokenOverlap()` should be removed or restricted to only match tokens that are NOT common sport/esport words, or replaced with a stricter matching strategy.

2. **`requestMatchesOfficialRow()` has loose substring checks**: The check `officialLower.includes(r)` has no minimum length guard — a 3-letter requested name could match inside a longer official name. The check `r.includes(officialLower) && officialLower.length >= 6` is better but still too loose for names that happen to contain another team's name. The ASCII-folded variants have similar issues. The fix: require exact match, alias match, or abbreviation match only. Remove or heavily restrict substring and token-overlap fallbacks.

3. **No server-side team data prefetch on market pages**: The explore page already has `prefetchSportsTeamImagesForExplore()` that prefetches team data server-side. The market page (`page.tsx`) prefetches market data and open interest but not team data. Adding a similar prefetch in `MarketContent` would seed the React Query cache so `useTeamImages()` finds warm data on first render, eliminating the flash.

4. **Processing order in `mergeGammaTeamRowIntoCaches`**: When multiple Gamma rows match the same requested name (due to loose matching), the last row processed wins. This means the abbreviation depends on the order Gamma returns rows — non-deterministic behavior.

## Correctness Properties

Property 1: Bug Condition — Distinct teams resolve to distinct abbreviations

_For any_ set of requested team names where each name corresponds to a different Gamma API row with a different abbreviation, the fixed `collectTeamLookupKeys()` SHALL NOT map two different requested names to the same Gamma row, ensuring each button displays its own correct abbreviation.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Team abbreviations available on first server-rendered paint

_For any_ sports market page load where the market has team-based outcomes, the server-side prefetch SHALL seed the React Query cache with team data so that `useTeamImages()` returns non-empty `buttonLabels` on the first client render, preventing a flash of full team names.

**Validates: Requirements 2.3, 2.4**

Property 3: Preservation — Existing matching strategies continue to work

_For any_ input where the team name exactly matches a Gamma row name, matches via ASCII folding, or matches via the alias field, the fixed matching logic SHALL produce the same abbreviation mapping as the original code, preserving all currently-correct team resolutions.

**Validates: Requirements 3.1, 3.2, 3.3, 3.7**

Property 4: Preservation — Non-team label resolution unchanged

_For any_ input that is a totals label ("Over/Under X"), spread label ("Team +/-X"), or non-sports label ("Yes"/"No"), the fixed code SHALL produce exactly the same button label as the original code.

**Validates: Requirements 3.4, 3.5, 3.6**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/web/src/features/trading/hooks/sports/merge-gamma-team-row.ts`

**Functions**: `requestMatchesOfficialRow()`, `tokenOverlap()`, `collectTeamLookupKeys()`

**Specific Changes**:

1. **Remove or heavily restrict `tokenOverlap()`**: The current implementation matches on any shared token ≥4 chars, which produces false positives for common sport words ("Gaming", "United", "City", "Racing", "Sporting", "Athletic", "Real", "Inter", "Club", "Team", "Sport", "Football"). The safest fix is to remove `tokenOverlap()` entirely from `requestMatchesOfficialRow()`. The remaining exact-match, ASCII-fold, and alias checks are sufficient for correct matching. If some edge cases need token overlap, restrict it to tokens ≥7 chars AND require that the matched token is NOT in a blocklist of common sport words.

2. **Tighten substring checks in `requestMatchesOfficialRow()`**: Remove the bare `officialLower.includes(r)` check (no length guard). Remove or tighten `r.includes(officialLower) && officialLower.length >= 6` — raise the threshold or remove entirely. Remove or tighten the ASCII-folded substring checks similarly. The goal: only exact match, ASCII-folded exact match, and alias match should produce a positive result. Substring matching is the root cause of cross-team contamination.

3. **Keep alias matching**: The `collectTeamLookupKeys()` function already adds `team.alias` as a key. This is correct and should be preserved. The alias field is Gamma's explicit mapping for alternative names.

4. **Keep abbreviation as a lookup key**: `collectTeamLookupKeys()` adds `team.abbreviation` (lowercased) as a key. This is correct — if a market uses "BKN" as an outcome label, it should resolve via the abbreviation key.

---

**File**: `apps/web/src/app/(trading)/market/[slug]/page.tsx`

**Function**: `MarketContent` (server component)

**Specific Changes**:

5. **Add server-side team data prefetch**: After fetching the market via `getCachedMarketBySlug(slug)`, extract team names from `market.tokens[].outcome` and the league from `market.events[0].slug`. Call `queryClient.prefetchQuery()` with `trpc.events.teams.queryOptions()` using the same `expandTeamNamesForGammaQuery()` expansion that `useTeamImages()` uses. Fire this as a non-blocking background promise (like the OI prefetch) and race it with a short timeout. This mirrors the pattern already used by `prefetchSportsTeamImagesForExplore()`.

6. **Extract team names server-side**: Reuse the same logic from `MarketTradingProviderInner` to extract team names from token outcomes — strip spread suffixes and skip totals. This can be a small utility function shared between the server prefetch and the client hook.

---

**File**: `apps/web/src/features/trading/hooks/sports/use-team-images.ts`

**No changes required** to the hook itself. Once the server prefetch seeds the cache, `useQuery()` will find warm data and return `buttonLabels` immediately. The `staleTime: 7 * 24 * 60 * 60 * 1000` ensures the prefetched data is considered fresh.

---

**File**: `apps/web/src/features/trading/components/market/market-trading-context.tsx`

**No changes required**. The `resolveButtonLabel()` call and `useTeamImages()` integration remain the same. The fix is upstream (matching logic) and downstream (server prefetch).

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bugs on unfixed code, then verify the fixes work correctly and preserve existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that call `collectTeamLookupKeys()` and `mergeGammaTeamRowIntoCaches()` with team names that share common tokens. Run these tests on the UNFIXED code to observe that both names incorrectly map to the same row.

**Test Cases**:
1. **Shared "Gaming" token**: Call `collectTeamLookupKeys({name: "JD Gaming", abbreviation: "JDG"}, ["jd gaming", "bilibili gaming"])` — verify "bilibili gaming" is NOT in the returned keys (will fail on unfixed code because `tokenOverlap` matches on "gaming")
2. **Shared "United" token**: Call `collectTeamLookupKeys({name: "Manchester United", abbreviation: "MUN"}, ["manchester united", "newcastle united"])` — verify "newcastle united" is NOT in the returned keys (will fail on unfixed code)
3. **Substring false positive**: Call `requestMatchesOfficialRow("real madrid", asciiFold("real madrid"), "real")` — verify returns `false` (will fail on unfixed code because `officialLower.includes(r)` matches)
4. **Short name substring**: Call `requestMatchesOfficialRow("arsenal", asciiFold("arsenal"), "arse")` — verify returns `false` (will fail on unfixed code)

**Expected Counterexamples**:
- `collectTeamLookupKeys` returns both "jd gaming" and "bilibili gaming" as keys for the JDG row
- `requestMatchesOfficialRow` returns `true` for unrelated teams that share a substring
- Possible causes: `tokenOverlap` matching on "gaming"/"united"/"city", bare `officialLower.includes(r)` with no length guard

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := collectTeamLookupKeys_fixed(gammaRow, requestedNames)
  ASSERT FOR EACH name IN requestedNames:
    name IN result IMPLIES name genuinely matches gammaRow
    (exact match, ASCII-fold match, or alias match)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT collectTeamLookupKeys_original(input) == collectTeamLookupKeys_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many team name / Gamma row combinations automatically
- It catches edge cases in ASCII folding, alias matching, and abbreviation lookup
- It provides strong guarantees that exact-match and alias-match behavior is unchanged

**Test Plan**: Observe behavior on UNFIXED code first for exact matches, ASCII-folded matches, and alias matches, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Exact match preservation**: Generate random team names, create Gamma rows with matching names, verify `collectTeamLookupKeys` includes the requested name in both original and fixed code
2. **ASCII-fold preservation**: Generate team names with accented characters, verify folded matching works identically in both versions
3. **Alias preservation**: Generate Gamma rows with alias fields, verify alias-based matching works identically
4. **resolveButtonLabel preservation**: Verify totals ("Over 218.5" → "O 218.5"), spreads ("Nets +4.5" → "BKN +4.5"), and non-sports ("Yes" → "Yes") produce identical results

### Unit Tests

- Test `collectTeamLookupKeys` with shared-token team names (Gaming, United, City, Racing)
- Test `requestMatchesOfficialRow` with known false-positive pairs
- Test `mergeGammaTeamRowIntoCaches` end-to-end: two Gamma rows with distinct abbreviations, two requested names sharing a token → verify distinct `buttonLabels`
- Test `resolveButtonLabel` with all label types (moneyline, spread, total, non-sports)
- Test `expandTeamNamesForGammaQuery` with FC variants, ordinal prefixes, accented names
- Test server-side team name extraction from market tokens

### Property-Based Tests

- Generate random pairs of team names sharing a common token and verify they resolve to distinct abbreviations when Gamma returns distinct rows
- Generate random team names and verify exact-match behavior is preserved between original and fixed `collectTeamLookupKeys`
- Generate random Gamma rows with aliases and verify alias matching is preserved
- Generate random outcome labels and verify `resolveButtonLabel` produces correct results for all label types

### Integration Tests

- Test full market page load with server-side team prefetch: verify `buttonLabels` are non-empty on first render
- Test market page load for non-sports market: verify no team prefetch is attempted and labels pass through unchanged
- Test explore page team prefetch continues to work with tightened matching logic
