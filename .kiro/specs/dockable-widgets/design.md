# Design Document: Dockable Widgets

## Overview

The dockable widget panel system adds a persistent side-panel mode to the three existing floating widgets (Wallet Tracker, Activity, Watchlist). When docked, a widget occupies a fixed-width column on the left or right of the main content area, pushing that content horizontally rather than overlapping it. Up to two widgets can be docked simultaneously — one per side.

The system is designed to integrate cleanly into the existing PPR + streaming + caching architecture. The dock zone lives inside `AppShellRouter` (the existing `"use client"` boundary), so no Server Component boundaries are crossed. React 19 `<Activity>` keeps docked widgets mounted across client-side navigations, preserving their internal state. Zustand `persist` middleware stores dock configuration in localStorage using the same pattern as `workspace-layout.ts`.

### Key Design Decisions

- **No new client boundary**: `DockShell` is a `"use client"` component that lives inside `AppShellRouter`, which is already the client boundary. `AppShell` (Server Component) is untouched.
- **CSS-variable layout**: Dock widths are communicated to the layout via `--dock-left-width` and `--dock-right-width` CSS custom properties set on the document root. This avoids any server-side layout calculation and is compatible with PPR.
- **Activity for continuity**: Both dock slots render `<Activity>` wrappers unconditionally. The `mode` prop (`"visible"` / `"hidden"`) is driven by the Zustand store. This is the same pattern already used in `MarketTabs`.
- **Pointer events for resize**: The resize handle uses `pointermove`/`pointerup` (not mouse events) for cross-device support, with `startTransition` wrapping width state updates.
- **Separate from floating resize**: The `resizable-widgets` spec covers floating widget resize. Docked widget resize is a separate, simpler interaction (horizontal only, fixed inner-edge handle).

---

## Architecture

### Component Hierarchy

```
AppShell (Server Component — PPR static shell, untouched)
└── Suspense fallback=AppShellFallback
    └── AppShellRouter ("use client" — existing client boundary)
        ├── SiteHeader
        ├── WatchlistBar
        ├── DockShell ("use client" — NEW, wraps children)
        │   ├── DockSlot side="left"  ("use client" — NEW)
        │   │   └── <Activity mode={leftOccupied ? "visible" : "hidden"}>
        │   │       └── [widget content for left slot]
        │   │           └── DockResizeHandle side="left"
        │   ├── <main> (existing main content, flex: 1)
        │   │   └── {children}  ← Next.js page content
        │   └── DockSlot side="right" ("use client" — NEW)
        │       └── <Activity mode={rightOccupied ? "visible" : "hidden"}>
        │           └── [widget content for right slot]
        │               └── DockResizeHandle side="right"
        └── BottomBar
```

### Data Flow

```
User clicks dock icon
        │
        ▼
useDockLayoutStore.dockWidget(id, side)
        │
        ├── Updates leftSlot / rightSlot in Zustand store
        ├── Zustand persist middleware writes to localStorage
        └── React re-renders DockShell
                │
                ├── DockSlot reads leftSlot/rightSlot from store
                ├── Activity mode flips "hidden" → "visible"
                ├── useEffect sets --dock-left-width / --dock-right-width CSS vars
                └── Main content reflows via CSS flex
```

### Integration with AppShellRouter

Current `AppShellRouter` render order:
```
SiteHeader → WatchlistBar → <main>{children}</main> → BottomBar
```

After this feature:
```
SiteHeader → WatchlistBar → <DockShell>{children}</DockShell> → BottomBar
```

`DockShell` replaces the `<main>` element. It renders a flex row containing the left dock slot, the `<main>` element (with `flex: 1`), and the right dock slot. The existing `mainChrome` class string is moved into `DockShell`'s `<main>` element.

---

## Components and Interfaces

### `DockShell` (`components/layout/dock-shell.tsx`)

```typescript
"use client";

interface DockShellProps {
  children: React.ReactNode;
}
```

Responsibilities:
- Renders the three-column flex row: left slot, main content, right slot
- Reads `leftSlot`, `rightSlot`, `widths` from `useDockLayoutStore`
- Sets `--dock-left-width` and `--dock-right-width` CSS custom properties on `document.documentElement` via `useEffect` whenever slot occupancy or widths change
- Passes the correct widget content component to each `DockSlot`
- Preserves the existing `mainChrome` CSS classes on the `<main>` element

