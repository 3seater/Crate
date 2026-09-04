# Requirements Document

## Introduction

The Robinhood Chain Basket Terminal is a refactor of the existing Doji Polymarket prediction market terminal into a dedicated Index & Basket Trading Terminal for Robinhood Chain (an Arbitrum Orbit L2). The platform allows users to discover, analyze, and invest in curated token baskets on Robinhood Chain (Chain ID: 4663) using ETH or USDG. All Polymarket-specific prediction market infrastructure (order books, binary outcome tokens, CLOB signing, Polygon contracts) is removed and replaced with basket-centric trading flows powered by the Enso routing API, GeckoTerminal/DexScreener price feeds, and standard EVM wallets.

---

## Glossary

- **Basket**: A curated, weighted collection of ERC-20 tokens on Robinhood Chain that can be bought or exited as a single transaction bundle.
- **Basket Terminal**: The full-page trading interface for a specific basket, showing constituent tokens, composite chart, and order execution panel.
- **Constituent Token**: An individual ERC-20 token that is part of a basket, with a defined weight expressed as a percentage.
- **Composite Index**: A normalized performance index computed from constituent token prices, anchored to 100.00 at the start of the selected timeframe.
- **Enso API**: The Enso Shortcut / Bundle Routing API used to build multi-swap transaction bundles for basket buy and exit flows.
- **Exit Flow**: The operation that swaps all of a user's basket token holdings back to ETH in a single bundled transaction.
- **GeckoTerminal**: A third-party DEX price aggregator API used to fetch OHLCV candlestick and live price data per token.
- **DexScreener**: A fallback third-party DEX price aggregator API used when GeckoTerminal data is unavailable.
- **OHLCV**: Open, High, Low, Close, Volume — the standard candlestick data format for price charts.
- **USDG**: A USD-pegged stablecoin accepted as an alternative deposit currency on Robinhood Chain.
- **RPC**: Remote Procedure Call endpoint for communicating with the Robinhood Chain node.
- **Wagmi**: A React hooks library for EVM wallet interactions used to send transactions.
- **EOA**: Externally Owned Account — a standard EVM wallet controlled by a private key.
- **Network Switch**: The action of prompting a connected wallet to change its active chain to Robinhood Chain (Chain ID: 4663).
- **Quick-Buy Preset**: A predefined ETH amount (0.05 ETH, 0.1 ETH, 0.5 ETH, 1 ETH) the user can select to populate the order input.
- **Allocation Preview**: A breakdown of how a deposit amount will be distributed across basket constituents based on their weights.
- **Basket Config**: The `config/baskets.ts` file that defines all baskets (symbols, token addresses, pool addresses, weights).
- **tRPC**: The type-safe RPC layer used for client–server communication in this monorepo.
- **Terminal**: The `Terminal` system (this application).

---

## Requirements

### Requirement 1: Polymarket Infrastructure Removal

**User Story:** As a developer, I want all Polymarket-specific code removed from the codebase, so that no prediction-market logic, Polygon network references, or CLOB infrastructure remains.

#### Acceptance Criteria

1. THE Terminal SHALL remove all `@polymarket/clob-client` package dependencies from `package.json` files across the monorepo.
2. THE Terminal SHALL remove all EIP-712 order signing logic, proxy wallet setup code, and binary outcome token (YES/NO ERC-1155) handling.
3. THE Terminal SHALL remove all order book interfaces, bid/ask depth visualizers, limit order UI, and order matching components.
4. THE Terminal SHALL remove all prediction-market action components (Split, Merge, Redeem) from the UI.
5. THE Terminal SHALL remove all Polygon network configuration (Chain ID: 137, RPC URLs, contract addresses specific to Polygon).
6. THE Terminal SHALL remove all Polymarket Gamma API client code, market/event data fetching logic, and related tRPC router procedures.
7. WHEN a removed module is referenced by a surviving module, THE Terminal SHALL replace the reference with a stub, redirect, or removal such that the build produces no TypeScript errors.

---

