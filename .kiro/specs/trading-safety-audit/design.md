# Trading Safety Audit — CLOB_PRICE_MAX Bugfix Design

## Overview

The `CLOB_PRICE_MAX` constant is `0.999` but Polymarket supports tick size `0.0001` with prices up to `0.9999`. This one-constant mismatch cascades through price clamping, order validation, and market buy fallback logic — silently rejecting or altering user orders in the 99.91¢–99.99¢ range on fine-tick markets. The fix updates the constant to `0.9999`, replaces a hardcoded `0.999` in `computeMarketBuyPrice`, and corrects a stale comment.

## Glossary

- **Bug_Condition (C)**: Any order or price operation targeting a price in the range (0.999, 0.9999] on a fine-tick (0.0001) market
- **Property (P)**: `roundPriceToTick` and `isPriceValidForTickSize` produce correct, consistent results for all valid tick sizes including 0.0001, and prices up to 0.9999
- **Preservation**: All existing behavior for tick sizes 0.1, 0.01, 0.001 and prices ≤ 0.999 must remain identical
- **CLOB_PRICE_MAX**: Shared constant in `packages/types/src/constants.ts` defining the tradeable price ceiling; consumed by `roundPriceToTick`, `clampPrice`, `validateOrder`, `roundToTickSize`, and order form UI
- **roundPriceToTick**: Function in `trading-utils.ts` that snaps a price to the nearest tick multiple within [tickSize, CLOB_PRICE_MAX]
- **isPriceValidForTickSize**: Function in `order-validation.ts` that checks if a price is an exact multiple of the tick size using integer arithmetic
- **computeMarketBuyPrice**: Function in `market-sell-shared.ts` that computes worst-price limit for market BUY orders; has a hardcoded `0.999` fallback clamp

## Bug Details

### Bug Condition

The bug manifests when a user attempts to trade at prices in the range (0.999, 0.9999] on a market with tick size 0.0001. The constant `CLOB_PRICE_MAX = 0.999` causes `roundPriceToTick`, `clampPrice`, `validateOrder`, and `roundToTickSize` to reject or silently clamp these valid prices. Additionally, `computeMarketBuyPrice` has a hardcoded `Math.min(0.999, raw)` that independently enforces the wrong ceiling.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { price: number, tickSize: number }
  OUTPUT: boolean

  RETURN input.tickSize == 0.0001
         AND input.price > 0.999
         AND input.price <= 0.9999
         AND isMultipleOf(input.price, input.tickSize)
