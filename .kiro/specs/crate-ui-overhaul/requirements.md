# Requirements Document

## Introduction

This feature is a complete visual and naming overhaul of the Robinhood Chain Basket Terminal into a product called **Crate**. The scope covers tearing down all existing CSS design tokens, color systems, typography, component styling, and layout logic and rebuilding them from scratch with a new editorial aesthetic: true-black backgrounds, massive ultra-bold grotesque headings, minimal negative space, thin 1px borders, and a warm amber/orange brand accent called **Crate Orange**. In parallel, every instance of the words "basket" and "baskets" in UI text, routes, metadata, and copy is renamed to "crate" and "crates." All business logic, server code, and functional hooks are left unchanged.

---

## Glossary

- **Crate**: The renamed product (formerly "Basket"). A curated on-chain basket of tokens tradeable as a single unit on Robinhood Chain.
- **Crate_Terminal**: The per-crate trading page at `/crates/[crateId]`.
- **Crate_Catalog**: The grid of all available crates, shown on Home and the Crates directory.
- **Crate_Orange**: The brand accent color, `#FF6B35`, used for active nav states, primary CTAs, ticker labels, and highlights.
- **Design_Token**: A CSS custom property defined in `apps/web/src/index.css` that maps a semantic name to a concrete color, size, or radius value.
- **Shell**: The persistent app chrome: `site-header.tsx`, `header-nav.tsx`, `header-actions.tsx`, `bottom-bar.tsx`, and `providers.tsx` under `apps/web/src/shell/`.
- **Overhaul**: The full replacement of all visual styling while preserving functional logic.
- **Inter**: The variable font already installed in the project, used across all weights (400, 500, 700, 800, 900).
- **Route_Migration**: The rename of URL paths from `/baskets/…` to `/crates/…` and the corresponding file moves.
- **Copy_Migration**: Replacing every user-visible string "basket"/"baskets" (case-insensitive) with "crate"/"crates" across component JSX, metadata, headings, labels, and button text.

---

## Requirements

---

### Requirement 1: Design Token System Overhaul

**User Story:** As a designer, I want the entire color and spacing system replaced with Crate's new black-and-orange palette so that every component inherits the new aesthetic automatically.

#### Acceptance Criteria

1. WHERE `apps/web/src/index.css` is evaluated, THE Design_Token system SHALL have replaced all CSS custom properties previously defined under the `.doji` scope and `:root` with the Crate palette properties defined in criteria 2–12 of this requirement.

2. THE Design_Token system SHALL define the following background tokens in `apps/web/src/index.css`:
   - `--bg-base`: `#0a0a0a`
   - `--bg-surface`: `#111111`
   - `--bg-surface-raised`: `#1a1a1a`

3. THE Design_Token system SHALL define the following border tokens:
   - `--border-subtle`: `rgba(255,255,255,0.06)`
   - `--border-default`: `rgba(255,255,255,0.10)`
   - `--border-strong`: `rgba(255,255,255,0.18)`

4. THE Design_Token system SHALL define the following text tokens:
   - `--text-primary`: `#F0F0F0`
   - `--text-secondary`: `rgba(255,255,255,0.50)`
   - `--text-tertiary`: `rgba(255,255,255,0.30)`

5. THE Design_Token system SHALL define the following brand tokens:
   - `--crate-orange`: `#FF6B35`
   - `--crate-orange-hover`: `color-mix(in oklch, #FF6B35 85%, black)`
   - `--crate-orange-08`: `color-mix(in oklch, #FF6B35 8%, transparent)`

6. THE Design_Token system SHALL define the following semantic status tokens:
   - `--color-positive`: `#22c55e`
   - `--color-negative`: `#ef4444`

7. THE Design_Token system SHALL alias the following Tailwind semantic tokens to Crate palette values:
   - `--background` → `var(--bg-base)` (`#0a0a0a`)
   - `--foreground` → `var(--text-primary)` (`#F0F0F0`)
   - `--primary` → `var(--crate-orange)` (`#FF6B35`)
   - `--primary-foreground` → `#0a0a0a`
   - `--card` → `var(--bg-surface)` (`#111111`)
   - `--card-foreground` → `var(--text-primary)` (`#F0F0F0`)
   - `--border` → `var(--border-default)` (`rgba(255,255,255,0.10)`)
   - `--muted-foreground` → `var(--text-secondary)` (`rgba(255,255,255,0.50)`)
   - `--destructive` → `var(--color-negative)` (`#ef4444`)

