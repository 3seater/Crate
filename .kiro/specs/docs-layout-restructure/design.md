# Design Document: Docs Layout Restructure

## Overview

Restructure the Doji documentation site from a 30+ page layout to a minimal 15-page, 4-section layout. The restructure includes:

1. Reorganizing the sidebar into four sections: Get Started, Trade, Monitor, Support
2. Deleting 18 pages, merging content into consolidated pages, creating 3 new pages
3. Syncing the docs logo SVG to match the web app's logo exactly
4. Syncing docs dark mode CSS variables to match the web app's `.doji` theme class
5. Updating all internal links to prevent broken references

The docs site uses Fumadocs with MDX content in `apps/docs/content/docs/`. Navigation is controlled by `apps/docs/content/docs/meta.json` using Fumadocs separator syntax.

## Architecture

The restructure is purely a content and configuration change — no new components, APIs, or build changes. The architecture remains:

```
apps/docs/
├── content/docs/           # MDX pages + meta.json (PRIMARY CHANGES)
├── src/
│   ├── app/global.css      # Theme sync (CSS variable updates)
│   ├── components/
│   │   └── doji-logo.tsx   # Logo sync (SVG replacement)
│   └── lib/layout.shared.tsx  # No changes needed
└── source.config.ts        # No changes needed
```

### Sidebar Structure (New)

```
index                          ← root landing page (updated)
---Get Started---
  sign-in-and-wallet-setup     ← NEW (merged from 4 pages)
  deposit-and-withdraw         ← NEW (merged from 3 pages)
---Trade---
  explore-and-search           ← NEW (merged from 2 pages)
  trading/index                ← UPDATED (settings content added)
  trading/placing-orders       ← RETAINED (links updated)
  trading/charts               ← RETAINED (links updated)
---Monitor---
  portfolio                    ← RETAINED (links updated)
  watchlist                    ← RETAINED (links updated)
  tracker                      ← RETAINED (links updated)
  calendar                     ← RETAINED (no changes needed)
  activity-feed                ← NEW page
  leaderboard                  ← RETAINED (links updated)
---Support---
  reference/fees               ← RETAINED at current path (links updated)
  common-issues                ← NEW (merged from troubleshooting + faq)
  support                      ← NEW page
```

## Components and Interfaces

### 1. meta.json (New Structure)

```json
{
  "title": "Doji",
  "pages": [
    "index",
    "---Get Started---",
    "sign-in-and-wallet-setup",
    "deposit-and-withdraw",
    "---Trade---",
    "explore-and-search",
    "trading/index",
    "trading/placing-orders",
    "trading/charts",
    "---Monitor---",
    "portfolio",
    "watchlist",
    "tracker",
    "calendar",
    "activity-feed",
    "leaderboard",
    "---Support---",
    "reference/fees",
    "common-issues",
    "support"
  ]
}
```

### 2. File Operations Plan

#### Files to DELETE (18 files)

| File | Reason |
|------|--------|
| `polymarket-101.mdx` | Prediction market fundamentals — out of scope |
| `concepts/index.mdx` | Section removed |
| `concepts/order-lifecycle.mdx` | Fundamentals content removed |
| `concepts/neg-risk.mdx` | Fundamentals content removed |
| `getting-started/index.mdx` | Replaced by consolidated page |
| `getting-started/create-account.mdx` | Merged into sign-in-and-wallet-setup |
| `getting-started/onboarding.mdx` | Merged into sign-in-and-wallet-setup |
| `getting-started/first-trade.mdx` | Content not carried forward (trading pages cover this) |
| `faq.mdx` | Merged into common-issues |
| `referrals.mdx` | Removed entirely |
| `bridge.mdx` | Merged into deposit-and-withdraw |
| `settings.mdx` | Merged into trading/index |
| `wallet/index.mdx` | Split across sign-in-and-wallet-setup + deposit-and-withdraw |
| `reference/glossary.mdx` | Removed entirely |
| `reference/keyboard-shortcuts.mdx` | Search shortcut merged into explore-and-search |
| `reference/markets-and-events.mdx` | Removed entirely |
| `reference/order-types.mdx` | Content already in placing-orders |
| `reference/supported-assets.mdx` | Removed entirely |
| `explore.mdx` | Replaced by explore-and-search |
| `troubleshooting.mdx` | Replaced by common-issues |

After deletions, also remove empty directories: `getting-started/`, `concepts/`, `wallet/`. The `reference/` directory stays (contains `fees.mdx`). The `trading/` directory stays.

#### Files to CREATE (5 files)

| File | Content Source |
|------|---------------|
| `sign-in-and-wallet-setup.mdx` | Merged from `create-account.mdx`, `onboarding.mdx`, wallet sign-in/session/export/fix-approvals sections from `wallet/index.mdx` |
| `deposit-and-withdraw.mdx` | Merged from `bridge.mdx`, deposit/withdrawal sections from `wallet/index.mdx`, bridge troubleshooting from `troubleshooting.mdx` |
| `explore-and-search.mdx` | Merged from `explore.mdx` + search shortcut from `keyboard-shortcuts.mdx` |
| `activity-feed.mdx` | New content documenting the bottom-bar Activity widget |
| `support.mdx` | New content with Discord, X/Twitter links, bug reporting |
| `common-issues.mdx` | Merged from `troubleshooting.mdx` + relevant FAQ entries from `faq.mdx` |

