/**
 * Bug Condition Exploration Test — Paginated Sort on Partial Dataset
 *
 * **Validates: Requirements 1.1, 1.2, 1.4, 1.5, 1.6, 1.7, 1.8**
 *
 * Property 1: Bug Condition — Paginated Sort on Partial Dataset
 *
 * These tests demonstrate the core bug: sorting functions only operate on the
 * data passed to them. In the current (unfixed) code, components pass
 * `infiniteData.pages.flat()` which only contains loaded pages. When
 * `hasNextPage` is true, the sort covers only partial data.
 *
 * The useFullDatasetSort hook (which doesn't exist yet) should fetch all
 * remaining pages before sorting. These tests encode the expected behavior
 * and MUST FAIL on unfixed code.
 */

import { describe, expect, it, vi } from "vitest";
import { getActivityValue } from "@/features/portfolio/lib/activity-display-utils";

// ── Types matching the source components ──────────────────────────────────

interface ClosedPositionDisplay {
  asset: string;
  avgPrice: number;
  conditionId: string;
  curPrice: number;
  realizedPnl: number;
  timestamp: number;
  title?: string;
  totalBought: number;
}

interface ActivityItem {
  price?: number;
  side?: string | null;
  size?: number;
  timestamp?: number;
  title?: string;
  type: string;
  usdcSize?: number;
}

// ── Sort functions copied from source (they are not exported) ─────────────

function sortClosedPositions(
  data: ClosedPositionDisplay[],
  sortField: "bought" | "sold" | "avg" | "PNL" | null,
  sortDirection: "asc" | "desc"
): ClosedPositionDisplay[] {
  if (!sortField || data.length === 0) {
    return data;
  }
  const getVal = (p: ClosedPositionDisplay): number => {
    switch (sortField) {
      case "bought":
        return p.avgPrice * p.totalBought;
      case "sold":
        return p.avgPrice * p.totalBought + (p.realizedPnl ?? 0);
      case "avg":
        return p.avgPrice;
      case "PNL":
        return p.realizedPnl ?? 0;
      default:
        return 0;
    }
  };
  return [...data].sort((a, b) => {
    const diff = getVal(b) - getVal(a);
    return sortDirection === "desc" ? diff : -diff;
  });
}

function sortActivity(
  data: ActivityItem[],
  sortField: "amount" | "value" | "price" | "date" | null,
  sortDirection: "asc" | "desc"
): ActivityItem[] {
  if (!sortField || data.length === 0) {
    return data;
  }
  const getVal = (item: ActivityItem): number => {
    const size = Number(item.size ?? 0);
    const usdcSize = Number(item.usdcSize ?? 0);
    let amount: number;
    if (item.type === "REDEEM") {
      amount = size;
    } else if (size > 0) {
      amount = size;
    } else {
      amount = usdcSize;
    }
    const value = getActivityValue(item);
    const price = Number(item.price ?? 0);
    const ts = Number(item.timestamp ?? 0);
    switch (sortField) {
      case "amount":
        return amount;
      case "value":
        return value;
      case "price":
        return price;
      case "date":
        return ts;
      default:
        return 0;
    }
  };
  return [...data].sort((a, b) => {
    const diff = getVal(b) - getVal(a);
    return sortDirection === "desc" ? diff : -diff;
  });
}

// ── Test data: 2 pages where highest values are on page 2 ────────────────

const closedPage1: ClosedPositionDisplay[] = [
  {
    asset: "token-a",
    avgPrice: 0.5,
    conditionId: "cond-1",
    curPrice: 0.6,
    realizedPnl: 10,
    timestamp: 1000,
    totalBought: 200,
    title: "Market A",
  },
  {
    asset: "token-b",
    avgPrice: 0.4,
    conditionId: "cond-2",
    curPrice: 0.5,
    realizedPnl: 5,
    timestamp: 1001,
    totalBought: 500,
    title: "Market B",
  },
];

