# Implementation Plan: Event-Centric Navigation

## Overview

Restructure the app from market-centric to event-centric navigation. Work proceeds bottom-up: backend router split first, then Gamma API cleanup, then new frontend components and routes, then wiring and cleanup.

## Tasks

- [x] 1. Split tRPC router and clean up Gamma API
  - [x] 1.1 Create `apps/server/src/routers/events.ts` with an `eventsRouter` containing: `list`, `getBySlug`, `search`, `tags`, `series`, `sports`, `publicProfile` procedures (move from `marketsRouter`)
    - _Requirements: 5.1, 5.3, 5.4_
  - [x] 1.2 Slim down `apps/server/src/routers/markets.ts` to only contain `getBySlug` (market-only lookup)
    - _Requirements: 5.2, 5.5_
  - [x] 1.3 Update `apps/server/src/routers/index.ts` to register `eventsRouter` as `events` and keep slimmed `marketsRouter` as `markets`
    - _Requirements: 5.1, 5.2_
  - [x] 1.4 Remove the hacky event fallback from `getMarketBySlug` in `apps/server/src/lib/polymarket/gamma.ts` — let 404s propagate
    - _Requirements: 3.3_
  - [x] 1.5 Update `apps/server/src/routers/router-structure.test.ts` to verify the new `events` router procedures and slimmed `markets` router
    - _Requirements: 5.1, 5.2_
  - [x] 1.6 Update `apps/server/src/routers/routers.test.ts` input schema tests for the split routers
    - _Requirements: 5.1, 5.2_

- [x] 2. Create `isBinaryEvent` helper and event component utilities
  - [x] 2.1 Create `apps/web/src/lib/events.ts` with `isBinaryEvent(event: Event): boolean` helper function
    - Returns true when event has exactly 1 market with 2 tokens and `neg_risk` is false
    - _Requirements: 2.2, 2.3_
  - [x] 2.2 Write property test for `isBinaryEvent`
    - **Property 4: Binary vs multi-outcome rendering**
    - **Validates: Requirements 2.2, 2.3**

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create event components (home page)
  - [x] 4.1 Create `apps/web/src/components/event/event-card.tsx` — accepts `Event`, displays event title/image/outcomes, links to `/event/{event.slug}`
    - For binary events: show Yes/No prices from single market
    - For multi-outcome events: show top outcomes with "+N more"
    - _Requirements: 1.2, 1.3, 1.4_
  - [x] 4.2 Write property test for EventCard link generation
    - **Property 3: Event links use event slug**
    - **Validates: Requirements 1.4, 6.1**
  - [x] 4.3 Create `apps/web/src/components/event/event-list.tsx` — accepts `Event[]`, renders EventCards, infinite scroll via `events.list`
    - No `flattenMarkets` — render events directly
    - _Requirements: 1.1, 1.7, 4.2, 4.4_
  - [x] 4.4 Write property test for EventList count invariant
    - **Property 1: EventList preserves event count**
    - **Validates: Requirements 1.1**
  - [x] 4.5 Create `apps/web/src/components/event/event-filters.tsx` — copy from `market-filters.tsx`, rename component and update aria labels
    - _Requirements: 4.5, 7.4_
  - [x] 4.6 Create `apps/web/src/components/event/event-discovery.tsx` — composes EventFilters + EventList
    - _Requirements: 4.1_

- [x] 5. Create event detail page and components
  - [x] 5.1 Create `apps/web/src/components/trading/event-header.tsx` — displays event title, description, image, aggregate volume, end date, market count
    - _Requirements: 2.1, 2.5_
  - [x] 5.2 Create `apps/web/src/components/trading/market-selector.tsx` — selectable list of markets within a multi-outcome event, shows question + outcome prices per market
    - _Requirements: 2.3, 2.4_
  - [x] 5.3 Create `apps/web/src/app/(trading)/event/[slug]/page.tsx` — event detail page
    - Fetch event via `events.getBySlug`
    - Binary events: render TradingLayout directly with single market
    - Multi-outcome events: render MarketSelector + TradingLayout for selected market (client component wrapper needed)
    - Handle 404 with `notFound()`
    - Generate metadata from event title/description
    - _Requirements: 2.1, 2.2, 2.3, 2.6_
  - [x] 5.4 Create `apps/web/src/app/(trading)/event/[slug]/loading.tsx` skeleton
    - _Requirements: 2.1_

- [x] 6. Update market detail page with redirect logic
  - [x] 6.1 Update `apps/web/src/app/(trading)/market/[slug]/page.tsx` to remove event fallback from data fetching and add redirect logic:
    - Call `markets.getBySlug` (clean, no fallback)
    - On 404: try `events.getBySlug` → if found, `redirect("/event/{slug}", 308)` → if not found, `notFound()`
    - _Requirements: 3.1, 3.2, 3.4, 7.1, 7.2_
  - [x] 6.2 Write property test for event slug redirect logic
    - **Property 5: Event slug redirect from market route**
    - **Validates: Requirements 3.2, 7.1**

- [x] 7. Update home page to use event components
  - [x] 7.1 Update `apps/web/src/app/page.tsx` to import EventDiscovery instead of MarketDiscovery, update tRPC calls from `markets.list` → `events.list` and `markets.tags` → `events.tags`
    - _Requirements: 1.1, 1.5, 1.6_
  - [x] 7.2 Update search integration on home page: change `markets.search` → `events.search`, pass event results to EventDiscovery
    - _Requirements: 6.1, 6.3_

- [x] 8. Cleanup old market components
  - [x] 8.1 Delete old files: `market-discovery.tsx`, `market-list.tsx`, `market-card.tsx`, `market-filters.tsx` from `apps/web/src/components/market/`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 8.2 Search codebase for any remaining imports of deleted components and update them
    - _Requirements: 4.1, 4.2, 4.3_

- [x] 9. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Consolidate test file locations
  - [x] 10.1 Audit `apps/server/src/` for test files co-located alongside source files (outside `__tests__/` dirs) and move them into the nearest `__tests__/` directory
  - [x] 10.2 Audit `apps/web/src/` for test files co-located alongside source files (outside `__tests__/` dirs) and move them into the nearest `__tests__/` directory
  - [x] 10.3 Identify and merge any duplicate test files (same module tested in both locations) — combine assertions into the `__tests__/` version and delete the co-located copy
  - [x] 10.4 Verify all tests still pass after moves and merges

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- The trading UI components (Orderbook, OrderForm, PriceChart, OpenOrders) are not modified
- Property tests use fast-check with Vitest, minimum 100 iterations each
- Checkpoints ensure incremental validation