8. THE Design_Token system SHALL define a typography scale using Inter:
   - Display hero: `font-size: clamp(72px, 10vw, 160px)`, `font-weight: 900`, `letter-spacing: -0.03em`
   - Section heading: `font-size: clamp(36px, 5vw, 72px)`, `font-weight: 800`, `letter-spacing: -0.02em`
   - Card title / nav item: `font-size: 16px`, `font-weight: 500`
   - Body: `font-size: 14px`, `font-weight: 400`
   - Caption / label: `font-size: 12px`, `font-weight: 400`, `color: var(--text-secondary)`
   - The existing 6-class Tailwind scale (`text-3xl`, `text-2xl`, `text-lg`, `text-sm`, `text-xs`, `text-[10px]`) SHALL remain available for component-level sizing.

9. THE Design_Token system SHALL set `--radius: 0px` in `apps/web/src/index.css`.

10. WHEN the page background is rendered, THE body element SHALL have `background-color: var(--bg-base)` and `color: var(--text-primary)` applied via global CSS.

11. WHERE `apps/web/src/index.css` is evaluated, THE file SHALL contain no occurrences of `--doji-green` or any `--doji-green-*` custom property declarations.

12. THE Design_Token system SHALL preserve the following functional tokens remapped to Crate palette values:
    - `--color-buy` → `var(--crate-orange)`
    - `--color-sell` → `var(--color-negative)` (`#ef4444`)
    - `--color-profit` → `var(--color-positive)` (`#22c55e`)
    - `--color-loss` → `var(--color-negative)` (`#ef4444`)
    - `--color-positive` → `#22c55e`
    - `--color-negative` → `#ef4444`

---

### Requirement 2: Shell and Navigation Redesign

**User Story:** As a user, I want the app header and navigation to reflect the Crate brand so that I immediately recognize the product and can navigate clearly.

#### Acceptance Criteria

1. THE Shell SHALL display a horizontal top bar with `background: var(--bg-base)`, a single `1px` bottom border using `var(--border-default)`, and no box-shadow.

2. THE Shell header SHALL show a "Crate" logotype on the left side, using `color: var(--text-primary)` at `16px` medium weight (`font-weight: 500`), preceded by an icon no larger than `20×20px`.

3. THE Shell header SHALL show navigation links left-adjacent to the logo with a minimum `16px` gap between the logo group and the first link, with link text in `14px` regular weight (`font-weight: 400`) and `color: var(--text-secondary)` when inactive.

4. WHEN a nav link corresponds to the current route, THE Shell navigation SHALL apply `color: var(--crate-orange)` to that link and render a `1px` solid underline in `var(--crate-orange)` positioned `2px` below the link text baseline.

5. THE Shell navigation SHALL include exactly the following links in order: "Home" (`/`), "Crates" (`/crates`), with no additional navigation items.

6. WHEN the wallet is disconnected, THE Shell header right side SHALL display a button labelled "Connect Wallet" with `1px` border `var(--border-strong)`, transparent background, `14px` regular weight text, and height `32px`.

7. WHEN the wallet is connected, THE Shell header right side SHALL display a pill element showing the connected address truncated to the first 6 and last 4 characters separated by `"..."`, followed by the ETH balance rounded to 4 decimal places, at height `32px`.

8. THE Shell bottom bar SHALL contain only the bug-report widget and a status link, with all dock controls, market widgets, and watchlist bar absent.

9. WHEN the viewport width is less than `768px`, THE Shell navigation links SHALL be hidden from the top bar and accessible via a toggle control that reveals them in a full-width drawer below the header.

10. THE Shell header height SHALL be `48px` when viewport width is ≥ `768px` and `44px` when viewport width is < `768px`.

---

### Requirement 3: Home Page Redesign

**User Story:** As a visitor, I want the home page to immediately communicate the Crate product identity with a bold editorial layout so that I understand what Crate is and can enter the app.

#### Acceptance Criteria

1. THE Home_Page SHALL render a full-width hero section with a display heading containing the text "Trade in Crates." at `font-size: clamp(72px, 10vw, 160px)`, `font-weight: 900`, `letter-spacing: -0.03em`, `color: var(--text-primary)`.

2. THE Home_Page hero heading SHALL be left-aligned (`text-align: left`).

