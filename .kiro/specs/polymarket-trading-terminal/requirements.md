# Requirements Document

## Introduction

The Polymarket Trading Terminal is a custom web application that replicates Polymarket's core trading functionality (excluding LP rewards) and adds differentiating features such as whale tracking, live activity feeds, and copy trading. The terminal integrates with Polymarket's CLOB API, Gamma API, Data API, Bridge API, and RTDS WebSocket for a complete trading experience. It targets traders who want a more powerful, customizable interface for interacting with Polymarket prediction markets.

## Glossary

- **Trading_Terminal**: The web application providing the trading interface to Polymarket markets
- **CLOB_Client**: The client-side module that interacts with Polymarket's Central Limit Order Book API for order management and market data
- **Market_Browser**: The component responsible for discovering, searching, and filtering prediction markets
- **Order_Manager**: The component responsible for creating, signing, submitting, and canceling orders
- **Portfolio_Tracker**: The component that displays user positions, P&L, trade history, and portfolio value
- **WebSocket_Manager**: The component managing persistent WebSocket connections to CLOB market and user channels
- **Wallet_Connector**: The component handling wallet connection, signature types (EOA, POLY_PROXY, GNOSIS_SAFE), and authentication flows
- **Auth_Service**: The service managing L1 (EIP-712 private key signing) and L2 (HMAC API credential) authentication
- **Bridge_Service**: The component handling cross-chain deposits and withdrawals via the Bridge API
- **Orderbook_Renderer**: The component that visualizes the order book with bids, asks, depth, and spread
- **Price_Chart**: The component rendering historical price data for market tokens
- **Leaderboard_View**: The component displaying trader and builder rankings
- **Profile_View**: The component displaying public user profiles and PNL cards
- **Geoblock_Checker**: The service that verifies geographic eligibility before allowing trading operations
- **Rate_Limiter**: The client-side module that queues and throttles API requests to stay within Polymarket rate limits
- **RTDS_Client**: The client connecting to the Real-Time Data Socket for comments and crypto price feeds
- **Activity_Feed**: A differentiating component showing real-time trades across the platform
- **Whale_Tracker**: A differentiating component identifying and tracking large/smart money positions

## Requirements

### Requirement 1: Market Discovery and Browsing

**User Story:** As a trader, I want to browse and search prediction markets by category, tags, series, and sports, so that I can find markets relevant to my interests.

#### Acceptance Criteria

1. WHEN a user visits the market discovery page, THE Market_Browser SHALL display a paginated list of active markets fetched from the Gamma API `/events` endpoint
2. WHEN a user selects a category tag, THE Market_Browser SHALL filter displayed markets to only those matching the selected tag via the Gamma API `/tags` endpoint
3. WHEN a user enters a search query, THE Market_Browser SHALL return matching markets, events, and profiles from the Gamma API `/public-search` endpoint
4. WHEN a user selects a market, THE Trading_Terminal SHALL display a market detail page including the market question, description, resolution criteria, volume, open interest, and end date
5. WHEN a user navigates to a sports category, THE Market_Browser SHALL display sports-specific metadata including teams, market types, and game start times from the Gamma API `/sports` endpoint
6. WHEN a user browses markets by series, THE Market_Browser SHALL group related markets under their parent series fetched from the Gamma API `/series` endpoint

### Requirement 2: Order Book Visualization

**User Story:** As a trader, I want to see a real-time order book with bids, asks, depth, and spread, so that I can make informed trading decisions.

#### Acceptance Criteria

1. WHEN a user views a market, THE Orderbook_Renderer SHALL display the current order book with aggregated bid and ask levels fetched from the CLOB API `/book` endpoint
2. WHILE a user is viewing a market, THE WebSocket_Manager SHALL maintain a connection to the CLOB market channel and push `book`, `price_change`, and `last_trade_price` events to the Orderbook_Renderer
3. WHEN a `price_change` event is received via WebSocket, THE Orderbook_Renderer SHALL update the affected price level with the new aggregate size in place without full re-render
4. WHEN a user views a market, THE Orderbook_Renderer SHALL display the current spread (difference between best ask and best bid) and midpoint price
5. WHEN a `best_bid_ask` event is received via WebSocket, THE Orderbook_Renderer SHALL update the displayed spread and best prices

