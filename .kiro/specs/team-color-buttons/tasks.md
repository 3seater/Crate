# Implementation Plan: Team Color Buttons

## Overview

Extract the dominant color from each team's logo (already available via the `teamImages` map) and apply a dark muted background + vivid text palette to the sports moneyline buttons in `SportsButtons`. All logic lives in a new `use-team-colors.ts` hook file; `event-card.tsx` is wired to pass the new props down and apply inline styles. No new npm packages are required.

## Tasks

- [x] 1. Create `use-team-colors.ts` — color math helpers
  - [x] 1.1 Scaffold the file with `"use client"` directive, `TeamColorPalette` interface, and the four pure math helpers: `sampleDominantRgb`, `rgbToOklch`, `wcagContrastRatio`, and `formatOklch`
    - Create `apps/web/src/domains/trading/hooks/sports/use-team-colors.ts`
    - Export `TeamColorPalette` interface with `bg: string` and `text: string` fields
    - Implement `sampleDominantRgb(data: Uint8ClampedArray)` — 4-bit-per-channel frequency bucketing; skip pixels with alpha < 128 or near-white (all channels > 240) or near-black (all channels < 15); return RGB centroid of most-populated bucket or null
    - Implement `rgbToOklch(r, g, b)` — sRGB (0–255) → linear RGB → XYZ D65 → Oklab → OKLCH using the Björn Ottosson matrix; return `{ L, C, H }`
    - Implement `wcagContrastRatio(bg: string, text: string)` — parse `oklch(L C H)` strings, convert back to relative luminance via OKLCH → Oklab → XYZ → sRGB → linearise → Y; return `(L1 + 0.05) / (L2 + 0.05)`
    - Implement `formatOklch(L, C, H)` — clamp L to 0–1, C to 0–0.4, H to 0–360; return `oklch(${L.toFixed(4)} ${C.toFixed(4)} ${H.toFixed(2)})`
    - All four helpers are module-private (unexported)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1_

  - [ ]* 1.2 Write unit tests for color math helpers
    - File: `tests/unit/team-color-extractor.test.ts`
    - Test `rgbToOklch` with known sRGB values (e.g. pure red `255,0,0`; pure white `255,255,255`; pure black `0,0,0`) and assert L/C/H within tolerance
    - Test `sampleDominantRgb` skips transparent pixels (alpha < 128), near-white pixels, and near-black pixels; returns null for an all-transparent array
    - Test `formatOklch` clamps out-of-range inputs and produces the expected string format
    - Test `wcagContrastRatio` returns ≥ 21 for black-on-white and ≈ 1 for same-color pairs
    - _Requirements: 1.3, 1.4, 6.1_

- [x] 2. Add `extractTeamPalette` function
  - [x] 2.1 Implement `extractTeamPalette(url: string): Promise<TeamColorPalette | null>`
    - Guard: return null immediately for null/empty URL or URLs matching `isGenericPolymarketSoccerBallImageUrl`
    - Guard: return null when `typeof window === "undefined"` (SSR safety)
    - Load image with `crossOrigin = "anonymous"` set before `src`; resolve to null on `onerror`
    - Draw to `OffscreenCanvas(32, 32)` (fall back to `HTMLCanvasElement` if `OffscreenCanvas` is unavailable)
    - Wrap `ctx.getImageData()` in try/catch; return null on `SecurityError` (canvas taint)
    - Call `sampleDominantRgb`; return null if result is null
    - Convert to OKLCH via `rgbToOklch`
    - Derive `bg`: clamp L to `min(L, 0.25)`, multiply C by 0.4, keep H; format with `formatOklch`
    - Derive `text`: clamp L to `max(L, 0.60)`, keep C and H; format with `formatOklch`
    - Run WCAG AA contrast loop: while `wcagContrastRatio(bg, text) < 4.5` and `textL < 0.95`, increment `textL` by 0.02 and reformat
    - Return null if contrast still < 4.5 after loop; otherwise return `{ bg, text }`
    - Never throws — all errors caught and converted to null
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 5.5, 6.1, 6.2, 6.3_

  - [ ]* 2.2 Write property test for `extractTeamPalette` palette constraints
    - File: `tests/unit/team-color-extractor.property.test.ts`
    - **Property 1: Palette lightness and contrast invariant**
    - **Validates: Requirements 1.3, 1.4, 6.1**
    - Use `fast-check` to generate arbitrary RGB triples `fc.tuple(fc.integer({min:0,max:255}), fc.integer({min:0,max:255}), fc.integer({min:0,max:255}))`
    - Call an exported `derivePaletteFromRgb(r, g, b)` helper (thin wrapper around the internal derivation logic) for each triple
    - Assert: if result is non-null, `parseOklchL(palette.bg) <= 0.25` AND `parseOklchL(palette.text) >= 0.60` AND `wcagContrastRatio(palette.bg, palette.text) >= 4.5`
    - Assert: null is always a valid return (no assertion needed for null)
    - Export `derivePaletteFromRgb` and `parseOklchL` from `use-team-colors.ts` for test access only (mark with `@internal` JSDoc)

  - [ ]* 2.3 Write unit tests for `extractTeamPalette` error paths
    - File: `tests/unit/team-color-extractor.test.ts` (extend existing)
    - Test returns null for empty string URL
    - Test returns null for the generic soccer ball URL pattern (mock `isGenericPolymarketSoccerBallImageUrl`)
    - Test returns null when image `onerror` fires (mock `Image`)
    - Test returns null when `getImageData` throws `SecurityError`
    - Test derived `bg` always has L ≤ 0.25 for a known pixel array
    - Test derived `text` always has L ≥ 0.60 for a known pixel array
    - Test returns null when contrast cannot be achieved (mock a very dark logo producing L=0.05 dominant color)
    - _Requirements: 1.5, 1.6, 6.3_

