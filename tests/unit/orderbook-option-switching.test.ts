import { beforeEach, describe, expect, it } from "vitest";
import {
  emptyBook,
  getBook,
  useOrderbookStore,
} from "@/features/trading/stores/orderbook";

/**
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5
 *
 * Bug condition exploration tests for orderbook option switching.
 * These tests encode the EXPECTED (correct) behavior.
 * They FAIL on unfixed code (confirming the bugs exist) and PASS after the fix.
 *
 * Five interrelated bugs:
 * 1. Stale book on market switch — flat fields retain old token's data
 * 2. applyPriceChange ignores non-active token — silently drops changes
 * 3. Identical button prices — both tokens show same price
 * 4. Non-selected side stale price — WS events filtered for non-active token
 * 5. Swapped bids/asks race — non-atomic setTokenId + setBook
 */

beforeEach(() => {
  useOrderbookStore.getState().reset();
});

describe("Orderbook Option Switching — Bug Condition Exploration", () => {
  describe("Bug 1 — Stale Book on Market Switch", () => {
    it("flat root fields should NOT retain tokenA data after switching to tokenB (which has no book)", () => {
      const store = useOrderbookStore;

      // Populate tokenA with real book data
      store.getState().setBookForToken(
        "tokenA",
        [
          { price: "0.50", size: "100" },
          { price: "0.49", size: "200" },
        ],
        [
          { price: "0.52", size: "150" },
          { price: "0.53", size: "250" },
        ]
      );

      // Verify tokenA data is active
      const stateAfterA = store.getState();
      expect(stateAfterA.tokenId).toBe("tokenA");
      expect(stateAfterA.bids.length).toBeGreaterThan(0);
      expect(stateAfterA.asks.length).toBeGreaterThan(0);

      // Switch to tokenB which has NO book entry in the books map
      store.getState().setTokenId("tokenB");

      // Expected: flat fields should show emptyBook (tokenB has no data)
      // Bug: flat fields retain tokenA's stale bids/asks
      const stateAfterSwitch = store.getState();
      expect(stateAfterSwitch.tokenId).toBe("tokenB");
      expect(stateAfterSwitch.bids).toEqual(emptyBook.bids);
      expect(stateAfterSwitch.asks).toEqual(emptyBook.asks);
      expect(stateAfterSwitch.bestBid).toBe(0);
      expect(stateAfterSwitch.bestAsk).toBe(0);
      expect(stateAfterSwitch.spread).toBe(0);
      expect(stateAfterSwitch.midpoint).toBe(0);
    });
  });

  describe("Bug 2 — applyPriceChange Ignores Non-Active Token", () => {
    it("applyPriceChange with changes for tokenB should update books['tokenB'] when active token is tokenA", () => {
      const store = useOrderbookStore;

      // Set up tokenA as active with some book data
      store
        .getState()
        .setBookForToken(
          "tokenA",
          [{ price: "0.45", size: "100" }],
          [{ price: "0.55", size: "100" }]
        );

      // Pre-populate tokenB with initial book data
      store
        .getState()
        .preloadBook(
          "tokenB",
          [{ price: "0.40", size: "50" }],
          [{ price: "0.60", size: "50" }]
        );

      // Verify active token is tokenA
      expect(store.getState().tokenId).toBe("tokenA");

      // Apply price changes targeting tokenB (non-active token)
      // The fix routes WS events through applyPriceChangeForToken for non-active tokens
      // On unfixed code, applyPriceChange only updates the active token and silently drops changes for tokenB
      store.getState().applyPriceChangeForToken("tokenB", [
        { price: "0.42", size: "75", side: "BUY" },
        { price: "0.58", size: "80", side: "SELL" },
      ]);

      // Expected: books["tokenB"] should have the new price levels
      // Bug: applyPriceChange only reads state.tokenId (which is "tokenA")
      // and applies changes to tokenA's book, ignoring tokenB entirely
      const tokenBBook = store.getState().books.tokenB;
      expect(tokenBBook).toBeDefined();

      // The new bid at 0.42 should appear in tokenB's book
      const hasBid042 = tokenBBook?.bids.some(
        (b) => b.price === "0.42" && b.size === "75"
      );
      expect(hasBid042).toBe(true);

      // The new ask at 0.58 should appear in tokenB's book
      const hasAsk058 = tokenBBook?.asks.some(
        (a) => a.price === "0.58" && a.size === "80"
      );
      expect(hasAsk058).toBe(true);
    });
  });

  describe("Bug 3 — Identical Button Prices", () => {
    it("getBook should return independent bestAsk prices for yesToken and noToken", () => {
      const store = useOrderbookStore;

      // Populate yesToken with bestAsk = 0.52
      store
        .getState()
        .preloadBook(
          "yesToken",
          [{ price: "0.50", size: "100" }],
          [{ price: "0.52", size: "100" }]
        );

      // Populate noToken with bestAsk = 0.48
      store
        .getState()
        .preloadBook(
          "noToken",
          [{ price: "0.46", size: "100" }],
          [{ price: "0.48", size: "100" }]
        );

      // Set active token to yesToken
      store.getState().setTokenId("yesToken");

      // Read prices via getBook for each token independently
      const state = store.getState();
      const yesBook = getBook(state, "yesToken");
      const noBook = getBook(state, "noToken");

      // Expected: yesPrice = 0.52, noPrice = 0.48 (independent)
      // Bug: On unfixed code, sticky refs cause both to show the same price
      // because the non-selected token's ref stays at 0 and falls through
      // to stale snapshot data
      expect(yesBook.bestAsk).toBeCloseTo(0.52, 2);
      expect(noBook.bestAsk).toBeCloseTo(0.48, 2);

      // They must NOT be identical
      expect(yesBook.bestAsk).not.toEqual(noBook.bestAsk);
    });
  });

  describe("Bug 4 — Non-Selected Side Stale Price", () => {
    it("price_change event for noToken should update books['noToken'] when active token is yesToken", () => {
      const store = useOrderbookStore;

      // Set up yesToken as active
      store
        .getState()
        .setBookForToken(
          "yesToken",
          [{ price: "0.50", size: "100" }],
          [{ price: "0.52", size: "100" }]
        );

      // Pre-populate noToken
      store
        .getState()
        .preloadBook(
          "noToken",
          [{ price: "0.46", size: "100" }],
          [{ price: "0.48", size: "100" }]
        );

      // Verify active token is yesToken
      expect(store.getState().tokenId).toBe("yesToken");

      // Simulate a WS price_change event for noToken
      // The fix routes WS events through applyPriceChangeForToken for non-active tokens
      // On unfixed code, the WS handler in use-orderbook.ts filters:
      //   `if (c.asset_id !== tokenId) continue;`
      // So changes for noToken are silently dropped.
      //
      // The actual fix path: the hook now calls applyPriceChangeForToken(assetId, changes)
      // for any token whose asset_id is in assetIds, regardless of which is active.
      // Use price 0.50 (above bestBid 0.46) to avoid crossing-order filter.
      store
        .getState()
        .applyPriceChangeForToken("noToken", [
          { price: "0.50", size: "120", side: "SELL" },
        ]);

      // Expected: books["noToken"] should reflect the updated price
      // Bug: applyPriceChange uses state.tokenId (yesToken) and applies
      // the change to yesToken's book instead. noToken's book stays stale.
      const noBook = store.getState().books.noToken;
      expect(noBook).toBeDefined();

      // The noToken book should have a new ask at 0.50
      // On unfixed code, this will fail because applyPriceChange
      // only updates the active token (yesToken)
      const hasNewAsk = noBook?.asks.some((a) => a.price === "0.50");
      expect(hasNewAsk).toBe(true);
    });
  });

  describe("Bug 5 — Swapped Bids/Asks Race (Non-Atomic Transition)", () => {
    it("setTokenId('tokenB') followed by setBook(tokenA_data) should NOT show tokenA data in flat fields", () => {
      const store = useOrderbookStore;

      // Set up tokenA as active with book data
      store.getState().setBookForToken(
        "tokenA",
        [
          { price: "0.60", size: "100" },
          { price: "0.59", size: "200" },
        ],
        [
          { price: "0.62", size: "150" },
          { price: "0.63", size: "250" },
        ]
      );

      // Pre-populate tokenB with different data
      store
        .getState()
        .preloadBook(
          "tokenB",
          [{ price: "0.30", size: "50" }],
          [{ price: "0.35", size: "50" }]
        );

      // Simulate the race condition:
      // 1. setTokenId("tokenB") fires (user switches market)
      store.getState().setTokenId("tokenB");

      // 2. setBook(tokenA_data) fires (stale WS event for tokenA arrives late)
      // On unfixed code, setBook writes to the ACTIVE token's flat fields
      // Since tokenId is now "tokenB", this writes tokenA's data into tokenB's slot
      store.getState().setBook(
        [
          { price: "0.60", size: "100" },
          { price: "0.59", size: "200" },
        ],
        [
          { price: "0.62", size: "150" },
          { price: "0.63", size: "250" },
        ]
      );

      // Expected: flat fields should show tokenB's data (0.30/0.35),
      // NOT tokenA's stale data (0.60/0.62)
      // Bug: setBook writes to whatever tokenId is active, so tokenA's
      // late-arriving data overwrites tokenB's book in the flat fields
      const state = store.getState();
      expect(state.tokenId).toBe("tokenB");

      // The flat bestBid should be tokenB's (0.30), not tokenA's (0.60)
      // On unfixed code, setBook blindly writes to the active token's book
      expect(state.bestBid).not.toBeCloseTo(0.6, 2);
      expect(state.bestAsk).not.toBeCloseTo(0.62, 2);

      // tokenB's original data should be preserved
      // (or at minimum, tokenA's data should NOT be in the flat fields)
      const tokenBBook = state.books.tokenB;
      expect(tokenBBook).toBeDefined();
    });
  });
});
