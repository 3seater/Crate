# Implementation Plan: Next.js Performance Optimization

## Overview

Restructure the Doji web app's rendering pipeline to deliver meaningful UI instantly via PPR static shell, eliminate client-side data waterfalls with server prefetching and streaming dehydration, reduce redundant API round trips with multi-layer caching, and improve runtime performance with client-side optimizations. Tasks follow priority ordering (P0 → P4) and build incrementally — each step wires into the previous.

## Tasks

- [x] 1. P0 — Root Layout & Static Shell Foundation
  - [x] 1.1 Restructure root layout Suspense boundaries
    - Remove the outer `<Suspense>` wrapping `<Providers>/<AppShell>/{children}` in `apps/web/src/app/layout.tsx`
    - Push `<Suspense>` boundaries down to individual dynamic content regions
    - Wrap analytics (DatadogRumInit, Analytics, SpeedInsights) in their own `<Suspense fallback={null}>` or `next/dynamic` with `{ ssr: false }`
    - Layout chrome (header, nav, sidebar) must render in the PPR static shell
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 Refactor AppShell into a Server Component
    - Extract `usePathname()` from `apps/web/src/components/layout/app-shell.tsx` into a small `<AppShellRouter>` client component
    - Convert the outer `AppShell` to a Server Component that renders layout structure
    - Move `CommentsContext` (useState) into a small client wrapper or lift into `<Providers>`
    - Wrap `<AppShellRouter>` in a `<Suspense>` with `<AppShellFallback>` inside the Server Component shell
    - _Requirements: 20.1, 20.2, 20.3_

  - [x] 1.3 Configure streaming dehydration in server QueryClient
    - Update `getQueryClient()` in `apps/web/src/lib/trpc/query-client.ts` to set `defaultOptions.dehydrate.shouldDehydrateQuery` to include `status === 'pending'` queries
    - Set `shouldRedactErrors: () => false` in dehydrate options
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.4 Write property test for streaming dehydration (Property 1)
    - **Property 1: Streaming Dehydration Includes Pending Queries**
    - **Validates: Requirements 5.1**

  - [x] 1.5 Mount React Query DevTools in development
    - Add `<ReactQueryDevtools initialIsOpen={false} />` inside `QueryClientProvider` in `apps/web/src/components/providers.tsx`
    - Gate with `process.env.NODE_ENV === 'development'` for tree-shaking in production
    - _Requirements: 4.1, 4.2_

  - [x] 1.6 Add `unstable_instant` navigation validation to key routes
    - Export `unstable_instant` from `/market/[slug]/page.tsx` and `/explore/page.tsx`
    - Enable `instantNavigationDevToolsToggle: true` in `next.config.ts` experimental section
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 2. Checkpoint — Verify static shell renders layout chrome
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. P1 — Server Caching Layer
  - [x] 3.1 Fix `getCachedEventsList` cache lifetime
    - Update `cacheLife` to `"minutes"` (1h expire, 1m revalidate) for PPR static shell eligibility, or wrap in `<Suspense>` with skeleton if keeping short-lived cache
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.2 Add `"use cache"` + `cacheLife` to server data fetches
    - Create `getCachedMarketBySlug(slug)` with `"use cache"`, `cacheLife("minutes")`, `cacheTag("market", slug)`
    - Create `getCachedEventBySlug(slug)` with `"use cache"`, `cacheLife("minutes")`, `cacheTag("event", slug)`
    - Create `getCachedLeaderboard(input)` with `"use cache"`, `cacheLife("minutes")`, `cacheTag("leaderboard")`
    - Place in `apps/web/src/lib/trpc/query-client.ts` or a new `apps/web/src/lib/server-cache.ts`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 3.3 Write property test for server cache idempotence (Property 2)
    - **Property 2: Server Cache Idempotence**
    - **Validates: Requirements 10.4**

  - [x] 3.4 Add cache tags for on-demand invalidation
    - Apply `cacheTag("market", slug)` and `cacheTag("event", slug)` in cached functions (done in 3.2)
    - Document `revalidateTag` vs `updateTag` usage patterns for Server Actions and Route Handlers
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 3.5 Add LRU cache for hot server data
    - Install `lru-cache` package, create `apps/web/src/lib/server-cache.ts` with `marketCache` (max: 200, TTL: 30s) and `eventCache` (max: 200, TTL: 60s)
    - Integrate LRU layer into cached server fetch functions as a pre-check before `serverTrpc` calls
    - _Requirements: 16.1, 16.2, 16.3, 16.4_

  - [x] 3.6 Write property test for LRU cache round-trip (Property 3)
    - **Property 3: LRU Cache Round-Trip**
    - **Validates: Requirements 16.3**

