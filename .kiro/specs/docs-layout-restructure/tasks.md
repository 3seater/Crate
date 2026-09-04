# Implementation Plan: Docs Layout Restructure

## Overview

Restructure the Doji docs site from 30+ pages to a 15-page, 4-section layout. Execution order: theme sync → logo sync → create new pages → update existing pages → update internal links in retained pages → rewrite meta.json → delete old files → link audit → build verification.

## Tasks

- [x] 1. Theme sync — update CSS variables in `apps/docs/src/app/global.css`
  - [x] 1.1 Update `.dark` class CSS variables to match web app `.doji` class values
    - `--background`: `oklch(0.145 0.01 255)` → `oklch(0.17 0.01 255)`
    - `--card`: `oklch(0.17 0.01 255)` → `oklch(0.18 0.01 255)`
    - `--foreground`: `oklch(0.93 0.004 255)` → `oklch(0.94 0.004 255)`
    - `--surface-2`: `oklch(0.185 0.01 255)` → `oklch(0.195 0.01 255)`
    - `--surface-3`: `oklch(0.2 0.01 255)` → `oklch(0.215 0.01 255)`
    - `--surface-4`: `oklch(0.22 0.01 255)` → `oklch(0.235 0.01 255)`
    - `--text-primary`: `oklch(0.93 0.004 255)` → `oklch(0.94 0.004 255)`
    - `--text-secondary`: `oklch(0.66 0.003 255)` → `oklch(0.67 0.003 255)`
    - `--text-muted`: `oklch(0.66 0.003 255)` → `oklch(0.67 0.003 255)`
    - `--border`: `oklch(0.255 0.01 255)` → `oklch(0.27 0.01 255)`
    - _Requirements: Design §5 (Theme Color Sync Plan)_

- [x] 2. Logo sync — replace SVG in `apps/docs/src/components/doji-logo.tsx`
  - [x] 2.1 Replace inline SVG with web app's SVG path data from `apps/web/public/doji-logo.svg`
    - Update `viewBox` to `"0 0 720 343"`
    - Use `var(--doji-green)` for candlestick fills (5 paths)
    - Use `var(--color-fd-foreground, var(--foreground))` for text fill (1 path)
    - Preserve `aria-label="Doji"`, `role="img"`, and `className` prop
    - Remove old drop-shadow filter, add new filter from web SVG adapted with React camelCase attributes
    - _Requirements: Design §4 (Logo Replacement Approach)_

- [x] 3. Create new content pages
  - [x] 3.1 Create `apps/docs/content/docs/sign-in-and-wallet-setup.mdx`
    - Section 1 — Sign-In Methods: pull from `getting-started/create-account.mdx` (email, Google, external wallet steps)
    - Section 2 — Embedded Wallet: pull from `wallet/index.mdx` (Magic wallet explanation)
    - Section 3 — Wallet Setup (Gnosis Safe): pull from `getting-started/onboarding.mdx` (wallet creation steps)
    - Section 4 — Sessions: pull from `wallet/index.mdx` (session management)
    - Section 5 — Export Private Key: pull from `wallet/index.mdx` (backup instructions)
    - Section 6 — Fix Approvals: pull from `wallet/index.mdx` (approval flow)
    - All internal links must use new page paths
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 3.2 Create `apps/docs/content/docs/deposit-and-withdraw.mdx`
    - Section 1 — Overview: USDC on Polygon, balance in header
    - Section 2 — Deposits: merge from `bridge.mdx` deposit sections + `wallet/index.mdx` deposit sections
    - Section 3 — Withdrawals: merge from `bridge.mdx` withdrawal sections + `wallet/index.mdx` withdrawal sections
    - Section 4 — Troubleshooting: bridge troubleshooting from `wallet/index.mdx` + bridge error entries from `troubleshooting.mdx`
    - All internal links must use new page paths
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 3.3 Create `apps/docs/content/docs/explore-and-search.mdx`
    - All content from `explore.mdx` (tabs, categories, filters, views)
    - New "Global Search" section: Ctrl+K shortcut documentation from `reference/keyboard-shortcuts.mdx` + existing search mention from `explore.mdx`
    - All internal links must use new page paths
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 3.4 Create `apps/docs/content/docs/activity-feed.mdx`
    - New page documenting the bottom-bar Activity widget
    - Content: what it shows (live trade feed), how to open (click Activity in bottom bar), dockable panel, trade details (market, side, price, size, timestamp), navigation (click to jump to market)
    - _Requirements: 8.5_

  - [x] 3.5 Create `apps/docs/content/docs/common-issues.mdx`
    - Section 1 — Order Errors: table from `troubleshooting.mdx`
    - Section 2 — Account & Login Errors: table from `troubleshooting.mdx`
    - Section 3 — Wallet & Onboarding Errors: table from `troubleshooting.mdx`
    - Section 4 — Trading Restrictions: table from `troubleshooting.mdx`
    - Section 5 — Platform Status: table from `troubleshooting.mdx`
    - Section 6 — FAQ: relevant entries from `faq.mdx` (non-custodial, network, gas, resolution, redemption, selling, invite codes, account recovery, matching engine restarts)
    - Remove references to deleted pages (Bridge → deposit-and-withdraw, Referrals → remove, Polymarket 101 → remove, Glossary → remove)
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 3.6 Create `apps/docs/content/docs/support.mdx`
    - Discord invite link for community support
    - X/Twitter link (`x.com/dojibet`) for announcements
    - Bug reporting instructions (Discord or GitHub issues)
    - Guidance on reaching the Doji team
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 4. Update existing pages
  - [x] 4.1 Update `apps/docs/content/docs/trading/index.mdx` — add Settings section
    - Add `## Settings` section at the bottom with content from `settings.mdx`
    - Include: Market Order Type (FAK vs FOK), Orderbook Flash Effects, Notifications (toasts, sounds)
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 4.2 Update `apps/docs/content/docs/index.mdx` — new layout cards
    - Update card links and quick links to reference only pages in the new layout
    - Remove links to deleted pages (Polymarket 101, Glossary, Wallet & Funds, etc.)
    - Organize navigation cards to match four sections: Get Started, Trade, Monitor, Support
    - _Requirements: 12.1, 12.2, 12.3_

