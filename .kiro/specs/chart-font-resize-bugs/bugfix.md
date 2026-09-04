# Bugfix Requirements Document

## Introduction

The trading terminal chart in the Doji Polymarket app has multiple visual and UX bugs related to font sizing, default state, and preference persistence. The Y-axis font size randomly changes between two sizes when resizing the chart via the height divider. Switching between candle/line mode combined with Yes/No side toggling causes additional font size glitches. The default chart height cuts off the left drawing toolbar, the default chart mode is candles instead of line, and user preferences (chart height, chart mode) don't reliably restore on return visits.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user drags the chart height divider up or down THEN the system randomly changes the Y-axis font size between two different sizes (the ResizeObserver calls `chart.resize()` which triggers klinecharts internal re-layout, but the chart styles including `yAxis.tickText.size` are not re-applied after resize, causing the library to fall back to its own default font size intermittently)

1.2 WHEN the user switches between candle mode and line mode AND then switches between Yes/No above the trading menu THEN the system displays chart font size glitches (Effect 4 applies theme styles on `chartType` change, but the Yes/No toggle triggers Effect 2 which reloads chart data and may race with style application, causing transient font size inconsistency)

1.3 WHEN the chart loads at the default height of 55% THEN the system cuts off the bottom portion of the left drawing toolbar (the toolbar contains 1 pointer button + 5 tool groups + 3 utility buttons + 1 eraser = ~12 items at 32px each plus dividers, requiring more vertical space than 55% of typical viewports provides)

1.4 WHEN the chart loads for the first time (no localStorage entry) THEN the system defaults to candle chart mode (the `PolymarketKLineChartInner` component has `chartType = "candle"` as its default parameter, which takes effect before `useSyncExternalStore` resolves the localStorage value of "line" from `getChartTypeSnapshot`)

1.5 WHEN the user sets a chart height or chart mode preference and returns to the page later THEN the system does not reliably restore both preferences together (chart height persists via zustand persist middleware under key "workspace-layout" and chart type persists via raw localStorage key "doji-chart-type" using `useSyncExternalStore`, but the two persistence mechanisms are independent and the `useSyncExternalStore` hydration may not resolve before the inner chart component mounts with its default "candle" parameter)

### Expected Behavior (Correct)

2.1 WHEN the user drags the chart height divider up or down THEN the system SHALL maintain a consistent Y-axis font size of 12px throughout the entire resize operation (styles must be re-applied after each `chart.resize()` call, or the resize must preserve existing style state)

2.2 WHEN the user switches between candle/line mode and Yes/No side in any order or combination THEN the system SHALL maintain a consistent font size across all chart elements without any visual glitches (style application must be sequenced correctly relative to data reloads)

2.3 WHEN the chart loads at the default height THEN the system SHALL display the full left drawing toolbar without any buttons being cut off or requiring scrolling (the default `CHART_HEIGHT_DEFAULT` must be increased to accommodate the toolbar's full height on typical viewports)

2.4 WHEN the chart loads for the first time with no saved preference THEN the system SHALL default to line chart mode (the default parameter in `PolymarketKLineChartInner` and the `getChartTypeSnapshot` fallback must both return "line")

2.5 WHEN the user returns to the page after previously setting chart height and chart mode preferences THEN the system SHALL restore both preferences from localStorage so the chart appears exactly as the user left it (both persistence mechanisms must hydrate before the chart renders with defaults)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user interacts with the chart normally (panning, zooming, scrolling) without resizing the height divider THEN the system SHALL CONTINUE TO render the chart with correct 12px axis font sizes and smooth interactions

3.2 WHEN the user switches between time intervals (1H, 4H, 1D, 1W, Max) THEN the system SHALL CONTINUE TO reload chart data and update the period correctly without font size changes

3.3 WHEN the user uses drawing tools from the left toolbar THEN the system SHALL CONTINUE TO create and display overlays correctly on the chart

3.4 WHEN the user toggles indicators (MA, EMA, MACD, RSI, etc.) THEN the system SHALL CONTINUE TO add and remove indicator panes and overlays correctly

3.5 WHEN the chart receives real-time WebSocket price updates THEN the system SHALL CONTINUE TO update the last candle/area point and sonar ring position correctly

3.6 WHEN the user resizes the orderbook width via the vertical handle THEN the system SHALL CONTINUE TO adjust the grid layout correctly and trigger chart resize without visual artifacts

3.7 WHEN the user drags to swap the chart and orderbook columns THEN the system SHALL CONTINUE TO animate the swap correctly via FLIP and persist the panel order
