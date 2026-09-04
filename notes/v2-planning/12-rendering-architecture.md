# Doji V2 — Rendering Architecture

> PPR, caching, Suspense boundaries, and skeleton improvements for V2.
> Covers the full rendering pipeline from static shell to streamed dynamic content.
>
> **Date:** 2026-05-02
> **Phase:** 3 (State + WS + Rendering)
> **Risk:** Medium
> **Status:** Planning

---

## Table of Contents

1. [Current State](#1-current-state)
2. [PPR Configuration](#2-ppr-configuration)
3. [Caching Strategy](#3-caching-strategy)
4. [Suspense Boundary Audit](#4-suspense-boundary-audit)
5. [Skeleton Inventory](#5-skeleton-inventory)
6. [Static Shell Inventory](#6-static-shell-inventory)
7. [loading.tsx vs Manual Suspense](#7-loadingtsx-vs-manual-suspense)
8. [Streaming Dehydration](#8-streaming-dehydration)
9. [Activity Component](#9-activity-component)
10. [startTransition for Filter/Sort](#10-starttransition-for-filtersort)
11. [Forbidden Patterns](#11-forbidden-patterns)
12. [Implementation Steps](#12-implementation-steps)
13. [Timeline](#13-timeline)
14. [JavaScript Performance Hot Paths](#14-javascript-performance-hot-paths)
15. [View Transitions — Replacing Framer Motion for Navigation](#15-view-transitions--replacing-framer-motion-for-navigation)
16. [Additional Rendering Gems](#16-additional-rendering-gems)

---

## 1. Current State

### What We Have (2026-05-02)

| Feature | Status | Location |
|---------|--------|----------|
| `cacheComponents: true` | ✅ Enabled | `apps/web/next.config.ts` |
| `experimental.useCache: true` | ✅ Enabled | `apps/web/next.config.ts` |
| React Compiler | ✅ Enabled | `reactCompiler: true` |
| `unstable_instant` (PPR prefetch) | ✅ `/explore`, `/market/[slug]` | Page exports |
| `"use cache"` functions | ✅ 8 cached fetchers | `shared/lib/trpc/query-client.ts` |
| LRU caches | ✅ market (30s), event (60s) | `shared/lib/server-cache.ts` |
| `React.cache()` dedup | ✅ `getCachedMarketBySlug` | `query-client.ts` |
| `connection()` calls | ✅ 5 routes | market, leaderboard, referrals, watchlist, wallet-tracker |
| Streaming dehydration | ✅ `shouldDehydrateQuery` includes `pending` | `getQueryClient()` |
| `<Activity>` component | ✅ Market tabs | `market-tabs.tsx` |
| `startTransition` | ✅ 10 files | explore filters, order form, auth, widgets |
| `loading.tsx` files | ✅ 8 routes | All major routes |
| Skeleton components | ✅ 72 files with Skeleton usage | Across features |
| `cacheTag` + `cacheLife` | ✅ All cached fetchers | `query-client.ts` |
| `generateStaticParams` | ✅ `/market/[slug]` (top 20 markets) | market page |

### What's Working Well

- **Market page** is the gold standard: `MarketTerminalShell` renders instantly as static shell, `MarketContent` streams behind Suspense with `connection()` → `getQueryClient()` → `HydrationBoundary`.
- **Three-layer caching** is fully implemented: `React.cache()` for request dedup, LRU for cross-request hot data, `"use cache"` + `cacheLife` for framework persistence.
- **Streaming dehydration** is configured — `prefetchQuery()` without `await` streams pending queries to the client.

### What Needs Work

- **`/explore` loading.tsx** returns `null` — blank flash on client navigation.
- **Skeleton animation** is inconsistent — some use `animate-pulse` (via `bg-muted`), some don't animate at all. No project-wide convention for financial data (pulse vs shimmer).
- **No `"use cache"` on leaderboard page** — the page itself doesn't cache, only `getCachedLeaderboard` in query-client.ts does.
- **`/referrals` loading.tsx** returns `null` — relies on page-level Suspense only.
- **Missing `connection()` calls** on `/explore` and `/portfolio` pages.
- **No Activity component** for dock panels — only market tabs use it.

---

## 2. PPR Configuration

### How It Works

PPR (Partial Prerendering) splits each route into a **static shell** (served instantly from CDN) and **dynamic islands** (streamed in via Suspense boundaries). The static shell is generated at build time; dynamic content streams in on each request.

```
┌─────────────────────────────────────┐
│  Static Shell (instant, CDN-cached) │
│  ┌───────────┐  ┌────────────────┐  │
│  │ Nav/Header │  │ Page Structure │  │
│  └───────────┘  └────────────────┘  │
│  ┌─────────────────────────────────┐│
│  │  <Suspense fallback={skeleton}> ││
│  │  ┌───────────────────────────┐  ││
│  │  │  Dynamic Island (streams) │  ││
│  │  └───────────────────────────┘  ││
│  └─────────────────────────────────┘│
└─────────────────────────────────────┘
```

### Current Config

```ts
// apps/web/next.config.ts
const nextConfig: NextConfig = {
  cacheComponents: true,        // PPR static shells
  reactCompiler: true,          // React Compiler optimizations
  experimental: {
    useCache: true,             // "use cache" directive
    staleTimes: { dynamic: 30 }, // Client Router Cache
  },
};
```

### The Date.now() Problem

`QueryClient` from TanStack Query calls `Date.now()` internally during construction. PPR forbids `Date.now()` before any dynamic data access because it would make the static shell time-dependent.

**Fix:** Call `await connection()` (from `next/server`) before `getQueryClient()`, and ensure the component is inside a `<Suspense>` boundary.

```tsx
// ✅ Correct — connection() opts into dynamic, inside Suspense
async function MarketContent({ slug }: { slug: string }) {
  await connection();
  const queryClient = getQueryClient();
  // ... prefetch and dehydrate
}

export default function MarketPage(props: Props) {
  return (
    <Suspense fallback={<MarketShell />}>
      <MarketContent {...props} />
    </Suspense>
  );
}

// ❌ Wrong — getQueryClient() at top level of page (no Suspense above)
export default async function MarketPage() {
  const queryClient = getQueryClient(); // Date.now() in static context!
}
```

### `unstable_instant` Export

Pages that use PPR export `unstable_instant` to enable instant client-side navigation with static prefetching:

```ts
export const unstable_instant = {
  prefetch: "static",
  unstable_disableBuildValidation: true,
};
```

**Currently enabled on:** `/explore`, `/market/[slug]`
**Should add to:** `/leaderboard`, `/watchlist`, `/wallet-tracker` (public or semi-public data)

---

## 3. Caching Strategy

### 3a. Three-Layer Caching

All three layers work together. Each serves a different scope:

| Layer | Scope | API | When to Use |
|-------|-------|-----|-------------|
| **Request dedup** | Single request | `React.cache()` | `generateMetadata` + page component share the same fetch |
| **In-memory LRU** | Cross-request, same process | `lru-cache` | Hot data (markets, events) — 30–60s TTL |
| **Framework cache** | Cross-request, persistent | `"use cache"` + `cacheLife()` | Public data shared across all users |

**How they compose (market page example):**

```
Request 1: generateMetadata({ slug: "will-x-happen" })
  → React.cache(getCachedMarketBySlug)(slug)
    → LRU miss → fetchMarketBySlug(slug)  ["use cache" + cacheLife("minutes")]
      → serverTrpc.markets.getBySlug.query({ slug })
      → Result stored in framework cache (1h expire, 1m revalidate)
    → Result stored in LRU (30s TTL)
  → Result memoized for this request

Request 1: MarketContent({ slug: "will-x-happen" })
  → React.cache(getCachedMarketBySlug)(slug)
    → Request-level memo hit — no fetch
```

### 3b. What to Cache

| Data | Cache Strategy | Why |
|------|---------------|-----|
| Public event/market listings | `"use cache"` + `cacheLife("minutes")` | Same for all users, changes slowly |
| Single market detail | `"use cache"` + `cacheTag("market", slug)` | Invalidate on resolution |
| Single event detail | `"use cache"` + `cacheTag("event", slug)` | Invalidate on market changes |
| Leaderboard | `"use cache"` + `cacheLife("hours")` | Public, updates infrequently |
| Open interest | `"use cache"` + `cacheLife("minutes")` | Public, moderate update frequency |
| Live volume | `"use cache"` + `cacheLife("minutes")` | Public, moderate update frequency |
| Orderbook | **Never** (TanStack Query + WebSocket) | Real-time, changes every second |
| Last trade prices | `"use cache"` + short TTL (10s stale) | Warm start, WS takes over on client |
| Session / user data | **Never** (TanStack Query) | Per-user, auth-gated |
| Portfolio positions | **Never** (TanStack Query) | Per-user, auth-gated |
| Watchlist | **Never** (TanStack Query) | Per-user, auth-gated |

### 3c. cacheLife Profiles

The built-in profiles used across the codebase:

| Profile | Stale | Revalidate | Expire | Used For |
|---------|-------|------------|--------|----------|
| `"minutes"` | 5m | 1m | 1h | Markets, events, OI, volume |
| `"hours"` | 1h | 15m | 24h | Leaderboard |
| Custom `{ stale: 10, revalidate: 5, expire: 60 }` | 10s | 5s | 60s | Orderbook, last trade prices |

> **Rule:** `cacheLife` expire must be **≥5 minutes** for PPR static shell eligibility. The custom short-TTL caches (orderbook, prices) are for warm-start only — they don't contribute to the static shell.

### 3d. cacheTag + Invalidation

Every `"use cache"` function is tagged for targeted invalidation:

| Function | Tags | Invalidation Trigger |
|----------|------|---------------------|
| `getCachedEventsList` | `"events-list"` | New event created, event resolved |
| `getCachedMarketBySlug` | `"market"`, `slug` | Market resolved, metadata updated |
| `getCachedEventBySlug` | `"event"`, `slug` | Market added/resolved in event |
| `getCachedLeaderboard` | `"leaderboard"` | Periodic (hourly via cacheLife) |
| `getCachedOpenInterest` | `"open-interest"`, `conditionId` | Trade executed |
| `getCachedLiveVolume` | `"live-volume"`, `eventId` | Trade executed |
| `getCachedOrderBook` | `"orderbook"`, `tokenId` | Short TTL auto-expires |
| `getCachedLastTradePrices` | `"last-trade-prices"`, `tokenIds` | Short TTL auto-expires |

**Invalidation APIs:**

```ts
// Route Handler / webhook — background refresh (stale-while-revalidate)
import { revalidateTag } from "next/cache";
revalidateTag("market", "max");           // All markets
revalidateTag("will-x-happen", "max");    // Specific market

// Server Action — immediate (read-your-own-writes)
import { updateTag } from "next/cache";
updateTag("market");                       // User sees fresh data on redirect
```

> **Rule:** `updateTag` is only available in Server Actions. Route Handlers must use `revalidateTag`.

---

## 4. Suspense Boundary Audit

For each route: what renders instantly (static shell), what streams in (dynamic), and what skeleton is shown.

### `/explore`

| Region | Rendering | Notes |
|--------|-----------|-------|
| Category tabs, sort controls, column headers | **Static shell** | `EventsDiscovery` renders with default props as fallback |
| Event cards / table rows | **Cached + streamed** | `ExploreContent` inside Suspense; data via `getCachedEventsList` |
| Onboarding trigger | **Streamed** | Separate Suspense with `null` fallback |

**Current issue:** `loading.tsx` returns `null` — blank flash on client navigation. Fix: render `EventsDiscovery` with default props (same as page Suspense fallback).

**Skeleton:** `MarketsLoadingSkeleton` (exists at `explore/components/markets-loading-skeleton.tsx`) — event card grid with pulse animation.

### `/market/[slug]`

| Region | Rendering | Notes |
|--------|-----------|-------|
| Trading terminal structure (panels, column headers, labels) | **Static shell** | `MarketTerminalShell` with empty data |
| Order form inputs (side selector, type tabs, labels) | **Static shell** | Part of `MarketTerminalShell` |
| Market title, description | **Cached** | `getCachedMarketBySlug` via `"use cache"` |
| Orderbook rows | **Streamed** | Prefetched via `getCachedOrderBook`, WS takes over |
| Chart data | **Streamed** | `prefetchMarketExtras` (price history) |
| Balance, positions | **Streamed** | Auth-gated, client-side TQ |
| Event data (market selector) | **Streamed** | `getCachedEventBySlug` |
| Team data (sports) | **Streamed** | Awaited for button labels |

**Skeleton:** `MarketTerminalShell` with `slug=""` — full terminal chrome, empty data regions.

### `/portfolio`

| Region | Rendering | Notes |
|--------|-----------|-------|
| Tab bar (positions/orders/activity/redeem) | **Static shell** | Cookie-backed initial tab |
| Top cards (balance, PnL) | **Streamed** | Auth-gated |
| Position/order/activity tables | **Streamed** | Auth-gated |

**Skeleton:** `PortfolioLoadingSkeleton` — tab bar + table skeleton rows with pulse animation.

### `/leaderboard`

| Region | Rendering | Notes |
|--------|-----------|-------|
| Page header, period selector | **Static shell** | Part of skeleton |
| Rankings table | **Streamed** | `getCachedLeaderboard` via `"use cache"` |
| Your ranking row | **Streamed** | Auth-gated |

**Skeleton:** `LeaderboardPageSkeleton` → `LeaderboardTableSkeleton` + `LeaderboardBodySkeleton`.

### `/watchlist`

| Region | Rendering | Notes |
|--------|-----------|-------|
| Tab bar (markets/events) | **Static shell** | Cookie-backed initial tab |
| Market/event list | **Streamed** | Auth-gated |

**Skeleton:** `WatchlistLoadingSkeleton` — tab bar + table skeleton rows.

### `/wallet-tracker`

| Region | Rendering | Notes |
|--------|-----------|-------|
| Tab bar (wallets/trades) | **Static shell** | Cookie-backed initial tab |
| Wallet list, trade history | **Streamed** | Auth-gated |

**Skeleton:** `WalletTrackerPageSkeleton` — tab bar + table skeleton rows.

### `/bridge`

| Region | Rendering | Notes |
|--------|-----------|-------|
| Bridge form (chain selector, token, amount) | **Mostly static** | Form structure is static |
| Balance, token prices | **Streamed** | Auth-gated, client-side TQ |

**Skeleton:** Minimal — form structure renders instantly, only balance values load.

### `/referrals`

| Region | Rendering | Notes |
|--------|-----------|-------|
| Page header, invite code display | **Static shell** | |
| Stats (referral count, earnings) | **Streamed** | Auth-gated |

**Current issue:** `loading.tsx` returns `null`. Page uses `<Suspense fallback={<ReferralsLoadingSkeleton />}>` internally.

**Skeleton:** `ReferralsLoadingSkeleton` — stats cards + table skeleton.

---

## 5. Skeleton Inventory

### Conventions

- **Animation:** `animate-pulse` only (no shimmer). Financial data should feel stable, not flashy.
- **Dimensions:** Must match real content to prevent CLS (Cumulative Layout Shift).
- **Variant:** Use `tableRow` prop on `<Skeleton>` for dense table/list rows (`rounded-sm`); default `rounded-md` for cards and controls.
- **Row count:** Match the typical viewport — 8–12 rows for tables, 6–9 cards for grids.

### Existing Skeletons

| Component | Location | Used By | Rows | Animation |
|-----------|----------|---------|------|-----------|
| `PortfolioLoadingSkeleton` | `portfolio/components/` | `/portfolio` loading.tsx | Tab bar + table rows | pulse |
| `PortfolioTableSkeletonRows` | `portfolio/components/` | Position/order tables | 8 rows | pulse |
| `LeaderboardPageSkeleton` | `leaderboard/components/` | `/leaderboard` loading.tsx | Header + table | pulse |
| `LeaderboardBodySkeleton` | `leaderboard/components/` | Rankings table | 10 rows | pulse |
| `LeaderboardTableSkeleton` | `leaderboard/components/` | Table chrome | Headers + rows | pulse |
| `WatchlistLoadingSkeleton` | `watchlist/components/` | `/watchlist` loading.tsx | Tab bar + rows | pulse |
| `WatchlistTableSkeletonRows` | `watchlist/components/` | Market list | 8 rows | pulse |
| `WalletTrackerPageSkeleton` | `wallet-tracker/components/` | `/wallet-tracker` loading.tsx | Tab bar + rows | pulse |
| `WalletTrackerWalletsSkeletonRows` | `wallet-tracker/components/` | Wallet list | 5 rows | pulse |
| `WalletTrackerTradesSkeletonRows` | `wallet-tracker/components/` | Trade history | 8 rows | pulse |
| `ReferralsLoadingSkeleton` | `referrals/components/` | `/referrals` page Suspense | Stats + table | pulse |
| `MarketsLoadingSkeleton` | `explore/components/` | `/explore` grid fallback | 6–9 cards | pulse |
| `EventCardSkeleton` | `explore/components/` | Individual card placeholder | 1 card | pulse |
| `MarketTerminalShell` | `market/[slug]/` | `/market/[slug]` loading.tsx | Full terminal chrome | none (structural) |

### V2 Gaps

| Missing Skeleton | Route | Description |
|-----------------|-------|-------------|
| `ExploreLoadingSkeleton` | `/explore` loading.tsx | Should render `EventsDiscovery` with default props (not `null`) |
| `BridgeLoadingSkeleton` | `/bridge` | Form structure with disabled inputs |

---

## 6. Static Shell Inventory

Elements that should **never** show a skeleton — they render instantly as part of the PPR static shell or are cached with `"use cache"`.

### Global (all routes)

- Site header (`header-nav.tsx`)
- Bottom bar / mobile nav (`bottom-bar.tsx`)
- Dock frame (widget container structure)
- Search bar chrome (input, Ctrl+K hint)

### Per-Route Static Elements

| Route | Static Elements |
|-------|----------------|
| `/explore` | Category tabs, sort dropdown, column headers, view toggle |
| `/market/[slug]` | Terminal panel structure, column headers, order form labels, side selector, type tabs, breadcrumbs |
| `/portfolio` | Tab bar (positions/orders/activity/redeem), table column headers |
| `/leaderboard` | Page title, period selector tabs |
| `/watchlist` | Tab bar (markets/events), table column headers |
| `/wallet-tracker` | Tab bar (wallets/trades), table column headers |
| `/bridge` | Form structure, chain/token selectors (empty), amount input |
| `/referrals` | Page title, invite code section structure |

### Cached Static (via `"use cache"`)

These render as part of the static shell because their `cacheLife` expire is ≥5 minutes:

- Event/market title and description (`getCachedMarketBySlug`, `getCachedEventBySlug`)
- Category labels and event metadata (`getCachedEventsList`)
- Leaderboard data (`getCachedLeaderboard` — `cacheLife("hours")`)

---

## 7. loading.tsx vs Manual Suspense

### Decision Matrix

| Route | Approach | Why | Current State |
|-------|----------|-----|---------------|
| `/explore` | **Manual Suspense** | Mixed static (tabs) + cached (events); shell renders with default props | ✅ Manual Suspense in page.tsx; ⚠️ loading.tsx returns `null` |
| `/market/[slug]` | **Manual Suspense** | Complex mixed static/dynamic; terminal shell is structural | ✅ Correct — outer + inner Suspense |
| `/portfolio` | **loading.tsx** | All content is auth-gated/dynamic; entire page streams | ✅ Correct — `PortfolioLoadingSkeleton` |
| `/leaderboard` | **loading.tsx** | All content streams (cached but still async) | ✅ Correct — `LeaderboardPageSkeleton` |
| `/watchlist` | **loading.tsx** | All content is auth-gated | ✅ Correct — `WatchlistLoadingSkeleton` |
| `/wallet-tracker` | **loading.tsx** | All content is auth-gated | ✅ Correct — `WalletTrackerPageSkeleton` |
| `/bridge` | **Neither** | Mostly static form; only balance is dynamic (client TQ) | ✅ No loading needed |
| `/referrals` | **Manual Suspense** | Page uses internal Suspense; loading.tsx returns `null` | ⚠️ Consider adding skeleton to loading.tsx for client nav |

### Rules

1. **Use `loading.tsx`** when the entire page is dynamic/personal — the whole page streams behind one boundary.
2. **Use manual `<Suspense>`** when the page has a meaningful static shell that should render instantly while dynamic regions stream in.
3. **Never use both** for the same content — it causes double skeleton flashes.
4. **`loading.tsx` returning `null`** is acceptable only if the page's internal Suspense provides the fallback AND client navigation doesn't cause a blank flash. Test by navigating from another route.

---

## 8. Streaming Dehydration

### Current Implementation ✅

Already configured in `getQueryClient()`:

```ts
// apps/web/src/shared/lib/trpc/query-client.ts
export function getQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: STALE_DEFAULT },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
        shouldRedactErrors: () => false,
      },
    },
  });
}
```

### How It Works

When `shouldDehydrateQuery` includes `status === "pending"`, calling `prefetchQuery()` **without** `await` serializes the pending promise into the dehydrated state. The promise streams to the client as it resolves — the client sees data appear without a separate fetch.

```tsx
// ✅ Streaming — data arrives as it resolves, no waterfall
async function MarketContent({ slug }: { slug: string }) {
  await connection();
  const qc = getQueryClient();

  // Fire and forget — streams to client
  qc.prefetchQuery(trpc.clob.getPricesHistory.queryOptions({ market: tid }));
  qc.prefetchQuery(trpc.clob.getTickSize.queryOptions({ tokenId: tid }));

  // Await only critical data (market title for SEO)
  await qc.prefetchQuery(trpc.markets.getBySlug.queryOptions({ slug }));

  return <HydrationBoundary state={dehydrate(qc)}><MarketTerminal /></HydrationBoundary>;
}
```

### V2 Improvements

- **Audit all RSC pages** to ensure non-critical prefetches use fire-and-forget (no `await`).
- **Market page** already does this well — `oiPromise`, `orderbookPromise`, `extraPromise` race with a 500ms timeout.
- **Explore page** should prefetch event data without `await` so the shell renders instantly.

---

## 9. Activity Component

### Current Usage ✅

`<Activity>` (React 19) is already used in market tabs:

```tsx
// apps/web/src/features/trading/components/market/market-tabs.tsx
<Activity mode={activeTab === "orderbook" ? "visible" : "hidden"}>
  <OrderbookTab />
</Activity>
<Activity mode={activeTab === "positions" ? "visible" : "hidden"}>
  <PositionsTab />
</Activity>
```

### Why Activity Over Conditional Rendering

| Pattern | DOM | State | Background Fetching |
|---------|-----|-------|-------------------|
| `{active && <Tab />}` | Destroyed/recreated | Lost | Stopped |
| `<Activity mode="hidden">` | Preserved (hidden) | Preserved | Continues |

### V2 Expansion Targets

| Component | Current Pattern | Target |
|-----------|----------------|--------|
| Market tabs (orderbook/positions/activity/trades/holders) | ✅ `<Activity>` | Already done |
| Dock panels (portfolio widget, activity widget, calendar) | ❌ Conditional render | `<Activity>` — preserve widget state across toggles |
| Portfolio tabs (positions/orders/activity/redeem) | ❌ Conditional render | `<Activity>` — preserve table scroll position and filters |
| Watchlist tabs (markets/events) | ❌ Conditional render | `<Activity>` — preserve list state |

### Implementation Note

`<Activity mode="hidden">` sets `content-visibility: hidden` on the subtree. The DOM stays mounted but is not painted. React continues processing updates (including TanStack Query refetches) so data stays fresh when the user switches back.

---

## 10. startTransition for Filter/Sort

### Principle

When the user changes a filter or sort, keep showing the **stale content** while new data loads. Dim with opacity instead of replacing with a skeleton.

```tsx
// ✅ Correct — stale content visible, dimmed during transition
const [isPending, startTransition] = useTransition();

function handleSortChange(field: string) {
  startTransition(() => {
    setSort(field);
  });
}

return (
  <div className={isPending ? "opacity-60 transition-opacity" : ""}>
    <DataTable data={data} />
  </div>
);
```

### Current Usage ✅

`startTransition` is already used in 10 files, primarily in:

- **Explore filters** (`events-discovery.tsx`) — category, sort, tag changes
- **Explore columns menu** (`explore-columns-menu.tsx`) — column visibility toggles
- **Order form** (`order-form.tsx`) — side/type changes
- **Activity widget** (`activity-widget-content.tsx`) — filter changes

### V2 Improvements

| Component | Current | Target |
|-----------|---------|--------|
| Portfolio table sort/filter | Direct state update | `startTransition` + opacity dim |
| Leaderboard period selector | Direct state update | `startTransition` + opacity dim |
| Watchlist sort | Direct state update | `startTransition` + opacity dim |
| Wallet tracker filters | Direct state update | `startTransition` + opacity dim |

### Anti-Pattern

```tsx
// ❌ Wrong — replaces content with skeleton on every filter change
function handleSortChange(field: string) {
  setIsLoading(true);  // Shows skeleton
  setSort(field);
}
```

---

## 11. Forbidden Patterns

Quick reference card — patterns that cause build failures or runtime crashes in Next.js 16 with PPR.

### Build Failures

| Pattern | Error | Fix |
|---------|-------|-----|
| `Date.now()` before dynamic access | `Static generation failed: Date.now() used in static context` | `await connection()` before `new QueryClient()` |
| `next/dynamic` with `ssr: false` in Server Component | `Cannot use next/dynamic with ssr: false in a Server Component` | Wrap in a `"use client"` component |
| `usePathname()` in Server Component | `usePathname only works in Client Components` | Extract to `"use client"` file |
| `"use cache"` with `cacheLife` expire < 5min | PPR won't include in static shell | Use `cacheLife("minutes")` or longer |

### Runtime Crashes

| Pattern | Error | Fix |
|---------|-------|-----|
| `getQueryClient()` outside Suspense in RSC | Hydration mismatch (time-dependent) | Wrap in `<Suspense>`, call `connection()` first |
| `updateTag()` in Route Handler | `updateTag can only be used in Server Actions` | Use `revalidateTag(tag, "max")` instead |
| `redirect()` / `notFound()` inside try-catch | Swallowed navigation error | Don't catch, or use `unstable_rethrow(error)` |
| Wrapping entire page in single `<Suspense>` | No static shell, full-page skeleton | Push boundaries down to individual dynamic regions |

### Performance Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| `await` on all prefetches | Waterfall — page waits for slowest query | `await` only critical data; fire-and-forget the rest |
| Skeleton on filter/sort change | Jarring UX, content disappears | `startTransition` + opacity dim |
| `{active && <Tab />}` for tabs | State lost, refetch on every switch | `<Activity mode="visible"\|"hidden">` |
| `console.log` in `"use cache"` functions | Logs on every cache miss, noisy | Remove or use `logger.debug` |
| `import "server-only"` missing on server modules | Accidentally bundled client-side | Add `import "server-only"` at top |

---

## 12. Implementation Steps

### Step 1: Audit & Fix Config (Day 1)

- [x] Verify `cacheComponents: true` in `next.config.ts`
- [x] Verify `experimental.useCache: true`
- [ ] Add `unstable_instant` export to `/leaderboard`, `/watchlist`, `/wallet-tracker`

### Step 2: Fix `connection()` Gaps (Day 1–2)

- [x] `/market/[slug]` — `MarketContent` calls `connection()`
- [x] `/leaderboard` — page calls `connection()`
- [x] `/referrals` — page calls `connection()`
- [x] `/watchlist` — page calls `connection()`
- [x] `/wallet-tracker` — page calls `connection()`
- [ ] `/explore` — verify `ExploreContent` calls `connection()` before `getQueryClient()`
- [ ] `/portfolio` — verify page calls `connection()` before `getQueryClient()`

### Step 3: Expand `"use cache"` Coverage (Day 2–3)

- [x] `getCachedEventsList` — events list
- [x] `getCachedMarketBySlug` — single market
- [x] `getCachedEventBySlug` — single event
- [x] `getCachedLeaderboard` — leaderboard
- [x] `getCachedOpenInterest` — open interest
- [x] `getCachedLiveVolume` — live volume
- [x] `getCachedOrderBook` — orderbook (short TTL)
- [x] `getCachedLastTradePrices` — last trade prices (short TTL)
- [ ] Audit for any remaining `serverTrpc` calls not wrapped in `"use cache"`

### Step 4: Fix Suspense Boundaries (Day 3–5)

- [x] `/market/[slug]` — outer + inner Suspense with `MarketTerminalShell` fallback
- [x] `/explore` — manual Suspense with `EventsDiscovery` default props fallback
- [ ] Fix `/explore/loading.tsx` — render `EventsDiscovery` with defaults instead of `null`
- [ ] Fix `/referrals/loading.tsx` — render `ReferralsLoadingSkeleton` instead of `null`
- [ ] Audit all routes for proper Suspense boundary granularity

### Step 5: Skeleton Improvements (Day 5–7)

- [ ] Standardize all skeletons to use `animate-pulse` (no shimmer)
- [ ] Verify skeleton dimensions match real content (CLS audit)
- [ ] Create `ExploreLoadingSkeleton` for `/explore/loading.tsx`
- [ ] Audit skeleton row counts match typical viewport

### Step 6: Streaming Dehydration Audit (Day 7–8)

- [x] `getQueryClient()` configured with `shouldDehydrateQuery` including `pending`
- [ ] Audit market page — ensure non-critical prefetches don't `await`
- [ ] Audit explore page — ensure event list prefetch streams
- [ ] Audit leaderboard page — ensure data streams

### Step 7: Activity Component Expansion (Day 8–10)

- [x] Market tabs — already using `<Activity>`
- [ ] Dock panels (portfolio widget, activity widget, calendar)
- [ ] Portfolio tabs (positions/orders/activity/redeem)
- [ ] Watchlist tabs (markets/events)

### Step 8: startTransition Expansion (Day 10–12)

- [x] Explore filters — already using `startTransition`
- [ ] Portfolio table sort/filter
- [ ] Leaderboard period selector
- [ ] Watchlist sort
- [ ] Wallet tracker filters

---

## 13. Timeline

**Duration:** ~2 weeks (10 working days)
**Phase:** 3 (State + WS + Rendering)
**Dependencies:** None — can be done incrementally per route, independent of other V2 phases.

| Days | Work | Routes Affected |
|------|------|----------------|
| 1 | Config audit, `unstable_instant` exports | All |
| 1–2 | `connection()` gaps, verify existing patterns | `/explore`, `/portfolio` |
| 2–3 | `"use cache"` coverage audit | Server cache layer |
| 3–5 | Suspense boundary fixes | `/explore`, `/referrals` |
| 5–7 | Skeleton standardization, CLS audit | All routes |
| 7–8 | Streaming dehydration audit | `/market`, `/explore`, `/leaderboard` |
| 8–10 | `<Activity>` expansion | Dock, portfolio, watchlist |
| 10–12 | `startTransition` expansion | Portfolio, leaderboard, watchlist, tracker |

### Incremental Approach

Each route can be improved independently. Priority order:

1. **`/market/[slug]`** — highest traffic, most complex (already well-optimized)
2. **`/explore`** — second highest traffic, fix `loading.tsx` and verify caching
3. **`/portfolio`** — auth-gated but high engagement, add `<Activity>` for tabs
4. **`/leaderboard`** — public, add `unstable_instant` and `startTransition`
5. **`/watchlist`**, **`/wallet-tracker`** — auth-gated, add `<Activity>` and `startTransition`
6. **`/referrals`**, **`/bridge`** — lower traffic, fix loading.tsx

### Verification

After each route:
1. `pnpm build` — no PPR/cache build errors
2. Browser test — navigate to route, verify static shell renders instantly
3. Client navigation test — navigate from another route, verify no blank flash
4. CLS check — Lighthouse or DevTools Performance panel, CLS < 0.1
5. Streaming check — DevTools Network, verify chunked transfer encoding

---

## 14. JavaScript Performance Hot Paths

> From V2.md §12K — rules for code that runs on every WS message, every orderbook update, or every render of a 1000-row table.

### Build index Maps for repeated lookups

Convert arrays to Maps for O(1) access. Critical for orderbook processing and position-by-token lookups:

```ts
// ❌ O(n) per lookup — 1000 orders × 1000 markets = 1M ops
orders.map(o => ({ ...o, market: markets.find(m => m.conditionId === o.conditionId) }));

// ✅ O(1) per lookup — 2000 ops total
const marketById = new Map(markets.map(m => [m.conditionId, m]));
orders.map(o => ({ ...o, market: marketById.get(o.conditionId) }));
```

### toSorted() instead of sort()

`.sort()` mutates in place — breaks React's immutability model. Use `.toSorted()` for orderbook levels, position lists, leaderboard rankings.

### Combine multiple array iterations

Single-pass categorization instead of multiple `.filter()` calls:

```ts
// ❌ 3 iterations over positions
const open = positions.filter(p => p.status === "open");
const closed = positions.filter(p => p.status === "closed");
const redeemable = positions.filter(p => p.redeemable);

// ✅ 1 iteration
const open: Position[] = [], closed: Position[] = [], redeemable: Position[] = [];
for (const p of positions) {
  if (p.status === "open") open.push(p);
  if (p.status === "closed") closed.push(p);
  if (p.redeemable) redeemable.push(p);
}
```

### Narrow effect dependencies to booleans

Derive a boolean from a continuous value to prevent effects from re-running on every tick:

```ts
// ❌ Runs on every price tick
useEffect(() => { if (price < threshold) showAlert(); }, [price]);

// ✅ Runs only when crossing the threshold
const isBelowThreshold = price < threshold;
useEffect(() => { if (isBelowThreshold) showAlert(); }, [isBelowThreshold]);
```

### Split filter from sort in useMemo

Changing sort order shouldn't recompute filtering:

```ts
const filtered = useMemo(() => markets.filter(m => m.category === cat), [markets, cat]);
const sorted = useMemo(() => filtered.toSorted(sortFn), [filtered, sortOrder]);
```

### useDeferredValue for search/filter over large lists

Keeps the input responsive while filtering 1000+ markets:

```tsx
const [query, setQuery] = useState("");
const deferredQuery = useDeferredValue(query);
const filtered = useMemo(() => markets.filter(m => fuzzyMatch(m, deferredQuery)), [markets, deferredQuery]);
```

### Passive event listeners for scroll

Add `{ passive: true }` to touch/wheel listeners on orderbook and explore infinite scroll.

### requestIdleCallback for non-critical work

Schedule analytics, localStorage saves, and prefetching during idle periods:

```ts
function handleOrderPlaced(order: Order) {
  updateUI(order); // Immediate
  requestIdleCallback(() => analytics.track("order_placed", order));
  requestIdleCallback(() => saveToRecentOrders(order));
}
```

### useEffectEvent for stable WS callbacks

Access latest values in WS message handlers without adding them to effect dependency arrays — prevents subscription teardown/setup on every callback change:

```ts
import { useEffectEvent } from "react";
const onMessage = useEffectEvent((msg: WsMessage) => {
  queryClient.setQueryData(key, applyDelta(msg)); // always has latest queryClient
});
useEffect(() => {
  return wsHub.subscribe({ channel: "market", tokenIds }, onMessage);
}, [tokenIds]); // onMessage not in deps — stable
```

### flatMap to map and filter in one pass

```ts
const validPrices = responses.flatMap(r => r.success ? [r.data.price] : []);
```

---

## 15. View Transitions — Replacing Framer Motion for Navigation

> From V2.md §12L

Enable in `next.config.ts`: `experimental: { viewTransition: true }`. Uses React's `<ViewTransition>` component (available via Next.js's internal React canary). Unsupported browsers skip animations gracefully.

### What View Transitions replace (remove Framer Motion for these)

- Page enter/exit slides → `<ViewTransition enter="slide-from-right" exit="slide-to-left">`
- Shared element morphs (market card → market page) → `<ViewTransition name={`market-${id}`} share="morph">`
- List reorder animations → `<ViewTransition key={item.id}>` per item
- Suspense fallback→content reveals → VT wrapping Suspense boundary
- Fade in/out (AnimatePresence) → `<ViewTransition enter="fade-in" exit="fade-out">`

### What Framer Motion keeps (View Transitions can't do these)

- Spring physics (orderbook flash animation)
- Gesture-driven animations (drag, swipe)
- Scroll-linked animations
- Complex orchestrated sequences
- Staggered children during page exit

### Key rules

- Always use `default="none"` — without it, every VT fires browser cross-fade on every transition (Suspense resolves, revalidations, etc.)
- Always pair `enter` with `exit`
- Place directional VTs in **page components**, not layouts (layouts persist, enter/exit won't fire)
- `router.back()` does NOT trigger view transitions — use `router.push()` with explicit URL
- Named VTs must be globally unique — use IDs (`market-${slug}`)

### Doji-specific animation map

| Navigation | Animation | Implementation |
|-----------|-----------|---------------|
| Explore → market page | Directional slide + shared element morph | `<Link transitionTypes={['nav-forward']}>` on card. `<ViewTransition name={`market-${slug}`} share="morph">` on market image in both views. |
| Market → explore (back) | Reverse slide | `<Link transitionTypes={['nav-back']}>` on back button |
| Tab switching (orderbook/positions/activity) | Fade or `default="none"` | Lateral — no depth to communicate |
| Suspense reveals (data loading) | Slide up | `<ViewTransition enter="slide-up" default="none">` wrapping content |
| Explore grid filter/sort | Per-item identity | `<ViewTransition key={market.id}>` per card, trigger in `startTransition` |
| Same-route market switch | Key + share | `<ViewTransition key={slug} name={`market-${slug}`} share="auto" default="none">` |

---

## 16. Additional Rendering Gems

> From V2.md "Additional §12 Gems" — patterns from Vercel Engineering skills.

### `after()` for non-blocking post-response work

`after` from `next/server` runs code after the response finishes streaming. Use for analytics, audit logging, cache invalidation, and Discord webhook notifications — anything that shouldn't block the user's response.

```ts
import { after } from "next/server";

export async function POST(request: Request) {
  const result = await processOrder(request);
  after(async () => {
    analytics.track("order_placed", { marketSlug, side, amount });
    await notifyDiscord(result);
  });
  return Response.json(result); // sent immediately
}
```

Available in Route Handlers and Server Components. Use for: post-trade analytics, Sentry breadcrumbs, Discord ops webhooks, cache warming.

### React DOM resource hints

Warm connections to Polymarket APIs — saves DNS+TCP+TLS handshake (~100–300ms):

```tsx
import { preconnect, prefetchDNS } from "react-dom";

// In root layout
preconnect("https://clob.polymarket.com");
preconnect("https://gamma-api.polymarket.com");
prefetchDNS("https://ws-subscriptions-clob.polymarket.com");
```

### Minimize RSC→client serialization

Only pass fields the client component actually uses. Market objects have 50+ fields; the order form needs ~8.

```tsx
// ❌ Serializes all 50 fields into HTML
<OrderFormContainer market={market} />

// ✅ Serializes only what's needed
<OrderFormContainer
  tokenId={market.yesToken}
  tickSize={market.tickSize}
  acceptingOrders={market.acceptingOrders}
  bestBid={market.bestBid}
  bestAsk={market.bestAsk}
/>
```

### Parallel data fetching via component composition

Make the page component synchronous and let async children fetch in parallel as siblings:

```tsx
// ✅ Both fetch simultaneously — no waterfall
export default function Page({ params }) {
  return (
    <>
      <MarketHeader slug={params.slug} />
      <RelatedMarkets slug={params.slug} />
    </>
  );
}
async function MarketHeader({ slug }) { const market = await getMarket(slug); ... }
async function RelatedMarkets({ slug }) { const related = await getRelated(slug); ... }
```

### Preload JS bundles on hover

V2 covers data prefetch on hover. Also preload heavy JS bundles (KLineChart is ~200KB):

```tsx
function EventCard({ event }) {
  const preloadChart = () => { void import("@/domains/trading/components/chart"); };
  return (
    <Link href={`/market/${event.slug}`} onMouseEnter={preloadChart}>
      {event.title}
    </Link>
  );
}
```

### Auth error pages — `forbidden()` and `unauthorized()`

Next.js 16 has built-in auth error functions. Create `app/forbidden.tsx` and `app/unauthorized.tsx`:

```tsx
import { forbidden, unauthorized } from "next/navigation";
if (!session) unauthorized();          // renders unauthorized.tsx (401)
if (!session.hasAccess) forbidden();   // renders forbidden.tsx (403)
```

### `use cache` variants

- **`'use cache: private'`** — allows `cookies()`/`headers()` inside cached functions (compliance escape hatch for per-user cached data)
- **`'use cache: remote'`** — platform-provided cache (Redis, KV store) instead of local filesystem

### Cache key generation

Keys are automatic from build ID + function location hash + serializable arguments + closure variables. No manual cache keys needed (unlike `unstable_cache`).

### CSR bailout hooks — which hooks require Suspense

| Hook | Suspense required? |
|------|-------------------|
| `useSearchParams()` | **Always** — without Suspense, entire page silently becomes CSR |
| `usePathname()` | Yes in dynamic routes |
| `useParams()` | No |
| `useRouter()` | No |

### Debug tools (Next.js 16+)

- `next build --debug-build-paths "/market/[slug]"` — rebuild a single route without full build
- `next experimental-analyze` — built-in bundle analyzer (replaces `@next/bundle-analyzer`)