3. THE Home_Page SHALL render a subheadline paragraph with `max-width` between `280px` and `320px`, right-aligned or right-side positioned, containing at least one complete sentence describing Crate's purpose, at `font-size: 14px`, `font-weight: 400`, `color: var(--text-secondary)`.

4. THE Home_Page SHALL render a CTA button with text "Enter app →", transparent background, `1px` border `var(--border-strong)`, `color: var(--text-primary)`.

5. WHILE the user hovers the CTA button, THE CTA button SHALL transition `border-color` to `var(--crate-orange)` and `color` to `var(--crate-orange)` over `200ms ease`.

6. WHEN the user clicks the CTA button, THE Home_Page SHALL navigate to `/crates`; IF navigation fails, THE Home_Page SHALL display an error message in `var(--color-negative)`.

7. THE Home_Page SHALL render the Crate_Catalog grid below the hero section with card styling from Requirement 6.

8. THE Home_Page SHALL not contain any user-visible occurrences of the strings "basket" or "baskets" (case-insensitive).

9. THE Home_Page `<title>` element SHALL contain exactly the text "Crate — Trade in Crates".

10. THE Home_Page `og:title` meta tag `content` attribute SHALL contain exactly the text "Crate — Trade in Crates".

---

### Requirement 4: Crates Directory Page Redesign

**User Story:** As a user, I want the crates directory to have a clear editorial heading and a well-organized grid of crate cards so that I can browse all available crates.

#### Acceptance Criteria

1. THE Crates_Directory page at `/crates` SHALL render a full-width section heading "All crates." at Section heading typography (font-weight 800, `clamp` large size, left-aligned, `color: var(--text-primary)`).

2. THE Crates_Directory page SHALL render a right-aligned timestamp in the format "Updated {N} {unit} ago" where {N} is a positive integer and {unit} is one of "second", "seconds", "minute", "minutes", "hour", "hours", "day", or "days", at `font-size: 12px`, `color: var(--text-tertiary)`, updated at most once per 60 seconds.

3. THE Crates_Directory page SHALL render the Crate_Catalog grid using the updated card styling from Requirement 6.

4. THE Crates_Directory page SHALL not contain any references to "basket" or "baskets" in visible text, page title, meta tags, or accessible labels (aria-label, alt text).

5. THE Crates_Directory page `<title>` SHALL contain exactly "All Crates — Crate".

6. WHEN the Crates_Directory page data is loading, THE page SHALL display skeleton cards in the grid layout where each skeleton card matches the pixel height and column width of a loaded card, with between 1 and 12 skeleton cards shown simultaneously.

7. IF the fetched crates array is empty, THEN THE Crates_Directory page SHALL render the empty state component from Requirement 10 in place of the grid, with no skeleton cards visible.

8. IF the crates data fetch fails, THEN THE Crates_Directory page SHALL display an error message indicating crates could not be loaded and provide a retry action, with no skeleton cards or empty state visible.

---

### Requirement 5: Crate Terminal Page Redesign

**User Story:** As a trader, I want the crate terminal page to use the new Crate visual language so that the trading experience feels cohesive with the rest of the product.

#### Acceptance Criteria

1. THE Crate_Terminal page at `/crates/[crateId]` SHALL render a large left-aligned heading within the primary column displaying the crate name at `font-weight: 800`, `color: var(--text-primary)`, using Section heading typography sizing.

2. WHEN the viewport width is ≥ `1024px`, THE Crate_Terminal page SHALL display a two-column layout: a primary column (chart + constituent list) occupying 65% of the remaining viewport width after the sidebar is allocated, and a sidebar column (order panel) with fixed width `320px`.

3. WHEN the viewport width drops below `1024px`, THE Crate_Terminal page layout SHALL collapse to a single column with the chart + constituent list section above the order panel section.

4. THE Crate_Terminal page `<title>` SHALL read "{crate name} — Crate" and the `og:title` meta tag SHALL read "{crate name} — Crate", where `{crate name}` is the resolved crate's display name.

5. THE Crate_Terminal page SHALL not contain any user-visible occurrences of the strings "basket" or "baskets" (case-insensitive) in text, labels, button copy, or accessible attributes.

6. THE Crate_Terminal page SHALL render the `WrongNetworkBanner` as the first child element within the sidebar column, with its "Switch Network" button using `var(--crate-orange)` as the action color.