### Requirement 3: Order Placement and Management

**User Story:** As a trader, I want to place limit orders, market orders, and batch orders, so that I can execute trades on prediction markets.

#### Acceptance Criteria

1. WHEN a user submits a limit order with a price and size, THE Order_Manager SHALL sign the order locally using the user's private key and post it to the CLOB API `/order` endpoint with order type GTC or GTD
2. WHEN a user submits a market order, THE Order_Manager SHALL create a FOK or FAK order via the CLOB client's `createMarketOrder` method and post it to the CLOB API
3. WHEN a user submits a post-only order, THE Order_Manager SHALL set the `postOnly` flag to true and reject the order client-side if the order type is FOK or FAK
4. WHEN a user submits a batch of orders (up to 15), THE Order_Manager SHALL sign each order individually and post them as a single batch request to the CLOB API `/orders` endpoint
5. WHEN a user cancels a single order, THE Order_Manager SHALL send a DELETE request to the CLOB API `/order` endpoint with the order ID
6. WHEN a user cancels all orders, THE Order_Manager SHALL send a DELETE request to the CLOB API `/cancel-all` endpoint
7. WHEN a user cancels all orders for a specific market, THE Order_Manager SHALL send a DELETE request to the CLOB API `/cancel-market-orders` endpoint with the market condition ID
8. WHEN the CLOB API returns an error for an order placement (e.g., INVALID_ORDER_MIN_TICK_SIZE, INVALID_ORDER_NOT_ENOUGH_BALANCE), THE Order_Manager SHALL display the specific error message to the user
9. WHEN a user creates a GTD order, THE Order_Manager SHALL set the expiration field to the user-specified UTC timestamp plus the one-minute security threshold

### Requirement 4: Real-Time User Updates

**User Story:** As a trader, I want to receive real-time updates about my orders and trades, so that I can monitor my trading activity without manual refreshing.

#### Acceptance Criteria

1. WHILE a user is authenticated, THE WebSocket_Manager SHALL maintain an authenticated connection to the CLOB user channel using the user's L2 API credentials
2. WHEN a trade event is received on the user channel, THE Trading_Terminal SHALL update the user's position display and trade history with the new trade details
3. WHEN an order event of type PLACEMENT is received, THE Trading_Terminal SHALL add the order to the user's open orders display
4. WHEN an order event of type CANCELLATION is received, THE Trading_Terminal SHALL remove the order from the user's open orders display
5. WHEN an order event of type UPDATE is received (partial fill), THE Trading_Terminal SHALL update the order's `size_matched` field in the open orders display

### Requirement 5: Portfolio and Position Tracking

**User Story:** As a trader, I want to view my current positions, closed positions, trade history, and portfolio value, so that I can track my performance.

#### Acceptance Criteria

1. WHEN a user navigates to the portfolio page, THE Portfolio_Tracker SHALL fetch and display current open positions from the Data API `/positions` endpoint including token, size, current price, and unrealized P&L
2. WHEN a user views closed positions, THE Portfolio_Tracker SHALL fetch and display historical closed positions from the Data API `/closed-positions` endpoint
3. WHEN a user views trade history, THE Portfolio_Tracker SHALL fetch and display trades from the Data API `/trades` endpoint with pagination (max 500 per page)
4. WHEN a user views the activity feed, THE Portfolio_Tracker SHALL fetch on-chain activity from the Data API `/activity` endpoint
5. WHEN a user requests a portfolio snapshot, THE Portfolio_Tracker SHALL download the accounting snapshot ZIP from the Data API `/v1/accounting/snapshot` endpoint containing positions.csv and equity.csv
6. THE Portfolio_Tracker SHALL display the total portfolio value by fetching from the Data API `/value` endpoint

### Requirement 6: Price History Charts

**User Story:** As a trader, I want to view historical price charts for market tokens, so that I can analyze price trends before trading.

#### Acceptance Criteria

