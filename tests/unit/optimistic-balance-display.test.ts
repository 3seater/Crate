import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import { mergeMarketPositionsForCondition } from "@/features/trading/lib/merge-market-positions";
import {
  getEffectiveBalance,
  usePendingBalanceDeltasStore,
} from "@/features/trading/stores/pending-balance-deltas";
import type { LocalPosition } from "@/features/trading/stores/positions";
import { CLOB_SIZE_DISPLAY_THRESHOLD } from "../../packages/types/src/constants";

// ---------------------------------------------------------------------------
// Pure computation helper — mirrors the hook logic without React subscriptions
// ---------------------------------------------------------------------------
function computeOptimisticBalance(params: {
  tokenId: string;
  conditionId: string;
  safeAddress: string | null;
  chainBalance: number | undefined;
  apiPositionSize: number | undefined;
  localPosition: LocalPosition | undefined;
}): number {
  const { tokenId, safeAddress, chainBalance, apiPositionSize, localPosition } =
    params;

  if (safeAddress === null || tokenId === "") {
    return 0;
  }

  const serverSize = chainBalance ?? apiPositionSize ?? 0;
  const effective = getEffectiveBalance(serverSize, safeAddress, tokenId);

  if (
    effective < CLOB_SIZE_DISPLAY_THRESHOLD &&
    localPosition &&
    localPosition.size >= CLOB_SIZE_DISPLAY_THRESHOLD
  ) {
    return localPosition.size;
  }

  return effective < CLOB_SIZE_DISPLAY_THRESHOLD ? 0 : effective;
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Non-empty string for token/condition IDs and addresses. */
const arbTokenId = fc.string({ minLength: 1, maxLength: 32 });
const arbConditionId = fc.string({ minLength: 1, maxLength: 32 });
const arbSafeAddress = fc.string({ minLength: 1, maxLength: 42 });

/** Chain balance that is either undefined or below the display threshold. */
const arbStaleChainBalance: fc.Arbitrary<number | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.double({
    min: 0,
    max: CLOB_SIZE_DISPLAY_THRESHOLD,
    maxExcluded: true,
    noNaN: true,
  })
);

