# 13 — Testing Strategy

> **Phase:** 0 (foundation) · **Risk:** Low · **Effort:** ~2.5 weeks (spread across phases) · **Breaking changes:** None

Establish contract tests, procedure snapshots, order validation coverage, auth flow tests, E2E critical paths, and CI integration — so V2 refactors land with confidence.

---

## 1. Current State

### What exists

| Area | Location | Count | Notes |
|------|----------|-------|-------|
| Unit tests | `tests/unit/` | ~70 files | CLOB property tests, orderbook, sports, format, WS schemas, wallet-tracking, watchlist, referrals |
| WS schema tests | `tests/unit/websocket/` | 9 files | `schemas.test.ts`, `spec-alignment.test.ts`, `rtds-schemas.test.ts`, `sports-schemas.test.ts`, etc. |
| WS fixtures | `tests/unit/websocket/fixtures.ts` | 1 file | Doc-derived payloads (RTDS comments, market channel, user channel) |
| Integration tests | `tests/integration/` | 4 files | `gamma.test.ts`, `clob.test.ts`, `data.test.ts`, `smoke.test.ts` |
| E2E tests | `tests/e2e/` | 1 file | `smoke.test.ts` (placeholder) |
| Shared fixtures | `tests/fixtures/` | 4 files | `auth.ts`, `factory.ts`, `ids.ts`, `index.ts` |
| Test helpers | `tests/helpers.ts`, `tests/setup.ts` | 2 files | `createId`, Vitest setup |
| Mocks | `tests/__mocks__/` | 2 files | `server-only.ts`, `client-only.ts` |

### What's missing

- **WS contract tests against captured production payloads** — current fixtures are doc-derived, not captured from live WebSocket
- **Procedure output snapshot tests** — no tests verify tRPC return shapes
- **Order validation edge-case tests** — tick size, price bounds, post-only, GTD buffer, neg-risk
- **Auth flow integration tests** — no Magic DID → session, wallet SIWE → session, or logout tests
- **E2E critical paths** — smoke test is a placeholder
- **Tests in CI** — `ci.yml` runs lint + typecheck + build; no `pnpm test`

### CI pipeline (current)

```
PR → ci.yml:
  ├── Lint (pnpm check)
  ├── Type Check (pnpm check-types)
  └── Build (pnpm build)

main → deploy.yml:
  ├── Vercel Deploy Hook: Web
  ├── Vercel Deploy Hook: API
  └── Vercel Deploy Hook: Docs
```

No test step in either workflow.

---

## 2. Testing Pyramid

| Layer | Tool | What | Priority | Location |
|-------|------|------|----------|----------|
| Unit | Vitest | Zod schemas, order validation, branded types, pure utils | High | `tests/unit/` |
| Contract | Vitest | WS message schemas against captured payloads, procedure output shapes | High | `tests/unit/ws/`, `tests/integration/routers/` |
| Integration | Vitest | Auth flows, tRPC procedure round-trips (with test DB or mocked clients) | Medium | `tests/integration/` |
| E2E | Playwright | Login → place order → see position | Medium | `tests/e2e/` |
| Type | TypeScript | Branded types, compile-time safety | Implicit | `pnpm check-types` (already in CI) |

---

## 3. WS Contract Tests

### Purpose

Capture real message payloads from the CLOB WebSocket, commit as JSON fixtures, and parse through Zod schemas. Catches upstream Polymarket protocol changes before they crash production.

### Test structure

```ts
// tests/unit/ws/market-book.contract.test.ts
import { safeParseMarketChannelMessage } from "@/lib/websocket/schemas";
import bookMessage from "./fixtures/book-message.json";

test("parses book snapshot from captured payload", () => {
  const result = safeParseMarketChannelMessage(bookMessage);
  expect(result.success).toBe(true);
  if (result.success) {
    expect(result.data.event_type).toBe("book");
  }
});

test("rejects book snapshot with missing bids", () => {
  const { bids, ...incomplete } = bookMessage;
  const result = safeParseMarketChannelMessage(incomplete);
  expect(result.success).toBe(false);
});
```

### Fixtures needed

Capture from production WebSocket and commit as JSON in `tests/unit/ws/fixtures/`:

