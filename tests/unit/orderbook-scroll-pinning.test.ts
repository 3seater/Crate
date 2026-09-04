import { describe, expect, it } from "vitest";
import { applySpreadScrollSync } from "@/features/trading/components/orderbook";

/**
 * Validates: Requirements 1.1, 1.2, 1.3
 *
 * Bug condition exploration tests for orderbook scroll pinning.
 * These tests encode the EXPECTED (correct) behavior.
 * They FAIL on unfixed code (confirming the bugs exist) and PASS after the fix.
 */

/** Create a mock scroll element with controllable scroll properties. */
function createMockScrollElement(opts: {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
}) {
  return { ...opts } as unknown as HTMLDivElement;
}

/** Create a mock React ref. */
function createMockRef<T>(value: T) {
  return { current: value };
}

describe("Orderbook Scroll Pinning — Bug Condition Exploration", () => {
  /**
   * Bug 2 (Short-Circuit): applySpreadScrollSync has
   *   `if (skipAsks || skipBids) { return; }`
   * which aborts BOTH sides when only one side should be skipped.
   *
   * Expected behavior: each side should be evaluated independently.
   * skipAsks=true, skipBids=false → bids should still be pinned to scrollTop=0
   */
  describe("Bug 2 — Short-circuit prevents independent side pinning", () => {
    it("should pin bids to scrollTop=0 when skipAsks=true and skipBids=false", () => {
      const asksEl = createMockScrollElement({
        scrollHeight: 500,
        clientHeight: 300,
        scrollTop: 100,
      });
      const bidsEl = createMockScrollElement({
        scrollHeight: 500,
        clientHeight: 300,
        scrollTop: 150,
      });
      const asksScrollRef = createMockRef(asksEl);
      const bidsScrollRef = createMockRef(bidsEl);
      const isProgrammaticScrollRef = createMockRef(false);

      applySpreadScrollSync({
        asksScrollRef,
        bidsScrollRef,
        visibleAsksLen: 15,
        visibleBidsLen: 15,
        skipAsks: true,
        skipBids: false,
        isProgrammaticScrollRef,
      });

      // Asks should NOT be touched (user scrolled away on asks side)
      expect(asksEl.scrollTop).toBe(100);
      // Bids SHOULD be pinned to top (scrollTop=0) — user hasn't scrolled bids
      // On unfixed code: early return aborts both, so bids.scrollTop stays at 150
      expect(bidsEl.scrollTop).toBe(0);
    });

    it("should pin asks to scrollHeight-clientHeight when skipAsks=false and skipBids=true", () => {
      const asksEl = createMockScrollElement({
        scrollHeight: 600,
        clientHeight: 300,
        scrollTop: 50,
      });
      const bidsEl = createMockScrollElement({
        scrollHeight: 500,
        clientHeight: 300,
        scrollTop: 75,
      });
      const asksScrollRef = createMockRef(asksEl);
      const bidsScrollRef = createMockRef(bidsEl);
      const isProgrammaticScrollRef = createMockRef(false);

      applySpreadScrollSync({
        asksScrollRef,
        bidsScrollRef,
        visibleAsksLen: 15,
        visibleBidsLen: 15,
        skipAsks: false,
        skipBids: true,
        isProgrammaticScrollRef,
      });

      // Asks SHOULD be pinned to bottom (scrollHeight - clientHeight = 300)
      // On unfixed code: early return aborts both, so asks.scrollTop stays at 50
      expect(asksEl.scrollTop).toBe(300);
      // Bids should NOT be touched (user scrolled away on bids side)
      expect(bidsEl.scrollTop).toBe(75);
    });
  });
});
