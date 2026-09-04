# Requirements Document

## Introduction

Restructure the Doji documentation site (`apps/docs/`) from its current 30+ page layout to a minimal, feature-first layout with 15 pages across 4 sidebar sections. The new layout assumes readers already understand prediction markets and focuses on documenting what Doji's features do. This involves deleting pages, merging content, renaming pages, creating new pages, and updating the sidebar navigation in `meta.json`.

## Glossary

- **Docs_Site**: The Fumadocs-powered documentation application at `apps/docs/`, served at `docs.doji.bet` on port 3002.
- **Sidebar**: The left-hand navigation panel defined by `apps/docs/content/docs/meta.json`, using Fumadocs separator syntax (`---Section Name---`).
- **MDX_Page**: A single `.mdx` file in `apps/docs/content/docs/` that renders as a documentation page.
- **meta.json**: The file at `apps/docs/content/docs/meta.json` that defines sidebar navigation order, section separators, and page references.
- **Content_Migration**: The process of moving relevant content from a deleted or merged page into a surviving page.

## Requirements

### Requirement 1: Sidebar Section Structure

**User Story:** As a docs reader, I want the sidebar organized into four clear sections (Get Started, Trade, Monitor, Support), so that I can find features by what I'm trying to do.

#### Acceptance Criteria

1. THE Sidebar SHALL display exactly four section separators: "Get Started", "Trade", "Monitor", and "Support", in that order.
2. THE meta.json SHALL list exactly 15 page entries (excluding separators and the root index page).
3. THE Sidebar SHALL list pages under "Get Started": "Sign In & Wallet Setup", "Deposit & Withdraw".
4. THE Sidebar SHALL list pages under "Trade": "Explore & Search", "Trading Terminal", "Placing Orders", "Charts".
5. THE Sidebar SHALL list pages under "Monitor": "Portfolio", "Watchlist", "Address Tracker", "Calendar", "Activity Feed", "Leaderboard".
6. THE Sidebar SHALL list pages under "Support": "Fees", "Common Issues", "Support".

### Requirement 2: Page Deletions

**User Story:** As a docs maintainer, I want to remove pages that explain prediction market fundamentals or are no longer needed, so that the docs stay focused on Doji features.

#### Acceptance Criteria

1. WHEN the restructure is applied, THE Docs_Site SHALL no longer contain the "Polymarket 101" page (`polymarket-101.mdx`).
2. WHEN the restructure is applied, THE Docs_Site SHALL no longer contain the "Concepts" section pages (`concepts/index.mdx`, `concepts/order-lifecycle.mdx`, `concepts/neg-risk.mdx`).
3. WHEN the restructure is applied, THE Docs_Site SHALL no longer contain the multi-page "Getting Started" flow pages (`getting-started/index.mdx`, `getting-started/create-account.mdx`, `getting-started/onboarding.mdx`, `getting-started/first-trade.mdx`).
4. WHEN the restructure is applied, THE Docs_Site SHALL no longer contain the "Referrals" page (`referrals.mdx`).
5. WHEN the restructure is applied, THE Docs_Site SHALL no longer contain the "Keyboard Shortcuts" page (`reference/keyboard-shortcuts.mdx`).
6. WHEN the restructure is applied, THE Docs_Site SHALL no longer contain the "Glossary" page (`reference/glossary.mdx`).
7. WHEN the restructure is applied, THE Docs_Site SHALL no longer contain the "FAQ" page (`faq.mdx`).
8. WHEN the restructure is applied, THE Docs_Site SHALL no longer contain the standalone "Bridge" page (`bridge.mdx`).
9. WHEN the restructure is applied, THE Docs_Site SHALL no longer contain the "Settings" page (`settings.mdx`) as a standalone page.
10. WHEN the restructure is applied, THE Docs_Site SHALL no longer contain the "Wallet & Funds" index page (`wallet/index.mdx`) as a standalone page.
11. WHEN the restructure is applied, THE Docs_Site SHALL no longer contain the reference pages for "Markets & Events" (`reference/markets-and-events.mdx`), "Order Types" (`reference/order-types.mdx`), and "Supported Assets" (`reference/supported-assets.mdx`).

### Requirement 3: Sign In & Wallet Setup Page (Consolidated)

**User Story:** As a new user, I want a single page covering sign-in and wallet setup, so that I can get started without navigating multiple pages.

#### Acceptance Criteria

