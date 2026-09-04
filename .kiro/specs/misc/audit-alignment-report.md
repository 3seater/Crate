# Alignment Audit Report

**Date:** 2025-02-16  
**Scope:** Schemas, types, clients, routers, WebSockets, RTDS, env, error handling, rate limiting

## Executive Summary

The alignment audit across Polymarket API layers shows **strong consistency** with one typo fix applied and several minor improvements recommended. All critical paths (REST → schema → router, WebSocket → Zod → types, RTDS → payload schemas) are properly aligned.

---

## Checklist Results

### Schemas (`apps/server/src/lib/polymarket/schemas/`)

| Item | Status | Notes |
|------|--------|-------|
| **gamma.ts** — EventSchema, MarketSchema, TagSchema, SeriesSchema, CommentSchema, PublicProfileSchema, SearchSchema, SearchResultSchema, TeamSchema, SportMetadataItemSchema, SportsMarketTypesResponseSchema, RelatedTagSchema, EventSportsMetadataSchema use `.loose()` | ✅ | No `.passthrough()` in active code |
| **gamma.ts** — Key fields match Gamma OpenAPI | ✅ | id, slug, title, markets, negRisk, etc. validated |
| **data.ts** — PositionSchema, TradeSchema, ActivitySchema, ClosedPositionSchema, TradedSchema, ValueSchema, OpenInterestSchema, LiveVolumeSchema, HolderSchema, LeaderboardEntrySchema | ✅ | Inline schemas in data.ts; exported from schemas/data.ts where applicable |
| **clob.ts** — OrderBookSnapshotSchema (market, asset_id, bids, asks, min_order_size, tick_size, neg_risk) | ✅ | OrderLevel { price, size }; PriceHistoryPointSchema { t, p } |
| **bridge.ts** — SupportedAssetSchema uses minCheckoutUsd | ✅ | QuoteSchema, DepositResponse, TransactionStatus enum match Bridge OpenAPI |
| **index.ts** — All schemas and Validated* types exported | ✅ | Comprehensive exports; EventSportsMetadataSchema, ValidatedSportsMarketTypesResponse present in gamma (used by gamma client) |

### Client Params (`apps/server/src/lib/polymarket/`)