1. WHEN a user views a market, THE Price_Chart SHALL fetch and render historical price data from the CLOB API `/prices-history` endpoint
2. WHEN a user selects a time interval (1h, 6h, 1d, 1w, max), THE Price_Chart SHALL re-fetch price history with the selected interval parameter
3. WHEN a `last_trade_price` event is received via WebSocket, THE Price_Chart SHALL append the new data point to the chart in real time

### Requirement 7: Authentication and Wallet Connection

**User Story:** As a trader, I want to connect my wallet and authenticate with Polymarket, so that I can trade on the platform.

#### Acceptance Criteria

1. WHEN a user initiates wallet connection, THE Wallet_Connector SHALL support MetaMask, WalletConnect, and other EIP-1193 compatible wallets
2. WHEN a user connects a wallet, THE Auth_Service SHALL perform L1 authentication by signing an EIP-712 ClobAuth message with the wallet's private key
3. WHEN L1 authentication succeeds, THE Auth_Service SHALL call the CLOB API `/auth/api-key` endpoint to create or derive L2 API credentials (apiKey, secret, passphrase)
4. THE Auth_Service SHALL store L2 API credentials securely in the browser session and use them for all subsequent authenticated CLOB API requests via HMAC-SHA256 signing
5. WHEN initializing the CLOB client, THE Auth_Service SHALL determine the correct signature type (EOA=0, POLY_PROXY=1, GNOSIS_SAFE=2) based on the user's wallet type
6. THE Auth_Service SHALL never transmit or store the user's private key on any server; all order signing SHALL occur client-side
7. WHEN a user's L2 API credentials expire or become invalid, THE Auth_Service SHALL re-derive credentials using the L1 authentication flow
8. WHEN a user disconnects their wallet, THE Auth_Service SHALL clear all stored L2 credentials, close the authenticated user WebSocket channel, clear portfolio/order data from client state, and disable trading UI

### Requirement 8: Geographic Restriction Checking

**User Story:** As a platform operator, I want to check geographic restrictions before allowing trading, so that the terminal complies with Polymarket's regulatory requirements.

#### Acceptance Criteria

1. WHEN a user attempts to access trading functionality, THE Geoblock_Checker SHALL call the Polymarket geoblock endpoint `GET https://polymarket.com/api/geoblock` to verify eligibility
2. IF the geoblock response returns `blocked: true`, THEN THE Trading_Terminal SHALL display a message indicating trading is not available in the user's region and disable order placement
3. THE Geoblock_Checker SHALL cache the geoblock result for the duration of the user's session to avoid repeated API calls

### Requirement 9: Bridge and Funding Operations

**User Story:** As a trader, I want to deposit and withdraw funds across multiple chains, so that I can fund my Polymarket trading account.

#### Acceptance Criteria

1. WHEN a user initiates a deposit, THE Bridge_Service SHALL call the Bridge API `/deposit` endpoint with the user's Polymarket wallet address to generate deposit addresses for EVM, Solana, and Bitcoin chains
2. WHEN a user initiates a withdrawal, THE Bridge_Service SHALL call the Bridge API `/withdraw` endpoint with the destination chain, token, and recipient address
3. WHEN a user requests a quote before depositing or withdrawing, THE Bridge_Service SHALL call the Bridge API `/quote` endpoint and display the estimated output amount, checkout time, and fee breakdown
4. WHILE a deposit or withdrawal is in progress, THE Bridge_Service SHALL poll the Bridge API `/status/{address}` endpoint and display the current transaction status (DEPOSIT_DETECTED, PROCESSING, ORIGIN_TX_CONFIRMED, SUBMITTED, COMPLETED, FAILED)
5. WHEN a user views the deposit interface, THE Bridge_Service SHALL fetch supported assets from the Bridge API `/supported-assets` endpoint and display available chains and tokens with minimum deposit amounts

### Requirement 10: Leaderboard Display

**User Story:** As a trader, I want to view trader and builder leaderboards, so that I can see top performers and track rankings.

#### Acceptance Criteria

1. WHEN a user navigates to the leaderboard page, THE Leaderboard_View SHALL fetch and display trader rankings from the Data API `/v1/leaderboard` endpoint
2. WHEN a user filters the leaderboard by category or time period, THE Leaderboard_View SHALL re-fetch rankings with the selected filter parameters
3. WHEN a user views the builder leaderboard, THE Leaderboard_View SHALL fetch and display builder rankings from the Data API `/v1/builders/leaderboard` endpoint

