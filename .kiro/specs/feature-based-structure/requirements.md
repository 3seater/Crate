# Requirements Document

## Introduction

This document specifies the requirements for migrating the Doji monorepo from a type-based directory layout to a feature-based directory layout. The migration covers three domains: the web app (`apps/web/src/`), the server app (`apps/server/src/`), and the `@doji/api` package. The goal is co-location — each feature's components, hooks, stores, lib, and types live together under a single directory, making ownership clear and reducing cross-directory navigation. The migration is a single-sweep refactor (one branch, one PR) with no re-export shims.

## Glossary

- **Feature_Module**: A self-contained directory under `features/` containing all code (components, hooks, stores, lib, types) for a single domain. Exposes a public API via `index.ts` (web) or `router.ts` (server).
- **Barrel_File**: An `index.ts` file that re-exports the public API of a feature module. The only file other features may import from.
- **Shared_Module**: The `shared/` directory containing feature-agnostic utilities, hooks, stores, constants, and infrastructure used by two or more features.
- **Layout_Module**: The `layout/` directory containing app shell components (header, bottom bar, dock, providers, widgets).
- **Migration_Tool**: The combination of TypeScript compiler (`pnpm check-types`), Next.js build (`pnpm build`), test runner (`pnpm test`), and linter (`pnpm check`) used to verify migration correctness.
- **Public_API**: The set of exports from a feature's barrel file (`index.ts` or `router.ts`) that other features and routes are allowed to import.
- **Import_Graph**: The directed graph of all TypeScript import statements across the codebase, used to determine file ownership and detect circular dependencies.
- **Feature_Mapping**: A table mapping each source file's current path to its target path in the new feature-based layout.
- **Router_Key**: The string key used in the tRPC root router composition (e.g., `clob`, `data`, `wallets`). Part of the client API contract.
- **Web_App**: The Next.js frontend application at `apps/web/`.
- **Server_App**: The Hono + tRPC API application at `apps/server/`.
- **Store_Owner**: The feature that is the primary consumer and mutator of a Zustand store.

## Requirements

### Requirement 1: Web App Feature Module Creation

**User Story:** As a developer, I want each web domain to have its own self-contained feature directory, so that I can find all related code in one place without navigating across type-based directories.

#### Acceptance Criteria

1. WHEN the migration is complete, THE Web_App SHALL contain feature directories under `features/` for: trading, explore, portfolio, auth, bridge, leaderboard, watchlist, wallet-tracker, comments, and profile.
2. WHEN a Feature_Module is created, THE Web_App SHALL include subdirectories for `components/`, `hooks/`, `stores/`, and `lib/` within that feature, plus a `types.ts` and a Barrel_File (`index.ts`).
3. WHEN files are moved to a Feature_Module, THE Migration_Tool SHALL confirm that `pnpm check-types` passes after the move.
4. WHEN all feature files have been moved, THE Web_App SHALL have no remaining feature-specific files in the old top-level `components/`, `hooks/`, `stores/`, or `lib/` directories.

### Requirement 2: Web App Shared and Layout Modules

**User Story:** As a developer, I want feature-agnostic code separated into a shared module and app shell code into a layout module, so that cross-cutting concerns have a clear home distinct from feature-specific code.

#### Acceptance Criteria

1. THE Shared_Module SHALL contain only files that pass the "would I use this in a different app?" test — no feature-specific business logic.
2. WHEN a utility, hook, store, or constant is used by two or more features with no clear single owner, THE Web_App SHALL place that file in the Shared_Module.
3. THE Layout_Module SHALL contain app shell components (app-shell, site-header, bottom-bar, dock-shell, global-search, providers) and dock widgets (activity, calendar, dock controls).
4. WHEN a store is used by multiple features (wallet, connection, notifications, crypto-prices, balances-hidden), THE Web_App SHALL place that store in `shared/stores/`.

### Requirement 3: Feature Barrel File and Import Boundaries

**User Story:** As a developer, I want each feature to expose a public API through a barrel file, so that cross-feature imports are explicit and internal implementation details are encapsulated.

#### Acceptance Criteria

1. WHEN a Feature_Module is created, THE Web_App SHALL include a Barrel_File (`index.ts`) that re-exports only the symbols imported by files outside that feature.
2. WHEN a file outside a Feature_Module needs to use that feature's code, THE Web_App SHALL require the import to come from the feature's Barrel_File (e.g., `@/features/trading`), not from internal paths (e.g., `@/features/trading/components/orderbook`).
3. WHEN a file inside a Feature_Module imports from the same feature, THE Web_App SHALL use relative imports (not the barrel file).
4. IF a file outside a Feature_Module imports directly from that feature's internal paths, THEN THE Migration_Tool SHALL report a type-check or lint violation.

### Requirement 4: Import Path Updates

**User Story:** As a developer, I want all import paths updated to reflect the new directory structure, so that no broken imports remain after migration.

#### Acceptance Criteria