### Requirement 2: Robinhood Chain Network Configuration

**User Story:** As a user, I want the terminal to operate exclusively on Robinhood Chain, so that all wallet interactions, transaction submissions, and contract calls target the correct network.

#### Acceptance Criteria

1. THE Terminal SHALL define Robinhood Chain as a named network constant with Chain ID `4663` (hex `0x1237`), network name `"Robinhood Chain"`, native currency `ETH` with 18 decimals, RPC URL `https://rpc.mainnet.chain.robinhood.com`, and block explorer URL `https://robinhoodchain.blockscout.com`.
2. THE Terminal SHALL export the Robinhood Chain network constant from a single canonical location (`config/chains.ts` or equivalent) so all wallet and RPC code imports from one source.
3. WHEN a user connects a wallet that is on a chain other than Chain ID `4663`, THE Terminal SHALL display a network switch prompt requesting the user to switch to Robinhood Chain.
4. WHEN a user confirms the network switch prompt, THE Wallet SHALL switch the active network to Robinhood Chain (Chain ID: 4663) using the wallet provider's `wallet_switchEthereumChain` or `wallet_addEthereumChain` RPC method.
5. IF the wallet rejects the network switch, THEN THE Terminal SHALL display an error message and disable all transaction-sending UI elements until the wallet is on the correct chain.
6. WHILE the user is connected to a chain other than Chain ID `4663`, THE Terminal SHALL disable the basket execution panel and show a "Wrong Network" indicator.

---

### Requirement 3: Wallet Connection Support

**User Story:** As a user, I want to connect my EVM wallet to the terminal, so that I can execute basket transactions on Robinhood Chain.

#### Acceptance Criteria

1. THE Terminal SHALL support wallet connection via browser extension wallets compatible with the EIP-1193 provider interface (Rabby, MetaMask, Rainbow, Robinhood Wallet).
2. THE Terminal SHALL display a "Connect Wallet" button in the site header when no wallet is connected.
3. WHEN a user clicks "Connect Wallet", THE Terminal SHALL open a wallet selection modal listing the supported wallets.
4. WHEN a wallet is successfully connected, THE Terminal SHALL display the connected wallet address (truncated to the standard `0x1234…5678` format) and the ETH balance in the site header.
5. WHEN a wallet is disconnected, THE Terminal SHALL clear all wallet state and revert the header to the "Connect Wallet" state.
6. THE Terminal SHALL persist wallet connection state across page refreshes using the wallet library's built-in reconnection mechanism.
7. IF wallet connection fails, THEN THE Terminal SHALL display a descriptive error message to the user.

---

### Requirement 4: Home / Explainer Page

**User Story:** As a new visitor, I want a landing page that explains the product and previews available baskets, so that I understand the value proposition before exploring further.

#### Acceptance Criteria

1. THE Terminal SHALL render the Home page at route `/` as a Next.js Server Component with a hero section, protocol explanation, and live basket preview.
2. THE Home Page SHALL display a hero section containing a headline, subheadline, and a primary CTA button that navigates to `/baskets`.
3. THE Home Page SHALL display a basket preview section showing at least the first 4 available baskets as cards in a carousel or grid layout.
4. WHEN rendering basket preview cards, THE Home Page SHALL display each basket's name, constituent token icons, constituent weightings, and the basket's 24-hour performance percentage.
5. THE Home Page SHALL fetch basket performance data using server-side prefetching so the initial page load renders basket data without a client-side waterfall.
6. WHEN basket price data is unavailable, THE Home Page SHALL display a loading skeleton for the affected basket card rather than an error state.

---

### Requirement 5: Baskets Directory Page

**User Story:** As a user, I want to browse all available baskets in a catalog view, so that I can discover and compare investment options.

#### Acceptance Criteria

