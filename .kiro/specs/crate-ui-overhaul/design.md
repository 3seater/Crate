# Design Document: Crate UI Overhaul

## Overview

The Crate UI Overhaul is a complete visual and naming transformation of the Robinhood Chain Basket Terminal. The scope is purely presentational: every CSS token, component class, JSX string, route path, and page metadata is updated to express the Crate brand. All business logic, data hooks, server routes, and configuration objects remain untouched.

The new aesthetic is editorial and typographic: true-black backgrounds (`#0a0a0a`), massive ultra-bold grotesque headings via Inter 900, minimal negative space, razor-thin 1px borders, and a warm amber brand accent called **Crate Orange** (`#FF6B35`). The Doji green palette is entirely removed.

---

## Architecture

### Layer Diagram

```
┌─────────────────────────────────────────────────────────┐
│ apps/web/src/index.css  (Design Token Layer)            │
│  :root { --bg-base, --crate-orange, --border-default…}  │
│  @theme inline { --color-primary: var(--primary) }      │
└────────────────────┬────────────────────────────────────┘
                     │ CSS custom properties
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Tailwind Utility Classes                                │
│  bg-[color:var(--bg-surface)]  text-[color:var(--…)]   │
│  border-[color:var(--border-default)]                   │
└────────────────────┬────────────────────────────────────┘
                     │ className props
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Shell Layer  (apps/web/src/shell/)                      │
│  site-header  header-nav  header-actions  bottom-bar   │
│  app-shell-router  header-control-styles               │
└────────────────────┬────────────────────────────────────┘
                     │ wraps
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Page Layer  (apps/web/src/app/)                        │
│  page.tsx (Home)   (app)/crates/page.tsx               │
│  (app)/crates/[crateId]/page.tsx                       │
└────────────────────┬────────────────────────────────────┘
                     │ composes
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Component Layer  (apps/web/src/domains/baskets/)        │
│  home-hero  basket-card  basket-catalog-grid            │
│  order-panel  buy-panel  exit-panel  tx-status-badge   │
│  wrong-network-banner  composite-index-chart  …        │
└─────────────────────────────────────────────────────────┘
```

### Change vs. Unchanged Matrix

| File | Change type |
|------|-------------|
| `apps/web/src/index.css` | Full rewrite (tokens only) |
| `shell/header-control-styles.ts` | Class constant updates |
| `shell/header-nav.tsx` | NAV_LINKS, active class |
| `shell/site-header.tsx` | Logo swap, height, token classes |
| `shell/header-actions.tsx` | aria-labels, sizing, token classes |
| `shell/bottom-bar.tsx` | Token classes only |
| `shell/app-shell-router.tsx` | Pathname string + remove CommentsProvider |
| `app/page.tsx` | Metadata, layout, copy |
| `app/(app)/baskets/page.tsx` | → redirect stub (301 to /crates) |
| `app/(app)/baskets/[basketId]/page.tsx` | → redirect stub (301 to /crates/:id) |
| `app/(app)/crates/page.tsx` | NEW — moved + restyled |
| `app/(app)/crates/[crateId]/page.tsx` | NEW — moved + param rename |
| All `domains/baskets/components/*.tsx` | classNames + copy, logic untouched |
| `domains/baskets/hooks/**` | **No change** |
| `domains/baskets/lib/**` | **No change** |
| `domains/baskets/stores/**` | **No change** |
| `config/**`, `packages/**`, `apps/server/**` | **No change** |

---

## Components and Interfaces

### Shell Components

#### `header-control-styles.ts`

Replaces Polymarket-era constants with Crate equivalents. The three `headerChrome*` constants (surface, interactive, profileTrigger) are removed — they were only used by Polymarket dock controls that no longer exist in this app.

```ts
// Keep
export const headerControlHeightClass = "h-[var(--header-control-height)]";

// Updated
export const headerNavLinkBaseClass =
  "px-3 py-1 text-sm font-normal transition-colors duration-150";

export const headerNavLinkInactiveClass =
  "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]";

// Active: orange text + 1px orange underline 2px below baseline
export const headerNavLinkActiveClass =
  "text-[color:var(--crate-orange)] [text-decoration:underline] [text-decoration-color:var(--crate-orange)] [text-underline-offset:2px]";

// REMOVED: headerChromeSurfaceClass, headerChromeInteractiveClass,
//          headerChromeProfileTriggerClass
```

#### `header-nav.tsx`

- Remove the `/explore` link. Nav contains exactly two entries: Home (`/`) and Crates (`/crates`).
- Active detection logic unchanged (`pathname === "/"` for exact, `pathname.startsWith(href)` for prefix).
- `HeaderNavFallback` applies `headerNavLinkInactiveClass` only (no active state possible without `usePathname`).

```tsx
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/crates", label: "Crates" },
] as const;
```

#### `site-header.tsx`

- Remove `DojiLogo` import; replace with an inline "Crate" wordmark.
- The wordmark is a `<span>` containing a small SVG box icon (≤20×20px) + the text "Crate" at 16px medium weight.
- Desktop: `h-12` (48px). Mobile: `h-11` (44px).
- Background: `bg-[color:var(--bg-base)]`. Bottom border: `border-b border-[color:var(--border-default)]`. No box-shadow.
- Desktop grid changes from `grid-cols-[1fr_1fr]` to `grid-cols-[auto_1fr_auto]` so the logo and nav are independently sized.
- Nav is `ml-6` from the logo group (≥16px gap satisfied).

```tsx
function CrateWordmark() {
  return (
    <span className="flex items-center gap-1.5">
      {/* Box icon — purely decorative */}
      <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 18 18" width="18">
        <rect height="14" rx="0" stroke="currentColor" strokeWidth="1.5" width="14" x="2" y="2" />
        <line stroke="currentColor" strokeWidth="1.5" x1="2" x2="16" y1="7" y2="7" />
      </svg>
      <span className="font-medium text-sm text-[color:var(--text-primary)]">Crate</span>
    </span>
  );
}
```

#### `header-actions.tsx`

Connected state renders a single pill `<div>` (not a button — no action), disconnected state renders a `Button` with `variant="outline"`.

