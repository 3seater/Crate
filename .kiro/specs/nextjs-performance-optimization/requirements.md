# Requirements Document

## Introduction

Comprehensive performance optimization of the Doji web application (a Polymarket prediction market frontend) based on a detailed Next.js 16 + TanStack Query v5 audit. The audit graded the app Next.js B+ / TanStack Query A-, identifying that while the App Router is fully adopted and client-side query management is mature, the application underutilizes server-side rendering, caching, streaming, and Partial Prerendering (PPR). This feature covers all recommendations from P0 (critical) through P4 (nice-to-have), restructuring the rendering pipeline so users see meaningful UI instantly, eliminating client-side data waterfalls, and reducing redundant server round trips.

## Glossary

- **PPR**: Partial Prerendering — Next.js sends a static HTML shell immediately, then streams dynamic content at request time. Enabled via `cacheComponents: true` in `next.config.ts`.
- **Static_Shell**: The prerendered HTML sent before any async work — includes layouts, Suspense fallbacks, and cached content. Users see this instantly.
- **Streaming**: Progressive HTML delivery where `<Suspense>` boundaries define flush points — fallback HTML is sent first, resolved content replaces it when ready.
- **HydrationBoundary**: TanStack Query component that transfers server-prefetched query data to the client QueryClient without re-fetching.
- **Streaming_Dehydration**: Dehydrating pending (not-yet-resolved) queries so they stream to the client as they resolve, enabling non-blocking server prefetches.
- **Server_QueryClient**: A per-request `QueryClient` created in Server Components via `getQueryClient()` for server-side data prefetching.
- **Use_Cache_Directive**: Next.js 16 `"use cache"` directive that caches a server function's return value with configurable lifetime via `cacheLife()`.
- **CacheLife_Profile**: Named duration profiles for `cacheLife()`: `seconds`, `minutes`, `hours`, `days`, `weeks`, `max` — each with predefined `stale`, `revalidate`, and `expire` values.
- **CacheTag**: A label applied to cached data via `cacheTag()` enabling targeted invalidation via `revalidateTag()` or `updateTag()`.
- **LRU_Cache**: Least Recently Used in-memory cache on the web server for cross-request data deduplication (e.g., `lru-cache` package).
- **Content_Visibility**: CSS property `content-visibility: auto` that tells the browser to skip layout and paint for off-screen elements.
- **StartTransition**: React API that marks a state update as non-urgent, keeping the UI responsive during expensive re-renders.
- **Activity_Component**: React 19+ `<Activity>` component that preserves DOM and state for toggled-visibility components instead of unmounting/remounting.
- **Unstable_Instant**: Next.js 16 route export that validates at dev/build time that client-side navigations are instant (not blocked by uncached fetches or misplaced Suspense).
- **GenerateStaticParams**: Next.js function that pre-generates static pages for known dynamic route parameters at build time.
- **Server_Action**: `"use server"` async function that runs on the server when called from a client component, enabling mutations with cache revalidation.
- **UseSuspenseQuery**: TanStack Query hook that integrates with React Suspense — the component suspends until data is available, eliminating manual loading state checks.
- **ReactQueryDevTools**: TanStack Query debugging panel showing all queries, their states, cache entries, and timing. Tree-shaken in production.
- **ServerTrpc**: Server-side tRPC client (`src/lib/trpc-server.ts`) that calls the Hono API via HTTP from Server Components.
- **AppShell**: Layout shell component (`src/components/layout/app-shell.tsx`) containing header, navigation, and sidebar — currently a client component due to `usePathname()`.
- **Explore_Page**: The `/explore` route — the primary discovery page showing a table of prediction markets.
- **Market_Page**: The `/market/[slug]` route — individual market trading page with orderbook, chart, and order form.
- **Event_Page**: The `/event/[slug]` route — event detail page showing grouped markets with price histories.
- **Leaderboard_Page**: The `/leaderboard` route — ranking page for top traders.

## Requirements

### Requirement 1: Restructure Root Layout Suspense for Meaningful PPR Static Shell

**User Story:** As a user, I want to see the application header, navigation, and sidebar immediately when a page loads, so that I perceive the app as fast and can orient myself while dynamic content streams in.

#### Acceptance Criteria

