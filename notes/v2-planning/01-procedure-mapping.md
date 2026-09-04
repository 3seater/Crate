# V2 tRPC Procedure Mapping

> Complete old→new mapping for the Doji V2 migration.
> Generated 2026-05-02. Source: `apps/server/src/features/{trading,data,portfolio}/router.ts` + web call site grep.

## 1. Naming Conventions

- **Queries**: noun/noun phrase, drop `get` prefix (`getOrderBook` → `orderbook`)
- **Mutations**: verb (`cancelOrder` → `cancel`, `postOrder` → `place`)
- **No infrastructure names**: `clob`, `data` never appear in V2 router names
- **Router split**: `clob` → `markets` (public reads) + `orders` (trading) + `rewards` (NEW); `data` → `portfolio` + `activity` + `leaderboard`; `wallets` → `tracker`

---

## 2. Complete Mapping Tables

### 2a. `clob` → `markets.*` (public market-read queries)

| # | Current (V1) | New (V2) | Type | Access | Call Sites | Notes |
|---|---|---|---|---|---|---|
| 1 | `clob.getOrderBook` | `markets.orderbook` | query | public | ~18 (decl+server) | Highest-traffic procedure |
| 2 | `clob.getClobMarketInfo` | `markets.info` | query | public | 0 direct (used via `getFeeRate`) | Internal to fee calc; keep for V2 fee schedule |
| 3 | `clob.getLiquidityMetrics` | `markets.liquidityMetrics` | query | public | 1 (error allowlist) | Low usage |
| 4 | `clob.getOrderBooks` | `markets.orderbooks` | query | public | 0 | Batch variant; unused — **candidate to drop** |
| 5 | `clob.getMidpoint` | `markets.midpoint` | query | public | 3 | Trading layout + market page |
| 6 | `clob.getPrice` | `markets.price` | query | public | 0 | Unused — **candidate to drop** |
| 7 | `clob.getSpread` | `markets.spread` | query | public | 0 | Unused — **candidate to drop** |
| 8 | `clob.getLastTradePrice` | `markets.lastTradePrice` | query | public | 0 | Unused — **candidate to drop** (batch variant used) |
| 9 | `clob.calculateMarketPrice` | `markets.marketPrice` | query | public | 1 | Order form |
| 10 | `clob.getMarket` | `markets.clobMarket` | query | public | 0 | Unused — **candidate to drop** |
| 11 | `clob.getMarkets` | `markets.clobMarkets` | query | public | 0 | Unused — **candidate to drop** |
| 12 | `clob.getSimplifiedMarket` | `markets.simplified` | query | public | 0 | Unused — **candidate to drop** |
| 13 | `clob.getSimplifiedMarkets` | `markets.simplifiedBatch` | query | public | 0 | Unused — **candidate to drop** |
| 14 | `clob.getMidpoints` | `markets.midpoints` | query | public | 0 | Batch variant; unused — **candidate to drop** |
| 15 | `clob.getPrices` | `markets.prices` | query | public | 0 | Batch variant; unused — **candidate to drop** |
| 16 | `clob.getSpreads` | `markets.spreads` | query | public | 0 | Batch variant; unused — **candidate to drop** |
| 17 | `clob.getLastTradePrices` | `markets.lastTradePrices` | query | public | 2 (1 decl + 1 server) | Market trading context + server prefetch |
| 18 | `clob.getSamplingMarkets` | — | query | public | 0 | Unused — **DROP** |
| 19 | `clob.getSamplingSimplifiedMarkets` | — | query | public | 0 | Unused — **DROP** |
| 20 | `clob.getPricesHistory` | `markets.priceHistory` | query | public | ~10 | Charts, sparklines, prefetch |
| 21 | `clob.getPricesHistoryBatch` | `markets.priceHistoryBatch` | query | public | 0 | Unused — **candidate to drop** |
| 22 | `clob.getTradeVolume` | `markets.tradeVolume` | query | public | 0 | Unused — **candidate to drop** |
| 23 | `clob.getTickSize` | `markets.tickSize` | query | public | 3 | Order form + quick sell |
| 24 | `clob.getTraded` | `markets.traded` | query | public | 0 | Unused — **candidate to drop** |
| 25 | `clob.getNegRisk` | `markets.negRisk` | query | public | 0 | Unused — **candidate to drop** |
| 26 | `clob.getMarketTradesEvents` | `markets.tradeEvents` | query | public | 0 | Unused — **candidate to drop** |
| 27 | `clob.getFeeRate` | `markets.feeRate` | query | public | 2 | Order form + market page |
| 28 | `clob.getUmaProposeUrl` | `markets.umaProposeUrl` | query | public | 0 | Unused — **candidate to drop** |