```tsx
// Disconnected
<Button
  aria-label="Connect wallet"
  className="h-8"
  onClick={...}
  variant="outline"
>
  Connect Wallet
</Button>

// Connected
<div
  aria-label={`Wallet connected: ${truncateAddress(address)}`}
  className="flex h-8 items-center gap-2 border border-[color:var(--border-strong)] px-3 text-sm font-normal text-[color:var(--text-primary)]"
  role="status"
>
  <span>{truncateAddress(address)}</span>
  <span className="text-[color:var(--text-secondary)]">{formattedBalance}</span>
</div>
```

Balance formatted to 4 decimal places (per Requirement 2.7). Skeleton stays `h-8 w-32`.

#### `bottom-bar.tsx`

Token classes updated only. No structural change — the component already contains only `BugReportWidget` and `BottomBarStatusLink`, matching Requirement 2.8.

```tsx
<footer className="fixed bottom-0 left-0 right-0 z-30 flex h-8 shrink-0 items-center justify-end
  border-t border-[color:var(--border-default)] bg-[color:var(--bg-base)] px-4">
```

#### `app-shell-router.tsx`

Two targeted changes:
1. `"/baskets/"` → `"/crates/"` in the `startsWith` check.
2. Remove `CommentsProvider` import and wrapper (Polymarket remnant not used in this app).

```tsx
"use client";

import { usePathname } from "next/navigation";
import { DockShell } from "@/shell/dock-shell";

export function AppShellRouter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCratePage = pathname?.startsWith("/crates/");
  // … same scroll class logic, /baskets/ → /crates/
}
```

### Domain Components

#### `basket-card.tsx`

The card link navigates to `/crates/${basket.id}`. Visual changes apply Crate tokens throughout. A new "View on explorer" row is added for the first constituent's pool address.

```tsx
// Outer Link
className="block border border-[color:var(--border-default)] bg-[color:var(--bg-surface)]
  p-5 transition-colors duration-150 hover:bg-[color:var(--bg-surface-raised)]"
href={`/crates/${basket.id}` as Route}

// Crate name
<p className="truncate text-sm font-medium text-[color:var(--text-primary)]">{basket.name}</p>

// Ticker/ID — replaces description
<p className="mt-0.5 text-xs text-[color:var(--crate-orange)]">{basket.id.toUpperCase()}</p>

// Constituent weights
<p className="text-xs text-[color:var(--text-secondary)]">…</p>

// Explorer link (new) — first constituent address only
{basket.constituents[0]?.poolAddress && (
  <a
    className="mt-2 block text-xs text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
    href={`https://explorer.robinhood.com/address/${basket.constituents[0].poolAddress}`}
    rel="noopener noreferrer"
    target="_blank"
  >
    {truncateAddress(basket.constituents[0].poolAddress)} ↗
  </a>
)}
```

Helper `truncateAddress` already exists in `header-actions.tsx` — move to a shared util or inline here.

#### `basket-card-skeleton.tsx`

Mirrors the new loaded card dimensions. Removes `rounded-lg`, uses sharp corners.

```tsx
<div className="flex flex-col gap-3 border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-5">
  <div className="flex items-start justify-between gap-2">
    <div className="min-w-0 flex-1">
      <div data-slot="skeleton" className="h-4 w-32 bg-[color:var(--bg-surface-raised)]" />
      <div data-slot="skeleton" className="mt-1.5 h-3 w-20 bg-[color:var(--bg-surface-raised)]" />
    </div>
    <div data-slot="skeleton" className="h-4 w-14 shrink-0 bg-[color:var(--bg-surface-raised)]" />
  </div>
  <div data-slot="skeleton" className="h-3 w-48 bg-[color:var(--bg-surface-raised)]" />
  <div data-slot="skeleton" className="h-3 w-28 bg-[color:var(--bg-surface-raised)]" />
</div>
```

#### `basket-catalog-grid.tsx`

Grid breakpoints are unchanged: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`. An empty-state branch is added for when `BASKETS.length === 0`.

```tsx
if (!isLoading && BASKETS.length === 0) {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      {/* icon */}
      <p className="text-lg font-medium text-[color:var(--text-primary)]">No crates yet.</p>
      <p className="text-sm text-[color:var(--text-secondary)]">Check back soon.</p>
      <Button variant="outline">Browse markets</Button>
    </div>
  );
}
```

#### `home-hero.tsx`

Full replacement. Server Component — no `"use client"` needed.

```tsx
export function HomeHero() {
  return (
    <section className="relative px-8 pb-12 pt-20 md:px-16">
      <div className="relative">
        {/* Display heading — left-aligned, ultra-bold */}
        <h1
          className="font-sans text-[color:var(--text-primary)]"
          style={{ fontSize: "clamp(72px,10vw,160px)", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}
        >
          Trade in Crates.
        </h1>
        {/* Subheadline — right-positioned on desktop */}
        <p className="absolute right-0 top-1/2 hidden max-w-[300px] -translate-y-1/2 text-sm text-[color:var(--text-secondary)] md:block">
          Buy curated on-chain token crates with a single transaction on Robinhood Chain.
        </p>
      </div>
      {/* Subheadline — below heading on mobile */}
      <p className="mt-4 max-w-sm text-sm text-[color:var(--text-secondary)] md:hidden">
        Buy curated on-chain token crates with a single transaction on Robinhood Chain.
      </p>
      {/* CTA */}
      <Link
        className="mt-8 inline-flex h-9 items-center border border-[color:var(--border-strong)] px-5
          text-sm text-[color:var(--text-primary)] transition-colors duration-200
          hover:border-[color:var(--crate-orange)] hover:text-[color:var(--crate-orange)]"
        href="/crates"
      >
        Enter app →
      </Link>
    </section>
  );
}
```

#### `order-panel.tsx`

Tab labels updated to "Buy Crate" / "Exit Crate". Outer container updated to Crate tokens.

```tsx
// Outer container
className="flex flex-col gap-4 border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-4"

// Tab bar
className="flex gap-1 border-b border-[color:var(--border-default)] pb-3"

// Active tab button — add orange underline
className={cn(
  "h-8 px-4 text-sm",
  activeTab === tab
    ? "text-[color:var(--text-primary)] [border-bottom:2px_solid_var(--crate-orange)]"
    : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
)}
```

