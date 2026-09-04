# Client vs Server Component Audit

> 270 total `.tsx` files: **211 client** / **59 server**

## Rendering Pipeline (Root → Page)

```
RootLayout (SERVER)
├── <html> + <body> + font
├── Boot script (workspace chart height from localStorage)
└── Providers (CLIENT — QueryClient, Magic, Theme, Modals, Toast)
    └── AppShell (SERVER)
        ├── ChromeVisibility (SERVER Suspense → CLIENT ChromeVisibilityRouter)
        │   ├── SiteHeader (SERVER)
        │   │   ├── DojiLogo (SERVER)
        │   │   ├── Suspense → HeaderNav (CLIENT — usePathname)
        │   │   ├── HeaderSearch (CLIENT)
        │   │   └── HeaderActions (CLIENT — wallet balance, user menu)
        │   └── WatchlistBar (CLIENT — useWatchlist)
        ├── Suspense fallback={AppShellFallback}
        │   └── AppShellRouter (CLIENT — usePathname)
        │       └── AuthGuard (CLIENT — useMagic, useWalletStore)
        │           ├── loadingFallback={children} ← renders page while auth pending
        │           └── DockShell (CLIENT)
        │               └── {children} ← page content
        └── ChromeVisibility
            └── Suspense fallback={BottomBarShell (SERVER)}
                └── BottomBar (CLIENT — usePathname)
```

**Key behavior**: `AuthGuard` uses `loadingFallback={children}` + `showChromeWhileAuthPending`. Page content renders immediately on both hard refresh and client nav. Auth check runs in background.

---

## Per-Route Component Trees

### `/explore`

```
loading.tsx → return null (SERVER)                    ⚠️ PPR handles it
page.tsx (SERVER)
├── ContentWidth (SERVER)
├── Suspense fallback={null}
│   └── OnboardingTrigger (CLIENT)
└── Suspense fallback={<EventsDiscovery ...>}         ✅ Real shell as fallback
    └── ExploreContent (SERVER — async, prefetches)
        └── HydrationBoundary
            └── EventsDiscovery (CLIENT)
                ├── CategoryTabs (CLIENT)
                ├── ExploreDiscoveryToolbar (CLIENT)
                ├── EventsTable (CLIENT) / EventCard grid (CLIENT)
                │   └── EventCard (CLIENT)
                │       ├── ImageWithFallback (CLIENT)
                │       └── Sparkline (CLIENT)
                └── CryptoCategorySidebar (CLIENT)
```

| File | Type | Why |
|------|------|-----|
| `explore/page.tsx` | SERVER | Async searchParams |
| `explore/loading.tsx` | SERVER | Returns null — PPR instant nav |
| `explore-content.tsx` | SERVER | Async prefetch with `getCachedEventsList` |
| `events-discovery.tsx` | CLIENT | useInfiniteQuery, useState, useCallback |
| `events-table.tsx` | CLIENT | useReactTable, sorting state |
| `events-table-chrome.tsx` | CLIENT | useState for column visibility |
| `event-card.tsx` | CLIENT | usePrefetchMarket, useSportsLive hooks |
| `event-card-skeleton.tsx` | CLIENT | Could be SERVER (only uses cn) |
| `category-tabs.tsx` | CLIENT | onClick handlers |
| `sparkline.tsx` | CLIENT | Recharts, useRef |
| `explore-columns-menu.tsx` | CLIENT | useState, popover |
| `explore-funnel-popovers.tsx` | CLIENT | useState, popover |
| `explore-discovery-toolbar.tsx` | CLIENT | Search state |
| `explore-topic-subtags-dropdown.tsx` | CLIENT | useState |
| `crypto-category-sidebar.tsx` | CLIENT | useState, useEffect |
| `landing-page.tsx` | CLIENT | Experimental, unused |
| `markets-loading-skeleton.tsx` | CLIENT | Could be SERVER |

---

### `/leaderboard`

```
loading.tsx → return null (SERVER)                    ⚠️ PPR handles it
page.tsx (SERVER)
└── Suspense fallback={<LeaderboardPageSkeleton />}   ✅ Static skeleton
    └── LeaderboardContent (SERVER — async, prefetches)
        └── HydrationBoundary
            └── LeaderboardPage (CLIENT)
                ├── SearchBar (CLIENT)
                ├── TimePeriod buttons (CLIENT)
                ├── LeaderboardFiltersPopover (CLIENT)
                └── TraderLeaderboard (CLIENT)
                    └── TraderLeaderboardView (CLIENT)
                        └── LeaderboardDataTable (CLIENT)
                            ├── LeaderboardColgroup
                            ├── Table/TableHeader (CLIENT)
                            └── LeaderboardBodySkeleton / TableBody (CLIENT)
```

