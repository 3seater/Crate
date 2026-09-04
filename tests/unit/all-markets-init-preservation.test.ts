/**
 * Preservation property tests for All Markets Init Fix.
 *
 * These tests verify EXISTING correct behavior that must be preserved after the fix.
 * They should PASS on unfixed code.
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7
 */

import { beforeEach, describe, expect, it } from "vitest";
import { getDefaultVisibleMarkets } from "@/features/trading/lib/default-visible-markets";
import { isRecurringCryptoEventForAllMarkets } from "@/features/trading/lib/markets/events";
import { getYesPrice } from "@/features/trading/lib/markets/gamma-to-ui";
import { prepareSelectorMarkets } from "@/features/trading/lib/markets/prepare-selector-markets";
import { getConditionId } from "@/features/trading/lib/trading-utils";
import { useWorkspaceLayoutStore } from "@/features/trading/stores/workspace-layout";
import type { Market } from "@/shared/lib/trpc/types";

// ---------------------------------------------------------------------------
// Helpers: mock Market objects
// ---------------------------------------------------------------------------

function makeMarket(
  overrides: Partial<Market> & { condition_id: string }
): Market {
  const cid = overrides.condition_id;
  return {
    condition_id: cid,
    question: overrides.question ?? `Market ${cid}?`,
    outcomePrices: overrides.outcomePrices ?? '["0.60","0.40"]',
    active: overrides.active ?? true,
    closed: overrides.closed ?? false,
    tokens: overrides.tokens ?? [
      { token_id: `yes-${cid}`, outcome: "Yes" },
      { token_id: `no-${cid}`, outcome: "No" },
    ],
    ...overrides,
  } as Market;
}

// ---------------------------------------------------------------------------
// 1. isRecurringCryptoEventForAllMarkets preservation
// ---------------------------------------------------------------------------

