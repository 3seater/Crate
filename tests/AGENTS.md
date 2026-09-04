# Tests

> Scope: `tests/` directory and root-level test run (Vitest config at repo root).

Root-level test suite for the Doji monorepo. All tests use **Vitest**; config is `vitest.config.mts` at repo root.

## Quick Facts

- **Runner:** Vitest (globals, `tests/setup.ts`).
- **File pattern:** `*.test.ts` or `*.test.tsx` under `tests/` (no `.spec.` in this repo).
- **Env:** `tests/setup.ts` loads `apps/server/.env` so `@doji/env` and integration tests work.

## Structure

| Path | Purpose |
|------|---------|
| `setup.ts` | Load env before tests; add jest-dom when adding React/DOM tests. |
| `helpers.ts` | Shared utilities (e.g. `createId`). |
| `__mocks__/` | Module mocks (e.g. `server-only.ts` stub for server-only imports in unit tests). |
| `fixtures/` | Factory (`createFixture`, `createFixtureList`), ID helpers (`createAddress`, `createTokenId`, …), auth shapes (`createAuthUser`, `createAuthSession`). Import from `../fixtures` or `../../fixtures`. |
| `unit/` | Pure unit tests (no DB, no server). |
| `unit/websocket/` | WebSocket/RTDS unit tests (backoff, schemas, subscription-registry, RtdsClient, WebSocketManager). `spec-alignment.test.ts` validates schemas against official docs (docs/POLYMARKET.md); fixtures from `fixtures.ts` match documented examples. |
| `unit/orderbook-scroll-pinning*.test.ts`, `orderbook-flash.test.ts` | Orderbook scroll preservation and flash UX when depth updates (trading UI regression specs). |
| `unit/watchlist/` | Watchlist validation, utility functions, and DB query tests. |
| `unit/wallet-tracking/` | Wallet tracker frontend, tracked-wallet DB queries, portfolio values, activity feed. |
| `unit/referrals/` | Referral code generation, validation, and DB query tests. |
| `unit/web/performance/` | Performance optimization property tests (fast-check): dehydration, server-cache, lru-cache, react-cache. |
| `integration/` | Integration tests (tRPC, API, DB); may need `DATABASE_URL`. Covers: `smoke`, `gamma`, `data`, `clob`. |
| `e2e/` | E2E smoke; replace with Playwright/browser tests when added. |

**Notable unit test files:**

| File | Covers |
|------|--------|
| `kline-aggregation.test.ts` | OHLC aggregation, wick filter |
| `polymarket-kline-bars.test.ts` | Bar loading, paging |
| `polymarket-kline-fetch.test.ts` | CLOB price history fetch |
| `time-series-chart-utils.test.ts` + `.property.test.ts` | Chart interval helpers |
| `merge-market-positions.test.ts` | Position merging logic |
| `trading-utils-pnl.test.ts` | PnL formatting |
| `share-pnl.test.ts` + `share-pnl-modal.test.ts` | PnL sharing |
| `optimistic-balance-display.test.ts` | Optimistic balance merge |
| `positions-outcome-label.test.ts` | Outcome label formatting |
| `safe-onboarding-utils.test.ts` | Onboarding utilities |
| `map-api-error.test.ts` | API error mapping |
| Various `.property.test.ts` | Property-based tests (fast-check) for slug, filters, gamma, sports |

### Performance property tests (`unit/web/performance/`)

Property-based tests validating the Next.js performance optimization spec. All use `fast-check` with ≥100 iterations.

| File | Property Tested |
|------|----------------|
| `dehydration.property.test.ts` | Streaming dehydration includes pending queries (`shouldDehydrateQuery`) |
| `server-cache.property.test.ts` | Server cache idempotence (same input → same output within cache lifetime) |
| `lru-cache.property.test.ts` | LRU cache round-trip (set → get returns same value; miss returns undefined) |
| `react-cache.property.test.ts` | `React.cache()` request-scoped deduplication (same args → same reference) |

## Conventions

- **AAA:** Arrange, Act, Assert; one main behavior per `it()`.
- **Naming:** `it("should … when …")`; describe behavior, not implementation.
- **No `.only` / `.skip`** in committed code; keep describe/it nesting flat.
- **Fixtures:** Use `createFixture`, `createAuthUser`, `createId`, etc. from `../fixtures` or `../helpers`; avoid inline magic strings/numbers for IDs and addresses.

See root [Code Standards](../.agents/code-standards.md) and testing skills in `.agents/skills/` (e.g. javascript-testing-patterns, frontend-testing, e2e-testing).

## Commands (from repo root)

- `pnpm test` — all tests (CI).
- `pnpm test:unit` — `tests/unit/`.
- `pnpm test:integration` — `tests/integration/`.
- `pnpm test:e2e` — `tests/e2e/`.
- `pnpm test:watch` — watch mode.
- `pnpm test:coverage` — coverage (v8).

## Related

- [Root AGENTS.md](../AGENTS.md) — repo overview, ports, Turbo, CI.
- [tests/README.md](./README.md) — structure, commands, conventions.
- [tests/integration/README.md](./integration/README.md) — integration test coverage and rate limits.
