# Bugfix Requirements Document

## Introduction

Comprehensive audit of the trading experience across all order entry surfaces (order form, instant trade popup, quick-sell modal) and position display surfaces (market terminal, portfolio page). The audit covers 8 user-reported concerns around consistency, accuracy, and data freshness. Two confirmed bugs require code fixes; the remaining items were verified as working correctly or are inherent API latency characteristics.

**Confirmed Bugs:**
1. Trade history records the wrong side (SELL instead of BUY) for resting limit order fills in the local positions store.
2. Portfolio page position count badge shows stale data because it relies solely on the Data API without the merged position logic used on the market terminal.

**Verified Working (no code changes needed):**
- Market buy/sell consistency across instant trade popup and order form (both use shared `executeMarketBuy`/`executeMarketSell`).
- Cross-surface buy/sell interop (order form buy → instant trade sell, and vice versa) works because all surfaces share the same CLOB posting, WebSocket event processing, and query invalidation paths.
- Instant trade popup Bought/Sold/PNL stats use the Data API (`trpc.data.trades`) which records the correct side server-side.
- Split data accuracy (chain-only row synthesis works correctly when both yes/no are missing).
- Limit order book-walking behavior matches Polymarket (GTC orders are marketable and walk the book).
- Limit buy/sell toast correctly identifies the resting order's side via `getRestingLimitSide`.
- Balance/shares update timing for limit fills uses the same `addDelta` mechanism as market orders.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a resting limit BUY order fills via WebSocket AND `tradeRecordFromEvent()` is called in `apps/web/src/stores/positions.ts` THEN the system records `event.side` (the taker's SELL side) in the `TradeRecord.side` field instead of the user's actual BUY side, because `tradeRecordFromEvent` does not accept or use the `effectiveSide` parameter that `applyTradeToPositions` correctly uses.

1.2 WHEN a resting limit SELL order fills via WebSocket AND `tradeRecordFromEvent()` is called THEN the system records `event.side` (the taker's BUY side) in the `TradeRecord.side` field instead of the user's actual SELL side.

1.3 WHEN the user navigates to the portfolio page AND a position was just closed or opened on the market terminal THEN the position count badge beside "Positions" on the portfolio page shows the old count for up to 5-30 seconds because `use-portfolio-data.ts` computes `positionsCount` from `trpc.data.positions` (Data API with `staleTime: 5000`) without incorporating WebSocket events, pending balance deltas, or on-chain balances that the market terminal's `useMergedMarketPositions` hook uses.

1.4 WHEN the user has zero positions remaining on the market terminal (confirmed via merged position logic) AND they switch to the portfolio page THEN the portfolio page badge may still show "2 positions" (or a stale count) because the Data API has not yet indexed the final trade.

### Expected Behavior (Correct)

2.1 WHEN a resting limit BUY order fills via WebSocket THEN the system SHALL record `side: "BUY"` in the `TradeRecord` by passing the `effectiveSide` to `tradeRecordFromEvent`, matching the behavior of `applyTradeToPositions` which already uses `effectiveSide`.

2.2 WHEN a resting limit SELL order fills via WebSocket THEN the system SHALL record `side: "SELL"` in the `TradeRecord`, consistent with the user's actual order direction.

2.3 WHEN the user navigates to the portfolio page THEN the position count badge SHALL reflect the most current position count available, incorporating the same merged position logic (or an equivalent fast-path) that the market terminal uses, so the count is consistent across both pages within a few seconds.

2.4 WHEN the user has zero positions remaining on the market terminal AND they switch to the portfolio page THEN the portfolio page badge SHALL show 0 positions (or at minimum, converge to 0 within the same timeframe as the market terminal).

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a market order (non-resting) fills via WebSocket THEN the system SHALL CONTINUE TO record the correct side in both `TradeRecord` and position updates, since `event.side` is already correct for market orders (taker = user).

3.2 WHEN `applyTradeToPositions` is called with an `effectiveSide` override THEN the system SHALL CONTINUE TO use `effectiveSide` for position size calculations (BUY adds, SELL subtracts) exactly as it does today.

3.3 WHEN the portfolio page loads positions from the Data API THEN the system SHALL CONTINUE TO display accurate position data (size, avgPrice, PNL) from the API response — the badge fix must not alter the position row data itself.

3.4 WHEN the market terminal displays the position count badge THEN the system SHALL CONTINUE TO use the existing `useMergedMarketPositions` hook with its current merge logic (API + chain + pending deltas + local positions).

3.5 WHEN the instant trade popup computes Bought/Sold/PNL stats THEN the system SHALL CONTINUE TO use the Data API trades (`trpc.data.trades`) as the source of truth, which is unaffected by the local store bug since the Data API records the correct side server-side.

3.6 WHEN limit order fill toasts are shown via `maybeShowLimitFillToast` THEN the system SHALL CONTINUE TO display the correct side ("Limit Buy Succeeded" / "Limit Sell Succeeded") using `getRestingLimitSide`, which is already correct.

3.7 WHEN the quick-sell modal executes a sell THEN the system SHALL CONTINUE TO use the same `placeMarketOrderClient` and `getMarketSellPrice` functions with orderbook walking, unaffected by these fixes.

---

## Bug Condition Analysis

### Bug 1: Trade Record Wrong Side

```pascal
FUNCTION isBugCondition_WrongSide(X)
  INPUT: X of type { event: UserTradeEvent, effectiveSide: "BUY" | "SELL" | undefined }
  OUTPUT: boolean
  
  // Bug triggers when effectiveSide differs from event.side (resting limit fill)
  RETURN X.effectiveSide IS NOT undefined
     AND X.effectiveSide ≠ X.event.side
END FUNCTION
```

```pascal
// Property: Fix Checking - Trade Record Side
FOR ALL X WHERE isBugCondition_WrongSide(X) DO
  record ← tradeRecordFromEvent'(X.event, X.effectiveSide)
  ASSERT record.side = X.effectiveSide
END FOR
```

```pascal
// Property: Preservation Checking - Market Order Trade Records
FOR ALL X WHERE NOT isBugCondition_WrongSide(X) DO
  ASSERT tradeRecordFromEvent(X.event) = tradeRecordFromEvent'(X.event)
END FOR
```

### Bug 2: Portfolio Position Count Badge Stale

```pascal
FUNCTION isBugCondition_StaleBadge(X)
  INPUT: X of type { dataApiPositionCount: number, mergedPositionCount: number }
  OUTPUT: boolean
  
  // Bug triggers when Data API count diverges from the merged (real-time) count
  RETURN X.dataApiPositionCount ≠ X.mergedPositionCount
END FUNCTION
```

```pascal
// Property: Fix Checking - Portfolio Badge Freshness
FOR ALL X WHERE isBugCondition_StaleBadge(X) DO
  badgeCount ← portfolioBadge'(X)
  ASSERT badgeCount = X.mergedPositionCount
END FOR
```

```pascal
// Property: Preservation Checking - Portfolio Badge When In Sync
FOR ALL X WHERE NOT isBugCondition_StaleBadge(X) DO
  ASSERT portfolioBadge(X) = portfolioBadge'(X)
END FOR
```