1. THE Docs_Site SHALL contain a "Sign In & Wallet Setup" MDX_Page as the first page under the "Get Started" section.
2. THE "Sign In & Wallet Setup" page SHALL include content covering sign-in methods (email, Google, external wallet) previously in `create-account.mdx`.
3. THE "Sign In & Wallet Setup" page SHALL include content covering wallet creation (Gnosis Safe on Polygon) previously in `onboarding.mdx`.
4. THE "Sign In & Wallet Setup" page SHALL include content covering session management and private key export previously in `wallet/index.mdx`.
5. THE "Sign In & Wallet Setup" page SHALL include content covering the "Fix approvals" flow previously in `wallet/index.mdx`.

### Requirement 4: Deposit & Withdraw Page (Consolidated)

**User Story:** As a trader, I want a single page for deposits and withdrawals, so that I can manage funds without navigating between Bridge and Wallet pages.

#### Acceptance Criteria

1. THE Docs_Site SHALL contain a "Deposit & Withdraw" MDX_Page as the second page under the "Get Started" section.
2. THE "Deposit & Withdraw" page SHALL include deposit instructions previously split across `bridge.mdx` and `wallet/index.mdx`.
3. THE "Deposit & Withdraw" page SHALL include withdrawal instructions previously split across `bridge.mdx` and `wallet/index.mdx`.
4. THE "Deposit & Withdraw" page SHALL include bridge troubleshooting content (deposit not arriving, withdrawal failed, minimums) previously in `wallet/index.mdx` and `troubleshooting.mdx`.

### Requirement 5: Explore & Search Page (Merged)

**User Story:** As a trader, I want one page covering market discovery and search, so that I understand all the ways to find markets.

#### Acceptance Criteria

1. THE Docs_Site SHALL contain an "Explore & Search" MDX_Page as the first page under the "Trade" section.
2. THE "Explore & Search" page SHALL include the Explore page content (tabs, categories, filters, views) previously in `explore.mdx`.
3. THE "Explore & Search" page SHALL include global search documentation (Ctrl+K shortcut, search dialog behavior) previously in `explore.mdx` and `reference/keyboard-shortcuts.mdx`.

### Requirement 6: Trading Terminal Page (Updated)

**User Story:** As a trader, I want the Trading Terminal page to also cover Settings, so that I know how to configure my trading experience without needing a separate page.

#### Acceptance Criteria

1. THE Docs_Site SHALL contain a "Trading Terminal" MDX_Page as the second page under the "Trade" section.
2. THE "Trading Terminal" page SHALL include the existing trading terminal content (navigation, layout overview) from `trading/index.mdx`.
3. THE "Trading Terminal" page SHALL include a Settings section covering Market Order Type, Orderbook Flash Effects, Notifications, and Display Toasts previously in `settings.mdx`.

### Requirement 7: Placing Orders and Charts Pages (Retained)

**User Story:** As a trader, I want dedicated pages for placing orders and reading charts, so that I can learn each topic in depth.

#### Acceptance Criteria

1. THE Docs_Site SHALL retain the "Placing Orders" MDX_Page as the third page under the "Trade" section.
2. THE Docs_Site SHALL retain the "Charts" MDX_Page as the fourth page under the "Trade" section.
3. WHEN the restructure is applied, THE "Placing Orders" page SHALL update internal links to reference the new page structure (no broken links to deleted pages).
4. WHEN the restructure is applied, THE "Charts" page SHALL update internal links to reference the new page structure (no broken links to deleted pages).

### Requirement 8: Monitor Section Pages (Retained/New)

**User Story:** As a trader, I want dedicated pages for Portfolio, Watchlist, Address Tracker, Calendar, Activity Feed, and Leaderboard, so that I can learn about each monitoring tool.

#### Acceptance Criteria

1. THE Docs_Site SHALL retain the "Portfolio" MDX_Page as the first page under the "Monitor" section.
2. THE Docs_Site SHALL retain the "Watchlist" MDX_Page as the second page under the "Monitor" section.
3. THE Docs_Site SHALL retain the "Address Tracker" MDX_Page as the third page under the "Monitor" section.
4. THE Docs_Site SHALL retain the "Calendar" MDX_Page as the fourth page under the "Monitor" section.
5. THE Docs_Site SHALL contain an "Activity Feed" MDX_Page as the fifth page under the "Monitor" section, documenting the bottom-bar Activity widget (live trade feed, dockable panel).
6. THE Docs_Site SHALL retain the "Leaderboard" MDX_Page as the sixth page under the "Monitor" section.
7. WHEN the restructure is applied, THE retained Monitor pages SHALL update internal links to reference the new page structure (no broken links to deleted pages).

