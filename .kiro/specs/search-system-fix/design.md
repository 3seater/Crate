# Search System Fix — Bugfix Design

## Overview

The global search system (Ctrl+K / Cmd+K) has four interrelated bugs that cause incorrect market prices, missing post-processing, broken routing, and loose event typing. The root cause is a type mismatch between the Zod schema's `jsonStringOrArray` preprocessor (which outputs `string[]`) and the frontend `getYesPrice()` function (which expects a raw JSON string), combined with the `searchMarkets()` function skipping the post-processing pipeline that all other market-fetching code paths apply. The fix targets three files across the server and frontend, applying minimal changes to align the search pipeline with existing conventions.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — when markets are fetched via the search pipeline (`searchMarkets` → tRPC `search` → `GlobalSearch` dialog), causing type mismatches and missing transformations
- **Property (P)**: The desired behavior — search results display accurate prices, valid route slugs, and fully post-processed market data identical to other code paths
- **Preservation**: Existing non-search market fetching, volume/expiring filters, tab switching, keyboard shortcut, and profile click behavior that must remain unchanged
- **`getYesPrice()`**: Function in `apps/web/src/lib/markets/gamma-to-ui.ts` that extracts the Yes price from a market's `outcomePrices` field
- **`gammaMarketToDiscoveryCard()`**: Function in `apps/web/src/lib/markets/gamma-to-ui.ts` that maps a Gamma Market to a `DiscoveryMarketCard` for UI rendering
- **`searchMarkets()`**: Function in `apps/server/src/lib/polymarket/gamma.ts` that calls the Gamma `/public-search` API and returns validated search results
- **`normalizeMarketAtBoundary()`**: Server-side function that normalizes market prices at 0/1 boundaries
- **`synthesizeTokens()`**: Server-side function that generates token data from `clobTokenIds` and `outcomePrices` when `tokens` array is missing
- **`sanitizeImageUrls()`**: Server-side function that cleans up image URLs in market/event data
- **`jsonStringOrArray`**: Zod preprocessor in the schema that converts a raw JSON string like `"[\"0.55\",\"0.45\"]"` into a `string[]` array `["0.55","0.45"]`

## Bug Details

### Bug Condition

The bug manifests when a user performs a search via the GlobalSearch dialog. The search pipeline returns markets that (a) have `outcomePrices` as `string[]` after Zod preprocessing but the frontend expects a raw JSON string, (b) lack post-processing transformations applied by all other market-fetching paths, (c) may have missing `slug` fields causing broken routing, and (d) have events cast to a loose local `EventItem` interface that doesn't align with `EventSchema` output types.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { source: "search" | "other", market: Market }
  OUTPUT: boolean

  RETURN input.source == "search"
         AND (
           typeof input.market.outcomePrices != "string"
           OR input.market.tokens == undefined
           OR input.market.slug == undefined
         )