1. THE Terminal SHALL render the Baskets Directory page at route `/baskets` as a Next.js Server Component.
2. THE Baskets Directory Page SHALL display all baskets defined in `config/baskets.ts` as catalog cards.
3. WHEN rendering a basket catalog card, THE Baskets Directory Page SHALL display the basket name, a row of constituent token icons, each constituent's weight percentage, 24-hour price change percentage, and a "View" or "Trade" CTA button.
4. WHEN a user clicks a basket card's CTA, THE Terminal SHALL navigate to the Basket Terminal at `/baskets/[basketId]`.
5. THE Baskets Directory Page SHALL display baskets in a responsive grid layout (1 column on mobile, 2 columns on tablet, 3 or more columns on desktop).
6. WHEN price data for a basket constituent is loading, THE Baskets Directory Page SHALL display a loading state for that basket card's performance data without blocking the display of static basket metadata.

---

### Requirement 6: Basket Terminal View

**User Story:** As a user, I want a dedicated terminal page for each basket, so that I can analyze performance and execute trades from a single focused interface.

#### Acceptance Criteria

1. THE Terminal SHALL render the Basket Terminal at route `/baskets/[basketId]` as a Next.js page with server-side metadata generation.
2. THE Basket Terminal SHALL display an active basket selector that lists all available baskets by name and allows the user to switch between baskets without leaving the page.
3. THE Basket Terminal SHALL display a constituent token list showing each token's name, symbol, current price, 24-hour price change percentage, and basket weight.
4. THE Basket Terminal SHALL render the Composite Basket Chart (defined in Requirement 7) in the upper portion of the terminal layout.
5. THE Basket Terminal SHALL render the Order Execution Panel (defined in Requirement 8) in a sidebar or bottom panel adjacent to the chart.
6. WHEN the `[basketId]` path parameter does not match any basket in `config/baskets.ts`, THE Terminal SHALL return a 404 page.
7. THE Basket Terminal page SHALL use Next.js `generateStaticParams` or equivalent to pre-generate routes for all basket IDs defined at build time.

---

### Requirement 7: Composite Basket Charting Engine

**User Story:** As a user, I want to see the basket's composite performance over time alongside individual token charts, so that I can make informed trading decisions.

#### Acceptance Criteria

1. THE Charting Engine SHALL fetch OHLCV candlestick data for each constituent token using the GeckoTerminal API as the primary source and the DexScreener API as a fallback when GeckoTerminal data is unavailable.
2. THE Charting Engine SHALL normalize each constituent token's price series to a shared base index value of `100.00` at the timestamp `t₀` corresponding to the start of the selected timeframe.
3. THE Charting Engine SHALL compute the Composite Index value at each timestamp using the formula: `IndexValue_t = Σ (P_i,t / P_i,0 × w_i × 100)`, where `P_i,t` is the price of token `i` at time `t`, `P_i,0` is the price of token `i` at `t₀`, and `w_i` is the normalized weight of token `i`.
4. THE Charting Engine SHALL render the Composite Index as a line or area series using a chart library already present in the project (KLineChart or Recharts).
5. THE Charting Engine SHALL provide timeframe selector chips for at least the following intervals: 24H, 7D, 30D.
6. WHEN a user selects a timeframe chip, THE Charting Engine SHALL re-fetch data for the new timeframe and re-normalize the index to `t₀` of the new window.
7. THE Charting Engine SHALL render individual token toggle chips for each constituent; WHEN a user activates a toggle chip, THE Charting Engine SHALL render that token's candlestick chart overlaid or in a sub-panel beneath the composite chart.
8. WHEN price data for a constituent token is unavailable, THE Charting Engine SHALL exclude that token from the composite index computation and display a warning label indicating the missing token.
9. THE Charting Engine SHALL update the chart with new price data at most every 30 seconds without requiring a full page reload.

---

### Requirement 8: Order Execution Panel — Buy Flow

**User Story:** As a user, I want to buy into a basket using ETH or USDG, so that I can invest in a diversified token portfolio in a single transaction.

#### Acceptance Criteria

