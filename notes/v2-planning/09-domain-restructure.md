# 09 — Domain Restructure

> `features/` → `domains/`, `layout/` → `shell/`, `shared/` decomposition

**Status:** Planned — do LAST (lowest value-per-effort, highest churn)
**Effort:** ~2 days mechanical work
**Risk:** Zero behavior change — purely cosmetic rename

---

## 1. Why This Change

**`features/` → `domains/`** — "features" is a generic React convention. "domains" is a DDD convention that better describes what these directories actually are: bounded business domains (trading, portfolio, bridge). Domain names outlive page names and framework conventions.

**`layout/` → `shell/`** — "shell" is more descriptive of what this directory does: it's the application shell (chrome, nav, dock, widgets), not just "layout."

**`shared/` decomposition** — `shared/` is a junk drawer. Everything cross-cutting ends up there, making it hard to find anything. Splitting into specific top-level dirs (`lib/`, `stores/`, `hooks/`, `utils/`, `ui/`, `config/`) makes the import path self-documenting:
- `@/ui/button` vs `@/shared/components/ui/button`
- `@/lib/trpc` vs `@/shared/lib/trpc`
- `@/stores/wallet` vs `@/shared/stores/wallet`

---

## 2. Current State

### Directory Structure (`apps/web/src/`)

```
features/
  auth/           — login, onboarding, Magic SDK, wallet login
  trading/        — order form, orderbook, charts, market pages
  explore/        — event discovery, category browsing
  portfolio/      — position tables, redeem, PnL sharing
  bridge/         — USDC deposit/withdraw
  watchlist/      — watchlist widget
  wallet-tracker/ — wallet tracking
  leaderboard/    — top trader rankings
  profile/        — profile hover card & modal
  comments/       — market comments
  referrals/      — invite codes & stats
layout/           — app shell, header, nav, dock, widgets
shared/
  components/ui/  — shadcn/ui + custom components (~60 files)
  components/     — non-UI shared components (7 files)
  hooks/          — shared hooks (8 files)
  stores/         — global Zustand stores (4 files)
  lib/            — tRPC, WebSocket, SEO, analytics, cookies, etc.
  constants/      — query staleTime tiers, app constants
  utils/          — pure helpers (9 files)
  config/         — app config, feature flags
```

### Import Counts (measured)

| Pattern | Files | Matches |
|---------|-------|---------|
| `@/features/*` | 177 | 594 |
| `@/shared/*` | 340 | 1,147 |
| `@/layout/*` | 43 | 82 |

#### `@/shared/*` breakdown

| Sub-pattern | Files | Matches |
|-------------|-------|---------|
| `@/shared/components/ui/*` | 147 | 361 |
| `@/shared/lib/*` | 171 | 380 |
| `@/shared/utils/*` | 189 | 211 |
| `@/shared/stores/*` | 64 | 68 |
| `@/shared/constants/*` | 41 | 41 |
| `@/shared/hooks/*` | 29 | 33 |
| `@/shared/config/*` | 24 | 24 |
| `@/shared/components/` (non-ui) | 17 | 19 |

### tsconfig.json Path Alias

```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

Single wildcard alias — no changes needed. All renames are under `src/`, so `@/` continues to resolve correctly.

---

## 3. V2 Target Structure

```
apps/web/src/
  domains/
    account/        — auth + profile (merged)
    onboarding/     — first-time setup (split from auth)
    explore/        — event discovery
    trading/        — order form, orderbook, charts, market pages, comments
    portfolio/      — positions, activity, PnL
    bridge/         — deposit/withdraw
    referrals/      — invite codes
    watchlist/      — saved markets
    tracker/        — wallet tracking (renamed from wallet-tracker)
    leaderboard/    — rankings
  shell/            — app shell, header, nav, dock, widgets (renamed from layout)
  lib/              — technical infrastructure (from shared/lib)
  stores/           — global Zustand stores (from shared/stores)
  hooks/            — global hooks (from shared/hooks)
  utils/            — pure functions (from shared/utils)
  config/           — app config + constants (from shared/config + shared/constants)
  ui/               — design system components (from shared/components/ui)
  app/              — (unchanged) Next.js App Router pages