### Requirement 11: Public Profile and PNL Cards

**User Story:** As a trader, I want to view public profiles and generate shareable PNL cards, so that I can share my trading performance.

#### Acceptance Criteria

1. WHEN a user navigates to a profile page, THE Profile_View SHALL fetch and display the public profile from the Gamma API `/public-profile` endpoint including username, profile picture, and trading statistics
2. WHEN a user views a profile, THE Profile_View SHALL fetch and display the user's positions, trade count, and volume from the Data API
3. WHEN a user requests a PNL card for an active position, THE Trading_Terminal SHALL generate a shareable image containing the market question, position details, entry price, current price, and P&L percentage

### Requirement 12: Rate Limit Management

**User Story:** As a platform operator, I want to manage API rate limits, so that the terminal does not exceed Polymarket's rate limits and cause request failures.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce client-side rate limiting for CLOB POST `/order` requests at a maximum of 3500 requests per 10 seconds (burst) and 36000 requests per 10 minutes (sustained), matching Polymarket's documented limits
2. THE Rate_Limiter SHALL enforce client-side rate limiting for CLOB DELETE `/order` requests at a maximum of 3000 requests per 10 seconds (burst) and 30000 requests per 10 minutes (sustained), matching Polymarket's documented limits
3. THE Rate_Limiter SHALL enforce server-side rate limiting for proxied API requests: Gamma API at 4000 requests per 10 seconds (general), Data API at 1000 requests per 10 seconds (general), and per-endpoint limits as documented by Polymarket
4. WHEN a request would exceed the rate limit, THE Rate_Limiter SHALL queue the request and execute it when capacity becomes available, not drop it
5. IF the CLOB API returns a rate limit error (throttled response), THEN THE Rate_Limiter SHALL implement exponential backoff before retrying the request

### Requirement 13: Real-Time Comments and Crypto Prices (RTDS)

**User Story:** As a trader, I want to see real-time comments on markets and live crypto prices, so that I can stay informed while trading.

#### Acceptance Criteria

1. WHEN a user views a market detail page, THE RTDS_Client SHALL connect to `wss://ws-live-data.polymarket.com` and subscribe to comment events for that market's condition ID
2. WHEN a new comment event is received, THE Trading_Terminal SHALL display the comment in the market's comment section in real time
3. WHEN a user views crypto-related markets, THE RTDS_Client SHALL subscribe to crypto price feeds and display live prices from Binance and Chainlink sources
4. THE RTDS_Client SHALL support dynamic subscription management (add, remove, modify topics) without disconnecting from the WebSocket

### Requirement 14: WebSocket Connection Management

**User Story:** As a platform operator, I want robust WebSocket connection management, so that real-time data remains reliable during extended trading sessions.

#### Acceptance Criteria

1. WHEN a WebSocket connection to the CLOB market channel drops, THE WebSocket_Manager SHALL automatically reconnect with exponential backoff and re-subscribe to all previously subscribed asset IDs
2. WHEN a WebSocket connection to the CLOB user channel drops, THE WebSocket_Manager SHALL automatically reconnect with re-authentication using stored L2 credentials
3. THE WebSocket_Manager SHALL support subscribing to additional asset IDs on an existing market channel connection without disconnecting
4. THE WebSocket_Manager SHALL support unsubscribing from asset IDs on an existing market channel connection without disconnecting
5. THE WebSocket_Manager SHALL connect to the market channel with the `custom_feature_enabled=true` query parameter to receive `best_bid_ask`, `new_market`, and `market_resolved` events

### Requirement 15: Live Activity Feed (Differentiating Feature)

**User Story:** As a trader, I want to see a live feed of trades happening across the platform, so that I can spot market momentum and trading activity.

#### Acceptance Criteria