| File | Type | Why |
|------|------|-----|
| `leaderboard/page.tsx` | SERVER | Async prefetch |
| `leaderboard/loading.tsx` | SERVER | Returns null — PPR instant nav |
| `leaderboard-page.tsx` | CLIENT | useInfiniteQuery, useState |
| `leaderboard-data-table.tsx` | CLIENT | useReactTable |
| `leaderboard-table-skeleton.tsx` | CLIENT | useReactTable for header alignment |
| `leaderboard-body-skeleton.tsx` | CLIENT | Could be SERVER |
| `leaderboard-body-scroll-area.tsx` | CLIENT | useRef, IntersectionObserver |
| `leaderboard-filters.tsx` | CLIENT | useState, popover |
| `leaderboard-profile-modal.tsx` | CLIENT | useQuery, useState |
| `leaderboard-profile-modal-parts.tsx` | SERVER | Pure render |
| `trader-leaderboard.tsx` | CLIENT | useProfileModal, useCallback |
| `trader-columns.tsx` | CLIENT | Column definitions with callbacks |
| `data-table-column-header.tsx` | CLIENT | Sorting click handlers |

---

### `/market/[slug]`

```
loading.tsx → return null (SERVER)                    ❌ Blank on client nav
page.tsx (SERVER — async)
├── generateMetadata → getCachedMarketBySlug
└── Suspense fallback={<MarketTerminalShell slug>}    ⚠️ Hydration warning (acceptable)
    └── MarketContent (SERVER — async, prefetches market + OI + volume)
        └── HydrationBoundary
            └── MarketTerminalShell (CLIENT)
                └── MarketPageComposition (SERVER — but rendered inside client boundary)
                    ├── null guard: market=null → return null
                    └── MarketTerminalContent
                        └── MarketTradingProvider (CLIENT)
                            ├── market=null → LOADING_CONTEXT + children
                            └── market=data → MarketTradingProviderInner + children
                                └── TradingLayoutTerminal (CLIENT)
                                    ├── MarketHeaderTrading (CLIENT)
                                    │   ├── ImageWithFallback (CLIENT)
                                    │   ├── Volume/OI/Liquidity stats
                                    │   └── Watchlist toggle
                                    ├── ChartSlot (CLIENT)
                                    │   └── PolymarketKLineChart (CLIENT)
                                    │       └── PolymarketKLineChartInner (CLIENT)
                                    ├── Orderbook (CLIENT)
                                    ├── OrderForm (CLIENT)
                                    ├── TradingSelectorCard (CLIENT)
                                    └── MarketTabs (CLIENT)
                                        ├── PositionsTab (CLIENT)
                                        ├── OrdersTab (CLIENT)
                                        ├── HistoryTab (CLIENT)
                                        ├── TradesTab (CLIENT)
                                        ├── HoldersTab (CLIENT)
                                        ├── ResolutionTab (CLIENT)
                                        └── CommentsTab (CLIENT)
```

| File | Type | Why |
|------|------|-----|
| `market/[slug]/page.tsx` | SERVER | Async prefetch |
| `market/[slug]/loading.tsx` | SERVER | Returns null ❌ |
| `market-terminal-shell.tsx` | CLIENT | useQuery |
| `market-page-composition.tsx` | SERVER | But inside client boundary = client |
| `market-trading-context.tsx` | CLIENT | createContext, useState, hooks |
| `trading-layout-terminal.tsx` | CLIENT | DnD, refs, WebSocket, useSyncExternalStore |
| `trading-layout-terminal-dnd.tsx` | CLIENT | DnD sensors, refs |
| `market-header-trading.tsx` | CLIENT | useQuery, useWatchlist, useHydrated |
| `market-tabs.tsx` | CLIENT | useState, Activity |
| `orderbook.tsx` | CLIENT | useOrderbook, WebSocket |
| `order-form.tsx` | CLIENT | Complex form state |
| `order-form-ui.tsx` | CLIENT | Form UI |
| `chart-slot.tsx` | CLIENT | Dynamic import |
| `polymarket-kline-chart.tsx` | CLIENT | useQuery, useState |
| `polymarket-kline-chart-inner.tsx` | CLIENT | KLineChart imperative API |
| `kline-toolbar.tsx` | CLIENT | useState, drawing tools |
| `comments.tsx` | CLIENT | useComments, WebSocket |
| `resolution-tab.tsx` | CLIENT | useMarketTrading context |
| `quick-sell-modal.tsx` | CLIENT | useQuery, useState |
| `instant-trade-popup.tsx` | CLIENT | useQuery, useState |
| `trading-selector-card.tsx` | CLIENT | useQuery, prefetch |
| `tabs/positions-tab.tsx` | CLIENT | useQuery, useMergedMarketPositions |
| `tabs/orders-tab.tsx` | CLIENT | useQuery |
| `tabs/history-tab.tsx` | CLIENT | useInfiniteQuery |
| `tabs/trades-tab.tsx` | CLIENT | useInfiniteQuery, WebSocket |
| `tabs/holders-tab.tsx` | CLIENT | useInfiniteQuery |
| `tabs/trade-utils.tsx` | CLIENT | Skeleton, EmptyState |

