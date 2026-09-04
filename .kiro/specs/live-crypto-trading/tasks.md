# Implementation Plan: Live Crypto Trading

## Overview

Add a live crypto trading experience for Polymarket's recurring crypto markets. Implementation builds incrementally: pure time window utilities → recurring market detection → Zustand crypto price store → RTDS price hook → countdown timer → crypto trading header → chart modifications → time slot selector → explore page integration → terminal wiring.

All code is TypeScript. The design uses existing patterns (Zustand flat stores, RTDS subscriptions, KLineChart v10, design system tokens).

## Tasks

- [x] 1. Time window utilities
  - [x] 1.1 Create `apps/web/src/utils/time-window.ts` with pure time window functions
    - Implement `computeTimeWindow(timeframeDurationMs, now?)` — aligns to grid: `start = floor(now / duration) * duration`, `end = start + duration`. Daily windows align to midnight ET.
    - Implement `computeRemainingSeconds(windowEnd, now?)` — returns non-negative seconds until window end
    - Implement `generateTimeSlots(timeframeDurationMs, count, now?)` — returns `count` contiguous slots centered on current window, each with `start`, `end`, `label`, `isPast`, `isActive`
    - Implement `formatTimeWindowET(start, end)` — returns `"[Month] [Day], [StartTime]-[EndTime] ET"` string
    - Implement `formatTimeSlotLabelET(timestamp)` — returns time label like `"11:45 PM"`
    - Accept optional `now` parameter on all functions for testability
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [ ]* 1.2 Write property test for time window round-trip (Property 11)
    - **Property 11: Time window round-trip**
    - For any valid timeframe duration and timestamp, `computeTimeWindow(duration, now).end === computeTimeWindow(duration, now).start + duration`
    - **Validates: Requirements 8.5**

  - [ ]* 1.3 Write property test for remaining seconds invariant (Property 12)
    - **Property 12: Remaining seconds invariant**
    - For any timestamp within a time window, `computeRemainingSeconds(windowEnd, now)` is non-negative and ≤ `duration / 1000`
    - **Validates: Requirements 8.6**

  - [ ]* 1.4 Write property test for time slot generation contiguity (Property 13)
    - **Property 13: Time slot generation contiguity and uniqueness**
    - For any valid duration and count, `generateTimeSlots` returns exactly `count` contiguous, non-overlapping slots with exactly one `isActive` slot
    - **Validates: Requirements 8.3**

  - [ ]* 1.5 Write property test for time formatting (Property 14)
    - **Property 14: Time formatting produces valid ET strings**
    - For any valid timestamp, `formatTimeSlotLabelET` produces a non-empty string containing AM or PM
    - For any valid start/end pair, `formatTimeWindowET` produces a string containing a month name, day number, and ET time range
    - **Validates: Requirements 5.6, 8.4**

- [x] 2. Recurring crypto market detection
  - [x] 2.1 Create `apps/web/src/lib/markets/recurring-crypto.ts` with detection and mapping utilities
    - Define `RecurringCryptoMarketInfo` interface (asset, timeframe, timeframeDurationMs, binanceSymbol, chainlinkSymbol, windowStart, windowEnd, targetPrice)
    - Define `ASSET_SYMBOL_MAP` constant mapping asset → `{ binance, chainlink }` symbols
    - Define `KNOWN_ASSET_TAGS` and `RECURRING_TIMEFRAME_TAGS` (reuse from `crypto-sidebar-constants.ts` or co-locate)
    - Implement `detectRecurringCryptoMarket(market, event?)` — checks event tags for `recurring` + timeframe tag, extracts asset, maps to RTDS symbols, extracts time window from title/description, extracts target price. Returns `null` if any step fails.
    - Implement `mapAssetToRtdsSymbol(asset)` — returns `{ binance, chainlink }` or `null`
    - No React dependency — safe for Server Components
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 2.2 Write property test for recurring crypto market detection (Property 8)
    - **Property 8: Recurring crypto market detection**
    - For any event with `recurring` + valid timeframe tag + known asset tag, `detectRecurringCryptoMarket` returns non-null. For events missing `recurring` or timeframe tag, returns `null`.
    - **Validates: Requirements 6.1, 6.5**

  - [ ]* 2.3 Write property test for asset-to-RTDS-symbol mapping (Property 9)
    - **Property 9: Asset-to-RTDS-symbol mapping**
    - For each known asset tag, the detection result contains a valid `binanceSymbol` ending in `usdt` and a valid `chainlinkSymbol` in `xxx/usd` format
    - **Validates: Requirements 6.2, 6.3**

  - [ ]* 2.4 Write unit tests for detection edge cases
    - Event with `recurring` tag but no timeframe tag returns `null`
    - Event with `recurring` + `5M` but no asset tag returns `null`
    - Market title "Bitcoin Up or Down 11:40-11:45PM ET" extracts correct start/end
    - _Requirements: 6.1, 6.4, 6.5_

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Crypto price store
  - [x] 4.1 Create `apps/web/src/stores/crypto-prices.ts` Zustand store
    - Define `CryptoPrice` interface (`symbol`, `value`, `timestamp`, `source`)
    - Define `CryptoPriceState` with `prices: Map<string, CryptoPrice>` and `previousPrices: Map<string, number>`
    - Implement `updatePrice(price)` action — updates entry keyed by `${symbol}:${source}`, saves previous value, enforces 50-entry max (evicts oldest by timestamp)
    - Implement `reset()` action
    - Export module-level selectors: `getPrice(state, symbol)` (prefers Binance over Chainlink), `getDirection(state, symbol)` (up/down/neutral), `getPriceDifference(state, symbol, targetPrice)` (amount + direction)
    - Follow `useOrderbookStore` flat state pattern
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 4.2 Write property test for store update and previous price retention (Property 2)
    - **Property 2: Store update preserves latest entry and retains previous price**
    - For any sequence of two price updates for the same symbol/source, store contains second price as current and first price's value in `previousPrices`
    - **Validates: Requirements 2.1, 2.2**

  - [ ]* 4.3 Write property test for Binance source preference (Property 3)
    - **Property 3: Binance source preference**
    - For any state with both Binance and Chainlink prices for the same asset, `getPrice` returns Binance value. With only Chainlink, returns Chainlink value.
    - **Validates: Requirements 2.3**

  - [ ]* 4.4 Write property test for price direction computation (Property 4)
    - **Property 4: Price direction computation**
    - For any two numbers, `getDirection` returns `"up"` when current > previous, `"down"` when current < previous, `"neutral"` when equal
    - **Validates: Requirements 2.4**

  - [ ]* 4.5 Write property test for store max size invariant (Property 5)
    - **Property 5: Store max size invariant**
    - For any sequence of N > 50 distinct symbol-source updates, `prices` map size never exceeds 50
    - **Validates: Requirements 2.5**

  - [ ]* 4.6 Write property test for price difference computation (Property 6)
    - **Property 6: Price difference computation**
    - For any `currentPrice` and `targetPrice`, `getPriceDifference` returns `|current - target|` with correct direction
    - **Validates: Requirements 4.3**

