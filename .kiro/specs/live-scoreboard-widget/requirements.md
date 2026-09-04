# Requirements Document

## Introduction

Replace the current inline `Scoreboard` component in the trading terminal header with a three-tier interaction model: a compact "LIVE" pill, a rich hover tooltip, and a draggable pop-out widget. The current scoreboard takes up significant horizontal space in the header and can cause layout issues on smaller viewports. The new model provides progressive disclosure — minimal space by default (pill), full detail on hover (tooltip), and persistent visibility on demand (widget). All three tiers consume the same `useMarketSportsData` hook data and reuse existing utilities (`parseScore`, `formatPeriod`, `getTeamImage`, `ImageWithFallback`).

## Glossary

- **Live_Pill**: A compact inline element in the Trading_Header that displays "● LIVE" with an animated ping dot when a sports game is in progress, or "FINAL" when the game has ended. Replaces the current full `Scoreboard` component in the header layout.
- **Scoreboard_Tooltip**: A rich tooltip that appears on hover over the Live_Pill, displaying team logos (40–48px), full team names, a large score display, and a game status line. Uses the design system `Tooltip`/`TooltipContent`/`TooltipTrigger` from `@/shared/components/ui/tooltip`.
- **Popout_Widget**: A floating, draggable panel (~300px wide) that displays the same rich scoreboard content as the Scoreboard_Tooltip. Rendered via a React portal, positioned above other content, and dismissible via a close button.
- **Trading_Header**: The `MarketHeaderTrading` component — the top bar of the trading terminal page containing the market name pill, stats, watchlist star, rewards badge, and Polymarket external link.
- **Score_Parser**: The existing `parseScore` utility that converts raw Sports WebSocket score strings into structured `{ home, away }` objects.
- **Period_Formatter**: The existing `formatPeriod` utility that converts raw period/status/elapsed/live/ended fields into a human-readable game status string.
- **Sports_Data_Hook**: The existing `useMarketSportsData` hook that detects sports matchup markets, extracts team names/abbreviations, and provides real-time WebSocket score data as `ScoreboardProps`.
- **Widget_Position_Store**: Session-scoped state (Zustand or React state) that remembers the draggable widget's x/y position and open/closed state during the browser session.
- **Team_Logo**: An image resolved from sibling market images via `getTeamImage`, displayed using `ImageWithFallback` with the team abbreviation as fallback.

## Requirements

### Requirement 1: Compact Live Pill

**User Story:** As a trader viewing a sports market, I want a tiny status pill in the trading header that tells me the game is live or final without taking up much space, so that the header layout remains clean and I still have at-a-glance game awareness.

#### Acceptance Criteria

1. WHEN a sports market is loaded in the trading terminal AND Sports_Data_Hook returns data with `live: true` AND `ended !== true`, THE Trading_Header SHALL display a Live_Pill containing an animated ping dot and the text "LIVE".
2. WHEN a sports market is loaded in the trading terminal AND Sports_Data_Hook returns data with `ended: true` OR the `status` field is a member of ENDED_STATUSES, THE Trading_Header SHALL display a Live_Pill containing the text "FINAL" without an animated ping dot.
3. WHEN Sports_Data_Hook returns data but the game is neither live nor ended (e.g., scheduled, not started), THE Trading_Header SHALL NOT display the Live_Pill.
4. WHEN Sports_Data_Hook returns null (non-sports market or no data available), THE Trading_Header SHALL NOT display the Live_Pill.
5. THE Live_Pill SHALL use `text-xs` typography, `text-red-500` color for the "LIVE" state, and `text-text-secondary` color for the "FINAL" state, consistent with the project design system.
6. THE Live_Pill SHALL occupy minimal horizontal space — only the ping dot and status text — and SHALL NOT cause the Trading_Header to overflow or wrap on viewports 1024px and wider.
7. THE Live_Pill SHALL replace the current inline `Scoreboard` component in the Trading_Header; the full inline scoreboard SHALL no longer render in the header.