- [x] 3. Add `Team_Color_Cache` (module-level singleton)
  - [x] 3.1 Implement the cache data structures and sessionStorage persistence
    - Add `const STORAGE_KEY = "doji:team-colors" as const`
    - Add `const paletteCache = new Map<string, TeamColorPalette | null>()`
    - Add `const inflight = new Map<string, Promise<TeamColorPalette | null>>()`
    - On module init (top-level IIFE or direct code): read `sessionStorage.getItem(STORAGE_KEY)`, parse JSON, pre-populate `paletteCache` — wrap in silent try/catch
    - Implement `getOrExtract(url: string): Promise<TeamColorPalette | null>` — check `paletteCache` first (synchronous hit), then check `inflight` for dedup, otherwise create new Promise calling `extractTeamPalette`, store in `inflight`, on resolution store in `paletteCache`, remove from `inflight`, persist updated cache to `sessionStorage` (silent try/catch on quota errors), return palette
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 3.2 Write unit tests for cache behavior
    - File: `tests/unit/team-color-extractor.test.ts` (extend existing)
    - Test cache hit: call `getOrExtract` twice with same URL; assert `extractTeamPalette` called exactly once (mock it)
    - Test in-flight dedup: call `getOrExtract` concurrently with same URL; assert `extractTeamPalette` called exactly once
    - Test sessionStorage round-trip: pre-populate `paletteCache`, serialize to sessionStorage, clear in-memory cache, re-initialize from sessionStorage, assert palette is equivalent
    - Test sessionStorage failure: mock `sessionStorage.setItem` to throw; assert in-memory cache still works
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 3.3 Write property test for cache round-trip
    - File: `tests/unit/team-color-extractor.property.test.ts` (extend existing)
    - **Property 2: Cache round-trip consistency**
    - **Validates: Requirements 2.6**
    - Use `fast-check` to generate arbitrary `TeamColorPalette` values (`fc.record({ bg: fc.string(), text: fc.string() })`)
    - For each generated palette: store in `paletteCache` under a generated URL key, serialize to sessionStorage JSON, deserialize back, assert retrieved palette deep-equals original

- [x] 4. Add `useTeamColors` hook
  - [x] 4.1 Implement `useTeamColors` hook
    - Export `useTeamColors({ teamAUrl, teamBUrl }: { teamAUrl: string | null; teamBUrl: string | null }): { paletteA: TeamColorPalette | null; paletteB: TeamColorPalette | null }`
    - Initialize `paletteA` and `paletteB` state as null (SSR-safe initial value)
    - `useEffect` for `teamAUrl`: if null, do nothing; if `paletteCache.has(url)`, call `setPaletteA` synchronously; otherwise call `getOrExtract(url).then(setPaletteA)`
    - `useEffect` for `teamBUrl`: same pattern
    - Both effects depend only on their respective URL
    - _Requirements: 1.7, 5.1, 5.2, 5.5_

  - [x] 5. Checkpoint — Ensure all tests pass
    - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update `SportsButtons` prop signature and resolve logo URLs
  - [x] 6.1 Extend `SportsButtons` props and add logo URL resolution + `useTeamColors` call
    - In `event-card.tsx`, add `teamImages`, `eventSlug`, `allMarkets`, and `eventImage` to the `SportsButtons` prop interface (all optional)
    - Inside `SportsButtons`, extract `[slugTokA, slugTokB]` from `extractOrderedSlugTeamTokens(eventSlug)` (same pattern as `SportsTeamRows`)
    - Resolve `logoUrlA` and `logoUrlB` using `resolveSportsTeamRowImage` for the 3-way path and `teamLogoFromMap` / `firstUsableTeamImage` for the 2-way and esports paths — mirror the exact resolution logic already used in `SportsTeamRows`
    - Call `useTeamColors({ teamAUrl: logoUrlA, teamBUrl: logoUrlB })` to get `paletteA` and `paletteB`
    - _Requirements: 3.1, 3.2, 5.1, 5.2, 5.3_

