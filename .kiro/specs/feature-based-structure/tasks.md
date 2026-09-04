# Implementation Plan: Feature-Based Structure Refactor

## Overview

Single-sweep migration of the Doji monorepo from type-based to feature-based directory layout. Covers web app, server app, and `@doji/api` package restructuring. Migration proceeds in dependency order: shared infrastructure first, simple features next, complex features last. No re-export shims — all imports updated in place. tRPC router keys and HTTP routes remain unchanged.

## Tasks

- [ ] 1. Web App — Create `shared/` and `layout/` modules
  - [ ] 1.1 Create `shared/` directory structure and move files
    - Create `apps/web/src/shared/` with subdirectories: `components/`, `components/ui/`, `hooks/`, `hooks/realtime/`, `lib/`, `lib/trpc/`, `lib/websocket/`, `lib/datadog/`, `lib/seo/`, `stores/`, `constants/`, `utils/`, `config/`
    - Move `components/ui/*` → `shared/components/ui/*`
    - Move shared components (`error-fallback.tsx`, `analytics-scripts.tsx`, `datadog-*.tsx`, `theme-provider.tsx`, `notifications-setup.tsx`, `user-channel-setup.tsx`, `color-experiment-switcher.tsx`, `color-experiment-sync.tsx`) → `shared/components/`
    - Move shared hooks (`use-hydrated.ts`, `use-sliding-tab-indicator.ts`, `use-table-time-tick.ts`, `use-widget-resize.tsx`, `use-geoblock.ts`, `use-crypto-prices.ts`, `use-notifications.ts`, `use-prefetch-bottom-bar-widgets.ts`, `use-resolved-color-experiment.ts`) → `shared/hooks/`
    - Move shared stores (`wallet.ts`, `connection.ts`, `notifications.ts`, `crypto-prices.ts`, `balances-hidden.ts`) → `shared/stores/`
    - Move `lib/trpc/*` → `shared/lib/trpc/`, `lib/trpc-server.ts` → `shared/lib/trpc-server.ts`
    - Move `lib/websocket/*` → `shared/lib/websocket/`, `lib/datadog/*` → `shared/lib/datadog/`, `lib/seo/*` → `shared/lib/seo/`
    - Move standalone lib files (`server-cache.ts`, `server-utils.ts`, `api-queue.ts`, `app-toast.ts`, `infinite-query.ts`, `notification-sound.ts`, `session-manager.ts`, `table-formats.ts`) → `shared/lib/`
    - Move `utils/*` → `shared/utils/`, `constants/*` → `shared/constants/`, `constants.ts` → `shared/constants/index.ts`
    - Move `config/*` → `shared/config/`
    - Move `src/proxy.ts` → `shared/lib/proxy.ts`
    - Update all import paths across the codebase for moved files
    - _Requirements: 2.1, 2.2, 2.4, 4.1, 4.2, 5.3, 14.1, 15.5, 15.11, 15.14_

  - [ ] 1.2 Create `layout/` directory structure and move files
    - Create `apps/web/src/layout/` with subdirectories: `stores/`, `hooks/`, `widgets/`
    - Move layout components (`app-shell.tsx`, `site-header.tsx`, `bottom-bar.tsx`, `dock-shell.tsx`, `global-search.tsx`) from `components/layout/` → `layout/`
    - Move `components/providers.tsx` → `layout/providers.tsx`
    - Move `stores/dock-layout.ts` → `layout/stores/dock-layout.ts`
    - Move `components/activity/*` → `layout/widgets/`
    - Move `components/calendar/*` → `layout/widgets/`
    - Move `components/widgets/*` (dock-icon-left, dock-icon-right, widget-dock-controls) → `layout/widgets/`
    - Move `hooks/realtime/use-global-activity-feed.ts` → `layout/hooks/use-global-activity-feed.ts`
    - Update all import paths across the codebase for moved files
    - _Requirements: 2.3, 4.1, 14.1, 15.1, 15.6_