1. WHEN a page loads, THE Static_Shell SHALL include the layout chrome (header, navigation, sidebar) as prerendered HTML sent before any dynamic content resolves.
2. THE Root_Layout SHALL NOT wrap the entire `<Providers>/<AppShell>/{children}` tree in a single `<Suspense>` boundary, because doing so limits the Static_Shell to only the Suspense fallback (a loading spinner with no useful UI).
3. WHEN PPR is enabled (`cacheComponents: true`), THE Root_Layout SHALL place `<Suspense>` boundaries only around individual dynamic content regions (page-specific data), so that layout chrome renders in the static shell.
4. IF the `<Providers>` component requires a client boundary for QueryClientProvider and Zustand, THEN THE Root_Layout SHALL structure the component tree so that static layout elements render outside or above the dynamic Suspense boundaries.

### Requirement 2: Fix getCachedEventsList Cache Lifetime for Prerender Eligibility

**User Story:** As a user visiting the explore page, I want the market list to be part of the prerendered static shell or to stream in quickly, so that I see content without waiting for a full server round trip.

#### Acceptance Criteria

1. THE getCachedEventsList function SHALL use a CacheLife_Profile with an `expire` value of 5 minutes or greater (e.g., `cacheLife('minutes')`) to qualify for inclusion in the prerender static shell.
2. WHEN the cache lifetime `expire` is less than 5 minutes, THE cached data SHALL be treated as a short-lived cache by Next.js and excluded from the static shell, requiring a `<Suspense>` boundary to stream it in.
3. IF the team decides to keep a short-lived cache (sub-5-minute expire), THEN THE Explore_Page SHALL wrap the component consuming this data in a `<Suspense>` boundary with a meaningful skeleton fallback.

### Requirement 3: Add Instant Navigation Validation to Key Routes

**User Story:** As a developer, I want build-time and dev-time validation that client-side navigations between routes are instant, so that Suspense placement issues are caught before production.

#### Acceptance Criteria

1. THE Market_Page (`/market/[slug]`) SHALL export `unstable_instant` to validate that client-side navigations to and from this route are not blocked by uncached fetches or misplaced Suspense boundaries.
2. THE Explore_Page (`/explore`) SHALL export `unstable_instant` to validate instant navigation.
3. THE Next_Config SHALL enable `instantNavigationDevToolsToggle: true` in the `experimental` section so developers can inspect what is in the static shell during development.
4. WHEN `unstable_instant` validation fails at build time, THE Build_Process SHALL report the specific route and Suspense issue as a build error.

### Requirement 4: Mount React Query DevTools in Development

**User Story:** As a developer, I want to inspect all active queries, their cache states, and timing in a visual panel during development, so that I can debug data fetching issues efficiently.

#### Acceptance Criteria

1. WHILE the application runs in development mode (`NODE_ENV === 'development'`), THE Providers component SHALL render `<ReactQueryDevtools initialIsOpen={false} />` inside the `QueryClientProvider`.
2. WHILE the application runs in production mode, THE ReactQueryDevTools component SHALL NOT be included in the client JavaScript bundle (tree-shaken by the bundler).

### Requirement 5: Configure Streaming Dehydration for Non-Blocking Server Prefetches

**User Story:** As a user, I want server-prefetched data to stream to my browser as it resolves rather than blocking the entire page render, so that I see content progressively.

#### Acceptance Criteria

1. THE Server_QueryClient factory (`getQueryClient`) SHALL configure `defaultOptions.dehydrate.shouldDehydrateQuery` to include queries with `status === 'pending'` in addition to the default dehydration behavior.
2. WHEN a Server Component calls `queryClient.prefetchQuery()` without `await`, THE HydrationBoundary SHALL serialize the pending query promise so it streams to the client as it resolves.
3. THE Server_QueryClient SHALL set `shouldRedactErrors` to `() => false` in the dehydrate options, allowing Next.js to handle error redaction.

### Requirement 6: Add CSS content-visibility to Long Lists

**User Story:** As a user scrolling through large tables, I want the browser to skip layout and paint for off-screen rows, so that initial render is fast and scrolling is smooth.

#### Acceptance Criteria