- [x] 7. Apply palette inline styles to 3-way soccer buttons
  - [x] 7.1 Wire palette into the 3-way soccer button render path
    - For Team A `<Link>`: when `paletteA` is non-null, replace `bg-positive/10` with `transition-[background-color,color]` className and add `style={{ backgroundColor: paletteA.bg, color: paletteA.text, transition: "background-color 150ms ease, color 150ms ease" }}`; when null, keep existing `bg-positive/10 text-positive transition-colors hover:bg-positive/20` classes
    - For Team B `<Link>`: same pattern using `paletteB` and existing `bg-negative/10 text-negative` fallback
    - For Draw `<Link>`: no changes — keep `bg-muted-foreground/10 text-muted-foreground hover:bg-muted-foreground/20` unconditionally
    - Update inner `<span>` text color: when palette is active, remove `text-positive`/`text-negative` class (color is inherited from the `style` prop on the parent `<Link>`); when palette is null, keep existing color class
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_

- [x] 8. Apply palette inline styles to 2-way binary buttons
  - [x] 8.1 Wire palette into the 2-way sports button render path
    - For Team A `<Link>` (token-based): when `paletteA` is non-null, apply `style` prop with `backgroundColor`, `color`, and `transition`; when null, keep `bg-positive/10 text-positive` fallback
    - For Team B `<Link>` (token-based): same pattern using `paletteB` and `bg-negative/10 text-negative` fallback
    - Update inner `<span>` text color classes to match palette/fallback state
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 9. Apply palette inline styles to esports fallback buttons
  - [x] 9.1 Wire palette into the esports title-derived button render path
    - For the `esportsTeamNames`-only path (no `market`): apply `paletteA`/`paletteB` inline styles using the same pattern as tasks 7.1 and 8.1
    - For the `market` with Yes/No tokens + `esportsTeamNames` path: apply `paletteA`/`paletteB` inline styles
    - _Requirements: 3.1, 3.2, 3.4, 3.5_

- [x] 10. Wire `CardBody` to pass new props to `SportsButtons`
  - [x] 10.1 Thread `eventSlug`, `allMarkets`, and `eventImage` from `CardBody` down to `SportsButtons`
    - `CardBody` already receives `teamImages`, `allMarkets`, `eventImage`, and `event` — extract `event.slug` and pass `eventSlug={event.slug}` to `SportsButtons`
    - Pass `allMarkets={allMarkets ?? markets}` and `eventImage={eventImage}` to `SportsButtons` (same values already passed to `SportsTeamRows`)
    - Pass `teamImages={teamImages}` to `SportsButtons`
    - No changes needed to `EventCardComponent` or `useSportsCardData` — `teamImages` already flows through
    - _Requirements: 5.3, 5.4_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Write unit tests for color math and extraction logic (integration)
  - [ ]* 12.1 Write integration tests for `useTeamColors` hook
    - File: `tests/unit/team-color-extractor.test.ts` (extend) or `tests/integration/use-team-colors.test.ts`
    - Mock `extractTeamPalette` to return a known palette; render `useTeamColors` with `@testing-library/react` `renderHook`; assert `paletteA`/`paletteB` update after mount
    - Test that when `teamAUrl` is null, `paletteA` remains null
    - Test that when `teamAUrl` changes, the new URL is extracted and state updates
    - _Requirements: 5.1, 5.5_

  - [ ]* 12.2 Write integration test for in-flight deduplication
    - Call `getOrExtract` with the same URL twice concurrently (before the first resolves)
    - Assert `extractTeamPalette` is called exactly once
    - _Requirements: 2.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The `derivePaletteFromRgb` and `parseOklchL` exports in `use-team-colors.ts` are test-only helpers; mark with `/** @internal */` JSDoc and do not use them in production code
- `OffscreenCanvas` is available in all modern browsers; fall back to `document.createElement("canvas")` only if `typeof OffscreenCanvas === "undefined"`
- The Draw button (Requirement 4) must never receive palette styles — this is enforced by simply not passing any palette to it, not by a conditional check
- Run `pnpm fix` after completing all tasks to ensure Biome/Ultracite compliance
- Run `pnpm check-types` to verify TypeScript is clean before opening a PR

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["3.2", "3.3", "4.1"] },
    { "id": 4, "tasks": ["6.1"] },
    { "id": 5, "tasks": ["7.1", "8.1", "9.1"] },
    { "id": 6, "tasks": ["10.1"] },
    { "id": 7, "tasks": ["12.1", "12.2"] }
  ]
}
```
