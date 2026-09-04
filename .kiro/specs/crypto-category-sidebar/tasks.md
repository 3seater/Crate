# Implementation Plan: Crypto Category Sidebar

## Overview

Add a vertical category sidebar to the Explore page that appears when the Crypto topic tab is active. The sidebar provides time-based and asset-based filter categories with Lucide icons, live market counts, and client-side filtering. Implementation builds incrementally: constants → component → integration → URL state → filtering → styling → tests.

## Tasks

- [x] 1. Create category constants and definitions
  - [x] 1.1 Create `apps/web/src/components/explore/crypto-sidebar-constants.ts` with `CryptoCategoryDef` interface, `CRYPTO_TIME_CATEGORIES` (All, 5 Min, 15 Min, 1 Hour, 4 Hours, Daily, Weekly, Monthly, Yearly, Pre-Market, ETF) and `CRYPTO_ASSET_CATEGORIES` (Bitcoin, Ethereum, Solana, XRP, Dogecoin, BNB, Microstrategy) arrays
    - Each entry: `slug`, `label`, `icon` (Lucide), `match(event): boolean`
    - Time categories: regex on market question text (e.g. "5 minute", "5-minute", "5 min")
    - Asset categories: match on event tags or question text (e.g. "Bitcoin", "BTC")
    - "All" category: `match` always returns `true`
    - Icon mapping per design: LayoutGrid, Timer, Clock3, Clock, Clock4, CalendarDays, CalendarRange, Calendar, CalendarClock, Sunrise, Landmark, Bitcoin, Hexagon, Sun, Droplets, Dog, Diamond, Building2
    - Export `filterByCryptoCategory(events, slug)` pure function
    - Export `isCryptoSidebarVisible(tagSlugs, activeModeId)` pure function
    - _Requirements: 3.1, 4.2, 5.1, 5.2, 10.1, 10.2, 10.3_

  - [ ]* 1.2 Write property test: Sidebar visibility is determined solely by the crypto tag (Property 1)
    - **Property 1: Sidebar visibility is determined solely by the crypto tag**
    - Use fast-check to generate random tag slug strings; verify `isCryptoSidebarVisible` returns `true` only for `"crypto"` with null mode
    - Verify returns `false` for any non-null `activeModeId`
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**

  - [ ]* 1.3 Write property test: Category filtering returns exactly matching events (Property 2)
    - **Property 2: Category filtering returns exactly matching events**
    - Use fast-check to generate arrays of mock events with varied question text and tags
    - Verify `filterByCryptoCategory` output matches manual `events.filter(cat.match)` for each category
    - **Validates: Requirements 3.3, 4.3, 10.1, 10.2, 10.3**

  - [ ]* 1.4 Write unit tests for category constants
    - Verify `CRYPTO_TIME_CATEGORIES` has exactly 11 entries in the specified order
    - Verify `CRYPTO_ASSET_CATEGORIES` has exactly 7 entries in the specified order
    - Verify each definition has non-empty `slug`, `label`, `icon`, and `match` function
    - Verify "All" match function returns `true` for any event
    - _Requirements: 3.1, 4.2, 5.1, 5.2_

- [ ] 2. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Build CryptoCategorySidebar component
  - [x] 3.1 Create `apps/web/src/components/explore/crypto-category-sidebar.tsx` with `CryptoCategorySidebar` and inline `CryptoCategoryItem`
    - `CryptoCategorySidebar` props: `activeCategorySlug`, `events`, `onCategoryChange`
    - Compute `categoryCounts` via `useMemo` keyed on `events` reference
    - Render time categories section, `<Separator>`, asset categories section
    - `CryptoCategoryItem` props: `active`, `count`, `icon`, `label`, `onClick`
    - Active state: `bg-doji-green-08` background tint, `text-text-primary` label/icon
    - Inactive state: `text-text-secondary` label/icon, `hover:bg-market-list-hover`
    - Typography: `text-sm` for labels, `text-xs` for counts
    - Weights: `font-medium` for active, `font-normal` for inactive
    - Hidden below `sm` breakpoint (`hidden sm:flex flex-col`)
    - Right border using `border-r border-default`
    - `"use client"` directive
    - _Requirements: 2.1, 3.1, 3.2, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2, 7.1, 7.2, 7.3, 7.4, 9.1, 9.2, 9.3, 9.4, 9.5, 11.1, 11.2_

  - [ ]* 3.2 Write property test: Market counts equal the number of matching events (Property 3)
    - **Property 3: Market counts equal the number of matching events**
    - Use fast-check to generate random event arrays
    - Verify computed count for each category equals `events.filter(cat.match).length`
    - Verify "All" count equals `events.length`
    - **Validates: Requirements 3.2, 6.2**