1. THE Explore_Page table rows SHALL have `content-visibility: auto` and `contain-intrinsic-size: 0 52px` applied via CSS.
2. THE Orderbook component bid and ask level rows SHALL have `content-visibility: auto` and `contain-intrinsic-size: 0 24px` applied via CSS.
3. WHEN Content_Visibility is applied to a list with 100 items, THE Browser SHALL skip layout and paint for off-screen items, reducing initial render work.

### Requirement 7: Add Server Prefetch and HydrationBoundary to Leaderboard Page

**User Story:** As a user visiting the leaderboard, I want to see ranking data immediately without waiting for client-side JavaScript to load and fetch, so that the page feels instant.

#### Acceptance Criteria

1. THE Leaderboard_Page Server Component SHALL prefetch leaderboard data using the Server_QueryClient and `serverTrpc` before rendering.
2. THE Leaderboard_Page SHALL wrap its client component children in a `<HydrationBoundary state={dehydrate(queryClient)}>` so the client QueryClient receives the prefetched data without re-fetching.
3. WHEN a user navigates to the leaderboard, THE Leaderboard_Page SHALL render with data present in the initial HTML rather than showing an empty shell followed by a loading spinner.

### Requirement 8: Fix Event Page Data Waterfall with Streaming

**User Story:** As a user viewing an event with multiple markets, I want to see the event header immediately while price histories for each market stream in progressively, so that I am not blocked by the slowest API call.

#### Acceptance Criteria

1. THE Event_Page SHALL render the event header (title, description, metadata) immediately without waiting for price history data to resolve.
2. WHEN the event contains N markets, THE Event_Page SHALL wrap price history fetches in individual `<Suspense>` boundaries with skeleton fallbacks, so each market's chart streams in independently.
3. THE Event_Page SHALL NOT block the entire page render on `Promise.all` of all price history fetches.

### Requirement 9: Defer searchParams Access in Explore Page for PPR Compatibility

**User Story:** As a developer, I want the explore page's static shell to prerender without being blocked by dynamic searchParams access, so that users see the page layout instantly.

#### Acceptance Criteria

1. THE Explore_Page SHALL NOT `await` the `searchParams` promise at the top level of the page component before any `<Suspense>` boundary.
2. THE Explore_Page SHALL pass the `searchParams` promise down to the child component that consumes it, wrapped in a `<Suspense>` boundary.
3. WHEN `searchParams` access is deferred below a Suspense boundary, THE Explore_Page static shell SHALL include the page layout and skeleton as prerendered HTML.

### Requirement 10: Add "use cache" and cacheLife to Server Data Fetches

**User Story:** As a user, I want server-fetched data (markets, events, leaderboard) to be cached on the server so that repeated requests within the cache window are served instantly without round trips to the API server.

#### Acceptance Criteria

1. THE server fetch function for market data (`getMarketBySlug`) SHALL use the Use_Cache_Directive with an appropriate CacheLife_Profile (e.g., `cacheLife('minutes')` for public market metadata).
2. THE server fetch function for event data SHALL use the Use_Cache_Directive with an appropriate CacheLife_Profile.
3. THE server fetch function for leaderboard data SHALL use the Use_Cache_Directive with `cacheLife({ revalidate: 60, expire: 120 })` or `cacheLife('minutes')`.
4. WHEN a cached function is called with the same arguments within the cache lifetime, THE Server SHALL return the cached result without making an HTTP request to the Hono API.

### Requirement 11: Add Cache Tags for On-Demand Invalidation

**User Story:** As a developer, I want to tag cached server data so that specific cache entries can be invalidated when markets resolve or data changes, without waiting for time-based expiry.

#### Acceptance Criteria

1. THE cached market data function SHALL apply `cacheTag('market', slug)` so individual market caches can be invalidated by slug.
2. THE cached event data function SHALL apply `cacheTag('event', slug)` so individual event caches can be invalidated by slug.
3. WHEN a Server_Action or Route Handler needs to invalidate cached data, THE system SHALL call `revalidateTag('market')` or `revalidateTag('event')` to trigger stale-while-revalidate behavior.
4. WHEN a mutation requires the user to see their change immediately (read-your-own-writes), THE Server_Action SHALL call `updateTag()` instead of `revalidateTag()` to immediately expire the cache.

