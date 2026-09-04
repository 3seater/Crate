# Bugfix Requirements Document

## Introduction

When navigating to an event via `?view=all-markets`, the All Markets mode activates but fails to render charts correctly. Three interrelated bugs manifest: (1) charts don't load because `eventMarketsRaw` is empty when `visibleMarketIds` is populated, causing the dropdown to show "+" for all items; (2) the market header briefly flashes the highest outcome name instead of "All Markets" due to stale sticky ref data during navigation; (3) the recurring crypto event check fires after `visibleMarketIds` is already set, causing a flash of All Markets UI before resetting. These bugs affect every event navigation path (search, calendar, explore, direct link).

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user navigates to an event with `?view=all-markets` THEN the system sets `allMarketsMode=true` and populates `visibleMarketIds` via `getDefaultVisibleMarkets`, but `eventMarketsForChart` returns an empty array because `eventMarketsRaw` has not loaded yet (the `eventMarketsRaw.length < 2` guard returns early), causing `AllMarketsLineLayer` to receive an empty `visibleMarkets` prop and render no chart lines

1.2 WHEN `allMarketsMode` is active and `visibleMarketIds` is populated but `eventMarketsForChart` is empty THEN the dropdown in `TradingSelectorCard` shows a "+" (add) button for every market because `visibleMarketIds.includes(item.conditionId)` returns false when matched against the empty `eventMarketsForChart` array — the IDs are set but the chart data they reference does not exist yet

1.3 WHEN the user navigates to an event page via client-side navigation THEN the `MarketHeaderTrading` title pill briefly displays the previous market's outcome label (from `stickyEventRef`) before the `allMarketsMode` branch renders "All Markets", causing a visible flash of incorrect text in the header

1.4 WHEN the user navigates to a recurring crypto event (tagged "recurring") with `?view=all-markets` THEN the system first sets `allMarketsMode=true` and populates `visibleMarketIds` in one `useEffect`, and only afterwards does `isRecurringCryptoEventForAllMarkets()` detect the recurring tag and call `resetAllMarketsMode()` — causing a brief flash of All Markets UI (chart area, disabled orderbook) before reverting to single-market mode

### Expected Behavior (Correct)

2.1 WHEN a user navigates to an event with `?view=all-markets` THEN the system SHALL wait until `eventMarketsRaw` has loaded (length >= 2) before populating `visibleMarketIds`, ensuring `AllMarketsLineLayer` receives a non-empty `visibleMarkets` array and renders chart lines for the top 4 outcomes by yes price

2.2 WHEN `allMarketsMode` is active THEN the dropdown in `TradingSelectorCard` SHALL correctly show "−" (remove) for markets present in `visibleMarketIds` and "+" (add) for markets not in `visibleMarketIds`, reflecting the actual chart visibility state without depending on `eventMarketsForChart` being loaded first

2.3 WHEN the user navigates to an event page and `allMarketsMode` is active THEN the `MarketHeaderTrading` title pill SHALL display "All Markets | {event title}" without any flash of a previous market's outcome label — the stale sticky ref SHALL be cleared or bypassed during navigation transitions

2.4 WHEN the user navigates to a recurring crypto event with `?view=all-markets` THEN the system SHALL check `isRecurringCryptoEventForAllMarkets()` BEFORE setting `visibleMarketIds`, so that `allMarketsMode` is reset to false without any intermediate render of All Markets UI

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user navigates to a non-recurring, non-sports event with `?view=all-markets` and event data loads successfully THEN the system SHALL CONTINUE TO display the top 4 outcomes by yes price in the multi kline chart with correct color assignments

3.2 WHEN a user clicks a specific outcome in the dropdown while in All Markets mode THEN the system SHALL CONTINUE TO exit All Markets mode, switch to that single outcome's chart, and re-enable the orderbook

3.3 WHEN a user clicks "+" or "−" on dropdown items in All Markets mode THEN the system SHALL CONTINUE TO add or remove individual charts from the multi kline view without exiting All Markets mode

3.4 WHEN a user navigates to a recurring crypto event (5min, 15m, 1hour, 4hour, daily tagged "recurring") without `?view=all-markets` THEN the system SHALL CONTINUE TO display the single-market trading terminal with the crypto timeslot bar

3.5 WHEN a user navigates to a single-market event (SMP with only 1 market) THEN the system SHALL CONTINUE TO display the standard single-market view without activating All Markets mode

3.6 WHEN fewer than 4 active outcomes exist in an event (due to resolution or limited markets) THEN the system SHALL CONTINUE TO show only the available active outcomes in the multi kline chart

3.7 WHEN the user removes all visible markets via "−" buttons in All Markets mode THEN the system SHALL CONTINUE TO automatically exit All Markets mode and revert to single-market view (as implemented by `removeVisibleMarket` setting `allMarketsMode: false` when `next.length === 0`)