7. WHEN the `crateId` URL parameter does not match any entry in `BASKETS` (the crate config array), THE Crate_Terminal page SHALL call `notFound()` and render the 404 page with the text "Crate not found." and a link with text "Back to Crates" pointing to `/crates`.

8. IF the crate data fetch fails at runtime, THEN THE Crate_Terminal page SHALL render an error state within the primary column with a message describing the failure and a "Retry" affordance.

---

### Requirement 6: Component Design System — Cards, Buttons, Inputs, Badges

**User Story:** As a developer, I want every UI component to use the Crate design token system consistently so that the visual language is uniform across all pages.

#### Acceptance Criteria

1. THE Crate_Card component SHALL render with `background: var(--bg-surface)`, `border: 1px solid var(--border-default)`, `border-radius: 0px`, no `box-shadow`, and `padding: 20px`.

2. THE Crate_Card component SHALL display the crate name in `font-size: 16px`, `font-weight: 500`, `color: var(--text-primary)`.

3. THE Crate_Card component SHALL display the crate ticker/ID in `color: var(--crate-orange)` at `font-size: 14px`.

4. THE Crate_Card component SHALL display each constituent token address in `color: var(--text-secondary)` at `font-size: 12px`, truncated to the format `0x[first 4 hex chars]…[last 4 hex chars]`.

5. THE Crate_Card component SHALL display a "View on explorer ↗" link at the bottom in `font-size: 12px`, `color: var(--text-secondary)`, opening the Robinhood Chain block explorer in a new tab with `rel="noopener noreferrer"`. IF the token address is null or undefined, THE Crate_Card SHALL omit the explorer link for that token.

6. WHILE the user hovers a Crate_Card, THE Crate_Card `background` SHALL transition to `var(--bg-surface-raised)` over `150ms ease`.

7. THE Button component's `default` variant SHALL render with `background: var(--crate-orange)`, `color: #0a0a0a`, `font-weight: 500`, `border-radius: 0px`.

8. THE Button component's `outline` variant SHALL render with transparent background, `border: 1px solid var(--border-strong)`, `color: var(--text-primary)`, `border-radius: 0px`. WHILE hovered, `border-color` and `color` SHALL transition to `var(--crate-orange)` over `150ms ease`.

9. THE Button component's `ghost` variant SHALL render with no border and no background, `border-radius: 0px`. WHILE hovered, `background` SHALL transition to `var(--bg-surface-raised)` over `150ms ease`.

10. WHERE an Input component is rendered, THE Input SHALL have `background: var(--bg-surface)`, `border: 1px solid var(--border-default)`, `border-radius: 0px`, `color: var(--text-primary)`, `placeholder-color: var(--text-tertiary)`.

11. WHEN an Input component receives focus, THE Input `border-color` SHALL become `var(--border-strong)` with no outer glow or ring.

12. THE constituent list item component SHALL render each token row displaying: token name, token symbol, current price, 24h change percentage, and basket weight, with values in `color: var(--text-primary)` and labels in `color: var(--text-secondary)`.

13. WHEN a constituent token's 24h price change is positive (> 0), THE constituent list item SHALL display it in `color: var(--color-positive)`.

14. WHEN a constituent token's 24h price change is negative (< 0), THE constituent list item SHALL display it in `color: var(--color-negative)`.

15. THE TxStatusBadge component SHALL use `var(--crate-orange)` as its accent color for `building`, `confirming`, and `pending` states.

16. THE WrongNetworkBanner "Switch Network" button SHALL use `var(--crate-orange)` as its action/foreground color.

17. THE allocation preview table SHALL display each token symbol in `color: var(--crate-orange)` in the symbol column.

18. THE timeframe selector chip for the active timeframe SHALL have `background: var(--crate-orange)`, `color: #0a0a0a`; inactive chips SHALL have `background: transparent`, `border: 1px solid var(--border-default)`, `color: var(--text-secondary)`.

19. THE token toggle chip for an active token SHALL have `background: var(--crate-orange)`, `color: #0a0a0a`; inactive token chips SHALL have `background: var(--bg-surface)`, `border: 1px solid var(--border-default)`, `color: var(--text-secondary)`.

---

### Requirement 7: Copy and Naming Migration (basket → crate)

**User Story:** As a product manager, I want every visible reference to "basket" and "baskets" replaced with "crate" and "crates" throughout the UI so that the product is consistently branded as Crate.

