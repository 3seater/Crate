# Audit Alignment

## Overview

Run an alignment audit across schemas, types, clients, routers, **WebSockets**, **RTDS**, and other real-time/data layers to ensure all layers stay consistent. Use when adding new Polymarket endpoints, refactoring API integration, changing WebSocket or RTDS usage, or before major releases.

## Architecture Map

```
packages/types/          ← Public TypeScript interfaces (Event, Market, Position, Trade, auth, websocket, etc.)
packages/env/            ← Env validation (server.ts, web.ts); API URLs, Magic, Builder keys
packages/api/            ← tRPC setup: context, trpc instance; middleware (auth, logger); clob-factory, session, crypto
packages/db/             ← Drizzle schema, migrations, queries (users, sessions, credentials)
        ↑
apps/server/
├── lib/
│   ├── polymarket/     ← Polymarket API clients + schemas
│   │   ├── schemas/    ← gamma, data, clob, bridge
│   │   ├── gamma.ts, data.ts, clob-read.ts, bridge.ts
│   │   ├── resilient-fetch.ts  ← Uses rate limiter; source→family mapping
│   │   ├── enrich-positions.ts, filters.ts, liquidity-metrics.ts, tradeability-cache.ts
│   │   └── AGENTS.md
│   ├── rate-limiter.ts, rate-limit-config.ts  ← SOURCE_TO_FAMILY, endpoint paths
│   ├── retry.ts, cache.ts, circuit-breaker.ts, deduplicator.ts
│   ├── errors.ts, map-api-error.ts
│   ├── check-approval-status.ts, balance.ts, validate-config.ts
│   └── AGENTS.md
├── routes/              ← Hono HTTP routes (not tRPC)
│   └── polymarket/     ← POST /api/polymarket/sign (Builder remote signing)
├── routers/
│   ├── events.ts, markets.ts, data.ts, clob.ts, bridge.ts, auth.ts
│   ├── health.ts       ← Health checks
│   └── openapi.ts      ← OpenAPI introspection from tRPC appRouter
└── app.ts, index.ts

apps/web/src/
├── lib/
│   ├── websocket/      ← CLOB market/user channels, RTDS, sports; schemas, subscription-registry
│   ├── magic/          ← auth.ts, signer.ts, provider.tsx, clob-credentials.ts, errors.ts
│   ├── trading/        ← place-order-client, clob-auth, order-validation, market-constraints, geoblock, verify-safe-onchain
│   ├── markets/        ← events.ts, market-urls.ts, market-utils.ts
│   ├── bridge/         ← utils.ts
│   ├── portfolio/      ← download-snapshot, activity-volume-metrics
│   └── trpc/           ← client, errors, trpc-server
├── hooks/              ← use-clob-client, use-orderbook, use-comments, use-deploy-safe, use-trading-init, etc.
├── stores/             ← wallet.ts (Zustand)
└── app/api/            ← unlock/route, polymarket/sign/route (proxy to server)

apps/docs/               ← Fumadocs (separate deployment; port 3002)

tests/                   ← fixtures, unit, integration, e2e; schema/router alignment
```

### Areas Not Covered in Main Checklist (verify when relevant)