1. WHEN files are moved to new locations, THE Web_App SHALL update all import statements across the codebase to reference the new paths.
2. THE Web_App SHALL continue using the existing `@/*` import alias (mapping to `./src/*`) without adding new aliases.
3. WHEN a dynamic import (`next/dynamic`) references a moved file, THE Web_App SHALL update that dynamic import path.
4. WHEN a test file in `tests/` references a moved file via `@/` alias, THE Migration_Tool SHALL update that test import path.
5. IF any import statement references an old path after migration, THEN THE Migration_Tool SHALL report a type-check failure.

### Requirement 5: Store Ownership Classification

**User Story:** As a developer, I want each Zustand store assigned to exactly one location based on ownership, so that store responsibility is unambiguous.

#### Acceptance Criteria

1. THE Web_App SHALL place each Zustand store in exactly one location: either `features/{name}/stores/` (owned by that feature) or `shared/stores/` (used by 2+ features with no clear owner).
2. WHEN a store is primarily consumed and mutated by a single feature, THE Web_App SHALL place that store in that feature's `stores/` directory.
3. WHEN a store is consumed by multiple features with no clear primary owner, THE Web_App SHALL place that store in `shared/stores/`.
4. IF a store exists in both a feature directory and `shared/stores/`, THEN THE Migration_Tool SHALL report a conflict.

### Requirement 6: Server App Feature Module Creation

**User Story:** As a developer, I want the server app restructured into feature modules that mirror the web app's feature boundaries, so that working on a domain means touching the same-named directory in both apps.

#### Acceptance Criteria

1. WHEN the migration is complete, THE Server_App SHALL contain feature directories under `features/` for: auth, trading, markets, data, events, bridge, portfolio, and referrals.
2. WHEN a server Feature_Module is created, THE Server_App SHALL include a `router.ts` (tRPC router), and optionally `lib/`, `schemas/`, `config/`, and `routes/` subdirectories.
3. WHEN server files are moved to a Feature_Module, THE Migration_Tool SHALL confirm that `pnpm check-types` passes after the move.
4. THE Server_App SHALL place feature-agnostic infrastructure (resilience, errors, onchain, resilient-fetch, constants) in `shared/`.
5. THE Server_App SHALL place health check and OpenAPI routes in `health/`.

### Requirement 7: Server Router Key and HTTP Route Stability

**User Story:** As a developer, I want the tRPC router keys and HTTP routes to remain unchanged after migration, so that the web client continues to work without any client-side changes.

#### Acceptance Criteria

1. THE Server_App SHALL preserve all existing tRPC Router_Keys (`auth`, `clob`, `data`, `events`, `markets`, `wallets`, `watchlist`, `referrals`, `healthCheck`) in the root router composition.
2. THE Server_App SHALL preserve all existing HTTP routes (`/trpc/*`, `/api/health`, `/api/openapi.json`, `/api/polymarket/sign`) at the same paths.
3. WHEN the root router is recomposed from feature routers, THE Server_App SHALL map each feature router to its original Router_Key (e.g., `tradingRouter` maps to key `clob`).
4. IF a Router_Key is changed or removed, THEN THE Migration_Tool SHALL report a type-check failure in the web client.

### Requirement 8: Server Middleware and Error Handling Preservation

**User Story:** As a developer, I want middleware and error handling to continue functioning after files are relocated, so that caching, authentication, and error mapping remain intact.

#### Acceptance Criteria

1. WHEN Polymarket API client files are moved to feature directories, THE Server_App SHALL ensure `withPolymarketError` and `mapApiErrorToTRPC` continue to catch `ApiError` from all clients.
2. THE Server_App SHALL preserve the `Cache-Control` header middleware in `app.ts` with the same tRPC path pattern matching.
3. WHEN authentication middleware (`protectedProcedure`) is imported by feature routers, THE Server_App SHALL ensure the import path resolves correctly from the new feature locations.

### Requirement 9: Package Restructuring (`@doji/api`)

**User Story:** As a developer, I want web-only transaction builder files moved out of the shared `@doji/api` package into the web app's feature directories, so that the package contains only genuinely shared and server-only code.

#### Acceptance Criteria

1. WHEN the migration is complete, THE `@doji/api` package SHALL contain zero files that are only imported by the Web_App.
2. THE Web_App SHALL move `approval-txs.ts` and `builder.ts` to `features/auth/lib/`.
3. THE Web_App SHALL move `redeem-txs.ts` to `features/portfolio/lib/`.
4. THE Web_App SHALL move `split-merge-txs.ts` to `features/trading/lib/`.
5. THE Web_App SHALL move `transfer-txs.ts` to `features/bridge/lib/`.
6. THE Web_App SHALL move `relayer-errors.ts` to `shared/lib/`.
7. WHEN web-only files are moved out of `@doji/api`, THE Server_App SHALL continue importing server-only and shared code from `@doji/api` without changes.
8. WHEN both apps need `ClobClient` and `createClobClient`, THE `@doji/api` package SHALL continue to export them from `lib/clob`.

### Requirement 10: Build and Type Safety Integrity

**User Story:** As a developer, I want the production build and type checking to pass at every stage of the migration, so that no intermediate state breaks the application.

#### Acceptance Criteria

