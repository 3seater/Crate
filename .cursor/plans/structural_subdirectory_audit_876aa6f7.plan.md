---
name: Structural subdirectory audit
overview: "Audit identified several areas that could be grouped into subdirectories following the same pattern as `lib/polymarket/subgraph/`: server resilience utilities, Polymarket enrichment modules, optional web lib/utils grouping, and optional packages/api transaction modules."
todos: []
isProject: false
---

# Structural subdirectory audit

Same pattern as [apps/server/src/lib/polymarket/subgraph/](apps/server/src/lib/polymarket/subgraph/): a cohesive feature (client, strategy, index) lives in its own dir with a single public surface.

---

## 1. Server: `lib/resilience/` (high value)

**Current:** Six files at `lib/` root that are used together by Polymarket clients:

- [apps/server/src/lib/rate-limiter.ts](apps/server/src/lib/rate-limiter.ts) (uses `rate-limit-config`)
- [apps/server/src/lib/rate-limit-config.ts](apps/server/src/lib/rate-limit-config.ts)
- [apps/server/src/lib/cache.ts](apps/server/src/lib/cache.ts)
- [apps/server/src/lib/retry.ts](apps/server/src/lib/retry.ts)
- [apps/server/src/lib/circuit-breaker.ts](apps/server/src/lib/circuit-breaker.ts)
- [apps/server/src/lib/deduplicator.ts](apps/server/src/lib/deduplicator.ts)

**Consumer:** [apps/server/src/lib/polymarket/resilient-fetch.ts](apps/server/src/lib/polymarket/resilient-fetch.ts) imports all of these (plus `../errors`). [apps/server/src/index.ts](apps/server/src/index.ts) imports `destroyAllLimiters` from rate-limiter.

**Proposal:** Add `lib/resilience/` and move these six files there. Export from `lib/resilience/index.ts` (or keep named imports from subpaths). Update `resilient-fetch.ts` to import from `../resilience/...` and `index.ts` from `./lib/resilience/rate-limiter` (or resilience index).

**Outcome:** Clear “resilience layer” boundary; `lib/` root holds only errors, map-api-error, validate-config, balance, check-approval-status.

---

## 2. Server: `lib/polymarket/enrich/` (high value)

**Current:** Three enrichment modules next to gamma, data, bridge, etc.:

- [apps/server/src/lib/polymarket/enrich-leaderboard.ts](apps/server/src/lib/polymarket/enrich-leaderboard.ts)
- [apps/server/src/lib/polymarket/enrich-positions.ts](apps/server/src/lib/polymarket/enrich-positions.ts)
- [apps/server/src/lib/polymarket/enrich-markets-with-events.ts](apps/server/src/lib/polymarket/enrich-markets-with-events.ts)

**Consumers:** `data.ts` (enrich-positions, enrichLeaderboard via router), `routers/data.ts` (enrichLeaderboard), `routers/markets.ts` (enrich-markets-with-events).

**Proposal:** Add `lib/polymarket/enrich/` and move the three files. Create `enrich/index.ts` that re-exports the public functions. Update `data.ts` and the two routers to import from `./enrich` or `./enrich/...`.

**Outcome:** Matches the `subgraph/` and `schemas/` pattern; keeps “enrichment” as one concept.

---

## 3. Server: `lib/onchain/` (optional, medium value)

**Current:** Two files at `lib/` root that are blockchain/onchain-focused:

- [apps/server/src/lib/balance.ts](apps/server/src/lib/balance.ts) — USDC/CTF balances, transfer history
- [apps/server/src/lib/check-approval-status.ts](apps/server/src/lib/check-approval-status.ts) — CLOB token approval checks

**Consumers:** `routers/auth.ts` (check-approval-status), `routers/bridge.ts` and `routers/data.ts` (balance).

**Proposal:** Add `lib/onchain/` and move both files. Update the three routers to import from `../lib/onchain/...`.

**Outcome:** Groups onchain reads and approval checks; keeps `lib/` root minimal.

---

## 4. Web: `lib/utils/` for root-level *-utils (optional, low value)

**Current:** Four root-level files in [apps/web/src/lib/](apps/web/src/lib/):

- `leaderboard-utils.ts`, `profile-utils.ts`, `table-formats.ts`, `redeem-utils.ts`

Plus `api-queue.ts`, `site-gate.ts`, `trpc-server.ts` (and resolution/ is already a subdir).

**Proposal (optional):** Introduce `lib/utils/` (or keep naming distinct from top-level `utils/` to avoid confusion — e.g. `lib/page-utils/` or leave as-is). AGENTS.md already documents “Root-level utilities” and “lib → utils only”; moving the four *-utils into e.g. `lib/formatting/` or a single `lib/utils/` could reduce root clutter. Low priority because the count is small and convention is already documented.

**Recommendation:** Only do this if you want a stricter “no loose files in lib root” rule; otherwise leave as-is.

---

## 5. Web components: providers / global UI (optional, low value)

**Current:** A few components at [apps/web/src/components/](apps/web/src/components/) root that are global/setup rather than domain-specific:

- `theme-provider.tsx`, `providers.tsx`, `profile-modal-provider.tsx`, `add-track-wallet-modal-provider.tsx`
- `user-channel-setup.tsx`, `notifications-setup.tsx`
- `mode-toggle.tsx`, `error-fallback.tsx`, `color-experiment-*.tsx`

**Proposal (optional):** e.g. `components/providers/` for the four provider components, or `components/setup/` for the two setup components. Risk: many imports across the app would need path updates. Only worth it if you want a strict “domain folders only at components root” rule.