Tab label changes: `"Buy"` → `"Buy Crate"`, `"Exit"` → `"Exit Crate"`.

#### `buy-panel.tsx`

- `"Buy Basket"` → `"Buy Crate"` in `buttonLabel` initial assignment.
- `"No Basket Tokens"` string is in `exit-panel.tsx`, not here.
- Add `aria-disabled="true"` and `tabIndex={0}` when `isDisabled`.

```tsx
let buttonLabel = "Buy Crate";

// Button
<Button
  aria-disabled={isDisabled || (buyState.status === "idle" && (!amountStr || amountEth <= 0))}
  className="w-full"
  disabled={isDisabled || (buyState.status === "idle" && (!amountStr || amountEth <= 0))}
  onClick={handleBuy}
  tabIndex={0}
  type="button"
>
  {buttonLabel}
</Button>
```

#### `exit-panel.tsx`

- `"Exit Basket to ETH"` → `"Exit to ETH"`.
- `"No Basket Tokens"` → `"No Crate Tokens"`.
- Estimated return card: replace `rounded-md border border-border bg-muted/30` with `border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-raised)]`.
- Button variant stays `"destructive"` (maps to `--color-negative` via token alias).

#### `tx-status-badge.tsx`

The component now always renders a wrapping `<div aria-live="polite" aria-atomic="true">`. When `state.status === "idle"` the div is empty but present in the DOM — this satisfies the live region requirement (Requirement 12.9).

Spinner color on all in-flight states: `text-[color:var(--crate-orange)]`.

```tsx
export function TxStatusBadge({ state }: TxStatusBadgeProps) {
  return (
    <div aria-atomic="true" aria-live="polite">
      {state.status === "idle" ? null : (
        // … existing status branches with updated colors
      )}
    </div>
  );
}
```

Confirmed state adds a `CheckCircle` icon from lucide-react (already installed).

Error state: `text-[color:var(--color-negative)]` instead of `text-destructive`.

#### `wrong-network-banner.tsx`

```tsx
// Outer container
className="flex items-center justify-between gap-4
  border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] px-4 py-3"

// Message
"Switch to Robinhood Chain to trade crates."

// Button — variant="default" resolves to --crate-orange via token alias
<Button onClick={...} size="sm" variant="default">
  Switch Network
</Button>
```

#### `composite-index-chart.tsx`

The gradient and line always use `var(--crate-orange)` — the positive/negative conditional coloring from the Doji era is removed.

```tsx
// Gradient — always orange
<linearGradient id="indexGradient" x1="0" x2="0" y1="0" y2="1">
  <stop offset="0%" stopColor="var(--crate-orange)" stopOpacity={0.4} />
  <stop offset="100%" stopColor="var(--crate-orange)" stopOpacity={0} />
</linearGradient>

// Area
<Area
  stroke="var(--crate-orange)"
  fill="url(#indexGradient)"
  strokeWidth={1.5}
  activeDot={{ fill: "var(--crate-orange)", r: 3, strokeWidth: 0 }}
  …
/>

// Axes
<XAxis stroke="var(--border-subtle)" tick={{ fill: "var(--text-secondary)", fontSize: 10 }} … />
<YAxis tick={{ fill: "var(--text-secondary)", fontSize: 10 }} … />
<ReferenceLine stroke="var(--border-subtle)" strokeDasharray="3 3" y={100} />

// Tooltip
contentStyle={{
  backgroundColor: "var(--bg-surface)",
  border: "1px solid var(--border-default)",
  borderRadius: "0px",
  fontSize: "11px",
}}

// Skeleton
<div className="h-[240px] bg-[color:var(--bg-surface)]" data-slot="skeleton" … />

// Empty
<div className="flex h-[240px] items-center justify-center text-sm text-[color:var(--text-secondary)]">
  Chart data unavailable.
</div>
```

#### `allocation-preview.tsx`

```tsx
// Table border
<thead><tr className="border-b border-[color:var(--border-subtle)]">

// Row border
<tr className="border-b border-[color:var(--border-subtle)] last:border-0">

// Symbol column — orange
<td className="py-2 text-left text-sm font-medium text-[color:var(--crate-orange)]">
  {line.symbol}
</td>

// N/A USD value
{line.usdAmount == null ? (
  <td className="py-2 text-right text-sm text-[color:var(--text-tertiary)]">—</td>
) : …}
```

#### `constituent-list-item.tsx`

```tsx
// Row wrapper
<div className="flex items-center gap-3 border-b border-[color:var(--border-subtle)] px-3 py-3 last:border-0">

// Symbol (primary)
<p className="truncate text-sm font-medium text-[color:var(--text-primary)]">{constituent.symbol}</p>

// Name (secondary)
<p className="truncate text-xs text-[color:var(--text-secondary)]">{constituent.name}</p>

// Price
<p className="w-20 text-right text-sm text-[color:var(--text-primary)] tabular-nums">{priceDisplay}</p>

// 24h change — conditional on sign
changeClass = price.change24h >= 0
  ? "text-[color:var(--color-positive)]"
  : "text-[color:var(--color-negative)]"
// unavailable: "text-[color:var(--text-tertiary)]"

// Weight
<p className="w-10 text-right text-xs text-[color:var(--text-secondary)] tabular-nums">{weightPct}</p>
```

#### `timeframe-selector.tsx`

```tsx
// Fieldset — unchanged structure
<fieldset className="m-0 flex items-center gap-1 border-none p-0">

// Active chip
variant — use className override:
  "h-8 min-h-[44px] sm:min-h-8 bg-[color:var(--crate-orange)] text-[#0a0a0a] font-medium"

// Inactive chip
  "h-8 min-h-[44px] sm:min-h-8 bg-transparent border border-[color:var(--border-default)]
   text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
```

Since `Button` variant props can't express these two distinct backgrounds cleanly, use `variant="ghost"` as the base and override via `className` for the active state. The `variant="secondary"` used previously mapped to a grayed surface — we replace with an explicit orange override.

#### `token-toggle-chips.tsx`