### 2b. `clob` → `orders.*` (infrastructure / health)

| # | Current (V1) | New (V2) | Type | Access | Call Sites | Notes |
|---|---|---|---|---|---|---|
| 29 | `clob.getServerTime` | — | query | public | 0 | Unused — **DROP** |
| 30 | `clob.getGeoRestriction` | — | query | public | 0 | Unused — **DROP** (geo handled at middleware) |
| 31 | `clob.getHeartbeat` | — | query | public | 0 | Unused — **DROP** (health check only) |
| 32 | `clob.getClobHealth` | — | query | public | 0 | Unused — **DROP** (use Hono `/api/health`) |
| 33 | `clob.getClobVersion` | — | query | public | 0 | Unused — **DROP** (V2 is the only version) |

### 2c. `clob` → `rewards.*` (NEW router)

| # | Current (V1) | New (V2) | Type | Access | Call Sites | Notes |
|---|---|---|---|---|---|---|
| 34 | `clob.getLiquidityRewards` | `rewards.liquidity` | query | public | 1 | Market header |
| 35 | `clob.isOrderScoring` | `rewards.isScoring` | query | protected | 0 | Unused — **candidate to drop** |
| 36 | `clob.areOrdersScoring` | `rewards.areScoringBatch` | query | protected | 0 | Unused — **candidate to drop** |

### 2d. `clob` → `orders.*` (protected queries — trading)

| # | Current (V1) | New (V2) | Type | Access | Call Sites | Notes |
|---|---|---|---|---|---|---|
| 37 | `clob.getOpenOrders` | `orders.open` | query | protected | 1 (imperative) | WebSocket reconciliation |
| 38 | `clob.getOrder` | `orders.byId` | query | protected | 0 | Unused — **candidate to drop** |
| 39 | `clob.getOpenOrdersWithMarkets` | `orders.openWithMarkets` | query | protected | 6 | Portfolio, widgets, prefetch |
| 40 | `clob.getTrades` | `orders.trades` | query | protected | 0 | Unused (data.trades used instead) — **candidate to drop** |
| 41 | `clob.getTradesPaginated` | `orders.tradesPaginated` | query | protected | 0 | Unused — **candidate to drop** |
| 42 | `clob.getBalanceAllowance` | `orders.balanceAllowance` | query | protected | ~12 | Order form, portfolio, bridge, wallet balance |
| 43 | `clob.getNotifications` | `orders.notifications` | query | protected | 1 | Notifications bell |
| 44 | `clob.getBuilderOperations` | `orders.builderOperations` | query | protected | 0 | Unused — **candidate to drop** |
| 45 | `clob.getBuilderTrades` | `orders.builderTrades` | query | protected | 0 | Unused — **candidate to drop** |
| 46 | `clob.getApiKeys` | `orders.apiKeys` | query | protected | 0 | Unused — **candidate to drop** |

### 2e. `clob` → `orders.*` (protected mutations — trading)