**Hydration mismatch explanation**: The Suspense fallback renders `MarketTerminalShell` with `market=null` → `MarketPageComposition` returns `null`. When `MarketContent` resolves, it renders `MarketTerminalShell` with `market=data` → full terminal. React sees different DOM trees → recoverable hydration warning. This is **by design** — the alternative (blank page) is worse.

---

### `/portfolio`

```
loading.tsx → <PortfolioLoadingSkeleton /> (CLIENT)   ✅
page.tsx (SERVER)
└── Suspense fallback={<PortfolioLoadingSkeleton />}  ✅
    └── PortfolioContent (SERVER — async, prefetches via cookie)
        └── HydrationBoundary
            └── PortfolioPage (CLIENT)
                ├── PortfolioTopCards (CLIENT)
                ├── Tabs (CLIENT)
                ├── PositionTable (CLIENT)
                ├── ClosedPositionsTable (CLIENT)
                ├── OrdersTable (CLIENT)
                ├── ActivityHistory (CLIENT)
                └── RedeemTab (CLIENT)
```

| File | Type | Why |
|------|------|-----|
| `portfolio/page.tsx` | SERVER | Async prefetch |
| `portfolio/loading.tsx` | CLIENT | useState for tabs |
| `portfolio-page.tsx` | CLIENT | useWalletStore, usePortfolioData |
| `portfolio-loading-skeleton.tsx` | CLIENT | useState for tabs — could be SERVER |
| `portfolio-top-cards.tsx` | CLIENT | Complex data display |
| `position-table.tsx` | CLIENT | useQuery, sorting |
| `closed-positions.tsx` | CLIENT | useQuery, sorting |
| `orders-table.tsx` | CLIENT | useQuery |
| `activity-history.tsx` | CLIENT | useInfiniteQuery |
| `redeem-tab.tsx` | CLIENT | useRedeemPositions |
| `pnl-calendar.tsx` | CLIENT | useQuery, date state |
| `share-pnl/share-pnl-modal.tsx` | CLIENT | useState, canvas |
| `share-pnl/share-card.tsx` | SERVER | Pure render |

---

### `/watchlist`

```
loading.tsx → <WatchlistLoadingSkeleton /> (CLIENT)   ✅
page.tsx (SERVER)
└── Suspense fallback={<WatchlistLoadingSkeleton />}  ✅
    └── WatchlistContent (SERVER — async, prefetches via cookie)
        └── HydrationBoundary
            └── WatchlistPage (CLIENT)
                └── WatchlistWidgetContent (CLIENT)
                    ├── SlidingTabs (CLIENT)
                    ├── SearchBar (CLIENT)
                    └── WatchlistRow[] (CLIENT)
```

| File | Type | Why |
|------|------|-----|
| `watchlist/page.tsx` | SERVER | Async prefetch |
| `watchlist/loading.tsx` | CLIENT | SlidingTabs |
| `watchlist-page.tsx` | CLIENT | Thin wrapper |
| `watchlist-widget-content.tsx` | CLIENT | useWatchlist, useHydrated, useState |
| `watchlist-loading-skeleton.tsx` | CLIENT | SlidingTabs — could be SERVER |
| `watchlist-widget.tsx` | CLIENT | Dock widget wrapper |

---

### `/wallet-tracker`