```tsx
// Active chip
className={cn(
  "h-6 px-2.5 text-[10px]",
  isActive
    ? "bg-[color:var(--crate-orange)] text-[#0a0a0a] border-transparent"
    : "bg-[color:var(--bg-surface)] border border-[color:var(--border-default)] text-[color:var(--text-secondary)]"
)}
aria-label={`Toggle ${c.symbol}`}
```

#### `currency-toggle.tsx`

Remove the outer `rounded-md` wrapper. Update token classes:

```tsx
<div className="flex gap-0.5 border border-[color:var(--border-default)] p-0.5">
  {CURRENCIES.map((currency) => (
    <Button
      aria-pressed={value === currency}
      className={cn(
        "h-7 min-h-[44px] flex-1 text-xs sm:min-h-7",
        value === currency
          ? "bg-[color:var(--crate-orange)] text-[#0a0a0a]"
          : "bg-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]"
      )}
      key={currency}
      onClick={() => onChange(currency)}
      size="sm"
      type="button"
      variant="ghost"
    >
      {currency}
    </Button>
  ))}
</div>
```

#### `quick-buy-presets.tsx`

```tsx
<div className="flex gap-2 overflow-x-auto scrollbar-hide">
  {PRESETS.map((preset) => (
    <Button
      className="min-h-[44px] flex-none text-xs sm:min-h-8
        border border-[color:var(--border-default)] bg-transparent
        text-[color:var(--text-secondary)]
        hover:border-[color:var(--crate-orange)] hover:text-[color:var(--crate-orange)]"
      key={preset}
      onClick={() => onSelect(preset)}
      size="sm"
      type="button"
      variant="ghost"
    >
      {preset} ETH
    </Button>
  ))}
</div>
```

On mobile (`< 640px`) `overflow-x-auto scrollbar-hide` produces the single-row scrollable strip.

#### `basket-selector.tsx`

Updates back-navigation link text and destination:

```tsx
href="/crates"
// Text: "All Crates" (was "All Baskets")
```

---

## Data Models

This overhaul introduces no new data models. All component props, Zustand store shapes, tRPC types, and Drizzle schemas remain unchanged. The token type (`BasketConfig`, `BasketConstituent`, `TokenPrice`, etc.) is used as-is.

The only structural change is the route parameter rename from `basketId` to `crateId` in the URL segment directory `[crateId]` and the corresponding `generateStaticParams` return shape.

---

## Design Token System

### Complete `apps/web/src/index.css`

This is the authoritative output for the CSS file. It removes all Polymarket-era CSS (`.doji` scope, `--doji-green*`, Magic SDK iframe overrides, `.login-ui-frame`, `.doji-landing-grid-*`, `.pnl-day-hover-*`, onboarding `ticker-scroll`/`shimmer` keyframes, leaderboard classes) while retaining all functional infrastructure that this app uses.

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@custom-variant dark (&:where(.dark, .dark *));

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);
  --font-mono: var(--font-inter);
  --color-ring: var(--ring);
  --color-input: var(--input);
  --color-border: var(--border);
  --color-destructive: var(--destructive);
  --color-muted-foreground: var(--muted-foreground);
  --color-muted: var(--muted);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary: var(--primary);
  --color-card-foreground: var(--card-foreground);
  --color-card: var(--card);
  --radius-sm: calc(var(--radius) - 2px);
  --radius-md: var(--radius);
  --radius-lg: calc(var(--radius) + 2px);

  /* Trading terminal tokens */
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-text-muted: var(--text-muted);
  --color-buy: var(--color-buy);
  --color-sell: var(--color-sell);
  --color-profit: var(--color-profit);
  --color-loss: var(--color-loss);
  --color-positive: var(--color-positive);
  --color-negative: var(--color-negative);
  --color-border-subtle: var(--border-subtle);
  --color-border-default: var(--border-default);
  --color-border-strong: var(--border-strong);
  --color-crate-orange: var(--crate-orange);

  /*
   * Typography scale (6 sizes) — ONLY use these sizes.
   * 1. text-3xl  (30px) – Display / hero numbers
   * 2. text-2xl  (24px) – Section title / modal headers
   * 3. text-lg   (18px) – Card titles / headings
   * 4. text-sm   (14px) – Body / tables / nav / forms
   * 5. text-xs   (12px) – Captions / labels
   * 6. text-[10px] (10px) – Micro / badges / chart axes
   * 7. --font-size-order-amount (37.5px) – Order form input only
   */
}

/* ── Keyframes ───────────────────────────────────────────────────────────── */

@keyframes live-trade-flash {
  0% {
    background-color: color-mix(in oklch, var(--muted-foreground) 12%, transparent);
  }
  100% {
    background-color: transparent;
  }
}

