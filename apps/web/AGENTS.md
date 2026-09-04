# Web App (V2)

> Scope: `apps/web` — inherits root [AGENTS.md](../../AGENTS.md). Read domain-specific AGENTS.md before touching that domain.

Next.js 16.2 (canary) frontend for the Robinhood Chain Basket Terminal.

## Quick Facts

- **Port:** 3000
- **Commands:** `pnpm dev:web`, `pnpm build`, `pnpm check-types`, `pnpm test`, `pnpm react-doctor`
- **Env:** `apps/web/.env.example`; client vars are `NEXT_PUBLIC_*`
- **Import alias:** `@/` → `apps/web/src/`

## Project Structure (V2)

```
src/
├── app/                     # Next.js App Router
│   ├── (app)/               # Main route group
│   │   └── baskets/         # Basket terminal routes
│   │       ├── page.tsx     # Baskets directory
│   │       └── [basketId]/  # Basket terminal page
│   ├── api/                 # Route handlers
│   │   ├── image-proxy/
│   │   ├── status/
│   │   └── report-bug/      # Discord webhook
│   ├── dev/                 # Dev-only pages (error-test)
│   └── page.tsx             # Home page (basket catalog + hero)
├── domains/                 # Feature modules
│   └── baskets/             # Basket trading domain
│       ├── components/      # UI components
│       │   ├── allocation-preview.tsx
│       │   ├── basket-card.tsx
│       │   ├── basket-card-skeleton.tsx
│       │   ├── basket-catalog-grid.tsx
│       │   ├── basket-chart.tsx
│       │   ├── basket-selector.tsx
│       │   ├── buy-panel.tsx
│       │   ├── composite-index-chart.tsx
│       │   ├── constituent-list.tsx
│       │   ├── constituent-list-item.tsx
│       │   ├── currency-toggle.tsx
│       │   ├── exit-panel.tsx
│       │   ├── home-hero.tsx
│       │   ├── order-panel.tsx
│       │   ├── quick-buy-presets.tsx
│       │   ├── timeframe-selector.tsx
│       │   ├── token-candlestick-chart.tsx
│       │   ├── token-toggle-chips.tsx
│       │   ├── tx-status-badge.tsx
│       │   └── wrong-network-banner.tsx
│       ├── hooks/
│       │   ├── use-allocation-preview.ts
│       │   ├── use-basket-buy.ts
│       │   ├── use-basket-exit.ts
│       │   ├── use-basket-prices.ts
│       │   └── use-ohlcv.ts
│       ├── lib/
│       │   ├── allocation.ts       # computeAllocation() — weight → ETH/USD splits
│       │   ├── composite-index.ts  # computeCompositeIndex() — normalized index
│       │   └── format-tx.ts        # formatTxHash(), blockExplorerTxUrl()
│       └── stores/
│           └── basket-terminal.ts  # Timeframe + activeTokens state
├── shell/                   # App chrome (header, nav, dock, bottom bar)
│   ├── providers.tsx        # WagmiProvider + QueryClient + WalletSyncProvider
│   ├── app-shell.tsx        # Main layout shell (Server Component)
│   ├── app-shell-router.tsx # Client router wrapper
│   ├── site-header.tsx      # Header
│   ├── header-nav.tsx       # Nav links (/ and /baskets)
│   ├── header-actions.tsx   # Wallet connect / truncated address display
│   ├── bottom-bar.tsx       # Bottom bar (BugReportWidget + BottomBarStatusLink)
│   ├── wallet-sync-provider.tsx  # Syncs wagmi useAccount() → Zustand wallet store
│   ├── dock-shell.tsx       # Dock panel container
│   └── stores/              # dock-layout (panel visibility)
├── hooks/                   # Shared hooks (cross-domain)
│   ├── use-hydrated.ts      # Post-mount flag
│   └── use-wallet-persist-hydrated.ts
├── stores/                  # Shared Zustand stores
│   ├── wallet.ts            # Slimmed: address, chainId, isConnected (wagmi-synced)
│   ├── preferences.ts       # User preferences
│   └── notifications.ts     # Notification state
├── lib/                     # Shared libraries
│   ├── trpc/                # tRPC client + server callers
│   │   ├── index.ts         # Client: trpc, trpcClient helpers
│   │   ├── server.ts        # serverTrpc for RSC prefetching
│   │   ├── query-client.ts  # getQueryClient(), cached server fetches
│   │   ├── keys.ts          # Query key helpers
│   │   ├── errors.ts        # Error handling
│   │   └── types.ts         # tRPC type helpers
│   ├── flags/               # Feature flags
│   │   ├── definitions.ts   # Flag definitions (server-only, Edge Config)
│   │   ├── client.ts        # Client-side flag access
│   │   ├── provider.tsx     # Flag context provider
│   │   └── guards.ts        # Flag guard utilities
│   ├── sentry/              # Sentry integration
│   ├── analytics/           # Vercel Web Analytics
│   ├── seo/                 # Metadata + JSON-LD
│   ├── cookies/             # Cookie helpers
│   ├── og/                  # OpenGraph image utils
│   ├── server-cache.ts      # LRU caches
│   ├── session-manager.ts   # Stub (no JWT; wagmi handles auth)
│   └── app-toast.ts         # Toast helpers
├── ui/                      # UI primitives (shadcn/ui + custom)
├── utils/                   # Pure helpers
│   ├── cn.ts                # clsx + twMerge
│   ├── format.ts            # Number/currency formatting
│   └── ...
├── config/                  # App configuration
│   ├── app.ts               # BASE_URL, app constants
│   ├── chains.ts            # robinhoodChain (viem defineChain), ROBINHOOD_CHAIN_ID = 4663
│   ├── baskets.ts           # BASKETS array, getBasketById(), validateBaskets()
│   ├── query.ts             # gcTime, staleTime tiers
│   └── index.ts             # Re-exports
├── fonts/                   # Inter variable font
└── index.css                # Design tokens
```

