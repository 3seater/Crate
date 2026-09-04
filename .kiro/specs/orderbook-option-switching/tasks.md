# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — Multi-Token Book Isolation & Independent Prices
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the five interrelated orderbook switching bugs
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases:
    - Bug 1 (Stale Book on Market Switch): Call `setBookForToken("tokenA", bidsA, asksA)`, then switch active token to `"tokenB"` (which has no book entry). Assert flat root fields (`bids`, `asks`, `spread`, `midpoint`) show `emptyBook` or tokenB's cached data — NOT tokenA's stale data. On unfixed code, flat fields retain tokenA's data for ~10s.
    - Bug 2 (applyPriceChange Ignores Non-Active Token): Set active token to `"tokenA"`, call `applyPriceChange` with changes whose `asset_id` matches `"tokenB"`. Assert `books["tokenB"]` is updated with the price changes. On unfixed code, `applyPriceChange` only updates the active token and silently drops changes for non-active tokens.
    - Bug 3 (Identical Button Prices): Populate `books["yesToken"]` with bestAsk=0.52 and `books["noToken"]` with bestAsk=0.48. Read prices via `getBook(state, yesTokenId).bestAsk` and `getBook(state, noTokenId).bestAsk`. Assert yesPrice=0.52 and noPrice=0.48 independently. On unfixed code, sticky refs cause both to show the same price.
    - Bug 4 (Non-Selected Side Stale Price): With active token `"yesToken"`, simulate a WS `price_change` event for `"noToken"`. Assert `books["noToken"]` reflects the updated price. On unfixed code, the WS handler filters out events for non-active tokens.
    - Bug 5 (Swapped Bids/Asks Race): Simulate `setTokenId("tokenB")` followed by `setBook(tokenA_data)` in sequence. Assert flat fields don't show tokenA data when active token is tokenB. On unfixed code, non-atomic transitions cause a mismatch.
  - Test file: `tests/unit/orderbook-option-switching.test.ts`
  - Test the orderbook Zustand store state transitions directly: `setBookForToken`, `applyPriceChange` (current behavior), `setTokenId`, and `getBook` helper
  - Test WS event routing logic by simulating `handleBook` and `handlePriceChange` callbacks with events for both active and complementary tokens
  - Run test on UNFIXED code — expect FAILURE (this confirms the bugs exist)
  - Document counterexamples found (e.g., "`applyPriceChange` silently drops changes for non-active tokens", "`books['noToken']` never updated by WS events", "flat fields retain stale tokenA data after switching to tokenB")
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_


- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Single-Market Orderbook & WS Infrastructure Behavior
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe on UNFIXED code**:
    - `setBook(bids, asks)` for the active token produces correct flat root fields (bids sorted desc, asks sorted asc, spread, midpoint, bestBid, bestAsk, depth computed)
    - `applyPriceChange(changes)` for the active token applies incremental updates with binary-search insert, deduplication, and correct depth recomputation
    - `bookHash` deduplication: calling `setBook` with identical data twice skips the second update (no state change)
    - Depth guard: calling `setBook` with a shallower snapshot (fewer levels) than the current store data skips the update (prevents depth flash)
    - `preloadBook(tokenId, data)` writes to `books` map without changing active tokenId or flat root fields
    - `setBookForToken(tokenId, data)` atomically sets both tokenId and book data in a single `set()` call
    - `getBook(state, tokenId)` returns the token's book from the `books` map, or `emptyBook` if not found
    - Single-market (SMP) orderbook with real-time WS updates continues to work identically
  - Write property-based tests capturing observed behavior patterns:
    - For all random bids/asks arrays, `setBook` produces flat fields with bids sorted descending by price, asks sorted ascending by price, correct spread (bestAsk - bestBid), correct midpoint, and correct depth values
    - For all random price change arrays targeting the active token, `applyPriceChange` produces the same result as rebuilding the book from scratch with the merged levels
    - For all duplicate book snapshots (same hash), the second `setBook` call is a no-op (state reference unchanged)
    - For all shallow snapshots (fewer total levels than current), `setBook` skips the update when the existing book has more depth
    - For all single-token operations (no market/side switching), the fixed store produces identical output to the original store
  - Test file: `tests/unit/orderbook-option-switching-preservation.test.ts`
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Fix orderbook option switching bugs

  - [x] 3.1 Add `applyPriceChangeForToken`, `updateLastTradePriceForToken`, and `updateBestBidAskForToken` actions to orderbook store
    - In `apps/web/src/features/trading/stores/orderbook.ts`:
      1. Add `applyPriceChangeForToken(tokenId, changes)` action that applies incremental price changes to the specified token's book in the `books` map, using the same binary-search insert and deduplication logic as `applyPriceChange`. Update flat root fields only if `tokenId === state.tokenId` (active token).
      2. Add `updateLastTradePriceForToken(tokenId, price, side)` action that updates `lastTradePrice`/`lastTradeSide` in the specified token's `books` map entry. Update flat root fields only if active.
      3. Add `updateBestBidAskForToken(tokenId, bestBid, bestAsk)` action that updates bestBid/bestAsk in the specified token's `books` map entry. Apply the existing guard (ignore on empty books). Update flat root fields only if active.
    - _Bug_Condition: isBugCondition(input) where input.wsEvent.asset_id != store.tokenId AND store.books[input.wsEvent.asset_id] NOT updated_
    - _Expected_Behavior: Both active and non-active token books receive incremental updates via the books map_
    - _Preservation: Active-token applyPriceChange behavior unchanged; debounce/batch pipeline, flash animations, binary-search insert, deduplication all preserved_
    - _Requirements: 1.4, 2.4, 3.1, 3.2, 3.6_

  - [x] 3.2 Route WS events by asset_id in use-orderbook hook
    - In `apps/web/src/features/trading/hooks/use-orderbook.ts`:
      1. In `handleBook`: Instead of filtering `event.asset_id !== tokenId`, use `setBookForToken` when the event is for the selected token and `preloadBook` when it's for the complementary token. Both tokens' books stay live in the `books` map.
      2. In `handlePriceChange` / `transformPriceChanges`: Instead of filtering `c.asset_id !== tokenId`, partition changes by `asset_id` and apply them to the correct token's book using `applyPriceChangeForToken(assetTokenId, changes)`.
      3. In `handleLastTradePrice`: Instead of filtering `event.asset_id === tokenId`, call `updateLastTradePriceForToken(event.asset_id, ...)` for any event whose `asset_id` is in `assetIds`.
      4. In `handleBestBidAsk`: Instead of filtering to active token only, call `updateBestBidAskForToken(event.asset_id, ...)` for any event whose `asset_id` is in `assetIds`.
      5. Seed both tokens from query cache on market switch: When the hook mounts or `tokenId` changes, also seed the complementary token's book from query cache via `preloadBook`.
    - _Bug_Condition: isBugCondition(input) where input.wsEventReceived AND input.wsEvent.asset_id != store.tokenId AND WS handler filters out the event_
    - _Expected_Behavior: Both Yes and No token books receive live WS updates regardless of which is active_
    - _Preservation: WS reconnect refetch, subscription registry ref-counting, debounce/batch timing (120ms/250ms), depth guard all unchanged_
    - _Requirements: 1.1, 1.2, 1.4, 2.1, 2.2, 2.4, 3.4, 3.5_

  - [x] 3.3 Replace sticky WS refs with direct store reads in MarketTradingContext
    - In `apps/web/src/features/trading/components/market/market-trading-context.tsx`:
      1. Replace `yesWsAskRef`/`noWsAskRef`/`yesWsBidRef`/`noWsBidRef` sticky refs with direct store selectors: `useOrderbookStore(s => getBook(s, yesTokenId)?.bestAsk ?? 0)` and `useOrderbookStore(s => getBook(s, noTokenId)?.bestAsk ?? 0)`.
      2. Simplify the price priority chain from 4-level fallback (WS ref → snapshot → polled → static) to: store book bestAsk → polled last-trade → static Gamma price.
      3. Remove or simplify the `orderbookQueries` dual-fetch `useQueries` call — the store's `books` map (populated by `useOrderbook` + WS) is now the single source of truth for button prices.
    - _Bug_Condition: isBugCondition(input) where yesWsAskRef.current == 0 AND noWsAskRef.current == 0 AND orderbookQueries.staleTime == Infinity_
    - _Expected_Behavior: Yes button price = books[yesTokenId].bestAsk, No button price = books[noTokenId].bestAsk, each derived independently_
    - _Preservation: All Markets mode button disabling, closed market guards, prefetch on hover all unchanged_
    - _Requirements: 1.3, 2.3, 2.4, 2.5, 3.7, 3.8_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — Multi-Token Book Isolation & Independent Prices
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** — Single-Market Orderbook & WS Infrastructure Behavior
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `pnpm test:unit`
  - Ensure all tests pass, ask the user if questions arise.
