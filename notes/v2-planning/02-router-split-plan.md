# Router Split Plan

> Phase 2 of the V2 migration: split the three oversized routers into focused, single-responsibility modules.

## Current State

| File | Lines | Size | Procedures | Severity |
|------|-------|------|------------|----------|
| `features/trading/router.ts` | 2,571 | 92KB | 55 | 🔴 Critical |
| `features/auth/router.ts` | 1,246 | 41KB | 10 | 🟡 Moderate |
| `features/data/router.ts` | 1,067 | 37KB | 22 | 🟡 Moderate |

## Wiring Context

Current `routers/index.ts` maps:

```ts
clob: clobRouter,        // features/trading/router.ts
data: dataRouter,        // features/data/router.ts
auth: authRouter,        // features/auth/router.ts
markets: marketsRouter,  // features/markets/router.ts (7 procedures)
```

Client calls use `trpc.clob.*`, `trpc.data.*`, `trpc.auth.*`, `trpc.markets.*`. Splitting must preserve these namespaces or provide a migration path.

---

## 1. trading/router.ts Split Plan

### Target Structure

```
features/trading/
  router.ts              — re-exports merged sub-routers (thin orchestrator)
  lib/
    clob-read.ts         — (existing) public CLOB read helpers
    clob-write.ts        — (NEW) order placement, cancellation logic
    error-mapping.ts     — (NEW) CLOB_ERROR_MAP, classifyClobError, handleClobProcedureError
    enrichment.ts        — (NEW) getOpenOrdersWithMarkets helpers
    notifications.ts     — (NEW) notification normalization, dedup, reward merge
    schemas.ts           — (NEW) Zod schemas (signedOrderInput, createOrderInput, etc.)
    price-history.ts     — (NEW) resolvePriceHistoryRequest, parseDateToEpochSeconds
    tradeability-cache.ts — (existing)
    liquidity-metrics.ts  — (existing)
    uma-propose-url.ts    — (existing)

features/orders/
  router.ts              — protected trading procedures (~25 procedures, ~800 lines)

features/markets/
  router.ts              — merge public CLOB reads into existing markets router (~34 procedures added)

features/rewards/
  router.ts              — getLiquidityRewards (NEW, 1 procedure)
```

### 1a. Procedures → `features/orders/router.ts` (protected)

All require `protectedProcedure` and use `getUserClient` or `getUserQueryClient`.