- [x] 4. Integrate sidebar into EventsDiscoveryInner
  - [x] 4.1 Add `crypto_cat` URL search param parsing to `useExploreUrlState` (in `use-explore-url-state.ts`)
    - Parse `crypto_cat` from search params, default to `null` (meaning "all")
    - Validate against known category slugs; treat unrecognized values as `null`
    - _Requirements: 10.1_

  - [x] 4.2 Modify `EventsDiscoveryInner` in `events-discovery.tsx` to conditionally render `CryptoCategorySidebar`
    - Use `isCryptoSidebarVisible(tagSlugs, activeModeId)` to determine visibility
    - When visible, wrap table/grid in a flex row: `<div className="flex">` with sidebar + content
    - When hidden, render content at full width (existing behavior)
    - Add `handleCryptoCategoryChange` callback: updates `crypto_cat` URL param via `window.history.replaceState`
    - Remove `crypto_cat` param when crypto tab is deselected
    - Apply `filterByCryptoCategory(displayEvents, activeCryptoCategory)` before rendering table/grid
    - Default active category is "all" when no `crypto_cat` param present
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 3.3, 3.4, 4.3, 4.4, 8.1, 8.2, 8.3, 10.1, 10.4, 11.1, 11.2_

- [x] 5. Implement single selection and toggle-to-reset logic
  - [x] 5.1 Wire selection state in `CryptoCategorySidebar`
    - Clicking a category calls `onCategoryChange(slug)` (or `null` for "all")
    - Clicking the active category (non-"all") resets to "all" via `onCategoryChange(null)`
    - Exactly one category is active at any time across both sections
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 5.2 Write property test: Single selection invariant (Property 4)
    - **Property 4: Single selection invariant**
    - Use fast-check to generate random sequences of category slug selections
    - Simulate the state machine; verify exactly one category is active after each selection
    - **Validates: Requirements 8.1, 8.2**

  - [ ]* 5.3 Write property test: Toggle-to-reset behavior (Property 5)
    - **Property 5: Toggle-to-reset behavior**
    - Use fast-check to generate random non-"all" category slugs
    - Simulate selecting the same slug twice; verify state resets to "all"
    - **Validates: Requirements 8.3**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Final wiring and edge cases
  - [x] 7.1 Handle empty state when no events match selected category
    - When `filterByCryptoCategory` returns zero events, the existing table/grid empty state should display
    - Sidebar remains visible with count showing `0` for the selected category
    - _Requirements: 10.4_

  - [x] 7.2 Handle invalid `crypto_cat` URL param
    - Unrecognized slugs default to "all" (show all crypto events)
    - _Requirements: 10.1_

  - [ ]* 7.3 Write unit tests for integration behavior
    - Verify default active category is "all" when no `crypto_cat` param is present
    - Verify sidebar visibility returns `false` for each mode category (trending, new, all)
    - Verify empty state is shown when filter returns zero events
    - _Requirements: 1.3, 3.4, 10.4_

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use fast-check (already in the project's Vitest setup)
- All UI uses design system tokens only (no hardcoded colors, 6-size type scale, font-normal/font-medium)
- The sidebar is a pure client component; no new tRPC endpoints or server changes needed
