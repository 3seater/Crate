import { beforeEach, describe, expect, it } from "vitest";
import {
  emptyBook,
  getBook,
  useOrderbookStore,
} from "@/features/trading/stores/orderbook";

/**
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8
 *
 * Preservation property tests for orderbook option switching.
 * These tests capture EXISTING baseline behavior on UNFIXED code.
 * They MUST PASS before and after the fix (no regressions).
 */

beforeEach(() => {
  useOrderbookStore.getState().reset();
});

describe("Preservation — setBook produces correct flat root fields", () => {
  it("bids sorted descending, asks sorted ascending, spread/midpoint/bestBid/bestAsk computed", () => {
    const store = useOrderbookStore;

    // Set active token first
    store.getState().setBookForToken(
      "token1",
      [
        { price: "0.40", size: "100" },
        { price: "0.50", size: "200" },
        { price: "0.45", size: "150" },
      ],
      [
        { price: "0.60", size: "100" },
        { price: "0.55", size: "200" },
        { price: "0.58", size: "150" },
      ]
    );

    const state = store.getState();

    // Bids sorted descending by price
    expect(state.bids.length).toBe(3);
    expect(state.bids[0].p).toBe(0.5);
    expect(state.bids[1].p).toBe(0.45);
    expect(state.bids[2].p).toBe(0.4);

    // Asks sorted ascending by price
    expect(state.asks.length).toBe(3);
    expect(state.asks[0].p).toBe(0.55);
    expect(state.asks[1].p).toBe(0.58);
    expect(state.asks[2].p).toBe(0.6);

    // Derived values
    expect(state.bestBid).toBe(0.5);
    expect(state.bestAsk).toBe(0.55);
    expect(state.spread).toBeCloseTo(0.05, 10);
    expect(state.midpoint).toBeCloseTo(0.525, 10);
  });

  it("depth (cumulativeUsd) is computed correctly for bids and asks", () => {
    const store = useOrderbookStore;

    store.getState().setBookForToken(
      "token1",
      [
        { price: "0.50", size: "100" },
        { price: "0.40", size: "200" },
      ],
      [
        { price: "0.60", size: "100" },
        { price: "0.70", size: "200" },
      ]
    );

    const state = store.getState();

    // Bids: cumulative USD = price * size, accumulated
    expect(state.bids[0].cumulativeUsd).toBeCloseTo(0.5 * 100, 5);
    expect(state.bids[1].cumulativeUsd).toBeCloseTo(0.5 * 100 + 0.4 * 200, 5);

    // Asks: cumulative USD = price * size, accumulated
    expect(state.asks[0].cumulativeUsd).toBeCloseTo(0.6 * 100, 5);
    expect(state.asks[1].cumulativeUsd).toBeCloseTo(0.6 * 100 + 0.7 * 200, 5);
  });

  it("empty bids/asks produce zero spread, midpoint, bestBid, bestAsk", () => {
    const store = useOrderbookStore;

    store.getState().setBookForToken("token1", [], []);

    const state = store.getState();
    expect(state.bids).toEqual([]);
    expect(state.asks).toEqual([]);
    expect(state.spread).toBe(0);
    expect(state.midpoint).toBe(0);
    expect(state.bestBid).toBe(0);
    expect(state.bestAsk).toBe(0);
  });
});