### Requirement 12: Add loading.tsx to Trading Routes

**User Story:** As a user navigating to a market or event page, I want to see a meaningful skeleton UI during route transitions, so that the navigation feels responsive.

#### Acceptance Criteria

1. THE `/market/[slug]` route segment SHALL have a `loading.tsx` file that exports a trading page skeleton component.
2. THE `/event/[slug]` route segment SHALL have a `loading.tsx` file that exports an event page skeleton component.
3. WHEN a user navigates to a market or event page, THE loading skeleton SHALL display immediately while the page's server data fetches resolve.

### Requirement 13: Add keepPreviousData to Leaderboard Time Period Switches

**User Story:** As a user switching between leaderboard time periods (ALL, WEEK, DAY), I want to continue seeing the previous period's data while the new period loads, so that the UI does not flash to a loading state.

#### Acceptance Criteria

1. THE Leaderboard time period query SHALL use `placeholderData: keepPreviousData` so that switching periods shows the previous result until the new data arrives.
2. WHEN a user switches from one time period to another, THE Leaderboard component SHALL NOT show a loading spinner or empty state while the new data fetches.

### Requirement 14: Extend select Usage for Expensive Query Transformations

**User Story:** As a developer, I want expensive data transformations (filtering, deduplication, sorting) to be memoized by React Query's `select` option rather than `useMemo`, so that components only re-render when the transformed result actually changes.

#### Acceptance Criteria

1. WHEN a component applies `useMemo` to transform data from a `useQuery` result (e.g., in `events-discovery.tsx` and `position-table.tsx`), THE transformation SHALL be moved into the query's `select` option with a stable function reference.
2. THE `select` function SHALL be defined outside the component or memoized to maintain referential stability across renders.
3. WHEN the raw query data changes but the `select` output is structurally identical, THE component SHALL NOT re-render (React Query memoizes `select` output via structural sharing).

### Requirement 15: Add Longer staleTime for Stable Data Domains

**User Story:** As a user navigating between pages, I want stable data (profile, leaderboard, tags, categories) to be served from the client cache for longer periods, so that navigation feels instant and background refetches are reduced.

#### Acceptance Criteria

1. THE profile data queries SHALL use a `staleTime` of 300000 milliseconds (5 minutes) or greater.
2. THE leaderboard data queries SHALL use a `staleTime` of 300000 milliseconds (5 minutes) or greater.
3. THE tags and categories queries SHALL use a `staleTime` of 300000 milliseconds (5 minutes) or greater.
4. THE application SHALL define named staleTime constants (e.g., `STALE_REALTIME: 10_000`, `STALE_DEFAULT: 30_000`, `STALE_STABLE: 300_000`, `STALE_STATIC: 1_800_000`) for consistent usage across query definitions.

### Requirement 16: Add LRU Cache for Hot Server Data

**User Story:** As a user, I want concurrent requests for the same market or event data to be served from an in-memory cache on the web server, so that redundant HTTP round trips to the Hono API are eliminated.

#### Acceptance Criteria

1. THE web server SHALL maintain an LRU_Cache for market data with a maximum of 200 entries and a TTL of 30 seconds.
2. THE web server SHALL maintain an LRU_Cache for event data with a maximum of 200 entries and a TTL of 60 seconds.
3. WHEN two concurrent requests fetch the same market by slug, THE second request SHALL receive the cached result from the LRU_Cache instead of making a separate HTTP request to the Hono API.
4. THE LRU_Cache SHALL be complementary to `React.cache()` (which deduplicates within a single request) and `"use cache"` (which caches across requests at the framework level).

### Requirement 17: Wrap Sort and Filter State Updates in startTransition

**User Story:** As a user sorting or filtering large tables, I want the UI to remain responsive (clicks register immediately) while the expensive re-render of the table happens in the background.

#### Acceptance Criteria

1. THE Explore_Page table sort handler SHALL wrap the sort state update in `startTransition` so the click is processed immediately and the re-render is non-urgent.
2. THE Explore_Page column visibility toggle handlers SHALL wrap state updates in `startTransition`.
3. THE Portfolio tab switching handler SHALL wrap the tab state update in `startTransition`.
4. THE Leaderboard sorting handler SHALL wrap the sort state update in `startTransition`.
5. WHEN a user clicks a sort header on a table with 50 or more rows, THE UI SHALL remain interactive (no input delay) while the table re-renders.