| # | Current (V1) | New (V2) | Type | Access | Call Sites | Notes |
|---|---|---|---|---|---|---|
| 47 | `clob.updateBalanceAllowance` | `orders.refreshBalance` | mutation | protected | ~7 | Bridge, approvals, split/merge, deploy |
| 48 | `clob.createAndPostOrder` | — | mutation | protected | 0 | Stub (METHOD_NOT_SUPPORTED) — **DROP** |
| 49 | `clob.postOrder` | `orders.place` | mutation | protected | 3 | Order form, quick sell, instant trade |
| 50 | `clob.cancelOrder` | `orders.cancel` | mutation | protected | 5 | Open orders, orderbook, portfolio, tabs |
| 51 | `clob.cancelAll` | `orders.cancelAll` | mutation | protected | 1 | Open orders |
| 52 | `clob.cancelMarketOrders` | `orders.cancelByMarket` | mutation | protected | 1 | Open orders |
| 53 | `clob.createAndPostOrders` | `orders.placeBatch` | mutation | protected | 0 | Unused — **candidate to drop** |
| 54 | `clob.cancelOrders` | `orders.cancelBatch` | mutation | protected | 1 | Orderbook multi-cancel |
| 55 | `clob.dropNotifications` | `orders.dismissNotifications` | mutation | protected | 1 | Notifications bell |
| 56 | `clob.postBuilderOperation` | `orders.builderOperation` | mutation | protected | 0 | Unused — **candidate to drop** |
| 57 | `clob.revokeBuilderApiKey` | — | mutation | protected | 0 | Unused — **DROP** |
| 58 | `clob.deleteApiKey` | — | mutation | protected | 0 | Unused — **DROP** |
| 59 | `clob.postHeartbeat` | `orders.heartbeat` | mutation | protected | 1 | Heartbeat hook |

### 2f. `data` → `portfolio.*` (positions, value, balances)

| # | Current (V1) | New (V2) | Type | Access | Call Sites | Notes |
|---|---|---|---|---|---|---|
| 60 | `data.positions` | `portfolio.positions` | query | public | ~14 | Highest-traffic data procedure |
| 61 | `data.closedPositions` | `portfolio.closedPositions` | query | public | 4 | Portfolio, profile |
| 62 | `data.value` | `portfolio.value` | query | public | 6 | Portfolio, profile, widgets |
| 63 | `data.usdcBalance` | `portfolio.usdcBalance` | query | public | 4 | Portfolio, leaderboard profile, safe balance |
| 64 | `data.ctfTokenBalances` | `portfolio.ctfTokenBalances` | query | public | 6 | Position table, trading layout, split/merge |
| 65 | `data.pnlTimeseries` | `portfolio.pnlTimeseries` | query | public | 3 | Portfolio cards, leaderboard profile, PnL calendar |
| 66 | `data.snapshot` | `portfolio.snapshot` | query | public | 1 | Download snapshot |

### 2g. `data` → `activity.*` (trades, activity feed, volume)

| # | Current (V1) | New (V2) | Type | Access | Call Sites | Notes |
|---|---|---|---|---|---|---|
| 67 | `data.trades` | `activity.trades` | query | public | 5 | Trades tab, profile, leaderboard, global feed |
| 68 | `data.tradesWithMarkets` | — | query | public | 0 | Unused — **DROP** (activityWithMarkets used instead) |
| 69 | `data.activityWithMarkets` | `activity.feed` | query | public | 6 | Activity history, market tabs, portfolio |
| 70 | `data.activity` | `activity.raw` | query | public | 3 | PnL calendar, invalidation |
| 71 | `data.tradeCountsByMarket` | `activity.tradeCounts` | query | public | 1 (subgraph map) | Low usage |
| 72 | `data.liveVolume` | `activity.liveVolume` | query | public | 1 (server) | Server prefetch |
| 73 | `data.openInterest` | `activity.openInterest` | query | public | 3 (1 server + 2 decl) | Market header, selector, server prefetch |
| 74 | `data.traded` | `activity.traded` | query | public | 1 | Leaderboard profile |

### 2h. `data` → `leaderboard.*` (rankings)

| # | Current (V1) | New (V2) | Type | Access | Call Sites | Notes |
|---|---|---|---|---|---|---|
| 75 | `data.leaderboard` | `leaderboard.rankings` | query | public | 5 (1 server + 4 decl) | Leaderboard page, profile, portfolio |
| 76 | `data.leaderboardByRoi` | `leaderboard.rankingsByRoi` | query | public | 1 | Leaderboard page |
| 77 | `data.holders` | `leaderboard.holders` | query | public | 1 | Holders tab |

### 2i. `data` → misc (infrastructure / rewards)

| # | Current (V1) | New (V2) | Type | Access | Call Sites | Notes |
|---|---|---|---|---|---|---|
| 78 | `data.subgraphStrategy` | — | query | public | 0 | Unused — **DROP** |
| 79 | `data.health` | — | query | public | 0 | Unused — **DROP** (use Hono `/api/health`) |
| 80 | `data.lpRewardsTotal` | `rewards.lpTotal` | query | public | 1 | Leaderboard profile |
| 81 | `data.getEventOutcomeCount` | `portfolio.eventOutcomeCount` | query | public | 1 | Redeem logic |

