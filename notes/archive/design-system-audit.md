# Design System Audit — Buttons & Inputs

**Audit date:** March 2026  
**Scope:** apps/web — buttons, inputs, form controls, modal actions

---

## 1. Executive Summary

The app has **canonical** Button and Input components (Base UI + shadcn), but many features use:
- Raw `<button>` elements with ad-hoc class names
- `<Link>` styled as buttons
- `className` overrides on `Button` that diverge from canonical variants
- Inconsistent hover states (`hover:opacity-90` vs `hover:bg-primary/80` vs `hover:bg-primary/90`)
- Several trading-specific patterns (positive/negative) repeated inline instead of as variants

**Goal:** Define strict button/input rules, reduce variants to a small set, and migrate outliers so UI is cohesive and future changes are easier.

---

## 2. Canonical Components

### Button (`components/ui/button.tsx`)

| Variant   | Use Case                  | Default State      | Hover State           |
|-----------|----------------------------|--------------------|------------------------|
| default   | Primary CTA                | bg-primary         | hover:bg-primary/80    |
| outline   | Secondary actions          | border-border      | hover:bg-input/50      |
| secondary | Alternative emphasis       | bg-secondary       | hover:bg-secondary/80  |
| ghost     | Tertiary, inline actions    | transparent        | hover:bg-muted         |
| destructive | Delete, danger           | bg-destructive/10  | hover:bg-destructive/20 |
| link      | Text link                  | text-primary       | hover:underline         |

**Sizes:** xs, sm, default, lg, icon-xs, icon-sm, icon, icon-lg

**Missing from canonical:** `positive` (buy) and `negative` (sell) — used heavily in trading. These are currently applied via `className` overrides.

### Input (`components/ui/input.tsx`)

- Single canonical component with `bg-input/20`, `border-input`, `focus-visible:ring-ring/30`, `h-7`, `text-sm` (md:text-xs)
- Used in: asset-selector, data-table, market-filters, event-filters, whale-tracker, safe-onboarding, withdraw-flow, sidebar, calendar-widget

### InputGroup, Textarea, NativeSelect

- `InputGroup` — inputs with addons (prefix/suffix)
- `Textarea` — matches Input styling
- `NativeSelect` — aligns with Input border/ring tokens

---

## 3. Violations & Outliers

### 3.1 Raw `<button>` Elements (Should Use `Button`)

| File                     | Count | Notes                                              |
|--------------------------|-------|----------------------------------------------------|
| order-form-ui.tsx        | ~8    | Buy/Sell tabs, +/- buttons, quick-add, submit       |
| calendar-widget.tsx      | 5     | Nav arrows, day cells, close                        |
| market-tabs.tsx          | 5     | Tab triggers, outcome toggles                      |
| wallet-tracker-content   | 3     | Expand, filter toggles                             |
| trading-selector-card    | 1     | Collapsible trigger                                |
| watchlist-widget         | 2     | Nav arrows                                         |
| events-table             | 1     | Row expand                                         |
| portfolio-overview       | 2     | Time range toggles                                 |
| global-search            | 2     | Trigger, back                                     |
| + 15+ other files        | 1–2   | Sortable headers, filter toggles, chart toggles    |

**Action:** Replace raw `<button>` with `<Button variant="..." size="...">` unless there is a strong reason (e.g. order-form +/- may stay for layout; submit/CTA must use Button).

### 3.2 Inconsistent Primary Button Styling

Canonical default: `hover:bg-primary/80`

Overrides found:
- `hover:bg-primary/90` — leaderboard-filters, market-filters, add-track-wallet, quick-sell-modal, wallet-tracker-content
- `hover:opacity-90` — main-header, header-actions, wallet-tracker-content, sonner

**Action:** Standardize on one hover behavior. Recommend `hover:bg-primary/80` (or `hover:opacity-90` for filled buttons — pick one and document).

### 3.3 Custom “Primary-Like” Buttons (Not Using variant="default")

Many components use `className="... bg-primary text-primary-foreground ..."` instead of `<Button>` or `<Button variant="default">`:

- `main-header.tsx`, `header-actions.tsx`: `inline-flex h-auto ... rounded-md bg-primary px-5 py-2 ... hover:opacity-90`
- `wallet-tracker-content.tsx`: `h-auto gap-1.5 rounded-md bg-primary px-3 py-2 ... hover:opacity-90`
- `add-track-wallet-modal-provider.tsx`, `quick-sell-modal.tsx`: `bg-primary text-primary-foreground hover:bg-primary/90`
- `leaderboard-filters.tsx`, `market-filters.tsx`: `bg-primary text-primary-foreground hover:bg-primary/90`