| Procedure | Lines | Type | Dependencies |
|-----------|-------|------|-------------|
| `getOpenOrders` | 1989–1999 | query | `getUserQueryClient`, `handleClobProcedureError`, `openOrderParamsSchema` |
| `getOrder` | 2001–2009 | query | `getUserQueryClient`, `handleClobProcedureError` |
| `getOpenOrdersWithMarkets` | 2011–2092 | query | `getUserQueryClient`, `handleClobProcedureError`, `openOrderParamsSchema`, `getMarkets` (gamma), enrichment helpers (`buildOpenOrderMarketMaps`, `extractOpenOrderMarketInfo`, `normalizeOpenOrdersResponse`) |
| `getTrades` | 2094–2109 | query | `getUserQueryClient`, `handleClobProcedureError`, `tradeParamsSchema` |
| `getTradesPaginated` | 2111–2132 | query | `getUserQueryClient`, `handleClobProcedureError`, `tradeParamsSchema` |
| `getBalanceAllowance` | 2134–2151 | query | `getUserQueryClient`, `handleClobProcedureError`, `balanceAllowanceParamsSchema` |
| `updateBalanceAllowance` | 2153–2162 | mutation | `getUserClient`, `handleClobProcedureError`, `balanceAllowanceParamsSchema` |
| `getNotifications` | 2164–2267 | query | `loadTradingUserForQueries`, `createUserClobClientForQueries`, `handleClobProcedureError`, notification helpers (`normalizeNotificationsResponse`, `dedupeAndSortNotificationsByTime`, `mergeRewardBellWithActivityApi`, `isValidNotificationsResponseShape`) |
| `isOrderScoring` | 2269–2278 | query | `getUserQueryClient`, `handleClobProcedureError` |
| `areOrdersScoring` | 2280–2287 | query | `getUserQueryClient`, `handleClobProcedureError` |
| `getBuilderOperations` | 2289–2299 | query | `getUserQueryClient`, `handleClobProcedureError` |
| `getBuilderTrades` | 2301–2330 | query | `getUserQueryClient`, `handleClobProcedureError` |
| `createAndPostOrder` | 2332–2343 | mutation | `getUserClient`, `handleClobProcedureError`, `throwIfClobError`, `createOrderInputSchema`, Discord ops helpers |
| `postOrder` | 2345–2385 | mutation | `getUserClient`, `handleClobProcedureError`, `throwIfClobError`, `signedOrderInputSchema`, Discord ops helpers |
| `cancelOrder` | 2387–2396 | mutation | `getUserClient`, `handleClobProcedureError` |
| `cancelAll` | 2398–2405 | mutation | `getUserClient`, `handleClobProcedureError` |
| `cancelMarketOrders` | 2407–2418 | mutation | `getUserClient`, `handleClobProcedureError`, `orderMarketCancelParamsSchema` |
| `createAndPostOrders` | 2420–2488 | mutation | `getUserClient`, `handleClobProcedureError`, `throwIfClobError`, `createOrderInputSchema`, Discord ops helpers |
| `cancelOrders` | 2490–2503 | mutation | `getUserClient`, `handleClobProcedureError` |
| `dropNotifications` | 2505–2515 | mutation | `getUserQueryClient`, `handleClobProcedureError` |
| `postBuilderOperation` | 2517–2527 | mutation | `getUserClient`, `handleClobProcedureError`, `builderOperationSchema` |
| `revokeBuilderApiKey` | 2529–2536 | mutation | `getUserClient`, `handleClobProcedureError` |
| `getApiKeys` | 2538–2545 | query | `getUserQueryClient`, `handleClobProcedureError` |
| `deleteApiKey` | 2547–2553 | mutation | `getUserQueryClient`, `handleClobProcedureError` |
| `postHeartbeat` | 2555–2565 | mutation | `getUserClient`, `handleClobProcedureError` |

**Total: 25 procedures (11 queries, 14 mutations)**

### 1b. Procedures → `features/markets/router.ts` (public, merge with existing)

All use `publicProcedure` and the shared `getReadOnlyClient()` singleton. Merge into the existing markets router (currently 7 procedures).

| Procedure | Lines | Dependencies |
|-----------|-------|-------------|
| `getOrderBook` | 1386–1427 | `getReadOnlyClient`, `EMPTY_ORDER_BOOK`, `isInvalidTokenId`, `NO_ORDERBOOK_PATTERN`, `isTokenNotFoundError` |
| `getClobMarketInfo` | 1429–1448 | `getReadOnlyClient`, `clobMarketInfoCache` (LRU) |
| `getLiquidityMetrics` | 1450–1463 | `getReadOnlyClient`, `getLiquidityMetricsFromBook` |
| `getOrderBooks` | 1465–1474 | `getReadOnlyClient` |
| `getMidpoint` | 1476–1495 | `getReadOnlyClient`, `classifyClobPriceSoftFailure` |
| `getPrice` | 1497–1514 | `getReadOnlyClient`, `classifyClobPriceSoftFailure`, `sideSchema` |
| `getSpread` | 1516–1529 | `getReadOnlyClient`, `withTradeabilityCache` |
| `getLastTradePrice` | 1531–1546 | `getReadOnlyClient`, `classifyClobPriceSoftFailure` |
| `calculateMarketPrice` | 1548–1587 | `getReadOnlyClient`, `classifyClobPriceSoftFailure`, `sideSchema` |
| `getServerTime` | 1589–1595 | `getReadOnlyClient` |
| `getMidpoints` | 1631–1640 | `getReadOnlyClient` |
| `getPrices` | 1642–1651 | `getReadOnlyClient` |
| `getSpreads` | 1653–1659 | `getReadOnlyClient` |
| `getLastTradePrices` | 1661–1698 | `getReadOnlyClient`, `classifyClobPriceSoftFailure` |
| `getPricesHistory` | 1715–1756 | `getReadOnlyClient`, `resolvePriceHistoryRequest`, `priceHistoryParamsSchema` |
| `getPricesHistoryBatch` | 1758–1824 | `getReadOnlyClient`, `resolvePriceHistoryRequest`, `priceHistoryBatchParamsSchema` |
| `getTradeVolume` | 1826–1836 | `getReadOnlyClient` |
| `getTickSize` | 1838–1865 | `getReadOnlyClient`, `withTradeabilityCache` |
| `getNegRisk` | 1879–1890 | `getReadOnlyClient` |
| `getMarketTradesEvents` | 1892–1896 | `getReadOnlyClient` |
| `getFeeRate` | 1924–1959 | `getReadOnlyClient`, `isV2Enabled`, `clobMarketInfoCache` |
| `getUmaProposeUrl` | 1970–1985 | `getUmaProposeUrl` (from `./lib/uma-propose-url`) |
| `getClobVersion` | 2567–2571 | `isV2Enabled` |

