export interface SubgraphConsumerMapItem {
  domain:
    | "positions"
    | "trades"
    | "activity"
    | "openInterest"
    | "tradeCounts"
    | "value";
  freshness: "realtime" | "near-realtime" | "historical";
  primaryConsumers: string[];
  procedures: string[];
}

/**
 * Frontend source-of-truth map for staged subgraph migration.
 * Keeping this in code makes rollout reviews and QA checklists deterministic.
 */
export const SUBGRAPH_CONSUMER_MAP: SubgraphConsumerMapItem[] = [
  {
    domain: "positions",
    procedures: ["portfolio.positions", "portfolio.ctfTokenBalances"],
    primaryConsumers: [
      "app/portfolio/use-portfolio-data",
      "components/market/tabs/positions-tab",
      "components/portfolio/position-table",
    ],
    freshness: "realtime",
  },
  {
    domain: "trades",
    procedures: ["activity.trades"],
    primaryConsumers: [
      "components/market/tabs/trades-tab",
      "components/charts/use-trade-markers",
    ],
    freshness: "near-realtime",
  },
  {
    domain: "activity",
    procedures: ["activity.activity", "activity.activityWithMarkets"],
    primaryConsumers: [
      "components/market/tabs/history-tab",
      "components/portfolio/activity-history",
    ],
    freshness: "near-realtime",
  },
  {
    domain: "openInterest",
    procedures: ["activity.openInterest"],
    primaryConsumers: ["components/market/market-header-trading"],
    freshness: "near-realtime",
  },
  {
    domain: "tradeCounts",
    procedures: ["activity.tradeCountsByMarket"],
    primaryConsumers: ["components/explore/events-discovery"],
    freshness: "historical",
  },
  {
    domain: "value",
    procedures: ["portfolio.value"],
    primaryConsumers: [
      "components/layout/header-wallet-balance",
      "app/portfolio/use-portfolio-data",
    ],
    freshness: "near-realtime",
  },
];