- [x] 4. P1 — Server Prefetch & Streaming
  - [x] 4.1 Add server prefetch and HydrationBoundary to leaderboard page
    - Prefetch leaderboard data using `getQueryClient()` + `serverTrpc` in the Server Component
    - Wrap client children in `<HydrationBoundary state={dehydrate(queryClient)}>`
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 4.2 Fix event page data waterfall with streaming
    - Render event header immediately without waiting for price history data
    - Wrap price history fetches in individual `<Suspense>` boundaries with skeleton fallbacks
    - Remove `Promise.all` blocking pattern for price histories
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 4.3 Defer searchParams access in explore page for PPR
    - Stop awaiting `searchParams` at the top level of the explore page component
    - Pass the `searchParams` promise to a child component wrapped in `<Suspense>`
    - Explore page static shell should include layout and skeleton as prerendered HTML
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 4.4 Add `loading.tsx` to trading routes
    - Create `apps/web/src/app/(trading)/market/[slug]/loading.tsx` with a trading page skeleton
    - Create `apps/web/src/app/(trading)/event/[slug]/loading.tsx` with an event page skeleton (if route exists at this path, adjust accordingly)
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 5. Checkpoint — Verify server prefetch and streaming work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. P1 — Client Query Optimizations
  - [x] 6.1 Add `keepPreviousData` to leaderboard time period switches
    - Add `placeholderData: keepPreviousData` to the leaderboard time period query
    - _Requirements: 13.1, 13.2_

  - [x] 6.2 Extend `select` usage for expensive query transformations
    - Move `useMemo` transformations in `events-discovery.tsx` and `position-table.tsx` into the query's `select` option
    - Define `select` functions outside the component or memoize for referential stability
    - _Requirements: 14.1, 14.2, 14.3_

  - [x] 6.3 Add CSS `content-visibility` to long lists
    - Apply `content-visibility: auto` and `contain-intrinsic-size: 0 52px` to explore table rows
    - Apply `content-visibility: auto` and `contain-intrinsic-size: 0 24px` to orderbook bid/ask level rows
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.4 Define staleTime constants and apply longer staleTime to stable data
    - Create `apps/web/src/constants/query.ts` with `STALE_REALTIME`, `STALE_DEFAULT`, `STALE_STABLE`, `STALE_STATIC`
    - Consolidate existing `QUERY_STALE_5MIN_MS` with `STALE_STABLE`
    - Apply `STALE_STABLE` (300_000ms) to profile, leaderboard, tags, and categories queries
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 34.1, 34.2, 34.3_