| Item | Status | Notes |
|------|--------|-------|
| **gamma.ts** — GET /events/slug/{slug}, GET /markets/slug/{slug} for single items | ✅ | `getEventBySlug`, `getMarketBySlug` |
| **gamma.ts** — EventParams, MarketParams, TagParams, SeriesParams, CommentParams | ✅ | Full param sets; slug[], tag_id, exclude_tag_id, related_tags, etc. |
| **gamma.ts** — getPublicProfile uses GET /public-profile?address= | ✅ | Query param, 0x-prefixed |
| **data.ts** — Endpoints: /positions, /trades, /activity, /closed-positions, /value, /traded, /oi, /live-volume, /holders, /v1/* | ✅ | Uses /oi (not /open-interest); query params correct |
| **bridge.ts** — createDepositAddresses, createWithdrawalAddresses, getQuote | ✅ | Params match router inputs |
| All clients validate responses with schema before returning | ✅ | resilient-fetch + schema.safeParse |

### Routers (`apps/server/src/routers/`)

| Item | Status | Notes |
|------|--------|-------|
| **events.ts** — eventListInput maps 1:1 to EventParams | ✅ | snake_case for API (tag_id, exclude_tag_id, etc.) |
| **markets.ts** — marketListInput maps 1:1 to MarketParams | ✅ | slug[], clob_token_ids[], sports_market_types[], etc. |
| **data.ts** — Procedure inputs match client params | ✅ | positions, closedPositions, trades, activity, value, snapshot, leaderboard, holders, traded, openInterest, liveVolume |
| **clob.ts** — Price history, orderbook, price params | ✅ | market, interval, startTs/endTs; tokenId for books |
| **bridge.ts** — Inputs match bridge client | ✅ | address, toChainId, etc. |
| No router drops params | ✅ | All optional params forwarded when provided |

### Types (`packages/types/`)

| Item | Status | Notes |
|------|--------|-------|
| **websocket.ts** — BookEvent, LastTradePriceEvent, BestBidAskEvent, PriceChangeEvent, TickSizeChangeEvent, NewMarketEvent, MarketResolvedEvent, UserTradeEvent, UserOrderEvent | ✅ | Align with CLOB WebSocket docs; RTDS types in rtds.ts |
| **websocket.ts** — User channel: associate_trades, owner, maker_orders, taker_order_id, matchtime, status | ✅ | Types include all documented fields |
| Gamma/data types in server schemas | ✅ | `@doji/types` for CLOB/websocket; Gamma/Data use Validated* from schemas |

### WebSockets (`apps/web/src/lib/websocket/`)

| Item | Status | Notes |
|------|--------|-------|
| **market-channel.ts** — Subscribes to CLOB market channel; handles book, price_change, last_trade_price, best_bid_ask, tick_size_change, new_market, market_resolved | ✅ | MARKET_EVENT_TYPES set matches |
| **schemas.ts** — MarketChannelMessageSchema discriminated union; safeParseMarketChannelMessage | ✅ | All event types validated before dispatch |
| **schemas vs types** — Zod schemas align with @doji/types | ✅ | BookEvent, LastTradePriceEvent, etc. |
| **user-channel.ts** — UserOrderEvent (PLACEMENT/UPDATE/CANCELLATION), UserTradeEvent (TRADE, status MATCHED/MINED/CONFIRMED/etc.) | ✅ | safeParseUserChannelMessage used |
| **manager.ts** — channel "market"|"user"; type USER/MARKET; assets_ids / markets; operation subscribe/unsubscribe | ✅ | custom_feature_enabled in body |
| **subscription-registry.ts** — Ref-counting for asset subscriptions | ✅ | No duplicate subscriptions |
| **sports-channel.ts** — NEXT_PUBLIC_WS_SPORTS_URL; PING/PONG; sport_result handler | ✅ | No subscription message; gameId, score, period, live, ended |

### RTDS (`apps/web/src/lib/websocket/`)

| Item | Status | Notes |
|------|--------|-------|
| **rtds.ts** — Connects to NEXT_PUBLIC_RTDS_URL | ✅ | wss://ws-live-data.polymarket.com |
| **Topics** — comments, crypto_prices, crypto_prices_chainlink | ✅ | KNOWN_TOPICS in rtds-schemas |
| **CommentPayload** — body, createdAt, id, parentCommentID, parentEntityID, parentEntityType, profile (baseAddress, name, proxyWallet, pseudonym), reactionCount, replyAddress, reportCount, userAddress | ✅ | rtds-schemas.ts CommentPayloadSchema |
| **CryptoPricePayload** — symbol, timestamp, value | ✅ | rtds-schemas.ts CryptoPricePayloadSchema |
| **Event types** — comment_created, comment_removed, reaction_*, update for crypto | ✅ | type field in RtdsMessage |
| **Reconnection** — Re-subscribes to all topics on reconnect | ✅ | sendSubscriptionAction("subscribe", allSubs) in onopen |
| **Ping/Pong** — PING every ~5s | ✅ | PING_INTERVAL_MS = 5000 |

### Env & Config (`packages/env/`, `turbo.json`)

| Item | Status | Notes |
|------|--------|-------|
| **server.ts** — GAMMA_API_URL, DATA_API_URL, BRIDGE_API_URL, CLOB_API_URL | ✅ | All defined with defaults |
| **web.ts** — NEXT_PUBLIC_WS_MARKET_URL, NEXT_PUBLIC_WS_USER_URL, NEXT_PUBLIC_RTDS_URL, NEXT_PUBLIC_WS_SPORTS_URL | ✅ | Defaults for all WS URLs |

### Error Handling

| Item | Status | Notes |
|------|--------|-------|
| **events, markets, data, bridge routers** — withPolymarketError() | ✅ | All procedures wrap client calls |
| **clob router** — Protected procedures use handleClobProcedureError | ✅ | getOpenOrders, getTrades, postOrder, cancelOrder, etc. |
| No procedure returns raw Polymarket errors | ✅ | mapApiErrorToTRPC / handleClobProcedureError |

### Rate Limiting

| Item | Status | Notes |
|------|--------|-------|
| **SOURCE_TO_FAMILY** — gamma, data, clob, bridge | ✅ | Keys match createResilientFetch source |
| **RATE_LIMIT_CONFIG** — data endpoints | ✅ | Full coverage: /trades, /positions, /closed-positions, /activity, /value, /traded, /oi, /live-volume, /holders, /v1/accounting/snapshot, /v1/leaderboard, /v1/builders/*. |
| **resilient-fetch** — Uses rate limiter; path passed to acquire | ✅ | source, path, method |

### Trading / Order Placement

| Item | Status | Notes |
|------|--------|-------|
| User vs Builder credentials | ✅ | User API creds for orders; Builder for attribution |
| L2 auth, signature type, funder | ✅ | ClobClient setup per docs |
| tickSize, negRisk from market | ✅ | Passed to createAndPostOrder |
| Chain ID 137 | ✅ | packages/env CHAIN_ID |
| Builder headers (POLY_BUILDER_*) | ✅ | Remote signing route |

---

## Fixes Applied

1. **data router** — Typo: "At leat one market required" → "At least one market required" in `openInterest` procedure.

---

## Recommendations

1. **Rate limit config** — ✅ Completed. Data API endpoints added to RATE_LIMIT_CONFIG.data.endpoints.

2. **schemas/index.ts** — Consider exporting `EventSportsMetadataSchema`, `ValidatedEventSportsMetadata`, `SportsMarketTypesResponseSchema`, `ValidatedSportsMarketTypesResponse` if they are needed outside gamma client. Currently gamma.ts imports directly from schemas/gamma.

3. **price_change migration** — If Polymarket changed price_change schema in Sept 2025, verify `PriceChangeMessageSchema` in `apps/web/src/lib/websocket/schemas.ts` matches current API. Current schema has `price_changes[]` with asset_id, price, size, side, hash, best_bid, best_ask.

---

## Quick Verification Commands

```bash
pnpm check-types   # ✅ Passed
rg "\.passthrough\(\)" apps/server/   # No matches in active schema code
rg "withPolymarketError|handleClobProcedureError" apps/server/src/routers/   # All procedures wrapped
```

---

## Related Docs

- [Polymarket API (LLMs)](https://docs.polymarket.com/llms.txt)
- [Gamma Fetch Guide](https://docs.polymarket.com/developers/gamma-markets-api/fetch-markets-guide)
- [Market Channel](https://docs.polymarket.com/developers/CLOB/websocket/market-channel)
- [RTDS Comments](https://docs.polymarket.com/developers/RTDS/RTDS-comments)
- [RTDS Crypto Prices](https://docs.polymarket.com/developers/RTDS/RTDS-crypto-prices)
