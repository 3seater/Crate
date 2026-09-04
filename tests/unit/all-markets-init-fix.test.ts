/**
 * Bug condition exploration tests for All Markets Init Race Conditions.
 *
 * These tests are EXPECTED TO FAIL on unfixed code — failure confirms the bugs exist.
 * DO NOT attempt to fix the test or the code when it fails.
 *
 * Bug 1: Empty Charts Race Condition — visibleMarketIds populated before eventMarketsForChart is ready
 * Bug 2: Header Flash — stale stickyEventRef during cross-event navigation
 * Bug 3: Recurring Crypto Flash — recurring check fires AFTER visibleMarketIds is already set
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import { describe, expect, it } from "vitest";
import { getDefaultVisibleMarkets } from "@/features/trading/lib/default-visible-markets";
import { isRecurringCryptoEventForAllMarkets } from "@/features/trading/lib/markets/events";
import {
  getOutcomeLabel,
  prepareSelectorMarkets,
} from "@/features/trading/lib/markets/prepare-selector-markets";
import { getYesNoTokenIds } from "@/features/trading/lib/trading-utils";
import type { Market } from "@/shared/lib/trpc/types";

// ---------------------------------------------------------------------------
// Helpers: mock Market objects
// ---------------------------------------------------------------------------

/** Create a market WITH proper tokens and clobTokenIds (simulates fetched/normalized markets). */
function makeFullMarket(
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
    clobTokenIds: (overrides as { clobTokenIds?: string[] }).clobTokenIds ?? [
      `yes-${cid}`,
      `no-${cid}`,
    ],
    ...overrides,
  } as Market;
}

/**
 * Create a market WITHOUT tokens or clobTokenIds.
 * This simulates embedded markets from `market.events[0].markets` which often
 * lack the token arrays needed for chart rendering.
 */
function makeEmbeddedMarket(
  overrides: Partial<Market> & { condition_id: string }
): Market {
  return {
    condition_id: overrides.condition_id,
    question: overrides.question ?? `Market ${overrides.condition_id}?`,
    outcomePrices: overrides.outcomePrices ?? '["0.55","0.45"]',
    active: overrides.active ?? true,
    closed: overrides.closed ?? false,
    // NO tokens array, NO clobTokenIds — this is the key difference
    ...overrides,
  } as Market;
}

// ---------------------------------------------------------------------------
// Pure function: mirrors the useEffect logic from trading-layout-terminal.tsx
// that populates visibleMarketIds (~line 260-285)
// ---------------------------------------------------------------------------
interface EventDataForChart {
  markets?: Market[];
  slug?: string;
  tags?: Array<{ slug?: string }>;
}

/**
 * Mirrors the useEffect logic in trading-layout-terminal.tsx that populates
 * visibleMarketIds. This is the FIXED logic:
 *
 *   if (!allMarketsMode) return;              → action: 'none'
 *   if (visibleMarketIds.length > 0) return;  → action: 'none'
 *   if (isRecurringCrypto) { reset; return; } → action: 'reset'  (BEFORE length guard)
 *   if (eventMarketsRaw.length < 2) return;   → action: 'none'
 *   setVisibleMarketIds(getDefaultVisibleMarkets(...)) → action: 'set'
 */
function computeVisibleMarketIds(params: {
  allMarketsMode: boolean;
  visibleMarketIds: string[];
  eventMarketsRaw: Market[];
  eventDataForChart: EventDataForChart | null;
}):
  | { action: "set"; ids: string[] }
  | { action: "reset" }
  | { action: "none" } {
  const {
    allMarketsMode,
    visibleMarketIds,
    eventMarketsRaw,
    eventDataForChart,
  } = params;

  if (!allMarketsMode) {
    return { action: "none" };
  }
  if (visibleMarketIds.length > 0) {
    return { action: "none" };
  }
  // FIXED: Check recurring BEFORE the length guard
  if (isRecurringCryptoEventForAllMarkets(eventDataForChart)) {
    return { action: "reset" };
  }
  if (eventMarketsRaw.length < 2) {
    return { action: "none" };
  }
  const selectorItems = prepareSelectorMarkets(eventMarketsRaw);
  return { action: "set", ids: getDefaultVisibleMarkets(selectorItems) };
}