- [x] 7. P2 — Deeper Server Optimizations
  - [x] 7.1 Wrap sort and filter state updates in `startTransition`
    - Wrap explore table sort handler, column visibility toggles, portfolio tab switching, and leaderboard sorting in `startTransition`
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 7.2 Audit server routers for sequential await waterfalls
    - Audit `apps/server/src/routers/` for sequential `await` statements on independent fetches
    - Replace sequential awaits with `Promise.all()` or `Promise.allSettled()` where applicable
    - Defer conditional-branch-only awaits into their branches
    - _Requirements: 18.1, 18.2, 18.3_

  - [x] 7.3 Server prefetch trading page data
    - Prefetch orderbook seed data in the Market_Page Server Component using `getQueryClient()` + `serverTrpc`
    - Conditionally prefetch user's open orders when session token is available
    - Wrap trading panel client components in `<HydrationBoundary>`
    - _Requirements: 19.1, 19.2, 19.3_

  - [x] 7.4 Extend `React.cache()` to event page and all multi-call server fetches
    - Wrap `serverTrpc.events.getBySlug.query()` with `React.cache()` on the event page
    - Apply `React.cache()` to all server fetch functions called from both `generateMetadata` and page component
    - _Requirements: 21.1, 21.2, 21.3, 36.1, 36.2, 36.3_

  - [x] 7.5 Write property test for React.cache() deduplication (Property 4)
    - **Property 4: React.cache() Request-Scoped Deduplication**
    - **Validates: Requirements 21.2, 36.2**

  - [x] 7.6 Correct params awaiting in dynamic routes for PPR
    - Ensure dynamic route pages do not `await params` at the top level before any `<Suspense>` boundary
    - Pass params promise to child components wrapped in `<Suspense>` where applicable
    - _Requirements: 22.1, 22.2, 22.3_

- [x] 8. Checkpoint — Verify server optimizations and streaming
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. P2-P3 — Streaming & Static Generation
  - [x] 9.1 Implement streaming on market detail page
    - Render market header immediately as part of initial HTML
    - Wrap trading panel in `<Suspense>` with trading skeleton fallback
    - Wrap chart section in separate `<Suspense>` with chart skeleton fallback
    - _Requirements: 25.1, 25.2, 25.3, 25.4_

  - [x] 9.2 Add `generateStaticParams` for top markets and events
    - Export `generateStaticParams` from market page returning top 50 most-traded market slugs
    - Export `generateStaticParams` from event page returning top 50 most-active event slugs
    - Ensure fallback to dynamic server rendering for non-static slugs
    - _Requirements: 24.1, 24.2, 24.3, 24.4_

- [x] 10. P3 — Activity Component & Client Polish
  - [x] 10.1 Use Activity component for trading panel tabs
    - Replace conditional rendering in trading panel tab system with `<Activity mode={...}>` wrappers
    - Preserve DOM and React state for previously viewed tabs
    - _Requirements: 23.1, 23.2, 23.3_

  - [x] 10.2 Replace state+effect with ref for sticky data pattern
    - Refactor `trading-selector-card.tsx` to use `useRef` instead of `useState` + `useEffect` + `queueMicrotask`
    - Refactor `market-header-trading.tsx` to use `useRef` for sticky data
    - _Requirements: 39.1, 39.2, 39.3_

  - [x] 10.3 Write property test for sticky data ref (Property 11)
    - **Property 11: Sticky Data Ref Preserves Last Defined Value**
    - **Validates: Requirements 39.1, 39.2**

  - [x] 10.4 Replace useEffect with suppressHydrationWarning in RelativeTime
    - Update `RelativeTime` in `trade-utils.tsx` to render `formatTimeAgo(ts)` directly with `suppressHydrationWarning`
    - Remove `useState` + `useEffect` pattern for setting the label
    - _Requirements: 38.1, 38.2, 38.3_

  - [x] 10.5 Write property test for RelativeTime non-empty first render (Property 10)
    - **Property 10: RelativeTime Non-Empty First Render**
    - **Validates: Requirements 38.1**