- [ ] 2. Checkpoint — Verify shared/layout migration
  - Run `pnpm check-types` to confirm type safety
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Web App — Migrate simple features
  - [ ] 3.1 Create `features/comments/` and move files
    - Create `apps/web/src/features/comments/` with `components/`, `hooks/`, `stores/`, `lib/`, `types.ts`, `index.ts`
    - Move `hooks/use-comments.ts` → `features/comments/hooks/use-comments.ts`
    - Create barrel file `features/comments/index.ts` re-exporting public API
    - Update all import paths
    - _Requirements: 1.1, 1.2, 3.1, 4.1_

  - [ ] 3.2 Create `features/leaderboard/` and move files
    - Create `apps/web/src/features/leaderboard/` with `components/`, `hooks/`, `stores/`, `lib/`, `types.ts`, `index.ts`
    - Move `components/leaderboard/*` → `features/leaderboard/components/`
    - Move `lib/leaderboard/*` → `features/leaderboard/lib/`
    - Create barrel file re-exporting public API
    - Update all import paths
    - _Requirements: 1.1, 1.2, 3.1, 4.1, 15.10_

  - [ ] 3.3 Create `features/watchlist/` and move files
    - Create `apps/web/src/features/watchlist/` with `components/`, `hooks/`, `stores/`, `lib/`, `types.ts`, `index.ts`
    - Move `components/watchlist/*` → `features/watchlist/components/`
    - Move `hooks/use-watchlist.ts` → `features/watchlist/hooks/use-watchlist.ts`
    - Create barrel file re-exporting public API
    - Update all import paths
    - _Requirements: 1.1, 1.2, 3.1, 4.1_

  - [ ] 3.4 Create `features/wallet-tracker/` and move files
    - Create `apps/web/src/features/wallet-tracker/` with `components/`, `hooks/`, `stores/`, `lib/`, `types.ts`, `index.ts`
    - Move `components/wallet-tracker/*` → `features/wallet-tracker/components/`
    - Move `components/add-track-wallet-modal-provider.tsx` → `features/wallet-tracker/components/`
    - Move `hooks/realtime/use-wallet-tracker-live-trades.ts` → `features/wallet-tracker/hooks/use-wallet-tracker-live-trades.ts`
    - Move `stores/wallet-tracker-sound.ts` → `features/wallet-tracker/stores/wallet-tracker-sound.ts`
    - Create barrel file re-exporting public API
    - Update all import paths
    - _Requirements: 1.1, 1.2, 3.1, 4.1, 15.4_

  - [ ] 3.5 Create `features/bridge/` and move files
    - Create `apps/web/src/features/bridge/` with `components/`, `hooks/`, `stores/`, `lib/`, `types.ts`, `index.ts`
    - Move `components/bridge/*` → `features/bridge/components/`
    - Move `lib/bridge/*` → `features/bridge/lib/`
    - Move `stores/bridge-activity.ts` → `features/bridge/stores/bridge-activity.ts`
    - Create barrel file re-exporting public API
    - Update all import paths
    - _Requirements: 1.1, 1.2, 3.1, 4.1, 15.7_

  - [ ] 3.6 Create `features/profile/` and move files
    - Create `apps/web/src/features/profile/` with `components/`, `hooks/`, `stores/`, `lib/`, `types.ts`, `index.ts`
    - Move `components/profile/*` → `features/profile/components/`
    - Move `lib/profile/*` → `features/profile/lib/`
    - Create barrel file re-exporting public API
    - Update all import paths
    - _Requirements: 1.1, 1.2, 3.1, 4.1, 15.9_

