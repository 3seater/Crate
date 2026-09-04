# Design System

ALWAYS use the project's design system in `apps/web/src/index.css` when building UI. Never hardcode colors or use unsanctioned font sizes.

## Text & Color Tokens

- **White/primary text**: Use `text-text-primary`. In dark mode this is `#F5F5F5`. Never use `text-[#F5F5F5]` — use the token.
- **Font weight**: `font-normal` (400) and `font-medium` (500) only. No `font-semibold` or `font-bold`. "Thinner" → `font-normal`; emphasis → `font-medium`.
- **Text color (hierarchy)**: `text-text-primary` for high-emphasis body. Supporting gray: `text-text-secondary`, `text-text-tertiary`, and `text-text-muted` all use the same token as `text-muted-foreground` — use typography (size/weight) for finer steps, not another gray.

## Typography Scale (6 sizes only)

Use exactly these; no `text-base`, `text-xl`, or `text-[9px]`:

- `text-3xl` (30px) — Display, hero numbers
- `text-2xl` (24px) — Titles, modal headers
- `text-lg` (18px) — Headings, card titles
- `text-sm` (14px) — Body, tables, forms
- `text-xs` (12px) — Captions, labels
- `text-[10px]` (10px) — Micro, badges, Ctrl+K

**Special**: `--font-size-order-amount` for order form amount input only.

## Buttons

Use `Button` from `@/ui/button`. Variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link` (and `positive`/`negative` when added). No raw `<button>` for clickable UI; no `className` overrides for bg/hover — use variants. See [notes/design-system-audit.md](notes/design-system-audit.md).

## Inputs

Use `Input`, `InputGroup`, `Textarea`, or `NativeSelect` from `@/ui/*`. No custom border/bg on inputs. Order-form amount/shares is the only documented exception.

## Tooltips

Do not add native HTML `title` tooltips on new UI unless explicitly requested. Use design-system `Tooltip` when hover copy is part of the spec; use `aria-label` for icon-only controls without duplicating `title`.

## Action Icon Hover States

Small action icons (close, copy, undock, edit, remove, external link) use **color-change only** on hover — no background box. Pattern: `text-text-tertiary transition-colors hover:text-foreground` with `p-0.5` padding. Never use `hover:bg-muted` or `hover:bg-muted/50` on icon-only action buttons. Background hover states are reserved for list items, segmented controls, and interactive surfaces — not standalone icon buttons.
