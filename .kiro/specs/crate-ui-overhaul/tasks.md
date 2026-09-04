# Implementation Plan: Crate UI Overhaul

## Overview

Pure presentational tear-down and rebuild of the Robinhood Chain Basket Terminal into the **Crate** product. All business logic, hooks, stores, tRPC procedures, and config are left untouched. Work proceeds in dependency order: CSS tokens first (everything downstream inherits them), then shell, then route migration, then pages and domain components in parallel waves, then tests, then final verification.

---

## Tasks

- [x] 1. Rewrite design tokens in `apps/web/src/index.css`
  - Replace the entire file with the Crate token system specified in the design document
  - Remove all `.doji` scope blocks, `--doji-green*` custom properties, `.pnl-day-hover-*`, `.doji-landing-grid-*`, `.login-ui-frame`/`.login-dot-grid`, `ticker-scroll`/`shimmer` keyframes, Magic SDK iframe overrides, leaderboard classes, and all `.doji button.bg-*` override blocks
  - Remove the `@layer utilities { .border { border-width: 1.75px } }` block and all equivalent `.border-x`, `.border-y`, `.border-t/.r/.b/.l` 1.75px overrides
  - Add `:root` with `--crate-orange: #FF6B35`, `--bg-base: #0a0a0a`, `--bg-surface: #111111`, `--bg-surface-raised: #1a1a1a`, `--border-subtle/default/strong`, `--text-primary/secondary/tertiary`, `--color-positive/negative`, and all Tailwind semantic aliases (`--primary`, `--background`, `--card`, `--border`, etc.) pointing to Crate palette values
  - Set `--radius: 0px`
  - Update `.order-toast-processing::after` shimmer to use `var(--crate-orange)` band color
  - Update `.sonar-ring` to use `var(--crate-orange)` border-color
  - Change `@custom-variant dark` selector from `.doji` scope to the standard `(.dark, .dark *)` form
  - Preserve: `@import` lines, all keyframes still in use (`live-trade-flash`, `toast-slide-*`, `order-toast-shimmer/pop`, `skeleton-shimmer-bg`, `chart-line-end-pulse-ring`), `[data-slot="skeleton"]` shimmer, `::selection`, `.btn-press`, `scrollbar-*` utilities, `text-positive/negative` utilities, `@layer base` body/html/input/button rules
  - _Requirements: 1.1–1.12, 13.1–13.6_

- [x] 2. Update shell constants and navigation
  - [x] 2.1 Update `apps/web/src/shell/header-control-styles.ts`
    - Replace `headerNavLinkBaseClass` with `"px-3 py-1 text-sm font-normal transition-colors duration-150"`
    - Replace `headerNavLinkInactiveClass` with `"text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"`
    - Replace `headerNavLinkActiveClass` with `"text-[color:var(--crate-orange)] [text-decoration:underline] [text-decoration-color:var(--crate-orange)] [text-underline-offset:2px]"`
    - Remove `headerChromeSurfaceClass`, `headerChromeInteractiveClass`, `headerChromeProfileTriggerClass` exports (unused in this app)
    - Keep `headerControlHeightClass` unchanged
    - _Requirements: 2.3, 2.4_
  - [x] 2.2 Update `apps/web/src/shell/header-nav.tsx`
    - Reduce `NAV_LINKS` to exactly two entries: `{ href: "/", label: "Home" }` and `{ href: "/crates", label: "Crates" }`
    - Active detection logic unchanged (`pathname === "/"` for exact, `pathname.startsWith(href)` for prefix)
    - Remove the `/explore` link
    - _Requirements: 2.5, 7.3, 8.7_
  - [x] 2.3 Update `apps/web/src/shell/site-header.tsx`
    - Remove `DojiLogo` import; add an inline `CrateWordmark` function component (SVG box icon ≤20×20px + "Crate" text at `text-sm font-medium`)
    - Replace `min-h-16` desktop grid with `h-12` desktop / `h-11` mobile heights
    - Change desktop grid from `grid-cols-[1fr_1fr]` to `grid-cols-[auto_1fr_auto]`
    - Update background to `bg-[color:var(--bg-base)]` and border to `border-b border-[color:var(--border-default)]`, no box-shadow
    - Add `ml-6` gap between logo group and `HeaderNav`
    - Mark the SVG icon `aria-hidden="true"`
    - _Requirements: 2.1, 2.2, 2.10, 12.8, 14.1_
  - [x] 2.4 Update `apps/web/src/shell/header-actions.tsx`
    - Connected state: replace scattered spans with a single `<div role="status" aria-label="Wallet connected: {truncatedAddr}">` pill at `h-8`, using `border border-[color:var(--border-strong)] px-3 text-sm font-normal text-[color:var(--text-primary)]`; format balance to 4 decimal places
    - Disconnected state: keep `<Button variant="outline">` at `h-8`, add `aria-label="Connect wallet"`
    - Skeleton: change to `h-8 w-32`
    - _Requirements: 2.6, 2.7, 12.4_
  - [x] 2.5 Update `apps/web/src/shell/bottom-bar.tsx`
    - Update `<footer>` classes: replace `border-border border-t bg-background` with `border-t border-[color:var(--border-default)] bg-[color:var(--bg-base)]`
    - No structural changes — keep `BugReportWidget` and `BottomBarStatusLink` only
    - _Requirements: 2.8, 13.1_
  - [x] 2.6 Update `apps/web/src/shell/app-shell-router.tsx`
    - Replace `pathname?.startsWith("/baskets/")` check with `pathname?.startsWith("/crates/")`
    - Remove `CommentsProvider` import and wrapper (Polymarket remnant)
    - _Requirements: 8.8_

