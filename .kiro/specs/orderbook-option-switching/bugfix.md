# Bugfix Requirements Document

## Introduction

After the CLOB V2 migration, switching between options (markets) within a GMP event on the trading terminal exhibits multiple data consistency bugs. The orderbook shows stale or swapped data for ~10 seconds after switching, and the Yes/No buttons display identical prices instead of reflecting each side's independent lowest ask price from its own orderbook. These issues stem from the orderbook store tracking only one token at a time, the WebSocket subscription only covering the selected token, and the Yes/No price derivation relying on sticky refs that don't receive real-time updates for the non-selected side.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user switches from one market (option) to another within a GMP event THEN the orderbook displays the previous market's data for approximately 10 seconds before updating to the new market's book, because the WebSocket `book` snapshot for the new token takes time to arrive and the store still holds stale data from the old token during the gap.

1.2 WHEN the user is viewing the "No" side of a market THEN the orderbook shows the "Yes" side's book data until the WebSocket delivers the No token's snapshot, because `useOrderbook` subscribes to the selected token's asset IDs and the store's flat `bids`/`asks` fields still contain the Yes token's data when `setTokenId` is called before the new book arrives.

1.3 WHEN the Yes and No buttons are displayed in the TradingSelectorCard THEN both buttons show the same price (or near-identical prices), because the `MarketTradingContext` derives prices from sticky WS refs (`yesWsAskRef`, `noWsAskRef`) that only update when `orderbookTokenId` matches that specific token — the non-selected side's ref stays at 0 and falls through to the `orderbookQueries` snapshot which has `staleTime: Infinity` and never refetches with live data.

1.4 WHEN the user switches between Yes and No sides on the same market THEN the non-selected side's button price does not update in real-time with orderbook changes, because there is no WebSocket subscription delivering incremental `price_change` events for the non-selected token — only the selected token receives live WS updates via `useOrderbook`.

1.5 WHEN the user switches markets within a GMP event THEN the orderbook may briefly show data from the wrong side (bids and asks swapped), because the store's `setBook` writes to the flat root fields keyed by the current `tokenId`, and during the transition window the `tokenId` may update before or after the book data, causing a mismatch.

### Expected Behavior (Correct)

2.1 WHEN the user switches from one market to another within a GMP event THEN the system SHALL display the new market's orderbook data immediately (or show a brief loading state of <500ms), by seeding the store from the prefetched query cache for the new token and subscribing to the new token's WebSocket channel before unsubscribing from the old one.

2.2 WHEN the user switches to the "No" side of a market THEN the system SHALL display the No token's native orderbook immediately, by maintaining both Yes and No token books in the store's `books` map and atomically switching the active `tokenId` to surface the correct pre-populated book.

2.3 WHEN the Yes and No buttons are displayed THEN the system SHALL show the Yes button price as the lowest ask from the Yes token's orderbook and the No button price as the lowest ask from the No token's orderbook, with each price derived independently from its respective token's live data.

2.4 WHEN orderbook data streams in via WebSocket THEN the system SHALL update both the Yes and No button prices in real-time, by ensuring both tokens' orderbooks receive live WebSocket updates (either via dual subscriptions or by reading both token books from the store's `books` map which are populated by the `useOrderbook` hook and `orderbookQueries`).

2.5 WHEN the user switches markets within a GMP event THEN the system SHALL never display data from the wrong side (no bid/ask swap), by using atomic `setBookForToken` updates that write book data and tokenId in a single state transition.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user is viewing a single market (SMP) with no option switching THEN the system SHALL CONTINUE TO display the orderbook with real-time WebSocket updates, spread bar, depth bars, and scroll pinning as before.

3.2 WHEN the orderbook receives `price_change` events via WebSocket THEN the system SHALL CONTINUE TO apply incremental updates with the existing debounce/batch logic (120ms debounce, 250ms max buffer) and flash animation pipeline.

3.3 WHEN the user clicks an orderbook row THEN the system SHALL CONTINUE TO prefill the order form with the clicked price level.

3.4 WHEN the market channel WebSocket reconnects after a disconnection THEN the system SHALL CONTINUE TO refetch the orderbook snapshot to fill any data gaps.

3.5 WHEN the user hovers over a sibling market in the TradingSelectorCard dropdown THEN the system SHALL CONTINUE TO prefetch that market's orderbook and chart data for instant switching.

3.6 WHEN the orderbook store receives a full `book` snapshot via WebSocket that is shallower than the current store data THEN the system SHALL CONTINUE TO skip the shallow snapshot to prevent depth flash (existing depth-comparison guard).

3.7 WHEN the user is in All Markets mode THEN the system SHALL CONTINUE TO disable the Yes/No buttons and show the multi-line chart overlay without affecting orderbook behavior.

3.8 WHEN a market is closed/resolved THEN the system SHALL CONTINUE TO skip orderbook fetching and WebSocket subscriptions (existing `enabled: !closed` guard).
