import { describe, expect, it } from "vitest";
import { applySpreadScrollSync } from "@/features/trading/components/orderbook";

/**
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 *
 * Preservation property tests for orderbook scroll pinning.
 * These tests capture EXISTING correct behavior that must remain unchanged after the fix.
 * They PASS on the current unfixed code.
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

describe("Orderbook Scroll Pinning — Preservation", () => {
  /**
   * Both-sides-at-spread (skipAsks=false, skipBids=false):
   * Normal pinning behavior — asks scroll to bottom, bids scroll to top.
   */
  describe("Both sides at spread (skipAsks=false, skipBids=false)", () => {
    it("should scroll asks to scrollHeight - clientHeight and bids to 0", () => {
      const asksEl = createMockScrollElement({
        scrollHeight: 500,
        clientHeight: 300,
        scrollTop: 50,
      });
      const bidsEl = createMockScrollElement({
        scrollHeight: 400,
        clientHeight: 300,
        scrollTop: 80,
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
        skipBids: false,
        isProgrammaticScrollRef,
      });

      expect(asksEl.scrollTop).toBe(200); // 500 - 300
      expect(bidsEl.scrollTop).toBe(0);
    });
  });

  /**
   * Both-sides-scrolled (skipAsks=true, skipBids=true):
   * Early return handles this — neither side's scrollTop is modified.
   */
  describe("Both sides scrolled away (skipAsks=true, skipBids=true)", () => {
    it("should not modify either side's scrollTop", () => {
      const asksEl = createMockScrollElement({
        scrollHeight: 500,
        clientHeight: 300,
        scrollTop: 100,
      });
      const bidsEl = createMockScrollElement({
        scrollHeight: 400,
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
        skipBids: true,
        isProgrammaticScrollRef,
      });

      expect(asksEl.scrollTop).toBe(100);
      expect(bidsEl.scrollTop).toBe(150);
    });
  });

  /**
   * No overflow (scrollHeight <= clientHeight):
   * The scrollHeight > clientHeight + 1 guard prevents scrollTop change on asks.
   */
  describe("No overflow (scrollHeight <= clientHeight)", () => {
    it("should not change asks scrollTop when scrollHeight equals clientHeight", () => {
      const asksEl = createMockScrollElement({
        scrollHeight: 300,
        clientHeight: 300,
        scrollTop: 0,
      });
      const bidsEl = createMockScrollElement({
        scrollHeight: 400,
        clientHeight: 300,
        scrollTop: 50,
      });
      const asksScrollRef = createMockRef(asksEl);
      const bidsScrollRef = createMockRef(bidsEl);
      const isProgrammaticScrollRef = createMockRef(false);

      applySpreadScrollSync({
        asksScrollRef,
        bidsScrollRef,
        visibleAsksLen: 10,
        visibleBidsLen: 10,
        skipAsks: false,
        skipBids: false,
        isProgrammaticScrollRef,
      });

      // Asks: scrollHeight (300) is NOT > clientHeight + 1 (301), so scrollTop unchanged
      expect(asksEl.scrollTop).toBe(0);
      // Bids: always set to 0
      expect(bidsEl.scrollTop).toBe(0);
    });
  });

  /**
   * Zero visible rows:
   * When visibleAsksLen=0 or visibleBidsLen=0, the corresponding side should not be scrolled.
   */
  describe("Zero visible rows", () => {
    it("should not scroll asks when visibleAsksLen is 0", () => {
      const asksEl = createMockScrollElement({
        scrollHeight: 500,
        clientHeight: 300,
        scrollTop: 50,
      });
      const bidsEl = createMockScrollElement({
        scrollHeight: 400,
        clientHeight: 300,
        scrollTop: 80,
      });
      const asksScrollRef = createMockRef(asksEl);
      const bidsScrollRef = createMockRef(bidsEl);
      const isProgrammaticScrollRef = createMockRef(false);

      applySpreadScrollSync({
        asksScrollRef,
        bidsScrollRef,
        visibleAsksLen: 0,
        visibleBidsLen: 15,
        skipAsks: false,
        skipBids: false,
        isProgrammaticScrollRef,
      });

      // Asks: visibleAsksLen=0, so the asks block is skipped
      expect(asksEl.scrollTop).toBe(50);
      // Bids: visibleBidsLen=15, so bids are pinned to 0
      expect(bidsEl.scrollTop).toBe(0);
    });

    it("should not scroll bids when visibleBidsLen is 0", () => {
      const asksEl = createMockScrollElement({
        scrollHeight: 500,
        clientHeight: 300,
        scrollTop: 50,
      });
      const bidsEl = createMockScrollElement({
        scrollHeight: 400,
        clientHeight: 300,
        scrollTop: 80,
      });
      const asksScrollRef = createMockRef(asksEl);
      const bidsScrollRef = createMockRef(bidsEl);
      const isProgrammaticScrollRef = createMockRef(false);

      applySpreadScrollSync({
        asksScrollRef,
        bidsScrollRef,
        visibleAsksLen: 15,
        visibleBidsLen: 0,
        skipAsks: false,
        skipBids: false,
        isProgrammaticScrollRef,
      });

      // Asks: visibleAsksLen=15, so asks are pinned to scrollHeight - clientHeight
      expect(asksEl.scrollTop).toBe(200); // 500 - 300
      // Bids: visibleBidsLen=0, so the bids block is skipped
      expect(bidsEl.scrollTop).toBe(80);
    });
  });

  /**
   * Null refs:
   * When scroll refs are null, the function should not throw.
   */
  describe("Null refs", () => {
    it("should not throw when asksScrollRef is null", () => {
      const bidsEl = createMockScrollElement({
        scrollHeight: 400,
        clientHeight: 300,
        scrollTop: 50,
      });
      const asksScrollRef = createMockRef(null);
      const bidsScrollRef = createMockRef(bidsEl);
      const isProgrammaticScrollRef = createMockRef(false);

      expect(() => {
        applySpreadScrollSync({
          asksScrollRef,
          bidsScrollRef,
          visibleAsksLen: 15,
          visibleBidsLen: 15,
          skipAsks: false,
          skipBids: false,
          isProgrammaticScrollRef,
        });
      }).not.toThrow();

      expect(bidsEl.scrollTop).toBe(0);
    });

    it("should not throw when bidsScrollRef is null", () => {
      const asksEl = createMockScrollElement({
        scrollHeight: 500,
        clientHeight: 300,
        scrollTop: 50,
      });
      const asksScrollRef = createMockRef(asksEl);
      const bidsScrollRef = createMockRef(null);
      const isProgrammaticScrollRef = createMockRef(false);

      expect(() => {
        applySpreadScrollSync({
          asksScrollRef,
          bidsScrollRef,
          visibleAsksLen: 15,
          visibleBidsLen: 15,
          skipAsks: false,
          skipBids: false,
          isProgrammaticScrollRef,
        });
      }).not.toThrow();

      expect(asksEl.scrollTop).toBe(200); // 500 - 300
    });

    it("should not throw when both refs are null", () => {
      const asksScrollRef = createMockRef(null);
      const bidsScrollRef = createMockRef(null);
      const isProgrammaticScrollRef = createMockRef(false);

      expect(() => {
        applySpreadScrollSync({
          asksScrollRef,
          bidsScrollRef,
          visibleAsksLen: 15,
          visibleBidsLen: 15,
          skipAsks: false,
          skipBids: false,
          isProgrammaticScrollRef,
        });
      }).not.toThrow();
    });
  });

  /**
   * isProgrammaticScrollRef is set during scroll:
   * Verify the ref is set to true during the scroll operation and back to false after.
   */
  describe("isProgrammaticScrollRef lifecycle", () => {
    it("should set isProgrammaticScrollRef to true during scroll and false after", () => {
      const capturedValues: boolean[] = [];

      const asksEl = {
        scrollHeight: 500,
        clientHeight: 300,
        scrollTop: 50,
        // Capture isProgrammaticScrollRef value when scrollTop is set
        set _scrollTop(val: number) {
          this.scrollTop = val;
        },
      } as unknown as HTMLDivElement;

      // Use a Proxy to capture the isProgrammaticScrollRef value when scrollTop is written
      const asksProxy = new Proxy(asksEl, {
        set(target, prop, value) {
          if (prop === "scrollTop") {
            capturedValues.push(isProgrammaticScrollRef.current);
            (target as Record<string, unknown>)[prop as string] = value;
            return true;
          }
          (target as Record<string, unknown>)[prop as string] = value;
          return true;
        },
      });

      const bidsEl = createMockScrollElement({
        scrollHeight: 400,
        clientHeight: 300,
        scrollTop: 80,
      });

      const bidsProxy = new Proxy(bidsEl, {
        set(target, prop, value) {
          if (prop === "scrollTop") {
            capturedValues.push(isProgrammaticScrollRef.current);
            (target as Record<string, unknown>)[prop as string] = value;
            return true;
          }
          (target as Record<string, unknown>)[prop as string] = value;
          return true;
        },
      });

      const asksScrollRef = createMockRef(
        asksProxy as unknown as HTMLDivElement
      );
      const bidsScrollRef = createMockRef(
        bidsProxy as unknown as HTMLDivElement
      );
      const isProgrammaticScrollRef = createMockRef(false);

      applySpreadScrollSync({
        asksScrollRef,
        bidsScrollRef,
        visibleAsksLen: 15,
        visibleBidsLen: 15,
        skipAsks: false,
        skipBids: false,
        isProgrammaticScrollRef,
      });

      // Both scrollTop writes should have happened while isProgrammaticScrollRef was true
      expect(capturedValues.length).toBeGreaterThanOrEqual(2);
      for (const val of capturedValues) {
        expect(val).toBe(true);
      }
      // After the function returns, isProgrammaticScrollRef should be false
      expect(isProgrammaticScrollRef.current).toBe(false);
    });
  });
});
