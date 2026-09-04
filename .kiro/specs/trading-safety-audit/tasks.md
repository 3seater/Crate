# Tasks — Trading Safety Audit (CLOB_PRICE_MAX Bugfix)

## Task 1: Update CLOB_PRICE_MAX constant

- [x] 1.1 In `packages/types/src/constants.ts`, change `CLOB_PRICE_MAX = 0.999` to `CLOB_PRICE_MAX = 0.9999`
- [x] 1.2 Update the comment to: `/** CLOB tradeable price ceiling (99.99¢). Decimal 0.9999; 100¢ (1.0) is not tradeable. */`

## Task 2: Remove hardcoded 0.999 in computeMarketBuyPrice

- [x] 2.1 In `apps/web/src/lib/trading/market-sell-shared.ts`, add `CLOB_PRICE_MAX` to the import from `@doji/types`
- [x] 2.2 In `computeMarketBuyPrice`, change `Math.min(0.999, raw)` to `Math.min(CLOB_PRICE_MAX, raw)`

## Task 3: Update PRICE_MAX comment in order-form.hooks.ts

- [x] 3.1 In `apps/web/src/components/trading/orders/order-form.hooks.ts`, update the comment from `/** Max price 99.9¢; 100¢ (1.0) is not tradeable. */` to `/** Max price 99.99¢; 100¢ (1.0) is not tradeable. */`

## Task 4: Write property-based tests

- [x] 4.1 [PBT: Property 1] Write a property test that for any tick size in {0.1, 0.01, 0.001, 0.0001} and any valid price (tickSize ≤ price ≤ 0.9999), `roundPriceToTick(price, tickSize)` produces a value that is a valid multiple of tickSize AND within [tickSize, 0.9999]
- [x] 4.2 [PBT: Property 2] Write a property test that for any tick size in {0.1, 0.01, 0.001, 0.0001} and any valid price, `isPriceValidForTickSize(roundPriceToTick(price, tickSize), tickSize)` returns true

## Task 5: Write unit tests for bug condition

- [x] 5.1 Test `roundPriceToTick` with prices 0.9991, 0.9995, 0.9999 and tick 0.0001 — assert output equals input
- [x] 5.2 Test `roundPriceToTick` rejects price > 0.9999 (clamps to 0.9999)
- [x] 5.3 Test `isPriceValidForTickSize` accepts 0.9991, 0.9995, 0.9999 with tick 0.0001
- [x] 5.4 Test `computeMarketBuyPrice` fallback with bestAsk=0.9995 does not clamp below 0.9995
- [x] 5.5 Test `validateOrder` accepts order at price 0.9995 with tick 0.0001