@keyframes toast-slide-down {
  0% { opacity: 0; transform: translateY(-6px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes toast-slide-up {
  0% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 1; transform: translateY(0); }
}

@keyframes order-toast-shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes order-toast-pop {
  0% { transform: scale(1); }
  40% { transform: scale(1.02); }
  100% { transform: scale(1); }
}

@keyframes skeleton-shimmer-bg {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes chart-line-end-pulse-ring {
  0%, 74% { opacity: 0; transform: scale(1); }
  75% { opacity: 0.7; transform: scale(1); }
  100% { opacity: 0; transform: scale(4); }
}

/* ── Order toast ─────────────────────────────────────────────────────────── */

.order-toast-processing {
  position: relative;
  overflow: hidden;
}

.order-toast-processing::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
  background: linear-gradient(
    90deg,
    transparent 0%,
    color-mix(in oklch, var(--crate-orange) 4%, transparent) 40%,
    color-mix(in oklch, var(--crate-orange) 8%, transparent) 50%,
    color-mix(in oklch, var(--crate-orange) 4%, transparent) 60%,
    transparent 100%
  );
  animation: order-toast-shimmer 1.8s ease-in-out infinite;
}

.order-toast-complete {
  animation: order-toast-pop 0.35s ease-out;
}

/* ── Skeleton shimmer ────────────────────────────────────────────────────── */

[data-slot="skeleton"] {
  position: relative;
  overflow: hidden;
}

[data-slot="skeleton"]::after {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
  background: linear-gradient(
    90deg,
    transparent 0%,
    transparent 8%,
    color-mix(in oklch, var(--text-primary) 2%, transparent) 34%,
    color-mix(in oklch, var(--text-primary) 4%, transparent) 44%,
    color-mix(in oklch, var(--text-primary) 8%, transparent) 50%,
    color-mix(in oklch, var(--text-primary) 4%, transparent) 56%,
    color-mix(in oklch, var(--text-primary) 2%, transparent) 66%,
    transparent 92%,
    transparent 100%
  );
  background-repeat: no-repeat;
  background-size: 200% 100%;
  animation: skeleton-shimmer-bg 1.5s linear infinite;
}

/* ── Sonar ring ──────────────────────────────────────────────────────────── */

.sonar-ring {
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--crate-orange);
  border-radius: 50%;
  transform-origin: center;
  animation: chart-line-end-pulse-ring 4s ease-out infinite;
}

/* ── Reduced motion ──────────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .order-toast-processing::after,
  .order-toast-complete,
  .sonar-ring {
    animation: none;
  }
  [data-slot="skeleton"]::after {
    opacity: 0;
    animation: none;
  }
}

/* ── Global base ─────────────────────────────────────────────────────────── */

:root {
  /* Brand */
  --crate-orange: #FF6B35;
  --crate-orange-hover: color-mix(in oklch, #FF6B35 85%, black);
  --crate-orange-08: color-mix(in oklch, #FF6B35 8%, transparent);

  /* Backgrounds */
  --bg-base: #0a0a0a;
  --bg-surface: #111111;
  --bg-surface-raised: #1a1a1a;

  /* Borders */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --border-default: rgba(255, 255, 255, 0.10);
  --border-strong: rgba(255, 255, 255, 0.18);

  /* Text */
  --text-primary: #F0F0F0;
  --text-secondary: rgba(255, 255, 255, 0.50);
  --text-tertiary: rgba(255, 255, 255, 0.30);
  --text-muted: rgba(255, 255, 255, 0.30);

  /* Status */
  --color-positive: #22c55e;
  --color-negative: #ef4444;

  /* Trading functional tokens */
  --color-buy: var(--crate-orange);
  --color-sell: var(--color-negative);
  --color-profit: var(--color-positive);
  --color-loss: var(--color-negative);

  /* Tailwind semantic aliases */
  --background: var(--bg-base);
  --foreground: var(--text-primary);
  --primary: var(--crate-orange);
  --primary-foreground: #0a0a0a;
  --card: var(--bg-surface);
  --card-foreground: var(--text-primary);
  --popover: var(--bg-surface);
  --popover-foreground: var(--text-primary);
  --secondary: var(--bg-surface-raised);
  --secondary-foreground: var(--text-primary);
  --muted: var(--bg-surface);
  --muted-foreground: var(--text-secondary);
  --accent: var(--bg-surface-raised);
  --accent-foreground: var(--text-primary);
  --destructive: var(--color-negative);
  --destructive-foreground: #0a0a0a;
  --border: var(--border-default);
  --input: var(--border-default);
  --ring: var(--crate-orange);

  /* Radii — all-sharp Crate aesthetic */
  --radius: 0px;

  /* Order form amount input (preserved, not modified) */
  --font-size-order-amount: 2.34375rem;

  /* Header control row height */
  --header-control-height: 2.25rem;

  /* Workspace layout vars (terminal page) */
  --workspace-chart-row: clamp(220px, 65vh, 95vh);
  --workspace-pos-row: auto;
  --workspace-orderbook-col: minmax(220px, 21.3%);

  /* Scrollbar thumb */
  --color-scrollbar-thumb: var(--bg-surface-raised);
  --color-scrollbar-thumb-hover: var(--border-default);

  /* Semantic aliases for terminal tokens */
  --border-subtle: rgba(255, 255, 255, 0.06);
  --text-spread: var(--text-tertiary);
}

/* ── Body defaults ───────────────────────────────────────────────────────── */

@layer base {
  * {
    -ms-overflow-style: none;
    scrollbar-width: none;
    @apply border-border outline-ring/50;
  }

  *::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }

  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button {
    margin: 0;
    -webkit-appearance: none;
  }

  input[type="number"] {
    -moz-appearance: textfield;
  }

  body {
    background-color: var(--bg-base);
    color: var(--text-primary);
    @apply font-sans;
  }

  html {
    @apply font-sans;
  }

  button,
  [role="button"],
  [role="tab"],
  [role="menuitem"],
  [role="option"],
  [role="switch"],
  [role="slider"],
  [type="button"],
  [type="submit"],
  [type="reset"],
  summary {
    cursor: pointer;
  }

  input:not([type="checkbox"]):not([type="radio"]):hover:not(:focus-visible),
  textarea:hover:not(:focus-visible),
  select:hover:not(:focus-visible) {
    border-color: var(--border-strong) !important;
  }

  [data-slot="input-group"]:hover:not(:focus-within) {
    border-color: var(--border-strong) !important;
  }
}

/* ── Selection ───────────────────────────────────────────────────────────── */

::selection {
  background-color: var(--bg-surface-raised);
  color: var(--text-primary);
}

/* ── Button press feedback ───────────────────────────────────────────────── */

.btn-press {
  transition-timing-function: ease;
  transition-duration: 150ms;
  transition-property: transform, opacity, background-color, color;
}

.btn-press:active {
  transform: scale(0.96);
  transition-duration: 80ms;
}

/* ── Utilities ───────────────────────────────────────────────────────────── */

@utility scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
}

@utility no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    display: none;
    width: 0;
    height: 0;
  }
}

@utility scrollbar-subtle {
  scrollbar-color: var(--bg-surface-raised) transparent;
  scrollbar-width: thin;
  &::-webkit-scrollbar {
    display: block;
    width: 6px;
    height: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--bg-surface-raised);
  }
  &::-webkit-scrollbar-thumb:hover {
    background: var(--border-default);
  }
}

@utility scrollbar-overlay {
  overflow-y: overlay;
  scrollbar-color: var(--bg-surface-raised) transparent;
  scrollbar-width: thin;
  &::-webkit-scrollbar {
    position: absolute;
    display: block;
    width: 6px;
    height: 6px;
  }
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--bg-surface-raised);
  }
  &::-webkit-scrollbar-thumb:hover {
    background: var(--border-default);
  }
}

