# Design System State & Rework Readiness

> Captures current design system usage, recent organizational fixes, and what to know for future UI rework. Does not change how the site looks.

**Last updated:** March 2026

---

## 0. YOLO Design System Pass (March 2026)

Consolidation pass based on Stand reference UI and existing audit findings:

- **Button variants:** `positive` and `negative` (plus `positiveOutline`, `negativeOutline`) in `button.tsx` — used by order form submit, trading toggles
- **Tab indicators:** `bg-[#90E65B]` → `bg-primary` in market-tabs, tabs.tsx, sliding-tabs.tsx
- **UMA badge:** `bg-[#FF4A4A]/20` → `bg-destructive/20`, `text-[#FF4A4A]` → `text-destructive` in resolution-tab
- **Typography:** `text-[9px]` → `text-[10px]` in market-tabs, portfolio-page (min size per scale)
- **Sonner:** `hover:opacity-90` → `hover:bg-secondary/80` on cancel, `hover:bg-primary/80` on action
- **Resolution tab:** `font-semibold`/`font-bold` → `font-medium`, `text-base` → `text-sm` per typography scale

Revert via git if needed.

---

## 1. Recent Organizational Fixes (No Visual Change)

### Token Consolidation — `hover:bg-[#1E1E1E]` → `hover:bg-market-list-hover`

List/row hover states were hardcoded across ~25 files. All have been replaced with the design token `hover:bg-market-list-hover` (and `focus:bg-market-list-hover`, `data-[highlighted]:bg-market-list-hover` where applicable).

**Benefits:**
- Single source of truth: `--color-market-list-hover` in `apps/web/src/index.css`
- Future theme tweaks in one place
- Consistent naming across components

**Files updated:**
- Layout: search-results, watchlist-bar, global-search, header-search, notifications-bell
- Portfolio: activity-history, trade-history, orders-table, position-table, closed-positions
- Market: positions-tab, orders-tab, trades-tab, history-tab, holders-tab, market-header-trading, market-select-dropdown
- Explore: events-table, event-table-cells
- Leaderboard: leaderboard-data-table, trader-columns
- Auth: user-menu
- Wallet tracker: wallet-tracker-content
- Watchlist: watchlist-widget-content
- Referrals: referrals-page
- UI: select.tsx
- Search: search-bar.tsx, global-search.tsx, header-search.tsx (inline `style` → `var(--color-market-list-hover)`)

### March 2026 Design-System YOLO Pass

Design consistency fixes based on audit + Stand reference:

- **Button:** `positive` and `negative` variants added; order-form submit uses `variant={submitVariant}` (positive/negative).
- **Typography:** `font-semibold`/`font-bold` → `font-medium` in resolution-tab; `text-[9px]` → `text-[10px]` in market-tabs, portfolio-page.
- **Colors:** `bg-[#90E65B]` → `bg-primary` in tabs, sliding-tabs, market-tabs; `bg-[#FF4A4A]/20` → `bg-destructive/20` in resolution-tab; `text-[#FF4A4A]` → `text-destructive` for UMA badge.
- **Sonner:** `hover:opacity-90` → `hover:bg-secondary/80` on cancel; `actionButton` uses `hover:bg-primary/80`.

---

## 2. Design Tokens (Reference)

| Token | Value | Use |
|-------|-------|-----|
| `--color-market-list-hover` | #1e1e1e | Row hover, list item hover, dropdown highlight |
| `--doji-green` | #90e65b | Brand accent, nav active, primary CTA |
| `--text-primary` | #F5F5F5 (dark) | Primary text |
| `--text-secondary`, `--text-tertiary`, `--text-muted` | Hierarchy for secondary text |
| `--color-positive` / `--color-negative` | Buy/Sell, profit/loss |

**Tailwind usage:** `bg-market-list-hover`, `text-text-primary`, `text-primary` (Doji green), etc.

---

## 3. March 2026 YOLO Design System Pass

Applied fixes for cohesion, typography, and color token usage:

- **Button:** `positive`, `negative`, `positiveOutline`, `negativeOutline` variants added; order-form submit uses `variant="positive"|"negative"`.
- **Hover standardization:** `hover:opacity-90` → `hover:bg-primary/80` or `hover:bg-secondary/80` where appropriate (sonner cancel).
- **Hardcoded colors → tokens:** `bg-[#90E65B]` → `bg-primary` (market-tabs, tabs.tsx, sliding-tabs); `bg-[#FF4A4A]/20` → `bg-destructive/20` (resolution-tab UMA badge); `text-[#FF4A4A]` → `text-destructive`.
- **Typography:** `font-semibold`/`font-bold` → `font-medium` (resolution-tab); `text-[9px]` → `text-[10px]` (market-tabs, portfolio-page badges).

---

## 4. Known Hardcoded Values (Left As-Is)

These remain hardcoded for specific reasons; changing them could affect appearance or require design decisions:

| Location | Value | Reason |
|----------|-------|--------|
| order-form-ui.tsx | `text-[#1E1E1E]` on buy button | Dark text on green; index.css overrides handle |
| order-form-ui.tsx | `bg-[#F5F5F5]` on selector pills | Light-mode active state |
| gradient-avatar.tsx | `GREYS` array incl. #1E1E1E | Gradient color palette; different purpose |
| header-nav, main-nav | `text-[#90E65B]` | Active nav; could use `text-primary` |
| sonner.tsx | `#90E65B`, `#FFA500`, `#FF4444` | Toast icons; success/warning/error |
| sonner.tsx | `#F5F5F5` in CSS vars | Toast library internal styling |

---

## 4. Related Documentation

- **[design-system-audit.md](./design-system-audit.md)** — Buttons, inputs, variants, migration plan
- **[typography-audit.md](./typography-audit.md)** — Font sizes, hierarchy
- **[TABLE-DESIGN-SYSTEM.md](./TABLE-DESIGN-SYSTEM.md)** — Table layout, date formatting, truncation
- **AGENTS.md** — Design tokens, typography scale, button rules

---

## 5. Rework Readiness Checklist

When planning a full UI rework:

- [ ] Review token usage in `index.css` and ensure all hardcoded colors have equivalents or are documented
- [ ] Run `grep -r "hover:bg-\[#" apps/web/src` to catch new hardcoding
- [ ] Run `grep -r "text-\[#" apps/web/src` for text color drift
- [ ] Component inventory: list key UI components and their locations (see design-system-audit for start)
- [ ] Define screen-by-screen spec before refactoring
- [ ] Migrate one vertical slice (e.g. explore page) as proof of concept

---

## 6. Quick Reference: Replace These

| Avoid | Use Instead |
|-------|-------------|
| `hover:bg-[#1E1E1E]` | `hover:bg-market-list-hover` |
| `focus:bg-[#1E1E1E]` | `focus:bg-market-list-hover` |
| `style={{ backgroundColor: "#1e1e1e" }}` | `style={{ backgroundColor: "var(--color-market-list-hover)" }}` |
| `text-[#F5F5F5]` | `text-text-primary` |
| Raw `<button>` for clickable UI | `<Button variant="...">` |
