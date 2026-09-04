# Implementation Plan: Polymarket Trading Terminal

## Overview

Incremental implementation of the Polymarket Trading Terminal using the Better-T-Stack scaffold (Next.js + Hono + Postgres + Drizzle + tRPC + Turborepo). Tasks build on each other, starting with project scaffolding and core infrastructure, then layering in API integration, real-time WebSocket features, trading UI, and differentiating features.

## Tasks

- [x] 1. Scaffold project and configure core infrastructure
  - [x] 1.1 Run Better-T-Stack CLI to scaffold the monorepo
    - Execute: `npx create-better-t-stack@latest polymarket-terminal --frontend next --backend hono --runtime node --database postgres --orm drizzle --api trpc --auth none --addons turborepo biome ultracite skills --examples none --package-manager pnpm --db-setup none`
    - Verify the generated structure: `apps/web`, `apps/server`, `packages/api`, `packages/db`, `packages/config`, `packages/env`
    - Ensure `.env` and `.env.local` are in `.gitignore` (Better-T-Stack may scaffold this; verify and add if missing)
    - _Requirements: All_

  - [x] 1.2 Install additional dependencies
    - In `apps/web`: `wagmi`, `viem`, `@tanstack/react-query`, `zustand`, `lightweight-charts`, `sonner`
    - In `apps/web` (devDeps): `fast-check`, `@testing-library/react`, `@testing-library/dom`, `vitest`, `@vitejs/plugin-react`, `vite-tsconfig-paths`, `jsdom`
    - In `apps/server`: `@polymarket/clob-client`, `ethers@5`
    - _Requirements: All_

  - [x] 1.3 Define shared TypeScript types in packages/types
    - Create `packages/types/` package with its own `package.json` and `tsconfig.json`
    - Add `packages/types` to `pnpm-workspace.yaml` workspace entries
    - Create `packages/types/market.ts` with `Market`, `MarketToken`, `Event`, `Tag`, `Series`, `SportsMetadata` interfaces (including `neg_risk`, `neg_risk_market_id`, `order_price_min_tick_size`, `rewards` fields)
    - Create `packages/types/order.ts` with `SignedOrder`, `OpenOrder`, `OrderResponse`, `OrderFormState`, `UserOrder`, `UserMarketOrder` interfaces
    - Create `packages/types/trade.ts` with `Trade`, `Position`, `ClosedPosition`, `MakerOrder` interfaces
    - Create `packages/types/websocket.ts` with `BookEvent`, `PriceChangeEvent`, `LastTradePriceEvent`, `BestBidAskEvent`, `UserTradeEvent`, `UserOrderEvent` interfaces
    - All types should match the Polymarket API response shapes documented in the design document data models section
    - Add `packages/types` to Turborepo pipeline and workspace references
    - _Requirements: 1.4, 2.1, 3.1, 4.2, 5.1, 17.1_

  - [x] 1.4 Configure environment variables
    - Configure `packages/env` using the scaffolded T3 Env + Zod pattern
    - `packages/env/src/web.ts`: Use `@t3-oss/env-nextjs` with `experimental__runtimeEnv` for client vars: `NEXT_PUBLIC_CLOB_API_URL`, `NEXT_PUBLIC_WS_MARKET_URL`, `NEXT_PUBLIC_WS_USER_URL`, `NEXT_PUBLIC_RTDS_URL`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_CHAIN_ID`
    - `packages/env/src/server.ts`: Use `@t3-oss/env-core` with `runtimeEnv: process.env` for server vars: `GAMMA_API_URL`, `DATA_API_URL`, `BRIDGE_API_URL`, `CLOB_API_URL`, `DATABASE_URL`, `PORT`
    - Set `emptyStringAsUndefined: true` in both files to handle empty `.env` values
    - Create `.env.example` at repo root with all variables documented (no real secrets)
    - _Requirements: All (infrastructure)_

  - [x] 1.5 Create placeholder database schema and local dev setup
    - Create minimal Drizzle schema in `packages/db` with a placeholder `users` table (id, address, created_at)
    - This ensures the db package builds. Full schema is Phase 2 (copy trading, preferences, referrals).
    - Local Postgres: use Neon (or any Postgres) via `DATABASE_URL` in `apps/server/.env` — repo does not ship `docker-compose.yml`
    - _Requirements: All (build infrastructure)_

  - [x] 1.6 Configure Vitest for the web app
    - Add `vitest.config.mts` in `apps/web`: use `@vitejs/plugin-react` for JSX transform, `vite-tsconfig-paths` for path aliases, `jsdom` environment
    - Add test scripts to `apps/web/package.json`: `"test": "vitest"`, `"test:run": "vitest run"`
    - _Requirements: All (testing infrastructure)_

  - [x] 1.7 Configure next.config.ts
    - Add `transpilePackages` for monorepo packages (`@poly/types`, `@poly/api`, `@poly/env`)
    - Add `images.remotePatterns` for Polymarket CDN domains (polymarket-upload.s3.us-east-2.amazonaws.com)
    - Import `packages/env/src/web` at the top of `next.config.ts` for build-time env validation — missing variables will fail the build, not runtime
    - _Requirements: All (build infrastructure)_

- [x] 2. Implement app layout, providers, and navigation
  - [x] 2.1 Create root layout with providers
    - Extend the scaffolded `apps/web/src/components/providers.tsx` (created by Better-T-Stack) to add: wagmi provider, React Query provider, tRPC provider, Sonner toast provider
    - The scaffold already includes a theme provider (dark/light mode) — configure dark mode as default
    - Update `apps/web/src/app/layout.tsx` to use the extended providers
    - Create header with navigation: Markets, Portfolio, Leaderboard, Bridge
    - Create sidebar with wallet connection button placeholder and geoblock status placeholder
    - Apply interface design principles from design.md: borders-only depth strategy, 5-level surface elevation tokens, four-level text contrast hierarchy, monospace for data. Set up CSS custom properties / Tailwind theme tokens for the surface and border system.
    - _Requirements: 7.1, 8.2, 20.1_

  - [x] 2.2 Add loading and error states
    - Create `loading.tsx` files for each route with skeleton UIs
    - Create `error.tsx` files with error boundaries and retry buttons
    - _Requirements: All (UX)_

- [x] 3. Implement server-side API proxy layer (Hono + tRPC)
  - [x] 3.1 Create Gamma API client wrapper on the Hono server
    - Create `apps/server/src/lib/polymarket/gamma.ts` with functions: `getEvents`, `getMarketBySlug`, `getEventBySlug`, `searchMarkets`, `getTags`, `getSeries`, `getSportsMetadata`, `getPublicProfile`
    - Base URL from env: `GAMMA_API_URL` (default `https://gamma-api.polymarket.com`)
    - Include pagination support for list endpoints
    - _Requirements: 1.1, 1.2, 1.3, 1.5, 1.6, 11.1_

  - [x] 3.2 Create Data API client wrapper on the Hono server
    - Create `apps/server/src/lib/polymarket/data.ts` with functions: `getPositions`, `getClosedPositions`, `getTrades`, `getActivity`, `getValue`, `getAccountingSnapshot`, `getLeaderboard`, `getBuilderLeaderboard`, `getHolders`, `getLiveVolume`, `getOpenInterest`
    - Base URL from env: `DATA_API_URL` (default `https://data-api.polymarket.com`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 10.1, 10.3, 15.1, 16.1_

  - [x] 3.3 Create Bridge API client wrapper on the Hono server
    - Create `apps/server/src/lib/polymarket/bridge.ts` with functions: `createDepositAddresses`, `createWithdrawalAddresses`, `getQuote`, `getSupportedAssets`, `getTransactionStatus`
    - Base URL from env: `BRIDGE_API_URL` (default `https://bridge.polymarket.com`)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 3.4 Create CLOB read-only client wrapper on the Hono server
    - Create `apps/server/src/lib/polymarket/clob-read.ts` using `@polymarket/clob-client` for read operations: `getBook`, `getPriceHistory`, `getMidpoint`, `getSpread`, `getTickSize`
    - Base URL from env: `CLOB_API_URL` (default `https://clob.polymarket.com`)
    - This is server-side only — the CLOB client SDK runs in Node.js, not the browser
    - _Requirements: 2.1, 6.1_

  - [x] 3.5 Create server-side rate limiter
    - Create `apps/server/src/lib/rate-limiter.ts` implementing a token bucket algorithm
    - Configure per-endpoint limits matching Polymarket's documented rate limits:
      - Gamma: 4000 req/10s general, 500 req/10s for `/events`, 300 req/10s for `/markets`
      - Data: 1000 req/10s general, 200 req/10s for `/trades`, 150 req/10s for `/positions`
      - CLOB read: 1500 req/10s for `/book`, 1000 req/10s for price history
    - Implement request queuing when capacity is exceeded (never drop requests)
    - _Requirements: 12.3_

  - [x] 3.6 Define tRPC routers for all server-side API proxies
    - Implement tRPC procedures in `apps/server/src/routers/` (the `packages/api` package exports the AppRouter type only)
    - Create routers: `markets` (list, getBySlug, search, tags, series, sports), `data` (positions, closedPositions, trades, activity, value, snapshot, leaderboard, builderLeaderboard, holders), `bridge` (deposit, withdraw, quote, supportedAssets, status), `clob` (book, priceHistory, midpoint)
    - Wire each procedure to the corresponding API client function with rate limiting
    - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2, 5.3, 9.1, 9.2, 9.3, 10.1_

  - [x] 3.7 Add structured logging and graceful shutdown to Hono server
    - Add structured JSON logging middleware to `apps/server/src/index.ts` — log method, path, status, duration for every request to stdout (12-factor logging)
    - Log rate limit events (endpoint, queue depth, throttle) and API proxy errors at warn/error level
    - No file-based logging — stdout only
    - Add `SIGTERM` handler: stop accepting new connections, finish in-flight requests (10s timeout), close CLOB read client, exit 0
    - Bind Hono server to `PORT` env var (default 3001) from the env validation package
    - _Requirements: All (operational reliability)_

  - [x]* 3.8 Write property tests for server-side rate limiter
    - **Property 28: Rate limiter enforcement** — For any sequence of N requests within a burst window, at most burstLimit should execute; excess requests are queued, not dropped
    - **Property 29: Exponential backoff on rate limit errors** — Retry delays increase exponentially with each consecutive failure
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4, 12.5**

- [x] 4. Checkpoint - Verify server proxy layer
  - Ensure all tRPC procedures return correctly shaped data when called with mock/real Polymarket API responses
  - Ensure rate limiter tests pass
  - Ask the user if questions arise.

- [x] 5. Implement wallet connection and authentication
  - [x] 5.1 Configure wagmi with wallet providers
    - Create `apps/web/src/lib/auth/wallet.ts` with wagmi config supporting MetaMask, WalletConnect, and Coinbase Wallet
    - Create Zustand store `apps/web/src/stores/wallet.ts` for wallet state (address, chainId, isConnected, signatureType, funderAddress)
    - Use Zustand v5 `create<T>()()` double parentheses syntax; use `useShallow` for multi-value selectors
    - _Requirements: 7.1, 7.5_

  - [x] 5.2 Implement L1/L2 authentication flow
    - Create `apps/web/src/lib/auth/clob-auth.ts` with `performL1Auth`, `deriveApiKey`, `getStoredCredentials`, `clearCredentials`, `signL2Request`, `disconnect`
    - L1: Sign EIP-712 ClobAuth message using viem's `signTypedData`
    - L2: Store API credentials in memory only (never localStorage), implement HMAC-SHA256 request signing using Web Crypto API
    - Determine signature type from wallet type (EOA=0, POLY_PROXY=1, GNOSIS_SAFE=2)
    - `disconnect()`: clears credentials, signals user WebSocket to close, resets auth state
    - Handle credential expiration: silently re-derive using L1 auth; if wallet disconnected, prompt reconnection
    - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8, 18.1, 18.2_

  - [x] 5.3 Implement geoblock checker
    - Create `apps/web/src/lib/polymarket/geoblock.ts` with `check()`, `getCachedResult()`, `isBlocked()` methods
    - Call `GET https://polymarket.com/api/geoblock` from client (IP-based, must come from user's IP)
    - Cache result in memory for the page session (cleared on full page reload)
    - On geoblock failure: fail open for read-only access (market browsing), fail closed for trading (disable order placement)
    - _Requirements: 8.1, 8.2, 8.3_

  - [x]* 5.4 Write property tests for auth and geoblock
    - **Property 20: HMAC-SHA256 signing determinism** — Same inputs produce same signature
    - **Validates: Requirements 7.4**
    - **Property 21: Wallet type to signature type mapping** — Deterministic mapping (EOA→0, POLY_PROXY→1, GNOSIS_SAFE→2)
    - **Validates: Requirements 7.5**
    - **Property 22: Geoblock disables trading** — blocked=true disables order placement and shows restriction message
    - **Validates: Requirements 8.2**
    - **Property 23: Geoblock caching idempotence** — Subsequent checks return cached result without additional API calls
    - **Validates: Requirements 8.3**

  - [x] 5.5 Create WalletButton and ConnectModal components
    - Create `apps/web/src/components/wallet/wallet-button.tsx` — shows connected address or "Connect Wallet"
    - Create `apps/web/src/components/wallet/connect-modal.tsx` — wallet provider selection dialog
    - Wire to wagmi hooks and Zustand wallet store
    - Implement disconnect handler that calls `authService.disconnect()`, clears all user stores (orders, positions, trade history), disables trading UI, and shows "Connect Wallet" prompt
    - Disconnect must NOT close the market WebSocket channel (public data remains visible)
    - _Requirements: 7.1, 18.1, 18.2, 18.3, 18.4, 18.5_

  - [x]* 5.6 Write property test for wallet disconnect
    - **Property 38: Wallet disconnect clears all user state** — No credentials, empty orders/positions, trading UI disabled, market WebSocket still connected
    - **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5**

- [x] 6. Checkpoint - Verify auth flow
  - Ensure wallet connection, L1/L2 auth, geoblock checking, and disconnect cleanup work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Implement market discovery and browsing
  - [x] 7.1 Create market discovery page (Server Component)
    - Create `apps/web/src/app/page.tsx` as a Server Component that fetches events via tRPC
    - Render paginated market list with SSR for SEO
    - Use `Promise.all()` for independent data fetches (events + tags) in the Server Component
    - _Requirements: 1.1_

  - [x] 7.2 Create MarketCard and MarketList components
    - Create `apps/web/src/components/market/market-card.tsx` — displays market question, image, outcomes with prices, volume. Visually distinguish neg_risk (multi-outcome) markets from binary markets.
    - Create `apps/web/src/components/market/market-list.tsx` — grid/list of MarketCards with infinite scroll (Client Component)
    - _Requirements: 1.1, 1.4, 17.4_

  - [x] 7.3 Implement tag filtering and search
    - Create `apps/web/src/components/market/market-filters.tsx` (Client Component) — tag selector, search input, sort dropdown
    - Wire tag filtering to tRPC `markets.tags` and search to `markets.search`
    - _Requirements: 1.2, 1.3_

  - [x] 7.4 Implement series grouping and sports browsing
    - Create `apps/web/src/components/market/series-group.tsx` — groups markets by series
    - Create `apps/web/src/components/market/sports-browser.tsx` — sports metadata display with teams, market types, and game start times
    - _Requirements: 1.5, 1.6_

  - [x]* 7.5 Write property tests for market filtering and grouping
    - **Property 1: Tag filtering returns only matching markets** — Filtered results only contain markets with selected tag, no market without that tag is included
    - **Validates: Requirements 1.2**
    - **Property 2: Market detail rendering includes all required fields** — Rendered view contains question, description, resolution criteria, volume, open interest, end date
    - **Validates: Requirements 1.4**
    - **Property 3: Series grouping correctness** — Every market in a group shares the same series ID, no market appears in more than one group
    - **Validates: Requirements 1.6**

- [x] 8. Implement order book and real-time market data
  - [x] 8.1 Create WebSocket manager
    - Create `apps/web/src/lib/websocket/manager.ts` with `connect`, `disconnect`, `subscribe`, `unsubscribe`, `isConnected` methods
    - Implement automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)
    - Support dynamic subscription management (add/remove asset IDs without disconnecting)
    - Re-subscribe to all previously subscribed IDs on reconnect
    - Re-authenticate on user channel reconnect using stored L2 credentials
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 8.2 Implement market channel WebSocket
    - Create `apps/web/src/lib/websocket/market-channel.ts` connecting to `wss://ws-subscriptions-clob.polymarket.com/ws/market` with `custom_feature_enabled=true` query parameter
    - Handle `book`, `price_change`, `last_trade_price`, `best_bid_ask`, `tick_size_change`, `new_market`, `market_resolved` events
    - Route events to Zustand orderbook store
    - _Requirements: 2.2, 2.3, 2.5, 14.5_

  - [x] 8.3 Create Zustand orderbook store
    - Create `apps/web/src/stores/orderbook.ts` with state: bids, asks, spread, midpoint, bestBid, bestAsk, lastTradePrice, lastTradeSide
    - Use Zustand v5 `create<T>()()` double parentheses syntax; use `useShallow` for multi-value selectors
    - Implement reducers: `setBook` (full snapshot), `applyPriceChange` (incremental update — only affected price level changes), `updateLastTradePrice`, `updateBestBidAsk`
    - Bids sorted descending by price, asks sorted ascending by price
    - Spread = bestAsk - bestBid, midpoint = (bestAsk + bestBid) / 2
    - No persist middleware — real-time trading stores are populated from WebSocket/API each session
    - _Requirements: 2.1, 2.3, 2.4, 2.5_

  - [x] 8.4 Create Orderbook renderer component
    - Create `apps/web/src/components/trading/orderbook.tsx` (Client Component)
    - Display bid/ask levels with price, size, cumulative depth
    - Display spread and midpoint
    - Color-coded (green bids, red asks), monospace font with `font-variant-numeric: tabular-nums`
    - Subscribe to WebSocket market channel on mount, unsubscribe on unmount
    - Create `apps/web/src/hooks/use-orderbook.ts` hook to integrate WebSocket events with the orderbook store
    - _Requirements: 2.1, 2.4_

  - [x]* 8.5 Write property tests for orderbook
    - **Property 4: Order book sort invariant** — Bids descending, asks ascending by price
    - **Validates: Requirements 2.1**
    - **Property 5: Price change event applies correctly** — Only affected level changes, all other levels unchanged
    - **Validates: Requirements 2.3**
    - **Property 6: Spread and midpoint computation** — spread = bestAsk - bestBid, midpoint = (bestAsk + bestBid) / 2
    - **Validates: Requirements 2.4, 2.5**

  - [x]* 8.6 Write property tests for WebSocket subscription management
    - **Property 31: WebSocket reconnection with exponential backoff** — Delays increase exponentially, all subscriptions restored on reconnect
    - **Validates: Requirements 14.1, 14.2**
    - **Property 32: Subscription set union on subscribe** — Active set = S ∪ A after subscribing to A
    - **Validates: Requirements 14.3**
    - **Property 33: Subscription set difference on unsubscribe** — Active set = S \ A after unsubscribing A
    - **Validates: Requirements 14.4**

- [x] 9. Implement order placement and management
  - [x] 9.1 Create client-side order signer using viem
    - Create `apps/web/src/lib/polymarket/order-signer.ts` implementing EIP-712 order struct signing via viem's `signTypedData`
    - Support both standard CTF_EXCHANGE (`0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E`) and NEG_RISK_CTF_EXCHANGE (`0xC5d563A36AE78145C45a50134d48A1215220f80a`) based on market's `neg_risk` flag
    - Implement `createSignedOrder`, `createMarketOrder`, `signAndPostOrder`, `postBatchOrders`, `cancelOrder`, `cancelAllOrders`, `cancelMarketOrders`
    - POST/DELETE requests to CLOB API include L2 HMAC auth headers
    - Pass `neg_risk: true` in order options for neg_risk markets
    - _Requirements: 3.1, 3.2, 3.4, 3.5, 3.6, 3.7, 17.2, 17.3_

  - [x] 9.2 Create client-side rate limiter for CLOB requests
    - Create `apps/web/src/lib/rate-limiter.ts` with token bucket for POST/DELETE order endpoints
    - POST /order: Burst 3500/10s, Sustained 36000/10min
    - DELETE /order: Burst 3000/10s, Sustained 30000/10min
    - POST /orders (batch): Burst 1000/10s, Sustained 15000/10min
    - DELETE /cancel-all: Burst 250/10s, Sustained 6000/10min
    - DELETE /cancel-market-orders: Burst 1000/10s, Sustained 1500/10min
    - Queue requests when capacity exceeded (never drop)
    - Implement exponential backoff on throttled (429) responses
    - _Requirements: 12.1, 12.2, 12.4, 12.5_

  - [x] 9.3 Implement order validation logic
    - Create `apps/web/src/lib/polymarket/order-validation.ts`
    - Validate: price within tick size (use `order_price_min_tick_size` from market — 0.01 or 0.001), size >= minimum, post-only not with FOK/FAK, batch size 1-15, GTD expiration in future + 60s threshold
    - Return specific error messages for each validation failure (matching design.md client-side validation errors)
    - _Requirements: 3.3, 3.8, 3.9_

  - [x] 9.4 Create OrderForm component
    - Create `apps/web/src/components/trading/order-form.tsx` (Client Component)
    - Inputs: side (BUY/SELL), price, size, order type (GTC/GTD/FOK/FAK), post-only toggle, expiration (for GTD)
    - Client-side validation before submission using order-validation.ts
    - Display CLOB error messages on failure (surface exact `errorMsg` from API)
    - Disable when geoblock is active or wallet not connected
    - _Requirements: 3.1, 3.2, 3.3, 3.8, 3.9, 8.2_

  - [x] 9.5 Create OpenOrders component with cancel functionality
    - Create `apps/web/src/components/trading/open-orders.tsx` (Client Component)
    - Display open orders table with cancel button per order (only for OPEN and PARTIALLY_FILLED states)
    - "Cancel All" and "Cancel Market Orders" buttons
    - Wire to Zustand orders store for real-time updates
    - _Requirements: 3.5, 3.6, 3.7_

  - [x]* 9.6 Write property tests for order management
    - **Property 7: Limit order amount consistency** — makerAmount/takerAmount consistent with price (takerAmount/makerAmount ≈ price for BUY, makerAmount/takerAmount ≈ price for SELL)
    - **Validates: Requirements 3.1**
    - **Property 8: Market order type constraint** — Market orders are FOK or FAK only, never GTC or GTD
    - **Validates: Requirements 3.2**
    - **Property 9: Post-only order validation** — Rejected if FOK/FAK, accepted if GTC/GTD
    - **Validates: Requirements 3.3**
    - **Property 10: Batch order size constraint** — 1-15 accepted, 0 or >15 rejected
    - **Validates: Requirements 3.4**
    - **Property 11: CLOB error message propagation** — Non-empty errorMsg surfaced to user exactly
    - **Validates: Requirements 3.8**
    - **Property 12: GTD expiration threshold** — Expiration = user timestamp + 60 seconds
    - **Validates: Requirements 3.9**
    - **Property 37: Neg-risk order uses correct exchange contract** — neg_risk=true uses NEG_RISK_CTF_EXCHANGE, neg_risk=false uses CTF_EXCHANGE
    - **Validates: Requirements 17.2**

- [x] 10. Checkpoint - Verify trading flow
  - Ensure order signing via viem produces valid EIP-712 signatures
  - Ensure order validation catches all invalid inputs per design.md client-side validation table
  - Ensure client-side rate limiter queues and throttles correctly
  - Ensure all property and unit tests pass
  - Ask the user if questions arise.

- [x] 11. Implement real-time user updates and notifications
  - [x] 11.1 Implement user channel WebSocket
    - Create `apps/web/src/lib/websocket/user-channel.ts` connecting to `wss://ws-subscriptions-clob.polymarket.com/ws/user`
    - Authenticate with L2 API credentials
    - Handle `trade` and `order` events (PLACEMENT, UPDATE, CANCELLATION)
    - Disconnect when wallet disconnects (listen to auth disconnect signal)
    - On reconnect: re-authenticate with stored L2 credentials; if auth fails, prompt re-authentication
    - _Requirements: 4.1, 14.2, 18.1_

  - [x] 11.2 Create Zustand orders store with state machine validation
    - Create `apps/web/src/stores/orders.ts` with open orders list
    - Use Zustand v5 `create<T>()()` syntax; use `useShallow` for multi-value selectors
    - Implement reducers: `addOrder` (PLACEMENT), `removeOrder` (CANCELLATION), `updateOrder` (UPDATE — update size_matched), `clearAll` (disconnect)
    - Validate state transitions against the order state machine (design.md §6): PENDING→OPEN→PARTIALLY_FILLED→FILLED, with CANCELLED/EXPIRED branches. Ignore events that would produce invalid transitions.
    - Terminal states (FILLED, CANCELLED, EXPIRED, REJECTED) accept no outgoing transitions
    - Cancellable states: OPEN, PARTIALLY_FILLED only
    - No persist middleware
    - _Requirements: 4.3, 4.4, 4.5, 18.3_

  - [x] 11.3 Create Zustand positions store
    - Create `apps/web/src/stores/positions.ts` with positions list and trade history
    - Use Zustand v5 `create<T>()()` syntax; use `useShallow` for multi-value selectors
    - Implement reducers: `applyTrade` — update position size on trade event (update existing or add new), add to trade history. `clearAll` (disconnect).
    - No persist middleware
    - _Requirements: 4.2, 18.3_

  - [x] 11.4 Implement trade notifications and price alerts
    - Create `apps/web/src/stores/notifications.ts` Zustand store for notification preferences and active price alerts
    - Wire user channel trade events to Sonner toast notifications (market, side, size, price)
    - Wire cancellation events to toast notifications confirming cancellation
    - Implement price alert monitoring: store target prices per token, compare against `last_trade_price` WebSocket events, trigger notification when price crosses target
    - Create `apps/web/src/hooks/use-notifications.ts` hook to manage notification subscriptions
    - Request browser notification permission for background tab alerts
    - _Requirements: 20.1, 20.2, 20.3, 20.4_

  - [x]* 11.5 Write property tests for WebSocket event processing and notifications
    - **Property 13: WebSocket trade event updates positions** — Trade event updates existing position size or adds new position
    - **Validates: Requirements 4.2**
    - **Property 14: WebSocket PLACEMENT event adds order** — Order with matching ID, price, size, side appears in store
    - **Validates: Requirements 4.3**
    - **Property 15: WebSocket CANCELLATION event removes order** — Order with matching ID no longer in store
    - **Validates: Requirements 4.4**
    - **Property 16: WebSocket UPDATE event modifies size_matched** — size_matched updated to event value
    - **Validates: Requirements 4.5**
    - **Property 39: Trade notification on fill** — Notification generated containing market name, side, size, price
    - **Validates: Requirements 20.1**
    - **Property 40: Order state machine valid transitions** — Invalid transitions ignored, order state unchanged
    - **Validates: Requirements 4.3, 4.4, 4.5**

- [x] 12. Implement market detail page with trading UI
  - [x] 12.1 Create market detail page
    - Create `apps/web/src/app/(trading)/market/[slug]/page.tsx` as Server Component
    - Fetch market data via tRPC using `Promise.all()` for parallel fetches (market detail + price history + holders)
    - Pass data to Client Components
    - Layout: orderbook (left), chart (center), order form (right), open orders (bottom)
    - Include market question, description, resolution criteria, volume, open interest, end date
    - For neg_risk markets, display all outcomes (not just Yes/No) with their respective token IDs and prices
    - Wrap slow data sections in `<Suspense>` with skeleton fallbacks for progressive streaming
    - _Requirements: 1.4, 2.1, 3.1, 6.1, 17.1_

  - [x] 12.2 Create Price Chart component
    - Create `apps/web/src/components/trading/price-chart.tsx` (Client Component)
    - Use `lightweight-charts` for TradingView-style chart — load via `next/dynamic` with `ssr: false` to avoid SSR issues with canvas
    - Fetch initial data via tRPC `clob.priceHistory`
    - Time interval selector (1h, 6h, 1d, 1w, max) — re-fetch on interval change
    - Append new data points from `last_trade_price` WebSocket events in real time
    - _Requirements: 6.1, 6.2, 6.3_

  - [x]* 12.3 Write property test for price chart data
    - **Property 19: Price chart data append** — Appending event increases length by 1, last element has timestamp and price from event
    - **Validates: Requirements 6.3**

- [x] 13. Implement portfolio and position tracking
  - [x] 13.1 Create portfolio page
    - Create `apps/web/src/app/portfolio/page.tsx`
    - Tabs: Open Positions, Closed Positions, Trade History, Activity
    - Fetch data via tRPC procedures
    - Display total portfolio value from Data API `/value` endpoint
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [x] 13.2 Create PositionTable and TradeHistory components
    - Create `apps/web/src/components/portfolio/position-table.tsx` — open positions with token, size, current price, unrealized P&L
    - Create `apps/web/src/components/portfolio/closed-positions.tsx` — historical closed positions
    - Create `apps/web/src/components/portfolio/trade-history.tsx` — paginated trade list (max 500 per page)
    - Create `apps/web/src/components/portfolio/activity-feed.tsx` — on-chain activity from Data API `/activity`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 13.3 Implement accounting snapshot download
    - Add download button that fetches ZIP from tRPC `data.snapshot` and triggers browser download
    - ZIP contains positions.csv and equity.csv
    - _Requirements: 5.5_

  - [x]* 13.4 Write property tests for portfolio
    - **Property 17: Trade history pagination invariant** — Page size <= 500
    - **Validates: Requirements 5.3**
    - **Property 18: Portfolio value computation** — Total = sum(size × curPrice) for each position
    - **Validates: Requirements 5.6**

- [x] 14. Checkpoint - Verify portfolio and trading pages
  - Ensure market detail page renders with orderbook, chart, order form, and open orders
  - Ensure neg_risk markets display all outcomes correctly
  - Ensure portfolio page displays positions, trade history, and portfolio value
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement bridge, leaderboard, and profile pages
  - [x] 15.1 Create bridge/funding page
    - Create `apps/web/src/app/bridge/page.tsx`
    - Deposit flow: select chain → generate deposit address → show QR/address → poll status
    - Withdrawal flow: select destination → get quote (display output amount, checkout time, fee breakdown) → confirm → poll status
    - Display supported assets from Bridge API `/supported-assets` with available chains, tokens, and minimum deposit amounts
    - Poll Bridge API `/status/{address}` and display transaction status (DEPOSIT_DETECTED, PROCESSING, ORIGIN_TX_CONFIRMED, SUBMITTED, COMPLETED, FAILED)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [x] 15.2 Create leaderboard page
    - Create `apps/web/src/app/leaderboard/page.tsx`
    - Tabs: Traders, Builders
    - Filters: category, time period — re-fetch rankings with selected filter parameters
    - Fetch via tRPC `data.leaderboard` and `data.builderLeaderboard`
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 15.3 Create profile page
    - Create `apps/web/src/app/profile/[address]/page.tsx` as Server Component for SSR/SEO
    - Fetch public profile via tRPC (Gamma API `/public-profile`), display username, profile picture, trading statistics
    - Fetch and display positions, trade count, volume from Data API
    - _Requirements: 11.1, 11.2_

  - [x] 15.4 Implement PNL card generation
    - Create `apps/web/src/components/portfolio/pnl-card.tsx`
    - Generate shareable image containing: market question, position details (side, size), entry price, current price, P&L percentage
    - Use canvas or Next.js OG image API for server-side image generation
    - _Requirements: 11.3_

  - [x]* 15.5 Write property tests for bridge and profile
    - **Property 24: Quote display completeness** — Quote contains estimated output amount, checkout time, and fee breakdown
    - **Validates: Requirements 9.3**
    - **Property 25: Transaction status validity** — Status is one of: DEPOSIT_DETECTED, PROCESSING, ORIGIN_TX_CONFIRMED, SUBMITTED, COMPLETED, FAILED
    - **Validates: Requirements 9.4**
    - **Property 26: Profile rendering completeness** — Profile contains username, profile picture, and trading statistics
    - **Validates: Requirements 11.1**
    - **Property 27: PNL card data completeness** — Card contains market question, position details, entry price, current price, P&L percentage
    - **Validates: Requirements 11.3**

- [x] 16. Implement RTDS integration (comments and crypto prices)
  - [x] 16.1 Create RTDS WebSocket client
    - Create `apps/web/src/lib/websocket/rtds.ts` connecting to `wss://ws-live-data.polymarket.com`
    - Support dynamic topic subscription (add/remove/modify topics without disconnecting)
    - Handle comment events and crypto price events (Binance and Chainlink sources)
    - Implement reconnection with backoff; on reconnect, re-subscribe to topics and fetch recent comments via REST to fill gaps
    - _Requirements: 13.1, 13.3, 13.4_

  - [x] 16.2 Create comments section component
    - Create `apps/web/src/components/market/comments.tsx` (Client Component)
    - Display real-time comments for the current market's condition ID
    - Subscribe to RTDS comment events on mount, unsubscribe on unmount
    - _Requirements: 13.1, 13.2_

  - [x] 16.3 Create crypto price display component
    - Create `apps/web/src/components/market/crypto-prices.tsx` (Client Component)
    - Subscribe to RTDS crypto price feeds for crypto-related markets
    - Display live prices from Binance and Chainlink sources
    - _Requirements: 13.3_

  - [x]* 16.4 Write property test for comments
    - **Property 30: Comment event appends to list** — New comment increases list length by 1, new comment appears in list
    - **Validates: Requirements 13.2**

- [x] 17. Implement differentiating features (Activity Feed + Whale Tracker)
  - [x] 17.1 Create live activity feed
    - Create `apps/web/src/components/trading/activity-feed.tsx` (Client Component)
    - Poll Data API `/trades` for recent trades across all markets (configurable interval, default: 5 seconds)
    - Display: market name, trade side, size, price, timestamp
    - Click on a trade navigates to the corresponding market detail page
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 17.2 Create whale tracker
    - Create `apps/web/src/components/trading/whale-tracker.tsx` (Client Component)
    - Fetch top holders via tRPC `data.holders` for the current market
    - Create whale tracker dashboard: identify accounts with positions above configurable USD threshold (default: $50,000) and display their recent activity
    - Highlight whale trades in the activity feed
    - _Requirements: 16.1, 16.2, 16.3_

  - [x]* 17.3 Write property tests for activity feed and whale tracker
    - **Property 34: Activity feed item rendering completeness** — Item contains market name, trade side, size, price, timestamp
    - **Validates: Requirements 15.2**
    - **Property 35: Whale threshold filtering** — Only positions with size >= threshold are returned
    - **Validates: Requirements 16.2**
    - **Property 36: Whale trade highlighting** — Trades by addresses in tracked whale set are marked as highlighted
    - **Validates: Requirements 16.3**

- [x] 18. Final checkpoint - Full integration verification
  - Ensure all pages render correctly with real or mocked Polymarket API data
  - Ensure all property tests and unit tests pass
  - Ensure WebSocket connections (market channel, user channel, RTDS) establish and receive events
  - Ensure wallet connection, trading, and disconnect flows work end-to-end
  - Ensure neg_risk markets work correctly with the NEG_RISK_CTF_EXCHANGE contract
  - Ensure price alerts trigger notifications when price crosses target
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Bugfix: MarketCard navigates to /market/undefined
  - [x] 19.1 Add slug fallback in MarketCard component
    - Use `market.market_slug || market.condition_id` so the link always has a valid identifier
    - _Requirements: 1.4_
  - [x] 19.2 Add condition_id fallback in getMarketBySlug server function
    - Try slug lookup first, fall back to condition_id query when slug returns no results
    - Handles cases where markets from /events endpoint lack market_slug
    - _Requirements: 1.4_

## Notes

- Tasks marked with `*` are optional property test tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (40 properties total)
- Unit tests validate specific examples and edge cases
- The Better-T-Stack scaffold provides: shadcn/ui, Tailwind CSS, tRPC client/server setup, Drizzle config, Turborepo, Biome, Ultracite, and AI skills
- All order signing happens client-side via viem — private keys never touch the server
- The `@polymarket/clob-client` SDK runs server-side only (for read operations like book, prices)
- WebSocket connections (CLOB market/user channels, RTDS) are client-side only
- Shared types live in `packages/types` and are consumed by both `apps/web` and `apps/server`
- tRPC procedure implementations live in `apps/server/src/routers/`; `packages/api` exports the AppRouter type only
- Copy trading (Req 19), referral system, and user preferences are Phase 2 features requiring database persistence — not included in this task list
- Zustand v5 patterns: always use `create<T>()()` double parentheses, `useShallow` for multi-value selectors, no persist middleware for real-time trading stores