END FUNCTION
```

### Examples

- **Limit order at 0.9991 on 0.0001-tick market**: Expected — order accepted. Actual — rejected with "Price must be between 0.0001 and 0.999"
- **Limit order at 0.9999 on 0.0001-tick market**: Expected — order accepted at 0.9999. Actual — `roundPriceToTick` clamps to 0.999, silently changing user intent
- **Market BUY with best ask at 0.9995**: Expected — buy price set to 0.9995. Actual — `computeMarketBuyPrice` fallback clamps to `Math.min(0.999, 0.9995)` = 0.999
- **Orderbook shows ask at 0.9993**: Expected — user can click and trade at 0.9993. Actual — orderbook displays it (MAX_VALID_PRICE = 0.9999) but order form rejects it (CLOB_PRICE_MAX = 0.999)
- **Limit order at 0.95 on 0.01-tick market**: Not a bug — price is within [0.01, 0.999] and unaffected by the change

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Orders on 0.01-tick markets at prices 0.01–0.99 continue to validate and round correctly
- Orders on 0.001-tick markets at prices 0.001–0.999 continue to validate and round correctly
- Orders on 0.1-tick markets at prices 0.1–0.9 continue to validate and round correctly
- `isPriceValidForTickSize` integer arithmetic logic is unchanged
- `roundPriceToTick` rounding logic (snap to nearest tick, decimal truncation) is unchanged for prices ≤ 0.999
- Orderbook store filtering with MIN_VALID_PRICE / MAX_VALID_PRICE is unchanged (already uses 0.9999)
- `sellableSharesAtTick` chain-precision flooring is unchanged
- Order validation for size, token ID, post-only, and GTD expiration is unchanged

**Scope:**
All inputs where `price ≤ 0.999` or `tickSize ≥ 0.001` are completely unaffected by this fix. The only behavioral change is extending the valid price ceiling from 0.999 to 0.9999, which only matters for 0.0001-tick markets.

## Hypothesized Root Cause

Based on the bug description, the root cause is straightforward:

1. **Incorrect Constant Value**: `CLOB_PRICE_MAX = 0.999` in `packages/types/src/constants.ts` was set before Polymarket introduced the 0.0001 tick size. The correct ceiling is 0.9999 (one tick below 1.0 at the finest granularity).

2. **Hardcoded Duplicate**: `computeMarketBuyPrice` in `market-sell-shared.ts` has `Math.min(0.999, raw)` instead of using the shared `CLOB_PRICE_MAX` constant. This is a copy-paste artifact that independently enforces the wrong ceiling even if the constant were fixed.

3. **Stale Comment**: The `PRICE_MAX` re-export in `order-form.hooks.ts` has a comment saying "Max price 99.9¢" which will be incorrect after the constant update.

## Correctness Properties

Property 1: Bug Condition — roundPriceToTick produces valid tick-aligned prices up to 0.9999

_For any_ tick size in {0.1, 0.01, 0.001, 0.0001} and any valid price where tickSize ≤ price ≤ CLOB_PRICE_MAX (0.9999), `roundPriceToTick(price, tickSize)` SHALL produce a value that is a valid multiple of tickSize AND within [tickSize, 0.9999].

**Validates: Requirements 2.1, 2.2, 2.5**

Property 2: Preservation — roundPriceToTick ∘ isPriceValidForTickSize round-trip

_For any_ tick size in {0.1, 0.01, 0.001, 0.0001} and any valid price, `isPriceValidForTickSize(roundPriceToTick(price, tickSize), tickSize)` SHALL return true, preserving the existing round-trip invariant for all tick sizes.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `packages/types/src/constants.ts`

**Constant**: `CLOB_PRICE_MAX`

**Specific Changes**:
1. **Update constant value**: Change `CLOB_PRICE_MAX = 0.999` to `CLOB_PRICE_MAX = 0.9999`
2. **Update comment**: Change "CLOB tradeable price ceiling (99.9¢)" to "CLOB tradeable price ceiling (99.99¢). Decimal 0.9999; 100¢ (1.0) is not tradeable."

---

**File**: `apps/web/src/lib/trading/market-sell-shared.ts`

**Function**: `computeMarketBuyPrice`

**Specific Changes**:
3. **Replace hardcoded 0.999**: Change `Math.min(0.999, raw)` to `Math.min(CLOB_PRICE_MAX, raw)`
4. **Add import**: Add `CLOB_PRICE_MAX` to the import from `@doji/types`

---

**File**: `apps/web/src/components/trading/orders/order-form.hooks.ts`

**Constant**: `PRICE_MAX`

**Specific Changes**:
5. **Update comment**: Change `/** Max price 99.9¢; 100¢ (1.0) is not tradeable. */` to `/** Max price 99.99¢; 100¢ (1.0) is not tradeable. */`

### No Changes Needed

- `roundPriceToTick` in `trading-utils.ts` — the `else` branch already handles 4 decimals correctly for tickSize < 0.001
- `isPriceValidForTickSize` in `order-validation.ts` — integer arithmetic is tick-size agnostic
- `clampPrice` in `execute-market-order.ts` — already uses `CLOB_PRICE_MAX` (will pick up new value)
- `validateOrder` in `order-validation.ts` — already uses `CLOB_PRICE_MAX` (will pick up new value)
- `orderbook.ts` — already uses `MAX_VALID_PRICE = 0.9999`
- `roundToTickSize` in `order-form.hooks.ts` — uses `PRICE_MAX` which re-exports `CLOB_PRICE_MAX`

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Call `roundPriceToTick` and `isPriceValidForTickSize` with prices in the (0.999, 0.9999] range and tick size 0.0001. Run on UNFIXED code to observe clamping/rejection.

**Test Cases**:
1. **roundPriceToTick clamps 0.9991**: `roundPriceToTick(0.9991, 0.0001)` returns 0.999 instead of 0.9991 (will fail on unfixed code)
2. **roundPriceToTick clamps 0.9999**: `roundPriceToTick(0.9999, 0.0001)` returns 0.999 instead of 0.9999 (will fail on unfixed code)
3. **validateOrder rejects 0.9995**: Order at price 0.9995 with tick 0.0001 is rejected (will fail on unfixed code)
4. **computeMarketBuyPrice clamps high ask**: `computeMarketBuyPrice(0.9995, 0.5, 0.0001)` clamps to 0.999 (will fail on unfixed code)

**Expected Counterexamples**:
- `roundPriceToTick(0.9993, 0.0001)` → 0.999 (should be 0.9993)
- `validateOrder({price: 0.9991, ...}, {tick: 0.0001})` → invalid (should be valid)
- Cause: `CLOB_PRICE_MAX = 0.999` used in `Math.min` clamp

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := roundPriceToTick_fixed(input.price, input.tickSize)
  ASSERT result == input.price  // price is already tick-aligned
  ASSERT result >= input.tickSize
  ASSERT result <= 0.9999
  ASSERT isPriceValidForTickSize(result, input.tickSize) == true
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT roundPriceToTick_original(input.price, input.tickSize)
       = roundPriceToTick_fixed(input.price, input.tickSize)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain
- It catches edge cases that manual unit tests might miss (e.g. floating-point boundary issues at 0.999)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for prices ≤ 0.999 across all tick sizes, then write property-based tests capturing that behavior.

**Test Cases**:
1. **0.01-tick preservation**: Verify `roundPriceToTick` produces identical results for prices 0.01–0.99 with tick 0.01 before and after fix
2. **0.001-tick preservation**: Verify `roundPriceToTick` produces identical results for prices 0.001–0.999 with tick 0.001 before and after fix
3. **0.1-tick preservation**: Verify `roundPriceToTick` produces identical results for prices 0.1–0.9 with tick 0.1 before and after fix
4. **Validation preservation**: Verify `isPriceValidForTickSize` returns identical results for all prices ≤ 0.999

### Unit Tests

- Test `roundPriceToTick` with prices 0.9991–0.9999 and tick 0.0001
- Test `roundPriceToTick` boundary: price exactly 0.9999 with tick 0.0001
- Test `roundPriceToTick` rejects price > 0.9999 (e.g. 1.0, 0.99999)
- Test `isPriceValidForTickSize` accepts 0.9991, 0.9995, 0.9999 with tick 0.0001
- Test `computeMarketBuyPrice` fallback path uses CLOB_PRICE_MAX (not hardcoded 0.999)
- Test `validateOrder` accepts orders at 0.9991–0.9999 with tick 0.0001

### Property-Based Tests

- Generate random prices in [0.0001, 0.9999] and random tick sizes from {0.1, 0.01, 0.001, 0.0001}; verify `roundPriceToTick` output is within [tickSize, 0.9999] and is a valid tick multiple
- Generate random prices and tick sizes; verify `isPriceValidForTickSize(roundPriceToTick(price, tickSize), tickSize)` always returns true (round-trip invariant)
- Generate random prices ≤ 0.999 and all tick sizes; verify fixed `roundPriceToTick` matches original behavior (preservation)

### Integration Tests

- Test full order submission flow with price 0.9995 on a 0.0001-tick market (order form → validation → round → submit)
- Test orderbook click at 0.9993 prefills order form and passes validation
- Test market BUY with best ask at 0.9997 computes correct fill price