| Channel | Message type | Fixture file |
|---------|-------------|--------------|
| Market | `book` (snapshot) | `book-message.json` |
| Market | `price_change` | `price-change.json` |
| Market | `last_trade_price` | `last-trade-price.json` |
| Market | `market_resolved` | `market-resolved.json` |
| User | Order event (new) | `order-new.json` |
| User | Order event (filled) | `order-filled.json` |
| User | Order event (cancelled) | `order-cancelled.json` |
| User | `balance_update` | `balance-update.json` |
| RTDS | Crypto price | `rtds-crypto-price.json` |
| RTDS | Equity price | `rtds-equity-price.json` |
| RTDS | Comment | `rtds-comment.json` |
| Sports | Game update | `sports-game-update.json` |
| Sports | Score change | `sports-score-change.json` |

### Capture process

1. Connect to production WS with a debug script (`scripts/capture-ws-fixtures.ts`)
2. Subscribe to each channel, capture one message per type
3. Sanitize (strip real user addresses, replace with fixture addresses)
4. Commit to `tests/unit/ws/fixtures/`
5. Re-capture quarterly or when Polymarket announces protocol changes

### Relationship to existing WS tests

The existing `tests/unit/websocket/` tests use inline fixtures and doc-derived payloads from `fixtures.ts`. Contract tests complement these by testing against **real captured payloads** — the doc-derived tests verify schema logic, contract tests verify schema-to-reality alignment.

---

## 4. Procedure Output Snapshots

### Purpose

Snapshot test for every critical procedure's return shape. Catches accidental shape regressions when refactoring routers during V2.

### Test structure

```ts
// tests/integration/routers/markets.snapshot.test.ts
import { describe, expect, test } from "vitest";
import { createCaller } from "./helpers/create-caller";

describe("markets router snapshots", () => {
  test("markets.getBySlug returns expected shape", async () => {
    const caller = createCaller({ session: null });
    const market = await caller.markets.getBySlug({ slug: "test-market" });
    expect(market).toMatchSnapshot();
  });

  test("markets.list returns expected shape", async () => {
    const caller = createCaller({ session: null });
    const result = await caller.markets.list({ limit: 1 });
    expect(result).toMatchSnapshot();
  });

  test("markets.orderbook returns expected shape", async () => {
    const caller = createCaller({ session: null });
    const book = await caller.markets.orderbook({ conditionId: "0x123" });
    expect(book).toMatchSnapshot();
  });
});
```

### Procedures to snapshot (prioritized)

| Router | Procedure | Auth required | Priority |
|--------|-----------|---------------|----------|
| `markets` | `getBySlug` | No | P0 |
| `markets` | `list` | No | P0 |
| `markets` | `orderbook` | No | P0 |
| `events` | `getBySlug` | No | P0 |
| `events` | `list` | No | P0 |
| `orders` | `open` | Yes | P1 |
| `orders` | `trades` | Yes | P1 |
| `portfolio` | `positions` | Yes | P1 |
| `portfolio` | `value` | Yes | P1 |
| `auth` | `me` | Yes | P1 |

### Implementation notes

- `createCaller` wraps `appRouter.createCaller(ctx)` with mocked Polymarket clients returning fixture data
- Snapshot files live alongside tests in `__snapshots__/`
- Update snapshots intentionally with `pnpm test -- -u` when router shapes change during V2

---

## 5. Order Validation Tests

### Purpose

Exhaustive edge-case coverage for order validation logic. These are pure-function unit tests — no network, no mocks.

### Location

`tests/unit/trading/order-validation.test.ts`

### Test cases

```ts
describe("order validation", () => {
  describe("tick size enforcement", () => {
    test("accepts price aligned to 0.01 tick", () => { /* ... */ });
    test("accepts price aligned to 0.001 tick", () => { /* ... */ });
    test("rejects price misaligned with tick size", () => { /* ... */ });
    test("rejects price with too many decimals for tick", () => { /* ... */ });
  });

  describe("min order size", () => {
    test("accepts order at minimum size", () => { /* ... */ });
    test("rejects order below minimum size", () => { /* ... */ });
    test("rejects zero-size order", () => { /* ... */ });
  });

  describe("price bounds", () => {
    test("accepts price at 0.01 (minimum)", () => { /* ... */ });
    test("accepts price at 0.99 (maximum)", () => { /* ... */ });
    test("rejects price at 0.00", () => { /* ... */ });
    test("rejects price at 1.00", () => { /* ... */ });
    test("rejects negative price", () => { /* ... */ });
    test("rejects price above 1.00", () => { /* ... */ });
  });

  describe("post-only validation", () => {
    test("accepts post-only GTC order", () => { /* ... */ });
    test("rejects post-only with FOK time-in-force", () => { /* ... */ });
    test("rejects post-only with FAK time-in-force", () => { /* ... */ });
  });

  describe("GTD expiration buffer", () => {
    test("accepts GTD with expiration > minimum buffer", () => { /* ... */ });
    test("rejects GTD with expiration in the past", () => { /* ... */ });
    test("rejects GTD with expiration too close to now", () => { /* ... */ });
  });

  describe("neg-risk flag", () => {
    test("requires negRisk: true for neg-risk markets", () => { /* ... */ });
    test("rejects negRisk: true for binary markets", () => { /* ... */ });
    test("sets correct funder address for neg-risk", () => { /* ... */ });
  });
});
```