#### Files to MODIFY (8 files)

| File | Changes |
|------|---------|
| `meta.json` | Complete rewrite to new 4-section structure |
| `index.mdx` | Update cards/links to match new layout |
| `trading/index.mdx` | Add Settings section from `settings.mdx` |
| `trading/placing-orders.mdx` | Update internal links |
| `trading/charts.mdx` | No link changes needed (no links to deleted pages) |
| `portfolio.mdx` | Update links (Bridge → deposit-and-withdraw, Watchlist link stays) |
| `tracker.mdx` | No link changes needed |
| `leaderboard.mdx` | Update link (Address Tracker path stays same) |
| `watchlist.mdx` | No link changes needed |
| `reference/fees.mdx` | Update link (Bridge → deposit-and-withdraw) |

### 3. Content Migration Strategy

#### sign-in-and-wallet-setup.mdx

Sections in order:
1. **Sign-In Methods** — from `create-account.mdx` (email, Google, external wallet steps)
2. **Embedded Wallet** — from `wallet/index.mdx` (Magic wallet explanation)
3. **Wallet Setup (Gnosis Safe)** — from `onboarding.mdx` (wallet creation steps)
4. **Sessions** — from `wallet/index.mdx` (session management)
5. **Export Private Key** — from `wallet/index.mdx` (backup instructions)
6. **Fix Approvals** — from `wallet/index.mdx` (approval flow)

#### deposit-and-withdraw.mdx

Sections in order:
1. **Overview** — USDC on Polygon, balance in header
2. **Deposits** — merged from `bridge.mdx` and `wallet/index.mdx` deposit sections
3. **Withdrawals** — merged from `bridge.mdx` and `wallet/index.mdx` withdrawal sections
4. **Troubleshooting** — from `wallet/index.mdx` bridge troubleshooting + relevant entries from `troubleshooting.mdx` (bridge errors table)

#### explore-and-search.mdx

Sections in order:
1. All content from `explore.mdx` (tabs, categories, filters, views)
2. **Global Search** section — Ctrl+K shortcut documentation from `keyboard-shortcuts.mdx`, plus existing search mention from `explore.mdx`

#### common-issues.mdx

Sections in order:
1. **Order Errors** — table from `troubleshooting.mdx`
2. **Account & Login Errors** — table from `troubleshooting.mdx`
3. **Wallet & Onboarding Errors** — table from `troubleshooting.mdx`
4. **Trading Restrictions** — table from `troubleshooting.mdx`
5. **Platform Status** — table from `troubleshooting.mdx`
6. **FAQ** — relevant accordion entries from `faq.mdx` (non-custodial, network, gas, resolution, redemption, selling, invite codes, account recovery, matching engine restarts)

All internal links updated to new paths. References to deleted pages (Bridge, Referrals, Polymarket 101, Glossary) either inlined or removed.

#### trading/index.mdx (Updated)

Add a new `## Settings` section at the bottom with content from `settings.mdx`:
- Market Order Type (FAK vs FOK)
- Orderbook Flash Effects
- Notifications (toasts, sounds)

### 4. Logo Replacement Approach

**Current state:** `apps/docs/src/components/doji-logo.tsx` renders an inline SVG with `viewBox="0 0 1430 714"` using `var(--doji-green)` for candlestick fills and `var(--color-fd-foreground)` for text. The web app uses a completely different SVG at `apps/web/public/doji-logo.svg` with `viewBox="0 0 720 343"`, hardcoded `#BFF85A` fills and `#F5F5F5` text.

**Approach:** Replace the inline SVG in `apps/docs/src/components/doji-logo.tsx` with the web app's SVG content, adapted for the docs context:

1. Copy the SVG path data from `apps/web/public/doji-logo.svg` into the docs component
2. Update `viewBox` to `"0 0 720 343"`
3. Keep candlestick fills as `#BFF85A` (matches web) or use `var(--doji-green)` since docs `.dark` already sets `--doji-green: #bff85a`
4. Use `var(--color-fd-foreground, var(--foreground))` for text fill (so it adapts to light/dark mode), or hardcode `#F5F5F5` since docs defaults to dark mode
5. Preserve the `aria-label`, `role="img"`, and `className` prop interface

**Decision:** Use CSS variables (`var(--doji-green)` for candlesticks, `var(--color-fd-foreground, var(--foreground))` for text) so the logo works in both light and dark mode, matching the current approach but with the correct SVG paths from the web app.

### 5. Theme Color Sync Plan

Update `apps/docs/src/app/global.css` `.dark` class values to match `apps/web/src/index.css` `.doji` class values:

| CSS Variable | Current (docs `.dark`) | Target (web `.doji`) |
|---|---|---|
| `--background` | `oklch(0.145 0.01 255)` | `oklch(0.17 0.01 255)` |
| `--card` | `oklch(0.17 0.01 255)` | `oklch(0.18 0.01 255)` |
| `--foreground` | `oklch(0.93 0.004 255)` | `oklch(0.94 0.004 255)` |
| `--surface-2` | `oklch(0.185 0.01 255)` | `oklch(0.195 0.01 255)` |
| `--surface-3` | `oklch(0.2 0.01 255)` | `oklch(0.215 0.01 255)` |
| `--surface-4` | `oklch(0.22 0.01 255)` | `oklch(0.235 0.01 255)` |
| `--text-secondary` | `oklch(0.66 0.003 255)` | `oklch(0.67 0.003 255)` |
| `--text-muted` | `oklch(0.66 0.003 255)` | `oklch(0.67 0.003 255)` |
| `--border` | `oklch(0.255 0.01 255)` | `oklch(0.27 0.01 255)` |
| `--text-primary` | `oklch(0.93 0.004 255)` | `oklch(0.94 0.004 255)` |

Also sync derived values that depend on these:
- `--border-subtle` stays as-is (opacity-based, derives from foreground)
- `--border-strong` stays as-is (opacity-based, derives from foreground)

### 6. Internal Link Update Strategy

**Deleted paths and their replacements:**

| Old Path | New Path |
|----------|----------|
| `/docs/polymarket-101` | Remove link or inline info |
| `/docs/concepts/*` | Remove link or inline info |
| `/docs/getting-started` | `/docs/sign-in-and-wallet-setup` |
| `/docs/getting-started/create-account` | `/docs/sign-in-and-wallet-setup` |
| `/docs/getting-started/onboarding` | `/docs/sign-in-and-wallet-setup` |
| `/docs/getting-started/first-trade` | `/docs/trading` |
| `/docs/faq` | `/docs/common-issues` |
| `/docs/bridge` | `/docs/deposit-and-withdraw` |
| `/docs/wallet` | `/docs/sign-in-and-wallet-setup` or `/docs/deposit-and-withdraw` (context-dependent) |
| `/docs/settings` | `/docs/trading` (settings section) |
| `/docs/referrals` | Remove link |
| `/docs/reference/glossary` | Remove link |
| `/docs/reference/keyboard-shortcuts` | `/docs/explore-and-search` (search section) |
| `/docs/reference/markets-and-events` | Remove link |
| `/docs/reference/order-types` | `/docs/trading/placing-orders` |
| `/docs/reference/supported-assets` | Remove link or inline info |
| `/docs/explore` | `/docs/explore-and-search` |
| `/docs/troubleshooting` | `/docs/common-issues` |

**Process:** After creating/modifying all pages, grep the entire `content/docs/` directory for any remaining references to deleted paths and fix them.

### 7. Activity Feed Page Content

New page documenting the bottom-bar Activity widget based on the web app's `ActivityWidget` component:

- **What it shows** — Live feed of recent trades across Polymarket
- **How to open** — Click "Activity" in the bottom bar
- **Dockable** — Can be docked to left or right side panels
- **Trade details** — Each entry shows market, side (buy/sell), price, size, and timestamp
- **Navigation** — Click any trade to jump to that market

### 8. Support Page Content

New page with community and support links:

- **Discord** — Link to Discord server for community support and discussion
- **X (Twitter)** — Link to `x.com/dojibet` for announcements and updates
- **Bug Reporting** — Instructions to report bugs via Discord or GitHub issues
- **Contact** — Guidance on reaching the Doji team through Discord

## Data Models

No data model changes. This is a content-only restructure. The Fumadocs MDX pipeline, source config, and content loader remain unchanged.

## Error Handling

- **Broken links:** The primary risk. Mitigated by the link audit step (grep for all old paths after restructure).
- **Missing pages in meta.json:** If meta.json references a file that doesn't exist, Fumadocs will error at build time. Mitigated by ensuring every entry in meta.json has a corresponding MDX file.
- **Empty directories:** After deleting files, empty directories (`getting-started/`, `concepts/`, `wallet/`) should be removed to avoid confusion.
- **Build verification:** Run `pnpm build` in the docs app after all changes to catch any broken references or missing files.

## Testing Strategy

Property-based testing is not applicable to this feature. The restructure involves:
- MDX content files (static text)
- JSON configuration (meta.json)
- CSS variable updates (theme sync)
- SVG replacement (logo sync)

None of these involve pure functions, algorithmic logic, or input/output transformations suitable for PBT.

### Recommended Testing Approach

1. **Build test:** `pnpm build` in `apps/docs/` — catches missing files, broken MDX imports, and meta.json mismatches
2. **Link audit:** Grep all MDX files for references to deleted paths — ensures zero broken internal links
3. **Visual verification:** Manual check of the docs site in dev mode to confirm:
   - Sidebar renders 4 sections with correct pages
   - Logo matches web app
   - Dark mode colors match web app
   - All pages render without errors
4. **Type check:** `pnpm check-types` to ensure no TypeScript issues in modified components