- [x] 5. RTDS crypto price hook
  - [x] 5.1 Create `apps/web/src/hooks/use-crypto-prices.ts` hook
    - Accept `UseCryptoPricesOptions` (`symbols: string[]`, `enabled?: boolean`)
    - On mount: call `rtdsClient.connect()`, subscribe to `crypto_prices` (type `update`) and `crypto_prices_chainlink` (type `*`)
    - Add RTDS handler that filters by subscribed symbols and writes to `useCryptoPriceStore` via `updatePrice`
    - Validate payloads via existing `CryptoPricePayloadSchema` from `rtds-schemas.ts`
    - Unsubscribe on unmount if no other subscribers remain
    - Follow `use-live-trades.ts` pattern
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 5.2 Write property test for CryptoPricePayload schema validation (Property 1)
    - **Property 1: CryptoPricePayload schema validation round-trip**
    - For any valid CryptoPrice object, serializing and parsing with `CryptoPricePayloadSchema` succeeds. For objects with missing/wrong-type fields, parsing fails.
    - **Validates: Requirements 1.4, 1.5**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. CountdownTimer component
  - [x] 7.1 Create `apps/web/src/components/trading/countdown-timer.tsx`
    - Props: `endTime: number`, `onExpire?: () => void`, `className?: string`
    - Uses `useEffect` + `setInterval(1000)` to tick every second
    - Displays `MM:SS` format
    - Shows "Ended" when `endTime` is in the past
    - Calls `onExpire` once when transitioning from active to expired
    - Uses `suppressHydrationWarning` for time-dependent render
    - `"use client"` directive
    - Design tokens: `text-sm font-medium` for timer display
    - _Requirements: 4.4, 4.5, 7.1_

- [x] 8. CryptoTradingHeader component
  - [x] 8.1 Create `apps/web/src/components/trading/crypto-trading-header.tsx`
    - Props: `cryptoInfo: RecurringCryptoMarketInfo`, `market: Market`
    - Layout (left to right): market title, subtitle, Price To Beat, Current Price (live), Price Difference, Countdown Timer
    - Title format: `"[Asset] Up or Down - [Timeframe]"` using `cryptoInfo.asset` and `cryptoInfo.timeframe`
    - Subtitle format: `"[Month] [Day], [StartTime]-[EndTime] ET"` using `formatTimeWindowET`
    - Current Price reads from `useCryptoPriceStore` via `getPrice(symbol)`
    - Price Difference uses `getPriceDifference` — green with up arrow when above target, red with down arrow when below
    - When countdown reaches zero, replace timer with "Go to live" `Button` (variant `default`) that navigates to next active market
    - Design tokens: `text-lg` title, `text-sm` subtitle/prices, `text-xs` labels, `font-medium` price values, `text-profit`/`text-loss` for directional colors
    - `"use client"` directive
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7_

  - [ ]* 8.2 Write property test for header text formatting (Property 7)
    - **Property 7: Header text formatting**
    - For any valid asset name and timeframe, title formatter produces `"[Asset] Up or Down - [Timeframe]"`. For any valid start/end timestamps, subtitle contains month, day, and ET time range.
    - **Validates: Requirements 4.6, 4.7**