### 2j. `wallets` → `tracker.*`

| # | Current (V1) | New (V2) | Type | Access | Call Sites | Notes |
|---|---|---|---|---|---|---|
| 82 | `wallets.add` | `tracker.add` | mutation | protected | 1 | Add wallet modal |
| 83 | `wallets.list` | `tracker.list` | query | protected | 6 | Tracker content, prefetch, page |
| 84 | `wallets.update` | `tracker.update` | mutation | protected | 0 | Unused in web — keep (CRUD completeness) |
| 85 | `wallets.remove` | `tracker.remove` | mutation | protected | 0 | Unused in web — keep (CRUD completeness) |
| 86 | `wallets.activity` | `tracker.activity` | query | protected | 3 | Tracker content, prefetch |
| 87 | `wallets.values` | `tracker.values` | query | protected | 3 | Tracker content, prefetch, page |

---

## 3. Procedures to Drop (0 call sites, no V2 value)

### Definite drops (unused + no future need)

| V1 Procedure | Reason |
|---|---|
| `clob.getServerTime` | Unused; CLOB client uses `useServerTime` internally |
| `clob.getGeoRestriction` | Unused; geo handled at middleware/route handler level |
| `clob.getHeartbeat` | Unused public health check; `getClobHealth` also unused |
| `clob.getClobHealth` | Unused; Hono `/api/health` covers this |
| `clob.getClobVersion` | Unused; V2 is the only version post-migration |
| `clob.createAndPostOrder` | Stub that throws METHOD_NOT_SUPPORTED |
| `clob.revokeBuilderApiKey` | Unused; admin-only, can use CLOB API directly |
| `clob.deleteApiKey` | Unused; admin-only |
| `clob.getSamplingMarkets` | Unused |
| `clob.getSamplingSimplifiedMarkets` | Unused |
| `data.subgraphStrategy` | Unused; internal migration helper |
| `data.health` | Unused; use Hono health endpoint |
| `data.tradesWithMarkets` | Unused; `activityWithMarkets` supersedes it |

### Strong candidates to drop (0 call sites, redundant)

| V1 Procedure | Reason |
|---|---|
| `clob.getOrderBooks` | Batch variant; unused (individual `getOrderBook` used) |
| `clob.getPrice` | Unused; `getMidpoint` or orderbook used instead |
| `clob.getSpread` | Unused |
| `clob.getLastTradePrice` | Unused; batch `getLastTradePrices` used instead |
| `clob.getMarket` | Unused; Gamma `markets.getBySlug` used instead |
| `clob.getMarkets` | Unused; Gamma `markets.*` used instead |
| `clob.getSimplifiedMarket` | Unused |
| `clob.getSimplifiedMarkets` | Unused |
| `clob.getMidpoints` | Batch variant; unused |
| `clob.getPrices` | Batch variant; unused |
| `clob.getSpreads` | Batch variant; unused |
| `clob.getPricesHistoryBatch` | Batch variant; unused |
| `clob.getTradeVolume` | Unused |
| `clob.getTraded` | Unused (data.traded used instead) |
| `clob.getNegRisk` | Unused |
| `clob.getMarketTradesEvents` | Unused |
| `clob.getUmaProposeUrl` | Unused |
| `clob.getOrder` | Unused |
| `clob.getTrades` | Unused (data.trades used instead) |
| `clob.getTradesPaginated` | Unused |
| `clob.getBuilderOperations` | Unused |
| `clob.getBuilderTrades` | Unused |
| `clob.getApiKeys` | Unused |
| `clob.isOrderScoring` | Unused |
| `clob.areOrdersScoring` | Unused |
| `clob.createAndPostOrders` | Unused (batch server-side create) |
| `clob.postBuilderOperation` | Unused |

**Total droppable: 40 of 87 procedures (46%)**

---

## 4. New Procedures (V2 adds, no V1 equivalent)

