# Performance & Architecture Audit

> Generated 2026-04-05 from skills audit (next-cache-components, vercel-react-best-practices, react-component-performance)

## Summary

| Category | Status | Details |
|----------|--------|---------|
| PPR / `use cache` | ✅ Good | Properly used in query-client.ts, server-cache.ts |
| `connection()` before QueryClient | ✅ Good | Leaderboard page correct |
| `server-only` guards | ✅ Good | All server files guarded |
| React.lazy / dynamic imports | ✅ Good | 7 components lazy-loaded |
| Missing `loading.tsx` | ⚠️ 6 routes | CLS risk on navigation |
| Large client components | ⚠️ 10 files >400 lines | Bundle bloat |
| Effect-heavy components | ⚠️ 10 files | Potential derived state anti-patterns |
| Sequential awaits | ⚠️ Market page | 7 awaits, no Suspense |

---

## ✅ What's Working Well

### Caching
- `"use cache"` + `cacheLife` + `cacheTag` used in `lib/trpc/query-client.ts` and `lib/server-cache.ts`
- `getCachedMarketBySlug`, `getCachedEventBySlug`, `getCachedLeaderboard`, `getCachedEventsList` all use proper cache profiles
- `cacheTag("market", slug)` enables targeted invalidation

### PPR Compliance
- Leaderboard page correctly calls `await connection()` before `getQueryClient()` (required for `Date.now()` in PPR)
- No `Date.now()` violations in server components
- Market page uses `"use cache"` functions so PPR treats fetches as static

### Server Boundaries
- `server-only` guard on: `trpc-server.ts`, `server-cache.ts`, `server-utils.ts`, `config/app.ts`, `trpc/server.ts`
- No accidental server code in client bundles

### Lazy Loading
- `React.lazy`: positions-tab, onboarding steps, bridge modal, profile modal, redeem tab, wallet-tracker widget
- `next/dynamic`: KLineChart (ssr: false), analytics scripts, live-price-chart
- Modal providers lazy-load heavy content (BridgePage, onboarding steps)
- Magic SDK WalletKitExtension dynamically imported
- Datadog RUM/Logs deferred to `requestIdleCallback`

---

## ⚠️ Issues Found

### 1. Missing `loading.tsx` — 6 routes

Routes without loading skeletons show no visual feedback during navigation, causing CLS.

| Route | Impact | Priority |
|-------|--------|----------|
| `/market/[slug]` | **High** — most visited route | P0 |
| `/referrals` | Medium | P1 |
| `/watchlist` | Medium | P1 |
| `/wallet-tracker` | Medium | P1 |
| `/login` | Low — fast page | P2 |
| `/login/callback` | Low — redirect page | P2 |

**Fix:** Add `loading.tsx` files matching the actual rendered layout dimensions.

### 2. Market page — 7 sequential awaits, no Suspense

`apps/web/src/app/(trading)/market/[slug]/page.tsx` awaits all data before rendering. The `"use cache"` functions make this fast, but the page has no `<Suspense>` boundary — the entire page blocks on the slowest fetch.

**Current:** Page awaits `getMarketOrRedirect` (which awaits `getCachedMarketBySlug`) before rendering `MarketPageComposition`.

**Mitigating factor:** `MarketPageComposition` wraps `TradingLayout` in `<Suspense>` internally, so sub-components stream. The top-level await is needed for redirect logic and metadata.

**Recommendation:** Low priority — architecture is correct. The `"use cache"` layer makes the await fast (~5ms cache hit).

### 3. Large client components — 10 files over 400 lines

These pull their entire dependency tree into the client bundle:

| File | Lines | Concern |
|------|-------|---------|
| `leaderboard-profile-modal.tsx` | 1,199 | Largest client component. Should split modal content from trigger. |
| `instant-trade-popup.tsx` | 785 | Complex trading UI. Consider extracting sub-components. |
| `positions-tab.tsx` | 593 | Already has useReducer. Acceptable complexity for data table. |
| `quick-sell-modal.tsx` | 502 | Modal with form logic. Could lazy-load. |
| `profile-hover-card.tsx` | 494 | Hover card with data fetching. |
| `market-header-trading.tsx` | 489 | Header with many conditional renders. |
| `trades-tab.tsx` | 477 | Data table. Acceptable. |
| `referrals-page.tsx` | 448 | Mixed concerns (query + mutation + UI). |
| `market-trading-context.tsx` | 425 | Context provider with complex state. |
| `wallet-setup-step.tsx` | 401 | Onboarding step with 4 effects, 22 setState. |

**Recommendation:** Split `leaderboard-profile-modal.tsx` (P1) and `instant-trade-popup.tsx` (P2). Others are acceptable.

### 4. Effect-heavy components — potential anti-patterns

Components with many `useEffect` + `setState` calls may be syncing derived state instead of computing it:

| File | Effects | setState calls | Concern |
|------|---------|---------------|---------|
| `order-form-ui.tsx` | 5 | **94** | Very likely has derived state synced via effects |
| `polymarket-kline-chart-inner.tsx` | 9 | 42 | Chart lifecycle — may be unavoidable |
| `wallet-tracker-content.tsx` | 4 | 33 | Could benefit from useReducer |
| `explore-columns-menu.tsx` | 4 | 24 | Column visibility state |
| `wallet-setup-step.tsx` | 4 | 22 | Onboarding flow |
| `calendar-widget.tsx` | 4 | 18 | Date/view state |
| `withdraw-notification-card.tsx` | 6 | 12 | Notification lifecycle |
| `events-discovery.tsx` | 7 | 9 | Filter/sort state (already uses startTransition) |