```
loading.tsx → <WalletTrackerLoadingSkeleton /> (CLIENT) ✅
page.tsx (SERVER)
└── Suspense fallback={<WalletTrackerSkeleton />}     ✅
    └── WalletTrackerPrefetch (SERVER — async, prefetches via cookie)
        └── HydrationBoundary
            └── WalletTrackerContent (CLIENT)
                ├── SlidingTabs (CLIENT)
                ├── SearchBar (CLIENT)
                ├── WalletListSkeleton / WalletRow[] (CLIENT)
                └── TradeRow[] (CLIENT)
```

| File | Type | Why |
|------|------|-----|
| `wallet-tracker/page.tsx` | SERVER | Async prefetch |
| `wallet-tracker/loading.tsx` | CLIENT | SlidingTabs |
| `wallet-tracker-content.tsx` | CLIENT | useWalletStore, useHydrated, useQuery |
| `wallet-tracker-loading-skeleton.tsx` | CLIENT | SlidingTabs, useState |
| `wallet-tracker-widget.tsx` | CLIENT | Dock widget wrapper |
| `wallet-tracker-sound-controls.tsx` | CLIENT | useState |

---

### `/referrals`

```
loading.tsx → <ReferralsLoadingSkeleton /> (CLIENT)   ✅
page.tsx (SERVER)
└── Suspense fallback={null}                          ⚠️ Should use skeleton
    └── ReferralsContent (SERVER — async, prefetches via cookie)
        └── HydrationBoundary
            └── ReferralsPage (CLIENT)
                ├── SlidingTabs (CLIENT)
                ├── Referral code display
                ├── Stats cards
                └── Referrals table
```

| File | Type | Why |
|------|------|-----|
| `referrals/page.tsx` | SERVER | Async prefetch |
| `referrals/loading.tsx` | CLIENT | Skeleton |
| `referrals-page.tsx` | CLIENT | useQuery, useMutation |
| `referrals-loading-skeleton.tsx` | CLIENT | SlidingTabs |

---

### `/login`

```
page.tsx (SERVER)
└── LoginRedirect (CLIENT — checks auth, redirects if logged in)
    └── WalletKitLogin (CLIENT — Magic SDK widget)
```

| File | Type | Why |
|------|------|-----|
| `login/page.tsx` | SERVER | Static metadata |
| `login-redirect.tsx` | CLIENT | useMagic, useWalletStore, useEffect |
| `wallet-kit-login.tsx` | CLIENT | Magic SDK, useState |

---

### `/login/callback`

```
layout.tsx (SERVER)
└── Suspense fallback={spinner}
    └── page.tsx (SERVER)
        └── Suspense
            └── LoginCallbackPage (CLIENT)
```

---

## Layout Components

| File | Type | Why | Could be SERVER? |
|------|------|-----|-----------------|
| `app-shell.tsx` | SERVER | Composes chrome + Suspense | ✅ Already server |
| `app-shell-router.tsx` | CLIENT | usePathname, AuthGuard | No |
| `site-header.tsx` | SERVER | Composes header parts | ✅ Already server |
| `header-nav.tsx` | CLIENT | usePathname for active state | No |
| `header-actions.tsx` | CLIENT | Wallet balance, user menu | No |
| `header-search.tsx` | CLIENT | Search trigger | No |
| `header-wallet-balance.tsx` | CLIENT | useWalletStore, useQuery | No |
| `header-mobile-nav.tsx` | CLIENT | Sheet, usePathname | No |
| `bottom-bar.tsx` | CLIENT | usePathname, dock controls | No |
| `bottom-bar-shell.tsx` | SERVER | Static fallback | ✅ Already server |
| `bottom-bar-status-link.tsx` | CLIENT | Link with state | No |
| `chrome-visibility-router.tsx` | CLIENT | usePathname | No |
| `content-width.tsx` | SERVER | Pure CSS wrapper | ✅ Already server |
| `content-spacing.tsx` | SERVER | Pure CSS wrapper | ✅ Already server |
| `page-header.tsx` | SERVER | Pure render | ✅ Already server |
| `providers.tsx` | CLIENT | All providers need client | No |
| `dock-shell.tsx` | CLIENT | useRef, layout state | No |
| `dock-slot.tsx` | CLIENT | useRef | No |
| `dock-resize-handle.tsx` | CLIENT | Mouse events | No |
| `global-search.tsx` | CLIENT | useState, useEffect, cmdk | No |
| `search-results.tsx` | CLIENT | usePrefetchMarket | No |
| `search-ends-cell.tsx` | CLIENT | useRef | No |
| `watchlist-bar.tsx` | CLIENT | useWatchlist | No |
| `top-loading-bar.tsx` | CLIENT | usePathname, NProgress | No |
| `trading-settings-widget.tsx` | CLIENT | useState | No |
| `comments-context.tsx` | CLIENT | createContext, useState | No |
| `notifications-bell.tsx` | CLIENT | useNotifications | No |
| `widgets/activity-widget.tsx` | CLIENT | useGlobalActivityFeed | No |
| `widgets/activity-widget-content.tsx` | CLIENT | Data display | No |
| `widgets/calendar-widget.tsx` | CLIENT | useState, useQuery | No |
| `widgets/widget-dock-controls.tsx` | CLIENT | onClick handlers | No |
| `widgets/dock-icon-left.tsx` | SERVER | Pure SVG | ✅ Already server |
| `widgets/dock-icon-right.tsx` | SERVER | Pure SVG | ✅ Already server |

