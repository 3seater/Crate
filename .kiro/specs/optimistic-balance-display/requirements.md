# Requirements Document

## Introduction

The order form and instant trade popup currently display share balances that lag behind the positions tab by up to 5 seconds. The positions tab updates instantly via WebSocket-local positions (`usePositionsStore`) merged with chain/API data through `mergeMarketPositionsForCondition`. The order form (in both `TradingLayout` and `TradingLayoutTerminal`) and instant trade popup compute `positionSize` only from polled chain balances (`trpc.data.ctfTokenBalances`) and Data API positions (`trpc.data.positions`), plus pending balance deltas. They do not subscribe to `usePositionsStore`, causing a visible delay after trades.

This feature incorporates WebSocket-local position data into the order form and instant trade popup balance computations, using the same merge strategy the positions tab already employs to prevent double-counting.

## Glossary

- **Order_Form**: The trading form component (`OrderForm`) rendered in `TradingLayout` and `TradingLayoutTerminal` that accepts buy/sell orders. Receives `positionSize` as a prop from its parent layout.
- **Instant_Trade_Popup**: The quick-trade popup component (`InstantTradePopup`) that computes `positionSize` internally via `useInstantTradeData`.
- **Positions_Tab**: The existing positions display that uses `useMergedMarketPositions` to show instantly-updated share balances.
- **Balance_Display**: The numeric share balance shown to the user in the Order_Form and Instant_Trade_Popup, used for sell-side availability and position display.
- **Positions_Store**: The Zustand store (`usePositionsStore`) containing `LocalPosition[]` updated instantly from WebSocket trade events.
- **Pending_Deltas_Store**: The Zustand store (`usePendingBalanceDeltasStore`) containing pending balance deltas applied immediately on trade confirmation, with baseline-based anti-double-counting via `getEffectiveBalance`.
- **Chain_Balance**: The on-chain CTF token balance fetched via `trpc.data.ctfTokenBalances`, polled at intervals (5–15 seconds).
- **API_Position**: The position data fetched via `trpc.data.positions` from the Data API, with a stale time of ~5 seconds.
- **Merge_Logic**: The function `mergeMarketPositionsForCondition` that combines API positions, chain balances, pending deltas, and WebSocket-local positions into a single consistent view without double-counting.
- **CLOB**: The Central Limit Order Book that matches and settles trades; returns "not enough balance" if a sell is attempted before on-chain settlement.

## Requirements

### Requirement 1: Incorporate WebSocket-Local Positions into Order Form Balance

**User Story:** As a trader, I want the order form to show my updated share balance immediately after a trade, so that I can place follow-up orders without waiting for chain/API polling.

#### Acceptance Criteria

1. WHEN a WebSocket trade event updates the Positions_Store, THE Order_Form SHALL reflect the updated balance within the same render cycle as the Positions_Tab.
2. THE Order_Form parent layouts (`TradingLayout` and `TradingLayoutTerminal`) SHALL subscribe to the Positions_Store and incorporate local positions into the `positionSizeForToken` computation.
3. WHILE the Positions_Store contains a local position for a token and the Chain_Balance has not yet updated, THE Order_Form SHALL display the optimistic balance derived from the local position rather than the stale Chain_Balance.
4. WHEN the Chain_Balance catches up to reflect the trade, THE Order_Form SHALL display the Chain_Balance value and the local position SHALL no longer inflate the result.

### Requirement 2: Incorporate WebSocket-Local Positions into Instant Trade Popup Balance

**User Story:** As a trader, I want the instant trade popup to show my updated share balance immediately after a trade, so that I see consistent balances across all trading surfaces.

#### Acceptance Criteria

1. WHEN a WebSocket trade event updates the Positions_Store, THE Instant_Trade_Popup SHALL reflect the updated balance within the same render cycle as the Positions_Tab.
2. THE Instant_Trade_Popup SHALL subscribe to the Positions_Store and incorporate local positions into its `positionSize` computation inside `useInstantTradeData`.
3. WHILE the Positions_Store contains a local position for a token and the Chain_Balance has not yet updated, THE Instant_Trade_Popup SHALL display the optimistic balance derived from the local position rather than the stale Chain_Balance.
4. WHEN the Chain_Balance catches up to reflect the trade, THE Instant_Trade_Popup SHALL display the Chain_Balance value and the local position SHALL no longer inflate the result.