#### Acceptance Criteria

1. THE Copy_Migration SHALL replace all user-visible occurrences of the word "basket" (case-insensitive) with "crate" across all JSX string literals, heading text, button labels, placeholder text, aria-labels, and page metadata in `apps/web/src/`.

2. THE Copy_Migration SHALL replace all user-visible occurrences of the word "baskets" (case-insensitive) with "crates" across the same files.

3. THE Shell navigation link text "Baskets" SHALL become "Crates".

4. THE home page hero text SHALL read "Trade in Crates." (not "Trade in Baskets.").

5. THE order panel heading and tab labels SHALL use "crate" terminology (e.g. "Buy Crate", "Exit Crate").

6. THE exit panel button text SHALL read "Exit to ETH" (no "basket" reference).

7. THE buy panel confirmation/CTA button SHALL read "Buy Crate" (or "Buy [crate name]" if dynamically generated).

8. THE page `<title>` tags and `og:title` metadata SHALL use "crate"/"crates" vocabulary throughout.

9. THE Copy_Migration SHALL NOT rename internal TypeScript variable names, function names, type names, or import paths that are not user-visible (these are separate from UI copy).

10. WHEN a component currently shows "Select basket" as placeholder or heading copy, THE Copy_Migration SHALL change it to "Select crate".

11. WHEN replacing "basket"/"baskets" in pluralised compound phrases (e.g. "Your baskets", "Active baskets"), THE Copy_Migration SHALL replace only the target token while leaving surrounding words unchanged.

12. IF occurrences of "basket" or "baskets" are found outside `apps/web/src/` (e.g. in `apps/docs/` or shared packages), THEN THE Copy_Migration SHALL not modify those files unless they are directly user-visible in the `apps/web` deployment.

---

### Requirement 8: Route Migration (/baskets → /crates)

**User Story:** As a user, I want the URL paths to say "/crates" instead of "/baskets" so that the URLs reflect the Crate brand.

#### Acceptance Criteria

1. THE Route_Migration SHALL move `apps/web/src/app/(app)/baskets/page.tsx` to `apps/web/src/app/(app)/crates/page.tsx`.

2. THE Route_Migration SHALL move `apps/web/src/app/(app)/baskets/[basketId]/page.tsx` to `apps/web/src/app/(app)/crates/[crateId]/page.tsx`, renaming the dynamic segment directory from `[basketId]` to `[crateId]`.

3. WHEN an HTTP request arrives for the path `/baskets`, THE server SHALL return a `301` redirect response to `/crates`.

4. WHEN an HTTP request arrives for a path matching `/baskets/{id}` where `{id}` is any segment, THE server SHALL return a `301` redirect response to `/crates/{id}`.

5. THE Route_Migration SHALL update all `<Link href>` values and URL string literals in `apps/web/src/` pointing to `/baskets` to point to `/crates`.

6. THE Route_Migration SHALL update all `<Link href>` values and URL string literals in `apps/web/src/` pointing to `/baskets/{basketId}` to point to `/crates/{crateId}`.

7. THE header nav active-link detection SHALL use `/crates` and `/crates/[crateId]` as the path prefixes for active state calculation.

8. WHEN the `pathname.startsWith` check in `apps/web/src/shell/app-shell-router.tsx` is evaluated, it SHALL reference `/crates/` (not `/baskets/`).

9. THE `generateStaticParams` function in the terminal page SHALL return objects in the shape `{ crateId: b.id }` for each entry in `BASKETS`.

---

### Requirement 9: Responsive Design Behavior

**User Story:** As a mobile user, I want all Crate pages to be usable on small screens so that I can browse and trade from my phone.

#### Acceptance Criteria

1. THE Crate_Catalog grid SHALL use 1 column on viewports < `640px`, 2 columns between `640px` and `1023px`, and 3 or more columns on viewports ≥ `1024px`.

2. WHEN the viewport width drops below `1024px`, THE Crate_Terminal page layout SHALL collapse to a single-column stacked layout.

3. WHEN the Crate_Terminal layout is stacked, THE chart + constituent list section SHALL appear above the order panel section.

4. THE Shell header navigation links SHALL be hidden on viewports < `768px`; the wallet control SHALL remain visible at all viewport widths; a menu toggle SHALL be present on viewports < `768px` to reveal navigation.

