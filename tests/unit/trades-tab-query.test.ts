import { describe, expect, it } from "vitest";
import {
  buildMarketLabelsLookup,
  buildVisibleMarketSlugs,
  canonicalizeConditionIdList,
  compareTradesTabRecency,
  getEffectiveMarketIdsForTradesQuery,
  getMarketLabelForTrade,
  isTradesTabBroadMarketCatalogQuery,
  shouldTradesTabAutoFetchMorePages,
  type TradesTabTradeRowModel,
  tradeMatchesTradesTabFilters,
} from "@/features/trading/components/market/tabs/trades-tab-query";
import { DEFAULT_TRADES_TAB_FILTERS } from "@/features/trading/components/market/tabs/trades-tab-toolbar";
import type { Market } from "@/shared/lib/trpc/types";

const baseTrade = (): TradesTabTradeRowModel => ({
  address: "0xabc",
  asset: "",
  conditionId:
    "0xdd22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110917",
  outcome: "Yes",
  price: "0.5",
  size: "100",
  side: "BUY",
  timestamp: 1_700_000_000,
  transactionHash: "0x1",
  username: "alice",
  pseudonym: "Al",
  profilePicture: "",
});

describe("shouldTradesTabAutoFetchMorePages", () => {
  const pageSize = 50;

  it("returns false when there is no merged tape yet", () => {
    expect(
      shouldTradesTabAutoFetchMorePages({
        tradesWithLiveCount: 0,
        clientFilteredEmpty: false,
        allMarketsMode: false,
        outcome: "no",
        filteredCount: 0,
        pageSize,
      })
    ).toBe(false);
  });

  it("returns true when every loaded row is filtered out", () => {
    expect(
      shouldTradesTabAutoFetchMorePages({
        tradesWithLiveCount: 50,
        clientFilteredEmpty: true,
        allMarketsMode: false,
        outcome: "no",
        filteredCount: 0,
        pageSize,
      })
    ).toBe(true);
  });

  it("returns true for sparse single-market outcome filter below one page", () => {
    expect(
      shouldTradesTabAutoFetchMorePages({
        tradesWithLiveCount: 50,
        clientFilteredEmpty: false,
        allMarketsMode: false,
        outcome: "no",
        filteredCount: 3,
        pageSize,
      })
    ).toBe(true);
  });

  it("returns false once filtered count reaches page size for outcome filter", () => {
    expect(
      shouldTradesTabAutoFetchMorePages({
        tradesWithLiveCount: 200,
        clientFilteredEmpty: false,
        allMarketsMode: false,
        outcome: "no",
        filteredCount: 50,
        pageSize,
      })
    ).toBe(false);
  });

  it("returns false in all-markets mode regardless of filtered count", () => {
    expect(
      shouldTradesTabAutoFetchMorePages({
        tradesWithLiveCount: 50,
        clientFilteredEmpty: false,
        allMarketsMode: true,
        outcome: "yes",
        filteredCount: 2,
        pageSize,
      })
    ).toBe(false);
  });

  it("returns false when outcome is all and some rows still match", () => {
    expect(
      shouldTradesTabAutoFetchMorePages({
        tradesWithLiveCount: 50,
        clientFilteredEmpty: false,
        allMarketsMode: false,
        outcome: "all",
        filteredCount: 5,
        pageSize,
      })
    ).toBe(false);
  });

  it("returns true when outcome is all but client filters hide every row", () => {
    expect(
      shouldTradesTabAutoFetchMorePages({
        tradesWithLiveCount: 50,
        clientFilteredEmpty: true,
        allMarketsMode: false,
        outcome: "all",
        filteredCount: 0,
        pageSize,
      })
    ).toBe(true);
  });
});

