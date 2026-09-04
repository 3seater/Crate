# Doji V2 — Master Migration Overview

> The execution plan. V2.md is the architectural vision; this document is the phased roadmap with risk assessment, dependency graph, audit resolutions, and success criteria.
>
> **Date:** 2026-05-02
> **Status:** Planning

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Phase Plan](#2-phase-plan)
3. [Risk Assessment](#3-risk-assessment)
4. [Principles](#4-principles)
5. [Dependencies Between Phases](#5-dependencies-between-phases)
6. [V2.md Audit Resolutions](#6-v2md-audit-resolutions)
7. [Success Criteria](#7-success-criteria)

---

## 1. Executive Summary

### What V2 Is

V2 is **not a rewrite**. It is a set of incremental architectural improvements applied to a codebase that already has the correct stack (Next.js 16, React 19, tRPC, TanStack Query, Zustand, Drizzle) but has drifted in structure. The goal is to make the structure as correct as the stack.

### The Four Core Bets

1. **Domain-first organization** — folders map to the product's conceptual domains (`orders`, `portfolio`, `tracker`), not to infrastructure names (`clob`, `data`, `wallets`) or page names (`features/explore`)
2. **Server as truth for session** — auth state lives in a server query (`trpc.auth.me`), not localStorage; eliminates the entire class of stale-session bugs that `session-cookie-sync.tsx` was built to paper over
3. **WebSocket as cache updater** — real-time data flows into TanStack Query's cache via sync hooks; Zustand never mirrors server state; components read from TQ, never from WS directly
4. **One error type** — `AppError extends TRPCError` with `why`/`fix`/`link` fields; no duck-typing, no two competing patterns (`createAppError` vs raw `TRPCError`)

### Current State Snapshot (2026-05-02)

| Metric | Count |
|--------|-------|
| tRPC routers | 10 (9 files + 1 inline) |
| tRPC procedures | 141 |
| tRPC call sites (web) | 254 across 79 files |
| Zustand stores | 17 (9 client-UI, 7 hybrid, 1 server-mirror) |
| Wallet store consumers | 65 files, 462 matches |
| Router code (total lines) | 6,910 |
| Largest router | `trading/router.ts` — 2,571 lines (92KB), 55 procedures |
| Second largest router | `data/router.ts` — 1,067 lines, 22 procedures |
| ethers imports | 18 files |
| date-fns imports | 3 files |
| Error patterns | 102 throw sites (64 `TRPCError` + 38 `createAppError`) |

---

## 2. Phase Plan

V2.md proposed 5 phases. This plan expands to **8 phases** for finer granularity, clearer dependencies, and more realistic time estimates. Total estimated duration: 12–18 weeks.

```
Phase 0 ─── Foundations (1-2 weeks, zero user impact)
Phase 1 ─── Session Model (1 week, highest value)
Phase 2 ─── Router Renames (1-2 weeks, coordinated deploy)
Phase 3 ─── State + WS + Rendering (2-3 weeks)
Phase 4 ─── Credential Migration (1-2 weeks, security-critical)
Phase 5 ─── Dependency Migrations (2-3 weeks, parallelizable)
Phase 6 ─── Domain Restructure (2 weeks, cosmetic)
Phase 7 ─── Polish (ongoing)
```

---

### Phase 0 — Foundations (1–2 weeks, zero user impact)

No user-visible changes. Establishes contracts and infrastructure that later phases depend on.

#### 0.1 Create `packages/contract`

- New package: re-exports `AppRouter` type from `apps/server/routers/index`
- Pre-computes `RouterOutput` and `RouterInput` inference helpers
- Zero runtime code — type imports only
- Replaces 8+ direct `import type { AppRouter } from "server/routers/index"` in the web app
- The web app should not reach into server internals

#### 0.2 Introduce `AppError` class alongside `createAppError`

- Add `AppError extends TRPCError` in `packages/api/src/errors.ts` with `why`/`fix`/`link` fields
- Update tRPC error formatter to use `instanceof AppError` (not duck-typing)
- **Dual-path:** both `createAppError()` and `new AppError()` work during transition
- Migrate 38 `createAppError()` call sites → `new AppError()`
- Migrate 64 raw `throw new TRPCError()` → `throw new AppError()` (102 total throw sites)
- Merge `apps/server/src/shared/errors/` into `packages/api`

#### 0.3 Add `gcTime` constants

- V2.md defines `GC_REALTIME` (2min), `GC_DEFAULT` (5min), `GC_STABLE` (30min), `GC_STATIC` (2h)
- These don't exist in the codebase yet — only `staleTime` tiers exist in `@/constants/query`
- Add to `apps/web/src/shared/constants/query.ts` alongside existing `STALE_*` constants
- Rule: `gcTime >= staleTime` for each tier, or cache evicts before data goes stale

#### 0.4 Feature flag infrastructure

- Install `flags` + `@flags-sdk/edge-config`
- Create `apps/web/src/lib/flags/` with types, definitions, provider, audit script
- Migrate existing `featureFlags.referrals` / `featureFlags.funnels` (5 call sites) to new system
- Add ops kill switches: `ops.clob.enabled`, `ops.bridge.enabled`, `ops.websocket.enabled`, `ops.magic.enabled`, `ops.safe-deploy.enabled`
- Add `pnpm flag-audit` to CI

#### 0.5 WebSocket hardening

- Widen jitter range from ±25% to 50–100% (1 line change in `WebSocketManager`)
- Add max retry limit of 12 attempts (~2 min with backoff curve)
- REST snapshot on reconnect: sync hooks invalidate relevant TanStack Query on reconnect to fill the data gap
- Connection state via `useSyncExternalStore` instead of Zustand store

#### 0.6 Testing infrastructure

- WS contract tests: capture real CLOB WebSocket payloads as fixtures, parse through Zod schemas
- Procedure output snapshots: `markets.getBySlug`, `orders.open`, `portfolio.positions` return shape tests
- Add CI test gate: unit + integration tests run on merge to `main` before Vercel deploy hook

---

### Phase 1 — Session Model (1 week, highest value)

The most impactful single change. Eliminates the stale-session bug class permanently.

#### 1.1 `useSession()` hook wrapping `trpc.auth.me`

```ts
// New: domains/account/hooks/use-session.ts
export function useSession() {
  return useQuery({
    ...trpc.auth.me.queryOptions(),
    staleTime: 5 * 60_000,  // 5 min
    retry: false,            // 401 = not logged in
  });
}
```

- `trpc.auth.me` returns: `{ userId, email, address, safeAddress, hasCredentials, authMethod, signatureType }`
- `undefined` = still loading, `null` = not authenticated, `Session` = authenticated

#### 1.2 Seed query cache on login

- After successful `auth.login` or `auth.walletLogin`, call `queryClient.setQueryData(trpc.auth.me.queryKey(), session)`
- Seeds the cache immediately — no round-trip needed
- Logout: `queryClient.clear()` removes all cached data

#### 1.3 Migrate `AuthGuard` from `useWalletStore` to `useSession()`

- AuthGuard reads `useSession().data` instead of `useWalletStore`
- No Zustand reads, no localStorage checks, no rehydration timing issues
- `isPending` → show `<AppShellSkeleton />`; `!session` → redirect to `/login`

#### 1.4 Gradually remove auth fields from wallet store

- **This is the biggest migration:** 65 files, 462 matches reference `useWalletStore` for auth fields
- Remove: `sessionToken`, `userId`, `email`, `safeAddress`, `hasCredentials`, `onboardingCompleted`
- Keep in wallet store: `address`, `chainId`, `signatureType`, `funderAddress` (wallet connection state)
- Migrate file-by-file, one at a time; `pnpm check-types` after each file

#### 1.5 Remove `session-cookie-sync.tsx` last

- This component exists to paper over the localStorage ↔ server mismatch
- Once all consumers use `useSession()`, it becomes dead code
- Remove from `app/layout.tsx` as the final step

#### 1.6 Extract `preferences-store.ts` from wallet store

- New store: `preferences-store.ts` with `hideBalances`, `soundEnabled`, `toggleHideBalances`, `toggleSound`
- Persisted to localStorage (non-security preferences)
- Wallet store shrinks to: `address`, `chainId`, `signatureType`, `funderAddress`, `setConnected`, `setDisconnected`

---

### Phase 2 — Router Renames (1–2 weeks, coordinated deploy)

Domain-first naming. Infrastructure names (`clob`, `data`, `wallets`) become domain names (`orders`, `portfolio`, `tracker`).

**Critical rule: deploy server before client.** The server must accept both old and new router keys during the transition window.

#### 2.1 `clob` → `orders` (55 procedures, 67 call sites)

- Move market-read procedures (`orderbook`, `priceHistory`, `tickSize`, `midpoint`, `spread`, `lastPrices`, `marketPrice`, `feeRate`, `clobInfo`, `holders`, `serverTime`) to `markets/` router
- Remaining trading procedures (`place`, `cancel`, `open`, `trades`, `heartbeat`, etc.) become `orders/`
- Split `trading/router.ts` (2,571 lines) into:
  - `orders/router.ts` — place, cancel, open, trades, heartbeat, scoring, balance
  - Move market-reads into existing `markets/router.ts`
- Update 67 `trpc.clob.*` call sites in web app

#### 2.2 `data` → `portfolio` + `activity` + `leaderboard` (22 procedures, 73 call sites)

- Split `data/router.ts` (1,067 lines) into:
  - `portfolio/router.ts` — positions, closedPositions, value, pnl, balances, openInterest, snapshot
  - `activity/router.ts` — feed, liveVolume, traded, outcomeCount
  - `leaderboard/router.ts` — rankings, builderVolume, builderTimeseries
- Update 73 `trpc.data.*` call sites in web app

#### 2.3 `wallets` → `tracker` (6 procedures, 16 call sites)

- Rename `wallets/router.ts` → `tracker/router.ts`
- Procedures: add, list, update, remove, activity, values
- Update 16 `trpc.wallets.*` call sites in web app

#### 2.4 Wire new routers in `routers/index.ts`

- Update `apps/server/src/routers/index.ts` to import from new locations
- Update server AGENTS.md to reflect new router key names
- Remove the "do not rename" warning from server AGENTS.md (audit issue #1)

---

### Phase 3 — State + WS + Rendering (2–3 weeks)

Migrate hybrid Zustand stores to TanStack Query. WebSocket becomes a cache updater, not a state source.

#### 3.1 Optimize hybrid stores (TQ for fetch, Zustand for streaming)

Migrate three stores to TanStack Query:

- **`useOrdersStore`** → `useQuery(trpc.orders.open.queryOptions(...))` — WS order events merge into cache via `queryClient.setQueryData`
- **`usePositionsStore`** → `useQuery(trpc.portfolio.positions.queryOptions(...))` — WS position updates invalidate this query
- **`useOrderbookStore`** → `useQuery(trpc.markets.orderbook.queryOptions(...))` — WS book updates write into cache; orderbook algorithmic logic (binary insert, cumulative USD) moves into the WS update function

Remaining stores stay in Zustand (client-UI state): `orderFormStore`, `workspaceStore`, `dockStore`, `preferencesStore`, `walletStore`, `trackerFeedStore`, `trackerSoundStore`, `bridgeActivityStore`

#### 3.2 WS sync hooks (`useMarketSync`, `useAccountSync`)

- `useMarketSync(tokenId)` — subscribes to market channel, writes book snapshots + price deltas into `trpc.markets.orderbook` cache
- `useAccountSync(address, conditionIds?)` — subscribes to user channel, merges order events into `trpc.orders.open` cache, invalidates positions on terminal order states
- Called once at page/layout level, never inside leaf components
- On reconnect: invalidate relevant queries to fill the data gap (REST snapshot pattern)

#### 3.3 PPR/caching improvements

- Audit all RSC pages for `Date.now()` before `connection()` (PPR build failure pattern)
- Add `"use cache"` + `cacheLife("minutes")` to public data fetchers (event listings, market metadata, leaderboard)
- Add `cacheTag("market", slug)` for targeted invalidation on market resolution
- Ensure `cacheLife` expire ≥ 5 minutes for PPR static shell eligibility

#### 3.4 Suspense boundary audit

- Push `<Suspense>` boundaries down to individual dynamic regions (not entire pages)
- Trading page: separate boundaries for orderbook rows, chart, open orders, wallet balance
- Static chrome (column headers, labels, order form shell) renders outside Suspense — never shows a skeleton
- Replace `pendingTradesStore` (3 separate stores) with `useMutationState` from TanStack Query v5

---

### Phase 4 — Credential Migration (1–2 weeks, security-critical)

Move from server-stored encrypted credentials to client-side-only derivation.

- **Phase A (3 days):** Add client-side `getCredentials()` alongside server-stored. Dual-path: try client-side first, fall back to server.
- **Phase B (2 weeks):** Monitor. Track % of sessions using client-side vs server-side. Target: 100% client-side.
- **Phase C (2 days):** Remove `auth.storeCredentials` + `auth.getCredentials` procedures, `crypto.ts`, `CREDENTIAL_ENCRYPTION_KEY` env var.
- **Phase D (later):** Drop `users.encrypted_creds` column.

**Why safe:** CLOB credentials are deterministic — same signer + same Safe = same creds every time. No data loss.

---

### Phase 5 — Dependency Migrations (2–3 weeks, parallelizable)

Independent of each other. Can run in parallel.

- **ethers → viem** (18 files): Start with server on-chain reads (simplest), then web transaction builders, then auth/Magic signer. Blocker: Polymarket CLOB SDK types use `@ethersproject/providers` `JsonRpcSigner` — may need wrapper or type assertion.
- **nuqs for URL state** (3 files): Replace manual `useSearchParams` + `router.push` in `use-explore-url-state.ts`, `market-trading-context.tsx`, `profile-modal-provider.tsx`.
- **date-fns → Temporal** (3 files): Very small scope. Recommendation: keep date-fns for existing calendar code, use Temporal for new code only.

---

### Phase 6 — Domain Restructure (2 weeks, cosmetic)

Purely cosmetic rename. Zero behavior change. Do LAST — lowest value-per-effort.

```bash
mv apps/web/src/features apps/web/src/domains
find apps/web/src -name '*.ts' -o -name '*.tsx' | xargs sed -i 's|@/features/|@/domains/|g'
mv apps/web/src/layout apps/web/src/shell
find apps/web/src -name '*.ts' -o -name '*.tsx' | xargs sed -i 's|@/layout/|@/shell/|g'
pnpm check-types && pnpm fix
```

Sub-renames: `features/auth/` → split into `domains/account/` + `domains/onboarding/`, `features/wallet-tracker/` → `domains/tracker/`, `features/comments/` → merge into `domains/trading/`, `features/profile/` → merge into `domains/account/`.

Update 20+ AGENTS.md files.

**Skip this phase entirely if short on time.** Everything else delivers real correctness improvements; this is organizational polish.

---

### Phase 7 — Polish (ongoing)

- Branded type enforcement across all Polymarket domain IDs (gradual, via Zod parse boundaries)
- View Transitions for page navigation animations (replace Framer Motion where possible)
- Route groups `(app)` and `(auth)` for cleaner route organization
- Session/nonce cleanup cron via Vercel scheduled functions
- `users.archivedAt` soft delete migration
- Auth router split into session/wallet/onboarding sub-routers

---

## 3. Risk Assessment

| Phase | Risk Level | What Can Go Wrong | Blast Radius | Rollback Strategy |
|-------|-----------|-------------------|-------------|-------------------|
| 0 — Foundations | 🟢 Low | Nothing — all additive | Zero | Remove new code |
| 1 — Session | 🟡 Medium | Auth guard breaks, users can't access protected routes | All authenticated users | Revert to wallet store reads (cookie/JWT unchanged) |
| 2 — Router Renames | 🟡 Medium | Client calls old procedure names, gets 404 | All API calls for renamed routers | Deploy server with both old+new names; revert client |
| 3 — State + WS | 🟡 Medium | Orderbook stops updating, orders don't appear | Trading page users | Revert to Zustand stores (WS infrastructure unchanged) |
| 4 — Credentials | 🔴 High | Users can't trade (credential derivation fails) | All trading users | Dual-path fallback to server-stored creds |
| 5 — Dependencies | 🟡 Medium | ethers→viem breaks on-chain reads or tx building | Specific features per file | Revert individual files |
| 6 — Restructure | 🟢 Low | Missed import → compile error | Zero (caught by typecheck) | Revert the rename PR |
| 7 — Polish | 🟢 Low | Individual feature issues | Per-feature | Revert individual PRs |

---

## 4. Principles

1. **One store at a time, one router at a time, one file at a time.** Never batch unrelated changes.
2. **Dual-path everything.** New code uses V2 pattern, old code keeps working. Delete old code only after all consumers are migrated.
3. **Feature branch per phase.** If it breaks, revert the whole branch.
4. **`pnpm check-types` is the safety net.** Run after every mechanical rename. TypeScript catches 90% of broken imports.
5. **Deploy server before client for router renames.** Server can serve both old and new procedure names temporarily.
6. **Skip Phase 6 if short on time.** Lowest value-per-effort change — pure cosmetics.
7. **Never big-bang.** No "rename all 254 call sites in one PR." Do it router by router, file by file.

---

## 5. Dependencies Between Phases

```
Phase 0 ──────────────────────────────────────────────────────
  │                                                           
  ├──→ Phase 1 (Session) ──→ Phase 4 (Credentials)           
  │         │                                                 
  │         └──→ Phase 3 (State + WS + Rendering)            
  │                                                           
  ├──→ Phase 2 (Router Renames) ──→ Phase 3                   
  │                                                           
  ├──→ Phase 5 (Dependencies) ← independent, can start anytime after Phase 0
  │                                                           
  └──→ Phase 6 (Restructure) ← do last, after everything else stable
                                                              
Phase 7 (Polish) ← ongoing, no dependencies                  
```

**Hard dependencies:**
- Phase 1 (Session) requires Phase 0 (packages/contract, error model)
- Phase 2 (Router Renames) requires Phase 0 (error model for new routers)
- Phase 3 (State) requires Phase 1 (session model) + Phase 2 (new router names for TQ keys)
- Phase 4 (Credentials) requires Phase 1 (session model changes)
- Phase 6 (Restructure) should be last (touches every file, conflicts with everything)

**No dependencies:**
- Phase 5 (Dependencies) can start anytime after Phase 0
- Phase 7 (Polish) is ongoing

---

## 6. V2.md Audit Resolutions

The V2.md internal audit identified 30 issues. Here are the resolutions for critical and high-severity items:

### 🔴 Critical

| # | Issue | Resolution |
|---|-------|-----------|
| 1 | Server AGENTS.md says "do not rename" router keys | Update AGENTS.md in Phase 2 PR. The rename IS the migration. |
| 2 | Doc uses V2 names as if they exist | These planning docs use current names with → arrows to V2 names. Implementation follows the mapping in `01-procedure-mapping.md`. |
| 3 | superjson described but not used | Not needed — Polymarket API returns ISO strings. Removed from plan. Add later only if Date/Map/Set/BigInt needed across tRPC boundary. |
| 4 | §10 code writes to TQ but orderbook is in Zustand | Phase 3 migrates orderbook to TQ. Sync hooks are only valid after Phase 3. Documented as dependency. |
| 5 | 93KB trading/router.ts needs splitting | Detailed split plan in `02-router-split-plan.md`. 25 procedures → orders/, 23 → markets/, 1 → rewards/. |
| 6 | No old→new procedure name mapping | Complete mapping in `01-procedure-mapping.md` with all 141 procedures and 254 call sites. |
| 7 | event/[slug] route missing from V2 route tree | Keep it. It's a real route used for GMP events. Add to V2 route tree. |
| 8 | Credential removal is multi-file security-critical | Detailed 4-phase plan in `07-credential-migration.md` with dual-path, monitoring, and rollback. |

### 🟡 High

| # | Issue | Resolution |
|---|-------|-----------|
| 9 | No procedure-level mapping for router splits | Covered in `02-router-split-plan.md` with exact line ranges. |
| 10 | Phase 4 time estimate unrealistic | Expanded to Phase 6 (2 weeks) + acknowledged it's the lowest priority. |
| 11 | No rollback strategy | Every phase has a rollback plan in this document and in its detailed spec. |
| 12 | Store removal order not specified | Detailed in `04-state-ownership.md`. Priority: P0 wallet auth fields, P1 orders+positions TQ hydration, P2 orderbook TQ snapshot. |
| 13 | pendingTradesStore not in "Five stores" list | Documented as 3 separate stores. useCashBalancePulseStore → useMutationState. Others stay. |
| 14 | No migration path for existing users with server-stored creds | Dual-path in `07-credential-migration.md`: client-side derivation first, server fallback, 2-week monitoring. |
| 15 | No import automation for renames | Exact sed commands in `09-domain-restructure.md`. |

---

## 7. Success Criteria

### Phase 0 — Foundations
- [ ] `packages/contract` exists and web app imports types from it
- [ ] `AppError` class exists, error formatter uses `instanceof`
- [ ] `gcTime` constants added to query config
- [ ] Feature flag infrastructure deployed with 2 existing flags migrated
- [ ] WebSocket manager has widened jitter, max retry, and reconnect snapshot
- [ ] WS contract tests pass in CI

### Phase 1 — Session Model
- [ ] `useSession()` hook exists and returns session from `trpc.auth.me`
- [ ] Zero remaining reads of `sessionToken`/`userId`/`email`/`safeAddress`/`hasCredentials` from wallet store
- [ ] `session-cookie-sync.tsx` deleted
- [ ] Login/logout flows work end-to-end
- [ ] RSC prefetching still works (cookie unchanged)

### Phase 2 — Router Renames
- [ ] `trpc.clob.*` → `trpc.orders.*` / `trpc.markets.*` — zero remaining `trpc.clob` references
- [ ] `trpc.data.*` → `trpc.portfolio.*` / `trpc.activity.*` / `trpc.leaderboard.*` — zero remaining `trpc.data` references
- [ ] `trpc.wallets.*` → `trpc.tracker.*` — zero remaining `trpc.wallets` references
- [ ] `trading/router.ts` split into `orders/router.ts` + market procedures merged into `markets/router.ts`
- [ ] All 254 call sites updated and typechecking

### Phase 3 — State + WS + Rendering
- [ ] `useOrdersStore` consumers read from TanStack Query
- [ ] `usePositionsStore` consumers read from TanStack Query
- [ ] `useOrderbookStore` consumers read from TanStack Query (WS deltas write to TQ cache)
- [ ] `useMarketSync` and `useAccountSync` hooks exist and are called at page level
- [ ] Public data cached with `"use cache"` + `cacheLife`
- [ ] Suspense boundaries pushed down to individual dynamic regions

### Phase 4 — Credentials
- [ ] 100% of sessions use client-side credential derivation (2-week monitoring)
- [ ] `auth.storeCredentials` and `auth.getCredentials` procedures removed
- [ ] `CREDENTIAL_ENCRYPTION_KEY` removed from env

### Phase 5 — Dependencies
- [ ] Zero `ethers` or `@ethersproject/*` imports remaining
- [ ] `nuqs` used for explore URL state
- [ ] `viem` is the only on-chain library

### Phase 6 — Domain Restructure
- [ ] Zero `@/features/` or `@/layout/` imports remaining
- [ ] All AGENTS.md files updated
- [ ] `pnpm check-types` + `pnpm build` pass

---

## 8. Document Cross-References

| When working on... | Read these docs |
|--------------------|--------------------|
| Phase 0 setup | 05, 10, 11, 13 |
| Session migration | 03, 04 |
| Router renames | 01, 02 |
| State + WS | 04, 06, 12 |
| Credentials | 07 |
| Dependencies | 08 |
| Domain restructure | 09 |
| Any phase | 00 (this doc) for risk/rollback |