1. WHEN a user enables the activity feed, THE Activity_Feed SHALL display recent trades across all markets fetched from the Data API `/trades` endpoint with polling at a configurable interval (default: 5 seconds)
2. WHEN new trades appear, THE Activity_Feed SHALL prepend them to the feed with the market name, trade side, size, price, and timestamp
3. WHEN a user clicks on a trade in the activity feed, THE Trading_Terminal SHALL navigate to the corresponding market detail page

### Requirement 16: Whale and Smart Money Tracking (Differentiating Feature)

**User Story:** As a trader, I want to track large positions and smart money movements, so that I can identify informed trading activity.

#### Acceptance Criteria

1. WHEN a user views a market, THE Whale_Tracker SHALL fetch top holders from the Data API `/holders` endpoint and display the largest positions
2. WHEN a user views the whale tracker dashboard, THE Whale_Tracker SHALL identify accounts with positions above a configurable USD threshold (default: $50,000) and display their recent activity
3. WHEN a tracked whale account makes a trade, THE Whale_Tracker SHALL highlight the trade in the activity feed

### Requirement 17: Neg-Risk Multi-Outcome Market Support

**User Story:** As a trader, I want to trade on multi-outcome (neg_risk) markets with the same experience as binary markets, so that I can participate in all Polymarket markets.

#### Acceptance Criteria

1. WHEN a user views a neg_risk market, THE Trading_Terminal SHALL display all outcomes (not just Yes/No) with their respective token IDs and prices
2. WHEN a user places an order on a neg_risk market, THE Order_Manager SHALL use the NEG_RISK_CTF_EXCHANGE contract address (`0xC5d563A36AE78145C45a50134d48A1215220f80a`) for order signing instead of the standard CTF_EXCHANGE
3. WHEN creating orders for neg_risk markets, THE Order_Manager SHALL pass `neg_risk: true` in the order options to the CLOB client
4. THE Market_Browser SHALL visually distinguish multi-outcome markets from binary markets in the market list

### Requirement 18: Wallet Disconnect and Session Cleanup

**User Story:** As a trader, I want a clean disconnect experience so that my session is properly cleaned up when I disconnect my wallet.

#### Acceptance Criteria

1. WHEN a user disconnects their wallet, THE Trading_Terminal SHALL close the authenticated user WebSocket channel within 1 second
2. WHEN a user disconnects their wallet, THE Trading_Terminal SHALL clear all L2 API credentials from memory
3. WHEN a user disconnects their wallet, THE Trading_Terminal SHALL clear all user-specific data (positions, open orders, trade history) from client state
4. WHEN a user disconnects their wallet, THE Trading_Terminal SHALL disable all trading UI elements (order form, cancel buttons) and show a "Connect Wallet" prompt
5. WHEN a user disconnects their wallet, THE Trading_Terminal SHALL NOT close the market WebSocket channel (public data should remain visible)

### Requirement 19: Copy Trading (Phase 2)

**User Story:** As a trader, I want to automatically copy trades from successful traders, so that I can benefit from their expertise.

#### Acceptance Criteria

1. WHEN a user selects a trader to copy, THE Trading_Terminal SHALL subscribe to that trader's trade activity via the Data API
2. WHEN a copied trader places a trade, THE Trading_Terminal SHALL present the trade details to the copying user with a configurable auto-execute or confirm-first mode
3. THE Trading_Terminal SHALL allow users to set copy trading parameters: maximum position size, maximum number of concurrent copies, and stop-loss percentage
4. _Note: This requirement is deferred to Phase 2 and requires database persistence for copy trading state_

### Requirement 20: Notifications and Alerts

**User Story:** As a trader, I want to receive notifications about my orders and configurable price alerts, so that I don't miss important trading events.

#### Acceptance Criteria

1. WHEN an order is filled (trade event received on user WebSocket channel), THE Trading_Terminal SHALL display a toast notification with the trade details (market, side, size, price)
2. WHEN an order is canceled (cancellation event received), THE Trading_Terminal SHALL display a toast notification confirming the cancellation
3. WHEN a user sets a price alert for a market token at a target price, THE Trading_Terminal SHALL monitor `last_trade_price` WebSocket events and trigger a notification when the price crosses the target
4. THE Trading_Terminal SHALL support browser notification permissions for alerts when the tab is not focused