---

## 6. Auth Flow Tests

### Purpose

Integration tests for every login/logout path. Uses mocked Magic SDK and mocked wallet providers — no real auth calls.

### Location

`tests/integration/auth/`

### Test cases

```ts
// tests/integration/auth/email-login.test.ts
describe("email login (Magic DID token → session)", () => {
  test("valid DID token creates session and returns user", () => { /* ... */ });
  test("expired DID token returns UNAUTHORIZED", () => { /* ... */ });
  test("malformed DID token returns BAD_REQUEST", () => { /* ... */ });
  test("new user triggers onboarding flow", () => { /* ... */ });
  test("existing user skips onboarding", () => { /* ... */ });
});

// tests/integration/auth/wallet-login.test.ts
describe("wallet login (SIWE signature → session)", () => {
  test("valid signature creates session and returns user", () => { /* ... */ });
  test("invalid signature returns UNAUTHORIZED", () => { /* ... */ });
  test("expired challenge returns UNAUTHORIZED", () => { /* ... */ });
  test("wallet with existing Safe imports it", () => { /* ... */ });
  test("wallet without Safe triggers deployment", () => { /* ... */ });
});

// tests/integration/auth/logout.test.ts
describe("logout", () => {
  test("revokes session and clears cookie", () => { /* ... */ });
  test("subsequent requests return UNAUTHORIZED", () => { /* ... */ });
});

// tests/integration/auth/session.test.ts
describe("session handling", () => {
  test("expired session returns UNAUTHORIZED", () => { /* ... */ });
  test("valid session returns user from auth.me", () => { /* ... */ });
});
```

### V2-specific: credential derivation

```ts
// tests/integration/auth/credential-derivation.test.ts
describe("credential derivation (V2 client-side)", () => {
  test("derives credentials from Magic provider", () => { /* ... */ });
  test("derives credentials from external wallet", () => { /* ... */ });
  test("stores encrypted credentials server-side", () => { /* ... */ });
  test("retrieves and decrypts credentials for trading", () => { /* ... */ });
});
```

---

## 7. E2E Critical Paths

### Tool

Playwright. Install as dev dependency, configure in `playwright.config.ts`.

### Location

`tests/e2e/`

### Critical paths

| # | Path | What it validates |
|---|------|-------------------|
| 1 | Login → see portfolio | Auth flow works end-to-end |
| 2 | Navigate to market → see orderbook | Data loading, WS connection, rendering |
| 3 | Place limit order → see in open orders | Trading pipeline works |
| 4 | Cancel order → removed from open orders | Order lifecycle works |
| 5 | Explore page loads with markets | Public data, SSR/PPR works |

### Test structure

```ts
// tests/e2e/trading-flow.test.ts
import { expect, test } from "@playwright/test";

test.describe("trading flow", () => {
  test.beforeEach(async ({ page }) => {
    // Login via stored auth state (avoid Magic OAuth in E2E)
    await page.goto("/");
  });

  test("explore page loads with markets", async ({ page }) => {
    await page.goto("/explore");
    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("row")).toHaveCount({ minimum: 2 });
  });

  test("navigate to market and see orderbook", async ({ page }) => {
    await page.goto("/market/test-market-slug");
    await expect(page.getByTestId("orderbook")).toBeVisible();
    await expect(page.getByTestId("order-form")).toBeVisible();
  });

  test("place limit order and see in open orders", async ({ page }) => {
    await page.goto("/market/test-market-slug");
    await page.getByTestId("price-input").fill("0.50");
    await page.getByTestId("amount-input").fill("10");
    await page.getByTestId("place-order-button").click();
    await expect(page.getByTestId("open-orders")).toContainText("0.50");
  });

  test("cancel order and removed from open orders", async ({ page }) => {
    // Assumes order from previous test or setup
    await page.goto("/portfolio");
    await page.getByTestId("cancel-order-button").first().click();
    await page.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByTestId("open-orders")).not.toContainText("0.50");
  });
});
```