| Router | Procedure | Type | Access | Purpose |
|---|---|---|---|---|
| `rewards` | `rewards.liquidity` | query | public | Moved from clob; now its own router |
| `rewards` | `rewards.lpTotal` | query | public | Moved from data; LP rewards total |
| `rewards` | `rewards.isScoring` | query | protected | Moved from clob (keep if needed) |
| `rewards` | `rewards.areScoringBatch` | query | protected | Moved from clob (keep if needed) |

> No net-new procedures in V2 — this is a reorganization. New features (e.g. V2 order types) will be added to `orders.*` as separate work.

---

## 5. Server-Side Call Sites (`query-client.ts`)

All 8 `serverTrpc.*` calls in `apps/web/src/shared/lib/trpc/query-client.ts`:

| # | Current (V1) | New (V2) | Line |
|---|---|---|---|
| 1 | `serverTrpc.events.list.query(...)` | `serverTrpc.events.list.query(...)` | 135 | No change (events router unchanged) |
| 2 | `serverTrpc.markets.getBySlug.query(...)` | `serverTrpc.markets.getBySlug.query(...)` | 169 | No change (Gamma markets router unchanged) |
| 3 | `serverTrpc.events.getBySlug.query(...)` | `serverTrpc.events.getBySlug.query(...)` | 206 | No change (events router unchanged) |
| 4 | `serverTrpc.data.leaderboard.query(...)` | `serverTrpc.leaderboard.rankings.query(...)` | 223 | **CHANGED** |
| 5 | `serverTrpc.data.openInterest.query(...)` | `serverTrpc.activity.openInterest.query(...)` | 238 | **CHANGED** |
| 6 | `serverTrpc.data.liveVolume.query(...)` | `serverTrpc.activity.liveVolume.query(...)` | 251 | **CHANGED** |
| 7 | `serverTrpc.clob.getOrderBook.query(...)` | `serverTrpc.markets.orderbook.query(...)` | 263 | **CHANGED** |
| 8 | `serverTrpc.clob.getLastTradePrices.query(...)` | `serverTrpc.markets.lastTradePrices.query(...)` | 274 | **CHANGED** |

---

## 6. Call Site Update Script

### Phase 1: `clob.*` → `markets.*` (public reads)

```bash
cd apps/web/src

# High-traffic renames
sed -i 's/trpc\.clob\.getOrderBook/trpc.markets.orderbook/g' $(grep -rl 'trpc\.clob\.getOrderBook' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.clob\.getOrderBook/trpcClient.markets.orderbook/g' $(grep -rl 'trpcClient\.clob\.getOrderBook' --include='*.ts' --include='*.tsx')
sed -i 's/serverTrpc\.clob\.getOrderBook/serverTrpc.markets.orderbook/g' $(grep -rl 'serverTrpc\.clob\.getOrderBook' --include='*.ts' --include='*.tsx')

sed -i 's/trpc\.clob\.getPricesHistory/trpc.markets.priceHistory/g' $(grep -rl 'trpc\.clob\.getPricesHistory' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.clob\.getPricesHistory/trpcClient.markets.priceHistory/g' $(grep -rl 'trpcClient\.clob\.getPricesHistory' --include='*.ts' --include='*.tsx')

sed -i 's/trpc\.clob\.getTickSize/trpc.markets.tickSize/g' $(grep -rl 'trpc\.clob\.getTickSize' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.clob\.getFeeRate/trpc.markets.feeRate/g' $(grep -rl 'trpc\.clob\.getFeeRate' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.clob\.getMidpoint/trpc.markets.midpoint/g' $(grep -rl 'trpc\.clob\.getMidpoint' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.clob\.calculateMarketPrice/trpc.markets.marketPrice/g' $(grep -rl 'trpc\.clob\.calculateMarketPrice' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.clob\.getLastTradePrices/trpc.markets.lastTradePrices/g' $(grep -rl 'trpc\.clob\.getLastTradePrices' --include='*.ts' --include='*.tsx')
sed -i 's/serverTrpc\.clob\.getLastTradePrices/serverTrpc.markets.lastTradePrices/g' $(grep -rl 'serverTrpc\.clob\.getLastTradePrices' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.clob\.getLiquidityRewards/trpc.rewards.liquidity/g' $(grep -rl 'trpc\.clob\.getLiquidityRewards' --include='*.ts' --include='*.tsx')
```

