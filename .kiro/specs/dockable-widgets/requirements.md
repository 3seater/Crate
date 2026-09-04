# Requirements Document

## Introduction

The dockable widget panel system allows users of the Doji trading UI to dock floating widgets (Wallet Tracker, Activity, and Watchlist) to the left or right side of the main content area. When docked, a widget pushes the main page content horizontally to accommodate it rather than overlapping. Users can resize docked widgets and have up to two widgets docked simultaneously — one on each side. The dock zone spans the area below the WatchlistBar and above the footer.

## Glossary

- **Dock_System**: The overall system managing widget docking state, layout adjustments, and resize behavior.
- **Dockable_Widget**: One of the three widgets that can be docked: Wallet Tracker, Activity, or Watchlist.
- **Dock_Zone**: The vertical region of the page below the WatchlistBar and above the footer where docked widgets are rendered.
- **Dock_Slot**: A positional slot on either the left or right side of the Dock_Zone that holds at most one Dockable_Widget at a time.
- **Dock_Handle**: The resize handle on a docked widget that allows horizontal resizing.
- **Dock_Icon**: One of two icons displayed in a widget's header bar — one for "Dock left" and one for "Dock right".
- **Main_Content**: The primary page content area that is pushed horizontally when a widget is docked.
- **Widget_Bar**: The header bar at the top of each Dockable_Widget containing the Dock_Icons and other controls.

## Requirements

### Requirement 1: Dock Icons on Widget Bar

**User Story:** As a trader, I want dock icons on each widget's header bar, so that I can quickly dock a widget to either side of the screen.

#### Acceptance Criteria

1. THE Dock_System SHALL render two Dock_Icons in the Widget_Bar of each Dockable_Widget: one representing "Dock left" (a square icon with a vertical bar on the left side) and one representing "Dock right" (a square icon with a vertical bar on the right side).
2. WHEN a user hovers over the "Dock left" Dock_Icon, THE Dock_System SHALL display a tooltip with the text "Dock left".
3. WHEN a user hovers over the "Dock right" Dock_Icon, THE Dock_System SHALL display a tooltip with the text "Dock right".
4. THE Dock_System SHALL render Dock_Icons using the design-system `Tooltip` component, not the native HTML `title` attribute.

---

### Requirement 2: Docking a Widget

**User Story:** As a trader, I want to dock a widget to the left or right side of the screen, so that I can keep it visible while I trade without it covering the main content.

#### Acceptance Criteria

1. WHEN a user clicks the "Dock left" Dock_Icon on a Dockable_Widget, THE Dock_System SHALL move that widget into the left Dock_Slot within the Dock_Zone.
2. WHEN a user clicks the "Dock right" Dock_Icon on a Dockable_Widget, THE Dock_System SHALL move that widget into the right Dock_Slot within the Dock_Zone.
3. WHEN a Dockable_Widget is placed into a Dock_Slot, THE Dock_System SHALL push the Main_Content horizontally to accommodate the docked widget's width, without overlapping the Main_Content.
4. WHEN a Dockable_Widget is docked, THE Dock_System SHALL render the widget within the Dock_Zone (below the WatchlistBar and above the footer).

---

### Requirement 3: Simultaneous Dual Docking

**User Story:** As a trader, I want to dock one widget on the left and one on the right at the same time, so that I can monitor multiple data sources alongside the main content.

#### Acceptance Criteria

1. THE Dock_System SHALL allow at most one Dockable_Widget to occupy the left Dock_Slot at any time.
2. THE Dock_System SHALL allow at most one Dockable_Widget to occupy the right Dock_Slot at any time.
3. WHEN a Dockable_Widget is docked to the left Dock_Slot and a different Dockable_Widget is docked to the right Dock_Slot, THE Dock_System SHALL display both widgets simultaneously with the Main_Content between them.
4. WHEN a user attempts to dock a Dockable_Widget to a Dock_Slot that is already occupied, THE Dock_System SHALL replace the currently docked widget in that slot with the newly docked widget.

---

### Requirement 4: Undocking a Widget

**User Story:** As a trader, I want to undock a widget, so that I can restore the full-width main content area.

#### Acceptance Criteria

1. WHEN a Dockable_Widget is docked, THE Dock_System SHALL provide a visible control within the widget to undock it.
2. WHEN a user activates the undock control on a docked Dockable_Widget, THE Dock_System SHALL remove the widget from its Dock_Slot and restore the Main_Content to its previous width.