### Auth in E2E

E2E tests cannot go through real Magic OAuth. Options:

1. **Stored auth state** — run a setup script that logs in once, saves cookies/localStorage to `tests/e2e/.auth/`, reuse in tests via `storageState`
2. **Test-only bypass** — `NEXT_PUBLIC_E2E_AUTH_BYPASS=true` env var that accepts a test JWT (dev/CI only, never production)
3. **API seeding** — call tRPC directly to create a session, inject the cookie

Recommend option 1 (stored auth state) for simplicity. Option 2 as fallback if Magic OAuth is flaky in CI.

---

## 8. CI Integration

### Current pipeline

```yaml
# ci.yml (PR)
jobs:
  quality:  # lint + typecheck
  build:    # pnpm build

# deploy.yml (main)
jobs:
  web:   # Vercel deploy hook
  api:   # Vercel deploy hook
  docs:  # Vercel deploy hook
```

### V2 pipeline

```yaml
# ci.yml (PR) — add unit test job
jobs:
  changes:  # (existing) file detection
  quality:  # (existing) lint + typecheck
  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: [changes]
    if: needs.changes.outputs.typescript == 'true' || github.event_name == 'workflow_dispatch'
    timeout-minutes: 10
    env:
      DATABASE_URL: postgresql://localhost:5432/__ci_test_placeholder__
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
      - uses: ./.github/actions/setup-node-pnpm
      - run: pnpm test:unit
  build:    # (existing)
```

```yaml
# deploy.yml (main) — add integration + E2E gates before deploy hooks
jobs:
  test-integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    timeout-minutes: 15
    env:
      DATABASE_URL: postgresql://localhost:5432/__ci_integration_placeholder__
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
      - uses: ./.github/actions/setup-node-pnpm
      - run: pnpm test:integration

  test-e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [test-integration]
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd # v6
      - uses: ./.github/actions/setup-node-pnpm
      - run: npx playwright install --with-deps chromium
      - run: pnpm test:e2e

  web:
    needs: [test-e2e]
    # ... existing deploy hook

  api:
    needs: [test-e2e]
    # ... existing deploy hook

  docs:
    needs: [test-e2e]
    # ... existing deploy hook
```

### Progression

| Stage | When | What runs |
|-------|------|-----------|
| Now | PR | lint + typecheck + build |
| V2 Phase 0 | PR | lint + typecheck + **unit tests** + build |
| V2 Phase 1 | merge to main | + **integration tests** (before deploy hooks) |
| V2 Phase 3+ | merge to main | + **E2E tests** (blocking deploy if critical path fails) |

---

## 9. Test Fixtures

### Existing fixtures (`tests/fixtures/`)

| File | Exports | Used by |
|------|---------|---------|
| `auth.ts` | `createAuthUser`, `createAuthSession` | Auth-related tests |
| `factory.ts` | `createFixture`, `createFixtureList` | All fixture creation |
| `ids.ts` | `createAddress`, `createTokenId`, `createConditionId`, `createMarketSlug`, `createOrderId` | ID generation |
| `index.ts` | Re-exports all above | Import convenience |

### New fixtures needed

| Fixture | File | Shape |
|---------|------|-------|
| Binary market | `tests/fixtures/markets.ts` | `{ conditionId, slug, question, tokens, tickSize: 0.01, negRisk: false, closed: false }` |
| Neg-risk market | `tests/fixtures/markets.ts` | `{ ..., negRisk: true, negRiskMarketId, negRiskRequestId }` |
| Sports market | `tests/fixtures/markets.ts` | `{ ..., enableOrderBook: true, tags: ["sports"] }` |
| SMP event | `tests/fixtures/events.ts` | `{ slug, title, markets: [1 market] }` |
| GMP event | `tests/fixtures/events.ts` | `{ slug, title, markets: [3+ markets] }` |
| GTC order | `tests/fixtures/orders.ts` | `{ type: "GTC", price, size, side, tokenId }` |
| GTD order | `tests/fixtures/orders.ts` | `{ type: "GTD", ..., expiration }` |
| FOK order | `tests/fixtures/orders.ts` | `{ type: "FOK", ... }` |
| FAK order | `tests/fixtures/orders.ts` | `{ type: "FAK", ... }` |
| Open position | `tests/fixtures/positions.ts` | `{ market, outcome, size, avgPrice, currentPrice }` |
| Closed position | `tests/fixtures/positions.ts` | `{ ..., closed: true, pnl }` |
| Redeemable position | `tests/fixtures/positions.ts` | `{ ..., redeemable: true, winningOutcome }` |
| WS payloads | `tests/unit/ws/fixtures/*.json` | Captured from production (see §3) |