| Area | Path | Notes |
|------|------|-------|
| **Server resilience** | `lib/rate-limiter.ts`, `rate-limit-config.ts`, `resilient-fetch.ts` | SOURCE_TO_FAMILY, endpoint paths in RATE_LIMIT_CONFIG; resilient-fetch uses limiter |
| **Server lib (non-polymarket)** | `lib/check-approval-status.ts`, `balance.ts`, `enrich-positions.ts`, `filters.ts`, `liquidity-metrics.ts`, `tradeability-cache.ts` | Enrichment/filtering logic; on-chain approval checks |
| **HTTP routes** | `routes/polymarket/sign.ts` | Builder signing; method/path/body → POLY_BUILDER_* headers |
| **packages/api** | `lib/clob-factory.ts`, `lib/clob/`, `lib/session.ts`, `lib/crypto.ts`, `middleware/auth.ts` | CLOB factory for protected procedures; session extraction from DID |
| **packages/db** | `schema/`, `queries/` | users, sessions; credential encryption; auth flow depends on user lookup |
| **packages/env** | `server.ts`, `web.ts` | API URLs, Magic keys, Builder keys; clients read from env |
| **Web trading lib** | `lib/trading/*` | place-order-client, order-validation, market-constraints; geoblock; verify-safe-onchain |
| **Web stores** | `stores/wallet.ts` | Auth state; logout clears |
| **Web API routes** | `app/api/unlock`, `app/api/polymarket/sign` | Proxy/unlock; sign proxies to server |
| **tests** | `tests/fixtures/`, `tests/unit/`, `tests/integration/` | Fixtures (auth, ids); schema validation in integration tests |
| **references/** | `references/poly-sdk`, `references/relayer-deposits` | External refs; exclude from main audit |

## Polymarket API Reference

> Source: [docs.polymarket.com/llms.txt](https://docs.polymarket.com/llms.txt). Fetch full index for detailed contracts.

### REST Base URLs

| API | Base URL |
|-----|----------|
| CLOB | `https://clob.polymarket.com` |
| Gamma | `https://gamma-api.polymarket.com` |
| Data | `https://data-api.polymarket.com` |
| Bridge | `https://bridge.polymarket.com` |

### Gamma API

- **Health** — GET /status → text/plain "OK"
- **Events** — GET /events (limit, offset, order, ascending; id[], tag_id, exclude_tag_id[], slug[], tag_slug, related_tags, active, archived, featured, cyom, include_chat, include_template, recurrence, closed; liquidity_min/max, volume_min/max, start_date_min/max, end_date_min/max; returns Event[]), GET /events/{id}, GET /events/slug/{slug} (include_chat, include_template), GET /events/{id}/tags (returns Tag[])
- **Markets** — GET /markets (limit, offset, order, ascending; id[], slug[], clob_token_ids[], condition_ids[], market_maker_address[]; liquidity_num_min/max, volume_num_min/max, start_date_min/max, end_date_min/max; tag_id, related_tags, cyom, uma_resolution_status, game_id, sports_market_types[], rewards_min_size, question_ids[], include_tag, closed; returns Market[]), GET /markets/{id}, GET /markets/slug/{slug} (include_tag), GET /markets/{id}/tags (returns Tag[])
- **Series** — GET /series (limit, offset, order, ascending; slug[], categories_ids[], categories_labels[], closed, include_chat, recurrence; returns Series[]; Series: id, ticker, slug, title, subtitle, seriesType, recurrence, volume, liquidity, events, collections, categories, tags), GET /series/{id} (include_chat)
- **Tags** — GET /tags (limit, offset, order, ascending, include_template, is_carousel; Tag: id, label, slug, forceShow, publishedAt, createdBy, updatedBy, createdAt, updatedAt, forceHide, isCarousel), GET /tags/{id}, GET /tags/slug/{slug} (include_template), GET /tags/{id}/related-tags, GET /tags/slug/{slug}/related-tags (omit_empty, status: active|closed|all; RelatedTag: id, tagID, relatedTagID, rank), GET /tags/{id}/related-tags/tags, GET /tags/slug/{slug}/related-tags/tags (returns Tag[])
- **Comments** — GET /comments (limit, offset, order, ascending; parent_entity_type: Event|Series|market, parent_entity_id, get_positions, holders_only; returns Comment[]; Comment: id, body, parentEntityType, parentEntityID, parentCommentID, userAddress, replyAddress, profile, reactions, reportCount, reactionCount), GET /comments/{id} (get_positions; returns Comment[]), GET /comments/user_address/{user_address} (limit, offset, order, ascending)
- **Profiles** — GET /public-profile?address= (required; 0x-prefixed 40 hex; returns PublicProfileResponse: createdAt, proxyWallet, profileImage, displayUsernamePublic, bio, pseudonym, name, users[], xUsername, verifiedBadge; PublicProfileUser: id, creator, mod; 400 validation/404 not found)
- **Search** — GET /public-search?q= (required; cache, events_status, limit_per_type, page, events_tag[], keep_closed_markets, sort, ascending, search_tags, search_profiles, recurrence, exclude_tag_id[], optimized; returns Search: events[], tags[], profiles[], pagination: { hasMore, totalResults }; SearchTag: id, label, slug, event_count)
- **Sports** — GET /sports (metadata: sport, image, resolution, ordering, tags, series), GET /sports/market-types → { marketTypes: string[] } (use with markets `sportsMarketTypes` param), GET /teams (limit, offset, order, ascending, league[], name[], abbreviation[]; Team: id, name, league, record, logo, abbreviation, alias, createdAt, updatedAt)

### Data API

- **Health** — GET / → { data: "OK" }
- **Core** — GET /positions (user req; limit 500, offset 10000; market/eventId mutually exclusive; sizeThreshold, redeemable, mergeable, sortBy, sortDirection, title), GET /trades (limit/offset 10000; user, market, eventId; takerOnly, filterType CASH|TOKENS, filterAmount, side BUY|SELL), GET /activity (user req; limit 500, offset 10000; type: TRADE|SPLIT|MERGE|REDEEM|REWARD|CONVERSION|MAKER_REBATE), GET /closed-positions (user req; limit 50, offset 100000; market, eventId, title; sortBy REALIZEDPNL|TITLE|PRICE|AVGPRICE|TIMESTAMP)
- **Misc** — GET /v1/accounting/snapshot?user= (ZIP: positions.csv [conditionId, asset, size, curPrice, valuationTime], equity.csv [cashBalance, positionsValue, equity, valuationTime]), GET /traded?user= → { user, traded }, GET /oi?market= (open interest; use /oi not /open-interest) → [{ market, value }], GET /live-volume?id= → [{ total, markets: [{ market, value }] }], GET /holders?market= (limit 20, minBalance), GET /value?user= → [{ user, value }]
- **Builders** — GET /v1/leaderboard (trader; category OVERALL|POLITICS|SPORTS|CRYPTO|…, timePeriod DAY|WEEK|MONTH|ALL, orderBy PNL|VOL, limit 50), GET /v1/builders/leaderboard (timePeriod, limit 50), GET /v1/builders/volume (time-series; dt, builder, volume, activeUsers, rank)

### Bridge API

- **USDC.e** — Bridged USDC on Polygon; collateral for all Polymarket trading
- **Endpoints** — GET /supported-assets, POST /quote, POST /deposit, POST /withdraw, GET /status/{address}
- **SupportedAsset** — chainId, chainName, token (name, symbol, address, decimals), **minCheckoutUsd** (not minDeposit)
- **Quote** — Request: fromAmountBaseUnit, fromChainId, fromTokenAddress, recipientAddress, toChainId, toTokenAddress. Response: quoteId, estCheckoutTimeMs, estFeeBreakdown, estInputUsd, estOutputUsd, estToTokenBaseUnit
- **Deposit** — Request: address (Polymarket wallet). Response: address { evm, svm, btc }
- **Withdraw** — Request: address, toChainId, toTokenAddress, recipientAddr. **Do not pre-generate**; generate when ready to execute
- **Status** — GET /status/{address}; status enum: DEPOSIT_DETECTED, PROCESSING, ORIGIN_TX_CONFIRMED, SUBMITTED, COMPLETED, FAILED

### CLOB Public Methods (No Auth)

Require host + chain ID only; no signer or user credentials. ClobClient(HOST, 137).

- **Markets** — getMarket(conditionId), getMarkets(), getSimplifiedMarkets()
- **Order books (REST)** — GET /book?token_id= (required), POST /books (body: BookRequest[] { token_id, side? }; max 500 items). OrderBookSummary: market, asset_id, timestamp, hash, bids (OrderLevel[]), asks (OrderLevel[]), min_order_size, tick_size, neg_risk. OrderLevel: price, size (strings)
- **Prices (REST)** — GET /price?token_id=&side= (BUY|SELL) → { price: string }; GET /prices; POST /prices (body: PriceRequest[] { token_id, side }; max 500) → Record<token_id, Record<side, price>>; GET /midpoint?token_id= → { mid: string }. POST /spreads (body: BookRequest[] { token_id, side? }; max 500) → Record<token_id, spread_string>. SDK: getPrice, getPrices, getMidpoint, getSpread
- **Price history (REST)** — GET /prices-history?market= (required; CLOB token ID), startTs, endTs, interval (1m|1w|1d|6h|1h|max; mutually exclusive with startTs/endTs), fidelity → { history: { t, p }[] }. SDK: getPricesHistory
- **Other** — getLastTradePrice(tokenID), getFeeRateBps, getTickSize, getNegRisk, getServerTime, getOk()

### WebSocket URLs

| Service | URL | Description |
|---------|-----|-------------|
| CLOB WS | `wss://ws-subscriptions-clob.polymarket.com/ws/` | Orderbook, price updates, order status |
| RTDS | `wss://ws-live-data.polymarket.com` | Crypto prices, comments (low-latency) |
| Sports | `wss://sports-api.polymarket.com/ws` | Real-time sports results (no auth) |

### CLOB WebSocket Subscription (WSS Overview)

- **Channels**: `market` (public), `user` (auth required, filtered by apikey)
- **Initial subscribe** fields: `auth`, `markets` (condition IDs for user), `assets_ids` (token IDs for market), `type` (USER or MARKET), `custom_feature_enabled`
- **Subscribe/unsubscribe** (after connect): `operation` ("subscribe"|"unsubscribe"), `assets_ids` or `markets`
- **Market channel** uses `assets_ids` (token IDs); **user channel** uses `markets` (condition IDs)
- **User channel Trade** — event_type "trade", type "TRADE"; status MATCHED/MINED/CONFIRMED/RETRYING/FAILED; asset_id, id, last_update, maker_orders, market, matchtime, outcome, owner, price, side, size, taker_order_id, trade_owner
- **User channel Order** — event_type "order"; type PLACEMENT/UPDATE/CANCELLATION; asset_id, associate_trades, id, market, order_owner, original_size, outcome, owner, price, side, size_matched
- **Market channel** — Public; subscribe "market". Events: book (bids/asks, asset_id, market, timestamp, hash), price_change (market, price_changes[], timestamp; schema change Sept 2025 — see migration guide), tick_size_change (old/new_tick_size, side), last_trade_price (asset_id, price, side, size, fee_rate_bps), best_bid_ask (best_bid, best_ask, spread; custom_feature_enabled), new_market, market_resolved (winning_asset_id, winning_outcome; custom_feature_enabled)
- **Sports WebSocket** — `wss://sports-api.polymarket.com/ws`; no auth; no subscription message; connect and receive. PING every 5s → client must PONG within 10s or connection closes. sport_result: gameId, leagueAbbreviation, homeTeam, awayTeam, status, live, ended, score, period, elapsed, finishedTimestamp?, turn? (NFL/CFB)

### RTDS Message Structure

```json
{ "topic": "string", "type": "string", "timestamp": number, "payload": object }
```

- **Topics**: `crypto_prices` (Binance), `crypto_prices_chainlink` (Chainlink), `comments`
- **Subscribe**: `{ "action": "subscribe", "subscriptions": [{ "topic", "type", "filters?", "gamma_auth?" }] }`
- **Ping/Pong**: Client sends PING every ~5s to maintain connection
- **Dynamic subscriptions**: Add/remove topics without disconnecting
- **gamma_auth**: `{ "address": "wallet" }` for user-specific streams (e.g. comments)
- **Crypto payload**: symbol (Binance: `solusdt`, Chainlink: `eth/usd`), timestamp, value
- **Comments payload**: body, createdAt, id, parentCommentID, parentEntityID, parentEntityType, profile (baseAddress, name, proxyWallet, pseudonym, displayUsernamePublic), reactionCount, replyAddress, reportCount, userAddress

### Gamma Structure

- **Market** = fundamental element; maps to clob token IDs, condition ID, question ID
- **Event** = set of markets. SMP = 1 market; GMP = 2+ markets
- **clobTokenIds** required for CLOB price/orderbook and WebSocket subscriptions

### Gamma Fetch Strategies

- **By Slug** (best for specific items): `GET /events/slug/{slug}`, `GET /markets/slug/{slug}`. Slug from URL path (e.g. polymarket.com/event/fed-decision-in-october → slug: fed-decision-in-october)
- **By Tags**: `GET /tags`, `GET /sports` for metadata; `tag_id`, `related_tags`, `exclude_tag_id` on events/markets
- **All active**: `/events` with `order=id`, `ascending=false`, `closed=false`, `limit`, `offset`; pagination via limit/offset
- **Best practice**: Use slug for individual; tag filtering for categories; `closed=false` unless historical; rate limiting

### Negative Risk

- `negRisk`, `enableNegRisk` on events; `negRiskAugmented` for augmented negative risk (placeholder outcomes)
- NegRisk requires `negRisk: true` in order params (and `tickSize`) when placing orders on multi-outcome events

### Order Placement & Auth (CLOB)

- **Allowances** — Funder must set USDC allowance (buy) or CT allowance (sell) for Exchange contract. Buy: USDC ≥ spending amount. Sell: CT ≥ selling amount
- **Validity** — maxOrderSize = underlyingAssetBalance − Σ(orderSize − orderFillAmount); only place orders summing ≤ available balance per market
- **User API credentials** — `createOrDeriveApiKey()` yields apiKey, secret, passphrase. Used to authenticate orders. **Never use Builder credentials in place of User credentials.**
- **Builder credentials** — Separate; used for order attribution (Builder Leaderboard), not user auth. Add via `BuilderConfig` as last param to ClobClient.
- **Signature type** — `0` = EOA, `1` = POLY_PROXY (Magic), `2` = POLY_GNOSIS_SAFE. EOA pays gas; gasless only with proxy + relayer
- **Order options** — `tickSize`, `negRisk` (from market) required; get market via `getMarket(tokenID)` before `createAndPostOrder`
- **Chain ID**: 137 (Polygon mainnet)
- **Setup** — `createOrDeriveApiKey()` before trading; ClobClient(signer, apiCreds, signatureType, funderAddress). L2_AUTH_NOT_AVAILABLE = missing API creds
- **L1 (Private Key)** — Signer required; no user API creds. Signs EIP-712. REST: POLY_ADDRESS, POLY_SIGNATURE, POLY_TIMESTAMP, POLY_NONCE. POST /auth/api-key (create), GET /auth/derive-api-key (derive). One active key per wallet; create invalidates previous
- **L1 API key methods** — createApiKey(nonce?), deriveApiKey(nonce?), createOrDeriveApiKey(nonce?) — recommended; returns { apiKey, secret, passphrase }
- **L1 order signing** — createOrder(UserOrder, { tickSize, negRisk? }), createMarketOrder(UserMarketOrder, options); sign locally; post via L2 postOrder/postOrders
- **L2 init** — signer, apiCreds, signatureType, funder required; ClobClient(HOST, 137, signer, apiCreds, sigType, funder)
- **Place (REST)** — POST /order (order, owner, orderType FOK|GTC|GTD, postOnly?); POST /orders (PostOrder[]; max 15). Order: salt, maker, signer, taker, tokenId, makerAmount, takerAmount, expiration, nonce, feeRateBps, side, signatureType, signature. postOnly: only GTC/GTD; cannot cross book. GTD: expiration has 1-min security threshold (e.g. 90s from now → now+1min+30s)
- **Order types** — FOK (fill-or-kill), FAK (fill-and-kill), GTC (good-til-cancelled), GTD (good-til-date)
- **L2 order flow** — createAndPostOrder, postOrder, postOrders (≤15). OrderResponse: success, errorMsg, orderId, orderHashes, status (matched|live|delayed|unmatched)
- **Get (REST)** — GET /data/order/<order_hash>; GET /data/orders (id?, market?, asset_id?). OpenOrder: associate_trades, id, status, market, original_size, outcome, maker_address, owner, price, side, size_matched, asset_id, expiration, type, created_at
- **Trades (REST)** — GET /data/trades (id?, taker?, maker?, market?, before?, after?). Trade: id, taker_order_id, market, asset_id, side, size, fee_rate_bps, price, status, match_time, last_update, outcome, maker_address, owner, transaction_hash, bucket_index, maker_orders[], type (TAKER|MAKER). MakerOrder: order_id, maker_address, owner, matched_amount, fee_rate_bps, price, asset_id, outcome, side. Statuses: MATCHED, MINED, CONFIRMED (terminal), RETRYING, FAILED (terminal). Gas split: reconcile by market_order_id + match_time + incrementing bucket_index
- **Cancel (REST)** — DELETE /order (orderID), DELETE /orders (orderIDs[]), DELETE /cancel-all, DELETE /cancel-market-orders (market?, asset_id?). Response: canceled[], not_canceled (order id → reason)
- **Scoring** — GET /order-scoring?order_id=, POST /orders-scoring (orderIds[]). Response: { scoring: boolean } or Record<orderId, boolean>
- **OrderFilled (onchain)** — orderHash, maker, taker, makerAssetId (0=BUY), takerAssetId (0=SELL), makerAmountFilled, takerAmountFilled, fee
- **Insert errors** — INVALID_ORDER_MIN_TICK_SIZE, MIN_SIZE, DUPLICATED, NOT_ENOUGH_BALANCE, EXPIRATION, INVALID_ORDER_ERROR; INVALID_POST_ONLY_ORDER_TYPE (market), INVALID_POST_ONLY_ORDER (crosses book); EXECUTION_ERROR, ORDER_DELAYED (success=no), DELAYING_ORDER_ERROR, FOK_ORDER_NOT_FILLED_ERROR, MARKET_NOT_READY
- **L2 (API Key)** — apiKey, secret, passphrase; HMAC-SHA256 for requests. REST: POLY_ADDRESS, POLY_SIGNATURE (HMAC), POLY_TIMESTAMP, POLY_API_KEY, POLY_PASSPHRASE. Order creation still requires user to sign order payload
- **Troubleshooting** — INVALID_SIGNATURE: wrong key; NONCE_ALREADY_USED: use deriveApiKey with same nonce; Invalid Funder: deploy proxy first if new user; insufficient balance/allowance; Geoblock

### Builder Program

- **Builder** — Platform that routes orders from users to Polymarket; uses Builder credentials for attribution, not user auth
- **Benefits** — Relayer (gasless), Order Attribution (Builder Leaderboard), Fee Share
- **Relayer** — Gasless for proxy/Safe wallets: deploy Safe, approvals, CTF split/merge/redeem, order execution. **EOA wallets do not have relayer access**; they pay their own gas
- **Order Attribution** — Builder headers on orders; Data API: aggregated leaderboard, daily volume time-series
- **Builder credentials** — key, secret, passphrase (BuilderApiKeyCreds); required for relayer + CLOB attribution. **Never expose in client-side code.** Obtained from Builder Profile → Builder Keys
- **Profile** — Builder Address, tier (Unverified/Verified); separate keys per environment
- **Signing** — **Remote (recommended)**: client → signing server (POST /sign with method, path, body) → server returns POLY_BUILDER_* headers; **Local**: SDK adds headers when BuilderConfig has localBuilderCreds
- **Headers** — POLY_BUILDER_API_KEY, POLY_BUILDER_TIMESTAMP, POLY_BUILDER_PASSPHRASE, POLY_BUILDER_SIGNATURE (HMAC of method, path, body)
- **Flow** — Builder credentials → BuilderConfig (remoteBuilderConfig or localBuilderCreds) → ClobClient as last param (after undefined, false)
- **Builder methods** — getBuilderTrades(params?): BuilderTradesPaginatedResponse { trades, next_cursor, limit, count }; revokeBuilderApiKey()

### Relayer Client

- **Endpoint** — `https://relayer-v2.polymarket.com/`; Builder auth required
- **Wallet types** — `RelayerTxType.SAFE` (explicit `deploy()` before first tx) vs `RelayerTxType.PROXY` (auto-deploy on first tx); both gasless
- **Usage** — `client.deploy()` for Safe; `client.execute([{ to, data, value }], description)` for batched txs
- **Signing** — Same remote/local BuilderConfig as Order Attribution; same POLY_BUILDER_* headers
- **Contracts** — USDCe `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`; CTF `0x4d97dcd97ec945f40cf65f87097ace5ea0476045`; CTF Exchange `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`; Neg Risk Adapter `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296`
- **States** — STATE_NEW → STATE_EXECUTED → STATE_MINED → STATE_CONFIRMED; STATE_FAILED/STATE_INVALID terminal

### Magic Link (Auth)

> Source: [docs.magic.link/llms.txt](https://docs.magic.link/llms.txt). Used for passwordless login before Polymarket trading.

- **Client SDK** — `magic-sdk`; Magic(apiKey, { network: { rpcUrl, chainId } }). Polygon: chainId 137, rpcUrl from NEXT_PUBLIC_POLYGON_RPC_URL (CSP must allow in Magic Dashboard)
- **Login** — `loginWithEmailOTP({ email, showUI?, deviceCheckUI? })` → DID token; `connectWithUI()` → accounts[]; OAuth via MagicWidget/WalletKit → getRedirectResult or LoginResult (magic.idToken, method: email|oauth|wallet)
- **User info** — `getInfo()`: SDK v30+ uses `wallets.ethereum.publicAddress` (no top-level publicAddress); wallets.[chainName].publicAddress, subAccounts[]. **Breaking**: v30 removed publicAddress from root
- **Tokens** — `getIdToken(lifespan?)` → DID token for server validation; lifespan default 900s
- **Logout** — `magic.user.logout()`
- **Admin SDK** — `@magic-sdk/admin`; Magic.init(secretKey). token.validate(didToken), token.getIssuer(didToken), token.getPublicAddress(didToken); users.getMetadataByToken(didToken) → issuer, publicAddress, email, phoneNumber, oauthProvider, wallets
- **Validation errors** — MalformedTokenError, TokenExpired, IncorrectSignerAddress, TokenCannotBeUsedYet
- **RPC errors** — UserAlreadyLoggedIn, MagicLinkExpired, AccessDeniedToUser, UpdateEmailFailed; use RPCError/RPCErrorCode for client handling
- **EVM signing** — eth_signTypedData_v4 for EIP-712 (CLOB orders); personal_sign, eth_sendTransaction; provider via magic.rpcProvider

## Steps

1. **Identify scope**
   - Note which API layer(s) changed: Gamma, Data, CLOB, Bridge, **WebSockets**, **RTDS**, **Magic/auth**
   - List affected schemas, client functions, router procedures, WS/RTDS clients, and auth flows

2. **Trace the data flow**
   - **REST**: Router input → Client params (snake_case for API, camelCase in input)
   - **REST**: Client response → Schema validation → Return type
   - **WebSocket**: Raw message → Zod schema (`schemas.ts`) → `@doji/types` event types → handlers
   - **RTDS**: Raw message → topic/type filters → payload types (CommentPayload, CryptoPricePayload) → hooks/components

3. **Cross-check each layer**
   - Schemas match OpenAPI / Polymarket docs
   - Client param interfaces include all router-input params
   - Router passes every param through to the client (no drops)
   - Types in `packages/types` align with schema shapes where used
   - **WebSocket**: `schemas.ts` Zod schemas match `packages/types/websocket.ts` interfaces
   - **RTDS**: CommentPayload, CryptoPricePayload, RtdsEvent types align with Polymarket RTDS docs

4. **Verify exports**
   - `schemas/index.ts` exports all schemas and Validated types used elsewhere
   - No orphan schemas or missing exports

5. **Post-audit todo**
   - Update any out-of-date **AGENTS.md** files in touched apps/packages (routers, lib, websocket, magic, etc.)
   - Add proper **docs/comments** to audited files: JSDoc for exported functions, `@see` links to API docs, inline comments for non-obvious logic

## Alignment Checklist

### Schemas (`apps/server/src/lib/polymarket/schemas/`)

- [ ] **gamma.ts** — EventSchema (id, slug, title, markets, negRisk; key fields per Gamma OpenAPI), MarketSchema (id, question, conditionId, slug, clobTokenIds, …), TagSchema (id, label, slug, forceShow, …), SeriesSchema (id, ticker, slug, title, seriesType, recurrence, …), CommentSchema (id, body, parentEntityType, parentEntityID, parentCommentID, userAddress, replyAddress, profile, reactions, reportCount, reactionCount; CommentProfile: name, pseudonym, proxyWallet, baseAddress, …; Reaction, CommentPosition), PublicProfileSchema (createdAt, proxyWallet, profileImage, displayUsernamePublic, bio, pseudonym, name, users[], xUsername, verifiedBadge; PublicProfileUser: id, creator, mod), SearchSchema (events[], tags[], profiles[], pagination: { hasMore, totalResults }; SearchTag: id, label, slug, event_count), SearchResultSchema, TeamSchema, SportMetadataItemSchema, SportsMarketTypesResponseSchema, RelatedTagSchema (id, tagID, relatedTagID, rank), EventSportsMetadataSchema use `.loose()` (not deprecated `.passthrough()`)
- [ ] **gamma.ts** — All schema fields match Gamma OpenAPI for the endpoints they validate; events support `active`, `closed`, `tag_id`, `series_id`, `order`, `ascending` per fetch guide; TeamSchema (id, name, league, record, logo, abbreviation, alias, createdAt, updatedAt); SportsMetadataSchema (sport, image, resolution, ordering, tags, series); SportsMarketTypesResponseSchema ({ marketTypes: string[] })
- [ ] **data.ts** — PositionSchema (proxyWallet, asset, conditionId, size, avgPrice, initialValue, currentValue, cashPnl, percentPnl, redeemable, mergeable, title, slug, outcome, outcomeIndex, oppositeOutcome, oppositeAsset, endDate, negativeRisk, etc.), TradeSchema (proxyWallet, side, asset, conditionId, size, price, timestamp, title, slug, outcome, outcomeIndex, transactionHash), ActivitySchema (proxyWallet, timestamp, conditionId, type TRADE|SPLIT|MERGE|REDEEM|REWARD|CONVERSION|MAKER_REBATE, size, usdcSize, price, asset, side, outcomeIndex), ClosedPositionSchema (proxyWallet, asset, conditionId, avgPrice, totalBought, realizedPnl, curPrice, timestamp), TradedSchema ({ user, traded }), ValueSchema ({ user, value }), OpenInterestSchema ({ market, value }), LiveVolumeSchema ({ total, markets: [{ market, value }] }), HolderSchema, LeaderboardEntrySchema align with Data API OpenAPI
- [ ] **clob.ts** — OrderBookSnapshotSchema includes market, asset_id, timestamp, hash, bids, asks, min_order_size, tick_size, neg_risk; OrderLevel { price, size } (strings); POST /books max 500; PriceHistoryPointSchema { t, p }; OrderResponse has takingAmount, makingAmount; CancelOrdersResponse.not_canceled typed as Record<string, string>; OpenOrder/Trade include owner, maker_address, associate_trades, taker_order_id, maker_orders per L2 Methods; getTrades params (id?, taker?, maker?, market?, before?, after?); TradeSchema has id, taker_order_id, market, asset_id, side, size, fee_rate_bps, price, status, match_time, last_update, outcome, maker_address, owner, transaction_hash, bucket_index, maker_orders (MakerOrder[]), type; status MATCHED/MINED/CONFIRMED/RETRYING/FAILED
- [ ] **bridge.ts** — SupportedAssetSchema uses minCheckoutUsd (not minDeposit); QuoteSchema, DepositResponse (evm, svm, btc), WithdrawalRequest, TransactionStatus (enum) match Bridge OpenAPI
- [ ] **index.ts** — All schemas and Validated* types exported and used

### Client Params (`apps/server/src/lib/polymarket/`)

- [ ] **gamma.ts** — Uses GET /events/slug/{slug}, GET /markets/slug/{slug} for single items (not filtering list); EventParams has id[], tag_id, exclude_tag_id[], slug[], tag_slug, related_tags, active, archived, featured, cyom, include_chat, include_template, recurrence, closed, liquidity_min/max, volume_min/max, start_date_min/max, end_date_min/max, limit, offset, order, ascending; events.list, events.getById, events.getBySlug, events.getTags per Gamma OpenAPI; TagParams has limit, offset, order, ascending, include_template, is_carousel; tags.list, tags.getById, tags.getBySlug, tags.getRelatedTagsById, tags.getRelatedTagsBySlug, tags.getRelatedTagsTagsById, tags.getRelatedTagsTagsBySlug
- [ ] **gamma.ts** — MarketParams has all params used by markets.list: id[], slug[], clob_token_ids[], condition_ids[], market_maker_address[]; liquidity_num_min/max, volume_num_min/max, start_date_min/max, end_date_min/max; tag_id, related_tags, cyom, uma_resolution_status, game_id, sports_market_types[], rewards_min_size, question_ids[], include_tag, closed; limit, offset, order, ascending; markets.list, markets.getById, markets.getBySlug, markets.getTags per Gamma OpenAPI
- [ ] **gamma.ts** — SeriesParams (limit, offset, order, ascending, slug[], categories_ids[], categories_labels[], closed, include_chat, recurrence); series.list, series.getById; CommentParams (limit, offset, order, ascending, parent_entity_type: Event|Series|market, parent_entity_id, get_positions, holders_only); comments.list, comments.getById, comments.getByUserAddress; getPublicProfile uses GET /public-profile?address= (query param, not path; address 0x-prefixed 40 hex); publicSearch uses GET /public-search?q= (required; cache, events_status, limit_per_type, page, events_tag[], keep_closed_markets, sort, ascending, search_tags, search_profiles, recurrence, exclude_tag_id[], optimized) per Gamma OpenAPI; TagParams, TeamParams match router procedure inputs
- [ ] **data.ts** — Endpoints: GET / (health), GET /positions?user= (market/eventId mutually exclusive; limit 500, offset 10000; sizeThreshold, redeemable, mergeable, sortBy, sortDirection, title), GET /trades (user, market, eventId; limit 10000, offset 10000; takerOnly, filterType, filterAmount, side), GET /activity?user= (limit 500, offset 10000; market, eventId, type[], start, end, sortBy, sortDirection, side), GET /closed-positions?user= (market, eventId, title; limit 50, offset 100000; sortBy, sortDirection), GET /value?user=, GET /traded?user=, GET /oi?market= (use /oi not /open-interest), GET /live-volume?id=, GET /holders?market= (limit 20, minBalance), GET /v1/accounting/snapshot?user= (ZIP), GET /v1/leaderboard (category, timePeriod, orderBy, limit 50), GET /v1/builders/leaderboard, GET /v1/builders/volume; client params match router inputs
- [ ] **bridge.ts** — createDepositAddresses, createWithdrawalAddresses, getQuote params match bridge router inputs
- [ ] All client functions validate responses with the correct schema before returning

### Routers (`apps/server/src/routers/`)

- [ ] **events.ts** — eventListInput keys map 1:1 to EventParams (snake_case for API: id, tag_id, exclude_tag_id, slug, tag_slug, related_tags, active, archived, featured, cyom, include_chat, include_template, recurrence, closed, liquidity_min/max, volume_min/max, start_date_min/max, end_date_min/max, limit, offset, order, ascending); eventById, eventBySlug, eventTags procedures use correct paths
- [ ] **events.ts** — tags, series, teams, comments procedures accept and pass through full param sets; seriesListInput keys map 1:1 to SeriesParams; commentListInput keys map 1:1 to CommentParams (parent_entity_type, parent_entity_id, get_positions, holders_only, limit, offset, order, ascending); commentById, commentsByUserAddress procedures use correct paths
- [ ] **markets.ts** — marketListInput keys map 1:1 to MarketParams (snake_case for API: id, slug, clob_token_ids, condition_ids, market_maker_address, liquidity_num_min/max, volume_num_min/max, start_date_min/max, end_date_min/max, tag_id, related_tags, cyom, uma_resolution_status, game_id, sports_market_types, rewards_min_size, question_ids, include_tag, closed, limit, offset, order, ascending); marketById, marketBySlug, marketTags procedures use correct paths
- [ ] **data.ts** — Each procedure input matches the corresponding client function params
- [ ] **clob.ts** — Price history params: market (required), startTs, endTs, interval (1m|1w|1d|6h|1h|max; mutually exclusive with startTs/endTs), fidelity; response { history: { t, p }[] }; order book, price, midpoint params match clob-read / ClobClient
- [ ] **bridge.ts** — Mutation/query inputs match bridge client
- [ ] No router drops params; all optional params forwarded when provided

### Types (`packages/types/`)

- [ ] **gamma/** — GammaEvent, GammaMarket, GammaTag, GammaSeries, SportsMetadata align with schema shapes used by gamma client
- [ ] **data/** — DataPosition, DataClosedPosition, DataTrade align with Data API schemas (or schema-inferred types used where appropriate)
- [ ] **trade.ts** — Position, ClosedPosition, Trade used by data client are compatible with validated response shapes
- [ ] **websocket.ts** — BookEvent, LastTradePriceEvent, BestBidAskEvent, PriceChangeEvent, TickSizeChangeEvent, NewMarketEvent, MarketResolvedEvent, UserTradeEvent, UserOrderEvent align with CLOB WebSocket docs; RTDS types (CommentPayload, CryptoPricePayload) live in `rtds.ts` or are re-exported
- [ ] No type assertions that hide mismatches (e.g. casting Data API response to CLOB Trade)

### Cross-Layer

- [ ] Router procedure → client call: input object passed as `input ?? undefined` or mapped explicitly
- [ ] Client → schema: every fetch/response validated with the schema before casting
- [ ] Schema → type: Validated* types exported; @doji/types used for public APIs where applicable
- [ ] JSDoc / @see links present on routers, schemas, and client functions for API docs

### WebSockets (`apps/web/src/lib/websocket/`)

- [ ] **market-channel.ts** — Subscribes to CLOB market channel; handles book (bids/asks), price_change, last_trade_price, best_bid_ask (spread; custom_feature_enabled), tick_size_change, new_market, market_resolved (winning_asset_id, winning_outcome); price_change schema migration Sept 2025 if applicable
- [ ] **schemas.ts** — `MarketChannelMessageSchema` (discriminated union) matches all event types in `MARKET_EVENT_TYPES`; `safeParseMarketChannelMessage` used before dispatching to handlers
- [ ] **schemas vs types** — Zod schemas in `schemas.ts` align with `@doji/types` interfaces (`BookEvent`, `LastTradePriceEvent`, `BestBidAskEvent`, `PriceChangeEvent`, `TickSizeChangeEvent`, `NewMarketEvent`, `MarketResolvedEvent`)
- [ ] **user-channel.ts** — Handles `UserOrderEvent` (type PLACEMENT/UPDATE/CANCELLATION) and `UserTradeEvent` (type TRADE, status MATCHED/MINED/CONFIRMED/RETRYING/FAILED); types include associate_trades, owner, maker_orders, taker_order_id, matchtime per User Channel docs
- [ ] **manager.ts** — WebSocketManager supports `channel: "market" | "user"`; initial subscribe includes `type` (USER/MARKET), `assets_ids` (market) or `markets` (user), `custom_feature_enabled`; subscribe/unsubscribe uses `operation` field per WSS docs
- [ ] **subscription-registry.ts** — Asset subscription ref-counting aligns with market-channel subscribe/unsubscribe; no duplicate subscriptions for same asset
- [ ] **orderbook integration** — `use-orderbook.ts` subscribes to market channel; orderbook Zustand store receives book events; `last_trade_price` used by charts/datafeed
- [ ] **sports-channel.ts** (if present) — Uses `NEXT_PUBLIC_WS_SPORTS_URL` (wss://sports-api.polymarket.com/ws); responds to PING with PONG within 10s; handler types include gameId, score, period, live, ended; no subscription message required

### RTDS (Real-Time Data Service, `apps/web/src/lib/websocket/rtds.ts`)

- [ ] **RTDS client** — Connects to `NEXT_PUBLIC_RTDS_URL` (wss://ws-live-data.polymarket.com); supports dynamic topic subscribe/unsubscribe
- [ ] **Topics** — `comments`, `crypto_prices`, `crypto_prices_chainlink` supported; subscription filters (e.g. parentEntityID, parentEntityType) match Polymarket docs
- [ ] **CommentPayload** — body, createdAt, id, parentCommentID, parentEntityID, parentEntityType, profile (baseAddress, name, proxyWallet, pseudonym), reactionCount, replyAddress, reportCount, userAddress per RTDS Comments
- [ ] **CryptoPricePayload** — symbol (Binance: solusdt; Chainlink: eth/usd), timestamp, value per RTDS Crypto Prices
- [ ] **Event types** — `comment_created`, `comment_removed`, `reaction_created`, `reaction_removed` for comments; `update` for crypto prices
- [ ] **useComments** — Fetches initial via Gamma API; subscribes to RTDS for comment_created/comment_removed; `comments-utils.ts` `rtdsToComment` conversion preserves needed fields
- [ ] **crypto-prices.ts** — Subscribes to RTDS crypto_prices; payload shape compatible with component expectations
- [ ] **Reconnection** — RTDS re-subscribes to all topics on reconnect; handler registration/cleanup correct in hooks
- [ ] **Ping/Pong** — RTDS sends PING periodically (~5s) to maintain connection per Polymarket docs

### Env & Config (`packages/env/`, `turbo.json`, `.env.example`)

- [ ] **packages/env/src/server.ts** — GAMMA_API_URL, DATA_API_URL, BRIDGE_API_URL, CLOB_API_URL defined and used by clients
- [ ] **packages/env/src/web.ts** — NEXT_PUBLIC_WS_MARKET_URL, NEXT_PUBLIC_WS_USER_URL, NEXT_PUBLIC_RTDS_URL, NEXT_PUBLIC_WS_SPORTS_URL defined with defaults
- [ ] **apps/server/.env.example** — All Polymarket API URLs documented
- [ ] **apps/web/.env.example** — NEXT_PUBLIC_WS_MARKET_URL, NEXT_PUBLIC_WS_USER_URL, NEXT_PUBLIC_RTDS_URL (and optional NEXT_PUBLIC_WS_SPORTS_URL) documented
- [ ] **turbo.json** — `globalEnv` or `env` passthrough includes GAMMA_API_URL, DATA_API_URL, BRIDGE_API_URL, CLOB_API_URL for server build; Web/RTDS vars for web build as needed
- [ ] **packages/env/AGENTS.md** — Documents required vs optional vars (including WS/RTDS)

### Error Handling (`apps/server/src/lib/map-api-error.ts`)

- [ ] **events, markets, data, bridge routers** — Every procedure that calls gamma/data/bridge client wraps body in `withPolymarketError()`
- [ ] **clob router** — Protected procedures use `handleClobProcedureError`; public CLOB procedures use ClobClient (different error path)
- [ ] No procedure calling Polymarket APIs returns raw errors without mapping to TRPCError

### Rate Limiting (`apps/server/src/lib/rate-limit-config.ts`, `rate-limiter.ts`)

- [ ] **SOURCE_TO_FAMILY** — Keys (gamma, data, clob, bridge) match `source` in `createResilientFetch({ source })`
- [ ] **RATE_LIMIT_CONFIG** — Endpoint paths match API paths: data `/`, `/positions`, `/trades`, `/activity`, `/closed-positions`, `/value`, `/traded`, `/oi`, `/live-volume`, `/holders`, `/v1/accounting/snapshot`, `/v1/leaderboard`, `/v1/builders/leaderboard`, `/v1/builders/volume`; gamma `/status`, `/events`, `/markets`, `/tags`, `/series`, `/sports`, `/sports/market-types`, `/teams`, `/comments`, `/public-profile`, `/public-search`; clob `/book`, `/books`, `/price`, `/prices`, `/midpoint`, `/spreads`, `/prices-history`, `/order`, `/orders`, `/data/order`, `/data/orders`, `/data/trades`, `/order-scoring`, `/orders-scoring`, `/cancel-all`, `/cancel-market-orders`
- [ ] **resilient-fetch** — Uses rate limiter; path extraction aligns with config keys

### Trading / Order Placement (CLOB)

- [ ] **User vs Builder credentials** — Order placement uses User API credentials (from `createOrDeriveApiKey`); Builder credentials used only for attribution, never as substitute for user auth
- [ ] **L2 auth flow** — `createOrDeriveApiKey()` called before trading; ClobClient initialized with apiCreds to avoid L2_AUTH_NOT_AVAILABLE
- [ ] **L1/L2 alignment** — EIP-712 domain ClobAuthDomain v1 chainId 137; derive uses GET (not POST); L2 HMAC-SHA256 per CLOB auth docs
- [ ] **Signature type & funder** — ClobClient/order flow uses correct sig type (0=EOA, 1=POLY_PROXY, 2=GNOSIS_SAFE) and funder address (EOA=wallet, proxy=proxy wallet)
- [ ] **Order options** — `tickSize` and `negRisk` passed from market to `createAndPostOrder`; market fetched before placement when needed
- [ ] **Allowances & validity** — Funder sets USDC allowance (buy) or CT allowance (sell) before placing; maxOrderSize = balance − Σ(orderSize − orderFillAmount)
- [ ] **Order types & postOnly** — FOK/FAK/GTC/GTD; postOnly only with GTC/GTD, cannot cross book; GTD expiration = now + 1min + desired offset (security threshold)
- [ ] **Batch limit** — `postOrders` / POST `/orders` max 15 orders per request
- [ ] **Insert errors & status** — Handle errorMsg (INVALID_ORDER_*, EXECUTION_ERROR, FOK_ORDER_NOT_FILLED_ERROR, etc.); status: matched, live, delayed, unmatched
- [ ] **Cancel response** — canceled[], not_canceled (order id → reason); per-order failures surfaced for partial success
- [ ] **Chain ID** — 137 (Polygon) used consistently for CLOB
- [ ] **Credentials storage** — User credentials stored server-side; never exposed to client
- [ ] **Relayer vs EOA** — Gasless relayer used for proxy/Safe wallets (sig type 1/2); EOA (0) pays own gas; onboarding/deployment flow uses relayer when applicable
- [ ] **Builder attribution** — BuilderConfig/Builder headers attached for leaderboard credit; builder credentials from env, not user creds
- [ ] **Builder env vars** — POLYMARKET_BUILDER_ID, POLYMARKET_BUILDER_SIGNING_KEY, POLYMARKET_BUILDER_PASSPHRASE in server env; separate keys for dev vs prod; never exposed to client
- [ ] **Order attribution signing** — Remote: signing server receives method/path/body, returns POLY_BUILDER_* headers; Local: localBuilderCreds passed to BuilderConfig. Client never receives builder secret
- [ ] **Builder headers** — POLY_BUILDER_API_KEY, POLY_BUILDER_TIMESTAMP, POLY_BUILDER_PASSPHRASE, POLY_BUILDER_SIGNATURE attached to CLOB order requests per Order Attribution docs

### Magic Link / Auth

- [ ] **Client init** — Magic(publishableKey, { network: { rpcUrl, chainId: 137 } }); CSP in Magic Dashboard includes RPC URL
- [ ] **getInfo wallet address** — Uses `userInfo.wallets?.ethereum?.publicAddress` (SDK v30+); no reliance on deprecated root publicAddress
- [ ] **DID token flow** — loginWithEmailOTP / WalletKit yields DID token; passed to auth.login; server validates before session creation
- [ ] **Admin validation** — token.validate(didToken) before trusting; handle MalformedTokenError, TokenExpired, IncorrectSignerAddress
- [ ] **Logout** — Client calls magic.user.logout(); server logout best-effort; wallet store cleared

### Relayer / Safe Deployment

- [ ] **Relayer URL** — Uses `https://relayer-v2.polymarket.com/` (or env override); CHAIN_ID 137
- [ ] **Wallet type** — RelayClient configured with RelayerTxType.SAFE or PROXY per use case; Safe requires `deploy()` before first transaction
- [ ] **BuilderConfig** — RelayClient uses same remote/local BuilderConfig pattern as CLOB; builder credentials never on client
- [ ] **Deploy flow** — Onboarding/deploy-safe calls `client.deploy()`; waits for result (proxyAddress); registers Safe address with server

### Frontend Consumers (`apps/web/`)

- [ ] **Router namespace** — `events.publicProfile` not `markets.publicProfile`; `events.getCommentEntity` for comment entity
- [ ] **Input shapes** — `trpc.data.positions.queryOptions({ user })` etc. match router input schemas
- [ ] **Commented/dead code** — Profile page etc. use correct router when re-enabled
- [ ] **WebSocket consumers** — use-orderbook.ts, polymarket-datafeed, time-series-chart, live-volume use market-channel; use-comments uses RTDS; user-channel used for authenticated order/trade updates
- [ ] **RTDS consumers** — useComments (comments), crypto-prices (crypto feed); comments-utils `rtdsToComment` and `buildRtdsCommentFilter` used correctly

### Infrastructure & Cross-cutting

- [ ] **routes/polymarket/sign** — Builder remote signing; method, path, body → POLY_BUILDER_* headers; auth when POLYMARKET_SIGN_TOKENS set
- [ ] **packages/api** — clob-factory creates ClobClient with decrypted creds; auth middleware extracts session from Authorization header
- [ ] **packages/env** — API URLs (GAMMA_API_URL, DATA_API_URL, CLOB_API_URL, BRIDGE_API_URL) match client usage; CHAIN_ID 137
- [ ] **packages/db** — User/session schema supports auth flow; credential encryption uses CREDENTIAL_ENCRYPTION_KEY

### AGENTS.md & Docs

- [ ] **OpenAPI** — `apps/server/src/routers/openapi.ts` introspects tRPC appRouter; stays in sync when routers change
- [ ] **apps/server/src/routers/AGENTS.md** — Procedure list and examples reflect current router structure
- [ ] **apps/server/src/lib/polymarket/AGENTS.md** — Client usage, imports, env vars up to date
- [ ] **root AGENTS.md** — Polymarket glossary and routes accurate
- [ ] **AGENTS.md updates** — When auditing, update any out-of-date AGENTS.md in touched apps/packages (lib, routers, websocket, magic, trading, etc.)
- [ ] **Docs/comments** — Audited files have JSDoc on exported functions, `@see` links to API docs, inline comments for non-obvious logic

## Quick Verification Commands

```bash
# Type-check all packages
pnpm check-types

# Search for param mismatches (e.g. router has param client doesn't)
rg "tag_id|related_tags|exclude_tag_id" apps/server/src/lib/polymarket/gamma.ts
rg "tag_id|related_tags|exclude_tag_id" apps/server/src/routers/markets.ts

# Ensure no deprecated passthrough
rg "\.passthrough\(\)" apps/server/

# Env vars used by clients
rg "GAMMA_API_URL|DATA_API_URL|BRIDGE_API_URL|CLOB_API_URL" packages/env apps/server/src/lib/polymarket/

# WebSocket & RTDS env vars
rg "NEXT_PUBLIC_WS_MARKET_URL|NEXT_PUBLIC_WS_USER_URL|NEXT_PUBLIC_RTDS_URL|NEXT_PUBLIC_WS_SPORTS_URL" packages/env apps/web/

# Error wrapping
rg "withPolymarketError|handleClobProcedureError" apps/server/src/routers/

# Rate limit config vs resilient-fetch source
rg "SOURCE_TO_FAMILY|createResilientFetch" apps/server/src/lib/
rg "source:" apps/server/src/lib/polymarket/

# Builder signing route
rg "POLY_BUILDER|sign" apps/server/src/routes/

# CLOB factory + auth
rg "createClobClient|createContext" packages/api/src/

# Frontend tRPC usage
rg "trpc\.(events|markets|data|clob|bridge)\." apps/web/

# WebSocket and RTDS usage
rg "marketChannel|rtdsClient|userChannel" apps/web/
rg "MARKET_EVENT_TYPES|event_type" apps/web/src/lib/websocket/
rg "safeParseMarketChannelMessage" apps/web/
rg "comment_created|comment_removed|crypto_prices" apps/web/
rg "RtdsSubscription|RtdsEvent" apps/web/
```

## Related

- [How to Fetch Markets](https://docs.polymarket.com/developers/gamma-markets-api/fetch-markets-guide) — By slug (/events/slug/{slug}, /markets/slug/{slug}); by tags; pagination (limit, offset); closed=false
- [Polymarket docs (LLMs)](https://docs.polymarket.com/llms.txt) — API contracts including WebSocket and RTDS
- [Data API (OpenAPI)](https://docs.polymarket.com/developers/data-api) — REST endpoints for positions, trades, activity, closed-positions, value, traded, oi, live-volume, holders, accounting snapshot, leaderboard
- [Placing Your First Order](https://docs.polymarket.com/quickstart/first-order) — Order placement, signature types, User vs Builder credentials
- [CLOB Quickstart](https://docs.polymarket.com/quickstart) — Setup flow, createOrDeriveApiKey, signature types, L2_AUTH_NOT_AVAILABLE, balance/allowance troubleshooting
- [CLOB Authentication](https://docs.polymarket.com/developers/CLOB/authentication) — L1 vs L2, EIP-712 domain, REST headers, derive vs create, INVALID_SIGNATURE/NONCE_ALREADY_USED
- [CLOB Public Methods](https://docs.polymarket.com/developers/CLOB/clients/methods-public) — No-auth methods, OrderBookSummary, getPricesHistory params, Market response shape
- [CLOB L1 Methods](https://docs.polymarket.com/developers/CLOB/clients/methods-l1) — createApiKey, deriveApiKey, createOrDeriveApiKey; createOrder/createMarketOrder (sign locally, post via L2)
- [CLOB L2 Methods](https://docs.polymarket.com/developers/CLOB/clients/methods-l2) — createAndPostOrder, postOrder, postOrders (≤15); cancelOrder, cancelMarketOrders; OrderResponse, OpenOrder, Trade, CancelOrdersResponse shapes
- [Market Channel](https://docs.polymarket.com/developers/CLOB/websocket/market-channel) — book, price_change, tick_size_change, last_trade_price, best_bid_ask, new_market, market_resolved; [price_change migration](https://docs.polymarket.com/developers/CLOB/websocket/market-channel-migration-guide) Sept 2025
- [Sports WebSocket](https://docs.polymarket.com/developers/sports-websocket/overview) — sport_result messages; PING/PONG (5s/10s); no subscription; gameId, score, period, live, ended
- [RTDS Crypto Prices](https://docs.polymarket.com/developers/RTDS/RTDS-crypto-prices) — crypto_prices (Binance), crypto_prices_chainlink; symbol formats; payload symbol, timestamp, value
- [RTDS Comments](https://docs.polymarket.com/developers/RTDS/RTDS-comments) — comment_created, comment_removed, reaction_created, reaction_removed; payload fields; parentEntityID, parentEntityType
- [Builder Program Introduction](https://docs.polymarket.com/developers/builders/builder-intro) — Relayer, order attribution, fee share; EOA vs proxy gas
- [Builder Profile & Keys](https://docs.polymarket.com/developers/builders/builder-profile) — Obtain credentials; tier (Unverified/Verified); separate keys per env
- [Order Attribution](https://docs.polymarket.com/developers/builders/order-attribution) — Remote vs local signing; POLY_BUILDER_* headers; BuilderConfig (remoteBuilderConfig, localBuilderCreds)
- [CLOB Builder Methods](https://docs.polymarket.com/developers/CLOB/clients/methods-builder) — getBuilderTrades, revokeBuilderApiKey; BuilderConfig as ClobClient last param
- [Relayer Client](https://docs.polymarket.com/developers/builders/relayer-client) — Gasless deploy/execute; SAFE vs PROXY; relayer-v2 endpoint; contract addresses
- [Magic docs (LLMs)](https://docs.magic.link/llms.txt) — Embedded wallets, loginWithEmailOTP, getInfo (wallets.ethereum.publicAddress in v30), Admin SDK validate/getMetadataByToken, RPC/SDK errors
- `apps/server/src/lib/polymarket/AGENTS.md` — Polymarket lib overview
- `apps/server/src/routers/AGENTS.md` — Router structure
- `apps/web/src/lib/websocket/AGENTS.md` — WebSocket and RTDS client overview
- `.kiro/specs/polymarket-api-audit/requirements.md` — Requirement 6 (WebSocket schema alignment)