### Requirement 3: Prevent Double-Counting Across Data Sources

**User Story:** As a trader, I want my displayed balance to be accurate regardless of which data sources have updated, so that I never see an inflated or deflated share count.

#### Acceptance Criteria

1. THE Balance_Display SHALL apply the same anti-double-counting Merge_Logic used by the Positions_Tab when combining Chain_Balance, API_Position, Positions_Store, and Pending_Deltas_Store data.
2. WHEN the Chain_Balance reports 100 shares and the Positions_Store also reflects 100 shares from the same trade, THE Balance_Display SHALL show 100 shares, not 200.
3. WHEN the Positions_Store contains a local position for a token that also exists in the API_Position data, THE Balance_Display SHALL use the higher of the two values (for buys) or the lower of the two values (for sells), consistent with the Merge_Logic.
4. THE Balance_Display SHALL use `getEffectiveBalance` from the Pending_Deltas_Store to reconcile pending deltas with server balances, preserving the existing baseline-based anti-double-counting behavior.

### Requirement 4: Prevent Visual Glitching During Data Source Convergence

**User Story:** As a trader, I want the balance display to transition smoothly as data sources converge, so that I never see momentary jumps or flickers in my share count.

#### Acceptance Criteria

1. WHEN the Chain_Balance updates to reflect a previously optimistic balance, THE Balance_Display SHALL transition from the optimistic value to the chain value without displaying any intermediate value that differs from both.
2. THE Balance_Display SHALL produce a monotonically consistent value: for a buy, the displayed balance SHALL only increase or stay the same as data sources converge; for a sell, the displayed balance SHALL only decrease or stay the same.
3. IF the Positions_Store and Chain_Balance update in rapid succession, THEN THE Balance_Display SHALL not render a frame where the balance temporarily exceeds the correct value (overshoot) or drops below it (undershoot).

### Requirement 5: Safe Degradation for Pre-Settlement Sells

**User Story:** As a trader, I want to be able to attempt a sell using my optimistic balance without the UI breaking, so that I get a clear error from the CLOB if the on-chain settlement has not completed.

#### Acceptance Criteria

1. WHILE the Balance_Display shows an optimistic sell-side balance from the Positions_Store that has not yet settled on-chain, THE Order_Form SHALL allow the user to submit a sell order for up to the displayed amount.
2. IF the CLOB returns a "not enough balance" error because on-chain settlement has not completed, THEN THE Order_Form SHALL display the error message to the user using the existing error handling flow.
3. IF the CLOB returns a "not enough balance" error because on-chain settlement has not completed, THEN THE Instant_Trade_Popup SHALL display the error message to the user using the existing error handling flow.
4. THE Order_Form and Instant_Trade_Popup SHALL not add client-side guards that prevent sell submission based on on-chain settlement status; the CLOB error response is the authoritative rejection mechanism.

### Requirement 6: Reuse Existing Merge Infrastructure

**User Story:** As a developer, I want the order form and instant trade popup to reuse the same merge logic as the positions tab, so that balance computation behavior is consistent and maintainable.

#### Acceptance Criteria

1. THE Order_Form and Instant_Trade_Popup balance computations SHALL reuse `getEffectiveBalance` from the Pending_Deltas_Store and the local position overlay pattern from `mergeMarketPositionsForCondition`, rather than implementing separate merge logic.
2. WHEN the Merge_Logic in `mergeMarketPositionsForCondition` is updated, THE Order_Form and Instant_Trade_Popup SHALL benefit from the same update without requiring separate changes, by sharing the underlying merge utility or pattern.
3. THE implementation SHALL not duplicate the merge algorithm; shared helper functions or a shared hook SHALL be used to compute the effective balance for a single token across all three surfaces (Positions_Tab, Order_Form, Instant_Trade_Popup).