**Recommendation:** Defer unless you plan a broader components reorganization.

---

## 6. Packages: `@doji/api` lib (optional, low value)

**Current:** [packages/api/src/lib/](packages/api/src/lib/) has `clob/` (already a subdir) and flat files: `approval-txs.ts`, `split-merge-txs.ts`, `transfer-txs.ts`, `redeem-txs.ts`, plus `session.ts`, `crypto.ts`, `builder.ts`, `clob-factory.ts`, `errors.ts`, `relayer-errors.ts`.

**Proposal (optional):** Group transaction builders into e.g. `lib/transactions/` (approval-txs, split-merge-txs, transfer-txs, redeem-txs). This would change public entry points from `@doji/api/lib/approval-txs` to `@doji/api/lib/transactions/approval-txs` (or re-export from `lib/transactions`). Multiple apps and hooks import these; any move requires updating all consumers and documenting the new paths.

**Recommendation:** Optional; do only if you want a clear “transactions” namespace and are willing to update every `@doji/api/lib/*-txs` import.

---

## 7. Server: `lib/errors/` (second pass, medium value)

**Current:** Two files at `lib/` root that form the error-handling boundary for Polymarket and tRPC:

- [apps/server/src/lib/errors.ts](apps/server/src/lib/errors.ts) — `ApiError`, `ErrorCode`, `classifyHttpError`, `classifyNetworkError`
- [apps/server/src/lib/map-api-error.ts](apps/server/src/lib/map-api-error.ts) — `mapApiErrorToTRPC`, `withPolymarketError`, `POLYMARKET_MAPPED`

**Consumers:** `lib/polymarket/resilient-fetch.ts`, `lib/polymarket/clob-read.ts`, `lib/polymarket/bridge.ts` (errors); `routers/bridge.ts`, `routers/data.ts`, `routers/markets.ts`, `routers/events.ts`, `app.ts` (map-api-error). Plus [tests/unit/map-api-error.test.ts](tests/unit/map-api-error.test.ts).

**Proposal:** Add `lib/errors/` and move both files. Create `errors/index.ts` that re-exports. Update polymarket clients, four routers, app.ts, and the unit test to import from `../errors` or `../errors/...`.

**Outcome:** Single "error handling" boundary; aligns with resilience/enrich/onchain grouping. After resilience + onchain moves, `lib/` root would hold only `validate-config.ts`.

---

## Second pass: other areas reviewed

- **Server routers/** — All flat; no subdir suggested unless you later split e.g. "polymarket" vs "app" routers.
- **Web app/api/** — Only 3 routes; polymarket already in subdir. No change.
- **Web components/** — `market/tabs/` and `trading/orders/` already subdirs; root providers/setup in plan as optional.
- **Web utils/** — 6 files; small and pure. No subdir needed.
- **Packages types/** — 10 flat files; optional domain subdirs if package grows. Low priority.
- **Packages hooks/, db/** — Already well structured. Fine as-is.
- **Tests unit/** — Optional: group flat tests by target (server vs web) for discoverability; lower priority.

---

## Summary


| Location                 | Proposal                           | Impact                                            | Priority       |
| ------------------------ | ---------------------------------- | ------------------------------------------------- | -------------- |
| Server `lib/`            | `lib/resilience/` (6 files)        | One primary consumer (resilient-fetch) + index.ts | High           |
| Server `lib/polymarket/` | `lib/polymarket/enrich/` (3 files) | data.ts + 2 routers                               | High           |
| Server `lib/`            | `lib/onchain/` (2 files)           | 3 routers                                         | Medium         |
| Server `lib/`            | `lib/errors/` (2 files)            | polymarket clients, 4 routers, app.ts, 1 test     | Medium         |
| Web `lib/`               | `lib/utils/` or leave as-is        | Many imports                                      | Low / skip     |
| Web `components/`        | providers/setup subdirs            | Many imports                                      | Low / skip     |
| packages/api `lib/`      | `lib/transactions/`                | All api consumers                                 | Low / optional |


---

## Implementation order

1. **Server resilience** — Create `lib/resilience/`, move the 6 files, add index if desired, update [resilient-fetch.ts](apps/server/src/lib/polymarket/resilient-fetch.ts) and [index.ts](apps/server/src/index.ts). Update [lib/AGENTS.md](apps/server/src/lib/AGENTS.md) and any tests that reference these paths (e.g. tests using `getSharedCache` from resilient-fetch).
2. **Polymarket enrich** — Create `lib/polymarket/enrich/`, move the 3 enrich-* files, add `enrich/index.ts`, update [data.ts](apps/server/src/lib/polymarket/data.ts), [routers/data.ts](apps/server/src/routers/data.ts), [routers/markets.ts](apps/server/src/routers/markets.ts). Update [lib/polymarket/AGENTS.md](apps/server/src/lib/polymarket/AGENTS.md).
3. **Server onchain** (optional) — Create `lib/onchain/`, move balance + check-approval-status, update routers and AGENTS.md.
4. **Server errors** (second pass) — Create `lib/errors/`, move errors.ts + map-api-error.ts, add errors/index.ts, update polymarket clients (resilient-fetch, clob-read, bridge), routers (bridge, data, markets, events), app.ts, and tests/unit/map-api-error.test.ts.

After each step: run `pnpm fix`, `pnpm check-types`, and adjust any tests under `tests/` that import from the old paths (e.g. [tests/unit/search-markets-exploration.test.ts](tests/unit/search-markets-exploration.test.ts) and similar that use `getSharedCache` from resilient-fetch).