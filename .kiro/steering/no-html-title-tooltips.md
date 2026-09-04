---
inclusion: fileMatch
fileMatchPattern: ['apps/web/**/*.tsx', 'apps/web/**/*.ts']
---

# No native `title` tooltips (apps/web)

**Default:** Do **not** add the HTML `title` attribute on elements to show browser tooltips on hover. The product owner does not want implicit hover chrome on new UI.

**When hover copy is explicitly requested** in the task: use the design-system **`Tooltip`**, **`TooltipTrigger`**, **`TooltipContent`** from `@/components/ui/tooltip` (or the established pattern in that screen), not `title=`.

**Accessibility without tooltips:** use **`aria-label`** (or visible text) for icon-only controls and controls that need an accessible name. Do not duplicate that with `title` unless the task asked for a tooltip.

**Allowed exceptions (not “tooltip chrome”):**

- `<iframe title="…">` (required for a11y).
- `<svg>` with a `<title>` child for a11y.
- **Component props named `title`** that are not the DOM attribute (e.g. `PageHeader`, dialog titles, metadata APIs) — fine.

**Red flags in JSX:** `title={` or `title="` on intrinsic elements like `button`, `a`, `span`, `div`, `Link` — avoid unless the user explicitly asked for that behavior.