### Fixture conventions

- Use `createFixture` factory for all domain objects (supports partial overrides)
- JSON fixtures for WS payloads (captured, not hand-written)
- TypeScript fixtures for domain objects (type-safe, composable)
- Sanitize all real data (addresses, user IDs) before committing

---

## 10. Coverage Targets

Not enforced globally (no `--coverage` threshold in CI), but tracked and reviewed:

| Area | Target | Rationale |
|------|--------|-----------|
| Zod schemas | 100% | Every schema has parse + reject tests |
| WS schemas | 100% | Every message type has a captured fixture |
| Order validation | 100% | Every edge case (tick, bounds, post-only, GTD, neg-risk) |
| Auth flows | 100% | Every login/logout path |
| Router procedures | 80% | Snapshot tests for critical procedures (P0 + P1 from §4) |
| E2E | 5 critical paths | Login, explore, market, order, cancel |

### How to track

```bash
# Coverage report (not in CI, run locally)
pnpm test:coverage

# Check specific area
pnpm test:unit -- --coverage tests/unit/trading/
pnpm test:unit -- --coverage tests/unit/ws/
```

---

## 11. Implementation Steps

| Step | What | Location | Depends on |
|------|------|----------|------------|
| 1 | Capture WS payloads from production | `tests/unit/ws/fixtures/` | — |
| 2 | Write WS contract tests | `tests/unit/ws/` | Step 1 |
| 3 | Create domain fixtures (markets, events, orders, positions) | `tests/fixtures/` | — |
| 4 | Write procedure snapshot tests | `tests/integration/routers/` | Step 3 |
| 5 | Write order validation tests | `tests/unit/trading/order-validation.test.ts` | Step 3 |
| 6 | Add unit tests to CI (`ci.yml`) | `.github/workflows/ci.yml` | Steps 2, 5 |
| 7 | Write auth flow integration tests | `tests/integration/auth/` | Step 3 |
| 8 | Add integration tests to deploy pipeline | `.github/workflows/deploy.yml` | Steps 4, 7 |
| 9 | Set up Playwright + write E2E tests | `tests/e2e/`, `playwright.config.ts` | — |
| 10 | Add E2E to deploy pipeline | `.github/workflows/deploy.yml` | Step 9 |

---

## 12. Timeline

| Phase | Work | Effort | V2 Phase |
|-------|------|--------|----------|
| WS contract tests + procedure snapshots | Steps 1–4 | 3 days | Phase 0 |
| Order validation + auth tests | Steps 5, 7 | 1 week | Phase 1 |
| CI integration | Steps 6, 8 | 1 day | Phase 0–1 |
| E2E setup + critical paths | Steps 9–10 | 1 week | Phase 3+ |
| **Total** | | **~2.5 weeks** | Spread across phases |

### Sequencing with other V2 docs

- **Before doc 02 (Router Split):** Procedure snapshots must exist so router renames don't silently break return shapes
- **Before doc 07 (Credential Migration):** Auth flow tests must exist so credential changes are verified
- **Before doc 06 (WebSocket Hub):** WS contract tests must exist so hub refactor doesn't break message parsing
- **Parallel with doc 05 (Error Model):** Order validation tests exercise error paths — write together

---

## 13. Verification

### How to verify this doc is implemented

```bash
# WS contract tests exist and pass
pnpm test:unit -- tests/unit/ws/

# Procedure snapshots exist and pass
pnpm test -- tests/integration/routers/

# Order validation tests exist and pass
pnpm test:unit -- tests/unit/trading/order-validation

# Auth flow tests exist and pass
pnpm test:integration -- tests/integration/auth/

# E2E tests exist and pass
pnpm test:e2e

# Unit tests run in CI (check ci.yml has test step)
grep -q "pnpm test:unit" .github/workflows/ci.yml

# Integration + E2E gate deploys (check deploy.yml has test jobs)
grep -q "test-integration" .github/workflows/deploy.yml
grep -q "test-e2e" .github/workflows/deploy.yml
```

---

## 14. Rollback

Testing infrastructure is additive — no rollback needed. If a test category is flaky or blocks CI:

1. Move the flaky test to a `.skip` (temporarily) and file an issue
2. Remove the CI gate for that category (revert the `ci.yml` / `deploy.yml` change)
3. Keep the tests in the repo — they still run locally

Never delete test fixtures or snapshot files during rollback.