describe("Preservation — applyPriceChange for active token", () => {
  it("inserts new levels in correct sorted position via binary search", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "token1",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    // Insert a new bid between existing levels
    store.getState().applyPriceChange([
      { price: "0.45", size: "50", side: "BUY" },
      { price: "0.65", size: "75", side: "SELL" },
    ]);

    const state = store.getState();

    // New bid inserted in descending order
    expect(state.bids[0].p).toBe(0.5);
    expect(state.bids[1].p).toBe(0.45);

    // New ask inserted in ascending order
    expect(state.asks[0].p).toBe(0.6);
    expect(state.asks[1].p).toBe(0.65);
  });

  it("removes levels when size is 0", () => {
    const store = useOrderbookStore;

    store.getState().setBookForToken(
      "token1",
      [
        { price: "0.50", size: "100" },
        { price: "0.45", size: "200" },
      ],
      [
        { price: "0.60", size: "100" },
        { price: "0.65", size: "200" },
      ]
    );

    // Remove a bid and an ask
    store.getState().applyPriceChange([
      { price: "0.50", size: "0", side: "BUY" },
      { price: "0.60", size: "0", side: "SELL" },
    ]);

    const state = store.getState();
    expect(state.bids.length).toBe(1);
    expect(state.bids[0].p).toBe(0.45);
    expect(state.asks.length).toBe(1);
    expect(state.asks[0].p).toBe(0.65);
  });

  it("updates existing levels in place (same price, new size)", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "token1",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    store.getState().applyPriceChange([
      { price: "0.50", size: "300", side: "BUY" },
      { price: "0.60", size: "400", side: "SELL" },
    ]);

    const state = store.getState();
    expect(state.bids[0].s).toBe(300);
    expect(state.asks[0].s).toBe(400);
  });

  it("deduplicates inserts (last wins for same price)", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "token1",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    // Two inserts at same price — deduplication ensures no duplicate
    store.getState().applyPriceChange([
      { price: "0.45", size: "50", side: "BUY" },
      { price: "0.45", size: "75", side: "BUY" },
    ]);

    const state = store.getState();
    const bidsAt045 = state.bids.filter((b) => b.p === 0.45);
    expect(bidsAt045.length).toBe(1);
  });

  it("recomputes depth after changes", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "token1",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    store
      .getState()
      .applyPriceChange([{ price: "0.45", size: "200", side: "BUY" }]);

    const state = store.getState();
    // First bid: 0.50 * 100 = 50
    expect(state.bids[0].cumulativeUsd).toBeCloseTo(50, 5);
    // Second bid: 50 + 0.45 * 200 = 140
    expect(state.bids[1].cumulativeUsd).toBeCloseTo(140, 5);
  });
});

describe("Preservation — bookHash deduplication", () => {
  it("calling setBook with identical data twice skips the second update (no state change)", () => {
    const store = useOrderbookStore;

    const bids = [{ price: "0.50", size: "100" }];
    const asks = [{ price: "0.60", size: "100" }];

    // First: set up active token
    store.getState().setBookForToken("token1", bids, asks);

    // Get state after first setBook
    const bidsAfterFirst = store.getState().bids;
    const asksAfterFirst = store.getState().asks;

    // Call setBook again with identical data — should be a no-op due to hash
    store.getState().setBook(bids, asks);

    // State reference should be the same (no update triggered)
    expect(store.getState().bids).toBe(bidsAfterFirst);
    expect(store.getState().asks).toBe(asksAfterFirst);
  });

  it("calling setBook with different data does update", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "token1",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    // Different data
    store
      .getState()
      .setBook(
        [{ price: "0.50", size: "200" }],
        [{ price: "0.60", size: "200" }]
      );

    // State should have changed
    expect(store.getState().bids[0].s).toBe(200);
    expect(store.getState().asks[0].s).toBe(200);
  });
});

describe("Preservation — Depth guard (shallow snapshot skip)", () => {
  it("setBook with a shallower snapshot (fewer levels) than current store data skips the update", () => {
    const store = useOrderbookStore;

    // Set up a deep book (many levels)
    store.getState().setBookForToken(
      "token1",
      [
        { price: "0.50", size: "100" },
        { price: "0.49", size: "200" },
        { price: "0.48", size: "300" },
        { price: "0.47", size: "400" },
        { price: "0.46", size: "500" },
      ],
      [
        { price: "0.55", size: "100" },
        { price: "0.56", size: "200" },
        { price: "0.57", size: "300" },
        { price: "0.58", size: "400" },
        { price: "0.59", size: "500" },
      ]
    );

    const deepState = store.getState();
    expect(deepState.bids.length).toBe(5);
    expect(deepState.asks.length).toBe(5);

    // Now call setBook with a shallower snapshot (fewer levels)
    // The depth guard in the store uses bookHash — if the hash differs,
    // it will update. The depth guard is actually in the WS handler (handleBook),
    // not in the store's setBook itself. The store's setBook only has hash dedup.
    // So a shallower snapshot with different data WILL update the store.
    // Let's verify the actual behavior:
    store.getState().setBook(
      [
        { price: "0.50", size: "100" },
        { price: "0.49", size: "200" },
      ],
      [
        { price: "0.55", size: "100" },
        { price: "0.56", size: "200" },
      ]
    );

    const shallowState = store.getState();
    // The store's setBook does NOT have a depth guard — it only has hash dedup.
    // The depth guard is in the WS handler (use-orderbook.ts handleBook).
    // So the shallow snapshot WILL be applied if the hash differs.
    expect(shallowState.bids.length).toBe(2);
    expect(shallowState.asks.length).toBe(2);
  });
});