**Recommendation:** Audit `order-form-ui.tsx` (P1) — 94 setState calls is a red flag. Many are likely computable from other state without effects.

---

## Completed Optimizations (this session)

### Bundle Size
- [x] Lazy-load BridgePage, onboarding steps, Magic SDK WalletKitExtension
- [x] Defer Datadog RUM/Logs (~539KB) to `requestIdleCallback`
- [x] Remove unused deps: recharts, embla-carousel-react, @tanstack/react-virtual
- [x] Add `@base-ui/react`, `@tanstack/react-query` to `optimizePackageImports`
- [x] Canonicalize 65 files of Tailwind CSS v4 classes

### Network
- [x] Preconnect to 6 API origins (Gamma, CLOB, Data, Goldsky, Magic, RPC)
- [x] DNS-prefetch for 4 origins (WebSockets, image CDNs)
- [x] Gzip compression on Hono server (`hono/compress`)
- [x] Deduplicate `auth.me` calls (queryClient.fetchQuery instead of imperative)

### Data Fetching
- [x] Subgraph-first with Data API fallback (`withSubgraphFallback`)
- [x] Chart volume from subgraph (1 request vs 5 paginated)
- [x] Positions from PNL subgraph (eliminates 500-trade cost basis walk)
- [x] Remove shadow read infrastructure (replaced by fallback pattern)

### Rendering
- [x] `startTransition` for 4 explore filter handlers
- [x] WebSocket subscription LRU eviction (instead of silent drop)
- [x] `content-visibility: auto` already on orderbook + events table rows
- [x] `priority={true}` already on first 6 events table images + market header
- [x] `<Activity>` already used for MarketTabs (Positions/Orders/History/Trades)

### Code Quality
- [x] 82.5 desloppify strict score (from 74.4)
- [x] 96/100 react-doctor score
- [x] 0 Biome lint errors
- [x] All types pass (`pnpm check-types`)
- [x] 66/71 tests pass (5 pre-existing failures)

---

## Bundle Composition (Turbopack analyzer)

| Chunk | Size | Contents | Actionable? |
|-------|------|----------|-------------|
| ethers.js v5 | 1.1MB | Full Ethereum lib (Polymarket SDK dep) | No — SDK dependency |
| Next.js polyfills | 719K | crypto/stream/vm browserify | No — framework internals |
| Magic SDK | 680K | Auth library | No — needed for auth |
| Datadog | 539K | RUM + Logs | ✅ Done — deferred to idle |
| viem | 530K | Ethereum lib | Maybe — lazy-load for non-trading |
| KLineChart | 324K + 233K | Chart library | Already route-split |

**Total JS chunks:** 60MB across 205 chunks (before gzip)
**Distribution:** 1 chunk >1MB, 5 chunks 500K-1MB, 26 chunks 100K-500K, 173 chunks <100K

---

## Next Steps (prioritized)

1. **Add `loading.tsx` for `/market/[slug]`** — most visited route, biggest CLS win
2. **Audit `order-form-ui.tsx`** — 94 setState calls, likely derived state anti-pattern
3. **Split `leaderboard-profile-modal.tsx`** — 1,199 lines, lazy-load modal content
4. **Add `loading.tsx` for `/referrals`, `/watchlist`, `/wallet-tracker`**
5. **Investigate viem lazy-loading** — 530K that only trading pages need

---

## Suspense & Transition Audit

> Audited against React `<Suspense>` docs patterns (startTransition, useTransition, useDeferredValue, key resets)

### Current Usage

| Pattern | Count | Status |
|---------|-------|--------|
| `<Suspense>` boundaries | 27 | ✅ Good coverage |
| `startTransition` calls | 13 | ✅ Used in explore filters |
| `useTransition` (with `isPending`) | 0 | ⚠️ Never used |
| `useDeferredValue` | 1 | ✅ Used appropriately |
| `<Suspense key={id}>` resets | 0 | ⚠️ Missing |
| `fallback={null}` (invisible loading) | 10 | ⚠️ Some should have skeletons |

### Issue 1: `router.push` without `startTransition` — 10 instances

Per React docs, imperative navigation that causes Suspense should be wrapped in `startTransition` to prevent the closest Suspense boundary from replacing visible content with a fallback. Next.js `<Link>` does this automatically, but `router.push` does not.

**Affected files:**
| File | Navigation | Impact |
|------|-----------|--------|
| `crypto-timeslot-bar.tsx:338` | `router.push(/market/${slug})` | **High** — market page has Suspense, will flash fallback |
| `activity-widget-content.tsx:253,257` | `router.push(href)` | Medium — navigates to various pages |
| `auth-button.tsx:19,35,37` | `router.push(/login)`, `router.push(/profile/...)` | Low — auth redirects |
| `wallet-kit-login.tsx:73,79` | `router.push(/explore)` | Low — post-login redirect |
| `login-callback-page.tsx:188,232` | `router.push(/login)` | Low — error recovery |

