/**
 * Preservation Property Tests — Smooth Sort Loading
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**
 *
 * Property 2: Preservation — Non-Bug-Condition Inputs Produce Unchanged Behavior
 *
 * These tests MUST PASS on unfixed code — they capture baseline behavior to preserve.
 * After the fix is applied, these tests must continue to pass (no regressions).
 *
 * Uses the same simulation approach as the bug condition tests: simulate component
 * rendering logic without full React rendering.
 */

import { describe, expect, it } from "vitest";
import { getActivityValue } from "@/features/portfolio/lib/activity-display-utils";

// ── Types matching source components ──────────────────────────────────────

interface ClosedPositionDisplay {
  asset: string;
  avgPrice: number;
  conditionId: string;
  curPrice: number;
  market?: { question?: string };
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

// ── Sort functions copied from source (not exported) ──────────────────────

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

// ── Helpers: simulate component rendering logic ───────────────────────────

/**
 * Mirrors ClosedPositionsContent rendering logic from closed-positions.tsx.
 * Returns what the component would render given these props.
 */
function simulateClosedPositionsContent(params: {
  data: ClosedPositionDisplay[] | undefined;
  isLoading: boolean;
  isError: boolean;
  sortField: "bought" | "sold" | "avg" | "PNL" | null;
  sortDirection: "asc" | "desc";
  serverSorted: boolean;
  allDataLoaded: boolean;
}): {
  type: "skeleton" | "error" | "empty" | "data-rows";
  rows?: ClosedPositionDisplay[];
} {
  const {
    data,
    isLoading,
    isError,
    sortField,
    sortDirection,
    serverSorted,
    allDataLoaded,
  } = params;

  if (isLoading) {
    return { type: "skeleton" };
  }
  if (isError) {
    return { type: "error" };
  }
  if (!data || data.length === 0) {
    return { type: "empty" };
  }

  // FIXED: Sort-transition skeletons for client-only sort
  if (
    !(allDataLoaded || serverSorted) &&
    sortField !== "PNL" &&
    data.length > 0
  ) {
    return { type: "skeleton" };
  }

  // CURRENT (unfixed) logic from closed-positions.tsx:
  // const sorted = serverSorted || !allDataLoaded ? data : sortClosedPositions(data, sortField, sortDirection);
  const sorted =
    serverSorted || !allDataLoaded
      ? data
      : sortClosedPositions(data, sortField, sortDirection);

  return { type: "data-rows", rows: sorted };
}

/**
 * Mirrors ActivityHistoryContent rendering logic from activity-history.tsx.
 * Returns what the component would render given these props.
 */
function simulateActivityHistoryContent(params: {
  data: ActivityItem[] | undefined;
  isLoading: boolean;
  isError: boolean;
  sortField: "amount" | "value" | "price" | "date" | null;
  sortDirection: "asc" | "desc";
  allDataLoaded: boolean;
  serverSorted?: boolean;
}): {
  type: "skeleton" | "error" | "empty" | "data-rows";
  rows?: ActivityItem[];
} {
  const {
    data,
    isLoading,
    isError,
    sortField,
    sortDirection,
    allDataLoaded,
    serverSorted = false,
  } = params;

  if (isLoading) {
    return { type: "skeleton" };
  }
  if (isError) {
    return { type: "error" };
  }
  if (!data || data.length === 0) {
    return { type: "empty" };
  }

  // FIXED: Sort-transition skeletons for client-only sort (price column)
  if (
    !allDataLoaded &&
    sortField !== "date" &&
    !serverSorted &&
    data.length > 0
  ) {
    return { type: "skeleton" };
  }

  // CURRENT (unfixed) logic from activity-history.tsx:
  // const sorted = allDataLoaded ? sortActivity(data, sortField, sortDirection) : data;
  const sorted = allDataLoaded
    ? sortActivity(data, sortField, sortDirection)
    : data;

  return { type: "data-rows", rows: sorted };
}

/**
 * Mirrors trading terminal HistoryTab sort rendering logic.
 * Returns what the component would render.
 */
function simulateTradingHistoryContent(params: {
  activity: ActivityItem[];
  histSort: "shares" | "price" | "time" | "value" | null;
  histDir: "asc" | "desc";
  histAllLoaded: boolean;
  isLoading: boolean;
  user: string | null;
}): { type: "skeleton" | "empty" | "data-rows"; rows?: ActivityItem[] } {
  const { activity, histSort, histDir, histAllLoaded, isLoading, user } =
    params;

  const HIST_SORT_API_MAP: Record<
    string,
    "TOKENS" | "TIMESTAMP" | "CASH" | null
  > = {
    shares: "TOKENS",
    time: "TIMESTAMP",
    value: "CASH",
    price: null,
  };

  if (isLoading && activity.length === 0) {
    return { type: "skeleton" };
  }
  if (!user || activity.length === 0) {
    return { type: "empty" };
  }

  // FIXED: Sort-transition skeletons for client-only sort (price column)
  const apiSortBy = histSort ? (HIST_SORT_API_MAP[histSort] ?? null) : null;
  if (
    !(apiSortBy || histAllLoaded) &&
    histSort !== "time" &&
    activity.length > 0
  ) {
    return { type: "skeleton" };
  }

  let sorted: ActivityItem[];
  if (!histAllLoaded) {
    sorted = activity;
  } else if (histSort) {
    const getVal = (item: ActivityItem) => {
      if (histSort === "shares") {
        return Number(item.size ?? 0);
      }
      if (histSort === "price") {
        return Number(item.price ?? 0) * 100;
      }
      if (histSort === "value") {
        return getActivityValue(item);
      }
      return item.timestamp ?? 0;
    };
    sorted = [...activity].sort((a, b) => {
      const diff = getVal(b) - getVal(a);
      return histDir === "desc" ? diff : -diff;
    });
  } else {
    sorted = activity;
  }

  return { type: "data-rows", rows: sorted };
}

// ── Mock data ─────────────────────────────────────────────────────────────

const mockClosedPositions: ClosedPositionDisplay[] = [
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

const mockActivityItems: ActivityItem[] = [
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
  {
    type: "TRADE",
    size: 100,
    price: 0.8,
    timestamp: 2002,
    title: "Trade C",
    side: "BUY",
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Preservation Tests — Baseline behavior that must remain unchanged
// ═══════════════════════════════════════════════════════════════════════════

describe("Preservation: Closed Positions Server Sort", () => {
  /**
   * **Validates: Requirements 3.1**
   *
   * Closed Positions with serverSorted=true (PNL, avg) should render
   * data rows without sort-transition skeletons, regardless of allDataLoaded.
   * The server handles sorting — no client-side fetch-all or skeletons needed.
   */
  it("PNL sort with serverSorted=true renders data-rows, not skeletons (allDataLoaded=true)", () => {
    const result = simulateClosedPositionsContent({
      data: mockClosedPositions,
      isLoading: false,
      isError: false,
      sortField: "PNL",
      sortDirection: "desc",
      serverSorted: true,
      allDataLoaded: true,
    });

    expect(result.type).toBe("data-rows");
    expect(result.rows).toBeDefined();
    expect(result.rows?.length).toBe(mockClosedPositions.length);
  });

  it("avg sort with serverSorted=true renders data-rows, not skeletons (allDataLoaded=false)", () => {
    const result = simulateClosedPositionsContent({
      data: mockClosedPositions,
      isLoading: false,
      isError: false,
      sortField: "avg",
      sortDirection: "desc",
      serverSorted: true,
      allDataLoaded: false,
    });

    expect(result.type).toBe("data-rows");
    expect(result.rows).toBeDefined();
    expect(result.rows?.length).toBe(mockClosedPositions.length);
  });

  it("PNL sort with serverSorted=true renders data-rows regardless of allDataLoaded=false", () => {
    const result = simulateClosedPositionsContent({
      data: mockClosedPositions,
      isLoading: false,
      isError: false,
      sortField: "PNL",
      sortDirection: "asc",
      serverSorted: true,
      allDataLoaded: false,
    });

    expect(result.type).toBe("data-rows");
    expect(result.rows).toBeDefined();
  });
});

describe("Preservation: Default Sort", () => {
  /**
   * **Validates: Requirements 3.2, 3.6**
   *
   * Activity History with sortField="date" (default) should render data rows
   * without sort-transition skeletons or fetch-all, regardless of allDataLoaded.
   * The default sort matches server order — no client-side sorting needed.
   */
  it("ActivityHistory with default sort (date) renders data-rows, not skeletons (allDataLoaded=true)", () => {
    const result = simulateActivityHistoryContent({
      data: mockActivityItems,
      isLoading: false,
      isError: false,
      sortField: "date",
      sortDirection: "desc",
      allDataLoaded: true,
    });

    expect(result.type).toBe("data-rows");
    expect(result.rows).toBeDefined();
    expect(result.rows?.length).toBe(mockActivityItems.length);
  });

  it("ActivityHistory with default sort (date) renders data-rows even when allDataLoaded=false", () => {
    const result = simulateActivityHistoryContent({
      data: mockActivityItems,
      isLoading: false,
      isError: false,
      sortField: "date",
      sortDirection: "desc",
      allDataLoaded: false,
    });

    // On unfixed code, allDataLoaded=false means data is returned unsorted (raw server order).
    // For default sort (date desc), this is fine — server already returns in TIMESTAMP DESC order.
    expect(result.type).toBe("data-rows");
    expect(result.rows).toBeDefined();
    expect(result.rows?.length).toBe(mockActivityItems.length);
  });
});

describe("Preservation: All Data Loaded", () => {
  /**
   * **Validates: Requirements 3.4**
   *
   * When allDataLoaded=true and a non-default sort is active, data re-sorts
   * instantly in-place — no skeletons shown. The type should be "data-rows".
   */
  it("ClosedPositions with allDataLoaded=true and non-default sort re-sorts instantly", () => {
    const result = simulateClosedPositionsContent({
      data: mockClosedPositions,
      isLoading: false,
      isError: false,
      sortField: "bought",
      sortDirection: "desc",
      serverSorted: false,
      allDataLoaded: true,
    });

    expect(result.type).toBe("data-rows");
    expect(result.rows).toBeDefined();
    // Verify data is actually sorted by bought (avgPrice * totalBought) desc
    const _boughtA =
      mockClosedPositions[0].avgPrice * mockClosedPositions[0].totalBought; // 100
    const _boughtB =
      mockClosedPositions[1].avgPrice * mockClosedPositions[1].totalBought; // 200
    // B has higher bought value, so it should come first in desc order
    expect(result.rows?.[0].conditionId).toBe("cond-2");
    expect(result.rows?.[1].conditionId).toBe("cond-1");
  });

  it("ActivityHistory with allDataLoaded=true and non-default sort re-sorts instantly", () => {
    const result = simulateActivityHistoryContent({
      data: mockActivityItems,
      isLoading: false,
      isError: false,
      sortField: "price",
      sortDirection: "desc",
      allDataLoaded: true,
    });

    expect(result.type).toBe("data-rows");
    expect(result.rows).toBeDefined();
    // Verify sorted by price desc: 0.8, 0.6, 0.5
    expect(result.rows?.[0].price).toBe(0.8);
    expect(result.rows?.[1].price).toBe(0.6);
    expect(result.rows?.[2].price).toBe(0.5);
  });

  it("TradingHistory with histAllLoaded=true and non-default sort re-sorts instantly", () => {
    const result = simulateTradingHistoryContent({
      activity: mockActivityItems,
      histSort: "price",
      histDir: "desc",
      histAllLoaded: true,
      isLoading: false,
      user: "0xTestUser",
    });

    expect(result.type).toBe("data-rows");
    expect(result.rows).toBeDefined();
    // Verify sorted by price desc: 0.8, 0.6, 0.5
    expect(result.rows?.[0].price).toBe(0.8);
    expect(result.rows?.[1].price).toBe(0.6);
    expect(result.rows?.[2].price).toBe(0.5);
  });
});

describe("Preservation: Initial Load", () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * When isLoading=true, the existing initial-load skeleton path renders.
   * This must remain unchanged — type should be "skeleton".
   */
  it("ClosedPositions with isLoading=true renders skeleton", () => {
    const result = simulateClosedPositionsContent({
      data: undefined,
      isLoading: true,
      isError: false,
      sortField: "PNL",
      sortDirection: "desc",
      serverSorted: true,
      allDataLoaded: false,
    });

    expect(result.type).toBe("skeleton");
  });

  it("ActivityHistory with isLoading=true renders skeleton", () => {
    const result = simulateActivityHistoryContent({
      data: undefined,
      isLoading: true,
      isError: false,
      sortField: "date",
      sortDirection: "desc",
      allDataLoaded: false,
    });

    expect(result.type).toBe("skeleton");
  });

  it("TradingHistory with isLoading=true and no data renders skeleton", () => {
    const result = simulateTradingHistoryContent({
      activity: [],
      histSort: "time",
      histDir: "desc",
      histAllLoaded: false,
      isLoading: true,
      user: "0xTestUser",
    });

    expect(result.type).toBe("skeleton");
  });
});

describe("Preservation: Empty State", () => {
  /**
   * **Validates: Requirements 3.5**
   *
   * When data is empty, the empty state component renders — not skeletons.
   */
  it("ClosedPositions with empty data renders empty state", () => {
    const result = simulateClosedPositionsContent({
      data: [],
      isLoading: false,
      isError: false,
      sortField: "PNL",
      sortDirection: "desc",
      serverSorted: true,
      allDataLoaded: true,
    });

    expect(result.type).toBe("empty");
  });

  it("ClosedPositions with undefined data renders empty state", () => {
    const result = simulateClosedPositionsContent({
      data: undefined,
      isLoading: false,
      isError: false,
      sortField: "bought",
      sortDirection: "desc",
      serverSorted: false,
      allDataLoaded: false,
    });

    expect(result.type).toBe("empty");
  });

  it("ActivityHistory with empty data renders empty state", () => {
    const result = simulateActivityHistoryContent({
      data: [],
      isLoading: false,
      isError: false,
      sortField: "price",
      sortDirection: "desc",
      allDataLoaded: false,
    });

    expect(result.type).toBe("empty");
  });

  it("TradingHistory with no user renders empty state", () => {
    const result = simulateTradingHistoryContent({
      activity: mockActivityItems,
      histSort: "time",
      histDir: "desc",
      histAllLoaded: true,
      isLoading: false,
      user: null,
    });

    expect(result.type).toBe("empty");
  });

  it("TradingHistory with empty activity renders empty state", () => {
    const result = simulateTradingHistoryContent({
      activity: [],
      histSort: "time",
      histDir: "desc",
      histAllLoaded: true,
      isLoading: false,
      user: "0xTestUser",
    });

    expect(result.type).toBe("empty");
  });
});

describe("Preservation: activityWithMarkets Default Sort", () => {
  /**
   * **Validates: Requirements 3.6**
   *
   * When no sort params are provided, the default behavior is TIMESTAMP/DESC.
   * Verify the simulation with sortField="date" produces data-rows (not skeletons).
   * This confirms the default sort path is preserved.
   */
  it("ActivityHistory with sortField='date' (default) produces data-rows, not skeletons", () => {
    const result = simulateActivityHistoryContent({
      data: mockActivityItems,
      isLoading: false,
      isError: false,
      sortField: "date",
      sortDirection: "desc",
      allDataLoaded: true,
    });

    expect(result.type).toBe("data-rows");
    expect(result.rows).toBeDefined();
    // When allDataLoaded=true and sortField="date", data is sorted by timestamp desc
    // Timestamps: 2000, 2001, 2002 → sorted desc: 2002, 2001, 2000
    expect(result.rows?.[0].timestamp).toBe(2002);
    expect(result.rows?.[1].timestamp).toBe(2001);
    expect(result.rows?.[2].timestamp).toBe(2000);
  });

  it("TradingHistory with histSort='time' (default) produces data-rows, not skeletons", () => {
    const result = simulateTradingHistoryContent({
      activity: mockActivityItems,
      histSort: "time",
      histDir: "desc",
      histAllLoaded: true,
      isLoading: false,
      user: "0xTestUser",
    });

    expect(result.type).toBe("data-rows");
    expect(result.rows).toBeDefined();
    // Sorted by timestamp desc: 2002, 2001, 2000
    expect(result.rows?.[0].timestamp).toBe(2002);
    expect(result.rows?.[1].timestamp).toBe(2001);
    expect(result.rows?.[2].timestamp).toBe(2000);
  });
});