- [ ] 4. Checkpoint — Verify simple feature migrations
  - Run `pnpm check-types` and `pnpm build` to confirm no regressions
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Web App — Migrate complex features
  - [ ] 5.1 Create `features/auth/` and move files
    - Create `apps/web/src/features/auth/` with `components/`, `components/onboarding/`, `hooks/`, `stores/`, `lib/`, `lib/magic/`, `types.ts`, `index.ts`
    - Move `components/auth/*` → `features/auth/components/`
    - Move `components/onboarding/*` → `features/auth/components/onboarding/`
    - Move `lib/magic/*` → `features/auth/lib/magic/`
    - Create barrel file re-exporting public API
    - Update all import paths
    - _Requirements: 1.1, 1.2, 3.1, 4.1, 14.2_

  - [ ] 5.2 Create `features/explore/` and move files
    - Create `apps/web/src/features/explore/` with `components/`, `hooks/`, `stores/`, `lib/`, `types.ts`, `index.ts`
    - Move `components/explore/*` → `features/explore/components/`
    - Move `components/landing/experimental-landing-page.tsx` → `features/explore/components/landing-page.tsx`
    - Create barrel file re-exporting public API
    - Update all import paths
    - _Requirements: 1.1, 1.2, 3.1, 4.1, 14.2, 15.2_

  - [ ] 5.3 Create `features/portfolio/` and move files
    - Create `apps/web/src/features/portfolio/` with `components/`, `components/share-pnl/`, `hooks/`, `stores/`, `lib/`, `types.ts`, `index.ts`
    - Move `components/portfolio/*` → `features/portfolio/components/`
    - Move `components/share-pnl/*` → `features/portfolio/components/share-pnl/`
    - Move `hooks/portfolio/*` → `features/portfolio/hooks/`
    - Move `lib/portfolio/*` → `features/portfolio/lib/`
    - Move `stores/portfolio-layout.ts` → `features/portfolio/stores/portfolio-layout.ts`
    - Create barrel file re-exporting public API
    - Update all import paths
    - _Requirements: 1.1, 1.2, 3.1, 4.1, 14.2, 15.3_

  - [ ] 5.4 Create `features/trading/` and move files (largest feature — last)
    - Create `apps/web/src/features/trading/` with `components/`, `components/charts/`, `components/market/`, `components/event/`, `components/orders/`, `hooks/`, `hooks/sports/`, `stores/`, `lib/`, `lib/markets/`, `lib/resolution/`, `types.ts`, `index.ts`
    - Move `components/trading/*` → `features/trading/components/`
    - Move `components/charts/*` → `features/trading/components/charts/`
    - Move `components/market/*` → `features/trading/components/market/`
    - Move `components/event/*` → `features/trading/components/event/`
    - Move `hooks/trading/*` → `features/trading/hooks/`
    - Move `hooks/realtime/use-live-trades.ts` → `features/trading/hooks/use-live-trades.ts`
    - Move `hooks/realtime/use-user-channel.ts` → `features/trading/hooks/use-user-channel.ts`
    - Move `hooks/sports/*` → `features/trading/hooks/sports/`
    - Move `hooks/use-market-volume.ts`, `hooks/use-prefetch-market.ts` → `features/trading/hooks/`
    - Move all trading stores (orderbook, orders, positions, order-form, market-volume, workspace-layout, workspace-layout-chart-fr-boot, trading-ui-preferences, pending-balance-deltas, pending-position-tokens, cash-balance-pulse) → `features/trading/stores/`
    - Move `lib/trading/*` → `features/trading/lib/`
    - Move `lib/markets/*` → `features/trading/lib/markets/`
    - Move `lib/resolution/*` → `features/trading/lib/resolution/`
    - Create barrel file re-exporting public API (components, hooks, stores, types used by other features and routes)
    - Update all import paths across the entire codebase
    - _Requirements: 1.1, 1.2, 1.4, 3.1, 3.2, 4.1, 4.3, 5.1, 5.2, 14.3, 15.8_

- [ ] 6. Checkpoint — Verify all web feature migrations
  - Run `pnpm check-types` and `pnpm build`
  - Run `pnpm test` to confirm all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Server App — Create `shared/` and `health/` modules
  - [ ] 7.1 Create server `shared/` directory and move files
    - Create `apps/server/src/shared/` with subdirectories: `resilience/`, `errors/`, `onchain/`
    - Move `lib/resilience/*` → `shared/resilience/`
    - Move `lib/errors/*` → `shared/errors/`
    - Move `lib/onchain/*` → `shared/onchain/`
    - Move `lib/polymarket/resilient-fetch.ts` → `shared/resilient-fetch.ts`
    - Move `lib/validate-config.ts` → `shared/validate-config.ts`
    - Move `constants.ts` → `shared/constants.ts`
    - Update all server import paths
    - _Requirements: 6.4, 8.1, 8.3, 14.4_

  - [ ] 7.2 Create server `health/` directory and move files
    - Create `apps/server/src/health/`
    - Move `routers/health.ts` → `health/router.ts`
    - Move `routers/openapi.ts` → `health/openapi.ts`
    - Update imports in `app.ts` and root router
    - _Requirements: 6.5, 7.2, 14.4_