- [x] 3. Route migration — move pages and create redirect stubs
  - [x] 3.1 Create the `crates` route group and move existing pages
    - Create directory `apps/web/src/app/(app)/crates/`
    - Create directory `apps/web/src/app/(app)/crates/[crateId]/`
    - Move `apps/web/src/app/(app)/baskets/page.tsx` content into `apps/web/src/app/(app)/crates/page.tsx` (will be redesigned in task 4.2)
    - Move `apps/web/src/app/(app)/baskets/[basketId]/page.tsx` content into `apps/web/src/app/(app)/crates/[crateId]/page.tsx`, renaming the `basketId` param to `crateId` throughout and updating `generateStaticParams` to return `{ crateId: b.id }` shapes
    - _Requirements: 8.1, 8.2, 8.9_
  - [x] 3.2 Create 301 redirect stubs in the old `baskets` routes
    - Overwrite `apps/web/src/app/(app)/baskets/page.tsx` with a stub that calls `redirect("/crates")`
    - Overwrite `apps/web/src/app/(app)/baskets/[basketId]/page.tsx` with a stub that awaits `params`, then calls `redirect(\`/crates/\${basketId}\`)`
    - Do not wrap `redirect()` in try-catch
    - _Requirements: 8.3, 8.4_

- [x] 4. Redesign pages — Home, Crates directory, Crate terminal
  - [x] 4.1 Update `apps/web/src/app/page.tsx` (Home page)
    - Change metadata: `title: { absolute: "Crate — Trade in Crates" }`, description: `"Trade curated on-chain token crates on Robinhood Chain."`, `og:title` and `og:site_name: "Crate"`
    - No layout changes needed — `HomeHero` will be replaced in task 5.1; `BasketCatalogGrid` restyling is in task 5.4
    - _Requirements: 3.7, 3.8, 3.9, 3.10, 7.8, 14.1, 14.2_
  - [x] 4.2 Redesign `apps/web/src/app/(app)/crates/page.tsx` (Crates directory)
    - Update metadata: `title: { absolute: "All Crates — Crate" }`, description about Crate
    - Add section heading `"All crates."` at `font-weight: 800`, `clamp(36px,5vw,72px)` size, left-aligned, `text-[color:var(--text-primary)]`
    - Add `UpdatedTimestamp` client component (60s interval counter, `text-xs text-[color:var(--text-tertiary)]`) in the header row
    - Wrap `BasketCatalogGrid` in `<Suspense fallback={<BasketCatalogGrid isLoading />}>`
    - Keep `await connection()` and price prefetch pattern from original
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 4.3 Redesign `apps/web/src/app/(app)/crates/[crateId]/page.tsx` (Crate terminal)
    - Param is `crateId` (renamed from `basketId`); `getBasketById(crateId)` → `notFound()` if undefined
    - Update metadata: `title: { absolute: "\${crate.name} — Crate" }`, `og:title` same value
    - Sidebar column: `w-full lg:w-80`, `border-t lg:border-l lg:border-t-0 border-[color:var(--border-default)]`; `WrongNetworkBanner` is first child
    - Crate heading in primary column: `font-weight: 800`, section heading size, `text-[color:var(--text-primary)]`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