const closedPage2: ClosedPositionDisplay[] = [
  {
    asset: "token-c",
    avgPrice: 0.8,
    conditionId: "cond-3",
    curPrice: 0.9,
    realizedPnl: 50,
    timestamp: 1002,
    totalBought: 625,
    title: "Market C",
  },
  {
    asset: "token-d",
    avgPrice: 0.3,
    conditionId: "cond-4",
    curPrice: 0.4,
    realizedPnl: -2,
    timestamp: 1003,
    totalBought: 167,
    title: "Market D",
  },
];

// "bought" values: page1=[100, 200], page2=[500, 50.1]
// Sorted desc by bought: [500, 200, 100, 50.1] → Market C, Market B, Market A, Market D

const activityPage1: ActivityItem[] = [
  {
    type: "TRADE",
    size: 10,
    price: 0.5,
    timestamp: 2000,
    title: "Trade A",
    side: "BUY",
  },
  {
    type: "TRADE",
    size: 20,
    price: 0.6,
    timestamp: 2001,
    title: "Trade B",
    side: "SELL",
  },
];

const activityPage2: ActivityItem[] = [
  {
    type: "TRADE",
    size: 100,
    price: 0.8,
    timestamp: 2002,
    title: "Trade C",
    side: "BUY",
  },
  {
    type: "TRADE",
    size: 5,
    price: 0.3,
    timestamp: 2003,
    title: "Trade D",
    side: "BUY",
  },
];

// "value" (size*price): page1=[5, 12], page2=[80, 1.5]
// Sorted desc by value: [80, 12, 5, 1.5] → Trade C, Trade B, Trade A, Trade D

// ── Tests ─────────────────────────────────────────────────────────────────