**Fix:** Wrap each `router.push` in `startTransition(() => { ... })`.

### Issue 2: No `key` prop on Suspense for different content

The React docs recommend `<Suspense key={id}>` when navigating between different entities (e.g., different user profiles, different markets). Without it, React reuses the Suspense boundary and may briefly show stale content from the previous entity.

**Where it matters:**
- Market page: navigating between `/market/foo` and `/market/bar` should reset Suspense boundaries
- Event page: navigating between `/event/foo` and `/event/bar`
- Next.js App Router handles this via route segments, but any client-side Suspense boundaries inside the page don't reset automatically

**Current mitigation:** `key={conditionId}` is used on the chart component, but not on Suspense boundaries themselves.

### Issue 3: `useTransition` never used

`startTransition` is used 13 times but always the standalone import — never `useTransition`. The difference: `useTransition` returns `[isPending, startTransition]` where `isPending` lets you show a visual indicator (dimmed content, loading bar) while the transition is in progress.

**Where it would help:**
- Explore filter changes: currently wrapped in `startTransition` but no visual feedback that data is loading
- Market navigation from timeslot bar: user clicks and nothing visually changes until the new page loads

**Pattern from React docs:**
```tsx
const [isPending, startTransition] = useTransition();

<div style={{ opacity: isPending ? 0.7 : 1 }}>
  <Content />
</div>
```

### Issue 4: `fallback={null}` on content-bearing Suspense boundaries

10 Suspense boundaries use `fallback={null}` which shows blank space while loading. Some are appropriate (layout wrappers, color experiments), but others would benefit from skeleton fallbacks:

| File | Should have skeleton? |
|------|----------------------|
| `positions-tab.tsx:249,556` | **Yes** — position data table |
| `redeem-tab.tsx:171` | **Yes** — redeem content |
| `market-trading-context.tsx:404` | Maybe — trading context |
| `explore/page.tsx:42` | Maybe — explore content |
| `layout.tsx:61` | No — top-level wrapper, fine as null |
| `onboarding-modal-provider.tsx:108` | No — lazy-loaded steps, brief flash |
| `profile-modal-provider.tsx:86` | No — lazy-loaded modal |
| `color-experiment-switcher.tsx:40` | No — non-visual |
| `position-table.tsx:502` | No — nested lazy component |

### Recommended Actions

1. **P0: Wrap `router.push` in `startTransition`** — 10 instances, prevents jarring fallback flashes
2. **P1: Replace `useTransition` for explore filters** — adds `isPending` visual feedback
3. **P2: Add skeleton fallbacks to `positions-tab` and `redeem-tab`** Suspense boundaries
4. **P3: Add `key` prop to market/event page Suspense boundaries** for clean resets

---

## Next.js 16 Caching Audit

> Audited against Next.js 16.2 caching docs (cacheComponents, `use cache`, cacheLife, PPR, streaming)

### Configuration

| Setting | Value | Status |
|---------|-------|--------|
| `cacheComponents` | `true` | ✅ Enabled |
| `unstable_instant` | Exported on `/market/[slug]`, `/explore` | ✅ Instant client navigations |
| `connection()` | Used in leaderboard page before `getQueryClient()` | ✅ Correct PPR pattern |

### `use cache` Functions

All `"use cache"` functions are in `lib/trpc/query-client.ts`:

| Function | Cache Profile | Tags | Purpose |
|----------|--------------|------|---------|
| `getCachedMarketBySlug` | `cacheLife("minutes")` | `cacheTag("market", slug)` | Market page SSR |
| `getCachedEventBySlug` | `cacheLife("minutes")` | `cacheTag("event", slug)` | Event page SSR |
| `getCachedLeaderboard` | `cacheLife("minutes")` | — | Leaderboard SSR |
| `getCachedEventsList` | `cacheLife("minutes")` | — | Explore SSR |

**Observation:** All functions use `cacheLife("minutes")` (1h expire, 1m revalidate). Consider:
- `cacheLife("hours")` for stable data like leaderboard
- `cacheLife("days")` for event metadata that rarely changes
- Keep `"minutes"` for market data that updates frequently

### What's Missing

**1. No `use cache` on pages themselves**

Per the docs, you can add `"use cache"` at the page level for pages that don't use runtime APIs. Currently only functions are cached, not pages.

**Candidates:**
- `/explore/page.tsx` — uses `searchParams` (runtime API), so cannot use page-level cache. ✅ Correct as-is.
- `/leaderboard/page.tsx` — uses `connection()` + `getQueryClient()`, so cannot use page-level cache. ✅ Correct as-is.
- `/market/[slug]/page.tsx` — uses `"use cache"` functions internally. Page-level cache not applicable due to redirect logic. ✅ Correct as-is.

**Conclusion:** Current architecture is correct — data-level caching via `"use cache"` functions is the right approach for this app since most pages need runtime APIs or have redirect logic.

**2. Only `"minutes"` cache profile used**

All 4 cached functions use `cacheLife("minutes")`. The built-in profiles offer more granularity:

| Profile | Stale | Revalidate | Expire |
|---------|-------|------------|--------|
| `"default"` | 5m | 15m | — |
| `"minutes"` | 5m | 1m | 1h |
| `"hours"` | 5m | 1h | 1d |
| `"days"` | 5m | 1d | 1w |
| `"weeks"` | 5m | 1w | 30d |
| `"max"` | 5m | 30d | 1y |

**Recommendation:** Consider `cacheLife("hours")` for `getCachedLeaderboard` and `getCachedEventsList` since leaderboard rankings and event lists don't change every minute.

**3. `unstable_instant` only on 2 routes**

Only `/market/[slug]` and `/explore` export `unstable_instant` for instant client-side navigation. Other routes that would benefit:

| Route | Has `unstable_instant`? | Should have? |
|-------|------------------------|-------------|
| `/market/[slug]` | ✅ Yes | — |
| `/explore` | ✅ Yes | — |
| `/leaderboard` | ❌ No | **Yes** — has cached data |
| `/portfolio` | ❌ No | Maybe — user-specific |
| `/bridge` | ❌ No | Maybe — mostly static UI |
| `/watchlist` | ❌ No | Maybe — user-specific |

**4. No `cacheTag` invalidation via `updateTag`**

Tags are set (`cacheTag("market", slug)`, `cacheTag("event", slug)`) but no server actions call `updateTag()` to invalidate them. This means cache only expires via `cacheLife` timer, never on-demand.

**Where `updateTag` would help:**
- After a trade is placed → `updateTag("market", slug)` to refresh market data
- After onboarding completes → `updateTag("event", slug)` if event data changed
- Currently not critical since `cacheLife("minutes")` revalidates every minute

### Summary

The caching architecture is well-implemented. The `"use cache"` functions with `cacheLife("minutes")` provide a good balance of freshness and performance. The main opportunities are:

1. **P2:** Differentiate cache profiles — `"hours"` for leaderboard/events, keep `"minutes"` for markets
2. **P2:** Add `unstable_instant` to `/leaderboard` for instant navigation
3. **P3:** Add `updateTag` calls in server actions for immediate cache invalidation after mutations

---

## Revalidation Audit

> Audited against Next.js 16.2 revalidation docs (revalidateTag, updateTag, revalidatePath, cacheTag)

### Current State

| API | Documented? | Actually Called? |
|-----|------------|-----------------|
| `cacheTag()` | ✅ Tags set on all 4 cached functions | ✅ Working |
| `revalidateTag()` | ✅ Documented in query-client.ts comments | ❌ **Never called** |
| `updateTag()` | ✅ Documented in query-client.ts comments | ❌ **Never called** |
| `revalidatePath()` | — | ❌ Never called |

### The Gap

Your `query-client.ts` has excellent documentation explaining when to use `revalidateTag` vs `updateTag`, with a full decision matrix and per-function tag reference. But **none of these are actually wired up** — the cache only expires via `cacheLife("minutes")` timer.

The server actions in `app/actions/user.ts` have TODO comments for `updateTag("user-profile")` but the mutations aren't implemented yet.

### Where Revalidation Would Help

| Trigger | Tag to invalidate | API | Impact |
|---------|-------------------|-----|--------|
| After trade placed | `updateTag("market", slug)` | Server Action | User sees updated position immediately |
| After order cancelled | `updateTag("market", slug)` | Server Action | Order disappears from open orders |
| After onboarding completes | `updateTag("user-profile")` | Server Action | Profile data refreshes |
| Webhook: market resolved | `revalidateTag("market", "max")` | Route Handler | All users see resolution |
| Webhook: new event created | `revalidateTag("event", "max")` | Route Handler | Explore page shows new event |
| Admin: feature flag change | `revalidatePath("/explore")` | Route Handler | Explore page refreshes |

### Why It's Not Critical Yet

Trading mutations use the existing tRPC client pattern with `invalidatePostTradeQueriesWithRetry` — this invalidates the React Query cache on the client side, which is what the user actually sees. The `"use cache"` layer is only for SSR/PPR, so stale server cache doesn't affect the trading experience.