## Routes

| Route | Group | Description |
|-------|-------|-------------|
| `/` | — | Home page (basket catalog + hero) |
| `/baskets` | `(app)` | Baskets directory |
| `/baskets/[basketId]` | `(app)` | Basket terminal |

## Where to Look

| Task | Path |
|------|------|
| Add a page | `app/(app)/{route}/page.tsx` |
| Add a basket component | `domains/baskets/components/` |
| Add a basket hook | `domains/baskets/hooks/` |
| Add a basket store | `domains/baskets/stores/` |
| Add a shared hook | `hooks/` |
| Add a shared store | `stores/` |
| Add a UI component | `ui/` |
| Add a utility | `utils/` |
| Change app config | `config/` |
| Change chain config | `config/chains.ts` |
| Change basket config | `config/baskets.ts` |
| Change shell/nav | `shell/` (header-nav, bottom-bar, etc.) |
| Add feature flag | `lib/flags/definitions.ts` |
| Add analytics event | `lib/analytics/analytics-events.ts` |
| Change tRPC client | `lib/trpc/` |
| Change server prefetch | `lib/trpc/server.ts` + `lib/trpc/query-client.ts` |

## Key Files

| File | Purpose |
|------|---------|
| `stores/wallet.ts` | Slimmed wallet: address, chainId, isConnected only (wagmi-synced) |
| `stores/preferences.ts` | User preferences |
| `config/chains.ts` | `robinhoodChain` viem config, `ROBINHOOD_CHAIN_ID = 4663`, `SUPPORTED_CHAINS` |
| `config/baskets.ts` | `BASKETS` array, `getBasketById()`, `validateBaskets()` |
| `shell/providers.tsx` | WagmiProvider + QueryClient + WalletSyncProvider + other providers |
| `shell/wallet-sync-provider.tsx` | Syncs wagmi `useAccount()` state into Zustand wallet store |
| `shell/header-nav.tsx` | Nav links for `/` (Home) and `/baskets` (Baskets) |
| `shell/header-actions.tsx` | Wallet connect / disconnect / truncated address + ETH balance |
| `domains/baskets/stores/basket-terminal.ts` | Timeframe + activeTokens state for basket terminal |
| `domains/baskets/lib/composite-index.ts` | `computeCompositeIndex()` — normalized index from OHLCV data |
| `domains/baskets/lib/allocation.ts` | `computeAllocation()` — per-token ETH/USD split preview |
| `domains/baskets/lib/format-tx.ts` | `formatTxHash()`, `blockExplorerTxUrl()` for Robinhood Chain |
| `lib/session-manager.ts` | Stub (no JWT; wagmi handles auth) |
| `lib/trpc/server.ts` | `serverTrpc` for RSC prefetching (no auth variant needed) |
| `lib/trpc/query-client.ts` | `getQueryClient()`, cached fetches, cache tag docs |
| `config/query.ts` | `STALE_REALTIME` (10s), `STALE_DEFAULT` (30s), `STALE_STABLE` (5min), `STALE_STATIC` (30min) |