- [x] 5. Checkpoint — verify new and updated pages
  - Ensure all new MDX files have valid frontmatter (title, description)
  - Ensure all updated pages have correct content
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Update internal links in retained pages
  - [x] 6.1 Update `apps/docs/content/docs/portfolio.mdx`
    - Replace any `/bridge` links → `/deposit-and-withdraw`
    - Replace any `/wallet` links → `/sign-in-and-wallet-setup` or `/deposit-and-withdraw` (context-dependent)
    - _Requirements: 8.1, 8.7_

  - [x] 6.2 Update `apps/docs/content/docs/trading/placing-orders.mdx`
    - Replace any links to deleted pages with new paths per Design §6 link mapping
    - _Requirements: 7.1, 7.3_

  - [x] 6.3 Update `apps/docs/content/docs/leaderboard.mdx`
    - Verify/update internal links (Address Tracker path stays same)
    - _Requirements: 8.6, 8.7_

  - [x] 6.4 Update `apps/docs/content/docs/reference/fees.mdx`
    - Replace any `/bridge` links → `/deposit-and-withdraw`
    - _Requirements: 9.1, 9.2_

  - [x] 6.5 Update `apps/docs/content/docs/watchlist.mdx`
    - Verify no links to deleted pages exist
    - _Requirements: 8.2, 8.7_

  - [x] 6.6 Update `apps/docs/content/docs/tracker.mdx`
    - Verify no links to deleted pages exist
    - _Requirements: 8.3, 8.7_

  - [x] 6.7 Update `apps/docs/content/docs/trading/charts.mdx`
    - Verify no links to deleted pages exist
    - _Requirements: 7.2, 7.4_

- [x] 7. Rewrite `apps/docs/content/docs/meta.json` to new 4-section structure
  - Replace entire `pages` array with the new structure from Design §1
  - Sections: `---Get Started---`, `---Trade---`, `---Monitor---`, `---Support---`
  - 15 page entries (excluding separators and root index): `sign-in-and-wallet-setup`, `deposit-and-withdraw`, `explore-and-search`, `trading/index`, `trading/placing-orders`, `trading/charts`, `portfolio`, `watchlist`, `tracker`, `calendar`, `activity-feed`, `leaderboard`, `reference/fees`, `common-issues`, `support`
  - Preserve root `index` entry before first separator
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 14.1, 14.2, 14.3, 14.4, 15.1, 15.2_

- [x] 8. Delete old files and empty directories
  - [x] 8.1 Delete content files that were merged or removed
    - `polymarket-101.mdx`, `faq.mdx`, `referrals.mdx`, `bridge.mdx`, `settings.mdx`, `explore.mdx`, `troubleshooting.mdx`
    - `concepts/index.mdx`, `concepts/order-lifecycle.mdx`, `concepts/neg-risk.mdx`
    - `getting-started/index.mdx`, `getting-started/create-account.mdx`, `getting-started/onboarding.mdx`, `getting-started/first-trade.mdx`
    - `wallet/index.mdx`
    - `reference/glossary.mdx`, `reference/keyboard-shortcuts.mdx`, `reference/markets-and-events.mdx`, `reference/order-types.mdx`, `reference/supported-assets.mdx`
    - _Requirements: 2.1–2.11_

  - [x] 8.2 Remove empty directories
    - Delete `getting-started/`, `concepts/`, `wallet/` directories
    - `reference/` stays (contains `fees.mdx`), `trading/` stays
    - _Requirements: Design §2 (File Operations Plan)_

- [x] 9. Link audit — grep for broken references
  - Grep all `.mdx` files in `apps/docs/content/docs/` for any remaining references to deleted paths: `/polymarket-101`, `/concepts/`, `/getting-started/`, `/referrals`, `/reference/glossary`, `/reference/keyboard-shortcuts`, `/faq`, `/bridge`, `/settings`, `/wallet`, `/explore`, `/troubleshooting`, `/reference/markets-and-events`, `/reference/order-types`, `/reference/supported-assets`
  - Fix any found references using the link mapping from Design §6
  - _Requirements: 13.1, 13.2_

- [x] 10. Final checkpoint — build verification
  - Run `pnpm build` in `apps/docs/` to catch missing files, broken MDX imports, and meta.json mismatches
  - Run `pnpm check-types` to ensure no TypeScript issues in modified components (`doji-logo.tsx`)
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP (none in this plan — all tasks are core implementation)
- Each task references specific requirements or design sections for traceability
- Checkpoints at tasks 5 and 10 ensure incremental validation
- The `reference/` directory is retained for `fees.mdx`; only empty directories are deleted
- No property-based tests — this is a content/config restructure with no algorithmic logic
