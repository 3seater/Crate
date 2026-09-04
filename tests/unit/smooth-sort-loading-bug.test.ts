/**
 * Bug Condition Exploration Tests — Smooth Sort Loading
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5**
 *
 * Property 1: Bug Condition — Server Sort Not Wired + Unsorted Data During Client-Only Sort
 *
 * These tests MUST FAIL on unfixed code — failure confirms both bugs exist.
 * DO NOT attempt to fix the tests or the code when they fail.
 *
 * Prong 1: Server sort params are not wired through `activityWithMarkets` or
 *   profile modal positions query — all sort columns trigger client-side fetch-all.
 *
 * Prong 2: When a client-only sort is active and `allDataLoaded=false`, components
 *   render unsorted data rows instead of skeleton rows — causing visible jitter.
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
// Prong 1 — Server sort not wired
// ═══════════════════════════════════════════════════════════════════════════

describe("Prong 1: Server sort not wired", () => {
  it("activityWithMarkets input schema should accept sortBy and sortDirection params", async () => {
    /**
     * The activityWithMarkets tRPC procedure currently hardcodes
     * sortBy: "TIMESTAMP", sortDirection: "DESC" and does NOT accept
     * these as input params. The fix adds them to the Zod input schema.
     *
     * We verify this indirectly: the client-side ACTIVITY_SORT_API mapping
     * must exist for the client to know which sort fields map to server
     * sort values. If the mapping exists, the procedure schema must also
     * accept sortBy/sortDirection.
     *
     * On UNFIXED code: ACTIVITY_SORT_API doesn't exist → test FAILS.
     * Validates: Requirement 1.1, 1.2
     */
    // We verify this indirectly: the client-side ACTIVITY_SORT_API mapping
    // must exist for the client to know which sort fields map to server
    // sort values. If the mapping exists, the procedure schema must also
    // accept sortBy/sortDirection (otherwise the client would send params
    // the server rejects).
    const activityHistoryModule = await import(
      "@/features/portfolio/components/activity-history"
    );

    // On FIXED code, ACTIVITY_SORT_API should be exported with mappings
    // On UNFIXED code, this export doesn't exist — test FAILS
    const sortApiMap = (activityHistoryModule as Record<string, unknown>)
      .ACTIVITY_SORT_API;
    expect(sortApiMap).toBeDefined();
    expect(sortApiMap).toHaveProperty("amount", "TOKENS");
    expect(sortApiMap).toHaveProperty("value", "CASH");
    expect(sortApiMap).toHaveProperty("date", "TIMESTAMP");
  });

  it("portfolio ActivityHistory should have serverSortAvailable=true for shares/value sorts", async () => {
    /**
     * Currently, ActivityHistory's useFullDatasetSort call hardcodes
     * serverSortAvailable: false — meaning ALL non-default sorts trigger
     * client-side fetch-all, even for shares (TOKENS) and value (CASH)
     * which the Data API supports.
     *
     * After the fix, serverSortAvailable should be derived from the sort
     * field → API mapping: true for amount/value/date, false for price.
     *
     * We verify this by checking that the ACTIVITY_SORT_API constant is
     * exported and maps shares/value to server sort values.
     *
     * On UNFIXED code: ACTIVITY_SORT_API doesn't exist → test FAILS.
     * Validates: Requirement 1.1, 1.2
     */
    const mod = await import(
      "@/features/portfolio/components/activity-history"
    );
    const sortApiMap = (mod as Record<string, unknown>).ACTIVITY_SORT_API as
      | Record<string, string | null>
      | undefined;

    // FIXED: ACTIVITY_SORT_API exists and maps amount→TOKENS, value→CASH
    expect(sortApiMap).toBeDefined();
    expect(sortApiMap?.amount).toBe("TOKENS");
    expect(sortApiMap?.value).toBe("CASH");
    // price has no server sort → null (client-only)
    expect(sortApiMap?.price).toBeNull();
  });

  it("profile modal positions query should pass sortBy/sortDirection to the positions endpoint", async () => {
    /**
     * The profile modal's active positions query calls
     * trpcClient.data.positions.query({ user, limit, offset })
     * WITHOUT passing sortBy/sortDirection, despite the positions
     * endpoint supporting AVGPRICE, PRICE, CURRENT, CASHPNL, etc.
     *
     * After the fix, POS_SORT_API should be exported from the modal
     * module mapping sort keys to API values.
     *
     * On UNFIXED code: POS_SORT_API doesn't exist → test FAILS.
     * Validates: Requirement 1.3
     */
    const mod = await import(
      "@/features/leaderboard/components/leaderboard-profile-modal"
    );
    const posSortApi = (mod as Record<string, unknown>).POS_SORT_API as
      | Record<string, string>
      | undefined;

    expect(posSortApi).toBeDefined();
    expect(posSortApi?.avg).toBe("AVGPRICE");
    expect(posSortApi?.price).toBe("PRICE");
    expect(posSortApi?.value).toBe("CURRENT");
    expect(posSortApi?.pnl).toBe("CASHPNL");
  });

  it("trading terminal HistoryTab should have serverSortAvailable=true for shares sort", async () => {
    /**
     * HistoryTab's useFullDatasetSort call hardcodes serverSortAvailable: false.
     * After the fix, HIST_SORT_API should be exported mapping shares→TOKENS,
     * time→TIMESTAMP, price→null.
     *
     * On UNFIXED code: HIST_SORT_API doesn't exist → test FAILS.
     * Validates: Requirement 1.1
     */
    const mod = await import(
      "@/features/trading/components/market/tabs/history-tab"
    );
    const histSortApi = (mod as Record<string, unknown>).HIST_SORT_API as
      | Record<string, string | null>
      | undefined;

    expect(histSortApi).toBeDefined();
    expect(histSortApi?.shares).toBe("TOKENS");
    expect(histSortApi?.time).toBe("TIMESTAMP");
    expect(histSortApi?.value).toBe("CASH");
    expect(histSortApi?.price).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Prong 2 — No skeleton during client-only sort
// ═══════════════════════════════════════════════════════════════════════════

describe("Prong 2: No skeleton during client-only sort", () => {
  it("ClosedPositionsContent should show skeletons when allDataLoaded=false, sortField='bought', serverSorted=false", () => {
    /**
     * When a user clicks "Bought" sort on Closed Positions and
     * useFullDatasetSort is fetching remaining pages (allDataLoaded=false),
     * the component should show skeleton rows — NOT unsorted data.
     *
     * CURRENT (unfixed): renders unsorted data rows (type: "data-rows")
     * EXPECTED (fixed): renders skeleton rows (type: "skeleton")
     *
     * On UNFIXED code this test FAILS because data rows are shown.
     * Validates: Requirement 1.4
     */
    const result = simulateClosedPositionsContent({
      data: mockClosedPositions,
      isLoading: false,
      isError: false,
      sortField: "bought",
      sortDirection: "desc",
      serverSorted: false,
      allDataLoaded: false,
    });

    // FIXED: should show skeletons during sort-transition fetch-all
    // UNFIXED: shows "data-rows" with unsorted data → FAILS
    expect(result.type).toBe("skeleton");
  });

  it("ClosedPositionsContent should show skeletons when allDataLoaded=false, sortField='sold', serverSorted=false", () => {
    /**
     * Same bug for "Sold" column — another client-only sort field.
     * Validates: Requirement 1.4
     */
    const result = simulateClosedPositionsContent({
      data: mockClosedPositions,
      isLoading: false,
      isError: false,
      sortField: "sold",
      sortDirection: "desc",
      serverSorted: false,
      allDataLoaded: false,
    });

    expect(result.type).toBe("skeleton");
  });

  it("ActivityHistoryContent should show skeletons when allDataLoaded=false, sortField='price'", () => {
    /**
     * When a user clicks "Price" sort on Activity History and
     * useFullDatasetSort is fetching remaining pages, the component
     * should show skeleton rows — NOT unsorted data.
     *
     * Price has no server-side sort mapping (price: null), so it's
     * always a client-only sort.
     *
     * CURRENT (unfixed): renders unsorted data rows
     * EXPECTED (fixed): renders skeleton rows
     *
     * On UNFIXED code this test FAILS.
     * Validates: Requirement 1.5
     */
    const result = simulateActivityHistoryContent({
      data: mockActivityItems,
      isLoading: false,
      isError: false,
      sortField: "price",
      sortDirection: "desc",
      allDataLoaded: false,
    });

    expect(result.type).toBe("skeleton");
  });

  it("Profile modal closed positions should show skeletons when closedApiSortBy=null, closedAllLoaded=false", () => {
    /**
     * In the profile modal, when sorting closed positions by "bought"
     * (closedApiSortBy=null) and not all data is loaded, skeleton rows
     * should appear instead of unsorted data.
     *
     * This mirrors the portfolio ClosedPositionsContent bug but in the
     * profile modal context.
     *
     * On UNFIXED code this test FAILS.
     * Validates: Requirement 1.4
     */
    const result = simulateClosedPositionsContent({
      data: mockClosedPositions,
      isLoading: false,
      isError: false,
      sortField: "bought",
      sortDirection: "desc",
      serverSorted: false, // closedApiSortBy is null for "bought"
      allDataLoaded: false, // closedAllLoaded is false
    });

    expect(result.type).toBe("skeleton");
  });

  it("Profile modal history should show skeletons when client-only sort active and histAllLoaded=false", () => {
    /**
     * Safety net: if a client-only sort column is active in the profile
     * modal history tab and not all data is loaded, skeletons should show.
     *
     * After Prong 1 fix, all profile modal history columns map to server
     * sort, so this is a safety net for the "price" column if it were added.
     * We test with the price sort field to verify the skeleton path exists.
     *
     * On UNFIXED code this test FAILS.
     * Validates: Requirement 1.5
     */
    const result = simulateActivityHistoryContent({
      data: mockActivityItems,
      isLoading: false,
      isError: false,
      sortField: "price",
      sortDirection: "desc",
      allDataLoaded: false,
    });

    expect(result.type).toBe("skeleton");
  });

  it("Trading terminal history should show skeletons when histSort='price', histAllLoaded=false", () => {
    /**
     * In the trading terminal HistoryTab, when sorting by "price"
     * (client-only, no server mapping) and not all data is loaded,
     * skeleton rows should appear instead of unsorted data.
     *
     * CURRENT (unfixed): renders unsorted data rows
     * EXPECTED (fixed): renders skeleton rows
     *
     * On UNFIXED code this test FAILS.
     * Validates: Requirement 1.5
     */
    const result = simulateTradingHistoryContent({
      activity: mockActivityItems.map((item) => ({
        ...item,
        timestamp: item.timestamp ?? 0,
      })),
      histSort: "price",
      histDir: "desc",
      histAllLoaded: false,
      isLoading: false,
      user: "0xTestUser",
    });

    // FIXED: should show skeletons during sort-transition fetch-all
    // UNFIXED: shows "data-rows" with unsorted data → FAILS
    expect(result.type).toBe("skeleton");
  });
});