---

## Shared UI Components

| File | Type | Why | Could be SERVER? |
|------|------|-----|-----------------|
| `skeleton.tsx` | SERVER | Pure CSS | ✅ Already server |
| `spinner.tsx` | SERVER | Pure CSS | ✅ Already server |
| `empty.tsx` | SERVER | Pure render | ✅ Already server |
| `badge.tsx` | SERVER | Pure render | ✅ Already server |
| `card.tsx` | SERVER | Pure render | ✅ Already server |
| `input.tsx` | SERVER | Pure render | ✅ Already server |
| `textarea.tsx` | SERVER | Pure render | ✅ Already server |
| `doji-logo.tsx` | SERVER | Pure SVG | ✅ Already server |
| `x-icon.tsx` | SERVER | Pure SVG | ✅ Already server |
| `button.tsx` | CLIENT | base-ui Slot, ref | Needs client |
| `dialog.tsx` | CLIENT | base-ui Dialog | Needs client |
| `popover.tsx` | CLIENT | base-ui Popover | Needs client |
| `tooltip.tsx` | CLIENT | base-ui Tooltip | Needs client |
| `tabs.tsx` | CLIENT | base-ui Tabs | Needs client |
| `table.tsx` | CLIENT | Ref forwarding | Could be SERVER |
| `sliding-tabs.tsx` | CLIENT | useState, useRef, animation | Needs client |
| `search-bar.tsx` | CLIENT | onChange handler | Needs client |
| `sortable-header.tsx` | CLIENT | onClick handler | Needs client |
| `image-with-fallback.tsx` | CLIENT | useState, onLoad/onError, Image | Needs client |
| `gradient-avatar.tsx` | CLIENT | Canvas/SVG generation | Needs client |
| `sonner.tsx` | CLIENT | Toast library | Needs client |
| `scroll-area.tsx` | CLIENT | Radix ScrollArea | Needs client |
| `select.tsx` | CLIENT | base-ui Select | Needs client |
| `sheet.tsx` | CLIENT | base-ui Dialog variant | Needs client |
| `drawer.tsx` | CLIENT | Vaul drawer | Needs client |
| `accordion.tsx` | CLIENT | base-ui Accordion | Needs client |
| `checkbox.tsx` | CLIENT | base-ui Checkbox | Needs client |
| `switch.tsx` | CLIENT | base-ui Switch | Needs client |
| `slider.tsx` | CLIENT | base-ui Slider | Needs client |
| `progress.tsx` | CLIENT | base-ui Progress | Needs client |
| `separator.tsx` | CLIENT | base-ui Separator | Could be SERVER |
| `selector-chip.tsx` | CLIENT | onClick | Needs client |
| `timeframe-segment.tsx` | CLIENT | onClick | Needs client |
| `data-table.tsx` | CLIENT | useReactTable | Needs client |
| `combobox.tsx` | CLIENT | useState, popover | Needs client |
| `command.tsx` | CLIENT | cmdk | Needs client |
| `context-menu.tsx` | CLIENT | base-ui | Needs client |
| `dropdown-menu.tsx` | CLIENT | base-ui | Needs client |
| `hover-card.tsx` | CLIENT | base-ui | Needs client |
| `menubar.tsx` | CLIENT | base-ui | Needs client |
| `radio-group.tsx` | CLIENT | base-ui | Needs client |
| `resizable.tsx` | CLIENT | Mouse events | Needs client |
| `toggle.tsx` | CLIENT | base-ui | Needs client |
| `toggle-group.tsx` | CLIENT | base-ui | Needs client |
| `collapsible.tsx` | CLIENT | base-ui | Needs client |
| `calendar.tsx` | CLIENT | react-day-picker | Needs client |
| `input-otp.tsx` | CLIENT | input-otp lib | Needs client |
| `input-group.tsx` | CLIENT | Wraps input with icons | Could be SERVER |
| `field.tsx` | CLIENT | Form field wrapper | Could be SERVER |
| `label.tsx` | CLIENT | base-ui Label | Could be SERVER |
| `alert-dialog.tsx` | CLIENT | base-ui Dialog | Needs client |
| `avatar.tsx` | CLIENT | base-ui Avatar | Needs client |
| `sidebar.tsx` | CLIENT | useState, context | Needs client |
| `direction.tsx` | CLIENT | base-ui Direction | Needs client |
| `restricted-region-*.tsx` | CLIENT | Conditional rendering | Needs client |
| `loading-skeleton.tsx` | CLIENT | Skeleton wrapper | Could be SERVER |