### Requirement 9: Fees Page (Retained)

**User Story:** As a trader, I want a Fees page under Support, so that I understand trading costs.

#### Acceptance Criteria

1. THE Docs_Site SHALL retain the "Fees" MDX_Page as the first page under the "Support" section.
2. WHEN the restructure is applied, THE "Fees" page SHALL update internal links to reference the new page structure (no broken links to deleted pages).

### Requirement 10: Common Issues Page (Renamed + Merged)

**User Story:** As a user experiencing problems, I want a single "Common Issues" page that combines troubleshooting and FAQ content, so that I can find solutions in one place.

#### Acceptance Criteria

1. THE Docs_Site SHALL contain a "Common Issues" MDX_Page as the second page under the "Support" section.
2. THE "Common Issues" page SHALL include the error tables and troubleshooting content previously in `troubleshooting.mdx`.
3. THE "Common Issues" page SHALL include relevant FAQ entries previously in `faq.mdx` that are not already covered by the troubleshooting content (e.g., regional restrictions, non-custodial explanation, network info, gas fees, market resolution, redemption, selling positions, invite codes, account recovery).
4. THE "Common Issues" page SHALL remove references to deleted pages (Bridge, Referrals, Polymarket 101) and update links to the new page structure.

### Requirement 11: Support Page (New)

**User Story:** As a user needing help, I want a Support page with links to Discord, X/Twitter, and bug reporting info, so that I know how to reach the Doji team.

#### Acceptance Criteria

1. THE Docs_Site SHALL contain a "Support" MDX_Page as the third and final page under the "Support" section.
2. THE "Support" page SHALL include a Discord invite link for community support.
3. THE "Support" page SHALL include a link to the Doji X/Twitter account (`x.com/dojibet`).
4. THE "Support" page SHALL include instructions for reporting bugs.
5. THE "Support" page SHALL include guidance on how to reach the Doji team.

### Requirement 12: Root Index Page Update

**User Story:** As a docs reader landing on the homepage, I want the index page to reflect the new four-section layout, so that I can navigate to the right section immediately.

#### Acceptance Criteria

1. WHEN the restructure is applied, THE root index page (`index.mdx`) SHALL update its card links and quick links to reference only pages that exist in the new layout.
2. THE root index page SHALL remove links to deleted pages (Polymarket 101, Glossary, Wallet & Funds).
3. THE root index page SHALL organize navigation cards to match the four new sections (Get Started, Trade, Monitor, Support).

### Requirement 13: No Broken Internal Links

**User Story:** As a docs reader, I want all internal links to work after the restructure, so that I never hit a 404 page.

#### Acceptance Criteria

1. WHEN the restructure is applied, THE Docs_Site SHALL contain zero internal links pointing to deleted page paths (`/docs/polymarket-101`, `/docs/concepts/*`, `/docs/getting-started/*`, `/docs/referrals`, `/docs/reference/glossary`, `/docs/reference/keyboard-shortcuts`, `/docs/faq`, `/docs/bridge`, `/docs/settings`, `/docs/wallet`).
2. WHEN a surviving page references content that was on a deleted page, THE surviving page SHALL either inline the relevant information or link to the new page where that content now lives.

### Requirement 14: meta.json Structure

**User Story:** As a docs maintainer, I want the meta.json to cleanly define the new 4-section, 15-page layout, so that the sidebar renders correctly.

#### Acceptance Criteria

1. THE meta.json SHALL use Fumadocs separator syntax (`---Section Name---`) for the four sections.
2. THE meta.json SHALL list page paths that correspond to actual MDX files in `apps/docs/content/docs/`.
3. THE meta.json SHALL not reference any deleted page paths.
4. THE meta.json SHALL preserve the root `index` page entry before the first section separator.

### Requirement 15: Reference Section Removal

**User Story:** As a docs maintainer, I want the Reference section fully removed, so that the sidebar only shows the four new sections.

#### Acceptance Criteria

1. WHEN the restructure is applied, THE meta.json SHALL not contain a "Reference" section separator.
2. WHEN the restructure is applied, THE Docs_Site SHALL relocate the "Fees" page from `reference/fees.mdx` to a top-level path or retain it at its current path while updating meta.json to list it under the "Support" section.