5. THE hero display heading on the Home page and Crates directory SHALL use `font-size: clamp(72px, 10vw, 160px)` so it scales within the `320px`–`1280px` viewport range without horizontal overflow.

6. WHEN the viewport width is < `768px`, ALL interactive elements (buttons, chips, toggle buttons) SHALL have a minimum touch target area of `44px × 44px`; the visual element MAY be smaller if the interactive hit area (including padding) meets the minimum.

7. WHEN the viewport width is < `640px`, THE quick-buy preset buttons SHALL display in a single-row horizontally scrollable strip with no wrapping, and individual button widths SHALL not change.

8. WHEN the viewport width is < `640px`, THE constituent list SHALL display token addresses truncated to the format `0x[first 4 hex chars]…[last 4 hex chars]`.

---

### Requirement 10: Empty States and Loading States

**User Story:** As a user, I want clear visual feedback when content is loading or unavailable so that I am never confused about the app state.

#### Acceptance Criteria

1. WHEN the Crate_Catalog is loading, THE Crate_Catalog grid SHALL render skeleton cards using `background: var(--bg-surface)` and a left-to-right shimmer animation cycling between 1000ms and 2000ms, matching the full column width and height within ±10% of loaded cards.

2. WHEN no crates are available, THE Crate_Catalog grid SHALL render exactly one centered icon, a heading "No crates yet.", subtext "Check back soon.", and exactly one outline-variant CTA button; no skeleton cards SHALL be rendered simultaneously.

3. WHEN live price data is unavailable for a constituent token, THE constituent list item SHALL render the price cell and 24h change cell each displaying exactly the em dash character "—" in `color: var(--text-tertiary)`.

4. WHEN live price data is unavailable for a constituent token, THE allocation preview row for that token SHALL display "—" in both the token amount cell and USD amount cell.

5. WHEN the order transaction is in `building` or `confirming` state, THE order panel execute button SHALL display a loading spinner in place of label text and SHALL have the `disabled` attribute set.

6. WHEN the order transaction is in `pending` state, THE TxStatusBadge SHALL display a pulsing indicator (cycle duration 500ms–1500ms) and the transaction hash as `0x[6chars]…[4chars]` linking to the Robinhood Chain block explorer.

7. WHEN the order transaction reaches `confirmed` state, THE TxStatusBadge SHALL display a checkmark icon and a "View transaction" link opening the block explorer transaction page in a new tab with `rel="noopener"`.

8. WHEN the order transaction reaches `error` state, THE TxStatusBadge SHALL display an error message in `color: var(--color-negative)` and a "Try again" affordance that re-initiates the flow from `building` state.

9. WHEN the composite index chart data is loading, THE BasketChart component SHALL render a skeleton placeholder matching the chart container's exact rendered dimensions, with no chart content visible.

10. WHEN the composite index chart cannot produce a valid series (all token data failed), THE BasketChart SHALL render "Chart data unavailable." centered in the chart container with no axes or partial data.

11. IF the Crate_Catalog loading state persists beyond 30 seconds without a successful response, THEN THE Crate_Catalog SHALL replace skeleton cards with an error state and a "Retry" affordance.

---

### Requirement 11: Chart and Data Visualization Styling

**User Story:** As a trader, I want the charts to use the Crate color system so that the visual language is consistent throughout the trading terminal.

#### Acceptance Criteria

1. THE composite index chart area fill SHALL use a gradient from `var(--crate-orange)` at 40% opacity at the top to `var(--crate-orange)` at 0% opacity at the bottom.

2. THE composite index chart line SHALL use `var(--crate-orange)` at 100% opacity with stroke width between 1px and 2px inclusive.

3. THE `.sonar-ring` CSS class SHALL use `var(--crate-orange)` for `border-color`, with animation pulse cycle duration between 1500ms and 2500ms.

4. THE KLineChart candlestick chart SHALL use `var(--color-positive)` for bullish candle fill/stroke (close > open) and `var(--color-negative)` for bearish candle fill/stroke (close ≤ open).

5. THE orderbook depth-bar background SHALL use `var(--crate-orange)` at 28% opacity for bid rows and `var(--color-negative)` at 28% opacity for ask rows.

6. THE composite index chart Y-axis SHALL be anchored at baseline value 100, with axis labels in `color: var(--text-secondary)` at `font-size: 12px`, updating within 100ms of new data.

---

### Requirement 12: Accessibility

