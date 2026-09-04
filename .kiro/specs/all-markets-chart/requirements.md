# Requirements Document

## Introduction

The "All Markets" multi-line chart mode allows users to view price history for multiple outcomes within a single Polymarket event simultaneously. When activated from the market selector dropdown, the chart switches from a single-market OHLC/line view to a multi-line overlay showing the top outcomes by price, with color-coded legends, a hover tooltip card, and the ability to add or remove individual markets from the view.

## Glossary

- **Chart**: The KLineChart v10 instance (`PolymarketKLineChartInner`) that renders price data within the trading terminal.
- **Toolbar**: The top bar and left rail UI surrounding the Chart, providing controls for timeframe, chart type, drawing tools, screenshot, and fullscreen.
- **Market_Selector**: The `MarketSelectDropdown` component used to switch between individual markets within a GMP event.
- **All_Markets_Mode**: The chart state in which multiple outcome lines are rendered simultaneously instead of a single-market OHLC view.
- **Visible_Markets**: The subset of event markets currently rendered as lines on the Chart while in All_Markets_Mode. Defaults to the top 4 markets by Yes price.
- **Legend_Bar**: A row of color-coded items displayed in the Toolbar top bar during All_Markets_Mode, each showing a colored dot, market name, and current price.
- **Hover_Tooltip**: A floating card displayed on mouse hover over the Chart during All_Markets_Mode, showing the price and date for each Visible_Market at the hovered timestamp.
- **Event**: A collection of related markets (GMP) grouped under a common topic in Polymarket.
- **SelectorMarket**: The prepared market data structure used by the Market_Selector, containing conditionId, market data, and inactive status.

## Requirements

### Requirement 1: All Markets Dropdown Option

**User Story:** As a trader, I want an "All Markets" option at the top of the market selector dropdown, so that I can quickly switch to viewing all outcomes on a single chart.

#### Acceptance Criteria

1. WHEN the Market_Selector renders for a GMP event with 2 or more markets, THE Market_Selector SHALL display an "All Markets" row as the first item above all individual market rows.
2. THE "All Markets" row SHALL have a visually distinct appearance from normal market rows, using a smaller row height or differentiated styling to indicate it is a mode toggle rather than a market selection.
3. WHEN the user selects the "All Markets" row, THE Market_Selector SHALL activate All_Markets_Mode on the Chart.
4. WHILE All_Markets_Mode is active, THE Market_Selector SHALL display "All Markets" as the selected value in the trigger.
5. WHEN the user selects an individual market row while All_Markets_Mode is active, THE Chart SHALL exit All_Markets_Mode and return to single-market view for the selected market.

### Requirement 2: Multi-Line Chart Rendering

**User Story:** As a trader, I want to see price lines for multiple outcomes overlaid on a single chart, so that I can compare outcome prices over time.

#### Acceptance Criteria

1. WHEN All_Markets_Mode is activated, THE Chart SHALL fetch price history for all active markets in the event and render each Visible_Market as a separate line on the same time axis.
2. THE Chart SHALL default to showing the top 4 markets by current Yes price as the initial Visible_Markets.
3. THE Chart SHALL assign a distinct random color to each Visible_Market line.
4. WHEN All_Markets_Mode is activated, THE Chart SHALL fit all available price data within the visible chart area so no data is clipped off-screen.
5. THE Chart SHALL render lines using the line (area) display type, not OHLC candles, while in All_Markets_Mode.
6. IF the event has fewer than 4 active markets, THEN THE Chart SHALL display all active markets as Visible_Markets.

### Requirement 3: Chart Interaction Constraints

**User Story:** As a trader, I want a simplified chart interaction model in All Markets mode, so that the multi-line view remains readable without accidental distortion.

#### Acceptance Criteria