**Total: 23 public procedures merging into markets router**

### 1c. Procedures → `features/rewards/router.ts` (NEW)

| Procedure | Lines | Dependencies |
|-----------|-------|-------------|
| `getLiquidityRewards` | 1961–1968 | `getLiquidityRewardsForMarket` (from `./lib/clob-read`) |

**Total: 1 procedure**

### 1d. Procedures to Evaluate for Removal

| Procedure | Lines | Issue | Recommendation |
|-----------|-------|-------|----------------|
| `getMarket` | 1602–1606 | Duplicates `markets.getBySlug` / `markets.getById` | **Remove** — redirect callers to `trpc.markets.*` |
| `getMarkets` | 1608–1612 | Duplicates `markets.list` | **Remove** — redirect callers |
| `getSimplifiedMarket` | 1614–1620 | Duplicates `markets.getBySlug` with fewer fields | **Remove** — use `select` on client |
| `getSimplifiedMarkets` | 1622–1629 | Duplicates `markets.list` with fewer fields | **Remove** — use `select` on client |
| `getSamplingMarkets` | 1700–1704 | Wraps `getReadOnlyClient().getSamplingMarkets()` | **Audit usage** — likely unused, remove if no callers |
| `getSamplingSimplifiedMarkets` | 1706–1713 | Same | **Audit usage** — likely unused |
| `getGeoRestriction` | 1597–1600 | Infrastructure, not market data | **Move** to `shared/lib/geo.ts` utility or keep in markets |
| `getClobHealth` | 1906–1922 | Infrastructure health check | **Move** to Hono health route or keep as `clob.getClobHealth` |
| `getHeartbeat` | 1898–1904 | Public heartbeat (not user heartbeat) | **Move** to health route |
| `getTraded` | 1867–1877 | Also exists in `data.traded` (line 975) | **Deduplicate** — remove from trading, keep in data |

### 1e. Shared Code Extraction from trading/router.ts

Code that must be extracted into `features/trading/lib/` before splitting:

| Target File | Code | Current Lines | Used By |
|-------------|------|---------------|---------|
| `lib/error-mapping.ts` | `CLOB_ERROR_MAP`, `classifyClobError`, `throwIfClobError`, `handleClobProcedureError`, `ClobHttpError`, pattern constants (`REGIONAL_RESTRICTION_PATTERN`, etc.) | 280–660 | orders router, markets router (soft failures) |
| `lib/schemas.ts` | `sideSchema`, `signedOrderInputSchema`, `orderTypeSchema`, `tickSizeSchema`, `bookParamsSchema`, `tradeParamsSchema`, `openOrderParamsSchema`, `balanceAllowanceParamsSchema`, `priceHistoryBaseSchema`, `createOrderInputSchema`, `builderOperationSchema`, `orderMarketCancelParamsSchema` | 700–850, 1130–1310 | orders router, markets router |
| `lib/enrichment.ts` | `OpenOrderMarketSource`, `OpenOrderMarketInfo`, `extractOpenOrderMarketInfo`, `buildOpenOrderMarketMaps`, `normalizeOpenOrdersResponse` | 845–890, 1306–1380 | orders router only |
| `lib/notifications.ts` | `NotificationsEnvelopeShape`, `NotificationLike`, `ApiKeyCredentialsLike`, notification normalization/dedup/merge helpers, `REWARD_ACTIVITY_TYPES_FOR_BELL`, `mergeRewardBellWithActivityApi` | 849–1060 | orders router only |
| `lib/price-history.ts` | `PriceHistorySharedInput`, `resolvePriceHistoryRequest`, `parseDateToEpochSeconds`, fidelity constants | 1195–1300 | markets router (price history procedures) |
| `lib/client-factory.ts` | `getReadOnlyClient`, `getUserClient`, `getUserQueryClient`, `loadTradingUser`, `loadTradingUserForQueries`, `getMarketLabelForClobToken`, `readOnlyClientInstance`, `clobMarketInfoCache` | 60–260 | orders router, markets router |
| `lib/tradeability.ts` | `withTradeabilityCache`, `classifyClobPriceSoftFailure`, `isNoMatchError`, `isTokenNotFoundError`, `EMPTY_ORDER_BOOK` | 660–780 | markets router |