**User Story:** As a user with assistive technology, I want the Crate UI to be navigable and understandable so that I can use the product regardless of ability.

#### Acceptance Criteria

1. THE Shell navigation SHALL use a `<nav>` element with `aria-label="Main navigation"`.

2. THE active nav link SHALL have `aria-current="page"` applied.

3. ALL icon-only interactive controls SHALL have an `aria-label` attribute between 1–80 characters describing the action.

4. THE wallet connect button SHALL have `aria-label="Connect wallet"` when disconnected, and `aria-label="Wallet connected: {first 6 chars}...{last 4 chars}"` when connected.

5. THE buy/exit execute buttons SHALL have `aria-disabled="true"` and `tabIndex={0}` when the wallet is not connected or the network chain ID does not equal `4663`.

6. THE color contrast ratio between `var(--text-primary)` (`#F0F0F0`) and `var(--bg-base)` (`#0a0a0a`) SHALL meet WCAG AA: minimum 4.5:1 for body text and 3:1 for text ≥ 18px normal weight or ≥ 14px medium weight.

7. THE color contrast ratio between `var(--text-secondary)` and `var(--bg-base)` SHALL meet WCAG AA for large text: minimum 3:1 for text ≥ 18px normal weight or ≥ 14px medium weight.

8. ALL decorative images and SVG icons SHALL have `aria-hidden="true"` and, where an `alt` attribute is applicable, `alt=""`.

9. THE TxStatusBadge SHALL use `aria-live="polite"` on its container element, present in the DOM at all times even when empty.

10. WHEN keyboard focus moves to any interactive control, THE system SHALL display a visible focus indicator with minimum contrast ratio 3:1 between focused and unfocused states.

11. WHEN a form input receives focus without a visible label, THE system SHALL expose `aria-label` or `aria-labelledby` of 1–80 characters describing the input's purpose.

---

### Requirement 13: Scrollbar and Global CSS Utilities

**User Story:** As a developer, I want the global CSS utilities to be updated to the Crate token system so that scrollbars, selection styles, and utility classes are consistent.

#### Acceptance Criteria

1. THE `::selection` pseudo-element SHALL have `background-color: var(--bg-surface-raised)` and `color: var(--text-primary)`.

2. THE `.scrollbar-subtle` utility class SHALL set `scrollbar-color: var(--bg-surface-raised) transparent` (default) and on thumb hover `background: var(--border-default)`.

3. THE skeleton shimmer `[data-slot="skeleton"]::after` gradient SHALL use `var(--text-primary)` at opacity `0.08` as the shimmer band color, with animation direction left-to-right and duration between 1000ms and 2000ms.

4. THE `--font-size-order-amount` CSS custom property SHALL be defined in `apps/web/src/index.css` at its current value and SHALL NOT be modified, removed, or renamed.

5. WHEN the Crate design system is applied, the `@layer utilities .border { border-width: 1.75px }` override and all equivalent `.border-x`, `.border-y`, `.border-t`, `.border-r`, `.border-b`, `.border-l` `1.75px` overrides SHALL be absent from `apps/web/src/index.css`.

6. THE `.order-toast-processing::after` shimmer animation SHALL use `var(--crate-orange)` as the shimmer band color from any prior value; the `.order-toast-complete` scale animation SHALL remain functionally unchanged.

---

### Requirement 14: Product Identity and Branding

**User Story:** As a stakeholder, I want the product to be consistently named and branded as "Crate" across all touchpoints so that the rebrand is complete and coherent.

#### Acceptance Criteria

1. THE root layout metadata SHALL have a default `<title>` value of "Crate".

2. THE root layout metadata SHALL include `og:site_name` with value "Crate".

3. THE favicon and app icon SHALL use `var(--crate-orange)` (`#FF6B35`) as the primary color. The icon shape MAY be updated to a crate/box form.

4. THE 404 page SHALL display the text "Crate" as the product name and SHALL contain an anchor element with text "Back to home" pointing to `/`.

5. WHEN a bug-report is submitted via the bug-report widget, THE submission payload SHALL include a field named `app` with value `"Crate"`.

6. IF the bug-report submission fails, THE bug-report widget SHALL display an error message informing the user the submission was unsuccessful.

7. THE root layout `og:description` meta tag content SHALL describe Crate as an on-chain basket trading product on Robinhood Chain, with text no longer than 160 characters.