- [ ] 8. Server App — Migrate simple features
  - [ ] 8.1 Create server `features/referrals/` and move files
    - Create `apps/server/src/features/referrals/`
    - Move `routers/referrals.ts` → `features/referrals/router.ts`
    - Update imports
    - _Requirements: 6.1, 6.2, 14.5_

  - [ ] 8.2 Create server `features/bridge/` and move files
    - Create `apps/server/src/features/bridge/` with `routes/`, `lib/`, `config/`, `schemas/`
    - Move `routers/bridge.ts` → `features/bridge/router.ts`
    - Move `routes/polymarket/sign.ts` → `features/bridge/routes/sign.ts`
    - Move `lib/polymarket/bridge.ts` → `features/bridge/lib/bridge-api.ts`
    - Move `lib/polymarket/schemas/bridge.ts` → `features/bridge/schemas/bridge.ts`
    - Move `config/bridge.ts` → `features/bridge/config/bridge.ts`
    - Update imports; ensure HTTP route `/api/polymarket/sign` still works from `app.ts`
    - _Requirements: 6.1, 6.2, 7.2, 14.5_

  - [ ] 8.3 Create server `features/auth/` and move files
    - Create `apps/server/src/features/auth/`
    - Move `routers/auth.ts` → `features/auth/router.ts`
    - Update imports
    - _Requirements: 6.1, 6.2, 14.5_

  - [ ] 8.4 Create server `features/events/` and move files
    - Create `apps/server/src/features/events/`
    - Move `routers/events.ts` → `features/events/router.ts`
    - Update imports
    - _Requirements: 6.1, 6.2, 14.5_

- [ ] 9. Server App — Migrate complex features
  - [ ] 9.1 Create server `features/portfolio/` and move files
    - Create `apps/server/src/features/portfolio/`
    - Move `routers/wallets.ts` → `features/portfolio/router.ts` (wallets section)
    - Move `routers/watchlist.ts` → merge into `features/portfolio/router.ts` (watchlist section)
    - Update imports
    - _Requirements: 6.1, 6.2, 14.5_

  - [ ] 9.2 Create server `features/markets/` and move files
    - Create `apps/server/src/features/markets/` with `lib/`, `lib/enrich/`, `schemas/`
    - Move `routers/markets.ts` → `features/markets/router.ts`
    - Move `lib/polymarket/gamma.ts` → `features/markets/lib/gamma.ts`
    - Move `lib/polymarket/filters.ts` → `features/markets/lib/filters.ts`
    - Move `lib/polymarket/enrich/enrich-markets-with-events.ts` → `features/markets/lib/enrich/enrich-markets-with-events.ts`
    - Move `lib/polymarket/enrich/enrich-search-profiles.ts` → `features/markets/lib/enrich/enrich-search-profiles.ts`
    - Move `lib/polymarket/schemas/gamma.ts` → `features/markets/schemas/gamma.ts`
    - Update imports
    - _Requirements: 6.1, 6.2, 14.5_

  - [ ] 9.3 Create server `features/data/` and move files
    - Create `apps/server/src/features/data/` with `lib/`, `lib/subgraph/`, `lib/enrich/`, `schemas/`
    - Move `routers/data.ts` → `features/data/router.ts`
    - Move `lib/polymarket/data.ts` → `features/data/lib/data-api.ts`
    - Move `lib/polymarket/subgraph/*` → `features/data/lib/subgraph/`
    - Move `lib/polymarket/enrich/enrich-positions.ts` → `features/data/lib/enrich/enrich-positions.ts`
    - Move `lib/polymarket/enrich/enrich-leaderboard.ts` → `features/data/lib/enrich/enrich-leaderboard.ts`
    - Move `lib/polymarket/schemas/data.ts` → `features/data/schemas/data.ts`
    - Update imports
    - _Requirements: 6.1, 6.2, 14.5_

  - [ ] 9.4 Create server `features/trading/` and move files
    - Create `apps/server/src/features/trading/` with `lib/`, `schemas/`
    - Move `routers/clob.ts` → `features/trading/router.ts`
    - Move `lib/polymarket/clob-read.ts` → `features/trading/lib/clob-read.ts`
    - Move `lib/polymarket/tradeability-cache.ts` → `features/trading/lib/tradeability-cache.ts`
    - Move `lib/polymarket/liquidity-metrics.ts` → `features/trading/lib/liquidity-metrics.ts`
    - Move `lib/polymarket/schemas/clob.ts` → `features/trading/schemas/clob.ts`
    - Update imports
    - _Requirements: 6.1, 6.2, 14.5_

  - [ ] 9.5 Compose root router from feature routers
    - Create `apps/server/src/router.ts` that imports all feature routers and health router
    - Map each feature router to its original tRPC key: `auth`, `clob` (trading), `data`, `events`, `markets`, `wallets` (portfolio), `referrals`, `healthCheck`
    - Update `app.ts` to import root router from new location
    - Verify `withPolymarketError` and `mapApiErrorToTRPC` still catch `ApiError` from all relocated clients
    - Verify `Cache-Control` middleware path patterns still match
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3_