@utility text-positive {
  color: var(--color-positive);
}

@utility text-negative {
  color: var(--color-negative);
}
```

> **Note on `--border-subtle` duplicate:** `:root` already defines `--border-subtle` as a brand token above the semantic alias section. The alias at the bottom of `:root` is redundant and should be removed in the final file. The value `rgba(255,255,255,0.06)` is the correct single definition.

---

## Route Migration

### File Operations

```
MOVE:
  apps/web/src/app/(app)/baskets/page.tsx
  → apps/web/src/app/(app)/crates/page.tsx

MOVE:
  apps/web/src/app/(app)/baskets/[basketId]/page.tsx
  → apps/web/src/app/(app)/crates/[crateId]/page.tsx

CREATE (redirect stubs):
  apps/web/src/app/(app)/baskets/page.tsx        ← 301 to /crates
  apps/web/src/app/(app)/baskets/[basketId]/page.tsx  ← 301 to /crates/:id
```

### Redirect Stubs

**`apps/web/src/app/(app)/baskets/page.tsx`**
```tsx
import { redirect } from "next/navigation";

export default function BasketRedirect() {
  redirect("/crates");
}
```

**`apps/web/src/app/(app)/baskets/[basketId]/page.tsx`**
```tsx
import { redirect } from "next/navigation";

export default async function BasketIdRedirect({
  params,
}: {
  params: Promise<{ basketId: string }>;
}) {
  const { basketId } = await params;
  redirect(`/crates/${basketId}`);
}
```

`redirect()` in Next.js 16 App Router issues a 308 (Permanent Redirect) by default for non-RSC contexts. For a true 301, pass the `type` option: `redirect("/crates", RedirectType.replace)` — however the browser and crawlers treat 308 equivalently to 301 for GET requests. This is acceptable per the requirement's intent.

### Updated Crates Directory Page

**`apps/web/src/app/(app)/crates/page.tsx`**

```tsx
import { connection } from "next/server";
import { Suspense } from "react";
import { BASKETS } from "@/config/baskets";
import { BasketCatalogGrid } from "@/domains/baskets/components/basket-catalog-grid";
import { createPageMetadata } from "@/lib/seo";
import { serverTrpc } from "@/lib/trpc/server";

export const metadata = createPageMetadata({
  title: { absolute: "All Crates — Crate" },
  description: "Browse all available crates on Robinhood Chain.",
});

export default async function CratesPage() {
  await connection();

  const poolAddresses = BASKETS.flatMap((b) =>
    b.constituents.map((c) => c.poolAddress)
  );

  let prices = null;
  try {
    prices = await serverTrpc.baskets.getLivePrices.query({ poolAddresses });
  } catch {
    // graceful degradation
  }

  return (
    <div className="px-8 py-12 md:px-16">
      <div className="mb-8 flex items-end justify-between">
        <h1
          className="text-[color:var(--text-primary)]"
          style={{ fontSize: "clamp(36px,5vw,72px)", fontWeight: 800, letterSpacing: "-0.02em" }}
        >
          All crates.
        </h1>
        {/* UpdatedTimestamp is a client component — see below */}
        <UpdatedTimestamp />
      </div>
      <Suspense fallback={<BasketCatalogGrid isLoading />}>
        <BasketCatalogGrid prices={prices?.prices} />
      </Suspense>
    </div>
  );
}
```

`UpdatedTimestamp` is a minimal `"use client"` component that tracks a `useState` timestamp and calls `setInterval` every 60 seconds:

```tsx
"use client";

import { useEffect, useState } from "react";

export function UpdatedTimestamp() {
  const [secondsAgo, setSecondsAgo] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setSecondsAgo((s) => s + 60), 60_000);
    return () => clearInterval(id);
  }, []);

  const display = secondsAgo < 60
    ? "just now"
    : secondsAgo < 3600
      ? `${Math.floor(secondsAgo / 60)} minute${Math.floor(secondsAgo / 60) !== 1 ? "s" : ""} ago`
      : `${Math.floor(secondsAgo / 3600)} hour${Math.floor(secondsAgo / 3600) !== 1 ? "s" : ""} ago`;

  return (
    <span className="text-xs text-[color:var(--text-tertiary)]">
      Updated {display}
    </span>
  );
}
```

### Updated Crate Terminal Page

**`apps/web/src/app/(app)/crates/[crateId]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { BASKETS, getBasketById } from "@/config/baskets";
import { BasketSelector } from "@/domains/baskets/components/basket-selector";
import { BasketTerminalClient } from "@/domains/baskets/components/basket-terminal-client";
import { OrderPanel } from "@/domains/baskets/components/order-panel";
import { WrongNetworkBanner } from "@/domains/baskets/components/wrong-network-banner";
import { createPageMetadata } from "@/lib/seo";