describe("Preservation: isRecurringCryptoEventForAllMarkets", () => {
  /**
   * Validates: Requirements 3.4
   */

  it('returns true for { tags: [{ slug: "recurring" }] }', () => {
    expect(
      isRecurringCryptoEventForAllMarkets({ tags: [{ slug: "recurring" }] })
    ).toBe(true);
  });

  it('returns false for { tags: [{ slug: "crypto" }] }', () => {
    expect(
      isRecurringCryptoEventForAllMarkets({ tags: [{ slug: "crypto" }] })
    ).toBe(false);
  });

  it('returns true for { tags: [{ slug: "Recurring" }] } (case insensitive)', () => {
    expect(
      isRecurringCryptoEventForAllMarkets({ tags: [{ slug: "Recurring" }] })
    ).toBe(true);
  });

  it("returns false for null", () => {
    expect(isRecurringCryptoEventForAllMarkets(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isRecurringCryptoEventForAllMarkets(undefined)).toBe(false);
  });

  it("returns false for { tags: [] }", () => {
    expect(isRecurringCryptoEventForAllMarkets({ tags: [] })).toBe(false);
  });

  it('returns true for { tags: [{ slug: "recurring" }, { slug: "crypto" }] }', () => {
    expect(
      isRecurringCryptoEventForAllMarkets({
        tags: [{ slug: "recurring" }, { slug: "crypto" }],
      })
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. getDefaultVisibleMarkets preservation
// ---------------------------------------------------------------------------

describe("Preservation: getDefaultVisibleMarkets", () => {
  /**
   * Validates: Requirements 3.1, 3.6
   */

  it("returns top 4 condition IDs from 6 active markets sorted by yes price", () => {
    const markets = [
      makeMarket({ condition_id: "0xa", outcomePrices: '["0.90","0.10"]' }),
      makeMarket({ condition_id: "0xb", outcomePrices: '["0.80","0.20"]' }),
      makeMarket({ condition_id: "0xc", outcomePrices: '["0.70","0.30"]' }),
      makeMarket({ condition_id: "0xd", outcomePrices: '["0.60","0.40"]' }),
      makeMarket({ condition_id: "0xe", outcomePrices: '["0.50","0.50"]' }),
      makeMarket({ condition_id: "0xf", outcomePrices: '["0.40","0.60"]' }),
    ];
    const selectorItems = prepareSelectorMarkets(markets);
    const result = getDefaultVisibleMarkets(selectorItems);
    expect(result).toHaveLength(4);
    expect(result).toEqual(["0xa", "0xb", "0xc", "0xd"]);
  });

  it("returns all 3 condition IDs when only 3 active markets exist", () => {
    const markets = [
      makeMarket({ condition_id: "0xa", outcomePrices: '["0.90","0.10"]' }),
      makeMarket({ condition_id: "0xb", outcomePrices: '["0.80","0.20"]' }),
      makeMarket({ condition_id: "0xc", outcomePrices: '["0.70","0.30"]' }),
    ];
    const selectorItems = prepareSelectorMarkets(markets);
    const result = getDefaultVisibleMarkets(selectorItems);
    expect(result).toHaveLength(3);
    expect(result).toEqual(["0xa", "0xb", "0xc"]);
  });

  it("returns 1 condition ID when only 1 active market exists", () => {
    const markets = [
      makeMarket({ condition_id: "0xa", outcomePrices: '["0.90","0.10"]' }),
    ];
    const selectorItems = prepareSelectorMarkets(markets);
    const result = getDefaultVisibleMarkets(selectorItems);
    expect(result).toHaveLength(1);
    expect(result).toEqual(["0xa"]);
  });

  it("returns empty array when 0 active markets exist", () => {
    const result = getDefaultVisibleMarkets([]);
    expect(result).toEqual([]);
  });

  it("only returns active market IDs when mix of active and inactive", () => {
    const markets = [
      makeMarket({ condition_id: "0xa", outcomePrices: '["0.90","0.10"]' }),
      makeMarket({
        condition_id: "0xb",
        outcomePrices: '["0.80","0.20"]',
        closed: true,
      }),
      makeMarket({ condition_id: "0xc", outcomePrices: '["0.70","0.30"]' }),
      makeMarket({
        condition_id: "0xd",
        outcomePrices: '["0.60","0.40"]',
        active: false,
        closed: true,
      }),
      makeMarket({ condition_id: "0xe", outcomePrices: '["0.50","0.50"]' }),
    ];
    const selectorItems = prepareSelectorMarkets(markets);
    const result = getDefaultVisibleMarkets(selectorItems);
    // Only active (non-closed, non-archived) markets should be returned
    for (const id of result) {
      const original = markets.find((m) => m.condition_id === id);
      expect(original).toBeDefined();
      expect(original?.active).toBe(true);
      expect(original?.closed).toBe(false);
    }
  });

  it("results are sorted by descending yes price", () => {
    const markets = [
      makeMarket({ condition_id: "0xlow", outcomePrices: '["0.20","0.80"]' }),
      makeMarket({ condition_id: "0xhigh", outcomePrices: '["0.95","0.05"]' }),
      makeMarket({ condition_id: "0xmid", outcomePrices: '["0.55","0.45"]' }),
      makeMarket({
        condition_id: "0xmidhigh",
        outcomePrices: '["0.75","0.25"]',
      }),
    ];
    const selectorItems = prepareSelectorMarkets(markets);
    const result = getDefaultVisibleMarkets(selectorItems);
    // Verify descending order by checking prices
    const prices = result.map((id) => {
      const m = markets.find((mk) => mk.condition_id === id);
      expect(m).toBeDefined();
      return getYesPrice(m as Market);
    });
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i - 1]).toBeGreaterThanOrEqual(prices[i]);
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Zustand store actions preservation
// ---------------------------------------------------------------------------

describe("Preservation: Zustand store actions", () => {
  /**
   * Validates: Requirements 3.2, 3.3, 3.5, 3.7
   */

  beforeEach(() => {
    // Reset store to known state before each test
    useWorkspaceLayoutStore.setState({
      allMarketsMode: false,
      visibleMarketIds: [],
    });
  });

  it("resetAllMarketsMode() sets allMarketsMode: false and visibleMarketIds: []", () => {
    useWorkspaceLayoutStore.setState({
      allMarketsMode: true,
      visibleMarketIds: ["a", "b", "c"],
    });
    useWorkspaceLayoutStore.getState().resetAllMarketsMode();
    const state = useWorkspaceLayoutStore.getState();
    expect(state.allMarketsMode).toBe(false);
    expect(state.visibleMarketIds).toEqual([]);
  });

  it("setAllMarketsMode(true) sets allMarketsMode: true, does NOT touch visibleMarketIds", () => {
    useWorkspaceLayoutStore.setState({
      allMarketsMode: false,
      visibleMarketIds: ["x", "y"],
    });
    useWorkspaceLayoutStore.getState().setAllMarketsMode(true);
    const state = useWorkspaceLayoutStore.getState();
    expect(state.allMarketsMode).toBe(true);
    expect(state.visibleMarketIds).toEqual(["x", "y"]);
  });

  it("setVisibleMarketIds(['a', 'b']) sets visibleMarketIds to ['a', 'b']", () => {
    useWorkspaceLayoutStore.getState().setVisibleMarketIds(["a", "b"]);
    const state = useWorkspaceLayoutStore.getState();
    expect(state.visibleMarketIds).toEqual(["a", "b"]);
  });

  it("addVisibleMarket('c') when visibleMarketIds is ['a', 'b'] → ['a', 'b', 'c']", () => {
    useWorkspaceLayoutStore.setState({ visibleMarketIds: ["a", "b"] });
    useWorkspaceLayoutStore.getState().addVisibleMarket("c");
    expect(useWorkspaceLayoutStore.getState().visibleMarketIds).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("addVisibleMarket('a') when visibleMarketIds is ['a', 'b'] → ['a', 'b'] (no duplicate)", () => {
    useWorkspaceLayoutStore.setState({ visibleMarketIds: ["a", "b"] });
    useWorkspaceLayoutStore.getState().addVisibleMarket("a");
    expect(useWorkspaceLayoutStore.getState().visibleMarketIds).toEqual([
      "a",
      "b",
    ]);
  });

  it("removeVisibleMarket('b') when visibleMarketIds is ['a', 'b'] → ['a'], allMarketsMode stays true", () => {
    useWorkspaceLayoutStore.setState({
      allMarketsMode: true,
      visibleMarketIds: ["a", "b"],
    });
    useWorkspaceLayoutStore.getState().removeVisibleMarket("b");
    const state = useWorkspaceLayoutStore.getState();
    expect(state.visibleMarketIds).toEqual(["a"]);
    expect(state.allMarketsMode).toBe(true);
  });

  it("removeVisibleMarket('a') when visibleMarketIds is ['a'] → [], allMarketsMode becomes false (auto-exit)", () => {
    useWorkspaceLayoutStore.setState({
      allMarketsMode: true,
      visibleMarketIds: ["a"],
    });
    useWorkspaceLayoutStore.getState().removeVisibleMarket("a");
    const state = useWorkspaceLayoutStore.getState();
    expect(state.visibleMarketIds).toEqual([]);
    expect(state.allMarketsMode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. prepareSelectorMarkets preservation
// ---------------------------------------------------------------------------

describe("Preservation: prepareSelectorMarkets", () => {
  /**
   * Validates: Requirements 3.1, 3.5
   */

  it("filters out markets without condition_id", () => {
    const markets = [
      makeMarket({ condition_id: "0xaaa" }),
      { question: "No CID market", active: true, closed: false } as Market,
      makeMarket({ condition_id: "0xbbb" }),
    ];
    const result = prepareSelectorMarkets(markets);
    const ids = result.map((r) => r.conditionId);
    expect(ids).toContain("0xaaa");
    expect(ids).toContain("0xbbb");
    expect(ids).toHaveLength(2);
  });

  it("deduplicates by condition_id", () => {
    const markets = [
      makeMarket({ condition_id: "0xaaa", question: "First" }),
      makeMarket({ condition_id: "0xaaa", question: "Duplicate" }),
      makeMarket({ condition_id: "0xbbb" }),
    ];
    const result = prepareSelectorMarkets(markets);
    const ids = result.map((r) => r.conditionId);
    expect(ids.filter((id) => id === "0xaaa")).toHaveLength(1);
    expect(ids).toContain("0xbbb");
  });

  it("active markets sorted before inactive", () => {
    const markets = [
      makeMarket({
        condition_id: "0xclosed",
        closed: true,
        outcomePrices: '["0.99","0.01"]',
      }),
      makeMarket({
        condition_id: "0xactive",
        outcomePrices: '["0.50","0.50"]',
      }),
    ];
    const result = prepareSelectorMarkets(markets);
    expect(result[0].conditionId).toBe("0xactive");
    expect(result[0].inactive).toBeFalsy();
    expect(result[1].conditionId).toBe("0xclosed");
    expect(result[1].inactive).toBeTruthy();
  });

  it("returns SelectorMarket[] with correct conditionId and inactive flag", () => {
    const markets = [
      makeMarket({ condition_id: "0xaaa" }),
      makeMarket({ condition_id: "0xbbb", closed: true }),
    ];
    const result = prepareSelectorMarkets(markets);
    expect(result).toHaveLength(2);

    const active = result.find((r) => r.conditionId === "0xaaa");
    expect(active).toBeDefined();
    expect(active?.inactive).toBeFalsy();
    expect(active?.market).toBeDefined();
    expect(getConditionId(active?.market)).toBe("0xaaa");

    const closed = result.find((r) => r.conditionId === "0xbbb");
    expect(closed).toBeDefined();
    expect(closed?.inactive).toBeTruthy();
    expect(getConditionId(closed?.market)).toBe("0xbbb");
  });
});
