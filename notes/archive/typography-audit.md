# Typography Audit — Doji UI

**Audit date:** March 2026  
**Scope:** apps/web — all pages, modals, widgets, components with visible text

---

## 1. Documented System (from index.css + AGENTS.md)

### Typography Scale (6 sizes)

| Level | Class | Size | Role |
|-------|-------|------|------|
| 1 | `text-3xl` | 30px | Display: hero numbers, key stats |
| 2 | `text-2xl` | 24px | Title: section headers, modal titles |
| 3 | `text-lg` | 18px | Heading: card titles, market question |
| 4 | `text-sm` | 14px | Body: tables, nav, tabs, orderbook, forms |
| 5 | `text-xs` | 12px | Caption: labels, metadata, badges |
| 6 | `text-[10px]` | 10px | Micro: tags, chart axes, Ctrl+K, utility footer |

**Special:** `--font-size-order-amount` (37.5px) — order form amount/shares input only

### Font Weights (AGENTS.md)

- `font-normal` (400)
- `font-medium` (500)

*Two-weight system. No `font-semibold`. "Thinner" → go down one step.*

---

## 2. Actual Usage (grep-based counts)

### Font sizes

| Size | Approx count | In scale? | Notes |
|------|--------------|-----------|-------|
| `text-xs` | ~270 | ✅ | Most used; tables, labels, UI chrome |
| `text-sm` | ~240 | ✅ | Body copy, tabs, row data |
| `text-lg` | ~40 | ✅ | Modal titles, card headings |
| `text-2xl` | ~30 | ✅ | Page headers, key stats |
| `text-3xl` | ~25 | ✅ | Hero numbers, portfolio summary |
| `text-[10px]` | ~10 | ✅ | Badges, Ctrl+K hint, micro copy |
| **`text-base`** | ~15 | ❌ | Not in scale; sits between text-sm and text-lg |
| **`text-xl`** | ~20 | ❌ | Not in scale; between text-lg and text-2xl |
| **`text-[9px]`** | 2 | ❌ | Only calendar-widget; below micro floor |

### Font weights

| Weight | Usage | In rules? |
|--------|-------|-----------|
| `font-normal` | Heavy | ✅ |
| `font-medium` | Heavy | ✅ |
| `font-semibold` | 0 | ❌ (migrated to `font-medium`) |
| `font-bold` | 0 | ✅ (not used; correct) |

### Color tokens

| Token | Status |
|-------|--------|
| `text-text-primary` | Used correctly |
| `text-text-secondary` | Used correctly |
| `text-text-tertiary` | Used correctly |
| `text-text-muted` | Used correctly |
| `text-text-primary` | ✅ Correct — primary "white" text (#F5F5F5 in dark). Use this token, not hex. |
| `text-muted-foreground` | shadcn default; often used instead of `text-text-tertiary` |
| `text-foreground` | shadcn default; sometimes preferred over `text-text-primary` |

---

## 3. Violations & Inconsistencies

### Size violations

1. **`text-base` (16px)** — Used in profile-hover-card metric values, order-form-ui, portfolio-overview, etc. Not in the 6-size scale. Options:
   - Add as an intermediate size (e.g. “Subheading”)
   - Replace with `text-sm` or `text-lg` depending on hierarchy

2. **`text-xl` (20px)** — Used for portfolio summary stats, PNL values. Sits between `text-lg` and `text-2xl`. Options:
   - Map to `text-2xl` for key stats
   - Or define as a level if you want more granular hierarchy

3. **`text-[9px]`** — Calendar day numbers only. Below micro floor (10px). Consider `text-[10px]` for consistency.

### Color violations

- Many components use `text-[#F5F5F5]` instead of `text-text-primary`.
- `text-muted-foreground` and `text-foreground` mix with `text-text-tertiary` / `text-text-primary`.

### Component-level patterns

- **shadcn/ui primitives** (Dialog, Sheet, Popover, etc.) use `text-xs` / `text-sm` and shadcn color tokens. Mostly fine.
- **Custom modals** often use `text-lg` for titles; matches scale.
- **Tables** use `text-xs` for headers, `text-sm` for cells; matches scale.
- **Order form** uses custom `--font-size-order-amount`; correct.

---

## 4. Summary: Is the System Working?

### Working well

- The 6-size scale is used consistently for most UI.
- No `font-bold`; weights stay within the three allowed.
- Hierarchy is clear: micro → caption → body → heading → title → display.
- Numeric UI uses Inter proportional figures; `tabular-nums` is avoided because it activates different digit glyphs in Inter.
- Scale is documented and discoverable in index.css and AGENTS.md.

### Gaps

1. **Out-of-scale sizes:** `text-base` and `text-xl` suggest an implicit 8-step scale. Either formally add them or migrate to the 6-step scale.
2. **Hardcoded colors:** `#F5F5F5` should be replaced with `text-text-primary` (or equivalent token).
3. **Single outlier:** `text-[9px]` in calendar widget.
4. **shadcn vs custom:** Mix of `text-muted-foreground` and `text-text-tertiary`; consider standardizing on one system.

### Comparison to common practice

- **6–8 step scales** are typical (Material, Apple HIG, Inter type scale).
- **Avoiding `font-bold` (700)** and using 400/500/600 is a valid choice and supports clearer hierarchy.
- **Modular scale** (e.g. 1.25): Your steps are roughly 1.2–1.25 between levels, which is standard.
- Many sites use `text-base` (16px) as body; your `text-sm` (14px) is more compact and fits a trading UI.

---

## 5. Recommendations

### Low effort

1. Replace `text-[9px]` with `text-[10px]` in `calendar-widget.tsx`.
2. Add a brief note in index.css: “Avoid `text-base` and `text-xl`; use the 6-size scale.”

### Medium effort

3. Decide on `text-base` and `text-xl`:
   - **Option A:** Add them to the scale (8 sizes) and document.
   - **Option B:** Refactor to `text-sm` or `text-lg` / `text-2xl` as appropriate.
4. Replace `text-[#F5F5F5]` with `text-text-primary` where it represents primary text.
5. Prefer `text-text-tertiary` over `text-muted-foreground` in custom components for consistency.

### High effort

6. Add lint rules (e.g. stylelint or custom) to:
   - Disallow `text-base`, `text-xl` unless explicitly allowed.
   - Flag hardcoded hex colors for text.
7. Create a small typography reference page showing each size + weight for designers and devs.

---

## 6. Files with Most Violations

| File | Issues |
|------|--------|
| `referrals-page.tsx` | `text-[#F5F5F5]`, mixed sizes |
| `leaderboard-profile-modal.tsx` | `text-[#F5F5F5]` |
| `wallet-tracker-content.tsx` | Mixed tokens |
| `order-form-ui.tsx` | Many `text-[#F5F5F5]` |
| `market-tabs.tsx` | `text-[#F5F5F5]` |
| `calendar-widget.tsx` | `text-[9px]` outlier |
| `portfolio-overview.tsx` | `text-xl` (out of scale) |
| `position-table.tsx` | `text-[#F5F5F5]` |
| `events-table.tsx` | Mixed |

---

**Conclusion:** The 6-size typography system is mostly followed. Main issues are two out-of-scale sizes (`text-base`, `text-xl`), one micro outlier (`text-[9px]`), and many hardcoded `#F5F5F5` usages. Addressing these would bring the UI in line with the documented system.