/** API position size that is either undefined or below the display threshold. */
const arbStaleApiSize: fc.Arbitrary<number | undefined> = fc.oneof(
  fc.constant(undefined),
  fc.double({
    min: 0,
    max: CLOB_SIZE_DISPLAY_THRESHOLD,
    maxExcluded: true,
    noNaN: true,
  })
);

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe("useOptimisticTokenBalance — property tests", () => {
  beforeEach(() => {
    // Clear all pending deltas so getEffectiveBalance just returns serverBalance
    usePendingBalanceDeltasStore.getState().clearAll();
  });

  // Feature: optimistic-balance-display, Property 1: Local Position Overlay When Chain Is Stale
  it("Property 1: returns local position size when chain/API are stale and local position is above threshold", () => {
    /**
     * **Validates: Requirements 1.2, 1.3, 2.2, 2.3**
     *
     * For any token ID, condition ID, and safe address, if the chain balance
     * and API position size are both undefined or below CLOB_SIZE_DISPLAY_THRESHOLD,
     * and a local position exists with size >= CLOB_SIZE_DISPLAY_THRESHOLD,
     * then computeOptimisticBalance shall return the local position's size.
     */
    fc.assert(
      fc.property(
        arbTokenId,
        arbConditionId,
        arbSafeAddress,
        arbStaleChainBalance,
        arbStaleApiSize,
        fc.double({
          min: CLOB_SIZE_DISPLAY_THRESHOLD,
          max: 1_000_000,
          noNaN: true,
        }),
        (
          tokenId,
          conditionId,
          safeAddress,
          chainBalance,
          apiPositionSize,
          localSize
        ) => {
          // Clear store before each iteration to ensure no leftover state
          usePendingBalanceDeltasStore.getState().clearAll();

          const localPosition: LocalPosition = {
            asset: tokenId,
            conditionId,
            size: localSize,
            curPrice: 0.5,
            outcome: "Yes",
          };

          const result = computeOptimisticBalance({
            tokenId,
            conditionId,
            safeAddress,
            chainBalance,
            apiPositionSize,
            localPosition,
          });

          expect(result).toBe(localSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: optimistic-balance-display, Property 2: Chain Supersedes Local Position
  it("Property 2: returns getEffectiveBalance result when chain balance is above threshold, regardless of local position", () => {
    /**
     * **Validates: Requirements 1.4, 2.4**
     *
     * For any token ID, condition ID, and safe address, if the chain balance
     * (after applying getEffectiveBalance) is at or above CLOB_SIZE_DISPLAY_THRESHOLD,
     * then computeOptimisticBalance shall return the getEffectiveBalance result
     * regardless of whether a local position exists for that token.
     */
    fc.assert(
      fc.property(
        arbTokenId,
        arbConditionId,
        arbSafeAddress,
        fc.double({
          min: CLOB_SIZE_DISPLAY_THRESHOLD,
          max: 1_000_000,
          noNaN: true,
        }),
        fc.option(fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true }), {
          nil: undefined,
        }),
        (tokenId, conditionId, safeAddress, chainBalance, localSize) => {
          // Clear store before each iteration to ensure no leftover state
          usePendingBalanceDeltasStore.getState().clearAll();

          const localPosition: LocalPosition | undefined =
            localSize === undefined
              ? undefined
              : {
                  asset: tokenId,
                  conditionId,
                  size: localSize,
                  curPrice: 0.5,
                  outcome: "Yes",
                };

          const effective = getEffectiveBalance(
            chainBalance,
            safeAddress,
            tokenId
          );

          const result = computeOptimisticBalance({
            tokenId,
            conditionId,
            safeAddress,
            chainBalance,
            apiPositionSize: undefined,
            localPosition,
          });

          expect(result).toBe(effective);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Edge Case Tests
// ---------------------------------------------------------------------------

describe("useOptimisticTokenBalance — edge cases", () => {
  beforeEach(() => {
    usePendingBalanceDeltasStore.getState().clearAll();
  });

  it("returns 0 when safeAddress is null", () => {
    const result = computeOptimisticBalance({
      tokenId: "token-abc",
      conditionId: "cond-1",
      safeAddress: null,
      chainBalance: 500,
      apiPositionSize: 200,
      localPosition: {
        asset: "token-abc",
        conditionId: "cond-1",
        size: 100,
        curPrice: 0.5,
        outcome: "Yes",
      },
    });

    expect(result).toBe(0);
  });

  it("returns 0 when tokenId is empty string", () => {
    const result = computeOptimisticBalance({
      tokenId: "",
      conditionId: "cond-1",
      safeAddress: "0xabc123",
      chainBalance: 500,
      apiPositionSize: 200,
      localPosition: undefined,
    });

    expect(result).toBe(0);
  });

  it("returns 0 for dust below CLOB_SIZE_DISPLAY_THRESHOLD", () => {
    const result = computeOptimisticBalance({
      tokenId: "token-dust",
      conditionId: "cond-1",
      safeAddress: "0xabc123",
      chainBalance: 0.005,
      apiPositionSize: undefined,
      localPosition: undefined,
    });

    expect(result).toBe(0);
  });

  it("does not overlay WebSocket local dust when server effective is already below threshold", () => {
    const result = computeOptimisticBalance({
      tokenId: "token-ws-dust",
      conditionId: "cond-1",
      safeAddress: "0xabc123",
      chainBalance: 0,
      apiPositionSize: undefined,
      localPosition: {
        asset: "token-ws-dust",
        conditionId: "cond-1",
        size: 0.004_17,
        curPrice: 0.5,
        outcome: "Yes",
      },
    });

    expect(result).toBe(0);
  });

  it("does not use negative-size local position as overlay", () => {
    const result = computeOptimisticBalance({
      tokenId: "token-sell",
      conditionId: "cond-1",
      safeAddress: "0xabc123",
      chainBalance: undefined,
      apiPositionSize: undefined,
      localPosition: {
        asset: "token-sell",
        conditionId: "cond-1",
        size: -50,
        curPrice: 0.5,
        outcome: "Yes",
      },
    });

    expect(result).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Equivalence Tests
// ---------------------------------------------------------------------------

describe("useOptimisticTokenBalance — equivalence tests", () => {
  beforeEach(() => {
    usePendingBalanceDeltasStore.getState().clearAll();
  });

  // Feature: optimistic-balance-display, Property 3: Equivalence With Full Merge
  it("Property 3: hook output matches mergeMarketPositionsForCondition for API-tracked tokens", () => {
    /**
     * **Validates: Requirements 3.1, 3.3, 3.4, 6.1**
     *
     * For any valid combination of chain balance, API position size, and safe address,
     * when the token exists in API data with avgPrice > 0 and no local positions are
     * involved, the hook's output shall equal the size of the corresponding row produced
     * by mergeMarketPositionsForCondition (or 0 if the merge filters the row out).
     */
    fc.assert(
      fc.property(
        arbTokenId,
        arbConditionId,
        arbSafeAddress,
        // Chain balance: either undefined or a positive number
        fc.option(fc.double({ min: 0, max: 1_000_000, noNaN: true }), {
          nil: undefined,
        }),
        // API position size: positive number
        fc.double({
          min: CLOB_SIZE_DISPLAY_THRESHOLD,
          max: 1_000_000,
          noNaN: true,
        }),
        // avgPrice: must be > 0 for merge to include the row
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        (
          tokenId,
          conditionId,
          safeAddress,
          chainBalance,
          apiSize,
          avgPrice
        ) => {
          usePendingBalanceDeltasStore.getState().clearAll();

          // Build onChainBalances map
          const onChainBalances =
            chainBalance === undefined
              ? undefined
              : { [tokenId]: chainBalance };

          // Run merge function
          const merged = mergeMarketPositionsForCondition({
            user: safeAddress,
            conditionId,
            scopedPositions: [
              { asset: tokenId, conditionId, size: apiSize, avgPrice },
            ],
            localPositions: [],
            onChainBalances,
          });

          const mergedRow = merged.find((r) => r.asset === tokenId);
          const mergedSize = mergedRow?.size ?? 0;

          // Run hook logic (clear store again so getEffectiveBalance sees fresh state)
          usePendingBalanceDeltasStore.getState().clearAll();

          const hookResult = computeOptimisticBalance({
            tokenId,
            conditionId,
            safeAddress,
            chainBalance,
            apiPositionSize: apiSize,
            localPosition: undefined,
          });

          expect(hookResult).toBe(mergedSize);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: optimistic-balance-display, Property 4: Anti-Double-Counting
  it("Property 4: chain=100 and local=100 from same trade returns 100, not 200", () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * When chain balance is 100 shares for a token and the local position also
     * shows 100 shares from the same trade, the hook shall return 100, not 200.
     * Chain balance is above threshold so getEffectiveBalance returns 100;
     * the local position overlay is NOT triggered because effective >= threshold.
     */
    usePendingBalanceDeltasStore.getState().clearAll();

    const result = computeOptimisticBalance({
      tokenId: "tok-abc",
      conditionId: "cond-1",
      safeAddress: "0xuser",
      chainBalance: 100,
      apiPositionSize: 100,
      localPosition: {
        asset: "tok-abc",
        conditionId: "cond-1",
        size: 100,
        curPrice: 0.5,
        outcome: "Yes",
      },
    });

    expect(result).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// Convergence Tests
// ---------------------------------------------------------------------------

describe("useOptimisticTokenBalance — convergence tests", () => {
  beforeEach(() => {
    usePendingBalanceDeltasStore.getState().clearAll();
  });

  // Feature: optimistic-balance-display, Property 5: Monotonic Convergence
  it("Property 5: output is non-decreasing as chain balance increases for a buy", () => {
    /**
     * **Validates: Requirements 4.2, 4.3**
     *
     * For any sequence of increasing chain balances (all above threshold),
     * the output of computeOptimisticBalance shall be monotonically non-decreasing.
     * This models the convergence phase after a buy trade where the chain balance
     * increases from the threshold toward the full traded amount.
     */
    fc.assert(
      fc.property(
        arbTokenId,
        arbConditionId,
        arbSafeAddress,
        fc.double({
          min: CLOB_SIZE_DISPLAY_THRESHOLD,
          max: 1_000_000,
          noNaN: true,
        }),
        fc.integer({ min: 3, max: 10 }),
        (tokenId, conditionId, safeAddress, buyAmount, steps) => {
          usePendingBalanceDeltasStore.getState().clearAll();

          // Generate increasing chain balance sequence from threshold to buyAmount
          const outputs: number[] = [];
          for (let i = 0; i <= steps; i++) {
            usePendingBalanceDeltasStore.getState().clearAll();
            const chainBalance =
              CLOB_SIZE_DISPLAY_THRESHOLD +
              (buyAmount - CLOB_SIZE_DISPLAY_THRESHOLD) * (i / steps);
            const result = computeOptimisticBalance({
              tokenId,
              conditionId,
              safeAddress,
              chainBalance,
              apiPositionSize: undefined,
              localPosition: undefined,
            });
            outputs.push(result);
          }

          // Assert non-decreasing
          for (let i = 1; i < outputs.length; i++) {
            const prev = outputs[i - 1] ?? 0;
            expect(outputs[i]).toBeGreaterThanOrEqual(prev);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  // Feature: optimistic-balance-display, Property 5: Monotonic Convergence
  it("Property 5: output is non-increasing as chain balance decreases for a sell", () => {
    /**
     * **Validates: Requirements 4.2, 4.3**
     *
     * For any sequence of decreasing chain balances (starting above threshold),
     * the output of computeOptimisticBalance shall be monotonically non-increasing.
     * This models the convergence phase after a sell trade where the chain balance
     * decreases from the pre-sell amount toward the post-sell amount.
     */
    fc.assert(
      fc.property(
        arbTokenId,
        arbConditionId,
        arbSafeAddress,
        fc.double({
          min: CLOB_SIZE_DISPLAY_THRESHOLD * 2,
          max: 1_000_000,
          noNaN: true,
        }),
        fc.integer({ min: 3, max: 10 }),
        (tokenId, conditionId, safeAddress, startAmount, steps) => {
          usePendingBalanceDeltasStore.getState().clearAll();

          // Generate decreasing chain balance sequence
          const outputs: number[] = [];
          for (let i = 0; i <= steps; i++) {
            usePendingBalanceDeltasStore.getState().clearAll();
            const chainBalance =
              startAmount -
              (startAmount - CLOB_SIZE_DISPLAY_THRESHOLD) * (i / steps);
            const result = computeOptimisticBalance({
              tokenId,
              conditionId,
              safeAddress,
              chainBalance,
              apiPositionSize: undefined,
              localPosition: undefined,
            });
            outputs.push(result);
          }

          // Assert non-increasing
          for (let i = 1; i < outputs.length; i++) {
            const prev = outputs[i - 1] ?? Number.POSITIVE_INFINITY;
            expect(outputs[i]).toBeLessThanOrEqual(prev);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