### Requirement 2: Rich Hover Tooltip

**User Story:** As a trader, I want to hover over the LIVE pill to see a detailed scoreboard with team logos, full names, and the current score, so that I can get full game context without navigating away.

#### Acceptance Criteria

1. WHEN the user hovers over the Live_Pill, THE Scoreboard_Tooltip SHALL appear showing the full scoreboard content.
2. THE Scoreboard_Tooltip SHALL display the home team logo at 40–48px size, the home team full name (not abbreviation), the formatted score in `text-lg` typography (e.g., "0 - 1"), the away team full name, and the away team logo at 40–48px size.
3. THE Scoreboard_Tooltip SHALL display a game status line below the score showing the Period_Formatter output (e.g., "LIVE · Game 2 · Best of 3", "LIVE · Q4 - 08:42", "FINAL").
4. WHEN the game is live, THE Scoreboard_Tooltip game status line SHALL include an animated ping dot before the "LIVE" text, matching the Live_Pill indicator style.
5. THE Scoreboard_Tooltip SHALL include a "Pop out" button in the bottom-right area of the tooltip content.
6. WHEN the user clicks the "Pop out" button, THE Scoreboard_Tooltip SHALL close AND the Popout_Widget SHALL open at a default position on screen.
7. THE Scoreboard_Tooltip SHALL use the design system `Tooltip`, `TooltipTrigger`, and `TooltipContent` components from `@/shared/components/ui/tooltip`, with custom `className` overrides for the wider layout.
8. IF a team logo image fails to load, THEN THE Scoreboard_Tooltip SHALL display the `ImageWithFallback` component with the team abbreviation as the fallback character.
9. WHEN the team full name is unavailable from Sports_Data_Hook, THE Scoreboard_Tooltip SHALL fall back to displaying the team abbreviation.
10. THE Scoreboard_Tooltip content SHALL update in real time as new Sports WebSocket messages arrive, without the tooltip closing or flickering.

### Requirement 3: Draggable Pop-Out Widget

**User Story:** As a trader, I want to pop out the scoreboard into a floating widget that I can drag anywhere on screen, so that I can keep the live score visible while interacting with the orderbook and charts.

#### Acceptance Criteria

1. WHEN the user clicks the "Pop out" button in the Scoreboard_Tooltip, THE Popout_Widget SHALL appear as a floating panel rendered via a React portal outside the Trading_Header DOM tree.
2. THE Popout_Widget SHALL display the same content as the Scoreboard_Tooltip: team logos (40–48px), full team names, large score display, and game status line.
3. THE Popout_Widget SHALL be approximately 300px wide with a dark background matching the app theme (using `bg-card` and `border-border` design tokens).
4. THE Popout_Widget SHALL be draggable by its header area to any position on the screen using pointer events (mousedown/mousemove/mouseup and touch equivalents).
5. THE Popout_Widget SHALL render at a z-index above the trading terminal content but below modal dialogs (using a z-index value between the app content and the tooltip z-index of 10050).
6. THE Popout_Widget SHALL include a close button (X icon) in the top-right corner that, when clicked, dismisses the widget and returns the Live_Pill to its default hover-for-tooltip behavior.
7. THE Popout_Widget content SHALL update in real time as new Sports WebSocket messages arrive, without interrupting drag state or position.
8. THE Popout_Widget SHALL be constrained to remain within the visible viewport boundaries — dragging SHALL NOT move the widget fully off-screen.

### Requirement 4: Widget Position Persistence

**User Story:** As a trader, I want the pop-out widget to remember its position and open state during my session, so that I don't have to reposition it every time I switch between markets.

#### Acceptance Criteria

