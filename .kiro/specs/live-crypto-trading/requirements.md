# Requirements Document

## Introduction

Live crypto trading experience for Polymarket's recurring crypto markets (5 min, 15 min, 1 hour, 4 hour, daily). The feature connects to Polymarket's RTDS WebSocket for real-time cryptocurrency prices, displays a live price chart on the trading terminal, provides a specialized trading header with countdown timers, enables time slot navigation, and integrates recurring crypto markets into the explore page with live data.

## Glossary

- **RTDS**: Real-Time Data Socket — Polymarket's WebSocket service at `wss://ws-live-data.polymarket.com` for streaming live data (comments, crypto prices, activity).
- **Recurring_Crypto_Market**: A Polymarket prediction market on whether a cryptocurrency price goes Up or Down within a fixed time window (5 min, 15 min, 1 hr, 4 hr, daily). Tagged with `recurring` and a timeframe tag (`5M`, `15M`, `1H`, `4H`, `daily`).
- **Time_Window**: The fixed duration period for a recurring crypto market (e.g., 11:40–11:45 PM ET for a 5-minute market).
- **Time_Slot**: A specific instance of a Time_Window (e.g., the 11:45 PM slot). Multiple Time_Slots exist for each Recurring_Crypto_Market.
- **Target_Price**: The cryptocurrency price at the start of a Time_Window, also called "Price To Beat". The market resolves based on whether the final price is above or below the Target_Price.
- **Current_Price**: The latest live cryptocurrency price streamed from RTDS.
- **Price_Difference**: The dollar amount difference between Current_Price and Target_Price, displayed with directional color (green for above, red for below).
- **Live_Price_Chart**: A real-time line chart showing cryptocurrency price movement during the active Time_Window, rendered using KLineChart v10.
- **Crypto_Trading_Header**: The specialized header component for Recurring_Crypto_Markets showing Target_Price, Current_Price, Price_Difference, countdown timer, market title, and Time_Window subtitle.
- **Time_Slot_Selector**: A navigation component showing past, current, and upcoming Time_Slots for a Recurring_Crypto_Market.
- **Explore_Crypto_Section**: The explore page section for a specific timeframe category (e.g., "5M Markets") showing grouped recurring crypto events with live countdown timers.
- **Binance_Feed**: RTDS topic `crypto_prices` with type `update`. Symbols in lowercase concatenated format: `btcusdt`, `ethusdt`, `solusdt`, `xrpusdt`.
- **Chainlink_Feed**: RTDS topic `crypto_prices_chainlink` with type `*`. Symbols in slash-separated format: `eth/usd`, `btc/usd`, `sol/usd`, `xrp/usd`.
- **RtdsClient**: The existing singleton WebSocket client in `apps/web/src/lib/websocket/rtds.ts` that manages RTDS connections, subscriptions, and event dispatch.
- **Countdown_Timer**: A live-updating display showing minutes and seconds remaining in the current Time_Window.

## Requirements

### Requirement 1: RTDS Crypto Price Subscription

**User Story:** As a trader, I want the application to stream live cryptocurrency prices from RTDS, so that I can see real-time price data on recurring crypto markets.

#### Acceptance Criteria

1. WHEN a component mounts that requires live crypto prices, THE RtdsClient SHALL connect to `wss://ws-live-data.polymarket.com` and subscribe to the `crypto_prices` topic with type `update` for Binance_Feed data.
2. WHEN a component mounts that requires live crypto prices, THE RtdsClient SHALL subscribe to the `crypto_prices_chainlink` topic with type `*` for Chainlink_Feed data.
3. WHILE connected to RTDS, THE RtdsClient SHALL send a PING message every 5 seconds to maintain the WebSocket connection.
4. WHEN a `crypto_prices` message is received, THE RtdsClient SHALL validate the payload against the CryptoPricePayloadSchema (symbol: string, timestamp: number, value: number) before dispatching to handlers.
5. WHEN a `crypto_prices_chainlink` message is received, THE RtdsClient SHALL validate the payload against the CryptoPricePayloadSchema before dispatching to handlers.
6. IF the RTDS WebSocket connection drops, THEN THE RtdsClient SHALL attempt reconnection using exponential backoff and resubscribe to all active subscriptions upon reconnection.
7. WHEN a component unmounts, THE RtdsClient SHALL unsubscribe from crypto price topics if no other subscribers remain.