The `cacheLife("minutes")` timer means server-cached data is at most 1 minute stale, which is acceptable for:
- Market pages (orderbook/prices are client-fetched anyway)
- Explore page (event list refreshes every minute)
- Leaderboard (rankings don't change by the second)

### When to Implement

Revalidation becomes important when:
1. You add server actions for trading (currently all client-side)
2. You add webhooks for market resolution events
3. You want instant cache refresh after admin actions
4. Users report seeing stale data after mutations

### Recommended Actions

1. **P3:** Wire `updateTag("market", slug)` after trade placement for read-your-own-writes on market pages
2. **P3:** Add a `/api/revalidate` Route Handler for webhook-triggered `revalidateTag` calls
3. **P4:** Complete the `updateProfile` / `updateUserSettings` server actions with `updateTag("user-profile")`

---

## Prefetching Audit

> Audited against Next.js 16.2 prefetching docs (automatic, manual, hover-triggered, disabled)

### Current State

| Pattern | Count | Notes |
|---------|-------|-------|
| `prefetch={false}` | 10+ links | Events table, event cards, watchlist |
| Default prefetch (viewport) | 2 links | Only nav links |
| Hover-triggered prefetch | 0 | Not implemented |
| `router.prefetch()` manual | 0 | Not used |
| `loading.tsx` files | 5 | explore, leaderboard, portfolio, bridge, root |

### Analysis

**Almost all market/event links disable prefetching.** The events table (50+ rows), event cards, and watchlist all use `prefetch={false}`. This is the correct choice per the docs for large lists — prefetching 50+ routes on viewport entry would waste bandwidth.

**However, no hover-triggered prefetch exists.** The docs recommend a middle ground for large lists: disable viewport prefetch but enable on hover. This would pre-warm the market page when a user shows intent, making the click feel instant.

**`loading.tsx` affects prefetch behavior.** Routes with `loading.tsx` get partial prefetching (layout to first loading boundary). The 6 routes missing `loading.tsx` get no prefetch at all for dynamic content.

### Prefetch behavior per route

| Route | `loading.tsx` | `unstable_instant` | Prefetch behavior |
|-------|--------------|-------------------|-------------------|
| `/explore` | ✅ | ✅ | Partial prefetch + instant navigation |
| `/market/[slug]` | ❌ | ✅ | No prefetch (links use `prefetch={false}`) + instant shell |
| `/leaderboard` | ✅ | ❌ | Partial prefetch |
| `/portfolio` | ✅ | ❌ | Partial prefetch |
| `/bridge` | ✅ | ❌ | Partial prefetch |
| `/watchlist` | ❌ | ❌ | No prefetch, no instant |
| `/wallet-tracker` | ❌ | ❌ | No prefetch, no instant |
| `/referrals` | ❌ | ❌ | No prefetch, no instant |
| `/login` | ❌ | ❌ | No prefetch, no instant |

### Why it's acceptable today

The `"use cache"` layer with `cacheLife("minutes")` means market page data is served from cache in ~5ms. Combined with `unstable_instant` on `/market/[slug]`, the static shell is served from edge instantly. The dynamic content streams in after. So even without prefetching, market page navigations feel fast.

### Recommended Actions

1. **P1: Add `loading.tsx` for `/market/[slug]`** — enables partial prefetching for the most visited route and provides a skeleton during navigation
2. **P2: Add `loading.tsx` for `/watchlist`, `/wallet-tracker`, `/referrals`** — enables partial prefetching
3. **P2: Add `unstable_instant` to `/leaderboard`** — cached data makes this a good candidate for instant navigation
4. **P3: Hover-triggered prefetch for events table** — use the `HoverPrefetchLink` pattern from the docs for market links in the events table. Would pre-warm the top hovered markets without prefetching all 50+.

```tsx
// Pattern from Next.js docs — could apply to events table market links
<Link
  href={marketUrl}
  prefetch={active ? null : false}
  onMouseEnter={() => setActive(true)}
>
```

---

## Production Checklist Audit

> Audited against Next.js 16.2 production checklist

### ✅ Passing

| Category | Item | Status |
|----------|------|--------|
| Routing | Layouts | 9 layout files |
| Routing | Error handling | 6 error pages + `global-error.tsx` |
| Routing | `<Link>` component | Used throughout (no raw `<a>` for internal nav) |
| Data | Server Components | Default for all pages |
| Data | Streaming / `loading.tsx` | 5 routes have loading states |
| Data | Caching | `"use cache"` + `cacheLife` on 4 functions |
| Security | `server-only` guards | 5 server files guarded |
| Security | CSP headers | Configured in next.config.ts |
| Security | `.env` in `.gitignore` | Yes |
| Security | `NEXT_PUBLIC_` prefix | Properly used for client vars |
| Fonts | `next/font` | Inter font optimized |
| Images | `<Image>` component | `ImageWithFallback` wraps Next Image |
| Scripts | `<Script>` component | Used for boot script |
| Types | TypeScript | Full coverage, `pnpm check-types` passes |
| SEO | Sitemap | `sitemap.ts` exists |
| SEO | Robots | `robots.ts` exists |

### ⚠️ Gaps

| Item | Current | Recommended | Priority |
|------|---------|-------------|----------|
| **`generateMetadata`** | Only on `/market/[slug]` (1 of 10 routes) | Add to all public routes | **P1** |
| **OG images** | None | Add `opengraph-image.tsx` for social sharing previews | **P2** |
| **`not-found.tsx`** | 0 custom 404 pages | Add branded 404 for `/market/[slug]` and root | **P2** |
| **`global-not-found.tsx`** | Missing | Add for unmatched routes | **P2** |
| **`loading.tsx`** | Missing on 6 routes | Add for `/market/[slug]`, `/referrals`, `/watchlist`, `/wallet-tracker`, `/login`, `/login/callback` | **P1** |
| **`useReportWebVitals`** | Not used | Add for Core Web Vitals monitoring | **P3** |
| **Taint API** | Not configured | Optional — prevents sensitive data leaking to client | **P3** |

### SEO Metadata Coverage

| Route | `generateMetadata` | Title | Description |
|-------|-------------------|-------|-------------|
| `/explore` | ❌ | Default | Default |
| `/market/[slug]` | ✅ | Market question | Market description |
| `/leaderboard` | ❌ | Default | Default |
| `/portfolio` | ❌ | Default | Default |
| `/bridge` | ❌ | Default | Default |
| `/watchlist` | ❌ | Default | Default |
| `/wallet-tracker` | ❌ | Default | Default |
| `/referrals` | ❌ | Default | Default |
| `/login` | ❌ | Default | Default |

**Impact:** Search engines and social media previews show generic titles/descriptions for 8 of 9 public routes. Adding `generateMetadata` with proper titles and descriptions would significantly improve SEO and social sharing.

### Recommended Actions (Production Readiness)

1. **P1: Add `generateMetadata` to all public routes** — explore, leaderboard, portfolio at minimum
2. **P1: Add `loading.tsx` for 6 missing routes** — especially `/market/[slug]`
3. **P2: Add `opengraph-image.tsx`** — dynamic OG images for market pages (market question + price)
4. **P2: Add `not-found.tsx` and `global-not-found.tsx`** — branded 404 pages
5. **P3: Add `useReportWebVitals`** — send CWV data to Datadog or analytics

---

## Critical Notes

### `loading.tsx` + `unstable_instant` must be paired

Per Next.js docs: `loading.js` provides fallback UI but does **not** guarantee instant client-side navigations. `unstable_instant` ensures instant navigation but without `loading.tsx` there's no fallback to show. You need both for the best experience.

| Route | `loading.tsx` | `unstable_instant` | Result |
|-------|--------------|-------------------|--------|
| `/market/[slug]` | ❌ | ✅ | Instant nav but no skeleton — blank flash |
| `/explore` | ✅ | ✅ | ✅ Best: instant nav + skeleton |
| `/leaderboard` | ✅ | ❌ | Skeleton but nav may block |
| `/portfolio` | ✅ | ❌ | Skeleton but nav may block |

**Action:** `/market/[slug]` needs `loading.tsx` (P0). `/leaderboard`, `/portfolio`, `/bridge` need `unstable_instant` (P1).

### Compression can break streaming

The streaming guide warns that gzip/brotli compression can buffer chunks. We added `hono/compress` to the Hono API server — this is fine since it only compresses tRPC API responses, not Next.js HTML streaming. Vercel handles Next.js compression at the CDN layer with proper streaming support. **No action needed**, but if you ever self-host, don't add compression middleware to the Next.js server itself.

### `notFound()` must come before `<Suspense>` for real 404 status

Once streaming starts (when a Suspense fallback renders), the HTTP status is locked at 200. Your market page calls `notFound()` before any Suspense boundary — this is correct. If you add `loading.tsx` to `/market/[slug]`, the `notFound()` call must remain **above** the loading boundary (in the page, not in a component wrapped by loading.tsx) to preserve the real 404 status code.

---

## File Conventions Assessment

> Which Next.js file conventions are useful for Doji and which aren't.

### Use ✅

| Convention | Status | Notes |
|-----------|--------|-------|
| `layout.tsx` | ✅ 9 files | Properly used throughout |
| `page.tsx` | ✅ All routes | — |
| `loading.tsx` | ⚠️ 5 of 11 routes | P1: Add for 6 missing routes |
| `error.tsx` | ✅ 6 files | Good coverage |
| `global-error.tsx` | ✅ Exists | — |
| `not-found.tsx` | ❌ Missing | P2: Add branded 404 for `notFound()` calls |
| `global-not-found.tsx` | ❌ Missing | P2: Add for unmatched URLs |
| `route.tsx` | ✅ API routes | Sign proxy, share-pnl |

### Skip ❌

| Convention | Why not |
|-----------|---------|
| `template.tsx` | Templates remount on every navigation, resetting all client state. Doji relies on preserved state (Zustand stores, WebSocket connections, orderbook data). `<Activity>` from Cache Components is the right pattern — it preserves state across navigations, which is what a trading app needs. |
| `default.tsx` / Parallel Routes | Parallel routes render multiple pages simultaneously. Doji's dock/panel layout already achieves this with client-side components. Parallel routes would add complexity without clear benefit since the current architecture handles independent panels well. |

---

## Skeleton Loading Guidelines

### When to add a skeleton

Add a `loading.tsx` or `<Suspense fallback>` skeleton when the user sees blank space or layout shift for **more than ~200ms**. If content loads in under 200ms, a skeleton is worse — it flashes and disappears, which is more jarring than a brief wait.

### Per-route assessment

| Route | Needs skeleton? | Why |
|-------|----------------|-----|
| `/market/[slug]` | **Yes (P0)** | Gamma API fetch, 300-500ms on cache miss |
| `/explore` | ✅ Has one | — |
| `/leaderboard` | ✅ Has one | — |
| `/portfolio` | ✅ Has one | — |
| `/bridge` | ✅ Has one | — |
| `/referrals` | Measure first | If referral data loads <200ms, skip |
| `/watchlist` | Measure first | If watchlist loads <200ms, skip |
| `/wallet-tracker` | Measure first | If wallet data loads <200ms, skip |
| `/login` | No | Static form, renders instantly |
| `/login/callback` | No | Redirect page, user expects to wait |

### `fallback={null}` assessment

| Location | Keep `null`? | Why |
|----------|-------------|-----|
| `layout.tsx` (root) | ✅ Yes | Top-level wrapper, nothing to show |
| `onboarding-modal-provider` | ✅ Yes | Lazy modal, brief flash acceptable |
| `profile-modal-provider` | ✅ Yes | Lazy modal |
| `bridge-modal-provider` | ✅ Yes | Lazy modal |
| `color-experiment-switcher` | ✅ Yes | Non-visual |
| `position-table.tsx` | ✅ Yes | Nested lazy component |
| `market-trading-context` | ✅ Yes | Context wrapper |
| `explore/page.tsx` | Maybe | Could show skeleton for explore content |
| **`positions-tab.tsx`** | **No — add skeleton** | User stares at empty tab waiting for data |
| **`redeem-tab.tsx`** | **No — add skeleton** | User stares at empty tab waiting for data |

### Anti-pattern: skeleton everywhere

Don't add skeletons to everything. A page full of pulsing gray bars is worse UX than a page that loads in 100ms with no skeleton. Skeletons bridge perceptible delays, not decoration. Measure before adding.

### How to measure

Chrome DevTools → Network tab → throttle to "Fast 3G" → navigate to the route. If blank space is visible for more than a blink (~200ms), add a skeleton. If content appears instantly, don't.

---

## Corrections (validated 2026-04-05)

The following claims in earlier sections were inaccurate and are corrected here:

### SEO Metadata — was WRONG

The Production Checklist section stated `generateMetadata` was "only on /market/[slug] (1 of 10 routes)". This was incorrect.

**Actual:** Metadata (`generateMetadata` or `export const metadata`) exists on **18 files across all routes** — root layout, explore, leaderboard, portfolio, bridge, login, referrals, watchlist, wallet-tracker, and market. SEO metadata coverage is actually comprehensive. The P1 action item for adding metadata is **not needed**.

### `fallback={null}` count — was wrong

Stated 10 instances. **Actual: 14 instances** (some files have 2). The per-file assessment in the Skeleton Guidelines section is accurate — the count was just off.

### `router.push` without `startTransition` — was wrong

Stated 10 instances. **Actual: 15 instances**. The affected files list in the Suspense & Transition section is incomplete — there are additional imperative navigations beyond those listed.

### `cacheTag` coverage — was slightly wrong

Stated "set on all 4 cached functions". **Actual: 3 of 4.** `getCachedEventsList` has no `cacheTag` (time-based only via `cacheLife("minutes")`). This is documented in the query-client.ts comments and is intentional — event lists don't need on-demand invalidation.

### OG images — was correct

No `opengraph-image.tsx` files exist. This remains a valid P2 item for social sharing previews.

### Updated Priority List

After corrections, the actual priorities are:

1. **P0: Add `loading.tsx` for `/market/[slug]`** — most visited route, no skeleton, has `unstable_instant` but blank flash on navigation
2. **P1: Add `loading.tsx` for `/watchlist`, `/wallet-tracker`** (measure first — may not need if data loads <200ms)
3. **P1: Wrap `router.push` in `startTransition`** — 15 instances, prevents jarring fallback flashes
4. **P2: Add `unstable_instant` to `/leaderboard`, `/portfolio`, `/bridge`** — pair with existing `loading.tsx`
5. **P2: Add `opengraph-image.tsx`** — social sharing previews
6. **P2: Add `not-found.tsx` and `global-not-found.tsx`** — branded 404 pages
7. **P2: Add skeleton fallbacks to `positions-tab` and `redeem-tab`** Suspense boundaries
8. **P3: Differentiate cache profiles** — `cacheLife("hours")` for leaderboard
9. ~~**P1: Add `generateMetadata` to all routes**~~ — **ALREADY DONE, not needed**

---

## Big O / Algorithmic Audit

### Already Optimized ✅

| Location | Pattern | Complexity | Notes |
|----------|---------|-----------|-------|
| `selectSortedWindow` | Bounded max-heap for pagination | O(n log k) where k=page size | Avoids O(n log n) full sort for large market lists |
| `buildOpenOrderMarketMaps` | Map-based lookups | O(n) build + O(1) lookup | Replaced nested loops |
| Market dedup (`dedupeAndPush`) | Set-based dedup | O(1) per check | Correct |
| WebSocket subscription registry | Map-based | O(1) subscribe/unsubscribe | Correct |
| `getYesPrice` | Single function, no iteration | O(1) | Consolidated from 4 copies |

### Acceptable ⚠️

| Location | Pattern | Complexity | Why it's fine |
|----------|---------|-----------|---------------|
| `orders.find(o => o.id === event.id)` in orders store | Linear scan | O(n) per find | Orders array is typically <50 items. Map would add complexity for negligible gain. |
| Cost basis walk in `data.ts` | Single pass over trades | O(n) | 500 trades max, runs once per request. Linear is optimal for this. |
| Position enrichment | Multiple passes (filter, map) | O(n) per pass | Positions typically <100. Multiple O(n) passes is fine vs one complex pass. |
| `.indexOf` on small arrays | Linear scan | O(n) | Used on arrays of 5-10 items (column order, onboarding steps). Set/Map overhead not justified. |
| 77 `.sort()` calls across codebase | O(n log n) | Various | Most sort small arrays (<50 items). The one large sort (market list) uses `selectSortedWindow` heap instead. |

### Potential Issues 🔍

| Location | Pattern | Current | Better | Impact |
|----------|---------|---------|--------|--------|
| `orders.find()` called 4x in store | O(n) scan per WebSocket event | Array scan | `Map<id, Order>` index | **Low** — orders array is small, but on fast markets with many fills, 4 scans per event adds up. Would matter at >100 open orders. |
| `positions.filter()` called 3x in enrichment | 3 passes over positions | 3× O(n) | Single pass with categorization | **Low** — positions typically <100. Three passes is ~300 iterations vs ~100 for single pass. Not worth the complexity. |
| `ids.indexOf(asset)` in `tryEventMarketOutcomeLabel` | O(n) on clobTokenIds array | Linear scan | Pre-built Map | **Negligible** — clobTokenIds has 2 entries (Yes/No). indexOf on 2 items is faster than Map overhead. |

### Not an Issue ✅

| Concern | Why |
|---------|-----|
| `.map().filter()` chains | These are O(n) + O(n) = O(n), not O(n²). Chaining is fine. |
| `new Set(arr.map(...).filter(...))` | O(n) construction. Correct pattern for dedup. |
| WebSocket price_change dispatch | O(assets × handlers) per message. Assets per message is typically 1-5, handlers per asset is 1-2. Total work per message is ~10 operations. |
| `selectSortedWindow` heap | Already optimal O(n log k) for top-k selection. |

### Summary

No O(n²) or worse algorithmic issues found in hot paths. The codebase correctly uses Map/Set for lookups, heap-sort for pagination, and linear scans only on small arrays. The orders store could benefit from a Map index if order counts grow beyond ~100, but this is not a current concern.

---

## API & Query Patterns Audit

### Heavy Queries

| Procedure | What it does | Concern | Severity |
|-----------|-------------|---------|----------|
| **`wallets.activity`** | Fetches up to 20,000 trades per tracked wallet (10K × 2 pages), in parallel across all wallets | Could fetch 100K+ trades for users tracking 5+ wallets | **Medium** — parallel mitigates latency but response payload is huge |
| **`markets.list`** | 6 sequential `getMarkets`/`getEvents` calls to merge API markets with event-derived markets | Waterfall of 6 API calls to Gamma | **Medium** — mitigated by `Promise.all` for parallel batches, but first batch is sequential |
| **`data.positions`** | Fetches positions + 500 trades for cost basis walk | 2 parallel API calls + O(n) walk | **Low** — subgraph path eliminates the trade walk |
| **`getSubgraphTradeVolumeByToken`** | Paginates up to 100K trades from subgraph (1000/page × 100 pages) | Could be slow for high-volume tokens | **Low** — safety cap at 100 pages, used for chart volume only |
| **`tradeCountsByMarket`** | Batches trade count queries in chunks of 3 events, 2 concurrent | Up to 18 events × batched queries | **Low** — subgraph path handles most cases now |

### Blocking Calls

| Location | Pattern | Issue | Fix |
|----------|---------|-------|-----|
| `markets.list` first batch | `await getMarkets(...)` then parallel batches | First batch blocks before parallel starts | **Acceptable** — needs first batch to determine if more pages exist |
| `wallets.activity` second page | Sequential per-wallet (first → second page) | Can't parallelize pages within a wallet | **Acceptable** — second page only fetched if first hits 10K limit |
| Chart volume fallback | 5 sequential paginated `data.trades` calls | Up to 50K trades fetched sequentially | **Fixed** — subgraph path is now primary (single request) |

### Polling

| Location | Interval | What | Concern |
|----------|----------|------|---------|
| `use-merged-market-positions` | 5s | `ctfTokenBalances` | ✅ Fine — small payload, only when page visible |
| `quick-sell-modal` | 2s (when open) | Balance data | ✅ Fine — only while modal is open |
| `use-split-merge` | 2s × 10 polls | Post-trade position refresh | ✅ Fine — temporary polling after trade, stops after 10 attempts |

### Infinite Queries

10 `useInfiniteQuery` instances across the app. All properly paginated with `getNextPageParam`. No concerns — this is the correct pattern for paginated data.

### Payload Sizes

| Endpoint | Typical payload | With gzip | Notes |
|----------|----------------|-----------|-------|
| `markets.list` (50 markets) | ~200KB | ~40KB | Gamma payloads are verbose. Gzip compression added ✅ |
| `data.positions` (50 positions) | ~50KB | ~10KB | Reasonable |
| `wallets.activity` (5 wallets) | ~500KB+ | ~100KB | **Largest payload** — could benefit from server-side trimming |
| `clob.getOrderBooks` (batch 10) | ~30KB | ~6KB | Small |

### Recommendations

1. **P2: Trim `wallets.activity` response** — The wallet tracker fetches full trade objects (all fields) when it only needs timestamp, side, size, price, and market info. Server-side field selection would cut payload by ~60%.
2. **P3: Add response size limits to `wallets.activity`** — No cap on total trades returned. A user tracking 10 wallets with 10K trades each gets a 1MB+ response. Consider a global limit (e.g., 5000 most recent across all wallets).
3. **P3: Cache `markets.list` result** — The 6 API calls to Gamma happen on every explore page load. The `"use cache"` layer caches the final result, but a server-side LRU for the intermediate Gamma responses would reduce Gamma API load.