---

## Auth Components

| File | Type | Why |
|------|------|-----|
| `auth-guard.tsx` | CLIENT | useMagic, useWalletStore, useEffect |
| `auth-button.tsx` | CLIENT | useWalletStore, onClick |
| `user-menu.tsx` | CLIENT | useWalletStore, dropdown |
| `login-redirect.tsx` | CLIENT | useMagic, useEffect |
| `wallet-kit-login.tsx` | CLIENT | Magic SDK widget |
| `magic/provider.tsx` | CLIENT | createContext, dynamic import |
| `onboarding-modal-provider.tsx` | CLIENT | createContext, useState |
| `onboarding-trigger.tsx` | CLIENT | useWalletStore |
| `steps/welcome-step.tsx` | SERVER | Pure render |
| `steps/wallet-setup-step.tsx` | CLIENT | useDeploySafe |
| `steps/fund-wallet-step.tsx` | CLIENT | useSafeBalance |
| `steps/invite-friends-step.tsx` | CLIENT | useState, tRPC mutation |

---

## Bridge Components

| File | Type | Why |
|------|------|-----|
| `bridge-page.tsx` | CLIENT | useState, tabs |
| `bridge-modal-provider.tsx` | CLIENT | createContext |
| `bridge-modal-header.tsx` | CLIENT | onClick |
| `bridge-asset-select.tsx` | CLIENT | useState, popover |
| `deposit-flow.tsx` | CLIENT | useState, useQuery |
| `withdraw-flow.tsx` | CLIENT | useState, useQuery |
| `withdraw-quote-breakdown.tsx` | CLIENT | useQuery |
| `withdraw-status-view.tsx` | CLIENT | useQuery, polling |
| `deposit-notification-card.tsx` | CLIENT | useQuery, polling |
| `withdraw-notification-card.tsx` | CLIENT | useQuery, polling |
| `token-logo.tsx` | CLIENT | Image component |

---

## Shared Hooks (all client-only)

| File | Used by |
|------|---------|
| `use-hydrated.ts` | Watchlist, wallet-tracker, market header |
| `use-geoblock.ts` | Trading terminal |
| `use-crypto-prices.ts` | RTDS subscription |
| `use-notifications.ts` | Notification bell |
| `use-prefetch-bottom-bar-widgets.ts` | Bottom bar |
| `use-sliding-tab-indicator.ts` | SlidingTabs |
| `use-table-time-tick.ts` | Table time display |
| `use-widget-resize.tsx` | Dock panels |

---

## Shared Stores (all client-only, Zustand)

| File | Persisted? | Used by |
|------|-----------|---------|
| `wallet.ts` | ✅ localStorage | Auth, trading, portfolio, everywhere |
| `connection.ts` | No | WebSocket status |
| `notifications.ts` | No | Notification bell |
| `crypto-prices.ts` | No | RTDS crypto prices |
| `balances-hidden.ts` | ✅ localStorage | Privacy toggle |

---

## Issues & Recommendations

### ❌ Critical: Market `loading.tsx` returns null
Next.js wraps navigations in `startTransition` — it keeps the previous page visible until the new page's `loading.js` is ready. With `null`, there's nothing to transition to → blank screen.
**Fix**: `loading.tsx` must render a static market terminal skeleton. This is what Next.js prefetches and shows during client navigation.

### ⚠️ Minor: Referrals Suspense fallback is null
Brief blank during server streaming.
**Fix**: Use `<ReferralsLoadingSkeleton />`.