```

---

## 4. Sub-Renames Within Domains

### `features/auth/` → split into `domains/account/` + `domains/onboarding/`

Auth is two concerns jammed together:
- **Account** — login, session, auth guards, user menu, wallet-kit login, Magic SDK, Safe registration
- **Onboarding** — first-time setup wizard, account setup phase, design simulator, fund wallet step

Split rule: anything under `features/auth/components/onboarding/` → `domains/onboarding/`. Everything else → `domains/account/`.

### `features/profile/` → merge into `domains/account/`

Profile (hover card, modal, utils) is tightly coupled to the authenticated user. Move to `domains/account/components/profile/`.

### `features/wallet-tracker/` → `domains/tracker/`

Shorter name, consistent with other single-word domain names.

### `features/comments/` → merge into `domains/trading/`

Comments are market-specific — they only appear on market pages. Move to `domains/trading/components/comments/`.

### Summary

| Current | Target | Action |
|---------|--------|--------|
| `features/auth/` (non-onboarding) | `domains/account/` | Rename + merge profile |
| `features/auth/components/onboarding/` | `domains/onboarding/` | Split out |
| `features/profile/` | `domains/account/components/profile/` | Merge |
| `features/trading/` | `domains/trading/` | Rename + absorb comments |
| `features/explore/` | `domains/explore/` | Rename |
| `features/portfolio/` | `domains/portfolio/` | Rename |
| `features/bridge/` | `domains/bridge/` | Rename |
| `features/referrals/` | `domains/referrals/` | Rename |
| `features/watchlist/` | `domains/watchlist/` | Rename |
| `features/wallet-tracker/` | `domains/tracker/` | Rename |
| `features/leaderboard/` | `domains/leaderboard/` | Rename |
| `features/comments/` | `domains/trading/components/comments/` | Merge |

---

## 5. `shared/` Decomposition

| Current Path | Target Path | Import Change |
|-------------|-------------|---------------|
| `shared/components/ui/` | `ui/` | `@/shared/components/ui/button` → `@/ui/button` |
| `shared/hooks/` | `hooks/` | `@/shared/hooks/use-geoblock` → `@/hooks/use-geoblock` |
| `shared/stores/` | `stores/` | `@/shared/stores/wallet` → `@/stores/wallet` |
| `shared/utils/` | `utils/` | `@/shared/utils/cn` → `@/utils/cn` |
| `shared/config/` | `config/` | `@/shared/config/app` → `@/config/app` |
| `shared/constants/` | `config/` (merge) | `@/shared/constants/query` → `@/config/query` |
| `shared/lib/trpc/` | `lib/trpc/` | `@/shared/lib/trpc` → `@/lib/trpc` |
| `shared/lib/websocket/` | `lib/ws/` | `@/shared/lib/websocket/market-channel` → `@/lib/ws/market-channel` |
| `shared/lib/analytics/` | `lib/analytics/` | `@/shared/lib/analytics/track-web` → `@/lib/analytics/track-web` |
| `shared/lib/seo/` | `lib/seo/` | `@/shared/lib/seo/metadata` → `@/lib/seo/metadata` |
| `shared/lib/cookies/` | `lib/cookies/` | `@/shared/lib/cookies/set-client-cookie` → `@/lib/cookies/set-client-cookie` |
| `shared/lib/dev/` | `lib/dev/` | `@/shared/lib/dev/*` → `@/lib/dev/*` |
| `shared/lib/og/` | `lib/og/` | `@/shared/lib/og/*` → `@/lib/og/*` |
| `shared/lib/*.ts` (loose files) | `lib/*.ts` | `@/shared/lib/session-manager` → `@/lib/session-manager` |
| `shared/components/*.tsx` (non-ui) | Per-domain or `ui/` | Case-by-case — see below |

### Non-UI shared components disposition

| File | Target | Rationale |
|------|--------|-----------|
| `session-cookie-sync.tsx` | `lib/session-cookie-sync.tsx` | Infrastructure, not UI |
| `analytics-scripts.tsx` | `lib/analytics/scripts.tsx` | Analytics infrastructure |
| `error-fallback.tsx` | `ui/error-fallback.tsx` | Generic UI component |
| `full-page-status.tsx` | `ui/full-page-status.tsx` | Generic UI component |
| `inline-query-error.tsx` | `ui/inline-query-error.tsx` | Generic UI component |
| `json-ld-default.tsx` | `lib/seo/json-ld-default.tsx` | SEO infrastructure |
| `user-channel-setup.tsx` | `lib/ws/user-channel-setup.tsx` | WebSocket infrastructure |

---

## 6. Rename Automation Script

Execute in order. Each phase is independently verifiable.

### Phase 1: Bulk directory renames (simple 1:1 moves)

```bash
cd apps/web/src

# features/ → domains/ (straight renames)
mv features domains
mv domains/wallet-tracker domains/tracker

# layout/ → shell/
mv layout shell

# shared/ decomposition
mv shared/components/ui ui
mv shared/hooks hooks
mv shared/stores stores
mv shared/utils utils
mv shared/lib lib
mkdir -p config
mv shared/config/* config/
mv shared/constants/* config/

# Remaining shared/components/ (non-ui) — move individually
mv shared/components/session-cookie-sync.tsx lib/session-cookie-sync.tsx
mv shared/components/analytics-scripts.tsx lib/analytics/scripts.tsx
mv shared/components/error-fallback.tsx ui/error-fallback.tsx
mv shared/components/full-page-status.tsx ui/full-page-status.tsx
mv shared/components/inline-query-error.tsx ui/inline-query-error.tsx
mv shared/components/json-ld-default.tsx lib/seo/json-ld-default.tsx
mv shared/components/user-channel-setup.tsx lib/ws/user-channel-setup.tsx

# Rename websocket → ws
mv lib/websocket lib/ws

# Clean up empty shared/
rm -rf shared
```

### Phase 2: Sub-domain splits

```bash
cd apps/web/src

# Split auth → account + onboarding
mkdir -p domains/onboarding
mv domains/account/components/onboarding domains/onboarding/components

# Merge profile → account
mkdir -p domains/account/components/profile
mv domains/profile/components/* domains/account/components/profile/
mv domains/profile/lib/* domains/account/lib/ 2>/dev/null
rm -rf domains/profile

# Merge comments → trading
mkdir -p domains/trading/components/comments
mv domains/comments/components/* domains/trading/components/comments/
rm -rf domains/comments
```

### Phase 3: Bulk import updates

```bash
cd /home/kaizen/dev/doji

# Primary renames (order matters — do specific patterns before general ones)
find apps/web/src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i \
  -e 's|@/features/wallet-tracker/|@/domains/tracker/|g' \
  -e 's|@/features/|@/domains/|g' \
  -e 's|@/layout/|@/shell/|g' \
  -e 's|@/shared/components/ui/|@/ui/|g' \
  -e 's|@/shared/hooks/|@/hooks/|g' \
  -e 's|@/shared/stores/|@/stores/|g' \
  -e 's|@/shared/utils/|@/utils/|g' \
  -e 's|@/shared/constants/|@/config/|g' \
  -e 's|@/shared/config/|@/config/|g' \
  -e 's|@/shared/lib/websocket/|@/lib/ws/|g' \
  -e 's|@/shared/lib/|@/lib/|g' \
  -e 's|@/shared/components/|@/ui/|g' \
  {} +

# Handle sub-domain splits (profile → account, comments → trading)
find apps/web/src -type f \( -name '*.ts' -o -name '*.tsx' \) -exec sed -i \
  -e 's|@/domains/profile/|@/domains/account/components/profile/|g' \
  -e 's|@/domains/comments/|@/domains/trading/components/comments/|g' \
  {} +
```

### Phase 4: Verify

```bash
# Type check — catches any missed imports
pnpm check-types

# Lint + format
pnpm fix

# Full build
pnpm build

# Confirm no stale imports remain
echo "--- Stale import check ---"
grep -r '@/features/' apps/web/src --include='*.ts' --include='*.tsx' -l && echo "FAIL: @/features/ still present" || echo "OK: no @/features/"
grep -r '@/layout/' apps/web/src --include='*.ts' --include='*.tsx' -l && echo "FAIL: @/layout/ still present" || echo "OK: no @/layout/"
grep -r '@/shared/' apps/web/src --include='*.ts' --include='*.tsx' -l && echo "FAIL: @/shared/ still present" || echo "OK: no @/shared/"
```

---

## 7. tsconfig.json Changes

**None required.** The single path alias `"@/*": ["./src/*"]` is a wildcard — all renames happen under `src/`, so the alias continues to resolve correctly. No new aliases needed.

---

## 8. AGENTS.md Updates

40 AGENTS.md files exist in the repo. The following **25 files** reference `features/`, `layout/`, or `shared/` paths and need updates:

### Root-level (path tables, import aliases, "Where to Look")

| File | What to update |
|------|---------------|
| `.ruler/AGENTS.md` | Repository tour, sub-AGENTS.md directory table, "Where to Look" table, import aliases |
| `README.md` | Project structure tree, documentation table |

### Web app

| File | What to update |
|------|---------------|
| `apps/web/AGENTS.md` | Routes, structure, feature module list |
| `apps/web/src/shared/AGENTS.md` | → Move to `apps/web/src/lib/AGENTS.md` or remove (content split across new dirs) |
| `apps/web/src/shared/lib/websocket/AGENTS.md` | → Move to `apps/web/src/lib/ws/AGENTS.md` |
| `apps/web/src/layout/AGENTS.md` | → Move to `apps/web/src/shell/AGENTS.md` |

### Web feature AGENTS.md files (all move to `domains/`)

| Current | Target |
|---------|--------|
| `apps/web/src/features/auth/AGENTS.md` | `apps/web/src/domains/account/AGENTS.md` (rewrite for merged scope) |
| `apps/web/src/features/profile/AGENTS.md` | Remove (merged into account) |
| `apps/web/src/features/trading/AGENTS.md` | `apps/web/src/domains/trading/AGENTS.md` |
| `apps/web/src/features/explore/AGENTS.md` | `apps/web/src/domains/explore/AGENTS.md` |
| `apps/web/src/features/portfolio/AGENTS.md` | `apps/web/src/domains/portfolio/AGENTS.md` |
| `apps/web/src/features/bridge/AGENTS.md` | `apps/web/src/domains/bridge/AGENTS.md` |
| `apps/web/src/features/referrals/AGENTS.md` | `apps/web/src/domains/referrals/AGENTS.md` |
| `apps/web/src/features/watchlist/AGENTS.md` | `apps/web/src/domains/watchlist/AGENTS.md` |
| `apps/web/src/features/wallet-tracker/AGENTS.md` | `apps/web/src/domains/tracker/AGENTS.md` |
| `apps/web/src/features/leaderboard/AGENTS.md` | `apps/web/src/domains/leaderboard/AGENTS.md` |
| `apps/web/src/features/comments/AGENTS.md` | Remove (merged into trading) |

### New AGENTS.md files to create

| File | Scope |
|------|-------|
| `apps/web/src/domains/onboarding/AGENTS.md` | Onboarding wizard (split from auth) |

### Files that reference web paths (update cross-references)

| File | What to update |
|------|---------------|
| `apps/server/src/features/trading/AGENTS.md` | Cross-references to web trading paths |
| `apps/server/src/shared/AGENTS.md` | Cross-references to web shared paths |
| `packages/api/AGENTS.md` | References to web tRPC client paths |
| `packages/hooks/AGENTS.md` | References to web hooks paths |
| `tests/AGENTS.md` | References to web source paths in test imports |

### Ruler source files

| File | What to update |
|------|---------------|
| `.ruler/AGENTS.md` | Source of truth — regenerate with `pnpm ruler` after all moves |
| `.ruler/common-patterns.md` | "Add a UI component" path references |
| `.ruler/nextjs-rules.md` | Any `shared/lib/` references |

After updating all files, run `pnpm ruler` to regenerate the compiled `AGENTS.md` and `CLAUDE.md` at root.

---

## 9. Risk Assessment

### What can go wrong

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Missed import update → compile error | Medium | Low | `pnpm check-types` catches 100% of these |
| Relative imports within moved dirs break | Low | Low | `sed` handles `@/` imports; relative imports within a dir survive `mv` |
| AGENTS.md cross-references stale | High | Low | Grep for old paths after rename |
| Other PRs in flight conflict | High | High | Do on a quiet day, merge fast |
| Git blame history lost | Certain | Low | `git log --follow` still works; `mv` is detected as rename |

### What cannot go wrong

- **Zero runtime behavior change** — this is purely a directory/import rename
- **No API changes** — server is untouched
- **No database changes** — schema is untouched
- **No config changes** — tsconfig alias is unchanged
- **No dependency changes** — package.json is unchanged

---

## 10. Verification Checklist

```
[ ] pnpm check-types passes (zero errors)
[ ] pnpm fix passes (zero unfixed issues)
[ ] pnpm build passes (production build succeeds)
[ ] grep -r '@/features/' apps/web/src — zero results
[ ] grep -r '@/layout/' apps/web/src — zero results
[ ] grep -r '@/shared/' apps/web/src — zero results
[ ] All AGENTS.md files updated (no stale paths)
[ ] pnpm ruler regenerated root AGENTS.md/CLAUDE.md
[ ] pnpm dev starts without errors
[ ] Spot-check: /explore, /market/[slug], /portfolio, /login load correctly
```

---

## 11. Timeline & Priority

**Effort:** ~2 days of mechanical work (mostly waiting for sed + verifying)

**Priority:** LAST. This is the lowest value-per-effort change in the V2 migration:
- Zero user-facing impact
- Zero behavior change
- Maximum git churn (touches 500+ files)
- Conflicts with every other in-flight PR

**Recommendation:** Skip entirely if short on time. The codebase works fine with `features/`. Do this only when:
1. All other V2 migration work is complete
2. No other PRs are in flight
3. You have a quiet day to merge fast

If you do it, do it in **one PR**, get it reviewed quickly, and merge same-day.

---

## 12. Chart Architecture Notes

> From V2.md §11 — reference documentation only. Per V2.md audit #28: "Chart section has no migration steps." The chart architecture is **unchanged in V2** — no migration needed. This section exists as reference for anyone working in the chart directory.

The `trading/components/chart/` directory has five internal layers. Never import across layer boundaries except through `chart/index.ts`.

### Layer Map

| Layer | Directory | What lives here |
|-------|-----------|-----------------|
| **Entry** | `components/` | `chart-slot.tsx` (public API), `kline-chart.tsx` (outer shell), `kline-chart-inner.tsx` (KLineChart instance), `kline-toolbar.tsx`, `legend-bar.tsx` |
| **All-markets overlay** | `all-markets/` | Separate `<canvas>` renderer for multi-outcome price lines — completely independent of KLineChart |
| **KLineChart config** | `config/` | Styles, Y-axis range callback, drawing tool overlay templates (Apache 2.0 port from klinecharts/pro) |
| **Data** | `data/` | CLOB fetch (fidelity ladder + max/all merge), OHLC bar loading (init/forward paging), aggregation/bucketing, interval constants |
| **Hooks** | `hooks/` | `use-trade-markers.ts` — user trade query → annotation overlays |

### Component Responsibilities

**`chart-slot.tsx`** — Thin public entry point. Just renders `<PolymarketKLineChart>`. Consumers import from here, not from `kline-chart.tsx` directly.

**`kline-chart.tsx`** — Outer shell. Owns: interval + chart-type state (from `workspaceLayoutStore`), drawing tool state (`activeTool`, `selectedOverlayId`), all-markets mode switch, initial data hydration from `initialData` prop (server-prefetched), toolbar rendering. Uses `next/dynamic` with `ssr: false` to lazy-load `kline-chart-inner.tsx`. Has `"use no memo"` directive to opt out of React Compiler.

**`kline-chart-inner.tsx`** — KLineChart v10 instance. Owns six `useEffect`s:

1. Chart lifecycle (init, `ResizeObserver`, dispose) — reruns on theme change only
2. Data loader + WS subscription (`loadPolymarketKlineBars` + `marketChannel`) — reruns on tokenId/assetIds
3. Interval change → `chart.setPeriod()`
4. Chart type/theme sync → `chart.setStyles()`
5. Resolution overlay — "Resolved" annotation for closed markets
6. Sonar ring — live price dot tracking via RAF after scroll/zoom/WS bar updates

**`all-markets-line-layer.tsx`** — Entirely independent canvas-based multi-outcome chart. Renders on a `<canvas>` absolutely positioned over the KLineChart container. Has its own fetch logic, WS subscription via `marketChannel`, pan/zoom pointer handlers, and crosshair drawing. Does NOT use KLineChart APIs.

### Critical Data Flow

```
Server (RSC)
  └─ prefetchQuery(trpc.clob.getPricesHistory, "max")  ← seeds initialData prop
       │
Client hydration
  └─ kline-chart.tsx receives initialData
       └─ passes seedForMax to kline-chart-inner.tsx
            └─ loadPolymarketKlineBars({ loadType: "init", seedForMax })
                 └─ skips API call if seedForMax has points → zero network waterfall on load
```

The `seedForMax` pattern avoids a waterfall: the RSC prefetches `max` history, passes it as a prop, and the chart uses it directly instead of fetching again on mount.

### Fetch Strategy by Interval

| Interval | Source | Paging |
|----------|--------|--------|
| `max` / `1d` / `1w` / `1m` | `fetchWideHistoryMergedMaxAndAll` (both CLOB presets merged) | One-shot — no forward/backward |
| `1h` / `15m` / `1min` | `fetchExplicitRangeWithLadder` (explicit `startTs`/`endTs`) | Paged: init = last 7d; forward = older 7d chunks on scroll |

The fidelity ladder retries with coarser fidelity when the CLOB rejects a request. For `max`/`all` presets the ladder runs coarse-first (1440 min → 360 → …) because fine fidelity returns only a short recent window instead of full history.

### All Markets Overlay vs KLineChart

| Feature | KLineChart (`kline-chart-inner.tsx`) | All Markets canvas (`all-markets-line-layer.tsx`) |
|---------|-------------------------------------|--------------------------------------------------|
| Mode | Single outcome (tokenId) | All outcomes in GMP event |
| Renderer | KLineChart v10 library | Raw `<canvas>` 2D context |
| Chart type | Candle / line / OHLC | Line only |
| WS | `marketChannel` (single asset) | `marketChannel` (all asset IDs) |
| Interaction | KLineChart built-in crosshair | Custom pan/zoom/crosshair |
| Shown when | `allMarketsMode === false` | `allMarketsMode === true` |

The two modes are mutually exclusive. `kline-chart.tsx` conditionally renders `AllMarketsLineLayer` over the chart canvas and hides the KLineChart toolbar when in all-markets mode.

### Sonar Ring

The sonar ring is a CSS-animated `<div>` (doji-green circle) positioned absolutely over the KLineChart canvas at the pixel location of the last price. It repositions via `requestAnimationFrame` in response to:

- WS `last_trade_price` events (new bar appended)
- Chart scroll/zoom (coordinate mapping changes)
- Theme change (chart reinitialized)

The ring hides during pointer interaction (hover/drag) to avoid z-fighting with the crosshair. Pixel position is computed from `chart.convertToPixel({ timestamp, value })`.