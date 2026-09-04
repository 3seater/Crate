# Implementation Plan: Resizable Widgets

## Overview

Add edge and corner resize handles to the three bottom-bar floating widgets (Activity, Wallet Tracker, Watchlist) via a shared `useWidgetResize` hook. Pure functions (`clampSize`, `computeResize`) handle dimension math and are directly testable. Each widget replaces its inline drag logic with the shared hook, gaining resize capability with per-widget min/default configuration.

## Tasks

- [ ] 1. Implement shared resize hook and pure functions
  - [ ] 1.1 Create `apps/web/src/hooks/use-widget-resize.ts` with pure `clampSize` and `computeResize` functions
    - Export `clampSize(proposed, config, viewport)` enforcing min width/height, viewport max, and non-negative position
    - Export `computeResize(direction, startSize, startPosition, delta, config, viewport)` computing new size/position per direction then clamping
    - Include `ResizeDirection`, `WidgetSize`, `WidgetPosition`, `UseWidgetResizeConfig` type exports
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3_

  - [ ]* 1.2 Write property test: clamp invariant (Property 1)
    - **Property 1: Clamp invariant — output always satisfies min and viewport constraints**
    - Generate random config, viewport, position, and proposed size; verify all six constraints hold on `clampSize` output
    - Test file: `tests/unit/resizable-widgets.property.test.ts`
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3**

  - [ ]* 1.3 Write property test: resize dimension follows pointer delta (Property 2)
    - **Property 2: Resize dimension follows pointer delta within clamped bounds**
    - Generate random direction, start state, and delta; verify `computeResize` output matches expected clamped delta
    - Test file: `tests/unit/resizable-widgets.property.test.ts`
    - **Validates: Requirements 1.4, 1.5, 2.3**

  - [ ]* 1.4 Write property test: right/bottom edge resize preserves position (Property 3)
    - **Property 3: Right/bottom edge resize preserves position**
    - Generate right or bottom direction, start state, and delta; verify position unchanged
    - Test file: `tests/unit/resizable-widgets.property.test.ts`
    - **Validates: Requirements 5.1**

  - [ ]* 1.5 Write property test: top/left edge resize anchors opposite edge (Property 4)
    - **Property 4: Top/left edge resize anchors the opposite edge**
    - Generate top or left direction, start state, and delta; verify opposite edge (y+height or x+width) remains constant
    - Test file: `tests/unit/resizable-widgets.property.test.ts`
    - **Validates: Requirements 4.3, 5.1**

  - [ ]* 1.6 Write property test: drag preserves widget size (Property 5)
    - **Property 5: Drag preserves widget size**
    - Generate start size and drag delta; verify size unchanged after drag
    - Test file: `tests/unit/resizable-widgets.property.test.ts`
    - **Validates: Requirements 5.2**

  - [ ]* 1.7 Write property test: Escape during resize reverts dimensions (Property 6)
    - **Property 6: Escape during resize reverts to pre-resize dimensions**
    - Generate start size and resize delta; simulate Escape; verify size reverts exactly
    - Test file: `tests/unit/resizable-widgets.property.test.ts`
    - **Validates: Requirements 8.2**