describe("isTradesTabBroadMarketCatalogQuery", () => {
  it("is true for default filters and no trader scope on the catalog", () => {
    expect(
      isTradesTabBroadMarketCatalogQuery({
        filters: DEFAULT_TRADES_TAB_FILTERS,
        traderCatalogScoped: false,
      })
    ).toBe(true);
  });

  it("is false when trader catalog is scoped to a resolved user", () => {
    expect(
      isTradesTabBroadMarketCatalogQuery({
        filters: DEFAULT_TRADES_TAB_FILTERS,
        traderCatalogScoped: true,
      })
    ).toBe(false);
  });

  it("is false when side is restricted", () => {
    expect(
      isTradesTabBroadMarketCatalogQuery({
        filters: { ...DEFAULT_TRADES_TAB_FILTERS, side: "BUY" },
        traderCatalogScoped: false,
      })
    ).toBe(false);
  });

  it("is false when value min is set", () => {
    expect(
      isTradesTabBroadMarketCatalogQuery({
        filters: { ...DEFAULT_TRADES_TAB_FILTERS, valueMin: 100 },
        traderCatalogScoped: false,
      })
    ).toBe(false);
  });

  it("is false when all-markets toolbar subset is non-empty", () => {
    expect(
      isTradesTabBroadMarketCatalogQuery({
        filters: {
          ...DEFAULT_TRADES_TAB_FILTERS,
          marketConditionIds: ["0xabc"],
        },
        traderCatalogScoped: false,
      })
    ).toBe(false);
  });

  it("is true when only outcome differs (client-only; REST is still broad)", () => {
    expect(
      isTradesTabBroadMarketCatalogQuery({
        filters: { ...DEFAULT_TRADES_TAB_FILTERS, outcome: "no" },
        traderCatalogScoped: false,
      })
    ).toBe(true);
  });
});

describe("canonicalizeConditionIdList", () => {
  it("dedupes, lowercases, and sorts", () => {
    const a =
      "0xDD22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110917";
    const b =
      "0xaa22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110918";
    expect(canonicalizeConditionIdList([b, a, a, b])).toEqual([
      b.toLowerCase(),
      a.toLowerCase(),
    ]);
  });
});

describe("getEffectiveMarketIdsForTradesQuery", () => {
  const cid =
    "0xdd22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110917";

  it("uses condition id in single-market mode", () => {
    expect(
      getEffectiveMarketIdsForTradesQuery({
        allMarketsMode: false,
        conditionId: cid,
        visibleMarketIds: ["0xother"],
        toolbarMarketConditionIds: [],
      })
    ).toEqual([cid.toLowerCase()]);
  });

  it("prefers toolbar subset in all-markets mode", () => {
    const t1 =
      "0x1111472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110911";
    const t2 =
      "0x2222472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110922";
    expect(
      getEffectiveMarketIdsForTradesQuery({
        allMarketsMode: true,
        conditionId: cid,
        visibleMarketIds: [cid, t1, t2],
        toolbarMarketConditionIds: [t2, t1],
      })
    ).toEqual([t1.toLowerCase(), t2.toLowerCase()]);
  });

  it("falls back to visible markets when toolbar empty", () => {
    const t1 =
      "0x1111472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110911";
    expect(
      getEffectiveMarketIdsForTradesQuery({
        allMarketsMode: true,
        conditionId: cid,
        visibleMarketIds: [t1, cid],
        toolbarMarketConditionIds: [],
      })
    ).toEqual([t1.toLowerCase(), cid.toLowerCase()]);
  });
});

describe("buildMarketLabelsLookup + getMarketLabelForTrade", () => {
  it("resolves labels case-insensitively", () => {
    const m = new Map([
      [
        "0xDD22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110917",
        "Newsom",
      ],
    ]);
    const lookup = buildMarketLabelsLookup(m);
    expect(
      getMarketLabelForTrade(
        lookup,
        "0xdd22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110917"
      )
    ).toBe("Newsom");
  });
});

describe("buildVisibleMarketSlugs", () => {
  it("returns slugs for matching condition ids", () => {
    const cid =
      "0xdd22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110917";
    const markets = [
      {
        condition_id: cid,
        slug: "market-a",
        tokens: [],
      },
    ] as unknown as Market[];
    expect(buildVisibleMarketSlugs(markets, [cid])).toEqual(["market-a"]);
  });
});

describe("compareTradesTabRecency", () => {
  it("orders newest timestamp first", () => {
    const a = baseTrade();
    const b = { ...baseTrade(), timestamp: a.timestamp + 1 };
    expect(compareTradesTabRecency(a, b)).toBeGreaterThan(0);
  });
});