1. WHILE All_Markets_Mode is active, THE Chart SHALL disable vertical Y-axis dragging (no vertical stretching or scaling by the user).
2. WHILE All_Markets_Mode is active, THE Chart SHALL allow horizontal panning (left and right) via mouse drag.
3. WHILE All_Markets_Mode is active, THE Chart SHALL allow zooming in and out via scroll wheel or pinch gesture.
4. WHILE All_Markets_Mode is active, THE Toolbar SHALL hide the left rail (drawing tools sidebar).
5. WHILE All_Markets_Mode is active, THE Toolbar SHALL hide the timeframe selection buttons from the top bar.
6. WHILE All_Markets_Mode is active, THE Toolbar SHALL hide the chart type picker from the top bar.
7. WHILE All_Markets_Mode is active, THE Toolbar SHALL continue to display the screenshot and fullscreen buttons in the top bar.

### Requirement 4: Legend Bar

**User Story:** As a trader, I want a color-coded legend in the top bar showing each visible outcome's name and price, so that I can identify which line belongs to which market.

#### Acceptance Criteria

1. WHILE All_Markets_Mode is active, THE Toolbar top bar SHALL display a Legend_Bar containing one item per Visible_Market.
2. THE Legend_Bar SHALL render each item as a colored dot matching the line color, followed by the market outcome label, followed by the current Yes price formatted as a percentage (e.g. "18.8%").
3. WHEN a Visible_Market's price updates via WebSocket, THE Legend_Bar SHALL update the displayed price for that market within 1 second.
4. IF the Legend_Bar items exceed the available top bar width, THEN THE Legend_Bar SHALL truncate overflowing items with horizontal scroll or ellipsis so the top bar layout remains intact.

### Requirement 5: Hover Tooltip Card

**User Story:** As a trader, I want a tooltip card on hover that shows the price of all visible outcomes at the hovered point in time, so that I can compare exact prices at any moment.

#### Acceptance Criteria

1. WHEN the user hovers over the Chart while All_Markets_Mode is active, THE Chart SHALL display a Hover_Tooltip card at the cursor position.
2. THE Hover_Tooltip SHALL display one row per Visible_Market, each containing a colored dot matching the line color, the market outcome label, and the price at the hovered timestamp formatted as cents (e.g. "81.0¢").
3. THE Hover_Tooltip SHALL display the date of the hovered data point formatted with month and day (e.g. "April 30, 2026").
4. WHEN the user moves the cursor away from the Chart, THE Hover_Tooltip SHALL disappear.
5. THE Hover_Tooltip SHALL render as a solid card (opaque background with border), visually consistent with the existing PnL hover tooltip style.

### Requirement 6: Market Add/Remove Controls

**User Story:** As a trader, I want to add or remove individual outcomes from the multi-line chart, so that I can customize which markets I compare.

#### Acceptance Criteria

1. WHILE All_Markets_Mode is active AND the user opens the Market_Selector dropdown, THE Market_Selector SHALL display a "−" (minus) icon on each market row that is currently in Visible_Markets.
2. WHILE All_Markets_Mode is active AND the user opens the Market_Selector dropdown, THE Market_Selector SHALL display a "+" (plus) icon on each market row that is not currently in Visible_Markets.
3. WHEN the user clicks a "−" icon on a Visible_Market row, THE Chart SHALL remove that market's line from the Chart and update the Legend_Bar accordingly.
4. WHEN the user clicks a "+" icon on a non-visible market row, THE Chart SHALL add that market's line to the Chart and update the Legend_Bar accordingly.
5. WHEN the user adds or removes a market, THE Market_Selector dropdown SHALL remain open so the user can make additional changes without reopening.
6. IF the user removes all Visible_Markets, THEN THE Chart SHALL exit All_Markets_Mode and return to single-market view for the first active market in the event.

### Requirement 7: State Management

**User Story:** As a trader, I want the All Markets mode state to be managed consistently, so that switching between modes and navigating between events works predictably.

#### Acceptance Criteria

1. THE workspace layout store SHALL track whether All_Markets_Mode is active and which markets are in Visible_Markets.
2. WHEN the user navigates to a different event, THE Chart SHALL exit All_Markets_Mode and reset Visible_Markets.
3. WHEN All_Markets_Mode is activated, THE Chart SHALL subscribe to WebSocket `last_trade_price` events for all Visible_Markets' asset IDs to receive real-time price updates.
4. WHEN a market is added to or removed from Visible_Markets, THE Chart SHALL update WebSocket subscriptions to match the current Visible_Markets set.