**Action:** Use `<Button variant="default">` with `className` only for layout (e.g. `flex-1`, `min-w-0`). Remove style overrides.

### 3.4 Trading Buttons (Positive/Negative)

**Pattern A — Filled (selected):** `bg-positive text-primary-foreground hover:bg-positive/90` or `bg-negative ... hover:bg-negative/90`  
**Pattern B — Outline (unselected):** `border border-positive bg-transparent text-positive hover:bg-positive/10`

Used in:
- trading-selector-card.tsx (Yes/No outcome toggles)
- markets-table-columns.tsx (Y/N links — actually `<Link>`)
- events-table.tsx (inline-flex ... border-positive/40 bg-positive/10 ...)
- markets-grid.tsx (similar)
- order-form-ui.tsx: `bg-buy` / `bg-sell` with `hover:bg-buy/90` (different tokens)

**Action:** Add `positive` and `negative` (and optionally `positiveOutline`, `negativeOutline`) variants to Button. Replace inline classes with `<Button variant="positive">` etc.

### 3.5 Links Styled as Buttons

- `markets-table-columns.tsx`: `<Link className="rounded-md bg-positive px-3 py-1.5 ...">` for Y/N

**Action:** Use `<Button variant="positive" asChild><Link href={...}>Y</Link></Button>` or a dedicated `ButtonLink` that applies button styles to links.

### 3.6 Order Form Submit Button

`order-form-ui.tsx` builds `buttonClass` dynamically:
- Buy: `bg-buy text-[#1E1E1E] hover:bg-buy/90`
- Sell: `bg-sell text-white hover:bg-sell/90`

Uses `Button` with `className={buttonClass}`. The `bg-positive`/`bg-negative` overrides in index.css apply to `.bg-positive`/`.bg-negative` globally.

**Action:** Add `positive` and `negative` Button variants that use `bg-buy`/`bg-sell` (or map to same tokens). Use `<Button variant="positive">` for buy, `<Button variant="negative">` for sell.

### 3.7 Input Violations

- **order-form-ui.tsx** — Custom styled inputs for amount/shares (large font, no border box); uses `--font-size-order-amount`. This is intentional (trading terminal UX).
- **Other forms** — Generally use `Input` or `InputGroup`; no major outliers.

**Action:** Document order-form as a special case. All other text inputs must use `Input` or `InputGroupInput`.

---

## 4. Proposed Standardized System

### 4.1 Button Variants (Final Set)

| Variant     | Use Case                   | Default                    | Hover                  | Notes                    |
|-------------|----------------------------|----------------------------|------------------------|--------------------------|
| default     | Primary CTA                | bg-primary                 | hover:bg-primary/80    | Modal confirm, header CTA |
| outline     | Secondary actions          | border-border              | hover:bg-input/50       | Cancel, back              |
| secondary   | Alternative emphasis       | bg-secondary               | hover:bg-secondary/80   |                          |
| ghost       | Tertiary, inline           | transparent                | hover:bg-muted          |                          |
| destructive | Delete, danger             | bg-destructive/10          | hover:bg-destructive/20 |                          |
| link        | Text link                  | text-primary               | hover:underline         |                          |
| **positive** | Buy, confirm, success     | bg-positive (→ index.css)  | hover:bg-positive/90    | Trading buy, success CTA  |
| **negative** | Sell, cancel, danger      | bg-negative (→ index.css) | hover:bg-negative/90    | Trading sell, danger CTA  |

**Optional:** `positiveOutline`, `negativeOutline` for unselected Yes/No toggles (border + transparent bg).

### 4.2 Button Rules

1. **Always use `Button`** — no raw `<button>` for clickable UI except where layout demands a bare element (document and keep minimal).
2. **Prefer variant over className** — Use `variant="positive"` instead of `className="bg-positive ..."`.
3. **Single hover convention** — Primary: `hover:bg-primary/80`; Positive/Negative: `hover:bg-positive/90` (already in index.css).
4. **Sizes** — Use `size="sm"`, `size="default"`, `size="lg"`; avoid arbitrary `h-*`/`px-*` on buttons.
5. **Links as buttons** — Use `asChild` with `Link` or a wrapper that applies `buttonVariants()`.

### 4.3 Input Rules