- [ ] 10. Checkpoint — Verify server migration
  - Run `pnpm check-types` and `pnpm build`
  - Run `pnpm test` to confirm all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Package restructuring — Move web-only files from `@doji/api`
  - [ ] 11.1 Move web-only transaction builders to web feature directories
    - Move `packages/api/src/lib/approval-txs.ts` → `apps/web/src/features/auth/lib/approval-txs.ts`
    - Move `packages/api/src/lib/builder.ts` → `apps/web/src/features/auth/lib/builder.ts`
    - Move `packages/api/src/lib/redeem-txs.ts` → `apps/web/src/features/portfolio/lib/redeem-txs.ts`
    - Move `packages/api/src/lib/split-merge-txs.ts` → `apps/web/src/features/trading/lib/split-merge-txs.ts`
    - Move `packages/api/src/lib/transfer-txs.ts` → `apps/web/src/features/bridge/lib/transfer-txs.ts`
    - Move `packages/api/src/lib/relayer-errors.ts` → `apps/web/src/shared/lib/relayer-errors.ts`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ] 11.2 Update web imports from `@doji/api` to local paths
    - Replace all `import ... from "@doji/api/lib/approval-txs"` → `@/features/auth/lib/approval-txs`
    - Replace all `import ... from "@doji/api/lib/builder"` → `@/features/auth/lib/builder`
    - Replace all `import ... from "@doji/api/lib/redeem-txs"` → `@/features/portfolio/lib/redeem-txs`
    - Replace all `import ... from "@doji/api/lib/split-merge-txs"` → `@/features/trading/lib/split-merge-txs`
    - Replace all `import ... from "@doji/api/lib/transfer-txs"` → `@/features/bridge/lib/transfer-txs`
    - Replace all `import ... from "@doji/api/lib/relayer-errors"` → `@/shared/lib/relayer-errors`
    - Verify server imports from `@doji/api` are unchanged (ClobClient, createClobClient, router, procedures)
    - Remove moved files from `packages/api/src/lib/` and update `packages/api` exports if needed
    - _Requirements: 9.7, 9.8, 4.1_

- [ ] 12. Checkpoint — Verify package restructuring
  - Run `pnpm check-types` and `pnpm build`
  - Run `pnpm test` to confirm all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Clean up old directories and update test imports
  - [ ] 13.1 Delete empty old web directories
    - Delete or confirm empty: `apps/web/src/components/` (old type-based dirs), `apps/web/src/hooks/`, `apps/web/src/stores/`, `apps/web/src/lib/`, `apps/web/src/utils/`, `apps/web/src/constants/`, `apps/web/src/config/`
    - Keep `apps/web/src/app/`, `apps/web/src/index.css`, `apps/web/src/fonts/` in place
    - Flag any orphaned files that weren't moved
    - _Requirements: 12.1, 12.3, 15.12, 15.13_

  - [ ] 13.2 Delete empty old server directories
    - Delete or confirm empty: `apps/server/src/routers/`, `apps/server/src/lib/`, `apps/server/src/config/`, `apps/server/src/routes/`
    - Flag any orphaned files
    - _Requirements: 12.2, 12.3_

  - [ ] 13.3 Update test file imports
    - Update all `tests/unit/`, `tests/integration/`, `tests/e2e/` import paths from old `@/` paths to new feature-based paths
    - Verify dynamic imports (`next/dynamic`) reference new paths
    - _Requirements: 4.4, 4.3_