---

## 2. data/router.ts Split Plan

### Target Structure

```
features/data/
  router.ts              — re-exports merged sub-routers (thin orchestrator)
  lib/
    data-api.ts          — (existing) shared Data API client
    subgraph/            — (existing) subgraph strategy + queries
  schemas/
    data.ts              — (existing) shared Zod schemas

features/portfolio/
  router.ts              — (REPLACE existing wallets router) positions, balances, PnL
  
features/activity/
  router.ts              — (NEW) trades, activity, trade counts

features/leaderboard/
  router.ts              — (NEW) leaderboard, leaderboardByRoi
```

### 2a. Procedures → `features/portfolio/router.ts`

Replaces the existing `features/portfolio/router.ts` (currently `walletsRouter` with wallet management). Portfolio data procedures merge in.

| Procedure | Lines | Dependencies |
|-----------|-------|-------------|
| `positions` | 264–317 | `getPositions`, `getActivity` (data-api), `fetchAllTradeActivity`, `computeAssetCostBasis` |
| `closedPositions` | 319–337 | `getClosedPositions` (data-api) |
| `value` | 775–785 | `getValue` (data-api) |
| `usdcBalance` | 1002–1011 | `getPusdBalanceOnPolygon` (onchain/balance) |
| `ctfTokenBalances` | 1013–1029 | `getCtfTokenBalances` (onchain/balance) |
| `pnlTimeseries` | 360–384 | Direct fetch to `user-pnl-api.polymarket.com` |
| `snapshot` | 787–797 | `getAccountingSnapshot` (data-api) |
| `openInterest` | 980–989 | `getOpenInterest` (data-api) |
| `lpRewardsTotal` | 746–773 | `getActivity` (data-api) |
| `getEventOutcomeCount` | 1031–1067 | `getEventBySlug`, `getMarkets` (gamma) |

**Total: 10 procedures**

Shared helpers moving with portfolio:
- `fetchAllTradeActivity` (lines 155–200) — cost basis pagination
- `computeAssetCostBasis` (lines 205–245) — CLOB-only cost basis walk
- Constants: `COST_BASIS_PAGE_SIZE`, `COST_BASIS_MAX_PAGES`, `COST_BASIS_DUST`

### 2b. Procedures → `features/activity/router.ts` (NEW)

| Procedure | Lines | Dependencies |
|-----------|-------|-------------|
| `trades` | 339–358 | `getTrades` (data-api) |
| `tradesWithMarkets` | 510–591 | `getTrades` (data-api), `getMarkets` (gamma), `enrichLeaderboard` |
| `activityWithMarkets` | 593–706 | `getActivity` (data-api), `getMarkets` (gamma) |
| `activity` | 708–744 | `getActivity` (data-api) |
| `tradeCountsByMarket` | 386–508 | `getTrades` (data-api), `getTradeCountsByConditionIdsFromSubgraph` (subgraph), `getMarkets` (gamma) |

**Total: 5 procedures**

### 2c. Procedures → `features/leaderboard/router.ts` (NEW)