### Phase 2: `clob.*` → `orders.*` (protected trading)

```bash
# Queries
sed -i 's/trpc\.clob\.getOpenOrdersWithMarkets/trpc.orders.openWithMarkets/g' $(grep -rl 'trpc\.clob\.getOpenOrdersWithMarkets' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.clob\.getBalanceAllowance/trpc.orders.balanceAllowance/g' $(grep -rl 'trpc\.clob\.getBalanceAllowance' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.clob\.getNotifications/trpc.orders.notifications/g' $(grep -rl 'trpc\.clob\.getNotifications' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.clob\.getOpenOrders/trpcClient.orders.open/g' $(grep -rl 'trpcClient\.clob\.getOpenOrders' --include='*.ts' --include='*.tsx')

# Mutations
sed -i 's/trpcClient\.clob\.postOrder/trpcClient.orders.place/g' $(grep -rl 'trpcClient\.clob\.postOrder' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.clob\.cancelOrder/trpcClient.orders.cancel/g' $(grep -rl 'trpcClient\.clob\.cancelOrder' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.clob\.cancelAll/trpcClient.orders.cancelAll/g' $(grep -rl 'trpcClient\.clob\.cancelAll' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.clob\.cancelMarketOrders/trpcClient.orders.cancelByMarket/g' $(grep -rl 'trpcClient\.clob\.cancelMarketOrders' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.clob\.cancelOrders/trpcClient.orders.cancelBatch/g' $(grep -rl 'trpcClient\.clob\.cancelOrders' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.clob\.updateBalanceAllowance/trpcClient.orders.refreshBalance/g' $(grep -rl 'trpcClient\.clob\.updateBalanceAllowance' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.clob\.dropNotifications/trpcClient.orders.dismissNotifications/g' $(grep -rl 'trpcClient\.clob\.dropNotifications' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.clob\.postHeartbeat/trpcClient.orders.heartbeat/g' $(grep -rl 'trpcClient\.clob\.postHeartbeat' --include='*.ts' --include='*.tsx')
```

### Phase 3: `data.*` → `portfolio.*` / `activity.*` / `leaderboard.*`