CSS variable update logic:
```typescript
useEffect(() => {
  const leftWidth = leftSlot ? `${widths[leftSlot]}px` : "0px";
  const rightWidth = rightSlot ? `${widths[rightSlot]}px` : "0px";
  document.documentElement.style.setProperty("--dock-left-width", leftWidth);
  document.documentElement.style.setProperty("--dock-right-width", rightWidth);
}, [leftSlot, rightSlot, widths]);
```

### `DockSlot` (`components/layout/dock-slot.tsx`)

```typescript
"use client";

interface DockSlotProps {
  side: "left" | "right";
  widgetId: DockableWidgetId | null;
}
```

Responsibilities:
- Wraps widget content in `<Activity mode={widgetId ? "visible" : "hidden"}>`
- Renders the `DockResizeHandle` on the inner edge
- Applies `width: var(--dock-left-width)` or `width: var(--dock-right-width)` via inline style
- Uses `overflow: hidden` and `flex-shrink: 0` to prevent layout bleed
- Renders all three widget content components unconditionally inside their own `<Activity>` wrappers (one per widget), with only the active one set to `"visible"`

The slot renders all three widgets always (each in its own `<Activity>`), so switching which widget occupies a slot does not unmount the previous widget:

```tsx
<div style={{ width: `var(--dock-${side}-width)`, flexShrink: 0, overflow: "hidden" }}>
  {DOCKABLE_WIDGET_IDS.map((id) => (
    <Activity key={id} mode={widgetId === id ? "visible" : "hidden"}>
      <DockableWidgetPanel id={id} side={side} />
    </Activity>
  ))}
</div>
```

### `DockResizeHandle` (`components/layout/dock-resize-handle.tsx`)

```typescript
"use client";

interface DockResizeHandleProps {
  side: "left" | "right";
  widgetId: DockableWidgetId;
}
```

Responsibilities:
- Renders a 4px-wide drag target on the inner edge (right edge for left-docked, left edge for right-docked)
- On `pointerdown`: captures pointer, records start X and current width
- On `pointermove`: computes new width, wraps `setState` in `startTransition`, clamps to [280, 480]
- On `pointerup`: calls `useDockLayoutStore.setWidth(widgetId, finalWidth)` to persist
- Uses `cursor: ew-resize` styling

```typescript
const handlePointerDown = (e: React.PointerEvent) => {
  e.currentTarget.setPointerCapture(e.pointerId);
  startX.current = e.clientX;
  startWidth.current = widths[widgetId];
};

const handlePointerMove = (e: React.PointerEvent) => {
  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
  const delta = side === "left"
    ? e.clientX - startX.current
    : startX.current - e.clientX;
  const next = Math.min(480, Math.max(280, startWidth.current + delta));
  startTransition(() => setLocalWidth(next));
};

const handlePointerUp = (e: React.PointerEvent) => {
  e.currentTarget.releasePointerCapture(e.pointerId);
  setWidth(widgetId, localWidth);
};
```

### `WidgetDockControls` (`components/widgets/widget-dock-controls.tsx`)

```typescript
"use client";

interface WidgetDockControlsProps {
  widgetId: DockableWidgetId;
}
```

Responsibilities:
- Reads `leftSlot`, `rightSlot` from `useDockLayoutStore`
- Renders "Dock left" button (hidden when `leftSlot === widgetId`)
- Renders "Dock right" button (hidden when `rightSlot === widgetId`)
- Renders "Undock" button (visible only when widget is currently docked)
- Each button uses `Button` variant `ghost` with `aria-label`
- Each dock button is wrapped in design-system `Tooltip` with appropriate text
- Calls `dockWidget(widgetId, "left")`, `dockWidget(widgetId, "right")`, or `undockWidget(widgetId)`

### `DockIconLeft` / `DockIconRight` (`components/widgets/dock-icon-left.tsx`, `dock-icon-right.tsx`)

SVG icons as React components. `DockIconLeft` renders a square outline with a filled vertical bar on the left side. `DockIconRight` renders the mirror image. Both accept standard SVG props.