- [x] 5. Restyle domain components — hero, cards, grid, panels
  - [x] 5.1 Rewrite `apps/web/src/domains/baskets/components/home-hero.tsx`
    - Full replacement: Server Component, no `"use client"`
    - `<h1>` with `"Trade in Crates."` at `clamp(72px,10vw,160px)`, `font-weight: 900`, `letter-spacing: -0.03em`, left-aligned, `text-[color:var(--text-primary)]`
    - Subheadline `<p>` right-positioned on desktop (`absolute right-0 top-1/2 -translate-y-1/2 max-w-[300px] hidden md:block`), below heading on mobile
    - CTA `<Link>` with text `"Enter app →"`, transparent bg, `border border-[color:var(--border-strong)] px-5 h-9`, hover transitions `border-color` and `color` to `var(--crate-orange)` over `200ms ease`
    - CTA `href="/crates"`; no raw `<button>` — use inline `<Link>` classes as Server Component bypass
    - _Requirements: 3.1–3.6, 7.4, 9.5_
  - [x] 5.2 Restyle `apps/web/src/domains/baskets/components/basket-card.tsx`
    - Card link `href`: `/crates/${basket.id}`
    - Outer `<Link>` classes: `block border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-5 transition-colors duration-150 hover:bg-[color:var(--bg-surface-raised)]`; remove `rounded-lg`
    - Name `<p>`: `text-sm font-medium text-[color:var(--text-primary)]`
    - Replace description text with ticker/ID in `text-xs text-[color:var(--crate-orange)]` showing `basket.id.toUpperCase()`
    - Constituent weights `<p>`: `text-xs text-[color:var(--text-secondary)]`
    - Add explorer link row for `basket.constituents[0]?.poolAddress` (12px, secondary color, `rel="noopener noreferrer"`, `target="_blank"`)
    - Extract `truncateAddress` helper inline (or import from shared util if extracted)
    - _Requirements: 6.1–6.6, 8.5, 12.8_
  - [x] 5.3 Restyle `apps/web/src/domains/baskets/components/basket-card-skeleton.tsx`
    - Remove `rounded-lg` from wrapper; use `border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-5`
    - Skeleton placeholder divs use `bg-[color:var(--bg-surface-raised)]` with `data-slot="skeleton"` (enables shimmer from global CSS)
    - Match loaded card dimensions (header row, ticker row, weights row, explorer link row)
    - _Requirements: 4.6, 10.1_
  - [x] 5.4 Update `apps/web/src/domains/baskets/components/basket-catalog-grid.tsx`
    - Add empty-state branch: when `!isLoading && BASKETS.length === 0`, render centered icon + `"No crates yet."` heading + `"Check back soon."` subtext + one `<Button variant="outline">Browse markets</Button>`; no skeletons visible simultaneously
    - Grid breakpoints unchanged: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
    - _Requirements: 4.7, 9.1, 10.2_
  - [x] 5.5 Restyle `apps/web/src/domains/baskets/components/order-panel.tsx`
    - Outer container: `border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-4`; remove `rounded-lg`
    - Tab bar container: `border-b border-[color:var(--border-default)] pb-3`
    - Active tab: add `[border-bottom:2px_solid_var(--crate-orange)]` underline class; text `text-[color:var(--text-primary)]`
    - Inactive tab: `text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]`
    - Change tab labels: `"Buy"` → `"Buy Crate"`, `"Exit"` → `"Exit Crate"`
    - _Requirements: 6.1, 7.5, 7.7_
  - [x] 5.6 Update `apps/web/src/domains/baskets/components/buy-panel.tsx`
    - Change initial `buttonLabel` assignment from `"Buy Basket"` to `"Buy Crate"`
    - Add `aria-disabled={isDisabled || …}` and `tabIndex={0}` props to the execute `<Button>`
    - _Requirements: 7.7, 12.5_
  - [x] 5.7 Update `apps/web/src/domains/baskets/components/exit-panel.tsx`
    - Change `"Exit Basket to ETH"` button label to `"Exit to ETH"`
    - Change `"No Basket Tokens"` empty state text to `"No Crate Tokens"`
    - Update estimated return card border/bg classes: replace `rounded-md border border-border bg-muted/30` with `border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-raised)]`
    - _Requirements: 7.5, 7.6_