### Requirement 2: Live Crypto Price Store

**User Story:** As a developer, I want a centralized store for live crypto prices, so that multiple components can access the latest price data without duplicate WebSocket subscriptions.

#### Acceptance Criteria

1. THE Crypto_Price_Store SHALL maintain a map of the latest CryptoPrice entries keyed by symbol and source (Binance or Chainlink).
2. WHEN a new crypto price event is received from RTDS, THE Crypto_Price_Store SHALL update the corresponding entry and retain the previous price for direction calculation.
3. THE Crypto_Price_Store SHALL expose a function to retrieve the latest price for a given cryptocurrency symbol, preferring Binance_Feed data when available.
4. THE Crypto_Price_Store SHALL expose a function to compute the price direction (up, down, or neutral) by comparing the current price to the previous price.
5. THE Crypto_Price_Store SHALL enforce a maximum of 50 tracked symbol-source pairs to prevent unbounded memory growth.

### Requirement 3: Live Price Chart

**User Story:** As a trader, I want to see a real-time price line chart when viewing a recurring crypto market, so that I can visually track the cryptocurrency price movement during the current time window.

#### Acceptance Criteria

1. WHEN a trader opens a Recurring_Crypto_Market in the trading terminal, THE existing KLineChart SHALL render a real-time line chart of the underlying cryptocurrency price using data from the Crypto_Price_Store.
2. THE chart SHALL hide the toolbar (drawing tools, indicator selectors) and the top indicator/timescale header bar, keeping only the chart canvas, price axis, and time axis.
3. THE chart SHALL display a dashed horizontal line at the Target_Price level, labeled "Price To Beat".
4. THE chart SHALL update the price line in real-time as new price data arrives from RTDS, appending new data points without full re-renders.
5. THE chart SHALL display a vertical price axis on the right side showing dollar values.
6. THE chart SHALL display a horizontal time axis on the bottom showing timestamps within the current Time_Window.
7. THE chart SHALL color the price line green when Current_Price is above Target_Price and red when Current_Price is below Target_Price.
8. WHILE the chart is at the latest data point (not scrolled back), THE chart SHALL auto-scroll to keep the latest price visible.
9. THE chart SHALL be locked — user interaction (pan, scroll, zoom) SHALL be disabled. The chart SHALL always auto-follow the latest price tick, scrolling automatically as new data arrives.
10. THE chart SHALL use the existing KLineChart infrastructure but switch to line mode and feed it RTDS price data instead of orderbook OHLC data when the market is a Recurring_Crypto_Market.

### Requirement 4: Crypto Trading Header

**User Story:** As a trader, I want to see the target price, current price, price difference, and countdown timer in the trading header, so that I can quickly assess the market state without looking at the chart.

#### Acceptance Criteria

1. WHEN a Recurring_Crypto_Market is displayed in the trading terminal, THE Crypto_Trading_Header SHALL show the Target_Price labeled "Price To Beat".
2. WHEN a Recurring_Crypto_Market is displayed, THE Crypto_Trading_Header SHALL show the Current_Price updating in real-time from the Crypto_Price_Store.
3. THE Crypto_Trading_Header SHALL display the Price_Difference as a dollar amount with a directional indicator: green with an up arrow when Current_Price exceeds Target_Price, red with a down arrow when Current_Price is below Target_Price.
4. THE Crypto_Trading_Header SHALL display a Countdown_Timer showing minutes and seconds remaining until the current Time_Window ends.
5. WHEN the Countdown_Timer reaches zero, THE Crypto_Trading_Header SHALL replace the timer with a "Go to live" button that navigates the user to the next active Recurring_Crypto_Market for the same asset and timeframe.
6. WHEN the user clicks the "Go to live" button, THE trading terminal SHALL navigate to the next active Time_Slot's market.
6. THE Crypto_Trading_Header SHALL display the market title in the format "[Asset] Up or Down - [Timeframe]" (e.g., "Bitcoin Up or Down - 5 Minutes").
7. THE Crypto_Trading_Header SHALL display a subtitle showing the current Time_Window in the format "[Month] [Day], [StartTime]-[EndTime] ET" (e.g., "April 1, 11:40-11:45PM ET").

### Requirement 5: Time Slot Selector

**User Story:** As a trader, I want to navigate between past, current, and upcoming time slots, so that I can view historical results or prepare trades for upcoming windows.