```bash
# portfolio
sed -i 's/trpc\.data\.positions/trpc.portfolio.positions/g' $(grep -rl 'trpc\.data\.positions' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.data\.positions/trpcClient.portfolio.positions/g' $(grep -rl 'trpcClient\.data\.positions' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.data\.closedPositions/trpc.portfolio.closedPositions/g' $(grep -rl 'trpc\.data\.closedPositions' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.data\.closedPositions/trpcClient.portfolio.closedPositions/g' $(grep -rl 'trpcClient\.data\.closedPositions' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.data\.value/trpc.portfolio.value/g' $(grep -rl 'trpc\.data\.value' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.data\.usdcBalance/trpc.portfolio.usdcBalance/g' $(grep -rl 'trpc\.data\.usdcBalance' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.data\.ctfTokenBalances/trpc.portfolio.ctfTokenBalances/g' $(grep -rl 'trpc\.data\.ctfTokenBalances' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.data\.pnlTimeseries/trpc.portfolio.pnlTimeseries/g' $(grep -rl 'trpc\.data\.pnlTimeseries' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.data\.snapshot/trpcClient.portfolio.snapshot/g' $(grep -rl 'trpcClient\.data\.snapshot' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.data\.getEventOutcomeCount/trpcClient.portfolio.eventOutcomeCount/g' $(grep -rl 'trpcClient\.data\.getEventOutcomeCount' --include='*.ts' --include='*.tsx')

# activity
sed -i 's/trpc\.data\.trades/trpc.activity.trades/g' $(grep -rl 'trpc\.data\.trades' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.data\.trades/trpcClient.activity.trades/g' $(grep -rl 'trpcClient\.data\.trades' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.data\.activityWithMarkets/trpc.activity.feed/g' $(grep -rl 'trpc\.data\.activityWithMarkets' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.data\.activityWithMarkets/trpcClient.activity.feed/g' $(grep -rl 'trpcClient\.data\.activityWithMarkets' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.data\.activity/trpc.activity.raw/g' $(grep -rl 'trpc\.data\.activity' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.data\.openInterest/trpc.activity.openInterest/g' $(grep -rl 'trpc\.data\.openInterest' --include='*.ts' --include='*.tsx')
sed -i 's/serverTrpc\.data\.openInterest/serverTrpc.activity.openInterest/g' $(grep -rl 'serverTrpc\.data\.openInterest' --include='*.ts' --include='*.tsx')
sed -i 's/serverTrpc\.data\.liveVolume/serverTrpc.activity.liveVolume/g' $(grep -rl 'serverTrpc\.data\.liveVolume' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.data\.traded/trpc.activity.traded/g' $(grep -rl 'trpc\.data\.traded' --include='*.ts' --include='*.tsx')

# leaderboard
sed -i 's/trpc\.data\.leaderboard\b/trpc.leaderboard.rankings/g' $(grep -rl 'trpc\.data\.leaderboard' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.data\.leaderboard\b/trpcClient.leaderboard.rankings/g' $(grep -rl 'trpcClient\.data\.leaderboard' --include='*.ts' --include='*.tsx')
sed -i 's/serverTrpc\.data\.leaderboard\b/serverTrpc.leaderboard.rankings/g' $(grep -rl 'serverTrpc\.data\.leaderboard' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.data\.leaderboardByRoi/trpcClient.leaderboard.rankingsByRoi/g' $(grep -rl 'trpcClient\.data\.leaderboardByRoi' --include='*.ts' --include='*.tsx')
sed -i 's/trpc\.data\.holders/trpc.leaderboard.holders/g' $(grep -rl 'trpc\.data\.holders' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.data\.holders/trpcClient.leaderboard.holders/g' $(grep -rl 'trpcClient\.data\.holders' --include='*.ts' --include='*.tsx')

# rewards (from data)
sed -i 's/trpc\.data\.lpRewardsTotal/trpc.rewards.lpTotal/g' $(grep -rl 'trpc\.data\.lpRewardsTotal' --include='*.ts' --include='*.tsx')
```

### Phase 4: `wallets.*` → `tracker.*`

```bash
sed -i 's/trpc\.wallets\./trpc.tracker./g' $(grep -rl 'trpc\.wallets\.' --include='*.ts' --include='*.tsx')
sed -i 's/trpcClient\.wallets\./trpcClient.tracker./g' $(grep -rl 'trpcClient\.wallets\.' --include='*.ts' --include='*.tsx')
```

### Phase 5: Cleanup — error allowlist and subgraph map

```bash
# Update error allowlist in shared/lib/trpc/errors.ts
sed -i 's/"clob\.getLiquidityMetrics"/"markets.liquidityMetrics"/g' $(grep -rl 'clob\.getLiquidityMetrics' --include='*.ts' --include='*.tsx')

# Update subgraph consumer map
sed -i 's/"data\.tradeCountsByMarket"/"activity.tradeCounts"/g' $(grep -rl 'data\.tradeCountsByMarket' --include='*.ts' --include='*.tsx')
```

---

## 7. Verification Checklist

After applying the mapping:

### 7a. Zero residual references

```bash
# Must return 0 matches each:
grep -r 'trpc\.clob\.' apps/web/src --include='*.ts' --include='*.tsx' | wc -l
grep -r 'trpcClient\.clob\.' apps/web/src --include='*.ts' --include='*.tsx' | wc -l
grep -r 'serverTrpc\.clob\.' apps/web/src --include='*.ts' --include='*.tsx' | wc -l
grep -r 'trpc\.data\.' apps/web/src --include='*.ts' --include='*.tsx' | wc -l
grep -r 'trpcClient\.data\.' apps/web/src --include='*.ts' --include='*.tsx' | wc -l
grep -r 'serverTrpc\.data\.' apps/web/src --include='*.ts' --include='*.tsx' | wc -l
grep -r 'trpc\.wallets\.' apps/web/src --include='*.ts' --include='*.tsx' | wc -l
grep -r 'trpcClient\.wallets\.' apps/web/src --include='*.ts' --include='*.tsx' | wc -l
```

### 7b. TypeScript compiles

```bash
pnpm check-types
```

### 7c. Server router wiring