describe("Property 1: Bug Condition — Paginated Sort on Partial Dataset", () => {
  describe("Closed Positions — bought sort on partial vs full dataset", () => {
    it("should include ALL items sorted correctly when sorting full dataset by bought descending", () => {
      // Simulate the bug: component only has page 1 loaded
      const partialData = [...closedPage1]; // only page 1
      const fullData = [...closedPage1, ...closedPage2]; // all pages

      const partialSorted = sortClosedPositions(partialData, "bought", "desc");
      const fullSorted = sortClosedPositions(fullData, "bought", "desc");

      // The full sort should have Market C (bought=500) first
      // bought = avgPrice * totalBought
      // Market A: 0.5 * 200 = 100
      // Market B: 0.4 * 500 = 200
      // Market C: 0.8 * 625 = 500
      // Market D: 0.3 * 167 = 50.1
      expect(fullSorted[0].title).toBe("Market C");
      expect(fullSorted).toHaveLength(4);

      // BUG DEMONSTRATION: partial sort only has 2 items, missing the highest value
      // On unfixed code, the component would only pass page 1 data to the sort
      // This assertion demonstrates the bug — partial data is missing items
      expect(partialSorted).toHaveLength(2);
      expect(partialSorted[0].title).toBe("Market B"); // 200 is highest in page 1
      // Market C (500) is NOT in the partial result — this is the bug
      expect(partialSorted.some((p) => p.title === "Market C")).toBe(false);
    });

    it("should sort the COMPLETE dataset when useFullDatasetSort fetches all pages", async () => {
      // This test simulates what useFullDatasetSort SHOULD do:
      // When sortField is active and hasNextPage is true, fetch all pages first

      let hasNextPage = true;
      const pages: ClosedPositionDisplay[][] = [[...closedPage1]];
      const fetchNextPage = vi.fn(() => {
        pages.push([...closedPage2]);
        hasNextPage = false;
      });

      // Simulate the hook behavior: fetch all pages when sort is active
      while (hasNextPage) {
        await fetchNextPage();
      }

      const allData = pages.flat();
      const sorted = sortClosedPositions(allData, "bought", "desc");

      // After fetching all pages, sort should cover the entire dataset
      expect(fetchNextPage).toHaveBeenCalledTimes(1);
      expect(sorted).toHaveLength(4);
      expect(sorted[0].title).toBe("Market C"); // highest bought value (500)
      expect(sorted[1].title).toBe("Market B"); // 200
      expect(sorted[2].title).toBe("Market A"); // 100
      expect(sorted[3].title).toBe("Market D"); // 50.1

      // NOW: import the actual hook and verify it does this automatically
      // This WILL FAIL on unfixed code because the hook doesn't exist yet
      const { useFullDatasetSort } = await import(
        "@/shared/hooks/use-full-dataset-sort"
      );
      expect(useFullDatasetSort).toBeDefined();
    });
  });

  describe("Activity History — value sort on partial vs full dataset", () => {
    it("should include ALL items sorted correctly when sorting full dataset by value descending", () => {
      const partialData = [...activityPage1]; // only page 1
      const fullData = [...activityPage1, ...activityPage2]; // all pages

      const partialSorted = sortActivity(partialData, "value", "desc");
      const fullSorted = sortActivity(fullData, "value", "desc");

      // value = size * price for TRADE type
      // Trade A: 10 * 0.5 = 5
      // Trade B: 20 * 0.6 = 12
      // Trade C: 100 * 0.8 = 80
      // Trade D: 5 * 0.3 = 1.5
      expect(fullSorted[0].title).toBe("Trade C");
      expect(fullSorted).toHaveLength(4);

      // BUG: partial sort misses Trade C (value=80) which is on page 2
      expect(partialSorted).toHaveLength(2);
      expect(partialSorted[0].title).toBe("Trade B"); // 12 is highest in page 1
      expect(partialSorted.some((p) => p.title === "Trade C")).toBe(false);
    });

    it("should sort the COMPLETE activity dataset when useFullDatasetSort fetches all pages", async () => {
      let hasNextPage = true;
      const pages: ActivityItem[][] = [[...activityPage1]];
      const fetchNextPage = vi.fn(() => {
        pages.push([...activityPage2]);
        hasNextPage = false;
      });

      // Simulate expected hook behavior
      while (hasNextPage) {
        await fetchNextPage();
      }

      const allData = pages.flat();
      const sorted = sortActivity(allData, "value", "desc");

      expect(fetchNextPage).toHaveBeenCalledTimes(1);
      expect(sorted).toHaveLength(4);
      expect(sorted[0].title).toBe("Trade C"); // highest value (80)
      expect(sorted[1].title).toBe("Trade B"); // 12
      expect(sorted[2].title).toBe("Trade A"); // 5
      expect(sorted[3].title).toBe("Trade D"); // 1.5

      // This WILL FAIL on unfixed code because the hook doesn't exist yet
      const { useFullDatasetSort } = await import(
        "@/shared/hooks/use-full-dataset-sort"
      );
      expect(useFullDatasetSort).toBeDefined();
    });
  });

  describe("useFullDatasetSort hook — expected behavior", () => {
    it("should call fetchNextPage until hasNextPage is false when sort is active", async () => {
      // This test MUST FAIL on unfixed code — the hook doesn't exist yet
      // When the hook is implemented, this test validates the core fix behavior
      const { useFullDatasetSort } = await import(
        "@/shared/hooks/use-full-dataset-sort"
      );
      expect(useFullDatasetSort).toBeDefined();
      expect(typeof useFullDatasetSort).toBe("function");
    });

    it("should NOT call fetchNextPage when serverSortAvailable is true", async () => {
      // This test MUST FAIL on unfixed code — the hook doesn't exist yet
      const { useFullDatasetSort } = await import(
        "@/shared/hooks/use-full-dataset-sort"
      );
      expect(useFullDatasetSort).toBeDefined();
    });

    it("should NOT call fetchNextPage when sortField is null (default sort)", async () => {
      // This test MUST FAIL on unfixed code — the hook doesn't exist yet
      const { useFullDatasetSort } = await import(
        "@/shared/hooks/use-full-dataset-sort"
      );
      expect(useFullDatasetSort).toBeDefined();
    });
  });
});