- [ ] 2. Implement `useWidgetResize` hook with resize handles and drag logic
  - [ ] 2.1 Implement the `useWidgetResize` hook in `apps/web/src/hooks/use-widget-resize.ts`
    - Accept `UseWidgetResizeConfig` (minWidth, minHeight, defaultWidth, defaultHeight, bottomBarHeight)
    - Return `{ size, position, isResizing, isDragging, panelRef, dragHandleProps, renderResizeHandles, resetPosition }`
    - Manage resize state in a `useRef<ResizeState>` to avoid re-renders during drag
    - Track pointer via `mousemove`/`mouseup` on `window` with RAF batching
    - Call `computeResize` on each RAF tick to update committed `size` and `position` state
    - On `mouseup`, commit final size/position and clear resize tracking
    - _Requirements: 1.4, 1.5, 2.3, 7.1, 7.2, 7.3_

  - [ ] 2.2 Implement `renderResizeHandles` returning edge and corner handle divs
    - 4 edge handles: absolutely-positioned divs, 6px thick, full edge length, cursors `ns-resize` / `ew-resize`
    - 4 corner handles: 12×12px absolutely-positioned divs, cursors `nwse-resize` / `nesw-resize`
    - All handles `z-10`, `onMouseDown` sets resize direction in hook state
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2_

  - [ ] 2.3 Implement Escape key handling during resize
    - Listen for `keydown` Escape while `isResizing` is true
    - Revert size and position to `startSize` / `startPosition` from `ResizeState` ref
    - Call `onClose` callback after reverting
    - Clean up window listeners and cancel pending RAF on Escape
    - _Requirements: 8.1, 8.2_

  - [ ] 2.4 Implement interaction guards during resize
    - Apply `select-none` class to panel when `isResizing` is true
    - Apply `pointer-events-none` overlay to prevent child elements from capturing pointer events during resize
    - _Requirements: 5.3, 5.4_

  - [ ] 2.5 Implement drag-to-move logic within the shared hook
    - Port existing drag logic from widgets into the hook (RAF-based pointer tracking, position clamping)
    - Return `dragHandleProps` with `onMouseDown` handler for the GripVertical button
    - Ensure drag only updates position, never dimensions
    - Provide `resetPosition` to center widget on open
    - _Requirements: 5.1, 5.2, 7.1_

- [ ] 3. Checkpoint - Verify shared hook
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Integrate shared hook into widget components
  - [ ] 4.1 Integrate `useWidgetResize` into `ActivityWidget`
    - Replace inline drag logic and fixed `WIDTH`/`HEIGHT` constants in `apps/web/src/components/activity/activity-widget.tsx`
    - Call `useWidgetResize({ minWidth: 580, minHeight: 300, defaultWidth: 760, defaultHeight: 680 })`
    - Use `size`, `position`, `panelRef`, `dragHandleProps`, `renderResizeHandles`, `isResizing`, `isDragging` from hook
    - Apply `size.width` and `size.height` as inline styles; remove old `WIDTH`/`MIN_WIDTH`/`MAX_WIDTH`/`HEIGHT` constants
    - Call `resetPosition()` when widget opens
    - Render `renderResizeHandles()` inside the panel div
    - Ensure content area uses `min-h-0 flex-1 overflow-auto` for flex adaptation
    - _Requirements: 1.1, 2.1, 6.1, 6.2, 6.3, 7.1, 7.2_

  - [ ] 4.2 Integrate `useWidgetResize` into `WalletTrackerWidget`
    - Replace inline drag logic and fixed dimensions in `apps/web/src/components/wallet-tracker/wallet-tracker-widget.tsx`
    - Call `useWidgetResize({ minWidth: 800, minHeight: 300, defaultWidth: 1100, defaultHeight: 650 })`
    - Same integration pattern as ActivityWidget
    - _Requirements: 1.1, 2.1, 6.1, 6.2, 6.3, 7.1, 7.2_

  - [ ] 4.3 Integrate `useWidgetResize` into `WatchlistWidget`
    - Replace inline drag logic and fixed dimensions in `apps/web/src/components/watchlist/watchlist-widget.tsx`
    - Call `useWidgetResize({ minWidth: 800, minHeight: 300, defaultWidth: 1100, defaultHeight: 650 })`
    - Same integration pattern as ActivityWidget
    - _Requirements: 1.1, 2.1, 6.1, 6.2, 6.3, 7.1, 7.2_

  - [ ]* 4.4 Write unit tests for widget integration
    - Verify each widget renders 4 edge handles + 4 corner handles (validates 1.1, 2.1)
    - Verify cursor styles on edge handles (`ns-resize`, `ew-resize`) and corner handles (`nwse-resize`, `nesw-resize`) (validates 1.2, 1.3, 2.2)
    - Verify `select-none` class applied during resize (validates 5.3)
    - Verify pointer-events guard applied during resize (validates 5.4)
    - Verify Escape during resize triggers close callback (validates 8.1)
    - Edge case: resize at exact minimum dimensions — verify no change
    - Edge case: resize at viewport boundary — verify clamping
    - Edge case: widget at (0, 0) with top/left resize — verify position doesn't go negative
    - Test file: `tests/unit/resizable-widgets.test.ts`
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 5.3, 5.4, 8.1_

- [ ] 5. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The `clampSize` and `computeResize` pure functions are exported for direct testing without DOM or React rendering