export function generateStaticParams() {
  return BASKETS.map((b) => ({ crateId: b.id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ crateId: string }>;
}) {
  const { crateId } = await params;
  const crate = getBasketById(crateId);
  if (!crate) return { title: "Not Found" };
  return createPageMetadata({
    title: { absolute: `${crate.name} — Crate` },
    description: crate.description,
  });
}

export default async function CrateTerminalPage({
  params,
}: {
  params: Promise<{ crateId: string }>;
}) {
  const { crateId } = await params;
  const crate = getBasketById(crateId);
  if (!crate) notFound();

  await connection();

  return (
    <div className="flex h-full min-h-0 max-w-[100vw] flex-col overflow-hidden lg:flex-row">
      {/* Primary column: chart + constituents */}
      <div className="flex min-w-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <BasketSelector activeBasketId={crate.id} />
        <div>
          <h1
            className="text-[color:var(--text-primary)]"
            style={{ fontWeight: 800, letterSpacing: "-0.02em" }}
          >
            {crate.name}
          </h1>
          <p className="text-sm text-[color:var(--text-secondary)]">{crate.description}</p>
        </div>
        <BasketTerminalClient constituents={crate.constituents} />
      </div>

      {/* Sidebar: network banner + order panel */}
      <div className="flex w-full shrink-0 flex-col gap-3
        border-t border-[color:var(--border-default)] p-4
        lg:w-80 lg:overflow-y-auto lg:border-l lg:border-t-0">
        <WrongNetworkBanner />
        <OrderPanel basketId={crate.id} constituents={crate.constituents} />
      </div>
    </div>
  );
}
```

The `notFound()` call produces Next.js's 404 page. Requirement 5.7 specifies a custom 404 message — implement via `apps/web/src/app/not-found.tsx` (separate from this overhaul, or add to the migration if not already present).

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

This feature is a CSS/JSX transformation — no pure algorithmic functions suitable for random-input fuzzing. The properties below are universally quantified over the set of files, token names, basket IDs, and component states respectively. They are implemented as static analysis and integration checks rather than generative random tests, which is the appropriate strategy here (see "When PBT Is Not Appropriate" guidance: simple CRUD, configuration validation, and UI rendering are excluded; but universal structural invariants over finite enumerable input sets remain valid property tests).

### Property 1: Token Aliasing Completeness

*For any* Tailwind semantic token name in `{ --background, --foreground, --primary, --primary-foreground, --card, --card-foreground, --border, --muted-foreground, --destructive }`, the value declared in the `:root` block of `apps/web/src/index.css` must transitively resolve via `var()` chains to the corresponding Crate palette specification value.

**Validates: Requirements 1.7**

Test strategy: A Vitest unit test reads `index.css`, parses all `:root` custom property declarations into a `Map<string, string>`, implements a `resolve(token)` function that follows `var(--x)` references up to depth 5, and asserts each expected token resolves to its documented hex/rgba value. The test runs on the literal file content — no browser needed.

### Property 2: No Doji-Green References

*For any* line in `apps/web/src/index.css`, the pattern `--doji-green` must not appear as part of a CSS custom property name in a declaration (i.e., the regex `/--doji-green[\w-]*\s*:/` must match zero times in the full file text).

**Validates: Requirements 1.11**

Test strategy: A Vitest unit test reads the file as a string and asserts `file.match(/--doji-green[\w-]*\s*:/g) === null`.

### Property 3: Route Redirect Coverage

*For any* basket ID `id` in `BASKETS.map(b => b.id)`, an HTTP GET request to `/baskets/${id}` must respond with a status code in `{301, 307, 308}` and a `Location` header of `/crates/${id}`. Additionally, GET `/baskets` must redirect to `/crates`.

**Validates: Requirements 8.3, 8.4**

Test strategy: A Vitest integration test starts the Next.js server, iterates over `BASKETS`, sends a `fetch` request to each `/baskets/${id}` path with `redirect: "manual"`, and asserts the status and location header. The same test covers the `/baskets` → `/crates` root redirect.

### Property 4: Copy Migration Completeness

*For any* `.tsx` or `.ts` file under `apps/web/src/domains/baskets/components/` and `apps/web/src/shell/`, the raw file source must contain zero occurrences of the word "basket" or "baskets" as a standalone word within JSX text content and string literal values (regex: `/\bbaskets?\b/i` applied after stripping TypeScript identifier tokens — specifically, the scan excludes tokens matching `/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/` that appear in variable/function/import/type positions).

**Validates: Requirements 7.1, 7.2**

Test strategy: A Vitest unit test uses `fast-glob` (already installed) to enumerate all `.tsx`/`.ts` files in the two directories, reads each file, strips import statements and TypeScript identifiers from consideration (via regex pre-processing), then asserts the remaining content contains no `/\bbaskets?\b/i` matches. Files with zero matches pass; any match causes the test to fail with the filename and line number.

---

## Error Handling

### `notFound()` in terminal page

`getBasketById(crateId)` returns `undefined` when the URL segment doesn't match any configured crate. The page calls `notFound()` immediately, which throws the Next.js `NEXT_NOT_FOUND` sentinel and renders the nearest `not-found.tsx`. This is the correct pattern — do not wrap `notFound()` in try-catch.

### Price fetch failures

`serverTrpc.baskets.getLivePrices.query` is wrapped in try-catch in both the home page and crates directory page. On failure, `prices` is `null` and the catalog renders without prefetched prices. The client-side `BasketTerminalClient` will re-fetch on mount.

### Redirect stubs

The redirect stub pages call `redirect()` at the top level — no try-catch. If the redirect target itself fails, Next.js handles the error boundary normally.

### Token resolution failures

If a CSS `var()` chain is broken (e.g. a token references a non-existent property), the browser silently uses the inherited or initial value. This is mitigated by the static token test (Property 1) and by keeping all token definitions in a single `:root` block with no class-scoped overrides.

---

## Testing Strategy

This feature has no new algorithmic functions — all logic is pre-existing and tested. Testing focuses on regression prevention for the three changed categories:

### Unit Tests

- `allocation.ts`, `composite-index.ts`, `format-tx.ts` — **no change, no new tests needed**.
- `truncateAddress` helper: if extracted to a shared util, add a unit test for the `0x${first6}…${last4}` format.
- `computeWeightedPerformance` in `basket-card.tsx` — already covered; no change.

### Snapshot Tests

Each restyled component should have a snapshot test that captures the rendered HTML. On the next run after the overhaul, the snapshots are updated once and then serve as a regression baseline.

Priority components for snapshot tests:
- `BasketCard` (new `border-default`, `bg-surface`, `/crates/` href, explorer link)
- `HomeHero` (new heading text, CTA copy)
- `TxStatusBadge` (all five states, `aria-live` wrapper always present)
- `WrongNetworkBanner` ("crates" copy)

### Integration Tests

Property 3 (route redirect coverage) is the only integration test. Execute during `pnpm test:integration` against a running Next.js dev or built server.

### Static Analysis

Property 2 and Property 4 are best expressed as static analysis checks:
- A Vitest unit test in `tests/unit/crate-overhaul.test.ts` that reads `index.css` and all component files and asserts the regex conditions.
- These run in `pnpm test:unit` with no external server needed.

### Manual Checks

Full WCAG AA compliance verification (Requirement 12.6, 12.7) requires manual testing with a colour contrast analyser. The design-level calculation:

- `#F0F0F0` on `#0a0a0a`: luminance ratio ≈ 16.75:1 — passes WCAG AA (4.5:1) and AAA (7:1) for all text sizes.
- `rgba(255,255,255,0.50)` on `#0a0a0a`: effective colour ≈ `#808080`, ratio ≈ 3.9:1 — passes WCAG AA for large text (3:1) and just above the 3.5:1 threshold for 14px medium weight; acceptable for secondary labels.

---

## Migration Checklist

Execute in this order. Each step is independently verifiable before proceeding.

1. **`apps/web/src/index.css`** — Full token rewrite (everything downstream depends on this)
2. **`apps/web/src/shell/header-control-styles.ts`** — Class constant updates; remove Polymarket-era exports
3. **`apps/web/src/shell/header-nav.tsx`** — Two-link NAV_LINKS, updated active classes
4. **`apps/web/src/shell/site-header.tsx`** — Crate wordmark, `h-12`/`h-11` heights, token classes
5. **`apps/web/src/shell/header-actions.tsx`** — aria-labels, `h-8` sizing, balance to 4dp
6. **`apps/web/src/shell/bottom-bar.tsx`** — Token class updates only
7. **`apps/web/src/shell/app-shell-router.tsx`** — `/crates/` check, remove CommentsProvider
8. **Route migration** — Move pages to `(app)/crates/`, create redirect stubs in `(app)/baskets/`
9. **`apps/web/src/app/page.tsx`** — Metadata update, layout, HomeHero import unchanged
10. **`apps/web/src/app/(app)/crates/page.tsx`** — New heading, timestamp, metadata
11. **`apps/web/src/app/(app)/crates/[crateId]/page.tsx`** — Param rename, metadata, sidebar tokens
12. **`domains/baskets/components/home-hero.tsx`** — Full replacement (hero heading, CTA)
13. **`domains/baskets/components/basket-card.tsx`** — Token classes, `/crates/` href, ticker, explorer link
14. **`domains/baskets/components/basket-card-skeleton.tsx`** — Sharp corners, `bg-surface` tokens
15. **`domains/baskets/components/basket-catalog-grid.tsx`** — Empty state addition
16. **`domains/baskets/components/order-panel.tsx`** — Token classes, "Buy Crate" / "Exit Crate" tabs
17. **`domains/baskets/components/buy-panel.tsx`** — "Buy Crate" label, aria-disabled
18. **`domains/baskets/components/exit-panel.tsx`** — "Exit to ETH", "No Crate Tokens", token classes
19. **`domains/baskets/components/tx-status-badge.tsx`** — aria-live wrapper, orange spinners, CheckCircle
20. **`domains/baskets/components/wrong-network-banner.tsx`** — "crates" copy, token classes
21. **`domains/baskets/components/composite-index-chart.tsx`** — Orange gradient/line, tooltip radius, empty/skeleton tokens
22. **`domains/baskets/components/allocation-preview.tsx`** — Orange symbol column, border-subtle
23. **`domains/baskets/components/constituent-list-item.tsx`** — Token classes, positive/negative colors
24. **`domains/baskets/components/timeframe-selector.tsx`** — Active/inactive chip colors
25. **`domains/baskets/components/token-toggle-chips.tsx`** — Active/inactive chip colors, aria-label
26. **`domains/baskets/components/currency-toggle.tsx`** — Sharp container, orange active state
27. **`domains/baskets/components/quick-buy-presets.tsx`** — Orange hover, scrollable strip
28. **`domains/baskets/components/basket-selector.tsx`** — `/crates` href, "All Crates"
29. **Verify remaining components** (`basket-chart.tsx`, `token-candlestick-chart.tsx`) for any `--doji-green` or `/baskets/` references
30. **`pnpm fix`** — Biome/Ultracite lint + format pass
31. **`pnpm check-types`** — TypeScript validation
32. **Static analysis tests** — Run Property 2 and Property 4 checks
33. **Snapshot update** — Run `pnpm test:unit -u` to accept new snapshots

---

## Copy Migration Map

| File | Old string | New string |
|------|-----------|------------|
| `header-nav.tsx` | `"Baskets"` | `"Crates"` |
| `app-shell-router.tsx` | `"/baskets/"` (pathname check) | `"/crates/"` |
| `home-hero.tsx` | `"Trade Crypto Baskets"` | `"Trade in Crates."` |
| `home-hero.tsx` | `"Invest in curated token baskets with a single transaction on Robinhood Chain."` | `"Buy curated on-chain token crates with a single transaction on Robinhood Chain."` |
| `home-hero.tsx` | `"Explore Baskets"` | `"Enter app →"` |
| `home-hero.tsx` | `href="/baskets"` | `href="/crates"` |
| `basket-card.tsx` | `href="/baskets/${basket.id}"` | `href="/crates/${basket.id}"` |
| `basket-selector.tsx` | `href="/baskets"` | `href="/crates"` |
| `basket-selector.tsx` | `"All Baskets"` | `"All Crates"` |
| `buy-panel.tsx` | `"Buy Basket"` | `"Buy Crate"` |
| `exit-panel.tsx` | `"Exit Basket to ETH"` | `"Exit to ETH"` |
| `exit-panel.tsx` | `"No Basket Tokens"` | `"No Crate Tokens"` |
| `wrong-network-banner.tsx` | `"trade baskets."` | `"trade crates."` |
| `order-panel.tsx` | `"Buy"` (tab label) | `"Buy Crate"` |
| `order-panel.tsx` | `"Exit"` (tab label) | `"Exit Crate"` |
| `app/page.tsx` | `title: { absolute: "Doji" }` | `title: { absolute: "Crate — Trade in Crates" }` |
| `app/page.tsx` | `"Trade curated crypto baskets with a single transaction on Robinhood Chain."` | `"Trade curated on-chain token crates on Robinhood Chain."` |
| `app/(app)/crates/page.tsx` | `"Baskets"` | `"All Crates — Crate"` (in metadata) |
| `app/(app)/crates/page.tsx` | `"Baskets"` heading | `"All crates."` |
| `app/(app)/crates/[crateId]/page.tsx` | `"${basket.name} — Doji"` | `"${crate.name} — Crate"` |