- [ ] 14. AGENTS.md documentation updates
  - [ ] 14.1 Create feature-level AGENTS.md files for web
    - Create or migrate AGENTS.md for each web feature: `features/trading/`, `features/explore/`, `features/portfolio/`, `features/auth/`, `features/bridge/`, `features/leaderboard/`, `features/watchlist/`, `features/wallet-tracker/`, `features/comments/`, `features/profile/`
    - Create `shared/AGENTS.md` and `layout/AGENTS.md`
    - Ensure all paths in AGENTS.md files use new feature-based paths
    - _Requirements: 13.1, 13.4_

  - [ ] 14.2 Update `apps/web/AGENTS.md`
    - Replace "Project Structure" section with feature-based layout
    - Update all cross-references to use new paths
    - Update "Where to Look" table
    - _Requirements: 13.2_

  - [ ] 14.3 Create feature-level AGENTS.md files for server
    - Create AGENTS.md for server features: `features/trading/`, `features/markets/`, `features/data/`, `features/auth/`, `features/bridge/`, `features/portfolio/`, `features/referrals/`, `features/events/`
    - Create `shared/AGENTS.md`
    - _Requirements: 13.1, 13.4_

  - [ ] 14.4 Update `apps/server/AGENTS.md`
    - Replace "Structure" section with feature-based layout
    - Update all cross-references to use new paths
    - _Requirements: 13.3_

- [ ] 15. Final verification
  - [ ] 15.1 Run full verification suite
    - Run `pnpm check-types` — must pass with zero errors
    - Run `pnpm build` — must succeed
    - Run `pnpm test` — all tests must pass
    - Run `pnpm check` (lint) — must pass
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 15.2 Write property test: no old-path imports remain
    - **Property 8: No Old-Path Imports Remain**
    - Grep the entire codebase for imports referencing old paths (`@/components/{feature}`, `@/hooks/{feature}`, `@/stores/{store}`, `@/lib/{feature}`)
    - Assert zero matches
    - **Validates: Requirements 1.4, 4.1, 4.5**

  - [ ]* 15.3 Write property test: barrel file enforcement
    - **Property 3: No Orphaned Imports (Barrel Enforcement)**
    - For each feature module, scan all files outside that feature for imports that reach into internal paths (`@/features/{name}/components/...`, `@/features/{name}/hooks/...`)
    - Assert all cross-feature imports use barrel files only (`@/features/{name}`)
    - **Validates: Requirements 3.2, 3.4**

  - [ ]* 15.4 Write property test: no circular feature dependencies
    - **Property 4: Feature Isolation (No Circular Dependencies)**
    - Run `madge --circular` on `features/` directories (or equivalent static analysis)
    - Assert zero circular dependencies between feature modules
    - **Validates: Requirements 11.1, 11.2, 11.3**

  - [ ]* 15.5 Write property test: store ownership uniqueness
    - **Property 6: Store Ownership Uniqueness**
    - Scan all `features/*/stores/` and `shared/stores/` directories
    - Assert each store file name appears in exactly one location
    - **Validates: Requirements 5.1, 5.4**

  - [ ]* 15.6 Write property test: router key stability
    - **Property 11: Router Key Stability**
    - Parse the root router composition in `apps/server/src/router.ts`
    - Assert all expected keys exist: `auth`, `clob`, `data`, `events`, `markets`, `wallets`, `referrals`, `healthCheck`
    - **Validates: Requirements 7.1, 7.3**

  - [ ]* 15.7 Write property test: no web-only code in packages
    - **Property 15: No Web-Only Code in Packages**
    - Scan `packages/api/src/lib/` for files only imported by `apps/web/`
    - Assert zero web-only files remain in the package
    - **Validates: Requirement 9.1**

  - [ ]* 15.8 Write property test: clean removal of old directories
    - **Property 10: Clean Removal**
    - Assert old directories (`components/`, `hooks/`, `stores/`, `lib/` in web; `routers/`, `lib/`, `config/`, `routes/` in server) are empty or deleted
    - **Validates: Requirements 12.1, 12.2, 12.3**

- [ ] 16. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each major phase
- Property tests validate structural correctness properties from the design document
- The migration is a single sweep (one branch, one PR) — no re-export shims
- tRPC router keys (`clob`, `wallets`, etc.) must NOT change — they're part of the client API contract
- The existing `@/*` import alias covers all new paths — no tsconfig changes needed