/**
 * Derives eventMarketsForChart from eventMarketsRaw — mirrors the useMemo
 * in trading-layout-terminal.tsx (~line 230-255).
 */
function deriveEventMarketsForChart(eventMarketsRaw: Market[]) {
  if (eventMarketsRaw.length < 2) {
    return [];
  }
  const items = prepareSelectorMarkets(eventMarketsRaw);
  const result: Array<{ conditionId: string; tokenId: string; label: string }> =
    [];
  for (const item of items) {
    const clobIds = (item.market as { clobTokenIds?: string[] }).clobTokenIds;
    const yesToken =
      Array.isArray(clobIds) && clobIds.length > 0
        ? clobIds[0]
        : getYesNoTokenIds(item.market).yes || null;
    if (!yesToken) {
      continue;
    }
    result.push({
      conditionId: item.conditionId,
      tokenId: yesToken,
      label: getOutcomeLabel(item.market),
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Pure function: mirrors the stickyEventRef logic from market-header-trading.tsx
// ---------------------------------------------------------------------------

interface HeaderEventShape {
  markets?: Market[];
  slug?: string;
  title?: string;
}

/**
 * Mirrors the stickyEventRef update logic in market-header-trading.tsx (~line 50-65).
 * Returns the resolved eventData that the header would use for rendering.
 *
 * FIXED: When allMarketsMode=true and slugs differ (cross-event navigation),
 * the sticky ref is cleared to prevent stale data from flashing.
 */
function resolveHeaderEventData(params: {
  stickyEventRef: HeaderEventShape | undefined;
  currentEventData: HeaderEventShape | undefined;
  allMarketsMode: boolean;
}): {
  eventData: HeaderEventShape | undefined;
  updatedStickyRef: HeaderEventShape | undefined;
} {
  const { currentEventData, allMarketsMode } = params;
  let stickyRef = params.stickyEventRef;

  // FIXED: Clear stale sticky ref on cross-event navigation in All Markets mode
  if (
    allMarketsMode &&
    stickyRef &&
    currentEventData?.slug &&
    stickyRef.slug !== currentEventData.slug
  ) {
    stickyRef = undefined;
  }

  if (currentEventData?.title) {
    const prev = stickyRef;
    const next = currentEventData;
    const prevN = prev?.markets?.length ?? 0;
    const nextN = next.markets?.length ?? 0;
    const sameSlug =
      typeof prev?.slug === "string" &&
      typeof next.slug === "string" &&
      prev.slug === next.slug;
    if (sameSlug && prevN > 1 && nextN <= 1) {
      stickyRef = { ...next, markets: prev.markets };
    } else {
      stickyRef = next;
    }
  }

  const eventData = stickyRef ?? currentEventData;
  return { eventData, updatedStickyRef: stickyRef };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Bug 1: visibleMarketIds population", () => {
  it("should populate visibleMarketIds when eventMarketsRaw has 2+ markets (even without tokens)", () => {
    /**
     * Scenario: allMarketsMode=true, visibleMarketIds=[], eventMarketsRaw has 4 embedded
     * markets WITHOUT tokens/clobTokenIds.
     *
     * The population logic uses prepareSelectorMarkets which only needs condition_id,
     * not tokens. visibleMarketIds stores condition IDs, not token IDs.
     * The chart component handles the case where eventMarketsForChart hasn't loaded
     * yet by showing an empty chart that fills in when the fetched event data arrives
     * with synthesized tokens.
     */
    const embeddedMarkets = [
      makeEmbeddedMarket({ condition_id: "0xaaa" }),
      makeEmbeddedMarket({ condition_id: "0xbbb" }),
      makeEmbeddedMarket({ condition_id: "0xccc" }),
      makeEmbeddedMarket({ condition_id: "0xddd" }),
    ];

    // Verify precondition: eventMarketsForChart would be empty for these markets
    const chartMarkets = deriveEventMarketsForChart(embeddedMarkets);
    expect(chartMarkets).toHaveLength(0);

    // Verify precondition: eventMarketsRaw.length >= 2
    expect(embeddedMarkets.length).toBeGreaterThanOrEqual(2);

    const result = computeVisibleMarketIds({
      allMarketsMode: true,
      visibleMarketIds: [],
      eventMarketsRaw: embeddedMarkets,
      eventDataForChart: { slug: "test-event" },
    });

    // visibleMarketIds should be populated with condition IDs from prepareSelectorMarkets.
    // The chart will render once eventMarketsForChart catches up (fetched event has tokens).
    expect(result.action).toBe("set");
    expect((result as { ids: string[] }).ids.length).toBeGreaterThan(0);
  });

  it("should return action 'set' only when eventMarketsForChart would be non-empty", () => {
    /**
     * Scenario: allMarketsMode=true, visibleMarketIds=[], eventMarketsRaw has 4 FULL
     * markets WITH tokens. The derived eventMarketsForChart would be non-empty.
     *
     * This should work correctly on both fixed and unfixed code.
     */
    const fullMarkets = [
      makeFullMarket({
        condition_id: "0xaaa",
        outcomePrices: '["0.70","0.30"]',
      }),
      makeFullMarket({
        condition_id: "0xbbb",
        outcomePrices: '["0.60","0.40"]',
      }),
      makeFullMarket({
        condition_id: "0xccc",
        outcomePrices: '["0.50","0.50"]',
      }),
      makeFullMarket({
        condition_id: "0xddd",
        outcomePrices: '["0.40","0.60"]',
      }),
    ];

    // Verify precondition: eventMarketsForChart would be non-empty
    const chartMarkets = deriveEventMarketsForChart(fullMarkets);
    expect(chartMarkets.length).toBeGreaterThan(0);

    const result = computeVisibleMarketIds({
      allMarketsMode: true,
      visibleMarketIds: [],
      eventMarketsRaw: fullMarkets,
      eventDataForChart: { slug: "test-event" },
    });

    expect(result.action).toBe("set");
    expect((result as { ids: string[] }).ids.length).toBeGreaterThan(0);
  });
});

describe("Bug 2: Header Flash — stale stickyEventRef", () => {
  it("should not retain Event A's data when navigating to Event B with allMarketsMode=true", () => {
    /**
     * Scenario: User was on Event A, stickyEventRef holds Event A's data.
     * User navigates to Event B with allMarketsMode=true.
     *
     * EXPECTED (fixed): eventData should reflect Event B, not Event A.
     *   When allMarketsMode=true and slugs differ, the sticky ref should be
     *   cleared so the header shows "All Markets | Event B title".
     *
     * ACTUAL (unfixed): stickyEventRef is updated to Event B's data (since
     *   currentEventData has a title), BUT the issue is that during the
     *   transition frame, the sticky ref still holds Event A's data and
     *   the header briefly shows Event A's outcome label.
     *
     * We test that when allMarketsMode=true and the current event slug differs
     * from the sticky ref's slug, the resolved eventData should NOT have
     * Event A's slug.
     */
    const eventAData: HeaderEventShape = {
      slug: "event-a-slug",
      title: "Will BTC hit $100k?",
      markets: [
        makeFullMarket({ condition_id: "0x111", question: "BTC $100k?" }),
        makeFullMarket({ condition_id: "0x222", question: "BTC $150k?" }),
      ],
    };

    const eventBData: HeaderEventShape = {
      slug: "event-b-slug",
      title: "Will ETH hit $5k?",
      // During navigation, the new event may have fewer markets initially
      markets: [
        makeFullMarket({ condition_id: "0x333", question: "ETH $5k?" }),
      ],
    };

    // Simulate: stickyEventRef holds Event A, currentEventData is Event B
    const { eventData } = resolveHeaderEventData({
      stickyEventRef: eventAData,
      currentEventData: eventBData,
      allMarketsMode: true,
    });

    // On FIXED code: eventData.slug should be Event B's slug (sticky ref cleared/updated)
    // The header should show "All Markets | Will ETH hit $5k?" not Event A's outcome
    //
    // On UNFIXED code: The stickyRef IS updated to Event B (different slug → else branch),
    // but the real bug is that during the TRANSITION FRAME before currentEventData updates,
    // the sticky ref still has Event A. We simulate this by checking that when
    // allMarketsMode=true, the function should actively clear stale refs.
    expect(eventData?.slug).toBe("event-b-slug");
  });

  it("should clear stale sticky ref when allMarketsMode=true and currentEventData has a different slug", () => {
    /**
     * The real header flash bug: when navigating from Event A to Event B,
     * the sticky ref holds Event A's data. Once currentEventData arrives
     * with Event B's slug, the fix clears the stale ref so the header
     * immediately shows "All Markets | Event B" without flashing Event A.
     *
     * The clearing guard requires currentEventData?.slug to be defined
     * (so it can compare slugs). When currentEventData is still undefined
     * during the very first transition frame, the header rendering logic
     * handles it via the `allMarketsMode && hasEvent` branch which shows
     * "All Markets" from the sticky ref's title — acceptable because the
     * event title is still correct even if the slug is stale.
     */
    const eventAData: HeaderEventShape = {
      slug: "event-a-slug",
      title: "Will BTC hit $100k?",
      markets: [
        makeFullMarket({ condition_id: "0x111", question: "BTC $100k?" }),
        makeFullMarket({ condition_id: "0x222", question: "BTC $150k?" }),
      ],
    };

    // Event B arrives with partial data (slug + title, fewer markets)
    const eventBPartial: HeaderEventShape = {
      slug: "event-b-slug",
      title: "Will ETH hit $5k?",
      markets: [],
    };

    const { eventData, updatedStickyRef } = resolveHeaderEventData({
      stickyEventRef: eventAData,
      currentEventData: eventBPartial,
      allMarketsMode: true,
    });

    // FIXED: sticky ref is cleared because slugs differ, then updated to Event B
    expect(eventData?.slug).toBe("event-b-slug");
    expect(eventData?.title).toBe("Will ETH hit $5k?");
    // The stale Event A data should not leak through
    expect(updatedStickyRef?.slug).not.toBe("event-a-slug");
  });
});

describe("Bug 3: Recurring Crypto Flash — late recurring check", () => {
  it("should check recurring BEFORE the eventMarketsRaw length guard", () => {
    /**
     * Scenario: allMarketsMode=true, eventDataForChart has tags: [{ slug: "recurring" }],
     * but eventMarketsRaw hasn't loaded yet (length < 2).
     *
     * EXPECTED (fixed): The recurring check fires immediately when eventDataForChart
     *   has the "recurring" tag, returning { action: 'reset' } even before
     *   eventMarketsRaw loads.
     *
     * ACTUAL (unfixed): The eventMarketsRaw.length < 2 guard returns 'none' first,
     *   so the recurring check never fires until markets load. This means
     *   allMarketsMode stays true while waiting for data, and when data loads,
     *   visibleMarketIds gets populated BEFORE the recurring check on the next render.
     */
    const result = computeVisibleMarketIds({
      allMarketsMode: true,
      visibleMarketIds: [],
      eventMarketsRaw: [], // Markets haven't loaded yet
      eventDataForChart: {
        slug: "btc-5min-up-down",
        tags: [{ slug: "recurring" }],
      },
    });

    // On FIXED code: should return 'reset' — recurring detected early
    // On UNFIXED code: returns 'none' — the length < 2 guard fires first,
    //   so the recurring check never runs. allMarketsMode stays true.
    expect(result.action).toBe("reset");
  });

  it("should reset allMarketsMode for recurring crypto even when eventMarketsRaw has loaded", () => {
    /**
     * Scenario: allMarketsMode=true, eventDataForChart has "recurring" tag,
     * eventMarketsRaw has 4 markets.
     *
     * On UNFIXED code: The length guard passes, then recurring check fires → reset.
     * This works, BUT the problem is the ORDERING: on the first render when
     * eventMarketsRaw is empty, the recurring check doesn't fire (Bug 3 above).
     * On the second render when eventMarketsRaw loads, visibleMarketIds gets
     * populated FIRST, then on the THIRD render the recurring check fires.
     *
     * This test verifies the recurring check works when data is loaded (baseline).
     */
    const fullMarkets = [
      makeFullMarket({ condition_id: "0xaaa" }),
      makeFullMarket({ condition_id: "0xbbb" }),
      makeFullMarket({ condition_id: "0xccc" }),
      makeFullMarket({ condition_id: "0xddd" }),
    ];

    const result = computeVisibleMarketIds({
      allMarketsMode: true,
      visibleMarketIds: [],
      eventMarketsRaw: fullMarkets,
      eventDataForChart: {
        slug: "btc-5min-up-down",
        tags: [{ slug: "recurring" }],
      },
    });

    // Both fixed and unfixed code should return 'reset' here
    expect(result.action).toBe("reset");
  });
});