- [x] 9. Chart modifications for live crypto price
  - [x] 9.1 Create `apps/web/src/components/charts/live-price-chart.tsx`
    - Props: `symbol: string`, `targetPrice: number | null`, `windowStart: number`, `windowEnd: number`
    - Uses KLineChart v10 `init()` with `type: "line"` (not candle/OHLC)
    - Hides toolbar and top indicator/timescale header bar — renders only chart canvas, price axis, time axis
    - Registers custom overlay for "Price To Beat" dashed horizontal line at `targetPrice`
    - Subscribes to `useCryptoPriceStore` and appends new data points via `chart.updateData()`
    - Y-axis: dollar values (right side). X-axis: timestamps within time window
    - Line color: green (`--color-profit`) above target, red (`--color-loss`) below target
    - Auto-scroll when at latest data point
    - Chart is LOCKED — disable all user interaction (pan, scroll, zoom) via KLineChart options. Chart always auto-follows the latest price tick.
    - Dynamic import with `ssr: false` (canvas APIs are client-only, matching `PolymarketKLineChartInner` pattern)
    - Disposed on unmount via `dispose()`
    - `"use client"` directive
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. TimeSlotSelector component
  - [x] 11.1 Create `apps/web/src/components/trading/time-slot-selector.tsx`
    - Define `TimeSlot` interface (`marketId`, `startTime`, `label`, `isActive`, `isPast`)
    - Props: `slots: TimeSlot[]`, `activeIndex: number`, `onSelect: (slot: TimeSlot) => void`, `showDropdowns?: boolean`
    - Display up to 5 visible slots as `SelectorChip` components (from `@/components/ui/selector-chip`)
    - Active slot: live dot indicator + distinct background (Doji green ring)
    - "Past" dropdown (left) for completed slots beyond visible range
    - "More" dropdown (right) for future slots beyond visible range
    - Selection navigates to corresponding market via Next.js router
    - `"use client"` directive
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 12. Explore page integration
  - [x] 12.1 Create `apps/web/src/components/explore/explore-crypto-section.tsx`
    - Props: `timeframeLabel: string`, `events: Event[]`, `windowInfo: { start, end, label }`
    - Header: timeframe label + time window range + `CountdownTimer`
    - Event cards: one per asset, showing title, time window, Up/Down buttons with Yes/No prices, volume, liquidity, end date
    - Uses existing `groupRecurringCryptoEvents()` from `crypto-sidebar-constants.ts`
    - On countdown expiry: triggers refresh to show next time window
    - Each asset card shows only the single currently active market (1 per group, matching `MAX_GROUPED_MARKETS = 1`)
    - `"use client"` directive
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [ ]* 12.2 Write property test for recurring event grouping (Property 10)
    - **Property 10: Recurring event grouping**
    - For any list of events with mixed recurring/non-recurring, `groupRecurringCryptoEvents` produces at most one entry per asset+timeframe combination. Non-recurring event count in output equals input count.
    - **Validates: Requirements 7.7**

- [x] 13. Wire everything into TradingLayoutTerminal
  - [x] 13.1 Modify `apps/web/src/components/trading/trading-layout-terminal.tsx` for crypto market detection
    - Call `detectRecurringCryptoMarket(market, event)` at the top of the component
    - If result is non-null (recurring crypto market):
      - Render `CryptoTradingHeader` instead of default `MarketHeader`
      - Render `LivePriceChart` instead of `ChartSlot` (pass symbol, targetPrice, windowStart, windowEnd)
      - Render `TimeSlotSelector` below the header
      - Call `useCryptoPrices({ symbols: [cryptoInfo.binanceSymbol, cryptoInfo.chainlinkSymbol] })` to start RTDS subscription
    - If result is null: render standard OHLC chart and default header (existing behavior unchanged)
    - _Requirements: 3.1, 3.9, 4.1, 5.1, 6.5_

  - [x] 13.2 Wire `ExploreCryptoSection` into explore page
    - Integrate `ExploreCryptoSection` into the crypto category view when a timeframe category is selected
    - Pass grouped events, timeframe label, and computed window info
    - _Requirements: 7.1, 7.2, 7.6_

- [ ] 14. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests use fast-check (already in the project's Vitest setup)
- All UI uses design system tokens only (no hardcoded colors, 6-size type scale, font-normal/font-medium)
- The existing KLineChart is kept entirely intact visually — only the toolbar and top indicator/timescale header bar are hidden for crypto markets
- RTDS live crypto price data replaces orderbook OHLC data for recurring crypto markets only
- `MAX_GROUPED_MARKETS = 1` is already set in `crypto-sidebar-constants.ts`