#### Acceptance Criteria

1. WHEN a Recurring_Crypto_Market is displayed, THE Time_Slot_Selector SHALL show the 5 most recent and upcoming Time_Slots for that market's asset and timeframe combination.
2. THE Time_Slot_Selector SHALL highlight the currently active Time_Slot with a visual indicator (e.g., a live dot and distinct background).
3. THE Time_Slot_Selector SHALL display a "Past" dropdown for completed Time_Slots beyond the visible 5.
4. THE Time_Slot_Selector SHALL display a "More" dropdown for future Time_Slots beyond the visible 5.
5. WHEN a trader selects a different Time_Slot, THE Time_Slot_Selector SHALL navigate to the corresponding market, updating the Live_Price_Chart, Crypto_Trading_Header, and order form.
6. THE Time_Slot_Selector SHALL display each Time_Slot as a formatted time label (e.g., "11:45 PM").

### Requirement 6: Recurring Crypto Market Detection

**User Story:** As a developer, I want a reliable way to detect whether a market is a recurring crypto market, so that the correct UI components (live chart, crypto header, time slot selector) are rendered.

#### Acceptance Criteria

1. THE Market_Detector SHALL identify a market as a Recurring_Crypto_Market when the parent event carries both a `recurring` tag and a timeframe tag (`5M`, `15M`, `1H`, `4H`, or `daily`).
2. THE Market_Detector SHALL extract the underlying cryptocurrency symbol from the event's asset tags (bitcoin, ethereum, solana, xrp, dogecoin, bnb).
3. THE Market_Detector SHALL map the extracted cryptocurrency symbol to the corresponding RTDS symbol format for both Binance_Feed (e.g., `btcusdt`) and Chainlink_Feed (e.g., `btc/usd`).
4. THE Market_Detector SHALL extract the Time_Window start and end times from the market's title or description text.
5. IF a market cannot be identified as a Recurring_Crypto_Market, THEN THE Market_Detector SHALL return null, and the trading terminal SHALL render the standard OHLC chart and default header.

### Requirement 7: Explore Page Crypto Section

**User Story:** As a trader browsing the explore page, I want to see recurring crypto markets grouped by timeframe with live countdown timers, so that I can quickly find and enter active crypto markets.

#### Acceptance Criteria

1. WHEN the crypto topic tag is active and a timeframe category (5 Min, 15 Min, 1 Hour, 4 Hours, Daily) is selected, THE Explore_Crypto_Section SHALL display a header showing the timeframe label (e.g., "5M Markets") with the current Time_Window range and a Countdown_Timer.
2. THE Explore_Crypto_Section SHALL display event cards for each cryptocurrency asset available in the selected timeframe.
3. Each event card SHALL display the asset name and current Time_Window (e.g., "Bitcoin Up or Down - April 1, 11:35PM-11:40PM ET").
4. Each event card SHALL display Up and Down buttons with current market percentages (Yes/No prices).
5. Each event card SHALL display volume, liquidity, and end date information.
6. WHEN the Countdown_Timer reaches zero, THE Explore_Crypto_Section SHALL refresh to show the next Time_Window.
7. THE Explore_Crypto_Section SHALL group recurring events so that each asset shows only the single currently active market (the current Time_Window), not multiple past or future markets. The `groupRecurringCryptoEvents` function SHALL keep only 1 market per asset+timeframe group.

### Requirement 8: Time Window Computation

**User Story:** As a developer, I want pure utility functions to compute time window boundaries, countdowns, and slot lists, so that all components display consistent timing information.

#### Acceptance Criteria

1. THE Time_Window_Utils SHALL compute the start and end timestamps of the current Time_Window given a timeframe duration (5 min, 15 min, 1 hr, 4 hr, daily) and the current time.
2. THE Time_Window_Utils SHALL compute the remaining seconds until the current Time_Window ends.
3. THE Time_Window_Utils SHALL generate a list of Time_Slots (past and future) centered around the current Time_Window, given a count parameter.
4. THE Time_Window_Utils SHALL format Time_Window boundaries into display strings in Eastern Time (ET) format.
5. FOR ALL valid timeframe durations and timestamps, computing the Time_Window start then adding the duration SHALL equal the Time_Window end (round-trip property).
6. FOR ALL valid timestamps within a Time_Window, the computed remaining seconds SHALL be non-negative and less than or equal to the timeframe duration in seconds.