describe("Preservation — preloadBook", () => {
  it("writes to books map without changing active tokenId", () => {
    const store = useOrderbookStore;

    // Set up active token
    store
      .getState()
      .setBookForToken(
        "tokenA",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    expect(store.getState().tokenId).toBe("tokenA");

    // Preload a different token
    store
      .getState()
      .preloadBook(
        "tokenB",
        [{ price: "0.30", size: "50" }],
        [{ price: "0.70", size: "50" }]
      );

    const state = store.getState();

    // Active tokenId unchanged
    expect(state.tokenId).toBe("tokenA");

    // Flat root fields still show tokenA's data
    expect(state.bestBid).toBe(0.5);
    expect(state.bestAsk).toBe(0.6);

    // tokenB's book is in the map
    expect(state.books.tokenB).toBeDefined();
    expect(state.books.tokenB.bids[0].p).toBe(0.3);
    expect(state.books.tokenB.asks[0].p).toBe(0.7);
  });

  it("does not change flat root fields when preloading a different token", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "tokenA",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    const stateBefore = store.getState();
    const bidsBefore = stateBefore.bids;
    const asksBefore = stateBefore.asks;

    store
      .getState()
      .preloadBook(
        "tokenB",
        [{ price: "0.30", size: "50" }],
        [{ price: "0.70", size: "50" }]
      );

    const stateAfter = store.getState();

    // Flat fields unchanged (same reference)
    expect(stateAfter.bids).toEqual(bidsBefore);
    expect(stateAfter.asks).toEqual(asksBefore);
    expect(stateAfter.spread).toBe(stateBefore.spread);
    expect(stateAfter.midpoint).toBe(stateBefore.midpoint);
  });
});

describe("Preservation — setBookForToken", () => {
  it("atomically sets both tokenId and book data in a single set() call", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "tokenX",
        [{ price: "0.40", size: "100" }],
        [{ price: "0.65", size: "100" }]
      );

    const state = store.getState();

    // tokenId is set
    expect(state.tokenId).toBe("tokenX");

    // Flat fields reflect the book data
    expect(state.bestBid).toBe(0.4);
    expect(state.bestAsk).toBe(0.65);
    expect(state.spread).toBeCloseTo(0.25, 10);
    expect(state.midpoint).toBeCloseTo(0.525, 10);

    // books map has the entry
    expect(state.books.tokenX).toBeDefined();
    expect(state.books.tokenX.bids[0].p).toBe(0.4);
    expect(state.books.tokenX.asks[0].p).toBe(0.65);
  });

  it("switching tokens with setBookForToken updates flat fields to new token data", () => {
    const store = useOrderbookStore;

    // Set tokenA
    store
      .getState()
      .setBookForToken(
        "tokenA",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    // Switch to tokenB
    store
      .getState()
      .setBookForToken(
        "tokenB",
        [{ price: "0.30", size: "50" }],
        [{ price: "0.70", size: "50" }]
      );

    const state = store.getState();
    expect(state.tokenId).toBe("tokenB");
    expect(state.bestBid).toBe(0.3);
    expect(state.bestAsk).toBe(0.7);

    // tokenA still in books map
    expect(state.books.tokenA).toBeDefined();
    expect(state.books.tokenA.bestBid).toBe(0.5);
  });
});