END FUNCTION
```

### Examples

- **Price display bug**: User searches "election". Market has `outcomePrices: ["0.65", "0.35"]` (post-Zod `string[]`). `getYesPrice()` checks `typeof raw !== "string"` → true (it's an array), falls to `lastTradePrice` fallback → undefined, falls to `bestBid` fallback → undefined, returns `0`. UI shows "Yes: 0.0%, No: 100.0%". Expected: "Yes: 65.0%, No: 35.0%".

- **Missing post-processing**: User searches "bitcoin". Market at boundary price (1.00) is returned without `normalizeMarketAtBoundary()` call, so `closed` flag isn't set. Market lacks synthesized `tokens` array because `synthesizeTokens()` wasn't called. Image URL contains unescaped characters because `sanitizeImageUrls()` wasn't called. Other code paths (`getMarkets`, `getMarketBySlug`) would have applied all three.

- **Broken slug routing**: User searches and gets a market with `slug: undefined`, `condition_id: "0xabc123"`. `gammaMarketToDiscoveryCard()` falls back to `String(market.condition_id)` = `"0xabc123"`. Link renders as `/market/0xabc123` which is not a valid Gamma slug route → 404. Expected: card should use `market_slug` field or not render a link.

- **Event routing**: User clicks an event result. `EventItem` interface has `slug?: string | null` but `EventSchema` validates `slug` as `z.string()` (required). The `as EventItem[]` cast loses type safety. Volume check `typeof event.volume === "number"` works correctly since `z.coerce.number()` produces a number, but the loose typing obscures this guarantee.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Mouse clicks, volume filters (≥10k, ≥50k, ≥100k, ≥250k), and expiring filters (1h, 1d, 1w, 1m) in the search dialog must continue to work exactly as before
- Search tab switching (All, Active, Events, Ended, Profiles) must continue to show correct subsets with accurate counts
- Ctrl+K / Cmd+K keyboard shortcut must continue to open the search dialog and focus the input
- Profile result clicks must continue to open the profile modal with the correct address
- Markets fetched via `getMarkets()`, `getMarketBySlug()`, `getMarketById()`, and `getEvents()` must continue to apply `normalizeMarketAtBoundary()`, `synthesizeTokens()`, and `sanitizeImageUrls()` as before
- The minimum 2-character search threshold must continue to prevent API calls for short queries

**Scope:**
All inputs that do NOT involve the search pipeline's market price parsing, post-processing, slug resolution, or event type casting should be completely unaffected by this fix. This includes:
- Non-search market fetching code paths (discovery, event pages, market pages)
- Profile search results (separate schema, no price/slug issues)
- Search dialog UI chrome (layout, styling, animations)
- tRPC router structure and error handling

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Type mismatch in `getYesPrice()`**: The function checks `typeof raw !== "string"` to decide whether to JSON.parse. After Zod's `jsonStringOrArray` preprocessor, `outcomePrices` is already a `string[]` array, not a raw JSON string. So the check fails (array is not a string), and the function falls through to `lastTradePrice`/`bestBid` fallbacks which are not present in `SearchResultSchema` markets, yielding `0`.
   - File: `apps/web/src/lib/markets/gamma-to-ui.ts`, function `getYesPrice()`, line checking `typeof raw !== "string"`

2. **Missing post-processing in `searchMarkets()`**: The function returns `fetchJson("/public-search", SearchResultSchema, ...)` directly without applying `normalizeMarketAtBoundary()`, `synthesizeTokens()`, or `sanitizeImageUrls()` to the markets array. Every other market-fetching function (`getMarkets`, `getMarketBySlug`, `getMarketById`) applies all three transformations.
   - File: `apps/server/src/lib/polymarket/gamma.ts`, function `searchMarkets()`, line 531

3. **Slug fallback uses non-slug identifiers**: In `gammaMarketToDiscoveryCard()`, the slug fallback chain is `market.slug ?? ... ?? String(market.id ?? market.condition_id ?? market.conditionId ?? "")`. When `slug` is undefined, it falls back to `condition_id` or numeric `id`, neither of which are valid Gamma route slugs. The `market_slug` field from the schema is not checked.
   - File: `apps/web/src/lib/markets/gamma-to-ui.ts`, function `gammaMarketToDiscoveryCard()`, slug assignment

4. **Loose `EventItem` interface bypasses schema types**: The `EventItem` interface in `global-search.tsx` is a manually defined type with `slug?: string | null`, `volume?: string | number`, etc. The `as EventItem[]` cast from `EventSchema`-validated data loses the guarantees that `slug` is a required `string` and `volume` is a `number` (via `z.coerce.number()`). This causes unnecessary null checks and potential type mismatches.
   - File: `apps/web/src/components/layout/global-search.tsx`, interface `EventItem` at line 69, cast at line 160

## Correctness Properties

Property 1: Bug Condition — Search Market Prices Are Accurate

_For any_ market returned by the search pipeline where `outcomePrices` is a `string[]` array (post-Zod preprocessing), the fixed `getYesPrice()` function SHALL correctly extract the first element as the Yes price (a number between 0 and 1), rather than falling through to fallback values or returning 0.

**Validates: Requirements 2.1**

Property 2: Bug Condition — Search Markets Are Post-Processed

_For any_ market returned by the search pipeline, the fixed `searchMarkets()` function SHALL apply `normalizeMarketAtBoundary()`, `synthesizeTokens()`, and `sanitizeImageUrls()` to each market, producing output consistent with `getMarkets()` and other market-fetching code paths.

**Validates: Requirements 2.2**

Property 3: Bug Condition — Market Cards Have Valid Slugs

_For any_ market mapped through `gammaMarketToDiscoveryCard()`, the resulting `slug` field SHALL be a valid Gamma route slug (from `market.slug` or `market.market_slug`), and SHALL NOT fall back to `condition_id` or numeric `id`. When no valid slug is available, the slug SHALL be an empty string so the UI can handle it gracefully.

**Validates: Requirements 2.3**

Property 4: Bug Condition — Event Results Use Schema Types

_For any_ event result displayed in the search dialog, the component SHALL use the validated `EventSchema` output type (where `slug` is a required `string` and `volume` is a `number`), eliminating the loose `EventItem` interface and unsafe `as EventItem[]` cast.

**Validates: Requirements 2.4**

Property 5: Preservation — Non-Search Code Paths Unchanged

_For any_ market fetched via `getMarkets()`, `getMarketBySlug()`, or `getMarketById()`, the fixed code SHALL produce exactly the same result as the original code, preserving all existing post-processing transformations and return types.

**Validates: Requirements 3.7**

Property 6: Preservation — Search Filters and UI Behavior Unchanged

_For any_ search interaction that does not involve market price parsing, post-processing, slug resolution, or event type casting (volume filters, expiring filters, tab switching, keyboard shortcut, profile clicks, minimum character threshold), the fixed code SHALL produce exactly the same behavior as the original code.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**


## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/web/src/lib/markets/gamma-to-ui.ts`