- [x] 6. Restyle status and feedback components
  - [x] 6.1 Update `apps/web/src/domains/baskets/components/tx-status-badge.tsx`
    - Wrap all return branches in a single `<div aria-live="polite" aria-atomic="true">` that is always rendered (empty div when `status === "idle"`)
    - Update spinner `className` on `building`, `confirming`, `pending` states: change `border-current` to `text-[color:var(--crate-orange)] border-current` (inherits orange color)
    - `confirmed` state: add `<CheckCircle>` icon from `lucide-react` (already installed) alongside `✓` text; keep block explorer link
    - `error` state: change `text-destructive` to `text-[color:var(--color-negative)]`
    - _Requirements: 6.15, 10.6, 10.7, 10.8, 12.9_
  - [x] 6.2 Update `apps/web/src/domains/baskets/components/wrong-network-banner.tsx`
    - Outer `<div>` classes: remove `rounded-md border-destructive/30 bg-destructive/10`; add `border border-[color:var(--border-default)] bg-[color:var(--bg-surface)]`
    - Message text: change `"trade baskets."` to `"trade crates."`
    - `<Button>` variant stays `"default"` (resolves to `--crate-orange` via token alias)
    - _Requirements: 5.6, 6.16, 7.1_

- [x] 7. Restyle chart and data visualization components
  - [x] 7.1 Update `apps/web/src/domains/baskets/components/composite-index-chart.tsx`
    - Remove `isPositive` conditional coloring from gradient, line, and activeDot — always use `var(--crate-orange)`
    - `<linearGradient>`: both stops use `var(--crate-orange)` (0.4 → 0 opacity)
    - `<Area>`: `stroke="var(--crate-orange)"`, `fill="url(#indexGradient)"`, `activeDot={{ fill: "var(--crate-orange)", r: 3, strokeWidth: 0 }}`
    - `<XAxis>`: `stroke="var(--border-subtle)"`, `tick={{ fill: "var(--text-secondary)", fontSize: 10 }}`
    - `<YAxis>`: `tick={{ fill: "var(--text-secondary)", fontSize: 10 }}`
    - `<ReferenceLine>`: `stroke="var(--border-subtle)"`
    - `<Tooltip>` `contentStyle`: `backgroundColor: "var(--bg-surface)"`, `border: "1px solid var(--border-default)"`, `borderRadius: "0px"`
    - Loading skeleton: `className="h-[240px] bg-[color:var(--bg-surface)]"` with `data-slot="skeleton"`; remove `animate-pulse rounded bg-muted`
    - Empty state: `"Chart data unavailable."` centered in `h-[240px]` with `text-[color:var(--text-secondary)]`; remove `border-border bg-muted/10` classes
    - _Requirements: 11.1, 11.2, 11.3, 11.6, 10.9, 10.10_
  - [x] 7.2 Update `apps/web/src/domains/baskets/components/allocation-preview.tsx`
    - Table `<thead>` border: change `border-border` to `border-[color:var(--border-subtle)]`
    - Row border: change `border-border/50` to `border-[color:var(--border-subtle)]`
    - Symbol `<td>`: change `text-text-primary` to `text-[color:var(--crate-orange)]`
    - USD amount unavailable cell: render `<td>` with `"—"` in `text-[color:var(--text-tertiary)]` when `line.usdAmount == null`
    - _Requirements: 6.17, 10.4_
  - [x] 7.3 Update `apps/web/src/domains/baskets/components/constituent-list-item.tsx`
    - Row wrapper `<div>`: add `border-b border-[color:var(--border-subtle)] last:border-0` classes
    - Token icon fallback `<div>`: change `bg-muted` to `bg-[color:var(--bg-surface-raised)]`
    - Name `<p>`: `text-sm font-medium text-[color:var(--text-primary)]` (no change needed — already matches)
    - `changeClass`: change `"text-destructive"` to `"text-[color:var(--color-negative)]"` for negative values; keep `"text-positive"` for positive (resolves via utility); unavailable: change `"text-text-muted"` to `"text-[color:var(--text-tertiary)]"`
    - Price `"—"` and change `"—"` cells: ensure `color: var(--text-tertiary)` per Req 10.3
    - _Requirements: 6.12, 6.13, 6.14, 10.3_

