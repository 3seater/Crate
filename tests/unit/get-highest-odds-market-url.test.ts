import { describe, expect, it } from "vitest";
import { getHighestOddsMarketUrl } from "@/features/trading/lib/markets/events";
import type { Market } from "@/shared/lib/trpc/types";

function mk(
  overrides: Partial<Market> & {
    conditionId: string;
    slug: string;
    outcome_prices?: string;
  }
): Market {
  return {
    active: true,
    archived: false,
    closed: false,
    outcome_prices: overrides.outcome_prices ?? '["0.5","0.5"]',
    ...overrides,
  } as Market;
}

describe("getHighestOddsMarketUrl", () => {
  it("does not append view=all-markets when only one market is still open", () => {
    const url = getHighestOddsMarketUrl({
      slug: "evt",
      markets: [
        mk({
          conditionId: "a",
          slug: "open-low",
          closed: false,
          outcome_prices: '["0.4","0.6"]',
        }),
        mk({
          conditionId: "b",
          slug: "closed-high",
          closed: true,
          outcome_prices: '["0.95","0.05"]',
        }),
        mk({
          conditionId: "c",
          slug: "closed-mid",
          closed: true,
          outcome_prices: '["0.7","0.3"]',
        }),
      ],
    });
    expect(url).toBe("/market/open-low");
  });

  it("appends view=all-markets when two or more markets are open", () => {
    const url = getHighestOddsMarketUrl({
      slug: "evt",
      markets: [
        mk({
          conditionId: "a",
          slug: "open-a",
          closed: false,
          outcome_prices: '["0.8","0.2"]',
        }),
        mk({
          conditionId: "b",
          slug: "open-b",
          closed: false,
          outcome_prices: '["0.3","0.7"]',
        }),
        mk({
          conditionId: "c",
          slug: "closed-only",
          closed: true,
          outcome_prices: '["0.99","0.01"]',
        }),
      ],
    });
    expect(url).toBe("/market/open-a?view=all-markets");
  });

  it("when all markets are resolved, links to highest odds market without view=all-markets", () => {
    const url = getHighestOddsMarketUrl({
      slug: "evt",
      markets: [
        mk({
          conditionId: "a",
          slug: "resolved-low",
          closed: true,
          outcome_prices: '["0.2","0.8"]',
        }),
        mk({
          conditionId: "b",
          slug: "resolved-high",
          closed: true,
          outcome_prices: '["0.91","0.09"]',
        }),
      ],
    });
    expect(url).toBe("/market/resolved-high");
  });

  it("does not append view=all-markets for recurring crypto tags even with 2+ open markets", () => {
    const url = getHighestOddsMarketUrl({
      slug: "evt",
      tags: [{ slug: "recurring" }],
      markets: [
        mk({
          conditionId: "a",
          slug: "open-a",
          closed: false,
          outcome_prices: '["0.9","0.1"]',
        }),
        mk({
          conditionId: "b",
          slug: "open-b",
          closed: false,
          outcome_prices: '["0.5","0.5"]',
        }),
      ],
    });
    expect(url).toBe("/market/open-a");
  });
});
