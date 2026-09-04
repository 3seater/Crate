# Implementation Plan: Robinhood Chain Basket Terminal

## Overview

This plan converts the existing Doji Polymarket terminal into a Robinhood Chain basket trading terminal. The work proceeds in dependency order: purge Polymarket infrastructure first, establish shared config and server domain, build client libraries and stores, assemble UI components, wire pages, and finish with tests and documentation updates.

All code is TypeScript. Property-based tests use **fast-check** with Vitest.

---

## Tasks

- [x] 1. Purge Polymarket web domains and routes
  - Delete `apps/web/src/domains/auth/`, `domains/bridge/`, `domains/comments/`, `domains/explore/`, `domains/leaderboard/`, `domains/portfolio/`, `domains/profile/`, `domains/referrals/`, `domains/tracker/`, `domains/trading/`, `domains/watchlist/`
  - Delete `apps/web/src/app/(app)/explore/`, `(app)/portfolio/`, `(app)/leaderboard/`, `(app)/watchlist/`, `(app)/wallet-tracker/`, `(app)/referrals/`, `(app)/market/`
  - Delete `apps/web/src/app/(auth)/`
  - Delete `apps/web/src/app/api/geoblock/`, `api/session/`, `api/share-pnl/`, `api/polymarket/`
  - Delete `apps/web/src/lib/ws/` (entire WebSocket infrastructure)
  - Delete `apps/web/src/hooks/use-session.ts`, `use-geoblock.ts`, `use-post-trade-invalidation.ts`
  - Delete `apps/web/src/shell/global-search.tsx`, `global-search-utils.ts`, `search-results.tsx`, `search-ends-cell.tsx`, `use-filtered-search.ts`, `header-search.tsx`, `watchlist-bar.tsx`, `trading-settings-widget.tsx`
  - Delete `apps/web/src/shell/widgets/activity-widget.tsx`, `activity-widget-content.tsx`, `calendar-widget.tsx`, `portfolio-widget.tsx`, `portfolio-widget-content.tsx`
  - Delete `apps/web/src/shell/hooks/use-global-activity-feed.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 2. Purge Polymarket server domains
  - Delete `apps/server/src/domains/activity/`, `auth/`, `bridge/`, `data/`, `events/`, `leaderboard/`, `markets/`, `orders/`, `portfolio/`, `referrals/`, `rewards/`, `tracker/`, `trading/`
  - Update `apps/server/src/routers/index.ts` to remove all deleted domain router imports; replace with a minimal stub (`healthCheck` only) that compiles cleanly
  - Fix any remaining TypeScript errors caused by removed imports so `pnpm check-types` passes
  - _Requirements: 1.6, 1.7_

- [x] 3. Remove Polymarket and Magic/Safe package dependencies
  - Remove `@polymarket/clob-client`, `magic-sdk`, `@magic-ext/oauth2`, `@safe-global/*` entries from `apps/web/package.json`, `apps/server/package.json`, and any workspace root `package.json`
  - Remove any associated type packages and Polygon/CTF-specific dependencies
  - Run `pnpm install` to update lockfile
  - Fix any TypeScript or import errors that surface after removal
  - _Requirements: 1.1, 1.2_

- [x] 4. Add `ENSO_API_KEY` to server environment schema
  - [x] 4.1 Add `ENSO_API_KEY` field to `packages/env/src/server.ts` using T3 Env (required string)
    - Follow the existing pattern for other API key env vars in the file
    - _Requirements: 11.1_
  - [x] 4.2 Write unit test verifying the env schema rejects a missing `ENSO_API_KEY`
    - _Requirements: 11.1_
  - [x] 4.3 Add `ENSO_API_KEY=your_enso_api_key_here` placeholder to `apps/server/.env.example`
    - _Requirements: 11.1_

- [x] 5. Create Robinhood Chain and basket config
  - [x] 5.1 Create `apps/web/src/config/chains.ts` with `robinhoodChain` (viem `defineChain`), `SUPPORTED_CHAINS`, and `ROBINHOOD_CHAIN_ID = 4663`
    - Use exact values from design: name, nativeCurrency, rpcUrls, blockExplorers
    - Export as const assertions
    - _Requirements: 2.1, 2.2_
  - [x] 5.2 Create `packages/types/src/basket.ts` (or `apps/web/src/types/basket.ts`) with `BasketConstituent`, `BasketConfig`, `OhlcvCandle`, `TokenPrice`, `CompositeIndexPoint`, `Timeframe`, `OhlcvResponse` interfaces
    - Follow exact field names and types from the design document
    - Export all types
    - _Requirements: 10.2, 10.3_
  - [x] 5.3 Create `apps/web/src/config/baskets.ts` with `WEIGHT_TOLERANCE`, `validateBaskets()`, `BASKETS` array (3 sample baskets), and `getBasketById()` helper
    - `validateBaskets()` must throw with a descriptive message identifying the basket when weights don't sum to `1.0 ± 0.001`
    - `BASKETS` is the result of `validateBaskets([...])` so validation runs at module load
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_
  - [x] 5.4 Write unit tests for `validateBaskets()`: valid basket passes, invalid weight sum throws with basket id in message, tolerance boundary cases
    - _Requirements: 10.6_

- [x] 6. Build server-side baskets domain
  - [x] 6.1 Create `apps/server/src/domains/baskets/schemas.ts` with all Zod schemas: `BasketConstituentSchema`, `GetBundleInputSchema`, `GetLivePricesInputSchema`, `GetOhlcvInputSchema`, `TxBundleSchema`, `GetBundleOutputSchema`, `TokenPriceSchema`, `OhlcvCandleSchema`, `OhlcvResponseSchema`
    - Follow exact field names, types, and regex patterns from the design
    - _Requirements: 11.2, 12.1_
  - [x] 6.2 Create `apps/server/src/domains/baskets/enso-client.ts` with `buildBuyBundle()` and `buildExitBundle()` functions and the internal `callEnsoBundle()` helper
    - `buildBuyBundle` splits `inputAmountWei` across constituents proportionally by weight using BigInt arithmetic
    - `buildExitBundle` throws `AppError` (BAD_REQUEST) when all exit balances are zero
    - `callEnsoBundle` throws typed `AppError` on non-2xx responses, including the response body error message
    - _Requirements: 11.1, 11.2, 11.3, 11.4_
  - [x] 6.3 Create `apps/server/src/domains/baskets/price-service.ts` with `getLivePrices()` and `getOhlcv()` using LRU caches (30s live, 5m historical), GeckoTerminal primary, DexScreener fallback
    - Both functions return partial results (data for successful tokens + `failedSymbols` list) instead of throwing when a subset fails
    - Use `TIMEFRAME_PARAMS` mapping for 24H/7D/30D → GeckoTerminal API params
    - _Requirements: 12.1, 12.2, 12.3, 12.5_
  - [x] 6.4 Create `apps/server/src/domains/baskets/router.ts` with `basketsRouter` containing `getBundle` (mutation), `getLivePrices` (query), `getOhlcv` (query) procedures
    - `getBundle` uses `publicProcedure` — wallet address provided as input, no server session needed
    - Import basket config from the correct shared path; throw `TRPCError NOT_FOUND` for unknown basket IDs
    - Catch `AppError` from Enso client and re-throw; let `mapApiErrorToTRPC` handle if available
    - _Requirements: 11.5, 12.4_
  - [x] 6.5 Register `basketsRouter` in `apps/server/src/routers/index.ts` replacing the temporary stub
    - Final router: `{ healthCheck, baskets: basketsRouter }`
    - _Requirements: 11.5, 12.4_

- [x] 7. Checkpoint — server domain compiles cleanly
  - Run `pnpm check-types` from repo root. Fix any TypeScript errors in the server domain before proceeding.

- [x] 8. Build core client libraries
  - [x] 8.1 Create `apps/web/src/domains/baskets/lib/composite-index.ts` with `computeCompositeIndex(tokens: TokenCandles[]): CompositeIndexPoint[]`
    - Implement the 5-step algorithm from the design: filter empty tokens, re-normalize weights, union timestamp set, anchor at t₀, weighted normalized sum
    - Handle all edge cases: missing tokens excluded, gap timestamps, all-fail → `[]`, zero anchor price guard, t₀ missing → first candle fallback
    - _Requirements: 7.2, 7.3, 7.8_
  - [x] 8.2 Write property test for `computeCompositeIndex` (Property 1): first returned point always equals 100.0 for any non-empty valid input
    - Use fast-check arbitraries as shown in the design's Correctness Properties section
    - 200 runs minimum
    - _Requirements: 7.2, 7.3_
  - [x] 8.3 Create `apps/web/src/domains/baskets/lib/allocation.ts` with `computeAllocation(constituents, amountEth, priceMap)` returning `AllocationLine[]`
    - Each line: `{ symbol, address, weight, ethAmount, tokenAmount, usdAmount }` where `tokenAmount`/`usdAmount` are null when price unavailable
    - `ethAmount = amountEth * weight` for each constituent
    - _Requirements: 8.3, 8.4_
  - [x] 8.4 Write property test for `computeAllocation` (Property 3): sum of all `ethAmount` values equals input `amountEth` within floating-point tolerance
    - 500 runs minimum
    - _Requirements: 8.3, 8.4_
  - [x] 8.5 Create `apps/web/src/domains/baskets/lib/format-tx.ts` with `formatTxHash(hash)` (truncated `0x1234…5678` format) and `blockExplorerTxUrl(hash)` returning the Robinhood Chain block explorer URL
    - Import `ROBINHOOD_CHAIN_ID` from `@/config/chains` — no hardcoded values
    - _Requirements: 8.7_

- [x] 9. Build Zustand basket terminal store
  - Create `apps/web/src/domains/baskets/stores/basket-terminal.ts` with `useBasketTerminalStore`
  - State: `timeframe: Timeframe` (default "24H"), `activeTokens: string[]` (default [])
  - Actions: `setTimeframe(tf)`, `toggleToken(symbol)` (adds if absent, removes if present)
  - _Requirements: 7.5, 7.6, 7.7_

- [x] 10. Slim down wallet store and add WagmiProvider config
  - [x] 10.1 Update `apps/web/src/stores/wallet.ts` to remove `sessionToken`, `signatureType`, and Magic/Safe-specific fields; keep only `address`, `chainId`, `isConnected` plus `setConnected`, `setDisconnected`, `setChainId` actions
    - Use `persist` middleware with `partialize` to persist only `address` and `isConnected`
    - _Requirements: 3.6_
  - [x] 10.2 Update `apps/web/src/shell/providers.tsx` to replace Magic SDK, Gnosis Safe providers, and Polymarket modals with `WagmiProvider` using `createConfig` (injected connector, Robinhood Chain transport)
    - Keep `QueryClientProvider`, `LazyMotion`, `NuqsAdapter`, `TooltipProvider`, `Toaster`
    - Wagmi config: `chains: [robinhoodChain]`, `connectors: [injected()]`, http transport to `https://rpc.mainnet.chain.robinhood.com`
    - _Requirements: 3.1, 3.6_
  - [x] 10.3 Create a `WalletSyncProvider` client component that syncs Wagmi's `useAccount()` state into the wallet Zustand store on connect/disconnect/chainId change
    - Place in `apps/web/src/shell/wallet-sync-provider.tsx`
    - Mount it inside `providers.tsx` (inside `WagmiProvider`)
    - _Requirements: 3.4, 3.5_

- [x] 11. Build data-fetching hooks
  - [x] 11.1 Create `apps/web/src/domains/baskets/hooks/use-basket-prices.ts` using `useQuery(trpc.baskets.getLivePrices.queryOptions(...))` with `refetchInterval: 30_000` and `staleTime: STALE_REALTIME`
    - _Requirements: 12.4_
  - [x] 11.2 Create `apps/web/src/domains/baskets/hooks/use-ohlcv.ts` using `useQuery(trpc.baskets.getOhlcv.queryOptions(...))` with `refetchInterval: 30_000` for 24H timeframe, no interval for 7D/30D
    - _Requirements: 7.1, 7.9_
  - [x] 11.3 Create `apps/web/src/domains/baskets/hooks/use-allocation-preview.ts` using `useDebounce` (500ms) on the input amount and `useMemo` to compute `AllocationLine[]` from basket constituents and live price data
    - Returns `AllocationLine[]` with null `tokenAmount`/`usdAmount` when price unavailable
    - _Requirements: 8.3, 8.4_
  - [x] 11.4 Create `apps/web/src/domains/baskets/hooks/use-basket-buy.ts` with the `BuyState` state machine (`idle → building → confirming → pending → confirmed → error`) using `useState`, `useSendTransaction`, `useWaitForTransactionReceipt` from wagmi, and `trpcClient.baskets.getBundle.mutate`
    - User rejection (message includes "rejected"/"denied") returns to `"idle"` silently
    - Exports `{ state, txHash, error, executeBuy, receipt }`
    - _Requirements: 8.5, 8.6, 8.7, 8.8, 8.9, 8.10_
  - [x] 11.5 Create `apps/web/src/domains/baskets/hooks/use-basket-exit.ts` mirroring the buy hook's state machine for the exit flow, calling `trpcClient.baskets.getBundle.mutate` with `isExit: true` and the user's token balances
    - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6, 9.7_

- [x] 12. Build shell UI updates
  - [x] 12.1 Replace `apps/web/src/shell/header-nav.tsx` with the basket-terminal nav: links to `/` (Home) and `/baskets` (Baskets), active state detection using `usePathname()`
    - Export both `HeaderNav` and `HeaderNavFallback` (static, no `usePathname`)
    - Use design token active class: `text-primary` / doji-green accent
    - _Requirements: 13.1, 13.2, 13.5_
  - [x] 12.2 Update `apps/web/src/shell/site-header.tsx`: change logo `<Link href>` from `/explore` to `/`, remove `<HeaderSearch />`
    - _Requirements: 13.3_
  - [x] 12.3 Update `apps/web/src/shell/header-actions.tsx`: replace auth/Magic session state with wagmi `useAccount()` for wallet display (truncated address + ETH balance when connected, "Connect Wallet" button when not)
    - Connect wallet button opens wagmi's wallet connection modal
    - _Requirements: 3.2, 3.3, 3.4, 3.5_
  - [x] 12.4 Simplify `apps/web/src/shell/bottom-bar.tsx`: remove all Polymarket-specific dock controls, widgets, and watchlist bar; keep only `BugReportWidget` and `BottomBarStatusLink`
    - _Requirements: 13.4_

- [x] 13. Build shared basket UI components (non-chart, non-order)
  - [x] 13.1 Create `apps/web/src/domains/baskets/components/basket-card.tsx` displaying basket name, constituent token icons, constituent weight percentages, and 24h performance percentage; and `basket-card-skeleton.tsx` as its loading state
    - Use design system tokens; no hardcoded colors
    - _Requirements: 4.4, 5.3_
  - [x] 13.2 Create `apps/web/src/domains/baskets/components/basket-catalog-grid.tsx` as a responsive grid wrapper (1 col mobile, 2 col tablet, 3+ col desktop) rendering `BasketCard` for each basket
    - _Requirements: 5.5_
  - [x] 13.3 Create `apps/web/src/domains/baskets/components/basket-selector.tsx` listing all baskets by name for switching between basket terminals without leaving the page
    - _Requirements: 6.2_
  - [x] 13.4 Create `apps/web/src/domains/baskets/components/constituent-list.tsx` and `constituent-list-item.tsx` showing each token's name, symbol, current price, 24h change, and basket weight
    - Prices come from `useBasketPrices`; show skeleton for unavailable prices
    - _Requirements: 6.3_
  - [x] 13.5 Create `apps/web/src/domains/baskets/components/wrong-network-banner.tsx` using `useChainId()` and `useSwitchChain()` from wagmi; hidden when `chainId === ROBINHOOD_CHAIN_ID`, visible on wrong chain with a "Switch Network" button
    - Show error text for rejected or failed switch; disable button while `isPending`
    - _Requirements: 2.3, 2.4, 2.5, 2.6_
  - [x] 13.6 Create `apps/web/src/domains/baskets/components/tx-status-badge.tsx` displaying the current `BuyState` / exit state with a transaction hash link to `https://robinhoodchain.blockscout.com/tx/{hash}` when available
    - _Requirements: 8.7, 9.5_

- [x] 14. Build order panel components
  - [x] 14.1 Create `apps/web/src/domains/baskets/components/currency-toggle.tsx` for ETH / USDG selection
    - _Requirements: 8.1_
  - [x] 14.2 Create `apps/web/src/domains/baskets/components/quick-buy-presets.tsx` with preset buttons for 0.05, 0.1, 0.5, 1 ETH; minimum 44×44px touch target on mobile
    - Use `Button` variant from `@/ui/button`; no raw `<button>`
    - _Requirements: 8.2, 14.5_
  - [x] 14.3 Create `apps/web/src/domains/baskets/components/allocation-preview.tsx` rendering the `AllocationLine[]` as a table showing symbol, weight %, ETH amount, and USD amount (dashes for unavailable prices)
    - _Requirements: 8.3_
  - [x] 14.4 Create `apps/web/src/domains/baskets/components/buy-panel.tsx` composing `CurrencyToggle`, `QuickBuyPresets`, an `Input` for amount, `AllocationPreview`, and the execute `Button`; wires to `useBasketBuy`
    - Disable execute when wallet not connected (show "Connect Wallet" prompt) or wrong network (show "Switch Network" prompt)
    - _Requirements: 8.1, 8.2, 8.3, 8.5, 8.9, 8.10, 8.11, 8.12_
  - [x] 14.5 Create `apps/web/src/domains/baskets/components/exit-panel.tsx` composing an exit preview (estimated ETH received) and an "Exit Basket to ETH" `Button`; wires to `useBasketExit`
    - Show the button only when the user has non-zero constituent token balances
    - _Requirements: 9.1, 9.2, 9.3, 9.7_
  - [x] 14.6 Create `apps/web/src/domains/baskets/components/order-panel.tsx` as the root panel with Buy / Exit tabs, composing `BuyPanel` and `ExitPanel`; shows `TxStatusBadge` while transaction is in-flight
    - _Requirements: 6.5, 8.7, 8.8_

- [x] 15. Build chart components
  - [x] 15.1 Create `apps/web/src/domains/baskets/components/timeframe-selector.tsx` rendering 24H / 7D / 30D chip row, reading `timeframe` from and dispatching `setTimeframe` to `useBasketTerminalStore`
    - _Requirements: 7.5_
  - [x] 15.2 Create `apps/web/src/domains/baskets/components/token-toggle-chips.tsx` rendering per-token toggle chips for each basket constituent, reading `activeTokens` from and dispatching `toggleToken` to `useBasketTerminalStore`
    - _Requirements: 7.7_
  - [x] 15.3 Create `apps/web/src/domains/baskets/components/composite-index-chart.tsx` using Recharts `<AreaChart>` to render the normalized composite index series; Y-axis anchored at 100; gradient fill uses `--doji-green`; shows loading skeleton when `isLoading`; shows warning label for `failedSymbols`
    - _Requirements: 7.4, 7.8_
  - [x] 15.4 Create `apps/web/src/domains/baskets/components/token-candlestick-chart.tsx` wrapping KLineChart v10 using `useEffect` + DOM ref for imperative initialization; ingests `OhlcvCandle[]` directly (fields already match KLineChart format)
    - _Requirements: 7.7_
  - [x] 15.5 Create `apps/web/src/domains/baskets/components/basket-chart.tsx` as the `"use client"` orchestrator: reads store state, calls `useOhlcv`, runs `computeCompositeIndex`, renders `TimeframeSelector`, `TokenToggleChips`, `CompositeIndexChart`, and per-token `TokenCandlestickChart` inside `<Activity mode="visible"|"hidden">` wrappers
    - _Requirements: 7.1, 7.6, 7.7, 7.9_

- [x] 16. Build pages
  - [x] 16.1 Create `apps/web/src/app/page.tsx` as the Home page Server Component: `await connection()`, prefetch live prices for first 4 baskets via `serverTrpc`, render `HomeHero` + `<Suspense>`-wrapped `BasketCatalogGrid`
    - Remove any existing redirect to `/explore`
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 4.6_
  - [x] 16.2 Create `apps/web/src/domains/baskets/components/home-hero.tsx` Server Component with headline, subheadline, and CTA `Button` (variant `default`) that navigates to `/baskets`
    - _Requirements: 4.2_
  - [x] 16.3 Create `apps/web/src/app/(app)/baskets/page.tsx` as the Baskets Directory Server Component: `await connection()`, prefetch all pool addresses, render `<ContentWidth>/<ContentSpacing>` + `<Suspense>`-wrapped `BasketCatalogGrid`
    - _Requirements: 5.1, 5.2, 5.4, 5.6_
  - [x] 16.4 Create `apps/web/src/app/(app)/baskets/[basketId]/page.tsx` as the Basket Terminal Server Component with `generateStaticParams`, `generateMetadata`, `notFound()` guard, `await connection()`, live price prefetch, and the two-column responsive layout (chart + constituent list on left, `WrongNetworkBanner` + `OrderPanel` on right)
    - Left column: `BasketSelector`, `ConstituentList`, `<Suspense>`-wrapped `BasketChart`
    - Right column (sidebar, `w-80` on `md+`): `WrongNetworkBanner`, `OrderPanel`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 14.1, 14.2_

- [x] 17. Checkpoint — full build passes
  - Run `pnpm check-types` and `pnpm build` from repo root. Fix any remaining TypeScript or build errors before writing tests.

- [x] 18. Write property-based and unit tests
  - [x] 18.1 Write property test for Property 1 (composite index at t₀ = 100.0) in `tests/unit/composite-index.test.ts`
    - Use fast-check arbitraries from design: `candleArb`, `tokenCandlesArb`; normalize weights before calling; assert `result[0].value` is approximately 100.0; 200 runs
    - _Requirements: 7.2, 7.3_
  - [x] 18.2 Write property test for Property 2 (basket weight sum validation) in `tests/unit/basket-config.test.ts`
    - Generate random weight arrays; normalize to get a valid case, perturb beyond tolerance for invalid case; assert `isValidWeightSum` returns correct boolean; 500 runs
    - _Requirements: 10.6_
  - [x] 18.3 Write property test for Property 3 (allocation splits sum to input) in `tests/unit/allocation.test.ts`
    - Normalize arbitrary constituent weights; compute allocation; assert sum of `ethAmount` equals `depositEth` within floating-point tolerance; 500 runs
    - _Requirements: 8.3, 8.4_
  - [x] 18.4 Write property test for Property 4 (DexScreener fallback always attempted) in `tests/unit/price-service.test.ts`
    - Use vi.fn() to mock GeckoTerminal fetch (rejects) and DexScreener fetch (resolves); assert both mocks were called; 100 runs
    - _Requirements: 12.1, 12.2_
  - [x] 18.5 Write property test for Property 5 (partial results on partial source failure) in `tests/unit/price-service-partial.test.ts`
    - Simulate a price service with a mix of passing and failing pool addresses; assert `prices.length + failedSymbols.length === tokens.length`; 200 runs
    - _Requirements: 12.5_
  - [x] 18.6 Write integration tests for tRPC baskets router in `tests/integration/baskets-router.test.ts`
    - `getLivePrices`: mock GeckoTerminal/DexScreener HTTP, verify response shape and partial failure case
    - `getOhlcv`: mock HTTP, verify timeframe parameter mapping and cache hit/miss behavior
    - `getBundle`: mock Enso API, verify `chainId: 4663` in request body, correct weight-split amounts in actions
    - _Requirements: 11.3, 12.3, 12.4_

- [x] 19. Update documentation
  - [x] 19.1 Update `apps/web/AGENTS.md`: replace routes table (remove Polymarket routes, add `/`, `/baskets`, `/baskets/[basketId]`), add `domains/baskets/` to domain list, update key files table to reflect removed WebSocket/session infrastructure
    - _Requirements: 13.1, 13.2_
  - [x] 19.2 Update `apps/server/AGENTS.md` (or create if missing): add `domains/baskets/` to domain list with description of `router.ts`, `enso-client.ts`, `price-service.ts`, `schemas.ts`
    - _Requirements: 11.1_

- [x] 20. Final checkpoint — lint, types, tests all pass
  - Run `pnpm fix` (Ultracite/Biome format + lint)
  - Run `pnpm check-types` to verify TypeScript across all packages
  - Run `pnpm test:unit` and `pnpm test:integration` to verify all test suites pass

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The dependency order is: purge (1–3) → env/config (4–5) → server (6) → client lib/stores (8–11) → shell (12) → UI components (13–15) → pages (16) → tests (18) → docs (19)
- Property tests require `fast-check` — add it as a dev dependency if not present: `pnpm add -D fast-check --filter=...`
- Basket token addresses in `config/baskets.ts` are illustrative placeholders; replace with actual Robinhood Chain contract addresses once available
- The `WalletSyncProvider` bridges Wagmi (authoritative) and the Zustand store (SSR-safe reads); Wagmi's `useAccount()` is always the live source of truth

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2", "3"] },
    { "id": 1, "tasks": ["4.1", "4.3", "5.1", "5.2"] },
    { "id": 2, "tasks": ["4.2", "5.3", "6.1"] },
    { "id": 3, "tasks": ["5.4", "6.2", "6.3"] },
    { "id": 4, "tasks": ["6.4", "8.1", "8.3", "8.5", "9"] },
    { "id": 5, "tasks": ["6.5", "8.2", "8.4", "10.1", "10.2", "11.1", "11.2"] },
    { "id": 6, "tasks": ["10.3", "11.3", "11.4", "11.5", "13.5"] },
    { "id": 7, "tasks": ["12.1", "12.2", "12.3", "12.4", "13.1", "13.2", "13.3", "13.4", "13.6"] },
    { "id": 8, "tasks": ["14.1", "14.2", "14.3", "15.1", "15.2", "15.3", "15.4"] },
    { "id": 9, "tasks": ["14.4", "14.5", "15.5"] },
    { "id": 10, "tasks": ["14.6", "16.2"] },
    { "id": 11, "tasks": ["16.1", "16.3", "16.4"] },
    { "id": 12, "tasks": ["18.1", "18.2", "18.3", "18.4", "18.5", "18.6"] },
    { "id": 13, "tasks": ["19.1", "19.2"] }
  ]
}
```
