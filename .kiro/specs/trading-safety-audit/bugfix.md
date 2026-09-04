# Bugfix Requirements Document

## Introduction

The `CLOB_PRICE_MAX` constant is set to `0.999` but Polymarket supports tick size `0.0001` with prices up to `0.9999`. This causes a cascade of issues: users cannot place limit orders in the 99.91¢–99.99¢ range on fine-tick markets, the orderbook store can display prices that the order form rejects, and price clamping silently alters user intent. Additionally, `computeMarketBuyPrice` has a hardcoded `0.999` clamp that bypasses the shared constant.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user places a limit order at a price between 0.9991 and 0.9999 on a fine-tick (0.0001) market THEN the system rejects the order with "Price must be between {min} and 0.999"

1.2 WHEN `roundPriceToTick` is called with a price in the range (0.999, 0.9999] and tick size 0.0001 THEN the system clamps the price to 0.999 via `Math.min(CLOB_PRICE_MAX, ...)`, silently changing the user's intended price

1.3 WHEN the orderbook contains bid/ask levels at prices 0.9991–0.9999 THEN the orderbook store displays them correctly (MAX_VALID_PRICE = 0.9999) but the order form rejects orders at those prices (CLOB_PRICE_MAX = 0.999), creating an inconsistency where users see prices they cannot trade at

1.4 WHEN `computeMarketBuyPrice` falls back to simple best-ask logic THEN the system clamps the price with a hardcoded `Math.min(0.999, raw)` instead of using the shared `CLOB_PRICE_MAX` constant

1.5 WHEN `clampPrice` in execute-market-order.ts caps a price THEN the system uses `CLOB_PRICE_MAX` (0.999), preventing market orders from reaching the 0.9991–0.9999 range on fine-tick markets

### Expected Behavior (Correct)

2.1 WHEN a user places a limit order at a price between 0.9991 and 0.9999 on a fine-tick (0.0001) market THEN the system SHALL accept the order if the price is a valid multiple of the tick size

2.2 WHEN `roundPriceToTick` is called with a price in the range (0.999, 0.9999] and tick size 0.0001 THEN the system SHALL round to the nearest tick without clamping below 0.9999

2.3 WHEN the orderbook contains bid/ask levels at prices 0.9991–0.9999 THEN the order form SHALL accept orders at those prices, consistent with what the orderbook store displays

2.4 WHEN `computeMarketBuyPrice` falls back to simple best-ask logic THEN the system SHALL use the shared `CLOB_PRICE_MAX` constant instead of a hardcoded value

2.5 WHEN `clampPrice` caps a price THEN the system SHALL use `CLOB_PRICE_MAX = 0.9999`, allowing market orders to reach the full fine-tick price range

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user places a limit order on a 0.01 tick market at prices 0.01–0.99 THEN the system SHALL CONTINUE TO accept valid orders and reject prices outside that range

3.2 WHEN a user places a limit order on a 0.001 tick market at prices 0.001–0.999 THEN the system SHALL CONTINUE TO accept valid orders and reject prices outside that range

3.3 WHEN `roundPriceToTick` is called with prices in the normal range (below 0.999) for any tick size THEN the system SHALL CONTINUE TO round correctly to the nearest tick

3.4 WHEN `isPriceValidForTickSize` validates a price against a tick size THEN the system SHALL CONTINUE TO use integer arithmetic to avoid floating-point errors

3.5 WHEN the orderbook store filters crossing orders and invalid boundary levels THEN the system SHALL CONTINUE TO filter correctly using MIN_VALID_PRICE and MAX_VALID_PRICE

3.6 WHEN `sellableSharesAtTick` computes sellable shares THEN the system SHALL CONTINUE TO floor to both chain precision and tick size

3.7 WHEN order validation checks size, token ID, post-only, and GTD expiration THEN the system SHALL CONTINUE TO enforce those constraints unchanged