**Function**: `getYesPrice()`

**Specific Changes**:
1. **Handle `string[]` array type for `outcomePrices`**: Add a check for `Array.isArray(raw)` before the `typeof raw !== "string"` check. When `raw` is an array, extract the first element and parse it as a float. This handles the post-Zod-preprocessed `string[]` format.
   - Before: `if (typeof raw !== "string") { /* fallback chain */ }`
   - After: `if (Array.isArray(raw)) { return parseFloat(raw[0]) || 0; }` then existing string handling

**Function**: `gammaMarketToDiscoveryCard()`

**Specific Changes**:
2. **Fix slug fallback chain**: Replace the fallback to `condition_id`/`id` with `market_slug` field, and use empty string as final fallback instead of stringified non-slug identifiers.
   - Before: `market.slug ?? ... ?? String(market.id ?? market.condition_id ?? ...)`
   - After: `market.slug ?? market.market_slug ?? ""`

---

**File**: `apps/server/src/lib/polymarket/gamma.ts`

**Function**: `searchMarkets()`

**Specific Changes**:
3. **Apply post-processing to search result markets**: After fetching and validating the search result, iterate over `result.markets` and apply `normalizeMarketAtBoundary()`, `synthesizeTokens()`, and `sanitizeImageUrls()` to each market — matching the pattern used in `getMarkets()`.
   - Before: `return await fetchJson("/public-search", SearchResultSchema, { q: query, search_profiles: "true" });`
   - After: Fetch result, then `result.markets = result.markets.map(m => { normalizeMarketAtBoundary(m); return synthesizeTokens(sanitizeImageUrls(m)); });` then return result.

---

**File**: `apps/web/src/components/layout/global-search.tsx`

**Specific Changes**:
4. **Replace `EventItem` interface with `ValidatedEvent` import**: Remove the local `EventItem` interface and import `ValidatedEvent` from the server schema types (via tRPC types). Update `useFilteredSearch` to use `ValidatedEvent[]` instead of `EventItem[]`, removing the unsafe `as EventItem[]` cast.
5. **Update event rendering to use schema-typed fields**: Since `ValidatedEvent` has `slug: string` (required) and `volume: z.coerce.number()` (number), remove the null-coalescing guards on `slug` and the `typeof volume === "number"` check. Use `event.slug` directly and `event.volume` as a number.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that call `getYesPrice()` with markets whose `outcomePrices` is a `string[]` array (the post-Zod format), and verify the return value. Also test `gammaMarketToDiscoveryCard()` with markets missing `slug` but having `condition_id`. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Price from string[] array**: Call `getYesPrice({ outcomePrices: ["0.65", "0.35"], ... })` — expect `0.65`, will return `0` on unfixed code
2. **Price from empty array**: Call `getYesPrice({ outcomePrices: [], ... })` — expect `0`, may behave differently on unfixed code
3. **Slug fallback to condition_id**: Call `gammaMarketToDiscoveryCard({ condition_id: "0xabc", slug: undefined, ... })` — expect empty string slug, will return `"0xabc"` on unfixed code
4. **Slug with market_slug field**: Call `gammaMarketToDiscoveryCard({ market_slug: "will-x-happen", slug: undefined, ... })` — expect `"will-x-happen"`, will return condition_id fallback on unfixed code

