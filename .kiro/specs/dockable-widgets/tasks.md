# Implementation Plan: Dockable Widgets

## Overview

Implement a persistent side-panel dock system for the three floating widgets (Wallet Tracker, Activity, Watchlist). The implementation follows the existing `workspace-layout.ts` Zustand persist pattern, lives entirely inside the existing `AppShellRouter` client boundary, and uses React 19 `<Activity>` for widget continuity across navigations.

## Tasks

- [x] 1. Create the Zustand dock-layout store
  - Create `apps/web/src/stores/dock-layout.ts` with `useDockLayoutStore`
  - Export `DockableWidgetId`, `DockSide`, `DOCKABLE_WIDGET_IDS`, `DOCK_LAYOUT_STORAGE_KEY`, `DOCK_WIDTH_DEFAULT`, `DOCK_WIDTH_MIN`, `DOCK_WIDTH_MAX`, and `clampDockWidth`
  - Implement `dockWidget`, `undockWidget`, and `setWidth` actions following the reducer logic in the design
  - Wire `persist` middleware with `name: DOCK_LAYOUT_STORAGE_KEY`, `version: 1`, and `onRehydrateStorage` warning + `invalidateStorageCache` call (same pattern as `workspace-layout.ts`)
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.4, 4.2, 5.3, 5.4, 5.5, 8.1, 8.2, 8.3_

  - [ ]* 1.1 Write property test: Docking sets the correct slot
    - **Property 1: Docking sets the correct slot**
    - **Validates: Requirements 2.1, 2.2**
    - File: `tests/unit/dock-layout.test.ts`
    - Use `fc.constantFrom` for widget IDs and sides; assert `state[side + "Slot"] === id`

  - [ ]* 1.2 Write property test: Slot exclusivity invariant
    - **Property 2: Slot exclusivity invariant**
    - **Validates: Requirements 3.1, 3.2**
    - Generate arbitrary sequences of `dockWidget`/`undockWidget` calls; assert `leftSlot !== rightSlot || leftSlot === null`

  - [ ]* 1.3 Write property test: Slot replacement
    - **Property 3: Slot replacement**
    - **Validates: Requirements 3.4**
    - For any two distinct widget IDs A and B, dock A then dock B to the same side; assert slot contains B and A is absent from both slots

  - [ ]* 1.4 Write property test: Undock restores empty slot
    - **Property 4: Undock restores empty slot**
    - **Validates: Requirements 4.2**
    - Dock a widget then undock it; assert neither slot contains that widget ID

  - [ ]* 1.5 Write property test: Width clamping invariant
    - **Property 5: Width clamping invariant**
    - **Validates: Requirements 5.3, 5.4**
    - For any `fc.integer()` or `fc.float()` value passed to `setWidth`, assert `widths[id]` is in `[DOCK_WIDTH_MIN, DOCK_WIDTH_MAX]`

  - [ ]* 1.6 Write property test: Width persistence round-trip
    - **Property 6: Width persistence round-trip**
    - **Validates: Requirements 5.5, 8.1, 8.2**
    - Serialize store state to a mock localStorage, rehydrate a new store instance, assert `widths[id]` matches the clamped value

  - [ ]* 1.7 Write property test: Dock state persistence round-trip
    - **Property 7: Dock state persistence round-trip**
    - **Validates: Requirements 8.1, 8.2**
    - After arbitrary dock/undock operations, serialize and rehydrate; assert `leftSlot` and `rightSlot` are identical

  - [ ]* 1.8 Write property test: Corrupt storage falls back to default
    - **Property 8: Corrupt storage falls back to default**
    - **Validates: Requirements 8.3**
    - Use `fc.string()` for arbitrary corrupt localStorage values; assert store initializes with `leftSlot === null`, `rightSlot === null`, all widths `=== DOCK_WIDTH_DEFAULT`

- [x] 2. Create dock icon SVG components
  - Create `apps/web/src/components/widgets/dock-icon-left.tsx` — square outline with filled vertical bar on the left side; accepts standard SVG props
  - Create `apps/web/src/components/widgets/dock-icon-right.tsx` — mirror image of `DockIconLeft`
  - _Requirements: 1.1_

- [x] 3. Create `WidgetDockControls` component
  - Create `apps/web/src/components/widgets/widget-dock-controls.tsx` as a `"use client"` component
  - Read `leftSlot`, `rightSlot`, `dockWidget`, `undockWidget` from `useDockLayoutStore`
  - Render "Dock left" button (hidden when `leftSlot === widgetId`) using `DockIconLeft`, wrapped in design-system `Tooltip` with text "Dock left"
  - Render "Dock right" button (hidden when `rightSlot === widgetId`) using `DockIconRight`, wrapped in design-system `Tooltip` with text "Dock right"
  - Render "Undock" button visible only when widget is currently docked in either slot
  - Use `Button` variant `ghost` with `aria-label` on each button; no raw `<button>` elements
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 7.1, 7.2, 7.3, 7.4_

  - [ ]* 3.1 Write property test: Dock icon visibility matches slot state
    - **Property 10: Dock icon visibility matches slot state**
    - **Validates: Requirements 7.4**
    - Use React Testing Library; for any store state where `leftSlot === widgetId`, assert "Dock left" button is not in the document; symmetrically for right

