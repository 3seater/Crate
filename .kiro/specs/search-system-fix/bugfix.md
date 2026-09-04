# Bugfix Requirements Document

## Introduction

The global search system (Ctrl+K / Cmd+K) has multiple bugs that prevent it from displaying correct results. The search pipeline spans from the frontend `GlobalSearch` dialog through tRPC to the Gamma `/public-search` API. Key issues include: market prices always showing 0% due to a type mismatch between the Zod schema preprocessing and the frontend price parser, search result markets missing post-processing that other market-fetching code paths apply (boundary normalization, token synthesis, image sanitization), and loose type casting of events and profiles data without proper field access.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user searches for markets THEN the system displays Yes/No prices as 0.0% (or incorrect fallback values) because `outcomePrices` is preprocessed by the Zod schema's `jsonStringOrArray` into a `string[]` array, but the frontend `getYesPrice()` function expects a raw JSON string and falls through to `lastTradePrice`/`bestBid` fallbacks which are not present in the schema

1.2 WHEN a user searches for markets THEN the system returns markets without boundary normalization, token synthesis, or image URL sanitization because `searchMarkets()` returns the raw Zod-validated result without calling `normalizeMarketAtBoundary()`, `synthesizeTokens()`, or `sanitizeImageUrls()` — unlike `getMarkets()`, `getMarketBySlug()`, and `getMarketById()` which all apply these transformations

1.3 WHEN a user searches and results contain markets with missing `slug` field THEN the system renders market cards that link to `/explore` instead of the correct `/market/{slug}` route, because `MarketSchema.slug` is `z.string().optional()` and the fallback in `gammaMarketToDiscoveryCard` uses `condition_id` or `id` as the slug value which are not valid route slugs

1.4 WHEN a user searches and clicks on an event result THEN the system may navigate to an incorrect or broken route because the `EventItem` interface in `global-search.tsx` is a loose local type with `slug?: string | null` that is populated via an unsafe `as EventItem[]` cast from the validated `EventSchema` data, and the event volume display uses `typeof event.volume === "number"` which may not match the coerced schema type

### Expected Behavior (Correct)

2.1 WHEN a user searches for markets THEN the system SHALL display accurate Yes/No prices by correctly reading the `outcomePrices` field as a `string[]` array (its post-Zod-validation type) and extracting the first element as the Yes price, rather than attempting to JSON.parse a string

2.2 WHEN a user searches for markets THEN the system SHALL return markets that have been post-processed with `normalizeMarketAtBoundary()`, `synthesizeTokens()`, and `sanitizeImageUrls()` — the same transformations applied by all other market-fetching code paths — so that boundary prices, token data, and image URLs are consistent

2.3 WHEN a user searches and results contain markets THEN the system SHALL render market cards that link to valid `/market/{slug}` routes by using the `slug` or `market_slug` field from the market data, and SHALL fall back to a reasonable behavior (e.g. not rendering the card or linking to the event) when no valid slug is available

2.4 WHEN a user searches and clicks on an event result THEN the system SHALL navigate to the correct `/event/{slug}` route using the validated `slug` field from `EventSchema`, and SHALL display accurate volume data using the schema-coerced numeric `volume` field

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user types fewer than 2 characters in the search box THEN the system SHALL CONTINUE TO not trigger any API call and display "Type to search..."

3.2 WHEN a user applies volume filters (≥10k, ≥50k, ≥100k, ≥250k) THEN the system SHALL CONTINUE TO filter displayed markets by their volume threshold correctly

3.3 WHEN a user applies expiring filters (1h, 1d, 1w, 1m) THEN the system SHALL CONTINUE TO filter displayed markets by their end date relative to the current time

3.4 WHEN a user switches between search tabs (All, Active, Events, Ended, Profiles) THEN the system SHALL CONTINUE TO show the correct subset of results with accurate counts

3.5 WHEN a user opens the search dialog via Ctrl+K / Cmd+K keyboard shortcut THEN the system SHALL CONTINUE TO open the dialog and focus the search input

3.6 WHEN a user clicks on a profile result THEN the system SHALL CONTINUE TO open the profile modal with the correct address

3.7 WHEN markets are fetched via non-search code paths (getMarkets, getMarketBySlug, getMarketById, getEvents) THEN the system SHALL CONTINUE TO apply normalizeMarketAtBoundary, synthesizeTokens, and sanitizeImageUrls as before
