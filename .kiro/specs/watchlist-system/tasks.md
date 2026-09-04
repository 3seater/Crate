# Tasks: Watchlist System

## Task 1: Database Schema and Queries

- [x] 1.1 Create `packages/db/src/schema/watchlist-items.ts` with the `watchlist_items` table schema (id, userId, conditionId, createdAt, updatedAt, unique constraint on userId+conditionId, index on userId, cascade delete FK to users)
- [x] 1.2 Export `watchlistItems` from `packages/db/src/schema/index.ts`
- [x] 1.3 Create `packages/db/src/queries/watchlist-items.ts` with query functions: `addWatchlistItem`, `removeWatchlistItem`, `toggleWatchlistItem`, `listWatchlistItems`, `countWatchlistItems` (following tracked-wallets pattern, 200 item limit, idempotent delete, toggle checks existence)
- [x] 1.4 Export all query functions from `packages/db/src/index.ts`
- [x] 1.5 Run `pnpm db:generate` to generate migration and `pnpm db:push` to apply schema

## Task 2: tRPC Watchlist Router

- [x] 2.1 Create `apps/server/src/routers/watchlist.ts` with `add`, `remove`, `toggle`, `list` procedures using `protectedProcedure`, Zod input validation (conditionId: z.string().min(1)), and error handling pattern matching wallets router
- [x] 2.2 Register `watchlistRouter` in `apps/server/src/routers/index.ts` under the `watchlist` namespace

## Task 3: Frontend Shared Utilities

- [x] 3.1 Create `apps/web/src/components/watchlist/watchlist-utils.ts` with types (`EnrichedWatchlistItem`, `WatchlistPreferences`, `WatchlistMode`) and pure functions (`computePositionValue`, `filterByMode`, `sortItems`, `loadPreferences`, `savePreferences`)

## Task 4: Frontend useWatchlist Hook

- [x] 4.1 Create `apps/web/src/hooks/use-watchlist.ts` — server-backed hook using `trpc.watchlist.list`, `trpc.watchlist.toggle`, Gamma market enrichment via `trpc.markets` or direct Gamma fetch, position data via `trpc.data.positions`, TanStack Query with 30s stale time, exposing `items`, `isStarred`, `toggle`, `isLoading`
- [x] 4.2 Remove `apps/web/src/lib/watchlist-context.tsx` (the old hardcoded WatchlistProvider)
- [x] 4.3 Update `apps/web/src/components/layout/app-shell.tsx` to remove `WatchlistProvider` wrapper import and usage

## Task 5: Refactor WatchlistBar

- [x] 5.1 Refactor `apps/web/src/components/layout/watchlist-bar.tsx` to use `useWatchlist` hook instead of context, integrate `filterByMode`, `sortItems`, `computePositionValue` from watchlist-utils, persist preferences to localStorage, add click-to-navigate using market slug, show skeleton loaders during loading, handle unauthenticated state (disabled chrome, no data fetch)

## Task 6: Watchlist Widget and Bottom Bar Integration

- [x] 6.1 Create `apps/web/src/components/watchlist/watchlist-widget.tsx` — draggable floating panel following WalletTrackerWidget pattern (drag handle, title "Watchlist", close button, Escape key close, same enriched market list, mode toggles, click-to-navigate)
- [x] 6.2 Update `apps/web/src/components/layout/bottom-bar.tsx` to add Watchlist button (Star icon) alongside Wallet Tracker and Calendar, control WatchlistWidget open/close state, disabled when unauthenticated

## Task 7: Property-Based Tests — DB Queries

- [ ] 7.1 Create `tests/unit/watchlist/watchlist-queries.test.ts` with property tests for Properties 1–7 (add returns complete record, duplicate prevention, limit enforcement, remove then absent, idempotent delete, toggle round trip, list sort order) using fast-check, following tracked-wallets-queries.test.ts pattern, skipIf no database
  - [x] 7.1.1 [PBT] Property 1: Add returns a complete record — For any valid conditionId, adding a watchlist item returns a record with id, userId, conditionId, createdAt, updatedAt (Validates: 1.1, 2.1, 5.2)
  - [x] 7.1.2 [PBT] Property 2: Duplicate condition ID prevention — For any conditionId already in the watchlist, adding again throws CONFLICT (Validates: 1.2, 2.2)
  - [x] 7.1.3 [PBT] Property 3: Watchlist limit enforcement — For any user at 200 items, adding another throws FORBIDDEN (Validates: 1.4, 2.3)
  - [x] 7.1.4 [PBT] Property 4: Remove then absent — For any conditionId in the watchlist, removing it makes it absent from the list (Validates: 3.1)
  - [x] 7.1.5 [PBT] Property 5: Idempotent delete — For any conditionId NOT in the watchlist, removing succeeds without error (Validates: 3.2)
  - [x] 7.1.6 [PBT] Property 6: Toggle round trip — For any conditionId, toggle-add then toggle-remove restores original state (Validates: 4.1, 4.2, 4.3)
  - [x] 7.1.7 [PBT] Property 7: List sort order — For any N items, list returns N records sorted by createdAt DESC (Validates: 5.1)

## Task 8: Property-Based Tests — Frontend Utilities

- [ ] 8.1 Create `tests/unit/watchlist/watchlist-utils.test.ts` with property tests for Properties 8–12 using fast-check
  - [x] 8.1.1 [PBT] Property 8: Enrichment completeness — For any watchlist items and matching Gamma records, enrichment produces items with title, yesPrice, noPrice, slug (Validates: 6.1)
  - [x] 8.1.2 [PBT] Property 9: Mode filter correctness — For any items, Position Mode returns only positionSize > 0, Favorites returns all (Validates: 7.1, 8.1)
  - [x] 8.1.3 [PBT] Property 10: Mode mutual exclusivity — For any state, activating one mode deactivates the other (Validates: 7.3, 8.3)
  - [x] 8.1.4 [PBT] Property 11: Position value computation — For any size and price, computePositionValue equals size × price (Validates: 9.1, 9.3)
  - [x] 8.1.5 [PBT] Property 12: Preferences serialization round trip — For any valid preferences, save then load produces equivalent object (Validates: 10.4)

## Task 9: Property-Based Tests — Input Validation

- [ ] 9.1 Create `tests/unit/watchlist/watchlist-validation.test.ts` with property test for Property 13 using fast-check
  - [x] 9.1.1 [PBT] Property 13: Input validation rejection — For any invalid conditionId (empty, whitespace), Zod schema rejects (Validates: 12.3)