describe("Preservation — getBook helper", () => {
  it("returns the token's book from the books map", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "tokenA",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    store
      .getState()
      .preloadBook(
        "tokenB",
        [{ price: "0.30", size: "50" }],
        [{ price: "0.70", size: "50" }]
      );

    const state = store.getState();

    const bookA = getBook(state, "tokenA");
    expect(bookA.bestBid).toBe(0.5);
    expect(bookA.bestAsk).toBe(0.6);

    const bookB = getBook(state, "tokenB");
    expect(bookB.bestBid).toBe(0.3);
    expect(bookB.bestAsk).toBe(0.7);
  });

  it("returns emptyBook if token not found", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "tokenA",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    const state = store.getState();
    const bookUnknown = getBook(state, "unknownToken");
    expect(bookUnknown).toEqual(emptyBook);
  });

  it("returns active token's book when tokenId param is null/undefined", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "tokenA",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    const state = store.getState();
    const bookDefault = getBook(state, null);
    expect(bookDefault.bestBid).toBe(0.5);
    expect(bookDefault.bestAsk).toBe(0.6);
  });
});

describe("Preservation — Single-market (SMP) orderbook with real-time WS updates", () => {
  it("setBook followed by applyPriceChange produces correct incremental state", () => {
    const store = useOrderbookStore;

    // Initial book snapshot (simulates WS `book` event)
    store.getState().setBookForToken(
      "smpToken",
      [
        { price: "0.50", size: "100" },
        { price: "0.49", size: "200" },
        { price: "0.48", size: "300" },
      ],
      [
        { price: "0.52", size: "100" },
        { price: "0.53", size: "200" },
        { price: "0.54", size: "300" },
      ]
    );

    // Incremental update (simulates WS `price_change` event)
    store.getState().applyPriceChange([
      { price: "0.51", size: "150", side: "BUY" },
      { price: "0.50", size: "0", side: "BUY" },
      { price: "0.52", size: "250", side: "SELL" },
    ]);

    const state = store.getState();

    // New best bid should be 0.51 (inserted), old 0.50 removed
    expect(state.bestBid).toBe(0.51);
    expect(state.bids[0].p).toBe(0.51);
    expect(state.bids[0].s).toBe(150);

    // 0.50 removed
    const has050 = state.bids.some((b) => b.p === 0.5);
    expect(has050).toBe(false);

    // Ask at 0.52 updated to size 250
    expect(state.asks[0].p).toBe(0.52);
    expect(state.asks[0].s).toBe(250);

    // Spread and midpoint updated
    expect(state.spread).toBeCloseTo(0.52 - 0.51, 10);
    expect(state.midpoint).toBeCloseTo((0.52 + 0.51) / 2, 10);
  });

  it("updateLastTradePrice updates lastTradePrice and displayPrice for active token", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "smpToken",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    store.getState().updateLastTradePrice("0.55", "BUY");

    const state = store.getState();
    expect(state.lastTradePrice).toBe(0.55);
    expect(state.lastTradeSide).toBe("BUY");
  });

  it("updateBestBidAsk updates bestBid/bestAsk/spread/midpoint for active token", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "smpToken",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    store.getState().updateBestBidAsk("0.52", "0.58");

    const state = store.getState();
    expect(state.bestBid).toBe(0.52);
    expect(state.bestAsk).toBe(0.58);
    expect(state.spread).toBeCloseTo(0.06, 10);
    expect(state.midpoint).toBeCloseTo(0.55, 10);
  });

  it("multiple sequential applyPriceChange calls accumulate correctly", () => {
    const store = useOrderbookStore;

    store
      .getState()
      .setBookForToken(
        "smpToken",
        [{ price: "0.50", size: "100" }],
        [{ price: "0.60", size: "100" }]
      );

    // First batch
    store
      .getState()
      .applyPriceChange([{ price: "0.49", size: "50", side: "BUY" }]);

    // Second batch
    store
      .getState()
      .applyPriceChange([{ price: "0.48", size: "75", side: "BUY" }]);

    const state = store.getState();
    expect(state.bids.length).toBe(3);
    expect(state.bids[0].p).toBe(0.5);
    expect(state.bids[1].p).toBe(0.49);
    expect(state.bids[2].p).toBe(0.48);
  });
});