### Dockable Widget Panel (inline in `DockSlot`)

When a widget is docked, it renders in a panel that:
- Has `height: 100%` to fill the dock zone
- Has a header bar containing: widget title, `WidgetDockControls`, and any widget-specific controls
- Has a scrollable content area (`flex: 1; overflow: auto`)
- Has no rounded corners or shadow (it's flush with the layout, not floating)
- Uses `border-r` (left-docked) or `border-l` (right-docked) to separate from main content

---

## Data Models

### Zustand Store (`stores/dock-layout.ts`)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getCachedStorage, invalidateStorageCache } from "@/utils/cached-storage";

export type DockableWidgetId = "wallet-tracker" | "activity" | "watchlist";
export type DockSide = "left" | "right";

export const DOCK_LAYOUT_STORAGE_KEY = "doji-dock-layout-storage";
export const DOCK_WIDTH_DEFAULT = 320;
export const DOCK_WIDTH_MIN = 280;
export const DOCK_WIDTH_MAX = 480;

export function clampDockWidth(n: number): number {
  return Math.min(DOCK_WIDTH_MAX, Math.max(DOCK_WIDTH_MIN, n));
}

interface DockLayoutState {
  leftSlot: DockableWidgetId | null;
  rightSlot: DockableWidgetId | null;
  widths: Record<DockableWidgetId, number>;
  dockWidget: (id: DockableWidgetId, side: DockSide) => void;
  undockWidget: (id: DockableWidgetId) => void;
  setWidth: (id: DockableWidgetId, width: number) => void;
}

const DEFAULT_WIDTHS: Record<DockableWidgetId, number> = {
  "wallet-tracker": DOCK_WIDTH_DEFAULT,
  "activity": DOCK_WIDTH_DEFAULT,
  "watchlist": DOCK_WIDTH_DEFAULT,
};

export const useDockLayoutStore = create<DockLayoutState>()(
  persist(
    (set) => ({
      leftSlot: null,
      rightSlot: null,
      widths: { ...DEFAULT_WIDTHS },

      dockWidget: (id, side) =>
        set((s) => {
          // If widget is already in the other slot, remove it from there
          const otherSide = side === "left" ? "right" : "left";
          const otherSlotKey = `${otherSide}Slot` as const;
          return {
            [`${side}Slot`]: id,
            [otherSlotKey]: s[otherSlotKey] === id ? null : s[otherSlotKey],
          };
        }),

      undockWidget: (id) =>
        set((s) => ({
          leftSlot: s.leftSlot === id ? null : s.leftSlot,
          rightSlot: s.rightSlot === id ? null : s.rightSlot,
        })),

      setWidth: (id, width) =>
        set((s) => ({
          widths: { ...s.widths, [id]: clampDockWidth(width) },
        })),
    }),
    {
      name: DOCK_LAYOUT_STORAGE_KEY,
      version: 1,
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.warn("[dock-layout] Failed to rehydrate dock state:", error);
        }
        // Invalidate cached-storage so next read reflects persisted state
        invalidateStorageCache(DOCK_LAYOUT_STORAGE_KEY);
      },
    }
  )
);
```

**State shape in localStorage** (key: `doji-dock-layout-storage`):
```json
{
  "state": {
    "leftSlot": "activity",
    "rightSlot": null,
    "widths": {
      "wallet-tracker": 320,
      "activity": 360,
      "watchlist": 320
    }
  },
  "version": 1
}
```

**Corrupt state handling**: Zustand `persist` middleware catches JSON parse errors internally. The `onRehydrateStorage` callback receives the error and logs a warning; the store initializes with the default state (both slots null, default widths).

### CSS Custom Properties

Set on `document.documentElement` by `DockShell`'s `useEffect`:

| Property | Value when occupied | Value when empty |
|---|---|---|
| `--dock-left-width` | `${widths["wallet-tracker" | "activity" | "watchlist"]}px` | `0px` |
| `--dock-right-width` | `${widths["wallet-tracker" | "activity" | "watchlist"]}px` | `0px` |

These are set client-side after hydration, so the initial SSR/PPR render always shows `0px` (no docked widgets). This is correct — the dock state is user-specific and cannot be in the static shell.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Docking sets the correct slot

*For any* dockable widget ID and any side ("left" or "right"), calling `dockWidget(id, side)` on the store should result in the corresponding slot (`leftSlot` or `rightSlot`) being equal to `id`.

**Validates: Requirements 2.1, 2.2**

### Property 2: Slot exclusivity invariant

*For any* sequence of `dockWidget` and `undockWidget` calls, the store state should never have the same widget ID in both `leftSlot` and `rightSlot` simultaneously.

**Validates: Requirements 3.1, 3.2**

### Property 3: Slot replacement

*For any* two distinct widget IDs A and B, if A is in a slot and `dockWidget(B, sameSide)` is called, then that slot should contain B and A should not appear in either slot (unless A was also in the other slot, in which case the other slot is unchanged).

**Validates: Requirements 3.4**

### Property 4: Undock restores empty slot

*For any* widget ID that is currently docked (in either slot), calling `undockWidget(id)` should result in both `leftSlot` and `rightSlot` being null for that widget ID.

**Validates: Requirements 4.2**

### Property 5: Width clamping invariant

*For any* call to `setWidth(id, n)` with any numeric value `n`, the resulting `widths[id]` in the store should always be in the range [280, 480] inclusive.

**Validates: Requirements 5.3, 5.4**

### Property 6: Width persistence round-trip

*For any* widget ID and any valid width value, calling `setWidth(id, width)` and then reading `widths[id]` from a freshly-initialized store (rehydrated from the same localStorage) should return the same clamped width.

**Validates: Requirements 5.5, 8.1, 8.2**

### Property 7: Dock state persistence round-trip

*For any* sequence of `dockWidget` and `undockWidget` operations, serializing the store state to localStorage and then rehydrating a new store instance should produce identical `leftSlot` and `rightSlot` values.

**Validates: Requirements 8.1, 8.2**

### Property 8: Corrupt storage falls back to default

*For any* corrupt or unparseable string written to the dock layout localStorage key, initializing the store should result in `leftSlot === null`, `rightSlot === null`, and all widths equal to `DOCK_WIDTH_DEFAULT` (320).

**Validates: Requirements 8.3**

### Property 9: Activity mode matches slot occupancy

*For any* store state, the `<Activity>` mode for a given widget in a given slot should be `"visible"` if and only if that widget's ID matches the slot's current value, and `"hidden"` otherwise.

**Validates: Requirements 9.1, 9.4, 9.5, 9.6**

### Property 10: Dock icon visibility matches slot state

*For any* widget ID, the "Dock left" icon should not be rendered when `leftSlot === id`, and the "Dock right" icon should not be rendered when `rightSlot === id`.

**Validates: Requirements 7.4**

### Property 11: CSS variables reflect slot state

*For any* store state, `--dock-left-width` should be `"0px"` when `leftSlot` is null and `"${widths[leftSlot]}px"` when `leftSlot` is non-null (and symmetrically for the right side).

**Validates: Requirements 2.3**

---

## Error Handling

### Corrupt localStorage

Zustand `persist` middleware wraps the `JSON.parse` call internally. If the stored value is not valid JSON or does not match the expected shape, the store initializes with the default state. The `onRehydrateStorage` callback logs a `console.warn` with the error for debugging. No user-visible error is shown — the dock simply starts empty, which is a safe fallback.

### Widget not found

`DockSlot` renders all three widget content components unconditionally (each in its own `<Activity>`). There is no "widget not found" case — the slot always has all three widgets available, with only the active one visible.

### Resize out of bounds

Width values are clamped in two places:
1. During drag: `Math.min(480, Math.max(280, computed))` in `DockResizeHandle`
2. On persist: `clampDockWidth` in `setWidth` action

This double-clamping ensures that even if a stale persisted value is outside the valid range (e.g. from a future schema change), it is corrected on first use.

### SSR / hydration

CSS custom properties are set in a `useEffect`, so they are never set during SSR. The initial render always shows `--dock-left-width: 0px` and `--dock-right-width: 0px`. After hydration, the `useEffect` fires and sets the correct values from the Zustand store. This may cause a brief layout shift on first load if the user had widgets docked — this is acceptable and consistent with how `workspace-layout.ts` handles the same problem (it uses a boot script for the trading layout; the dock system does not need one since the dock zone is below the fold).

---

## Testing Strategy

### Unit Tests

Unit tests cover specific examples and edge cases:

- `DockShell` renders left slot, main content, and right slot in the correct order
- `DockSlot` renders `<Activity>` with `mode="visible"` for the active widget and `mode="hidden"` for others
- `WidgetDockControls` hides the "Dock left" button when `leftSlot === widgetId`
- `WidgetDockControls` hides the "Dock right" button when `rightSlot === widgetId`
- `WidgetDockControls` shows the undock button only when the widget is docked
- `WidgetDockControls` uses design-system `Tooltip` (not native `title` attribute)
- `DockResizeHandle` renders on the right edge for left-docked widgets and left edge for right-docked widgets
- Corrupt localStorage initializes store with default state (both slots null)
- Both dock slots occupied renders both widget panels and main content between them

### Property-Based Tests

Property tests use **fast-check** (already available in the TypeScript ecosystem and compatible with Vitest). Each test runs a minimum of 100 iterations.

Tests live in `tests/unit/dock-layout.test.ts`.

**Property test configuration:**

```typescript
// Feature: dockable-widgets, Property 1: Docking sets the correct slot
fc.assert(
  fc.property(
    fc.constantFrom("wallet-tracker", "activity", "watchlist"),
    fc.constantFrom("left", "right"),
    (id, side) => {
      const store = createTestStore();
      store.dockWidget(id, side);
      const slotKey = side === "left" ? "leftSlot" : "rightSlot";
      return store.getState()[slotKey] === id;
    }
  ),
  { numRuns: 100 }
);
```

Each property test is tagged with a comment referencing the design property:
```typescript
// Feature: dockable-widgets, Property N: <property text>
```

**Properties to implement as tests:**

| Test | Property | Library |
|---|---|---|
| Docking sets correct slot | Property 1 | fast-check |
| Slot exclusivity invariant | Property 2 | fast-check |
| Slot replacement | Property 3 | fast-check |
| Undock restores empty slot | Property 4 | fast-check |
| Width clamping invariant | Property 5 | fast-check |
| Width persistence round-trip | Property 6 | fast-check |
| Dock state persistence round-trip | Property 7 | fast-check |
| Corrupt storage falls back to default | Property 8 | fast-check (edge case generator) |
| Activity mode matches slot occupancy | Property 9 | fast-check |
| Dock icon visibility matches slot state | Property 10 | fast-check |
| CSS variables reflect slot state | Property 11 | fast-check |

**Store testing approach**: The Zustand store is tested in isolation by calling actions directly on a test store instance (using `create` with the same reducer logic but without the `persist` middleware for unit tests, and with a mock `localStorage` for persistence tests).

**Component testing approach**: `DockSlot` and `WidgetDockControls` are tested with React Testing Library, mocking the Zustand store via `useDockLayoutStore.setState(...)` before each test.

---

## File Structure

```
apps/web/src/
  stores/
    dock-layout.ts                          # Zustand store (new)
  components/layout/
    dock-shell.tsx                          # DockShell client component (new)
    dock-slot.tsx                           # DockSlot with Activity wrapper (new)
    dock-resize-handle.tsx                  # Resize drag handle (new)
  components/widgets/
    dock-icon-left.tsx                      # SVG dock-left icon (new)
    dock-icon-right.tsx                     # SVG dock-right icon (new)
    widget-dock-controls.tsx                # Dock icon buttons + tooltips (new)
```

Modifications to existing files:
- `components/layout/app-shell-router.tsx` — wrap `{children}` in `<DockShell>`, remove the `<main>` wrapper (moved into `DockShell`)
- `components/activity/activity-widget.tsx` — add `WidgetDockControls` to header bar
- `components/watchlist/watchlist-widget.tsx` — add `WidgetDockControls` to header bar
- `components/wallet-tracker/wallet-tracker-widget.tsx` — add `WidgetDockControls` to header bar

Each widget's content component (`ActivityWidgetContent`, `WatchlistWidgetContent`, `WalletTrackerContent`) is reused as-is inside the docked panel — no changes needed to the content layer.