## Domain AGENTS.md Index

| Domain | File |
|--------|------|
| Baskets | `domains/baskets/AGENTS.md` (create if needed) |
| Shell | `shell/AGENTS.md` |

## Performance Architecture

PPR (Partial Prerendering) delivers layout chrome instantly. Server prefetching eliminates client waterfalls. Multi-layer caching reduces API round trips.

### Rendering Pipeline

1. **Static shell** — Root layout → `shell/providers.tsx` → `shell/app-shell.tsx` → children. Header/nav in prerendered HTML.
2. **Server caching** — `"use cache"` + `cacheLife("minutes")` + `cacheTag` on cached fetches. LRU in-memory layer (`lib/server-cache.ts`) deduplicates concurrent requests.
3. **Server prefetch** — `getQueryClient()` + `dehydrate()` + `<HydrationBoundary>`. Pages use `serverTrpc` for public data. Streaming dehydration enabled.
4. **Streaming** — `<Suspense>` boundaries around dynamic content. Push boundaries down to individual regions, never wrap entire page.
5. **Client optimizations** — `content-visibility: auto` on long lists, `startTransition` on sort/filter, React 19 `<Activity>` for tab state, module-level `select` functions.

### Caching Layers

| Layer | Scope | API | TTL |
|-------|-------|-----|-----|
| Request dedup | Single request | `React.cache()` | Request lifetime |
| In-memory LRU | Cross-request, same process | `lru-cache` | 30–60s |
| Framework cache | Cross-request, persistent | `"use cache"` + `cacheLife` | 1h expire, 1m revalidate |

### Key Gotchas

- `next/dynamic` with `ssr: false` is NOT allowed in Server Components — wrap in `"use client"` component.
- `QueryClient` uses `Date.now()` internally. In PPR, call `await connection()` first with a `<Suspense>` boundary above.
- `"use cache"` functions are still static for PPR — they don't satisfy "uncached data access".
- `cacheLife` expire must be ≥5 minutes for PPR static shell eligibility.
- `lib/trpc/server.ts` imports `"server-only"` — never bundle client-side.

## tRPC Conventions

- **Queries:** `useQuery(trpc.{router}.{proc}.queryOptions(input))` — use `skipToken` when input absent.
- **Mutations:** `trpcClient.{router}.{proc}.mutate(input)` for imperative calls (e.g. `trpcClient.baskets.getBundle.mutate`).
- **Server prefetch:** `serverTrpc` in page Server Components for public data.
- **Invalidation:** `trpc.{router}.{proc}.queryKey()` for procedure-level cache invalidation.

## Design System

**Always use** design tokens in `src/index.css`. See root AGENTS.md § Design System for full rules.

- **Typography:** 6-size scale only: `text-3xl`, `text-2xl`, `text-lg`, `text-sm`, `text-xs`, `text-[10px]`
- **Weights:** `font-normal` (400) and `font-medium` (500) only
- **Colors:** `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-muted` — never hardcode
- **Buttons:** `Button` from `@/ui/button` — no raw `<button>`
- **Inputs:** `Input`, `InputGroup`, `Textarea`, `NativeSelect` from `@/ui/*`
- **Tooltips:** No `title` attribute — use `@/ui/tooltip` or `aria-label`
- **Brand accent:** `--doji-green` (`#DBFF55`) for active states, primary buttons, chart gradients

## Finish the Task

- [ ] Run `pnpm fix` before committing.
- [ ] Update this AGENTS.md if you changed routes, key files, or structure.
- [ ] Summarize changes in conventional commit form (e.g. `feat(web): ...`, `fix(web): ...`).