### ⚠️ Accept: Market page hydration warnings
`MarketTerminalShell` renders different DOM for `market=null` vs `market=data`. This is a **recoverable** error — React regenerates the tree on the client. The console warning is cosmetic. **Do not try to fix** — every attempt broke images, caused blank pages, or created worse issues.

### ✅ Correct: Portfolio, Watchlist, Wallet-Tracker pattern
`loading.tsx` = skeleton, Suspense fallback = same skeleton, async server prefetch, HydrationBoundary.
This is the gold standard pattern.

### 💡 Opportunity: Loading skeletons could be Server Components
Many skeletons use `"use client"` only for `SlidingTabs` or `useState`. If tabs were replaced with static HTML, these could be server components — rendering in the initial HTML without JS.

---

## Key Rules from Next.js/React Docs

### `loading.js` behavior
- `loading.js` automatically wraps `page.js` in a `<Suspense>` boundary
- It does **NOT** wrap `layout.js` in the same segment
- The fallback is **prefetched** — making navigation immediate (if prefetching completes)
- On client navigation, Next.js shows `loading.js` while the new page loads
- **If `loading.js` returns null, the user sees nothing during navigation**

### `"use client"` boundary rules
- `"use client"` defines a boundary — all imports and child modules become client code
- You don't need `"use client"` on every file — only on entry points
- Server Components can be passed as `children` to Client Components (interleaving)
- A component without `"use client"` can be BOTH server and client depending on where it's imported

### Suspense + Transitions
- Next.js router wraps navigations in `startTransition` automatically
- During a transition, React keeps showing the previous page instead of the fallback
- Only **newly rendered** Suspense boundaries show fallbacks during transitions
- `suppressHydrationWarning` only suppresses on the element itself, **not children**

### Hydration mismatches
- Server and client must render the same DOM tree on first render
- `typeof window !== 'undefined'` branches cause mismatches
- `Date.now()`, `Math.random()`, locale-dependent formatting cause mismatches
- Browser extensions can cause mismatches
- Recoverable mismatches: React regenerates the tree on the client (console warning only)
- **Do not chase recoverable hydration warnings by changing component internals** — the cure is often worse than the disease

---

## The Correct Pattern (from docs)

```
loading.tsx          → <PageSkeleton />     (prefetched, shown during client nav)
page.tsx             → Server Component
  Suspense fallback  → <PageSkeleton />     (shown during server streaming)
    AsyncContent     → Async Server Component (prefetch + HydrationBoundary)
      PageComponent  → "use client" (renders with dehydrated data)
```

**Why both `loading.tsx` AND Suspense fallback?**
- `loading.tsx` = route-level Suspense (wraps `page.js` automatically)
- Suspense in `page.tsx` = component-level Suspense (wraps async server component)
- On hard refresh: Suspense fallback shows (server streaming)
- On client nav: `loading.tsx` shows (prefetched, instant)
- They should render the **same skeleton** for consistency

**Why skeletons must be static:**
- `loading.js` is prefetched by Next.js — it must render without data
- Skeletons should not depend on auth state, query results, or Zustand stores
- Skeletons should match the page chrome (tabs, headers, search bars) but with placeholder content

**What NOT to do:**
- Don't use the real client component as a Suspense fallback (causes hydration mismatch when data differs)
- Don't gate image rendering on `useHydrated()` (breaks SSR images globally)
- Don't remove null guards from components to "fix" hydration warnings
- Don't restructure `ImageWithFallback` DOM to unify charBadge/image paths
- Don't remove `<Suspense>` from context providers to fix warnings

---

## Refactoring Plan: Chrome + Data Split

### Goal
Page chrome (tabs, search, table headers, card outlines) is **always visible** on every navigation type. Only data values show skeletons. No double skeletons. No blank pages.

### Current Problem
```
page.tsx
└── <Suspense fallback={<FullPageSkeleton />}>   ← wraps EVERYTHING
    └── <AsyncContent>
        └── <HydrationBoundary>
            └── <MonolithicPageComponent />       ← chrome + data intertwined
```

When Suspense triggers, the entire page disappears and is replaced by the skeleton.

### Target Architecture
```
page.tsx
├── <PageChrome />                                ← ALWAYS visible (server HTML)
│   ├── Tabs, search bar, table headers
│   └── <Suspense fallback={<DataRowSkeletons />}>  ← only wraps DATA
│       └── <AsyncDataContent />
│           └── <HydrationBoundary>
│               └── <DataRows />                  ← actual data only
```