### Requirement 18: Audit Server Routers for Sequential Await Waterfalls

**User Story:** As a developer, I want server-side tRPC router procedures to fetch independent data in parallel rather than sequentially, so that API response times are minimized.

#### Acceptance Criteria

1. THE server routers (`apps/server/src/routers/`) SHALL be audited for sequential `await` statements where the second await does not depend on the result of the first.
2. WHEN two or more independent data fetches are found in sequence within a single procedure, THE procedure SHALL use `Promise.all()` or `Promise.allSettled()` to execute them in parallel.
3. WHEN an `await` fetches data that is only used in one conditional branch, THE `await` SHALL be deferred into that branch rather than executed eagerly at the top of the procedure.

### Requirement 19: Server Prefetch Trading Page Data

**User Story:** As a user landing on a market trading page, I want the orderbook seed state and my open orders to be present in the initial HTML, so that I can start trading without waiting for client-side fetches.

#### Acceptance Criteria

1. THE Market_Page Server Component SHALL prefetch the orderbook seed data using the Server_QueryClient before rendering.
2. WHEN a user is logged in (session token available in cookies), THE Market_Page Server Component SHALL prefetch the user's open orders for that market.
3. THE Market_Page SHALL wrap trading panel client components in a `<HydrationBoundary>` so prefetched data is available to the client QueryClient without re-fetching.

### Requirement 20: Extract usePathname from AppShell into a Small Client Component

**User Story:** As a developer, I want the layout shell (header, sidebar, navigation) to be a Server Component so that its HTML is included in the PPR static shell, reducing client-side JavaScript.

#### Acceptance Criteria

1. THE AppShell component SHALL be refactored into a Server Component that renders the layout structure (header, sidebar, main content area).
2. THE routing-dependent logic (currently using `usePathname()`) SHALL be extracted into a small dedicated client component (e.g., `<NavigationClient />`).
3. WHEN the AppShell is a Server Component, THE layout chrome (header, navigation, sidebar) SHALL be included in the PPR static shell and sent as prerendered HTML.

### Requirement 21: Extend React.cache() to All Multi-Call Server Data Fetches

**User Story:** As a developer, I want `generateMetadata` and the page component to share the same server data fetch result within a single request, so that the same API call is not made twice per page render.

#### Acceptance Criteria

1. THE Event_Page SHALL wrap its `serverTrpc.events.getBySlug.query()` call with `React.cache()` so that `generateMetadata` and the page component share the same result (matching the pattern already used on the Market_Page).
2. WHEN `generateMetadata` and a page component both call the same cached function with the same arguments, THE server SHALL execute the underlying fetch only once per request.
3. THE application SHALL apply `React.cache()` to all server data fetch functions that are called from both `generateMetadata` and the page component.

### Requirement 22: Correct params Awaiting in Dynamic Routes for PPR

**User Story:** As a developer, I want dynamic route params to be handled in a PPR-compatible way so that the page's static shell can prerender without being blocked by params resolution.

#### Acceptance Criteria

1. THE dynamic route pages SHALL NOT `await` the `params` promise at the top level of the page component before any `<Suspense>` boundary, as this blocks the entire page render.
2. WHEN a page needs params for a cached component, THE page SHALL pass the params promise to a child component wrapped in `<Suspense>`, letting the child resolve params inside the Suspense boundary.
3. WHEN params are awaited inside a `<Suspense>` boundary, THE static shell above that boundary SHALL prerender and be sent immediately.

### Requirement 23: Use Activity Component for Trading Panel Tabs

**User Story:** As a user switching between trading panel tabs (orderbook, chart, positions), I want the previously viewed tab's DOM and state to be preserved, so that switching back is instant and does not re-mount expensive components.

#### Acceptance Criteria

1. THE trading panel tab system SHALL use the Activity_Component (`<Activity mode={active ? 'visible' : 'hidden'}>`) to wrap each tab's content.
2. WHEN a user switches from the orderbook tab to the chart tab, THE orderbook component's DOM and React state SHALL be preserved (not unmounted).
3. WHEN a user switches back to a previously viewed tab, THE tab content SHALL appear instantly without re-mounting or re-fetching data.