- [x] 8. Restyle interactive controls
  - [x] 8.1 Update `apps/web/src/domains/baskets/components/timeframe-selector.tsx`
    - Active chip: override `className` with `"h-8 min-h-[44px] sm:min-h-8 bg-[color:var(--crate-orange)] text-[#0a0a0a] font-medium border-transparent"` using `variant="ghost"` as base
    - Inactive chip: `"h-8 min-h-[44px] sm:min-h-8 bg-transparent border border-[color:var(--border-default)] text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"`
    - _Requirements: 6.18, 9.6_
  - [x] 8.2 Update `apps/web/src/domains/baskets/components/token-toggle-chips.tsx`
    - Active chip `className`: `"h-6 px-2.5 text-[10px] bg-[color:var(--crate-orange)] text-[#0a0a0a] border-transparent"`
    - Inactive chip `className`: `"h-6 px-2.5 text-[10px] bg-[color:var(--bg-surface)] border border-[color:var(--border-default)] text-[color:var(--text-secondary)]"`
    - Ensure each chip has `aria-label={\`Toggle \${c.symbol}\`}`
    - _Requirements: 6.19, 12.3_
  - [x] 8.3 Update `apps/web/src/domains/baskets/components/currency-toggle.tsx`
    - Remove outer `rounded-md` from wrapper; add `border border-[color:var(--border-default)] p-0.5`
    - Active button `className`: `"flex-1 h-7 min-h-[44px] sm:min-h-7 text-xs bg-[color:var(--crate-orange)] text-[#0a0a0a]"` with `variant="ghost"`
    - Inactive button `className`: `"flex-1 h-7 min-h-[44px] sm:min-h-7 text-xs bg-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"` with `variant="ghost"`
    - Add `aria-pressed={value === currency}` to each button
    - _Requirements: 6.7, 9.6_
  - [x] 8.4 Update `apps/web/src/domains/baskets/components/quick-buy-presets.tsx`
    - Wrapper: `"flex gap-2 overflow-x-auto scrollbar-hide"` (single-row scrollable strip on mobile, no wrapping)
    - Each preset button: `variant="ghost"`, `className` includes `"flex-none text-xs min-h-[44px] sm:min-h-8 border border-[color:var(--border-default)] bg-transparent text-[color:var(--text-secondary)] hover:border-[color:var(--crate-orange)] hover:text-[color:var(--crate-orange)]"`
    - _Requirements: 9.6, 9.7_
  - [x] 8.5 Update `apps/web/src/domains/baskets/components/basket-selector.tsx`
    - Change `href` from `"/baskets"` to `"/crates"`
    - Change link text from `"All Baskets"` to `"All Crates"`
    - Update hover class: replace `hover:bg-muted/50` with `hover:bg-[color:var(--bg-surface-raised)]`
    - _Requirements: 7.1, 8.5_