1. THE Order Panel SHALL accept ETH or USDG as the deposit currency, selectable via a currency toggle.
2. THE Order Panel SHALL provide preset quick-buy amount buttons for `0.05 ETH`, `0.1 ETH`, `0.5 ETH`, and `1 ETH`; WHEN a preset is clicked, THE Order Panel SHALL populate the input field with the preset value.
3. THE Order Panel SHALL display an Allocation Preview showing how the deposit amount will be split across each constituent token based on basket weights, expressed in both token units and ETH value.
4. WHEN the deposit amount input changes, THE Order Panel SHALL re-compute the Allocation Preview within 500 milliseconds.
5. WHEN the user clicks the execute button, THE Order Panel SHALL call the Enso Bundle Routing API with Chain ID `4663` to obtain a bundled transaction payload (to, data, value) that performs all necessary swaps.
6. WHEN the Enso API returns a valid transaction payload, THE Order Panel SHALL submit the transaction to the Robinhood Chain using Wagmi's `useSendTransaction` hook and the user's connected EOA.
7. WHEN the transaction is submitted successfully, THE Order Panel SHALL display a pending state with a transaction hash link to the Robinhood Chain block explorer (`https://robinhoodchain.blockscout.com/tx/{hash}`).
8. WHEN the transaction is confirmed on-chain, THE Order Panel SHALL display a success state and reset the input fields.
9. IF the Enso API returns an error, THEN THE Order Panel SHALL display a descriptive error message and keep the input fields populated so the user can retry.
10. IF the wallet transaction is rejected by the user, THEN THE Order Panel SHALL display a cancellation notice and return to the ready state.
11. WHILE the user's wallet is not connected, THE Order Panel SHALL disable the execute button and display a "Connect Wallet" prompt.
12. WHILE the connected wallet is on the wrong network, THE Order Panel SHALL disable the execute button and display a "Switch Network" prompt.

---

### Requirement 9: Order Execution Panel — Exit Flow

**User Story:** As a user, I want to exit a basket position back to ETH in a single click, so that I can liquidate my basket holdings efficiently.

#### Acceptance Criteria

1. THE Order Panel SHALL display an "Exit Basket to ETH" button when the user has a non-zero balance of any constituent token in the selected basket.
2. WHEN a user clicks "Exit Basket to ETH", THE Order Panel SHALL call the Enso Bundle Routing API to construct a bundled transaction that approves and swaps all constituent token balances back to ETH.
3. THE Order Panel SHALL display an Exit Preview showing the estimated ETH amount the user will receive, computed from the Enso API's route quotes.
4. WHEN the Enso API returns a valid exit transaction payload, THE Order Panel SHALL request the user to confirm the transaction via their wallet.
5. WHEN the exit transaction is submitted, THE Order Panel SHALL display a pending state with a transaction hash link to the block explorer.
6. WHEN the exit transaction is confirmed on-chain, THE Order Panel SHALL display a success state indicating the amount of ETH received.
7. IF the exit transaction is rejected by the user or the Enso API returns an error, THEN THE Order Panel SHALL display a descriptive error message and return to the ready state.

---

### Requirement 10: Basket Configuration System

**User Story:** As a developer, I want a single, modular configuration file that defines all baskets, so that baskets can be added, modified, or removed without touching component logic.

#### Acceptance Criteria

1. THE Terminal SHALL define all basket data in a configuration file at `apps/web/src/config/baskets.ts`.
2. THE Basket Config SHALL define each basket with at minimum the following fields: `id` (unique string slug), `name` (display name), `description`, and `constituents` (array of constituent token definitions).
3. THE Basket Config SHALL define each constituent token with at minimum: `symbol`, `address` (ERC-20 contract address on Robinhood Chain), `poolAddress` (DEX pool address used for price feeds), and `weight` (numeric, where all weights in a basket sum to `1.0`).
4. WHEN a new basket is added to `config/baskets.ts`, THE Terminal SHALL make it available across all basket directory, terminal, and home preview components without requiring changes to component code.
5. THE Basket Config SHALL be imported as a static constant so it is available at build time for static route generation and server-side rendering.
6. IF the weights of all constituents in a basket do not sum to `1.0` within a tolerance of `0.001`, THEN THE Terminal SHALL throw a build-time or runtime validation error with a descriptive message identifying the offending basket.