---

### Requirement 5: Horizontal Resizing of Docked Widgets

**User Story:** As a trader, I want to resize a docked widget horizontally, so that I can control how much screen space it occupies.

#### Acceptance Criteria

1. WHEN a Dockable_Widget is docked, THE Dock_System SHALL render a Dock_Handle on the inner edge of the docked widget (right edge for left-docked, left edge for right-docked) that the user can drag to resize.
2. WHEN a user drags the Dock_Handle, THE Dock_System SHALL update the docked widget's width in real time and simultaneously adjust the Main_Content width to fill the remaining space.
3. THE Dock_System SHALL enforce a minimum width of 280px for any docked Dockable_Widget.
4. THE Dock_System SHALL enforce a maximum width of 480px for any docked Dockable_Widget.
5. WHEN a user releases the Dock_Handle, THE Dock_System SHALL persist the chosen width for that widget so it is restored on subsequent docks of the same widget.

---

### Requirement 6: Dock Zone Boundaries

**User Story:** As a trader, I want docked widgets to be constrained to the correct vertical region, so that they do not obscure the navigation header, watchlist bar, or footer.

#### Acceptance Criteria

1. THE Dock_System SHALL render all docked Dockable_Widgets exclusively within the Dock_Zone (the vertical region below the WatchlistBar and above the footer).
2. WHILE a Dockable_Widget is docked, THE Dock_System SHALL size the widget's height to fill the full height of the Dock_Zone.
3. WHEN the Dock_Zone height changes (e.g. browser resize), THE Dock_System SHALL update the docked widget's height to match the new Dock_Zone height.

---

### Requirement 7: Eligible Widgets

**User Story:** As a trader, I want the Wallet Tracker, Activity, and Watchlist widgets to be dockable, so that the tools I use most during trading are available as docked panels.

#### Acceptance Criteria

1. THE Dock_System SHALL support docking for the Wallet Tracker widget.
2. THE Dock_System SHALL support docking for the Activity widget.
3. THE Dock_System SHALL support docking for the Watchlist widget.
4. WHEN a Dockable_Widget is docked, THE Dock_System SHALL hide the Dock_Icons for the side that widget is currently occupying (a widget already docked left SHALL NOT show the "Dock left" icon).

---

### Requirement 8: Dock State Persistence

**User Story:** As a trader, I want my docked widget configuration to be remembered across page navigations, so that I do not have to re-dock widgets every time I navigate.

#### Acceptance Criteria

1. WHEN a user docks or undocks a Dockable_Widget, THE Dock_System SHALL persist the updated dock state (which widget is in which slot) to localStorage.
2. WHEN the application loads, THE Dock_System SHALL restore the previously persisted dock state, re-docking any widgets that were docked in the previous session.
3. IF persisted dock state is corrupt or unreadable, THEN THE Dock_System SHALL fall back to the default state of no widgets docked and log a warning.

---

### Requirement 9: Widget Continuity During Client-Side Navigation

**User Story:** As a trader, I want docked widgets to remain mounted and interactive while I navigate between pages, so that I do not lose widget state or experience layout flicker when moving around the app.

#### Acceptance Criteria

1. WHEN a user navigates to a different route via client-side navigation, THE Dock_System SHALL keep all currently docked Dockable_Widgets mounted and visible without unmounting or remounting them.
2. WHEN a user navigates to a different route, THE Dock_System SHALL render the incoming page content in the Main_Content area without affecting the mounted state of any docked Dockable_Widget.
3. WHILE a Dockable_Widget is docked and a client-side navigation occurs, THE Dock_System SHALL preserve each widget's internal state, including scroll position, loaded data, and resize width.
4. THE Dock_System SHALL implement widget continuity using the React 19 `<Activity>` component pattern, wrapping docked widget slots so their DOM and React state are preserved across navigation rather than destroyed and recreated.
5. WHEN a Dockable_Widget transitions from docked to undocked during navigation, THE Dock_System SHALL set the corresponding `<Activity>` mode to `"hidden"` to suspend the widget without unmounting it.
6. WHEN a Dockable_Widget is docked, THE Dock_System SHALL set the corresponding `<Activity>` mode to `"visible"` so the widget is active and interactive.