**Expected Counterexamples**:
- `getYesPrice()` returns `0` for all markets with `string[]` outcomePrices because the array type falls through to missing fallback fields
- `gammaMarketToDiscoveryCard()` produces non-slug identifiers (condition IDs, numeric IDs) as the slug value

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed functions produce the expected behavior.

**Pseudocode:**
```
FOR ALL market WHERE typeof market.outcomePrices == "string[]" DO
  result := getYesPrice_fixed(market)
  ASSERT result == parseFloat(market.outcomePrices[0]) OR (market.outcomePrices.length == 0 AND result == 0)
END FOR

FOR ALL searchResult WHERE searchResult.source == "search" DO
  markets := searchMarkets_fixed(searchResult.query).markets
  FOR EACH market IN markets DO
    ASSERT market.tokens != undefined  // synthesizeTokens applied
    ASSERT market.image does not contain unsanitized URLs  // sanitizeImageUrls applied
  END FOR
END FOR

FOR ALL market WHERE market.slug == undefined AND market.market_slug == undefined DO
  card := gammaMarketToDiscoveryCard_fixed(market)
  ASSERT card.slug == ""
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed functions produce the same result as the original functions.

**Pseudocode:**
```
FOR ALL market WHERE typeof market.outcomePrices == "string" DO
  ASSERT getYesPrice_original(market) == getYesPrice_fixed(market)
END FOR

FOR ALL market WHERE market.slug != undefined DO
  ASSERT gammaMarketToDiscoveryCard_original(market).slug == gammaMarketToDiscoveryCard_fixed(market).slug
END FOR

FOR ALL params WHERE fetchPath != "/public-search" DO
  ASSERT getMarkets_original(params) == getMarkets_fixed(params)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (random market shapes, price arrays, slug combinations)
- It catches edge cases that manual unit tests might miss (empty arrays, single-element arrays, numeric strings)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for markets with raw JSON string `outcomePrices` and valid `slug` fields, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Price parsing preservation**: Observe that `getYesPrice()` correctly parses raw JSON string `outcomePrices` (e.g. `"[\"0.55\",\"0.45\"]"`) on unfixed code, then verify this continues after fix
2. **Slug resolution preservation**: Observe that `gammaMarketToDiscoveryCard()` correctly uses `market.slug` when present on unfixed code, then verify this continues after fix
3. **Non-search market fetching preservation**: Observe that `getMarkets()`, `getMarketBySlug()`, `getMarketById()` apply all three transformations on unfixed code, then verify this continues after fix
4. **Filter behavior preservation**: Observe that volume and expiring filters in `useFilteredSearch` work correctly on unfixed code, then verify this continues after fix

### Unit Tests

- Test `getYesPrice()` with `string[]` array input (bug condition) and raw JSON string input (preservation)
- Test `getYesPrice()` edge cases: empty array, single element, non-numeric strings, undefined
- Test `gammaMarketToDiscoveryCard()` slug resolution with `slug`, `market_slug`, both missing, both present
- Test `searchMarkets()` applies all three post-processing functions to returned markets
- Test event rendering uses `ValidatedEvent` fields correctly (slug required, volume as number)

### Property-Based Tests

- Generate random `string[]` arrays of numeric strings and verify `getYesPrice()` returns `parseFloat(arr[0])` or `0` for empty arrays
- Generate random market objects with various combinations of `slug`, `market_slug`, `condition_id`, `id` and verify `gammaMarketToDiscoveryCard()` never produces a condition_id or numeric id as the slug
- Generate random markets with raw JSON string `outcomePrices` and verify `getYesPrice()` produces the same result as the original implementation (preservation)

### Integration Tests

- Test full search flow: tRPC `search` procedure → `searchMarkets()` → post-processing → frontend rendering with correct prices
- Test that clicking a search result market navigates to a valid `/market/{slug}` route
- Test that clicking a search result event navigates to a valid `/event/{slug}` route
- Test that search results display the same prices as the same markets fetched via `getMarkets()`