- [x] 9. Verify remaining components for stale references
  - [x] 9.1 Scan and update `apps/web/src/domains/baskets/components/basket-chart.tsx`
    - Check for any `--doji-green`, `var(--color-positive)` / `var(--color-negative)` gradient/line colors and confirm they use the tokens now mapped to Crate palette (no code change needed if they reference `--color-positive`/`--color-negative` which already alias correctly)
    - Check for any `/baskets/` URL strings — update to `/crates/` if found
    - _Requirements: 7.1, 11.4_
  - [x] 9.2 Scan and update `apps/web/src/domains/baskets/components/token-candlestick-chart.tsx`
    - Confirm candlestick bullish/bearish colors reference `var(--color-positive)` and `var(--color-negative)` (both now alias to `#22c55e` / `#ef4444` via the token rewrite in task 1)
    - Check for any hardcoded `--doji-green` or `#bff85a`/`#6ee46e` values — replace with `var(--crate-orange)` if found
    - _Requirements: 11.4_

- [x] 10. Write static analysis tests (Properties 2 and 4)
  - [x] 10.1 Create `tests/unit/crate-overhaul.test.ts` with Property 2 test
    - Read `apps/web/src/index.css` as string; assert `file.match(/--doji-green[\w-]*\s*:/g)` is null (zero matches)
    - _Requirements: 1.11_
  - [x] 10.2 Add Property 4 test to `tests/unit/crate-overhaul.test.ts`
    - Use `fast-glob` to enumerate `.tsx`/`.ts` files under `apps/web/src/domains/baskets/components/` and `apps/web/src/shell/`
    - For each file, strip import lines and TypeScript identifier tokens (names in variable/function/type positions), then assert remaining content contains no `/\bbaskets?\b/i` matches
    - Report filename and approximate line number on failure
    - _Requirements: 7.1, 7.2_

- [x] 11. Write integration redirect test (Property 3)
  - [x] 11.1 Create `tests/integration/crate-redirect.test.ts`
    - For each `b.id` in `BASKETS`, send `fetch(\`/baskets/\${b.id}\`, { redirect: "manual" })` and assert response status is in `{301, 307, 308}` and `Location` header equals `/crates/${b.id}`
    - Also assert `fetch("/baskets", { redirect: "manual" })` redirects to `/crates`
    - _Requirements: 8.3, 8.4_

- [x] 12. Final verification checkpoint
  - Run `pnpm fix` (Ultracite/Biome) to auto-fix formatting and lint issues across all modified files
  - Run `pnpm check-types` to confirm no TypeScript errors introduced
  - Run `pnpm test:unit` to confirm Property 2 static analysis passes (zero `--doji-green` declarations)
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP iteration
- Task 1 (CSS token rewrite) is a prerequisite for everything — do it first; all Tailwind semantic aliases now route through Crate palette values so downstream component changes are minimal where they use `text-text-primary`, `bg-card`, `border-border`, etc.
- Tasks 2–3 (shell + routes) should be done before page and component work so the nav links and URL structure are correct when testing
- Tasks 5–9 (component restyling) are independently parallelisable once the CSS and route migration are done
- Business logic, hooks (`use-basket-buy`, `use-basket-exit`, `use-basket-prices`, `use-ohlcv`, `use-allocation-preview`), Zustand stores, and all `lib/` files are explicitly **not touched** by any task
- The `truncateAddress` helper in `header-actions.tsx` and `basket-card.tsx` can be extracted to `apps/web/src/utils/truncate-address.ts` — defer unless it causes a lint warning
- Property 1 (token aliasing completeness) from the design is satisfied by task 1 + task 12 type-check; no separate test file is required
- WCAG contrast verification (Requirements 12.6, 12.7) requires manual colour-contrast analysis — `#F0F0F0` on `#0a0a0a` ≈ 16.75:1 (passes AAA); secondary text `rgba(255,255,255,0.50)` ≈ 3.9:1 (passes AA for large/medium text)

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1"] },
    { "id": 1, "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "3.1"] },
    { "id": 2, "tasks": ["3.2", "4.1", "4.2", "4.3"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "6.1", "6.2", "7.1", "7.2", "7.3", "8.1", "8.2", "8.3", "8.4", "8.5", "9.1", "9.2"] },
    { "id": 4, "tasks": ["10.1", "10.2", "11.1"] },
    { "id": 5, "tasks": ["12"] }
  ]
}
```
