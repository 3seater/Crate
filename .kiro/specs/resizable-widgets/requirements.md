# Requirements Document

## Introduction

Doji's bottom-bar widgets (Activity, Wallet Tracker, Watchlist) are floating panels that open from the bottom bar. Each widget currently has fixed dimensions with drag-to-move support via a GripVertical handle. Users cannot resize these widgets, which limits usability — some users want more screen real estate for data-heavy views like the Wallet Tracker table, while others prefer compact panels.

This feature adds edge and corner resize handles to all three widgets, allowing users to stretch them both horizontally and vertically. Each widget retains its existing minimum width constraint to prevent layout breakage, and maximum dimensions are bounded only by the viewport. The existing drag-to-move behavior is preserved unchanged.

## Glossary

- **Widget_Panel**: The floating `div` container (fixed, z-50) that houses a bottom-bar widget. Currently rendered by `ActivityWidget`, `WalletTrackerWidget`, and `WatchlistWidget`.
- **Resize_Handle**: An interactive hit area along the edges and corners of a Widget_Panel that the user can click-and-drag to change the panel's width and/or height.
- **Drag_Handle**: The existing GripVertical header button used to reposition the Widget_Panel on screen. Not part of this feature but must remain functional.
- **Minimum_Width**: The smallest allowed horizontal dimension for a Widget_Panel. Activity: 580px, Wallet Tracker: 800px, Watchlist: 800px.
- **Minimum_Height**: The smallest allowed vertical dimension for a Widget_Panel, ensuring the header and at least some content remain visible.
- **Viewport_Boundary**: The visible browser window area. Widget dimensions are capped so the panel does not extend beyond the viewport edges.
- **Widget_Size**: The current width and height of a Widget_Panel, stored as component state and applied via inline styles.

## Requirements

### Requirement 1: Edge Resize Handles

**User Story:** As a user, I want to drag the edges of a widget to resize it, so that I can adjust the panel dimensions to fit my workflow.

#### Acceptance Criteria

1. THE Widget_Panel SHALL render Resize_Handle areas along all four edges (top, right, bottom, left).
2. WHEN the user hovers over a horizontal edge Resize_Handle (top or bottom), THE Widget_Panel SHALL display a vertical resize cursor (`ns-resize`).
3. WHEN the user hovers over a vertical edge Resize_Handle (left or right), THE Widget_Panel SHALL display a horizontal resize cursor (`ew-resize`).
4. WHEN the user clicks and drags a horizontal edge Resize_Handle, THE Widget_Panel SHALL update its height in real time to follow the pointer position.
5. WHEN the user clicks and drags a vertical edge Resize_Handle, THE Widget_Panel SHALL update its width in real time to follow the pointer position.

### Requirement 2: Corner Resize Handles

**User Story:** As a user, I want to drag the corners of a widget to resize both dimensions at once, so that I can quickly adjust the panel to the exact size I need.

#### Acceptance Criteria

1. THE Widget_Panel SHALL render Resize_Handle areas at all four corners (top-left, top-right, bottom-left, bottom-right).
2. WHEN the user hovers over a corner Resize_Handle, THE Widget_Panel SHALL display a diagonal resize cursor (`nwse-resize` or `nesw-resize` as appropriate).
3. WHEN the user clicks and drags a corner Resize_Handle, THE Widget_Panel SHALL update both its width and height simultaneously in real time to follow the pointer position.

### Requirement 3: Minimum Size Constraints

**User Story:** As a user, I want the widget to enforce a minimum size so that the content does not collapse into an unusable state.

#### Acceptance Criteria

1. WHILE the user is resizing, THE Widget_Panel SHALL enforce a Minimum_Width of 580px for the Activity widget.
2. WHILE the user is resizing, THE Widget_Panel SHALL enforce a Minimum_Width of 800px for the Wallet Tracker widget.
3. WHILE the user is resizing, THE Widget_Panel SHALL enforce a Minimum_Width of 800px for the Watchlist widget.
4. WHILE the user is resizing, THE Widget_Panel SHALL enforce a Minimum_Height of 300px for all three widgets.
5. WHEN the user attempts to drag a Resize_Handle below the Minimum_Width or Minimum_Height, THE Widget_Panel SHALL clamp the dimension at the minimum value and stop shrinking.

### Requirement 4: Maximum Size Bounded by Viewport

**User Story:** As a user, I want the widget to grow as large as the viewport allows without overflowing off-screen, so that I can use the full available space.

#### Acceptance Criteria

1. WHILE the user is resizing, THE Widget_Panel SHALL limit its width so that the panel does not extend beyond the right edge of the Viewport_Boundary.
2. WHILE the user is resizing, THE Widget_Panel SHALL limit its height so that the panel does not extend beyond the bottom edge of the Viewport_Boundary (accounting for the 48px bottom bar).
3. WHEN the user resizes from the top or left edge, THE Widget_Panel SHALL adjust its position to keep the opposite edge anchored, and limit the dimension so the panel does not extend beyond the top or left edge of the Viewport_Boundary.

### Requirement 5: Resize Interaction Does Not Conflict with Drag

**User Story:** As a user, I want resizing and dragging to be distinct interactions so that I do not accidentally move the widget when I intend to resize it, or vice versa.

#### Acceptance Criteria

1. WHEN the user initiates a resize by clicking a Resize_Handle, THE Widget_Panel SHALL update only its dimensions and not its position (except for top/left edge resizing where position adjustment is required to anchor the opposite edge).
2. WHEN the user initiates a drag via the Drag_Handle, THE Widget_Panel SHALL update only its position and not its dimensions.
3. WHILE the user is resizing, THE Widget_Panel SHALL apply `select-none` to prevent text selection during the drag operation.
4. WHILE the user is resizing, THE Widget_Panel SHALL apply `pointer-events-none` to an overlay or iframe guard to prevent child elements from capturing pointer events.

### Requirement 6: Content Adapts to Resized Dimensions

**User Story:** As a user, I want the widget content to fill the available space when I resize, so that tables and lists use the extra room or gracefully shrink.

#### Acceptance Criteria

1. THE Widget_Panel content area SHALL use flex layout so that the content expands to fill the available height when the widget is made taller.
2. THE Widget_Panel content area SHALL allow horizontal scrolling for table content when the widget width is reduced below the table's natural width.
3. WHEN the widget is resized, THE Widget_Panel content area SHALL reflow without layout breakage or overlapping elements.

### Requirement 7: Consistent Resize Behavior Across All Three Widgets

**User Story:** As a developer, I want the resize logic to be shared across all three widgets, so that behavior is consistent and maintenance is centralized.

#### Acceptance Criteria

1. THE Activity Widget, Wallet Tracker Widget, and Watchlist Widget SHALL use the same resize implementation (shared hook or component).
2. THE shared resize implementation SHALL accept per-widget configuration for Minimum_Width, Minimum_Height, and default dimensions.
3. WHEN a resize interaction completes (mouse up), THE Widget_Panel SHALL commit the final Widget_Size to component state.

### Requirement 8: Keyboard Escape Closes During Resize

**User Story:** As a user, I want to be able to cancel or close the widget with Escape even while resizing, so that I maintain control of the interface.

#### Acceptance Criteria

1. WHEN the user presses the Escape key while a resize is in progress, THE Widget_Panel SHALL cancel the resize operation and close the widget.
2. WHEN the resize is cancelled via Escape, THE Widget_Panel SHALL revert to the dimensions it had before the resize began.