- [x] 4. Create `DockResizeHandle` component
  - Create `apps/web/src/components/layout/dock-resize-handle.tsx` as a `"use client"` component
  - Implement `pointerdown` / `pointermove` / `pointerup` handlers with pointer capture
  - Wrap width state updates in `startTransition`; clamp to `[DOCK_WIDTH_MIN, DOCK_WIDTH_MAX]` during drag
  - Call `useDockLayoutStore.setWidth(widgetId, finalWidth)` on `pointerup` to persist
  - Render a 4px-wide drag target on the inner edge (right for left-docked, left for right-docked) with `cursor: ew-resize`
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 5. Create `DockSlot` component
  - Create `apps/web/src/components/layout/dock-slot.tsx` as a `"use client"` component
  - Render all three widget content components unconditionally, each in its own `<Activity>` wrapper
  - Set `mode="visible"` only for the widget matching `widgetId`; `mode="hidden"` for all others
  - Apply `width: var(--dock-left-width)` or `width: var(--dock-right-width)` via inline style; `flexShrink: 0`; `overflow: hidden`
  - Render `DockResizeHandle` on the inner edge when a widget is active
  - Render docked widget panel with `height: 100%`, header bar containing widget title + `WidgetDockControls`, scrollable content area, and `border-r` / `border-l` separator
  - _Requirements: 2.3, 2.4, 3.3, 5.1, 6.1, 6.2, 9.1, 9.4, 9.5, 9.6_

  - [ ]* 5.1 Write property test: Activity mode matches slot occupancy
    - **Property 9: Activity mode matches slot occupancy**
    - **Validates: Requirements 9.1, 9.4, 9.5, 9.6**
    - For any store state, assert each widget's `<Activity>` mode is `"visible"` iff its ID matches the slot value

- [x] 6. Create `DockShell` component and wire CSS variables
  - Create `apps/web/src/components/layout/dock-shell.tsx` as a `"use client"` component
  - Render a flex row: `<DockSlot side="left">`, `<main className={mainChrome}>`, `<DockSlot side="right">`
  - Implement `useEffect` that sets `--dock-left-width` and `--dock-right-width` on `document.documentElement` whenever `leftSlot`, `rightSlot`, or `widths` change (use `"0px"` when slot is null)
  - _Requirements: 2.3, 3.3, 6.1, 6.2, 6.3_

  - [ ]* 6.1 Write property test: CSS variables reflect slot state
    - **Property 11: CSS variables reflect slot state**
    - **Validates: Requirements 2.3**
    - For any store state, assert `--dock-left-width` is `"0px"` when `leftSlot` is null and `"${widths[leftSlot]}px"` when non-null; symmetrically for right

- [x] 7. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Integrate `DockShell` into `AppShellRouter`
  - Modify `apps/web/src/components/layout/app-shell-router.tsx`
  - Replace the existing `<main className={mainChrome}>{children}</main>` wrapper with `<DockShell>{children}</DockShell>`
  - Move the `mainChrome` class string into `DockShell`'s internal `<main>` element (do not duplicate it)
  - Verify `SiteHeader`, `WatchlistBar`, `DockShell`, and `BottomBar` render in the correct order
  - _Requirements: 2.3, 2.4, 6.1_

- [x] 9. Add `WidgetDockControls` to widget header bars
  - Modify `apps/web/src/components/activity/activity-widget.tsx` — add `<WidgetDockControls widgetId="activity" />` to the header bar
  - Modify `apps/web/src/components/watchlist/watchlist-widget.tsx` — add `<WidgetDockControls widgetId="watchlist" />` to the header bar
  - Modify `apps/web/src/components/wallet-tracker/wallet-tracker-widget.tsx` — add `<WidgetDockControls widgetId="wallet-tracker" />` to the header bar
  - _Requirements: 1.1, 7.1, 7.2, 7.3_

- [x] 10. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- All property tests live in `tests/unit/dock-layout.test.ts` using fast-check with `numRuns: 100`
- Each property test is tagged with a comment: `// Feature: dockable-widgets, Property N: <title>`
- `DockShell` must not introduce a new `"use client"` boundary above `AppShellRouter` — it lives inside it
- CSS custom properties are set client-side only (in `useEffect`); SSR always renders `0px` — this is intentional and consistent with `workspace-layout.ts`
- Widget content components (`ActivityWidgetContent`, `WatchlistWidgetContent`, `WalletTrackerContent`) are reused as-is inside docked panels; no changes to the content layer are needed