1. WHEN any file is moved during migration, THE Migration_Tool SHALL confirm that `pnpm check-types` passes.
2. WHEN any file is moved during migration, THE Migration_Tool SHALL confirm that `pnpm build` succeeds.
3. WHEN any file is moved during migration, THE Migration_Tool SHALL confirm that `pnpm test` passes.
4. WHEN any file is moved during migration, THE Migration_Tool SHALL confirm that `pnpm check` (lint) passes.

### Requirement 11: Circular Dependency Prevention

**User Story:** As a developer, I want no circular dependencies between feature modules, so that the dependency graph remains a DAG and features can be reasoned about independently.

#### Acceptance Criteria

1. IF Feature_Module A imports from Feature_Module B, THEN Feature_Module B SHALL NOT import from Feature_Module A.
2. WHEN a circular dependency is detected between two features, THE Web_App SHALL extract the shared dependency into the Shared_Module.
3. WHEN the migration is complete, THE Migration_Tool SHALL confirm that `madge --circular` reports zero cycles in `features/`.

### Requirement 12: Clean Removal of Old Directories

**User Story:** As a developer, I want the old type-based directories removed after migration, so that no orphaned files or empty directories remain.

#### Acceptance Criteria

1. WHEN all features have been migrated, THE Web_App SHALL delete or confirm empty the old top-level `components/`, `hooks/`, `stores/`, and `lib/` directories (excluding files that remain at root by convention like `index.css`).
2. WHEN all server features have been migrated, THE Server_App SHALL delete or confirm empty the old `routers/`, `lib/`, `config/`, and `routes/` directories.
3. IF any file remains in an old directory after migration, THEN THE Migration_Tool SHALL flag it as an orphaned file.

### Requirement 13: AGENTS.md Documentation Updates

**User Story:** As a developer, I want AGENTS.md files updated to reflect the new structure, so that AI agents and new developers can navigate the codebase correctly.

#### Acceptance Criteria

1. WHEN a Feature_Module is created, THE Web_App SHALL create or migrate an AGENTS.md file for that feature.
2. WHEN the migration is complete, THE Web_App SHALL update `apps/web/AGENTS.md` to reflect the feature-based layout.
3. WHEN the server migration is complete, THE Server_App SHALL update `apps/server/AGENTS.md` to reflect the feature-based layout.
4. WHEN a Feature_Module's AGENTS.md references paths, THE AGENTS.md SHALL use the new feature-based paths (not old type-based paths).

### Requirement 14: Migration Order and Dependency Sequencing

**User Story:** As a developer, I want the migration to proceed in dependency order, so that shared infrastructure is available before features that depend on it.

#### Acceptance Criteria

1. THE Web_App SHALL migrate `shared/` and `layout/` before any Feature_Module.
2. THE Web_App SHALL migrate simple features (comments, leaderboard, watchlist, wallet-tracker, bridge, profile) before complex features (auth, explore, portfolio, trading).
3. THE Web_App SHALL migrate the trading feature last (largest, most cross-references).
4. THE Server_App SHALL migrate `shared/` and `health/` before any server Feature_Module.
5. THE Server_App SHALL migrate simple server features (referrals, bridge, auth, events) before complex ones (data, trading).

### Requirement 15: Missing Items Placement

**User Story:** As a developer, I want all previously unmapped files assigned to their correct target locations, so that no files are left behind during migration.

#### Acceptance Criteria

1. THE Web_App SHALL move `components/activity/*` and `components/calendar/*` and `components/widgets/*` to `layout/widgets/`.
2. THE Web_App SHALL move `components/landing/experimental-landing-page.tsx` to `features/explore/components/`.
3. THE Web_App SHALL move `components/share-pnl/*` to `features/portfolio/components/share-pnl/`.
4. THE Web_App SHALL move `components/add-track-wallet-modal-provider.tsx` to `features/wallet-tracker/components/`.
5. THE Web_App SHALL move `components/color-experiment-switcher.tsx` and `components/color-experiment-sync.tsx` to `shared/components/`.
6. THE Web_App SHALL move `hooks/realtime/use-global-activity-feed.ts` to `layout/hooks/`.
7. THE Web_App SHALL move `lib/bridge/utils.ts` to `features/bridge/lib/`.
8. THE Web_App SHALL move `lib/resolution/*` to `features/trading/lib/resolution/`.
9. THE Web_App SHALL move `lib/profile/*` to `features/profile/lib/`.
10. THE Web_App SHALL move `lib/leaderboard/*` to `features/leaderboard/lib/`.
11. THE Web_App SHALL move `config/*` to `shared/config/`.
12. THE Web_App SHALL keep `app/` root-level files (`error.tsx`, `global-error.tsx`, `loading.tsx`, `page.tsx`, `robots.ts`, `sitemap.ts`, `icon.png`) and `app/actions/` in place — these follow Next.js file conventions.
13. THE Web_App SHALL keep `src/index.css` and `src/fonts/` at the source root — these are static assets.
14. THE Web_App SHALL move `src/proxy.ts` to `shared/lib/proxy.ts`.