- [x] 11. Checkpoint — Verify client optimizations
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. P4 — DX, Guards & Remaining Optimizations
  - [x] 12.1 Add `server-only` import guard to `trpc-server.ts`
    - Add `import 'server-only'` at the top of `apps/web/src/lib/trpc-server.ts` (or `apps/web/src/lib/trpc/server.ts`)
    - _Requirements: 30.1, 30.2_

  - [x] 12.2 Add consistent error handling to serverTrpc calls in RSC pages
    - Create `withServerError` utility in `apps/web/src/lib/server-utils.ts`
    - Apply consistent try/catch pattern across all RSC pages using `serverTrpc` (market, event, explore, leaderboard)
    - Add fallback metadata in `generateMetadata` functions that catch errors
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5_

  - [x] 12.3 Write property test for server error wrapper (Property 5)
    - **Property 5: Server Error Wrapper Produces Fallback**
    - **Validates: Requirements 31.1**

  - [x] 12.4 Write property test for generateMetadata error resilience (Property 6)
    - **Property 6: generateMetadata Error Resilience**
    - **Validates: Requirements 31.4**

  - [x] 12.5 Enable production browser source maps
    - Set `productionBrowserSourceMaps: true` in `next.config.ts`
    - Add `sourcemaps:upload` script for Datadog source map upload in CI
    - _Requirements: 27.1, 27.2, 27.3_

  - [x] 12.6 Add client-side router cache staleTimes configuration
    - Add `staleTimes: { dynamic: 30 }` to `next.config.ts` experimental section
    - _Requirements: 29.1, 29.2, 29.3_

  - [x] 12.7 Dynamic import Analytics and SpeedInsights in root layout
    - Replace static imports of `Analytics` and `SpeedInsights` with `next/dynamic` using `{ ssr: false }`
    - _Requirements: 37.1, 37.2, 37.3_

  - [x] 12.8 Add localStorage cache utility
    - Create `getCachedStorage` utility with module-level `Map` cache
    - Migrate 11 uncached `localStorage.getItem` calls across 7 files to use the utility
    - _Requirements: 32.1, 32.2, 32.3_

  - [x] 12.9 Write property test for localStorage cache utility (Property 7)
    - **Property 7: localStorage Cache Utility Round-Trip**
    - **Validates: Requirements 32.1, 32.2**

- [x] 13. P4 — Server Actions, Optimistic Updates & Evaluation Tasks
  - [x] 13.1 Add Server Actions for non-trading mutations
    - Implement `"use server"` functions for profile update and user settings mutations
    - Call `updateTag('user-profile')` after profile updates for read-your-own-writes
    - Trading mutations remain on existing tRPC client pattern
    - _Requirements: 28.1, 28.2, 28.3, 28.4_

  - [x] 13.2 Add optimistic updates to wallet tracker mutations
    - Implement `onMutate` → cancel queries → snapshot → optimistic set → return rollback context for add/remove
    - Implement `onError` rollback and `onSettled` refetch
    - _Requirements: 35.1, 35.2, 35.3, 35.4_

  - [x] 13.3 Write property tests for optimistic updates (Properties 8 & 9)
    - **Property 8: Optimistic Update Cache Mutation**
    - **Property 9: Optimistic Update Rollback on Failure**
    - **Validates: Requirements 35.1, 35.2, 35.3**

  - [x] 13.4 Evaluate `useSuspenseQuery` for prefetched pages
    - Evaluate replacing `useQuery` with `useSuspenseQuery` on pages with guaranteed server prefetch (explore, market, event)
    - Use `useSuspenseQueries` for parallel queries in the same component
    - Retain `useQuery` for conditionally-fetched queries
    - _Requirements: 33.1, 33.2, 33.3, 33.4_

  - [x] 13.5 Evaluate direct tRPC caller for server-side calls
    - Determine if Next.js and Hono servers are co-located or separate deployments
    - If co-located, implement direct tRPC caller using `caller` API
    - If separate, retain current `httpBatchLink`-based `serverTrpc`
    - _Requirements: 26.1, 26.2, 26.3_

  - [x] 13.6 Trim event object serialization across RSC boundary
    - Audit which fields of the event object are consumed by `EventPageComposition` and children
    - Pass only required fields to client components instead of full event object
    - _Requirements: 40.1, 40.2, 40.3_

  - [x] 13.7 Write property test for event object trimming (Property 12)
    - **Property 12: Event Object Trimming Preserves Required Fields**
    - **Validates: Requirements 40.2, 40.3**

- [x] 14. Final Checkpoint — Full verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each priority tier
- Property tests validate universal correctness properties from the design document
- Trading mutations (order placement, cancellation) are explicitly excluded from Server Actions — the existing `invalidatePostTradeQueriesWithRetry` pattern handles Polymarket's Data API indexing lag
- The `lru-cache` package needs to be installed: `pnpm add lru-cache --filter=web`