| Procedure | Lines | Dependencies |
|-----------|-------|-------------|
| `leaderboard` | 798–899 | `getLeaderboard` (data-api), `enrichLeaderboard` (markets/lib/enrich) |
| `leaderboardByRoi` | 901–961 | `getLeaderboard` (data-api), `enrichLeaderboard`, `fetchAllLeaderboardEntries`, `buildRoiSortedList`, ROI cache |

**Total: 2 procedures**

Shared helpers moving with leaderboard:
- `fetchAllLeaderboardEntries` (lines 60–110) — paginate all leaderboard entries
- `buildRoiSortedList` (lines 125–138) — ROI computation + sort
- `roiLeaderboardCache` (Map with TTL, lines 50–58)
- `ROI_CACHE_TTL_MS` constant

### 2d. Remaining in `features/data/router.ts` (misc/infrastructure)

| Procedure | Lines | Recommendation |
|-----------|-------|----------------|
| `subgraphStrategy` | 250–254 | Keep in data router (infrastructure) |
| `health` | 256–262 | Keep in data router (infrastructure) |
| `holders` | 963–973 | Move to portfolio or keep in data |
| `traded` | 975–978 | Keep in data (deduplicate with trading router's copy) |
| `liveVolume` | 991–1000 | Move to markets or keep in data |

### 2e. Shared Dependencies

All split routers share:
- `features/data/lib/data-api.ts` — stays in place, imported by portfolio/activity/leaderboard
- `features/data/lib/subgraph/` — stays in place, imported by activity (tradeCountsByMarket)
- `features/data/schemas/data.ts` — stays in place
- `../../shared/errors` → `withPolymarketError` — already shared infrastructure
- `features/markets/lib/gamma` → `getMarkets`, `getEventBySlug` — already shared
- `features/markets/lib/enrich` → `enrichLeaderboard` — already shared

---

## 3. auth/router.ts Split Plan

### Target Structure

```
features/auth/
  router.ts              — re-exports merged sub-routers
  lib/
    magic.ts             — (NEW) getMagic(), Magic Admin SDK singleton
    wallet-challenge.ts  — (NEW) HMAC challenge create/parse/verify
    helpers.ts           — (NEW) toAuthUser, normalizeWalletAddressOrThrow, enforceReferralGate, resolveUser
    magic-errors.ts      — (existing) mapTokenValidationError, mapMetadataError
  session/
    router.ts            — login, logout, me
  wallet/
    router.ts            — getWalletLoginChallenge, walletLogin
  onboarding/
    router.ts            — registerSafe, clearSafe, checkApprovalStatus
  credentials/
    router.ts            — getCredentials, storeCredentials (removed in Phase 4)
```

### 3a. Procedures → `features/auth/session/router.ts`

| Procedure | Lines | Type | Dependencies |
|-----------|-------|------|-------------|
| `login` | 329–527 | public mutation | `getMagic`, `consumeDidTokenNonce`, `findUserByIssuer`, `findUserByWallet`, `upsertUser`, `createUserWithReferral`, `createSessionToken`, `toAuthUser`, `enforceReferralGate`, `resolveUser`, `normalizeWalletAddressOrThrow`, `mapTokenValidationError`, `mapMetadataError`, `notifyDiscordOps`, `maskEmailForOps` |
| `logout` | 717–775 | protected mutation | `getMagic`, `revokeSession`, `findUserById`, `notifyDiscordOps`, `maskEmailForOps` |
| `me` | 844–875 | protected query | `findUserById`, `toAuthUser` |

**Total: 3 procedures (~450 lines including login's complexity)**

### 3b. Procedures → `features/auth/wallet/router.ts`

| Procedure | Lines | Type | Dependencies |
|-----------|-------|------|-------------|
| `getWalletLoginChallenge` | 529–556 | public mutation | `normalizeWalletAddressOrThrow`, `createWalletChallengeToken`, `buildWalletChallengeMessage`, `WALLET_CHALLENGE_TTL_SECONDS`, `WALLET_NONCE_PREFIX`, `randomUUID` |
| `walletLogin` | 558–715 | public mutation | `parseAndVerifyWalletChallengeToken`, `consumeDidTokenNonce`, `findUserByWallet`, `upsertUser`, `createUserWithReferral`, `createSessionToken`, `toAuthUser`, `enforceReferralGate`, `resolveUser`, `notifyDiscordOps`, `maskEmailForOps` |

**Total: 2 procedures (~190 lines)**

### 3c. Procedures → `features/auth/onboarding/router.ts`

| Procedure | Lines | Type | Dependencies |
|-----------|-------|------|-------------|
| `registerSafe` | 909–1076 | protected mutation | `findUserById`, `updateUser`, `toAuthUser`, `notifyDiscordOps`, `ethers` (dynamic import for on-chain verify) |
| `clearSafe` | 1078–1144 | protected mutation | `findUserById`, `updateUser`, `toAuthUser` |
| `checkApprovalStatus` | 777–842 | protected query | `findUserById`, `needsApproval`, `getApprovalCheckOutcome` |

**Total: 3 procedures (~300 lines)**

### 3d. Procedures → `features/auth/credentials/router.ts`

| Procedure | Lines | Type | Dependencies |
|-----------|-------|------|-------------|
| `getCredentials` | 877–907 | protected query | `findUserById`, `decrypt`, `env.CREDENTIAL_ENCRYPTION_KEY` |
| `storeCredentials` | 1146–1246 | protected mutation | `findUserById`, `updateUser`, `encrypt`, `toAuthUser`, `notifyDiscordOps` |

**Total: 2 procedures (~170 lines)**

> **Note:** `credentials/router.ts` is removed entirely in Phase 4 (client-side credential derivation). Keep it isolated so removal is a single file delete + router unwiring.

### 3e. Shared Code Extraction from auth/router.ts

| Target File | Code | Current Lines |
|-------------|------|---------------|
| `lib/magic.ts` | `getMagic()`, `magicInstance` singleton | 80–100 |
| `lib/wallet-challenge.ts` | `WalletChallengePayload`, `buildWalletChallengeMessage`, `signWalletChallengePayload`, `createWalletChallengeToken`, `parseAndVerifyWalletChallengeToken`, constants (`WALLET_CHALLENGE_TTL_SECONDS`, `WALLET_CHALLENGE_VERSION`, `WALLET_NONCE_PREFIX`, `REGEX_ETH_ADDRESS`) | 60–78, 130–230 |
| `lib/helpers.ts` | `toAuthUser`, `normalizeWalletAddressOrThrow`, `enforceReferralGate`, `resolveUser` | 105–130, 240–320 |

---

## 4. Shared Code Strategy

### Principle: Extract First, Split Second

Before moving any procedures, extract shared helpers into `lib/` files. This way both the old and new routers can import from the same location during the transition.

### trading/router.ts Shared Code

| Shared Code | New Location | Consumers |
|-------------|-------------|-----------|
| `getReadOnlyClient`, `clobMarketInfoCache` | `features/trading/lib/client-factory.ts` | markets router (public reads), orders router (none currently, but available) |
| `getUserClient`, `getUserQueryClient`, `loadTradingUserForQueries` | `features/trading/lib/client-factory.ts` | orders router only |
| `handleClobProcedureError`, `classifyClobError`, `throwIfClobError`, `CLOB_ERROR_MAP`, pattern constants | `features/trading/lib/error-mapping.ts` | orders router, markets router (soft failure classification) |
| `withTradeabilityCache`, `classifyClobPriceSoftFailure`, `isNoMatchError`, `EMPTY_ORDER_BOOK` | `features/trading/lib/tradeability.ts` (merge into existing `tradeability-cache.ts`) | markets router |
| `isV2Enabled` | `features/trading/lib/v2-flag.ts` | markets router (getFeeRate, getClobVersion) |
| All Zod schemas | `features/trading/lib/schemas.ts` | orders router, markets router |
| Notification helpers | `features/trading/lib/notifications.ts` | orders router only |
| Enrichment helpers | `features/trading/lib/enrichment.ts` | orders router only |
| Price history helpers | `features/trading/lib/price-history.ts` | markets router only |
| Discord ops helpers | Already in `../../shared/discord-ops-webhook` | orders router |

### data/router.ts Shared Code

| Shared Code | Location | Consumers |
|-------------|----------|-----------|
| `data-api.ts` | `features/data/lib/data-api.ts` (stays) | portfolio, activity, leaderboard |
| `subgraph/` | `features/data/lib/subgraph/` (stays) | activity (tradeCountsByMarket) |
| `withPolymarketError` | `shared/errors.ts` (stays) | all data sub-routers |
| Cost basis helpers | Move to `features/portfolio/lib/cost-basis.ts` | portfolio only |
| ROI cache + helpers | Move to `features/leaderboard/lib/roi-cache.ts` | leaderboard only |

### auth/router.ts Shared Code

| Shared Code | Location | Consumers |
|-------------|----------|-----------|
| `getMagic()` | `features/auth/lib/magic.ts` | session (login, logout), wallet (walletLogin) |
| Wallet challenge helpers | `features/auth/lib/wallet-challenge.ts` | wallet router only |
| `toAuthUser`, `normalizeWalletAddressOrThrow` | `features/auth/lib/helpers.ts` | session, wallet, onboarding, credentials |
| `enforceReferralGate`, `resolveUser` | `features/auth/lib/helpers.ts` | session (login), wallet (walletLogin) |

---

## 5. Step-by-Step Execution

### Phase A: trading/router.ts (PR #1 — biggest win)

```
Step 1: Extract shared code into lib/ files
  1a. Create features/trading/lib/error-mapping.ts
      - Move CLOB_ERROR_MAP, classifyClobError, throwIfClobError,
        handleClobProcedureError, ClobHttpError, all pattern constants
  1b. Create features/trading/lib/client-factory.ts
      - Move getReadOnlyClient, getUserClient, getUserQueryClient,
        loadTradingUserForQueries, getMarketLabelForClobToken,
        readOnlyClientInstance, clobMarketInfoCache
  1c. Create features/trading/lib/schemas.ts
      - Move all Zod schemas and related types
  1d. Create features/trading/lib/notifications.ts
      - Move all notification normalization/dedup/merge helpers
  1e. Create features/trading/lib/enrichment.ts
      - Move OpenOrderMarketSource, OpenOrderMarketInfo, enrichment helpers
  1f. Create features/trading/lib/price-history.ts
      - Move resolvePriceHistoryRequest, parseDateToEpochSeconds, fidelity helpers
  1g. Merge tradeability helpers into existing lib/tradeability-cache.ts
      - Move withTradeabilityCache, classifyClobPriceSoftFailure, isNoMatchError,
        isTokenNotFoundError, EMPTY_ORDER_BOOK

Step 2: Update trading/router.ts to import from new lib/ files
  - Replace inline code with imports
  - Run: pnpm check-types (must pass — no behavior change)

Step 3: Create features/orders/router.ts
  - Copy 25 protected procedures
  - Import shared code from features/trading/lib/
  - Export as ordersRouter

Step 4: Create features/rewards/router.ts
  - Copy getLiquidityRewards
  - Export as rewardsRouter

Step 5: Merge public procedures into features/markets/router.ts
  - Copy 23 public CLOB procedures
  - Import getReadOnlyClient, schemas, error helpers from features/trading/lib/
  - Keep existing 7 Gamma procedures

Step 6: Update routers/index.ts
  - Add: orders: ordersRouter
  - Add: rewards: rewardsRouter
  - Keep: markets: marketsRouter (now has CLOB reads merged in)
  - Keep: clob: clobRouter (temporarily, for backward compat)

Step 7: Verify
  - pnpm check-types
  - pnpm fix
  - Grep web codebase for trpc.clob.* calls — update to trpc.orders.* / trpc.markets.*

Step 8: Remove procedures from trading/router.ts
  - Delete moved procedures
  - trading/router.ts should be nearly empty (just re-exports or removed entirely)
  - pnpm check-types again

Step 9: Client migration
  - Update all trpc.clob.getOrderBook → trpc.markets.getOrderBook (etc.)
  - Update all trpc.clob.createAndPostOrder → trpc.orders.createAndPostOrder (etc.)
  - Remove clob from routers/index.ts once all callers migrated
```

### Phase B: data/router.ts (PR #2)

```
Step 1: Extract shared code
  1a. Create features/portfolio/lib/cost-basis.ts
  1b. Create features/leaderboard/lib/roi-cache.ts

Step 2: Create features/activity/router.ts (5 procedures)
Step 3: Create features/leaderboard/router.ts (2 procedures)
Step 4: Move portfolio procedures into features/portfolio/router.ts
        (merge with existing walletsRouter)

Step 5: Update routers/index.ts
  - Add: activity: activityRouter
  - Add: leaderboard: leaderboardRouter
  - Update: wallets → portfolio (rename if desired, or keep wallets namespace)
  - Keep: data: dataRouter (infrastructure: health, subgraphStrategy, misc)

Step 6: Verify + client migration
  - pnpm check-types
  - Update trpc.data.positions → trpc.wallets.positions (or trpc.portfolio.*)
  - Update trpc.data.leaderboard → trpc.leaderboard.leaderboard
  - Update trpc.data.trades → trpc.activity.trades
```

### Phase C: auth/router.ts (PR #3 — least urgent)

```
Step 1: Extract shared code
  1a. Create features/auth/lib/magic.ts
  1b. Create features/auth/lib/wallet-challenge.ts
  1c. Create features/auth/lib/helpers.ts

Step 2: Create features/auth/session/router.ts (3 procedures)
Step 3: Create features/auth/wallet/router.ts (2 procedures)
Step 4: Create features/auth/onboarding/router.ts (3 procedures)
Step 5: Create features/auth/credentials/router.ts (2 procedures)

Step 6: Update features/auth/router.ts to merge sub-routers
  - authRouter = t.mergeRouters(sessionRouter, walletRouter, onboardingRouter, credentialsRouter)
  - Or use router({ ...sessionRouter, ...walletRouter, ... })

Step 7: Verify
  - pnpm check-types
  - No client migration needed (auth namespace unchanged)
```

---

## 6. Risk Mitigation

### PR Strategy

- **One router split per PR** — never combine trading + data + auth in one PR
- **trading/router.ts first** — biggest file (2,571 lines), biggest win, most procedures
- **data/router.ts second** — moderate size, clean domain boundaries
- **auth/router.ts last** — least urgent; credentials removal in Phase 4 changes it anyway

### Backward Compatibility

- During migration, keep the old `clob` namespace in `routers/index.ts` alongside new `orders`/`markets` namespaces
- Use TypeScript to find all callers: `grep -r "trpc\.clob\." apps/web/src/`
- Remove old namespace only after all callers are migrated and verified

### Testing Strategy

- After each step, run `pnpm check-types` — type errors catch broken imports immediately
- After full PR, run `pnpm build` to verify production build
- Grep for any remaining references to moved code: `grep -r "from.*trading/router" apps/server/`
- Run `pnpm test` to catch integration regressions

### Rollback Plan

- Each PR is self-contained — revert the PR if issues arise
- Extract-first approach means Step 1–2 (lib extraction) can land as a standalone PR with zero behavior change
- Procedure moves (Step 3–8) can be a separate PR on top

### Client Namespace Migration

The web app currently uses `trpc.clob.*` for all 55 procedures. After the split:

| Old Call | New Call |
|----------|---------|
| `trpc.clob.getOrderBook` | `trpc.markets.getOrderBook` |
| `trpc.clob.getPricesHistory` | `trpc.markets.getPricesHistory` |
| `trpc.clob.createAndPostOrder` | `trpc.orders.createAndPostOrder` |
| `trpc.clob.getOpenOrders` | `trpc.orders.getOpenOrders` |
| `trpc.clob.getNotifications` | `trpc.orders.getNotifications` |
| `trpc.clob.getLiquidityRewards` | `trpc.rewards.getLiquidityRewards` |
| `trpc.data.positions` | `trpc.wallets.positions` (or `trpc.portfolio.*`) |
| `trpc.data.leaderboard` | `trpc.leaderboard.leaderboard` |
| `trpc.data.trades` | `trpc.activity.trades` |

Use find-and-replace with type checking to ensure no calls are missed. The TypeScript compiler will error on any `trpc.clob.*` call that no longer exists.