describe("tradeMatchesTradesTabFilters", () => {
  const ctxBase = {
    allMarketsMode: true,
    market: null as Market | null,
    yesOutcomeLabel: "Yes",
    noOutcomeLabel: "No",
    yesRawOutcomeLabel: "Yes",
    noRawOutcomeLabel: "No",
    yesTokenId: "",
    noTokenId: "",
  };

  it("does not filter by searchQuery substring (trader search is server-resolve only)", () => {
    const t = baseTrade();
    expect(
      tradeMatchesTradesTabFilters(
        t,
        { ...DEFAULT_TRADES_TAB_FILTERS, searchQuery: "zzz" },
        ctxBase
      )
    ).toBe(true);
    expect(
      tradeMatchesTradesTabFilters(
        t,
        { ...DEFAULT_TRADES_TAB_FILTERS, searchQuery: "nope" },
        ctxBase
      )
    ).toBe(true);
  });

  it("filters by side", () => {
    const t = baseTrade();
    expect(
      tradeMatchesTradesTabFilters(
        t,
        { ...DEFAULT_TRADES_TAB_FILTERS, side: "SELL" },
        ctxBase
      )
    ).toBe(false);
  });

  it("filters by value min", () => {
    const t = { ...baseTrade(), price: "0.5", size: "10" }; // $5
    expect(
      tradeMatchesTradesTabFilters(
        t,
        { ...DEFAULT_TRADES_TAB_FILTERS, valueMin: 100 },
        ctxBase
      )
    ).toBe(false);
    expect(
      tradeMatchesTradesTabFilters(
        t,
        { ...DEFAULT_TRADES_TAB_FILTERS, valueMin: 1 },
        ctxBase
      )
    ).toBe(true);
  });

  it("skips market subset when flag set", () => {
    const t = baseTrade();
    const otherCid =
      "0xaa22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110918";
    const filters = {
      ...DEFAULT_TRADES_TAB_FILTERS,
      marketConditionIds: [otherCid.toLowerCase()],
    };
    expect(
      tradeMatchesTradesTabFilters(t, filters, {
        ...ctxBase,
        skipMarketSubsetFilter: false,
      })
    ).toBe(false);
    expect(
      tradeMatchesTradesTabFilters(t, filters, {
        ...ctxBase,
        skipMarketSubsetFilter: true,
      })
    ).toBe(true);
  });

  it("single-market yes filter matches by token id when button label is abbreviated", () => {
    const yesId =
      "714505794380929046433737850519777089891909061606128452899565813";
    const noId =
      "714505794380929046433737850519777089891909061606128452899565814";
    const t: TradesTabTradeRowModel = {
      ...baseTrade(),
      asset: yesId,
      outcome: "Yes",
    };
    expect(
      tradeMatchesTradesTabFilters(
        t,
        { ...DEFAULT_TRADES_TAB_FILTERS, outcome: "yes" },
        {
          allMarketsMode: false,
          market: null,
          yesOutcomeLabel: "BKN",
          noOutcomeLabel: "SAC",
          yesRawOutcomeLabel: "Nets",
          noRawOutcomeLabel: "Kings",
          yesTokenId: yesId,
          noTokenId: noId,
        }
      )
    ).toBe(true);
  });

  it("single-market yes filter matches raw tape label vs abbreviated button", () => {
    const yesId =
      "714505794380929046433737850519777089891909061606128452899565813";
    const noId =
      "714505794380929046433737850519777089891909061606128452899565814";
    const market = {
      tokens: [
        { token_id: yesId, outcome: "Nets" },
        { token_id: noId, outcome: "Kings" },
      ],
    } as unknown as Market;
    const t: TradesTabTradeRowModel = {
      ...baseTrade(),
      asset: yesId,
      outcome: "Yes",
    };
    expect(
      tradeMatchesTradesTabFilters(
        t,
        { ...DEFAULT_TRADES_TAB_FILTERS, outcome: "yes" },
        {
          allMarketsMode: false,
          market,
          yesOutcomeLabel: "BKN",
          noOutcomeLabel: "SAC",
          yesRawOutcomeLabel: "Nets",
          noRawOutcomeLabel: "Kings",
          yesTokenId: yesId,
          noTokenId: noId,
        }
      )
    ).toBe(true);
  });

  it("single-market yes filter rejects no-side asset", () => {
    const yesId =
      "714505794380929046433737850519777089891909061606128452899565813";
    const noId =
      "714505794380929046433737850519777089891909061606128452899565814";
    const t: TradesTabTradeRowModel = {
      ...baseTrade(),
      asset: noId,
      outcome: "No",
    };
    expect(
      tradeMatchesTradesTabFilters(
        t,
        { ...DEFAULT_TRADES_TAB_FILTERS, outcome: "yes" },
        {
          allMarketsMode: false,
          market: null,
          yesOutcomeLabel: "BKN",
          noOutcomeLabel: "SAC",
          yesRawOutcomeLabel: "Nets",
          noRawOutcomeLabel: "Kings",
          yesTokenId: yesId,
          noTokenId: noId,
        }
      )
    ).toBe(false);
  });
});