### Requirement 24: Add generateStaticParams for Top Markets and Events

**User Story:** As a user visiting a popular market or event, I want the page to be served from the CDN on the first hit rather than requiring a server render, so that load time is minimal.

#### Acceptance Criteria

1. THE Market_Page SHALL export a `generateStaticParams` function that returns the slugs of the top 50 most-traded markets.
2. THE Event_Page SHALL export a `generateStaticParams` function that returns the slugs of the top 50 most-active events.
3. WHEN a user requests a statically generated market or event page, THE CDN SHALL serve the prebuilt HTML without invoking a serverless function.
4. WHEN a user requests a market or event not in the static params list, THE page SHALL fall back to dynamic server rendering (on-demand ISR).

### Requirement 25: Implement Streaming on Market Detail Page

**User Story:** As a user loading a market trading page, I want to see the market header immediately while the trading panel and chart stream in progressively, so that I can read market information while heavier components load.

#### Acceptance Criteria

1. THE Market_Page SHALL render the market header (title, price, volume, metadata) immediately as part of the initial HTML response.
2. THE Market_Page SHALL wrap the trading panel (orderbook, order form, positions) in a `<Suspense>` boundary with a trading skeleton fallback, so it streams in after the header.
3. THE Market_Page SHALL wrap the chart section in a separate `<Suspense>` boundary with a chart skeleton fallback, so it streams in independently.
4. WHEN the market header data resolves in 50ms but the orderbook takes 200ms and the chart takes 500ms, THE user SHALL see the header at 50ms, the orderbook at 200ms, and the chart at 500ms — not all at 500ms.

### Requirement 26: Evaluate Direct tRPC Caller for Server-Side Calls

**User Story:** As a developer, I want to understand whether replacing the HTTP-based `serverTrpc` with a direct tRPC caller would reduce latency for server-side data fetches.

#### Acceptance Criteria

1. THE team SHALL evaluate whether the Next.js server and Hono server are co-located (same Vercel deployment) or separate deployments.
2. IF the servers are co-located, THEN THE team SHALL implement a direct tRPC caller using the `caller` API to eliminate the HTTP round trip between Next.js and Hono.
3. IF the servers are separate deployments, THEN THE current `httpBatchLink`-based `serverTrpc` approach SHALL be retained as the network hop is unavoidable.

### Requirement 27: Enable Production Browser Source Maps for Datadog RUM

**User Story:** As a developer monitoring production errors, I want Datadog RUM to display unminified stack traces, so that I can quickly identify the source of runtime errors.

#### Acceptance Criteria

1. THE Next_Config SHALL set `productionBrowserSourceMaps: true`.
2. WHEN a production build completes, THE build process SHALL upload source maps to Datadog using the `pnpm sourcemaps:upload` command.
3. WHEN a runtime error occurs in production, THE Datadog RUM dashboard SHALL display the original source file, line number, and function name instead of minified references.

### Requirement 28: Add Server Actions for Non-Trading Mutations

**User Story:** As a user updating my profile or settings, I want the change to be reflected immediately on the page without a full client-side refetch cycle, so that the experience feels instant.

#### Acceptance Criteria

1. THE application SHALL implement Server Actions (`"use server"` functions) for profile update mutations.
2. THE application SHALL implement Server Actions for user settings and preferences mutations.
3. WHEN a Server_Action completes a profile update, THE action SHALL call `updateTag('user-profile')` to immediately expire the cached profile data (read-your-own-writes).
4. THE trading mutations (order placement, cancellation) SHALL continue using the existing tRPC client mutation pattern with `invalidatePostTradeQueriesWithRetry`, as the retry-based invalidation handles Polymarket's Data API indexing lag.

### Requirement 29: Add Client-Side Router Cache staleTimes Configuration

**User Story:** As a user navigating back to a previously visited market or event page, I want the page to appear instantly from the client-side router cache for a short period, so that back-navigation feels seamless.

#### Acceptance Criteria

