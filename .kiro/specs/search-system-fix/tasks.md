# Tasks — Search System Fix

## 1. Fix `getYesPrice()` to handle `string[]` outcomePrices
- [x] 1.1 Add `Array.isArray(raw)` check in `getYesPrice()` before the `typeof raw !== "string"` check, extracting the first element as a float when `outcomePrices` is a `string[]` array
  - File: `apps/web/src/lib/markets/gamma-to-ui.ts`
  - Validates: Requirement 2.1, Property 1
- [x] 1.2 Write exploratory test: call `getYesPrice()` with `outcomePrices: ["0.65", "0.35"]` and verify it returns `0` on unfixed code (confirming root cause)
  - PBT: Property 1
- [x] 1.3 Write fix-checking property test: for any `string[]` of numeric strings, `getYesPrice()` returns `parseFloat(arr[0])` or `0` for empty arrays
  - PBT: Property 1
- [x] 1.4 Write preservation property test: for any market with raw JSON string `outcomePrices`, `getYesPrice()` returns the same result as before the fix
  - PBT: Property 5

## 2. Apply post-processing to `searchMarkets()` results
- [x] 2.1 Modify `searchMarkets()` in `gamma.ts` to apply `normalizeMarketAtBoundary()`, `synthesizeTokens()`, and `sanitizeImageUrls()` to each market in the result, matching the pattern in `getMarkets()`
  - File: `apps/server/src/lib/polymarket/gamma.ts`
  - Validates: Requirement 2.2, Property 2
- [x] 2.2 Write exploratory test: verify `searchMarkets()` returns markets without `tokens` array on unfixed code (confirming missing `synthesizeTokens()`)
  - PBT: Property 2
- [x] 2.3 Write fix-checking unit test: verify `searchMarkets()` result markets have synthesized tokens and sanitized image URLs after fix
  - PBT: Property 2
- [x] 2.4 Write preservation test: verify `getMarkets()` and `getMarketBySlug()` continue to apply all three transformations unchanged
  - PBT: Property 5

## 3. Fix slug fallback in `gammaMarketToDiscoveryCard()`
- [x] 3.1 Replace slug fallback chain to use `market.slug ?? market.market_slug ?? ""` instead of falling back to `condition_id` or numeric `id`
  - File: `apps/web/src/lib/markets/gamma-to-ui.ts`
  - Validates: Requirement 2.3, Property 3
- [x] 3.2 Write exploratory test: call `gammaMarketToDiscoveryCard()` with `slug: undefined, condition_id: "0xabc"` and verify it returns `"0xabc"` as slug on unfixed code
  - PBT: Property 3
- [x] 3.3 Write fix-checking property test: for any market, the resulting slug is never a condition_id or numeric id — it's either a valid slug string or empty string
  - PBT: Property 3
- [x] 3.4 Write preservation test: for any market with a valid `slug` field, `gammaMarketToDiscoveryCard()` returns the same slug as before
  - PBT: Property 3

## 4. Replace loose `EventItem` interface with `ValidatedEvent` type
- [x] 4.1 Remove the local `EventItem` interface from `global-search.tsx` and import `ValidatedEvent` from server schema types via tRPC types
  - File: `apps/web/src/components/layout/global-search.tsx`
  - Validates: Requirement 2.4, Property 4
- [x] 4.2 Update `useFilteredSearch` to type events as `ValidatedEvent[]` instead of casting with `as EventItem[]`
  - File: `apps/web/src/components/layout/global-search.tsx`
  - Validates: Requirement 2.4, Property 4
- [x] 4.3 Update event rendering in `SearchResults` to use `ValidatedEvent` fields directly (`slug` as required string, `volume` as number), removing unnecessary null guards
  - File: `apps/web/src/components/layout/global-search.tsx`
  - Validates: Requirement 2.4, Property 4
- [x] 4.4 Write unit test: verify event items render correct `/event/{slug}` links and formatted volume using schema-typed data
  - PBT: Property 4

## 5. Preservation validation
- [x] 5.1 Write preservation test: verify volume filters (≥10k, ≥50k, ≥100k, ≥250k) continue to filter markets correctly in `useFilteredSearch`
  - PBT: Property 6
- [x] 5.2 Write preservation test: verify expiring filters (1h, 1d, 1w, 1m) continue to filter markets by end date correctly in `useFilteredSearch`
  - PBT: Property 6
- [x] 5.3 Run `pnpm fix` and `pnpm check-types` to verify no regressions introduced