---

### Requirement 11: Enso API Integration

**User Story:** As a developer, I want a dedicated Enso API client module, so that all routing and bundling calls are centralized and consistently error-handled.

#### Acceptance Criteria

1. THE Terminal SHALL implement an Enso API client in the server-side codebase (e.g., `apps/server/src/domains/baskets/enso-client.ts`) that encapsulates all HTTP calls to the Enso Shortcut / Bundle Routing API.
2. THE Enso Client SHALL accept basket constituent addresses, weights, input token address, and input amount as parameters and return a transaction bundle object with `to`, `data`, and `value` fields.
3. THE Enso Client SHALL include Chain ID `4663` in all API requests targeting Robinhood Chain.
4. IF the Enso API responds with a non-2xx HTTP status, THEN THE Enso Client SHALL throw a typed error containing the HTTP status code and the response body's error message.
5. THE Terminal SHALL expose Enso bundle retrieval as a tRPC procedure (e.g., `trpc.baskets.getBundle`) so the client component calls it via the standard tRPC pattern.

---

### Requirement 12: Price Data Integration

**User Story:** As a developer, I want a centralized price data service, so that basket charts and allocation previews share a single, consistently refreshed source of token prices.

#### Acceptance Criteria

1. THE Terminal SHALL implement a price data module in the server-side codebase that fetches OHLCV data from the GeckoTerminal API using the pool addresses defined in `config/baskets.ts`.
2. WHEN GeckoTerminal returns a non-2xx response or a network error for a given token, THE Price Data Module SHALL retry with DexScreener's equivalent endpoint using the same pool address.
3. THE Price Data Module SHALL cache fetched OHLCV data in the server-side LRU cache with a TTL of 30 seconds for live price updates and 5 minutes for historical timeframes (7D, 30D).
4. THE Terminal SHALL expose price data as tRPC procedures: one for live current prices and one for OHLCV history per timeframe.
5. WHEN all price data sources fail for a token, THE Price Data Module SHALL return a partial result containing data for the available tokens and a list of failed token symbols, rather than failing the entire request.

---

### Requirement 13: Navigation & Shell Updates

**User Story:** As a user, I want the navigation to reflect the Robinhood Chain Basket Terminal product, so that I can quickly access the main areas of the application.

#### Acceptance Criteria

1. THE Terminal SHALL update the header navigation to include links to the Home page (`/`) and Baskets Directory (`/baskets`).
2. THE Terminal SHALL remove all navigation links that point to Polymarket-specific routes (e.g., `/explore`, `/portfolio`, `/leaderboard`, `/watchlist`, `/wallet-tracker`, `/referrals`).
3. THE Terminal SHALL display the Robinhood Chain Basket Terminal product name and logo in the site header.
4. THE Terminal SHALL update the bottom bar to reflect the basket-terminal navigation structure, removing any Polymarket-specific dock controls or widgets.
5. WHEN the user is on a route matching the active navigation link, THE Terminal SHALL apply the active state style (`text-primary` / doji-green accent) to that link.

---

### Requirement 14: Responsive Layout

**User Story:** As a user on any device, I want the terminal to be usable on mobile, tablet, and desktop, so that I can access the platform regardless of screen size.

#### Acceptance Criteria

1. THE Basket Terminal layout SHALL use a single-column stack on viewport widths below 768px, placing the Composite Chart above the Order Execution Panel.
2. THE Basket Terminal layout SHALL use a split two-column layout on viewport widths of 768px and above, with the chart in the main (wider) column and the Order Execution Panel in the sidebar.
3. THE Baskets Directory grid SHALL display 1 column on viewport widths below 640px, 2 columns between 640px and 1024px, and 3 or more columns above 1024px.
4. THE Home Page hero and basket preview sections SHALL be legible and usable at all standard breakpoints (320px minimum).
5. THE Order Execution Panel's preset quick-buy buttons SHALL be tappable with a minimum touch target size of 44×44px on mobile.