1. THE Next_Config `experimental` section SHALL include `staleTimes: { dynamic: 30 }`.
2. WHEN a user navigates away from a dynamic page and returns within 30 seconds (e.g., `/market/btc` → `/explore` → `/market/btc`), THE client-side router SHALL serve the cached RSC payload without a server round trip.
3. THE `staleTimes` configuration SHALL NOT affect static pages (which already have their own cache behavior).

### Requirement 30: Add server-only Import Guard to trpc-server.ts

**User Story:** As a developer, I want a build-time error if the server-only tRPC client is accidentally imported in a client component, so that server credentials are never exposed to the browser.

#### Acceptance Criteria

1. THE `src/lib/trpc-server.ts` file SHALL import `'server-only'` at the top of the file.
2. WHEN a `"use client"` module attempts to import from `trpc-server.ts`, THE build process SHALL fail with a clear error message indicating that a server-only module was imported in a client component.

### Requirement 31: Add Consistent Error Handling to serverTrpc Calls in RSC Pages

**User Story:** As a user, I want to see a recoverable error state instead of a crashed page when the API server is unavailable, so that I can retry or navigate elsewhere.

#### Acceptance Criteria

1. WHEN a `serverTrpc` call fails in a Server Component page, THE page SHALL catch the error and render a user-friendly error state with a retry option.
2. THE error handling pattern SHALL be consistent across all RSC pages that use `serverTrpc` (market, event, explore, leaderboard).
3. IF the Hono API server is unreachable, THEN THE error state SHALL display a message indicating temporary unavailability and offer a retry action.
4. WHEN `serverTrpc` throws in a page's `generateMetadata`, THE page SHALL fall back to generic metadata instead of crashing.
5. THE error handling pattern SHALL be extracted into a reusable utility (e.g., a `withServerError` wrapper or try/catch template) applied consistently across all RSC pages using `serverTrpc`.

### Requirement 32: Add localStorage Cache Layer

**User Story:** As a developer, I want redundant synchronous `localStorage.getItem` calls to be eliminated via a module-level cache, so that main thread blocking from synchronous I/O is minimized.

#### Acceptance Criteria

1. THE application SHALL provide a `getCachedStorage(key: string)` utility that caches `localStorage.getItem` results in a module-level `Map`.
2. WHEN `getCachedStorage` is called with a key that has already been read, THE utility SHALL return the cached value without calling `localStorage.getItem` again.
3. THE 11 uncached `localStorage.getItem` calls across 7 files (workspace layout, watchlist utils, notifications bell, instant trade popup, deposit notification card, market sell shared) SHALL be migrated to use the cached utility.

### Requirement 33: Evaluate useSuspenseQuery for Prefetched Pages

**User Story:** As a user visiting a page with server-prefetched data, I want the component to render with data immediately without any brief loading flash, so that the transition from server HTML to client hydration is seamless.

#### Acceptance Criteria

1. THE team SHALL evaluate replacing `useQuery` with `useSuspenseQuery` on pages that have guaranteed server prefetch (explore, market, event after prefetch is added).
2. WHEN `useSuspenseQuery` is used on a prefetched page, THE component SHALL render with data immediately — no `isPending` state, no loading flash.
3. WHEN multiple `useSuspenseQuery` calls exist in the same component, THE component SHALL use `useSuspenseQueries` to execute them in parallel rather than serially.
4. THE `useQuery` pattern SHALL be retained for conditionally-fetched queries (e.g., queries with `enabled: Boolean(address)`) and user-triggered queries.

### Requirement 34: Add staleTime Constants for Common Data Domains

**User Story:** As a developer, I want a centralized set of named staleTime constants so that query freshness is consistent across the codebase and easy to tune.

#### Acceptance Criteria

1. THE application SHALL define the following named constants in a shared query configuration module: `STALE_REALTIME` (10,000–15,000ms), `STALE_DEFAULT` (30,000ms), `STALE_STABLE` (300,000ms), `STALE_STATIC` (1,800,000ms).
2. THE existing `QUERY_STALE_5MIN_MS` constant SHALL be consolidated with the new `STALE_STABLE` constant.
3. WHEN a new query is added to the codebase, THE developer SHALL select from the named constants rather than using an ad-hoc numeric value.

### Requirement 35: Add Optimistic Updates to Wallet Tracker Mutations