1. **Use `Input`** for all text inputs except the order-form amount/shares (special case).
2. **Use `InputGroup`** when you need prefix/suffix or addons.
3. **Use `Textarea`** for multi-line.
4. **Use `NativeSelect`** for dropdowns where a native select is appropriate.
5. **No custom `border-*`/`bg-*`** on inputs — rely on design tokens.

---

## 5. Implementation Plan

### Phase 1: Extend Button (Low Risk)

1. Add `positive` and `negative` (and optionally `positiveOutline`, `negativeOutline`) variants to `button.tsx`.
2. Ensure they align with existing index.css overrides for `.bg-positive`/`.bg-negative`.

### Phase 2: Standardize Primary Buttons (Medium Effort)

1. Replace custom `bg-primary ...` classNames with `<Button variant="default">`.
2. Standardize hover: pick `hover:bg-primary/80` or `hover:opacity-90` and update Button + any remaining overrides.
3. Files: main-header, header-actions, wallet-tracker-content, add-track-wallet-modal-provider, quick-sell-modal, leaderboard-filters, market-filters.

### Phase 3: Migrate Raw Buttons (Higher Effort)

1. Audit each raw `<button>` — decide: use Button, or document why not.
2. Migrate calendar nav, market tabs, wallet-tracker toggles, etc. to Button.
3. Keep order-form +/- and similar as raw only if layout requires it; use Button for CTAs.

### Phase 4: Migrate Trading Buttons (Medium Effort)

1. Replace `className={cn("... bg-positive ...")}` with `variant="positive"` in trading-selector-card, order-form-ui, events-table, markets-grid, markets-table-columns.
2. Replace `<Link className="... bg-positive ...">` with `Button asChild` + Link.

### Phase 5: Documentation & Lint (Ongoing)

1. Add Button/Input rules to AGENTS.md and apps/web/AGENTS.md.
2. Optionally: stylelint or custom lint to flag `className` containing `bg-primary`/`bg-positive`/`bg-negative` on non-Button elements.

---

## 6. Files Summary

| Category              | Files |
|-----------------------|-------|
| Raw buttons to migrate | order-form-ui, calendar-widget, market-tabs, wallet-tracker-content, trading-selector-card, watchlist-widget, events-table, portfolio-overview, global-search, + ~15 |
| Custom primary buttons | main-header, header-actions, wallet-tracker-content, add-track-wallet-modal-provider, quick-sell-modal, leaderboard-filters, market-filters |
| Positive/negative      | trading-selector-card, markets-table-columns, events-table, markets-grid, order-form-ui |
| Link-as-button         | markets-table-columns |

---

## 7. SelectorChip — Timescale / Filter / Toggle Chips

**Use `SelectorChip`** for: chart intervals, timeframe toggles (1h, 6h, 1d, All), filter chips, view mode toggles (table/grid). Must match across explore, leaderboard, portfolio, calendar, global search.

- **Canonical style:** Active = `bg-primary/15 text-primary ring-primary/40`; inactive = `ring-border`; hover = `hover:bg-muted dark:hover:bg-muted/50`.
- **Sizes:** `sm` (h-6, chart/timescale), `md` (h-8, filter chips with icon/badge), `icon` (size-6, square icon-only).
- **Import:** `@/components/ui/selector-chip`.

Reference: chart timescale buttons in `time-series-chart.tsx`.

---

## 8. Quick Reference: When to Use What

| Need                         | Use                                           |
|-----------------------------|-----------------------------------------------|
| Timescale / filter / toggle | `<SelectorChip active={...} size="sm">`       |
| Primary CTA (modal, header) | `<Button variant="default">`                  |
| Cancel, back                 | `<Button variant="outline">`                  |
| Buy / Yes / success          | `<Button variant="positive">`                |
| Sell / No / danger           | `<Button variant="negative">`                |
| Inline, low emphasis        | `<Button variant="ghost">`                   |
| Delete action                | `<Button variant="destructive">`              |
| Text link                   | `<Button variant="link" asChild><Link></Button>` |
| Text input                  | `<Input>` or `<InputGroup>` + `InputGroupInput` |
| Multi-line                  | `<Textarea>`                                  |
| Dropdown (simple)            | `<NativeSelect>` or shadcn Select             |

---

**Conclusion:** The design system has solid primitives but many ad-hoc overrides. Extending Button with positive/negative variants and migrating outliers to canonical components will make the UI cohesive and future changes easier.