Chrome renders immediately as static HTML. Only data rows/values are behind Suspense.

### Per-Page Refactoring

#### `/portfolio` — Split into PortfolioChrome + PortfolioData
- **Chrome** (always visible): ContentWidth, ContentSpacing, Tabs (Active Positions, Closed, Orders, History, Redeem), search bar, filter pills, table column headers, top cards outline
- **Data** (behind Suspense): position rows, order rows, activity rows, stat values (portfolio value, cash balance, PnL numbers)
- **`loading.tsx`**: `<PortfolioChrome><DataRowSkeletons /></PortfolioChrome>`
- **Suspense fallback**: same as `loading.tsx`

#### `/watchlist` — Split into WatchlistChrome + WatchlistData
- **Chrome**: SlidingTabs (Favorites, With Holdings), search bar, star count, table column headers (Market, Yes, No, Shares, Value, Added)
- **Data**: watchlist rows
- **`loading.tsx`**: `<WatchlistChrome><DataRowSkeletons /></WatchlistChrome>`

#### `/wallet-tracker` — Split into WalletTrackerChrome + WalletTrackerData
- **Chrome**: SlidingTabs (Wallets, Trades), search bar, Add Wallet button, table column headers
- **Data**: wallet rows, trade rows
- **`loading.tsx`**: `<WalletTrackerChrome><DataRowSkeletons /></WalletTrackerChrome>`

#### `/leaderboard` — Already close to correct
- **Chrome**: SearchBar, time period buttons, filters button (already in LeaderboardPageSkeleton)
- **Data**: leaderboard table rows
- **Status**: LeaderboardPageSkeleton already renders chrome. Just needs the Suspense boundary pushed down to wrap only the table body, not the whole page.

#### `/referrals` — Split into ReferralsChrome + ReferralsData
- **Chrome**: SlidingTabs, referral code card outline, stats card outlines, table column headers
- **Data**: referral code value, stat numbers, referral rows
- **`loading.tsx`**: `<ReferralsChrome><DataRowSkeletons /></ReferralsChrome>`
- **Suspense fallback**: same (currently `null` — needs fixing)

#### `/explore` — Already correct ✅
- `EventsDiscovery` renders chrome immediately (category tabs, table headers, filters)
- Data rows load via `useInfiniteQuery` with client-side skeletons
- PPR with `unstable_instant` makes client nav instant

#### `/market/[slug]` — Special case (accept hydration warnings)
- Terminal layout depends on market data (tokens, chart, orderbook)
- `MarketTerminalShell` with `market=null` renders LOADING_CONTEXT shell
- Hydration warnings are recoverable — React handles them
- `loading.tsx` should render `MarketTerminalShell` for client nav
- **Do not refactor** — the trading terminal is too deeply intertwined

### Implementation Order
1. `/watchlist` — simplest, good reference implementation
2. `/wallet-tracker` — similar structure
3. `/portfolio` — more complex (5 tabs, top cards)
4. `/referrals` — straightforward
5. `/leaderboard` — already close, just push Suspense down
6. `/market/[slug]` — leave as-is, accept warnings

### Chrome Component Rules
1. Chrome components should be **server components** when possible (no `"use client"`)
2. If chrome needs interactivity (tabs, search), use the **children slot pattern**: server chrome wraps client data via `{children}`
3. Chrome must render **identical HTML** whether used in `loading.tsx`, Suspense fallback, or the real page
4. Table column headers in chrome must match the real table's grid exactly
5. No data-dependent content in chrome (no counts, no conditional columns)

### Skeleton Rules
1. Only skeleton **data values** — not chrome, not structure
2. Skeleton rows should fill the available height (use `flex-1`)
3. Use `<Skeleton>` from `shared/components/ui/skeleton` — consistent pulse animation
4. No `useState` in skeletons if possible — keeps them as server components
5. `loading.tsx` === Suspense fallback === same component — prevents double skeleton

### What Stays As-Is
- `AppShell` chrome rendering (header, footer, dock) — already correct
- `AuthGuard` with `loadingFallback={children}` — already correct
- `ChromeVisibility` pattern — already correct
- Market page `MarketTerminalShell` as Suspense fallback — accept warnings
- Explore page `EventsDiscovery` as Suspense fallback — already correct
- `ImageWithFallback` — don't touch, accept hydration warnings
