# Doji V2 — Component System

> Component tiers, composition patterns, data-slot/data-state conventions, and Base UI integration.
> Covers V2.md §13 — the structural rules for every React component in the codebase.
>
> **Date:** 2026-05-02
> **Phase:** 3 (State + WS + Rendering)
> **Risk:** Medium
> **Status:** Planning

---

## Table of Contents

1. [Three Hard Tiers](#1-three-hard-tiers)
2. [When to Use "use client"](#2-when-to-use-use-client)
3. [Composition Patterns](#3-composition-patterns)
4. [Component Taxonomy](#4-component-taxonomy)
5. [data-slot for Component Identification](#5-data-slot-for-component-identification)
6. [data-state for Visual State Styling](#6-data-state-for-visual-state-styling)
7. [Controlled + Uncontrolled State](#7-controlled--uncontrolled-state)
8. [render Prop for Base UI](#8-render-prop-for-base-ui)
9. [React 19 Specifics](#9-react-19-specifics)
10. [Loading State Patterns](#10-loading-state-patterns)
11. [Implementation Plan](#11-implementation-plan)

---

## 1. Three Hard Tiers

Every component belongs to exactly one tier. The tier determines what it can import and what it knows about. No exceptions.

### Tier 1 — Route Modules (`app/`)

| Property | Rule |
|----------|------|
| Default mode | Server Component |
| Responsibility | Prefetch data, set metadata, create Suspense boundaries |
| Max file size | ~60 lines |
| Allowed imports | tRPC server client, Tier 2 domain containers, `<Suspense>`, `<HydrationBoundary>` |
| Forbidden imports | Zustand, `useQuery`, browser APIs |

Route modules are thin orchestrators. They call `await connection()`, create a `QueryClient`, prefetch, and render domain containers inside Suspense boundaries.

```tsx
// app/market/[slug]/page.tsx — Tier 1 example (~40 lines)
import { Suspense } from "react";
import { connection } from "next/server";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { getQueryClient } from "@/shared/lib/trpc/query-client";
import { MarketContent } from "@/features/trading/components/market-content";
import { MarketSkeleton } from "@/features/trading/components/market-skeleton";

export default async function MarketPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const queryClient = getQueryClient();
  // prefetch...
  return (
    <Suspense fallback={<MarketSkeleton />}>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <MarketContent slug={slug} />
      </HydrationBoundary>
    </Suspense>
  );
}
```

### Tier 2 — Domain Containers (`domains/` / current `features/`)

| Property | Rule |
|----------|------|
| Default mode | `"use client"` if they own state or handle events |
| Responsibility | Own queries (`useQuery`), mutations (`useMutation`), Zustand subscriptions |
| Scope | Know about their own domain; know nothing about other domains' internals |
| Composition | Compose from Tier 3 components |
| File naming | Descriptive noun, optionally suffixed `-container` for the top-level component |

Domain containers are the "smart" components. They wire up data fetching, state management, and event handling, then delegate rendering to Tier 3 design system components.

```tsx
// features/trading/components/orderbook-container.tsx — Tier 2 example
"use client";

import { useQuery } from "@tanstack/react-query";
import { useOrderbookStore } from "@/features/trading/stores/orderbook";
import { Orderbook } from "@/shared/components/ui/orderbook";

export function OrderbookContainer({ tokenId }: { tokenId: string }) {
  const { data } = useQuery(orderbookQueryOptions(tokenId));
  const grouping = useOrderbookStore((s) => s.grouping);
  return (
    <Orderbook.Root>
      <Orderbook.Header grouping={grouping} />
      <Orderbook.AskRows rows={data?.asks ?? []} />
      <Orderbook.Spread spread={data?.spread} />
      <Orderbook.BidRows rows={data?.bids ?? []} />
    </Orderbook.Root>
  );
}
```

### Tier 3 — Design System (`ui/`)

| Property | Rule |
|----------|------|
| Default mode | No `"use client"` at module level (event handlers in props are fine) |
| Forbidden imports | `@/domains/`, `@/stores/`, `@/lib/trpc/`, `@/lib/ws/` |
| Input | Typed props only |
| Output | HTML |
| Testability | `render(<Button />)` — no providers needed |

Design system components are pure. They receive data and callbacks via props and render markup. They never fetch data, subscribe to stores, or know about the domain they're used in.

### Import Rules Summary

```
Tier 1 (app/)     → can import Tier 2, Tier 3
Tier 2 (domains/) → can import Tier 3, own domain's stores/hooks
Tier 3 (ui/)      → can import other Tier 3 only
```

**Tier 3 never imports upward.** Tier 2 never imports from another domain. Tier 1 never owns state.

---

## 2. When to Use "use client"

The decision is mechanical, not subjective. Run through this checklist:

| Condition | Directive |
|-----------|-----------|
| Needs `useState`, `useEffect`, `useRef` | `"use client"` |
| Needs `useQuery` or Zustand | `"use client"` |
| Needs browser APIs (`window`, `document`, `navigator`) | `"use client"` |
| Async function that fetches data | Server Component (no directive) |
| Renders based on server data only | Server Component (no directive) |
| Receives event handler callbacks via props (but doesn't define them) | Server Component is fine — the parent passes the handler |

**Key principle:** Extract the minimal client piece. If a component is 80% static markup and 20% interactive, split it: the outer component stays a Server Component, the interactive part becomes a small `"use client"` component.

---

## 3. Composition Patterns

### No Boolean Props for Behavioral Variants

Each boolean doubles possible states. 5 booleans = 32 code paths, most untested.

```tsx
// ❌ Boolean prop proliferation — 8 code paths, most untested
<OrderForm isBuyMode isLimitOrder showDepth />

// ✅ Explicit variant components composing shared internals
<LimitOrderForm side="BUY">
  <OrderForm.PriceField />
  <OrderForm.AmountField />
  <OrderForm.DepthPreview />
  <OrderForm.Submit />
</LimitOrderForm>
```

**Rule:** If you're adding a boolean prop that changes behavior (not just appearance), you probably need a separate component or a compound component variant instead.

### Compound Components

Structure complex UI as `Component.SubComponent` with shared context:

```tsx
// Orderbook as compound component
<Orderbook.Provider tokenId={tokenId}>
  <Orderbook.Header />
  <Orderbook.AskRows />
  <Orderbook.Spread />
  <Orderbook.BidRows />
</Orderbook.Provider>

// Chart as compound component
<Chart.Provider conditionId={conditionId}>
  <Chart.Toolbar />
  <Chart.Canvas />
  <Chart.TimeframeSelector />
</Chart.Provider>

// Order form as compound component
<OrderForm.Provider>
  <OrderForm.Frame>
    <OrderForm.PriceField />
    <OrderForm.AmountField />
    <OrderForm.Submit />
  </OrderForm.Frame>
</OrderForm.Provider>
```

### State Context Interface

Decouple UI from state management with a generic interface: `state`, `actions`, `meta`.

```ts
type OrderFormContextValue = {
  state: {
    price: string;
    amount: string;
    side: "BUY" | "SELL";
    type: OrderType;
    isSubmitting: boolean;
  };
  actions: {
    setPrice: (v: string) => void;
    setAmount: (v: string) => void;
    submit: () => void;
  };
  meta: {
    tickSize: number;
    minOrderSize: number;
    balance: number;
  };
};
```

The provider is the only place that knows how state is managed. Different providers implement this interface:

| Provider | Use case |
|----------|----------|
| `MarketOrderProvider` | No price field (market price) |
| `LimitOrderProvider` | With price field |
| `EditOrderProvider` | Pre-filled from existing order |

The same `OrderForm.PriceField`, `OrderForm.AmountField`, and `OrderForm.Submit` work with all providers because they consume the interface, not the implementation.

---

## 4. Component Taxonomy

Every UI artifact falls into one of these categories. Use this to decide where something lives.

| Level | What it is | Doji example | Lives in |
|-------|-----------|-------------|---------|
| **Primitive** | Unstyled behavior + a11y. No visual design. | Radix Dialog, Base UI Popover | `node_modules` (never custom) |
| **Component** | Styled, reusable UI unit wrapping a primitive | `Button`, `Input`, `Tooltip`, `Badge` | `ui/primitives/` |
| **Pattern** | Documented composition solving a UX problem | Optimistic UI, confirm-before-delete, typeahead search | `ui/patterns/` |
| **Block** | Opinionated product-specific composition | Order form, orderbook panel, bridge deposit flow | `domains/{domain}/components/` |
| **Page** | Single-route view composing blocks | `/market/[slug]`, `/explore`, `/portfolio` | `app/` route modules |
| **Utility** | Non-visual helper (hook, function) | `useDebounce`, `cn()`, `formatPrice()` | `hooks/`, `utils/`, `lib/` |

**Classification heuristic:**

- No styling → **Primitive** (use from `node_modules`)
- Styled + reusable across domains → **Component**
- Solves a documented UX pattern → **Pattern**
- Product-specific use case → **Block**
- Full route → **Page**
- Non-visual → **Utility**

### Current State vs Target

| Level | Current location | V2 target location |
|-------|-----------------|-------------------|
| Component | `shared/components/ui/` | `ui/primitives/` |
| Pattern | scattered | `ui/patterns/` |
| Block | `features/{feature}/components/` | `domains/{domain}/components/` |
| Page | `app/` | `app/` (unchanged) |
| Utility | `shared/hooks/`, `shared/utils/` | `hooks/`, `utils/`, `lib/` |

---

## 5. data-slot for Component Identification

Use `data-slot` attributes on compound component parts for stable parent→child styling. This replaces fragile element selectors and avoids className prop explosion.

### Pattern

```tsx
// Compound component parts declare their slot
function OrderbookHeader(props: React.ComponentProps<"div">) {
  return <div data-slot="orderbook-header" {...props} />;
}

function OrderbookRow(props: React.ComponentProps<"div"> & { side: "bid" | "ask" }) {
  return <div data-slot="orderbook-row" data-side={props.side} {...props} />;
}
```

### Parent Styling with Tailwind data-[] Variant

```tsx
// Parent targets children without knowing their internals
<div className="[&_[data-slot=orderbook-row][data-side=bid]]:text-positive
               [&_[data-slot=orderbook-row][data-side=ask]]:text-negative">
  <OrderbookHeader />
  <OrderbookRow side="bid" />
  <OrderbookRow side="ask" />
</div>
```

### Benefits

- **Stable selectors** — renaming a CSS class doesn't break parent styling
- **No className prop explosion** — parent doesn't need to pass `headerClassName`, `rowClassName`, etc.
- **Inspectable** — `data-slot` is visible in DevTools, making debugging trivial

### Naming Convention

- `data-slot` values are `kebab-case` and scoped to the component: `orderbook-header`, `orderbook-row`, `chart-toolbar`
- `data-side`, `data-variant`, etc. for semantic attributes beyond slot identity

---

## 6. data-state for Visual State Styling

Expose component state via `data-state` attributes instead of multiple className props. Style with Tailwind's `data-[]` variant.

### Pattern

```tsx
// Order form submit button — state exposed as data attribute
<button
  data-slot="submit-button"
  data-state={isSubmitting ? "loading" : isDisabled ? "disabled" : "ready"}
  className="data-[state=loading]:opacity-50 data-[state=disabled]:cursor-not-allowed"
>
  {isSubmitting ? "Placing..." : "Place Order"}
</button>
```

### When to Use

| Scenario | Use `data-state` | Use className |
|----------|-----------------|---------------|
| Component has 2+ visual states | ✅ | ❌ |
| Parent needs to style based on child state | ✅ | ❌ |
| Simple one-off conditional style | ❌ | ✅ |

### Common States

```
data-state="loading" | "ready" | "disabled" | "error" | "success"
data-state="open" | "closed"
data-state="active" | "inactive"
data-state="selected" | "unselected"
```

---

## 7. Controlled + Uncontrolled State

Domain blocks (order form, bridge flow) should support both controlled and uncontrolled usage. Use `useControllableState` from Radix:

```ts
import { useControllableState } from "@radix-ui/react-use-controllable-state";

// Order form price field — works controlled (parent manages) or uncontrolled (self-manages)
const [price, setPrice] = useControllableState({
  prop: controlledPrice,       // from parent (if provided)
  defaultProp: defaultPrice,   // initial value (if uncontrolled)
  onChange: onPriceChange,     // notify parent of changes
});
```

### When to Use

- **Uncontrolled** (default): Component manages its own state. Simpler for most cases.
- **Controlled**: Parent manages state. Required when multiple components need to share or coordinate state (e.g., `EditOrderProvider` pre-filling from an existing order).

### Doji Candidates

| Component | Controlled by | Uncontrolled default |
|-----------|--------------|---------------------|
| Order form price | `EditOrderProvider` | Empty string |
| Order form amount | `EditOrderProvider` | Empty string |
| Bridge amount | Parent flow | Empty string |
| Chart timeframe | URL search params | `1D` |

---

## 8. render Prop for Base UI

We use Base UI (not Radix) for primitives. Base UI uses `render` prop instead of `asChild` for element polymorphism. Same goal — avoid wrapper div nesting — different API.

### Basic Usage

```tsx
// render prop — single DOM element, no wrapper
<Tooltip.Trigger render={<Link href={`/market/${slug}`} />}>
  {marketTitle}
</Tooltip.Trigger>

// Dialog trigger using our Button component
<Dialog.Trigger render={<Button variant="outline" />}>
  Place Order
</Dialog.Trigger>

// Function form for custom rendering logic
<Dialog.Trigger render={(props) => <MyCustomButton {...props} />}>
  Open
</Dialog.Trigger>
```

### Key Differences from Radix

| Feature | Radix | Base UI |
|---------|-------|---------|
| Element polymorphism | `asChild` prop | `render` prop (element or function) |
| Positioned popups | Props on `Content` (`side`, `align`) | Separate `Positioner` wrapper component |
| Labels in popups | Direct children | Must be inside a `Group` component |
| Custom composable components | `Slot` + `asChild` | `useRender` hook + `mergeProps` |

### Positioner Example

```tsx
// Base UI requires explicit Positioner for positioned elements
<Tooltip.Root>
  <Tooltip.Trigger>Hover me</Tooltip.Trigger>
  <Tooltip.Positioner side="top" align="center">
    <Tooltip.Popup>Tooltip content</Tooltip.Popup>
  </Tooltip.Positioner>
</Tooltip.Root>
```

### Building Custom Composable Components

```tsx
// Use useRender + mergeProps for custom compound components
import { useRender, mergeProps } from "@base-ui-components/react";

function CustomTrigger(props: CustomTriggerProps) {
  const { renderElement } = useRender({ render: props.render });
  const mergedProps = mergeProps(props, { onClick: handleClick });
  return renderElement(mergedProps);
}
```

---

## 9. React 19 Specifics

### use(Context) Instead of useContext

React 19 introduces `use()` which can read context and can be called conditionally:

```tsx
// ✅ React 19 — can be called conditionally
import { use } from "react";

function OrderFormField({ contextOverride }: Props) {
  const ctx = contextOverride ?? use(OrderFormContext);
  // ...
}

// ❌ Old pattern — cannot be conditional
import { useContext } from "react";
const ctx = useContext(OrderFormContext); // must be top-level
```

### ref as Regular Prop

React 19 passes `ref` as a regular prop. No more `forwardRef`:

```tsx
// ✅ React 19
function Input({ ref, ...props }: React.ComponentProps<"input">) {
  return <input ref={ref} {...props} />;
}

// ❌ Old pattern
const Input = React.forwardRef<HTMLInputElement, InputProps>((props, ref) => {
  return <input ref={ref} {...props} />;
});
```

### Migration Notes

- `forwardRef` still works but is unnecessary — remove when touching a file
- `use(Context)` is preferred for new code; existing `useContext` calls work fine
- React Compiler handles memoization — remove manual `useMemo`/`useCallback`/`React.memo` when touching a file

---

## 10. Loading State Patterns

Two patterns, chosen based on whether the skeleton matches the data shape.

### Pattern A: Page Owns Suspense

`loading.tsx` exports `null` (or doesn't exist). The page component creates its own `<Suspense>` boundaries with granular skeletons.

```tsx
// loading.tsx
export default function Loading() {
  return null;
}

// page.tsx
export default async function MarketPage({ params }) {
  return (
    <MarketTerminalShell>
      <Suspense fallback={<OrderbookSkeleton />}>
        <OrderbookContainer />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <ChartContainer />
      </Suspense>
    </MarketTerminalShell>
  );
}
```

**Use when:** Skeleton structure mirrors the content structure (trading layout, explore grid). You need granular control over which parts stream independently.

**Doji routes using Pattern A:**
- `/market/[slug]` — trading terminal with independent orderbook, chart, order form skeletons
- `/explore` — grid with individual card skeletons

### Pattern B: loading.tsx = PageSkeleton

`loading.tsx` exports a full-page skeleton. The page component doesn't manage Suspense.

```tsx
// loading.tsx
export default function Loading() {
  return <PortfolioSkeleton />;
}

// page.tsx — no Suspense needed, loading.tsx handles it
export default async function PortfolioPage() {
  // ...
}
```

**Use when:** A full-page generic skeleton works (portfolio, leaderboard). Zero setup in the page component.

**Doji routes using Pattern B:**
- `/portfolio` — full-page table skeleton
- `/leaderboard` — full-page table skeleton
- `/watchlist` — full-page list skeleton
- `/wallet-tracker` — full-page list skeleton

### Decision Matrix

| Route | Pattern | Reason |
|-------|---------|--------|
| `/market/[slug]` | A | Multiple independent panels stream separately |
| `/explore` | A | Grid cards + filters stream independently |
| `/portfolio` | B | Single table, full-page skeleton works |
| `/leaderboard` | B | Single table |
| `/watchlist` | B | Single list |
| `/wallet-tracker` | B | Single list |
| `/referrals` | B | Single stats + table |
| `/login` | B | Simple form |

---

## 11. Implementation Plan

This is a gradual adoption — not a big-bang rewrite. Apply these patterns when touching a file.

### Phase 1: Establish Conventions (Week 1)

- [ ] Document tier rules in `apps/web/AGENTS.md`
- [ ] Add `data-slot` to 3 existing compound components as proof-of-concept (orderbook, chart, order form)
- [ ] Convert 1 existing component to compound pattern (orderbook is the best candidate — already has Provider/Header/Rows)
- [ ] Add `data-state` to submit buttons and loading states

### Phase 2: New Code Follows Rules (Ongoing)

- [ ] All new components follow the three-tier rule
- [ ] All new compound components use `data-slot`
- [ ] All new interactive components use `data-state` for visual states
- [ ] Code review enforces: no boolean props for behavioral variants
- [ ] New `"use client"` additions must pass the mechanical checklist

### Phase 3: Migrate Existing Components (When Touched)

- [ ] When modifying a component, check its tier placement
- [ ] When modifying a component with boolean behavioral props, refactor to compound pattern
- [ ] When modifying a component with `forwardRef`, convert to `ref` as prop
- [ ] When modifying a component with `useContext`, convert to `use(Context)` if beneficial
- [ ] When modifying loading states, apply Pattern A or B based on the decision matrix

### Phase 4: Design System Extraction (Phase 6 of V2)

- [ ] Move reusable components from `shared/components/ui/` to `ui/primitives/`
- [ ] Extract documented patterns to `ui/patterns/`
- [ ] Ensure all Tier 3 components have zero domain imports
- [ ] Add Storybook or similar for Tier 3 component documentation

### What NOT to Do

- ❌ Don't rewrite working components just to match the new pattern
- ❌ Don't add `data-slot` to simple components that don't need parent styling
- ❌ Don't convert every component to compound pattern — only complex multi-part UI
- ❌ Don't block PRs on tier violations in untouched code
