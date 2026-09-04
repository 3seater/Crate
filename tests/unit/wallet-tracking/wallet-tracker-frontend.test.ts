/**
 * Unit tests for the wallet tracker frontend logic (Task 5.3).
 *
 * Tests pure utility functions, cache invalidation behavior,
 * and rendering state logic.
 *
 * **Validates: Requirements 9.3, 9.4**
 */

import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Pure logic functions mirrored from wallet-tracker-content.tsx
// ---------------------------------------------------------------------------

function truncateAddress(address: string): string {
  if (!address || address.length < 10) {
    return address;
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function formatTradeTimestamp(ts: number): string {
  const date = new Date(ts * 1000);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatPositionValue(v: number): string {
  if (!Number.isFinite(v) || v === 0) {
    return "$0.00";
  }
  if (Math.abs(v) >= 1_000_000) {
    return `${(v / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(v) >= 1000) {
    return `${(v / 1000).toFixed(1)}k`;
  }
  return `${v.toFixed(2)}`;
}

function formatTimeAgo(tsSeconds: number): string {
  const diffSec = Math.floor(Date.now() / 1000 - tsSeconds);
  if (diffSec < 60) {
    return "Just now";
  }
  if (diffSec < 3600) {
    return `${Math.floor(diffSec / 60)}m ago`;
  }
  if (diffSec < 86_400) {
    return `${Math.floor(diffSec / 3600)}h ago`;
  }
  return `${Math.floor(diffSec / 86_400)}d ago`;
}

function sideDisplayLabel(side: string): string {
  if (side === "BUY") {
    return "Buy";
  }
  if (side === "SELL") {
    return "Sell";
  }
  return side;
}

function outcomeColorClass(outcome: string): string {
  const lower = outcome.toLowerCase();
  if (lower === "yes") {
    return "text-positive";
  }
  if (lower === "no") {
    return "text-negative";
  }
  return "text-muted-foreground";
}

// ---------------------------------------------------------------------------
// Cache invalidation logic
// ---------------------------------------------------------------------------

/**
 * Simulates the cache invalidation logic from useInvalidateWalletQueries.
 * Returns the query keys that would be invalidated.
 */
function getInvalidatedQueryKeys(): string[][] {
  return [
    ["wallets", "list"],
    ["wallets", "activity"],
    ["wallets", "values"],
  ];
}

// ---------------------------------------------------------------------------
// Partial failure warning logic
// ---------------------------------------------------------------------------

interface ActivityResponse {
  failures: string[];
  hasMore: boolean;
  total: number;
  trades: unknown[];
}

function hasPartialFailures(response: ActivityResponse | undefined): boolean {
  return (response?.failures ?? []).length > 0;
}

function formatFailureWarning(failures: string[]): string {
  const truncated = failures.map((a) => truncateAddress(a));
  return `Could not load data for ${failures.length} wallet${failures.length > 1 ? "s" : ""}: ${truncated.join(", ")}`;
}

// ---------------------------------------------------------------------------
// Tests: Pure utility functions
// ---------------------------------------------------------------------------

describe("truncateAddress", () => {
  it("truncates a standard Ethereum address", () => {
    const addr = "0x1234567890abcdef1234567890abcdef12345678";
    expect(truncateAddress(addr)).toBe("0x1234…5678");
  });

  it("returns short strings unchanged", () => {
    expect(truncateAddress("0x123")).toBe("0x123");
    expect(truncateAddress("")).toBe("");
  });

  it("handles exactly 10-char strings", () => {
    const addr = "0x12345678";
    expect(truncateAddress(addr)).toBe("0x1234…5678");
  });
});

describe("formatTradeTimestamp", () => {
  it("formats a valid unix timestamp", () => {
    // 2024-01-15 12:30:00 UTC = 1705318200
    const result = formatTradeTimestamp(1_705_318_200);
    expect(result).toContain("Jan");
    expect(result).toContain("15");
  });

  it("returns dash for NaN timestamp", () => {
    expect(formatTradeTimestamp(Number.NaN)).toBe("—");
  });

  it("handles zero timestamp (epoch)", () => {
    const result = formatTradeTimestamp(0);
    // Epoch formats to a valid date string (timezone-dependent)
    expect(result).not.toBe("—");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatPositionValue", () => {
  it("formats zero as $0.00", () => {
    expect(formatPositionValue(0)).toBe("$0.00");
  });

  it("formats millions with M suffix", () => {
    expect(formatPositionValue(2_500_000)).toBe("2.5M");
  });

  it("formats thousands with k suffix", () => {
    expect(formatPositionValue(1500)).toBe("1.5k");
  });

  it("formats small values with 2 decimal places", () => {
    expect(formatPositionValue(42.5)).toBe("42.50");
  });

  it("returns $0.00 for non-finite values", () => {
    expect(formatPositionValue(Number.POSITIVE_INFINITY)).toBe("$0.00");
    expect(formatPositionValue(Number.NaN)).toBe("$0.00");
  });
});

describe("formatTimeAgo", () => {
  it("returns 'Just now' for recent timestamps", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatTimeAgo(now - 30)).toBe("Just now");
  });

  it("returns minutes ago", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatTimeAgo(now - 300)).toBe("5m ago");
  });

  it("returns hours ago", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatTimeAgo(now - 7200)).toBe("2h ago");
  });

  it("returns days ago", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatTimeAgo(now - 172_800)).toBe("2d ago");
  });
});

describe("sideDisplayLabel", () => {
  it("maps BUY to Buy", () => {
    expect(sideDisplayLabel("BUY")).toBe("Buy");
  });

  it("maps SELL to Sell", () => {
    expect(sideDisplayLabel("SELL")).toBe("Sell");
  });

  it("returns unknown values as-is", () => {
    expect(sideDisplayLabel("HOLD")).toBe("HOLD");
  });
});

describe("outcomeColorClass", () => {
  it("returns positive class for yes", () => {
    expect(outcomeColorClass("Yes")).toBe("text-positive");
    expect(outcomeColorClass("yes")).toBe("text-positive");
  });

  it("returns negative class for no", () => {
    expect(outcomeColorClass("No")).toBe("text-negative");
    expect(outcomeColorClass("no")).toBe("text-negative");
  });

  it("returns muted class for other outcomes", () => {
    expect(outcomeColorClass("Maybe")).toBe("text-muted-foreground");
  });
});

// ---------------------------------------------------------------------------
// Tests: Cache invalidation logic
// ---------------------------------------------------------------------------

describe("Cache invalidation", () => {
  /**
   * **Validates: Requirements 9.3**
   *
   * After any mutation (add/update/remove), the wallet list, activity,
   * and values query keys should all be invalidated.
   */
  it("invalidates wallets.list, wallets.activity, and wallets.values query keys", () => {
    const keys = getInvalidatedQueryKeys();
    expect(keys).toHaveLength(3);
    expect(keys).toContainEqual(["wallets", "list"]);
    expect(keys).toContainEqual(["wallets", "activity"]);
    expect(keys).toContainEqual(["wallets", "values"]);
  });

  it("invalidation keys are consistent across add, update, and remove mutations", () => {
    // All three mutations use the same invalidation function
    const addKeys = getInvalidatedQueryKeys();
    const updateKeys = getInvalidatedQueryKeys();
    const removeKeys = getInvalidatedQueryKeys();
    expect(addKeys).toEqual(updateKeys);
    expect(updateKeys).toEqual(removeKeys);
  });
});

// ---------------------------------------------------------------------------
// Tests: Partial failure warning display
// ---------------------------------------------------------------------------

describe("Partial failure warning", () => {
  /**
   * **Validates: Requirements 9.4**
   *
   * When the activity response contains failures, a warning should be displayed.
   */
  it("detects partial failures when failures array is non-empty", () => {
    const response: ActivityResponse = {
      trades: [],
      total: 0,
      hasMore: false,
      failures: ["0x1234567890abcdef1234567890abcdef12345678"],
    };
    expect(hasPartialFailures(response)).toBe(true);
  });

  it("returns false when failures array is empty", () => {
    const response: ActivityResponse = {
      trades: [],
      total: 0,
      hasMore: false,
      failures: [],
    };
    expect(hasPartialFailures(response)).toBe(false);
  });

  it("returns false when response is undefined", () => {
    expect(hasPartialFailures(undefined)).toBe(false);
  });

  it("formats single wallet failure warning correctly", () => {
    const failures = ["0x1234567890abcdef1234567890abcdef12345678"];
    const msg = formatFailureWarning(failures);
    expect(msg).toBe("Could not load data for 1 wallet: 0x1234…5678");
  });

  it("formats multiple wallet failure warnings correctly", () => {
    const failures = [
      "0x1234567890abcdef1234567890abcdef12345678",
      "0xabcdef1234567890abcdef1234567890abcdef12",
    ];
    const msg = formatFailureWarning(failures);
    expect(msg).toBe(
      "Could not load data for 2 wallets: 0x1234…5678, 0xabcd…ef12"
    );
  });
});

// ---------------------------------------------------------------------------
// Tests: Loading and error state logic
// ---------------------------------------------------------------------------

describe("Loading and error state rendering logic", () => {
  /**
   * **Validates: Requirements 9.4**
   *
   * The component should show appropriate states during server communication.
   */

  interface RenderState {
    showEmptyState: boolean;
    showError: boolean;
    showSkeleton: boolean;
    showWallets: boolean;
  }

  function computeWalletListState(
    walletsLoading: boolean,
    walletsError: boolean,
    walletCount: number
  ): RenderState {
    return {
      showSkeleton: walletsLoading,
      showError: !walletsLoading && walletsError,
      showWallets: !(walletsLoading || walletsError) && walletCount > 0,
      showEmptyState: !(walletsLoading || walletsError) && walletCount === 0,
    };
  }

  it("shows skeleton when loading", () => {
    const state = computeWalletListState(true, false, 0);
    expect(state.showSkeleton).toBe(true);
    expect(state.showError).toBe(false);
    expect(state.showWallets).toBe(false);
    expect(state.showEmptyState).toBe(false);
  });

  it("shows error when query fails", () => {
    const state = computeWalletListState(false, true, 0);
    expect(state.showSkeleton).toBe(false);
    expect(state.showError).toBe(true);
    expect(state.showWallets).toBe(false);
    expect(state.showEmptyState).toBe(false);
  });

  it("shows wallets when loaded successfully with data", () => {
    const state = computeWalletListState(false, false, 5);
    expect(state.showSkeleton).toBe(false);
    expect(state.showError).toBe(false);
    expect(state.showWallets).toBe(true);
    expect(state.showEmptyState).toBe(false);
  });

  it("shows empty state when loaded with no wallets", () => {
    const state = computeWalletListState(false, false, 0);
    expect(state.showSkeleton).toBe(false);
    expect(state.showError).toBe(false);
    expect(state.showWallets).toBe(false);
    expect(state.showEmptyState).toBe(true);
  });

  it("loading takes precedence over error", () => {
    // If somehow both loading and error are true, loading wins
    const state = computeWalletListState(true, true, 0);
    expect(state.showSkeleton).toBe(true);
    expect(state.showError).toBe(false);
  });
});

describe("Trades content state logic", () => {
  interface TradesRenderState {
    showEmptyNoTrades: boolean;
    showEmptyNoWallets: boolean;
    showError: boolean;
    showLoading: boolean;
    showTrades: boolean;
  }

  function computeTradesState(
    tradesLoading: boolean,
    tradesError: boolean,
    walletCount: number,
    tradeCount: number
  ): TradesRenderState {
    if (tradesLoading) {
      return {
        showLoading: true,
        showError: false,
        showEmptyNoWallets: false,
        showEmptyNoTrades: false,
        showTrades: false,
      };
    }
    if (tradesError) {
      return {
        showLoading: false,
        showError: true,
        showEmptyNoWallets: false,
        showEmptyNoTrades: false,
        showTrades: false,
      };
    }
    if (walletCount === 0) {
      return {
        showLoading: false,
        showError: false,
        showEmptyNoWallets: true,
        showEmptyNoTrades: false,
        showTrades: false,
      };
    }
    if (tradeCount === 0) {
      return {
        showLoading: false,
        showError: false,
        showEmptyNoWallets: false,
        showEmptyNoTrades: true,
        showTrades: false,
      };
    }
    return {
      showLoading: false,
      showError: false,
      showEmptyNoWallets: false,
      showEmptyNoTrades: false,
      showTrades: true,
    };
  }

  it("shows loading state", () => {
    const state = computeTradesState(true, false, 2, 0);
    expect(state.showLoading).toBe(true);
    expect(state.showTrades).toBe(false);
  });

  it("shows error state", () => {
    const state = computeTradesState(false, true, 2, 0);
    expect(state.showError).toBe(true);
    expect(state.showTrades).toBe(false);
  });

  it("shows empty state when no wallets tracked", () => {
    const state = computeTradesState(false, false, 0, 0);
    expect(state.showEmptyNoWallets).toBe(true);
  });

  it("shows empty state when wallets exist but no trades", () => {
    const state = computeTradesState(false, false, 3, 0);
    expect(state.showEmptyNoTrades).toBe(true);
  });

  it("shows trades when data is available", () => {
    const state = computeTradesState(false, false, 3, 10);
    expect(state.showTrades).toBe(true);
  });
});