Verify `apps/server/src/routers/index.ts` registers:
- `markets` (was `clob` public reads + Gamma markets — merge or namespace)
- `orders` (was `clob` protected)
- `rewards` (NEW)
- `portfolio` (was `data` positions/value/balances)
- `activity` (was `data` trades/activity/volume)
- `leaderboard` (was `data` leaderboard/holders)
- `tracker` (was `wallets`)
- `events` (unchanged)
- `auth` (unchanged)
- `referrals` (unchanged)
- `watchlist` (unchanged)
- `bridge` (unchanged)

### 7d. Procedure count audit

| Router | V1 Count | V2 Count (kept) | Dropped |
|---|---|---|---|
| `clob` | 59 | 0 (split) | — |
| → `markets` | — | 12 | 16 dropped |
| → `orders` | — | 14 | 17 dropped |
| → `rewards` | — | 1–3 | 2 candidates |
| `data` | 22 | 0 (split) | — |
| → `portfolio` | — | 7 | 0 |
| → `activity` | — | 7 | 1 dropped |
| → `leaderboard` | — | 3 | 0 |
| → `rewards` (from data) | — | 1 | 1 dropped |
| `wallets` | 6 | 0 (renamed) | — |
| → `tracker` | — | 6 | 0 |
| **Total** | **87** | **~47** | **~40** |

### 7e. Smoke test routes

After wiring, verify these pages load without tRPC errors:

1. `/explore` — uses `events.*`, `markets.*`
2. `/market/[slug]` — uses `markets.orderbook`, `markets.priceHistory`, `markets.tickSize`, `markets.feeRate`, `markets.midpoint`, `activity.openInterest`
3. `/portfolio` — uses `portfolio.positions`, `portfolio.value`, `portfolio.usdcBalance`, `orders.openWithMarkets`, `orders.balanceAllowance`
4. `/leaderboard` — uses `leaderboard.rankings`, `leaderboard.rankingsByRoi`
5. `/wallet-tracker` — uses `tracker.list`, `tracker.values`
6. Notifications bell — uses `orders.notifications`
7. Order placement — uses `orders.place`, `orders.cancel`

### 7f. Invalidation paths

Verify `apps/web/src/shared/lib/trpc/index.ts` invalidation helpers reference new query keys:
- `trpc.orders.balanceAllowance.queryKey()` (was `trpc.clob.getBalanceAllowance.queryKey()`)
- `trpc.orders.openWithMarkets.queryKey()` (was `trpc.clob.getOpenOrdersWithMarkets.queryKey()`)
- `trpc.portfolio.positions.queryKey()` (was `trpc.data.positions.queryKey()`)
- `trpc.portfolio.ctfTokenBalances.queryKey()` (was `trpc.data.ctfTokenBalances.queryKey()`)
- `trpc.portfolio.value.queryKey()` (was `trpc.data.value.queryKey()`)
- `trpc.activity.raw.queryKey()` (was `trpc.data.activity.queryKey()`)
- `trpc.activity.feed.queryKey()` (was `trpc.data.activityWithMarkets.queryKey()`)

---

## 8. V2 Router Summary

```
appRouter
├── auth          (unchanged)
├── markets       (NEW — CLOB public reads: orderbook, prices, tick size, fee rate, etc.)
├── orders        (NEW — protected trading: place, cancel, balance, notifications)
├── rewards       (NEW — liquidity rewards, LP total, scoring)
├── portfolio     (NEW — positions, value, balances, PnL, snapshot)
├── activity      (NEW — trades, activity feed, volume, open interest)
├── leaderboard   (NEW — rankings, ROI, holders)
├── tracker       (renamed from wallets)
├── events        (unchanged)
├── referrals     (unchanged)
├── watchlist     (unchanged)
└── bridge        (unchanged)
```

> **Note on `markets` namespace collision**: The existing Gamma `markets` router (from `features/markets/router.ts`) handles `getBySlug`, `search`, etc. The new CLOB `markets` procedures (orderbook, prices, tick size) must either:
> (a) merge into the existing `markets` router, or
> (b) use a different name like `orderbook` or `clobMarkets`.
> Recommendation: **merge** — one `markets` router with both Gamma and CLOB reads. The consumer doesn't care about the data source.