**User Story:** As a user adding or removing a tracked wallet, I want the change to appear instantly in the UI before the server confirms it, so that the interaction feels responsive.

#### Acceptance Criteria

1. THE wallet tracker add mutation SHALL implement the optimistic update pattern (`onMutate` → cancel queries → snapshot → optimistic set → return rollback context).
2. THE wallet tracker remove mutation SHALL implement the optimistic update pattern.
3. IF the mutation fails, THEN THE wallet tracker SHALL roll back to the snapshot state from `onMutate` and display an error toast.
4. WHEN the mutation settles (success or failure), THE wallet tracker SHALL refetch the tracked wallets query to ensure server/client consistency.

### Requirement 36: Fix Event Page Double-Fetch with React.cache() Deduplication

**User Story:** As a developer, I want the event page to make only one API call for event data per request, not two (one in `generateMetadata` and one in the page component), so that server response time is halved for that data.

#### Acceptance Criteria

1. THE Event_Page SHALL wrap the `serverTrpc.events.getBySlug.query()` call with `React.cache()` so that `generateMetadata` and the page component share the same result within a single request.
2. WHEN both `generateMetadata` and the page component call the cached function with the same slug, THE server SHALL execute the underlying HTTP request to Hono only once.
3. THE Event_Page SHALL follow the same deduplication pattern already used on the Market_Page (`getMarketBySlug` wrapped in `cache()`).

### Requirement 37: Dynamic Import Analytics and SpeedInsights in Root Layout

**User Story:** As a developer, I want third-party analytics scripts to be excluded from the initial JavaScript bundle, so that the main bundle is smaller and loads faster.

#### Acceptance Criteria

1. THE Root_Layout SHALL import `Analytics` from `@vercel/analytics/react` using `next/dynamic` with `{ ssr: false }` instead of a static top-level import.
2. THE Root_Layout SHALL import `SpeedInsights` from `@vercel/speed-insights/next` using `next/dynamic` with `{ ssr: false }` instead of a static top-level import.
3. WHEN the application loads in production, THE Analytics and SpeedInsights components SHALL be loaded asynchronously after the initial page render, not blocking the main bundle.

### Requirement 38: Replace useEffect with suppressHydrationWarning in RelativeTime Component

**User Story:** As a developer, I want the `RelativeTime` component to render its time label on the first render without a flash of empty content, so that the user sees the relative time immediately.

#### Acceptance Criteria

1. THE `RelativeTime` component in `trade-utils.tsx` SHALL render `formatTimeAgo(ts)` directly in the JSX with `suppressHydrationWarning` on the containing element, instead of using `useState` + `useEffect` to set the label after mount.
2. WHEN the component renders on the server and client, THE `suppressHydrationWarning` attribute SHALL suppress the expected mismatch from `Date.now()` differences without triggering a React hydration error.
3. THE `RelativeTime` component SHALL NOT render an empty string on the first client render followed by the actual label on the second render.

### Requirement 39: Replace State+Effect with Ref for Sticky Data Pattern

**User Story:** As a developer, I want components that keep the previous value when current data becomes undefined to use a ref instead of state+effect, so that there is no extra render cycle or effect overhead.

#### Acceptance Criteria

1. THE `trading-selector-card.tsx` component SHALL replace its `useState` + `useEffect` + `queueMicrotask` pattern for sticky event data with a `useRef` that updates synchronously when new data arrives.
2. THE `market-header-trading.tsx` component SHALL replace its equivalent state+effect sticky pattern with a `useRef`.
3. WHEN the current data becomes `undefined`, THE component SHALL use the ref's previous value without triggering a re-render or scheduling a microtask.

### Requirement 40: Trim Event Object Serialization Across RSC Boundary

**User Story:** As a developer, I want only the fields actually used by client components to be serialized across the RSC boundary, so that the HTML payload is smaller and parsing is faster.

#### Acceptance Criteria

1. THE Event_Page SHALL audit which fields of the `event` object are actually read by `EventPageComposition` and its children.
2. THE Event_Page SHALL pass only the required fields to client components instead of the full event object (which may contain 40-60 fields from the Polymarket API).
3. WHEN the event object is serialized into the RSC payload, THE serialized size SHALL be reduced to only the fields consumed by the client component tree.