1. WHEN the user drags the Popout_Widget to a new position, THE Widget_Position_Store SHALL save the x/y coordinates in session-scoped state.
2. WHEN the user navigates to a different market within the same sports event (same game) AND the Popout_Widget was open, THE Popout_Widget SHALL remain open at the same position.
3. WHEN the user navigates to a market for a different sports event AND the Popout_Widget was open, THE Popout_Widget SHALL close automatically and the Live_Pill SHALL return to default behavior.
4. WHEN the user closes the Popout_Widget via the close button, THE Widget_Position_Store SHALL clear the open state so the widget does not reappear on navigation.
5. THE Widget_Position_Store SHALL use session-scoped storage (React state or Zustand store without persistence) so that widget state resets when the browser tab is closed.

### Requirement 5: Transition Between States

**User Story:** As a trader, I want smooth transitions between the pill, tooltip, and widget states, so that the interaction feels polished and predictable.

#### Acceptance Criteria

1. WHEN the Popout_Widget is open, THE Live_Pill SHALL still be visible in the Trading_Header but hovering over the Live_Pill SHALL NOT show the Scoreboard_Tooltip (tooltip is suppressed while widget is open).
2. WHEN the Popout_Widget is closed via the close button, THE Live_Pill SHALL resume its default behavior where hovering shows the Scoreboard_Tooltip.
3. WHEN the game transitions from live to ended (Sports WebSocket sends `ended: true` or status becomes a member of ENDED_STATUSES), THE Live_Pill SHALL update from "● LIVE" to "FINAL", THE Scoreboard_Tooltip SHALL update the status line to "FINAL", AND THE Popout_Widget (if open) SHALL update the status line to "FINAL" — all without requiring user interaction.
4. WHEN Sports_Data_Hook returns null after previously returning data (e.g., WebSocket disconnects), THE Live_Pill SHALL be hidden, THE Scoreboard_Tooltip SHALL not be accessible, AND THE Popout_Widget (if open) SHALL close automatically.

### Requirement 6: Accessibility

**User Story:** As a user who relies on assistive technology, I want the scoreboard pill, tooltip, and widget to be accessible, so that I can understand game status and interact with the pop-out controls using a keyboard and screen reader.

#### Acceptance Criteria

1. THE Live_Pill SHALL have an `aria-label` describing the current game state (e.g., "Live game: Team A 2 - Team B 1, Q4 08:42" or "Game ended: Team A 2 - Team B 1, Final").
2. THE Scoreboard_Tooltip SHALL be accessible via keyboard focus on the Live_Pill trigger element, following the design system Tooltip keyboard behavior.
3. THE "Pop out" button in the Scoreboard_Tooltip SHALL be a `Button` component from the design system with an accessible label "Pop out scoreboard".
4. THE Popout_Widget close button SHALL be a `Button` component from the design system with an accessible label "Close scoreboard widget".
5. THE Popout_Widget SHALL have `role="dialog"` and an `aria-label` describing its content (e.g., "Live scoreboard: Team A vs Team B").
6. THE animated ping dot on the Live_Pill SHALL be marked with `aria-hidden="true"` so screen readers do not announce the decorative animation.

### Requirement 7: Shared Scoreboard Content Component

**User Story:** As a developer, I want a single reusable component for the rich scoreboard layout (logos, names, score, status), so that the tooltip and widget display identical content without duplication.

#### Acceptance Criteria

1. THE Scoreboard_Tooltip and Popout_Widget SHALL both render a shared `ScoreboardContent` component that accepts team names, abbreviations, score, period/status data, logo URLs, and live/ended state as props.
2. THE `ScoreboardContent` component SHALL use `ImageWithFallback` for team logos with a size of 40–48px and the team abbreviation as fallback.
3. THE `ScoreboardContent` component SHALL display the formatted score using `text-lg` typography and `text-text-primary` color.
4. THE `ScoreboardContent` component SHALL display the game status line using `text-xs` typography, with `text-red-500` for live status and `text-text-secondary` for non-live status.
5. FOR ALL valid combinations of score, period, and live/ended state, THE `ScoreboardContent` component SHALL render without errors and display the available data gracefully (same partial-data handling as the existing Scoreboard component).

