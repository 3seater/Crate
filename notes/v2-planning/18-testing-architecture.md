# 18 — Testing Architecture

> **Status:** Planning  
> **Phase:** 7 (Quality)  
> **Depends on:** All domain restructuring complete (Phase 6)

## Goal

Rebuild the testing infrastructure from scratch with a dependable, layered strategy that covers unit → integration → E2E. Every test must be deterministic, fast, and runnable in CI. No live API calls in CI — all external dependencies mocked via MSW.

## Current State

| Metric | Value |
|--------|-------|
| Unit tests | ~80 files (pure logic, property-based) |
| Integration tests | 93 tests (live Polymarket API — **skipped in CI**) |
| Component tests | **0** |
| E2E tests | **0** (placeholder only) |
| Playwright | **not installed** |
| MSW | **not installed** |
| Tests in CI | **none** |
| RTL/jsdom | installed, **unused** |
| Coverage tracking | local only, no thresholds |

### What Works Well (Keep)

- **Fixture system** — `createFixture<T>()`, deterministic ID generators, auth fixtures
- **Property-based testing** — ~25 files using `fast-check` with 100-500 iterations
- **WebSocket test suite** — schemas, manager, subscription registry, spec alignment
- **Exploration → fix → preservation** pattern for bug regression tests
- **Integration tests** — comprehensive Gamma/CLOB/Data API coverage (keep for local validation)

### What's Missing

1. Zero React component rendering tests
2. Zero tRPC router tests (integration tests hit Polymarket directly, not our routers)
3. Zero auth flow tests (Magic SDK, wallet SIWE, session management)
4. Zero middleware tests
5. No API mocking layer (MSW) — tests either hit live APIs or mock `fetch` ad-hoc
6. No E2E tests (no Playwright)
7. No tests in CI pipeline
8. No coverage thresholds or tracking

---

## Architecture

### Testing Pyramid

```
          ╱╲
         ╱E2E╲           Playwright: critical user journeys
        ╱──────╲          (auth, trading, portfolio)
       ╱ Integr. ╲       tRPC routers via createCallerFactory,
      ╱────────────╲      Hono app.request(), MSW for externals
     ╱  Unit Tests   ╲   Components, hooks, stores, pure logic,
    ╱──────────────────╲  schemas, utilities
```

**Target ratio:** 60% unit · 25% integration · 15% E2E

### Directory Structure

```
tests/
├── setup.ts                    # Global setup (env, MSW server)
├── setup-dom.ts                # DOM setup (RTL cleanup, jest-dom matchers)
├── tsconfig.json               # Test-specific tsconfig
├── helpers.ts                  # Shared test utilities
├── __mocks__/
│   ├── server-only.ts          # No-op (exists)
│   ├── client-only.ts          # No-op (exists)
│   ├── next-navigation.ts      # Mock useRouter, usePathname, useSearchParams
│   └── next-headers.ts         # Mock cookies(), headers()
├── fixtures/
│   ├── index.ts                # Re-exports
│   ├── factory.ts              # Generic factory (exists)
│   ├── ids.ts                  # Deterministic IDs (exists)
│   ├── auth.ts                 # Auth user/session (exists)
│   ├── gamma/                  # Gamma API fixtures
│   │   ├── market.ts           # createMarketFixture() → ValidatedMarket
│   │   └── event.ts            # createEventFixture() → ValidatedEvent
│   ├── clob/                   # CLOB API fixtures
│   │   ├── orderbook.ts        # createOrderBookFixture()
│   │   └── order-response.ts   # createOrderResponseFixture()
│   ├── data/                   # Data API fixtures
│   │   ├── position.ts         # createPositionFixture()
│   │   └── trade.ts            # createTradeFixture()
│   └── websocket/              # WS fixtures (exists, expand)
│       └── fixtures.ts
├── handlers/                   # MSW request handlers
│   ├── index.ts                # Combines all handlers
│   ├── gamma.ts                # Gamma API handlers
│   ├── clob.ts                 # CLOB API handlers
│   ├── data.ts                 # Data API handlers
│   └── magic.ts                # Magic SDK API handlers
├── unit/
│   ├── lib/                    # Pure functions (exists, keep)
│   ├── websocket/              # WS schemas/manager (exists, keep)
│   ├── components/             # NEW: React component tests
│   ├── hooks/                  # NEW: Custom hook tests
│   └── stores/                 # NEW: Zustand store tests
├── integration/
│   ├── routers/                # NEW: tRPC router tests (createCallerFactory)
│   ├── api/                    # NEW: Hono endpoint tests (app.request)
│   ├── gamma.test.ts           # Live API (keep, local-only)
│   ├── clob.test.ts            # Live API (keep, local-only)
│   └── data.test.ts            # Live API (keep, local-only)
└── e2e/                        # NEW: Playwright tests
    ├── fixtures.ts             # Playwright fixtures (auth state, etc.)
    ├── auth.spec.ts            # Login flows
    ├── trading.spec.ts         # Order placement, orderbook
    ├── portfolio.spec.ts       # Positions, PnL
    └── explore.spec.ts         # Market discovery
```

---

## Dependencies

### Add

| Package | Version | Purpose |
|---------|---------|---------|
| `msw` | `^2.7.0` | API + WebSocket mocking |
| `@playwright/test` | `^1.52.0` | E2E testing |
| `@testing-library/user-event` | `^14.6.0` | Realistic user interactions |
| `@testing-library/jest-dom` | `^6.6.0` | DOM assertion matchers |

### Already Installed (activate)

| Package | Version | Purpose |
|---------|---------|---------|
| `@testing-library/react` | `^16.3.2` | Component rendering |
| `@testing-library/dom` | `^10.4.1` | DOM queries |
| `@vitejs/plugin-react` | `^5.2.0` | React transform for Vitest |
| `jsdom` | `^29.0.0` | DOM environment |

### Keep

| Package | Version | Purpose |
|---------|---------|---------|
| `vitest` | `^4.1.2` | Test runner |
| `@vitest/coverage-v8` | `^4.1.2` | Coverage |
| `fast-check` | `^4.6.0` | Property-based testing |

---

## Configuration

### Vitest Config (root — update existing)

```ts
// vitest.config.mts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: "node", // Default for unit/integration
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["tests/e2e/**"],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "lcov"],
      include: [
        "apps/web/src/**/*.{ts,tsx}",
        "apps/server/src/**/*.{ts,tsx}",
        "packages/*/src/**/*.{ts,tsx}",
      ],
      exclude: [
        "**/*.test.*",
        "**/*.d.ts",
        "**/types/**",
        "**/__mocks__/**",
      ],
      thresholds: {
        statements: 50,  // Start low, increase over time
        branches: 45,
        functions: 50,
        lines: 50,
      },
    },
  },
});
```

### Playwright Config (new)

```ts
// playwright.config.ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "blob" : "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev:web",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### DOM Test Setup (new)

```ts
// tests/setup-dom.ts
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

### MSW Setup (new)

```ts
// tests/setup.ts (extend existing)
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## MSW Handlers

### Gamma API

```ts
// tests/handlers/gamma.ts
import { http, HttpResponse } from "msw";
import { createMarketFixture, createEventFixture } from "../fixtures/gamma";

const GAMMA_URL = "https://gamma-api.polymarket.com";

export const gammaHandlers = [
  http.get(`${GAMMA_URL}/markets`, ({ request }) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    return HttpResponse.json([createMarketFixture(slug ? { slug } : undefined)]);
  }),

  http.get(`${GAMMA_URL}/events`, ({ request }) => {
    const url = new URL(request.url);
    const slug = url.searchParams.get("slug");
    return HttpResponse.json([createEventFixture(slug ? { slug } : undefined)]);
  }),
];
```

### CLOB API

```ts
// tests/handlers/clob.ts
import { http, HttpResponse } from "msw";
import { createOrderBookFixture } from "../fixtures/clob";

const CLOB_URL = "https://clob.polymarket.com";

export const clobHandlers = [
  http.get(`${CLOB_URL}/book`, () =>
    HttpResponse.json(createOrderBookFixture())
  ),

  http.get(`${CLOB_URL}/midpoint`, () =>
    HttpResponse.json({ mid: "0.50" })
  ),

  http.get(`${CLOB_URL}/price`, () =>
    HttpResponse.json({ price: "0.50" })
  ),

  http.get(`${CLOB_URL}/tick-size`, () =>
    HttpResponse.json({ minimum_tick_size: 0.01 })
  ),

  http.post(`${CLOB_URL}/order`, () =>
    HttpResponse.json({
      success: true,
      orderID: "test-order-123",
      errorMsg: "",
      status: "live",
    })
  ),

  http.get(`${CLOB_URL}/auth/derive-api-key`, () =>
    HttpResponse.json({
      apiKey: "test-api-key",
      secret: "test-secret",
      passphrase: "test-passphrase",
    })
  ),

  http.get(`${CLOB_URL}/time`, () =>
    HttpResponse.json(Date.now())
  ),
];
```

### Magic SDK (server-side admin)

```ts
// tests/handlers/magic.ts
// Magic admin SDK doesn't use HTTP — mock the module directly
import { vi } from "vitest";

export function createMockMagicAdmin() {
  return {
    token: {
      validate: vi.fn(),
      decode: vi.fn().mockReturnValue([
        "header",
        {
          iss: "did:ethr:0x1234567890abcdef1234567890abcdef12345678",
          sub: "test-subject",
          aud: "did:magic:test-api-key",
          iat: Math.floor(Date.now() / 1000),
          ext: Math.floor(Date.now() / 1000) + 900,
          nbf: Math.floor(Date.now() / 1000),
          tid: "test-tid-123",
        },
      ]),
      getIssuer: vi.fn().mockReturnValue(
        "did:ethr:0x1234567890abcdef1234567890abcdef12345678"
      ),
    },
    users: {
      getMetadataByToken: vi.fn().mockResolvedValue({
        issuer: "did:ethr:0x1234567890abcdef1234567890abcdef12345678",
        publicAddress: "0x1234567890abcdef1234567890abcdef12345678",
        email: "test@example.com",
      }),
      logoutByIssuer: vi.fn(),
    },
  };
}
```

---

## Fixture Validation

Every fixture factory must pass its corresponding Zod schema. Add a validation test file:

```ts
// tests/unit/fixture-validation.test.ts
import { MarketSchema } from "apps/server/src/domains/markets/schemas/gamma";
import { PositionSchema } from "apps/server/src/domains/data/schemas/data";
import { createMarketFixture } from "../fixtures/gamma/market";
import { createPositionFixture } from "../fixtures/data/position";

describe("fixtures pass Zod schemas", () => {
  it("market", () => {
    expect(MarketSchema.safeParse(createMarketFixture()).success).toBe(true);
  });
  it("position", () => {
    expect(PositionSchema.safeParse(createPositionFixture()).success).toBe(true);
  });
});
```

---

## Test Categories

### 1. Unit Tests — Pure Logic (exists, expand)

**Keep all existing tests.** Add:

| Area | Files to Add | Priority |
|------|-------------|----------|
| Zustand stores | `wallet.test.ts`, `preferences.test.ts`, `connection.test.ts` | P1 |
| Custom hooks | `use-session.test.ts`, `use-orderbook.test.ts` | P1 |
| tRPC type helpers | `RouterOutput inference.test.ts` | P2 |
| Error classes | `AppError.test.ts` | P2 |

**Store testing pattern:**

```ts
import { useWalletStore } from "@/stores/wallet";

beforeEach(() => {
  useWalletStore.setState(useWalletStore.getInitialState());
});

it("setConnected updates address and chainId", () => {
  useWalletStore.getState().setConnected("0x123", 137);
  const state = useWalletStore.getState();
  expect(state.address).toBe("0x123");
  expect(state.chainId).toBe(137);
  expect(state.isConnected).toBe(true);
});
```

### 2. Unit Tests — Components (new)

**Environment:** jsdom (via `// @vitest-environment jsdom` per-file or directory config)

| Component | What to Test | Priority |
|-----------|-------------|----------|
| `OrderFormUI` | Renders buy/sell, disabled states, CTA labels | P1 |
| `OrderbookTable` | Renders bids/asks, flash highlights, spread | P1 |
| `WatchlistBar` | Renders items, loading state, empty state | P2 |
| `PortfolioPositionRow` | PnL display, redeem button visibility | P2 |
| `MarketHeader` | Title, price, volume, status badge | P2 |
| `AuthGuard` | Redirects unauthenticated, renders children | P1 |
| `SearchResults` | Renders results, keyboard navigation | P3 |

**Component test pattern:**

```ts
// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrderFormUI } from "@/domains/trading/components/orders/order-form-ui";

it("shows sign-in CTA when trading disabled with action", () => {
  render(
    <OrderFormUI
      tradingDisabled
      tradingActionLabel="Sign in to Trade"
      onTradingAction={vi.fn()}
      // ... required props from fixture
    />
  );
  expect(screen.getByText("Sign in to Trade")).toBeInTheDocument();
});
```

### 3. Integration Tests — tRPC Routers (new)

**Use `createCallerFactory()` to test procedures directly without HTTP.**

| Router | Procedures to Test | Priority |
|--------|-------------------|----------|
| `auth` | `me`, `login`, `walletLogin`, `credentials`, `logout` | P1 |
| `orders` | `place`, `cancel`, `open`, `balanceAllowance` | P1 |
| `markets` | `bySlug`, `list`, `orderbook`, `priceHistory` | P1 |
| `portfolio` | `positions`, `value`, `ctfTokenBalances` | P2 |
| `watchlist` | `list`, `add`, `remove` | P2 |
| `activity` | `trades`, `openInterest` | P3 |

**Router test pattern:**

```ts
import { createCallerFactory } from "@trpc/server";
import { appRouter } from "apps/server/src/routers";

const createCaller = createCallerFactory(appRouter);

describe("markets router", () => {
  it("bySlug returns market data", async () => {
    // MSW intercepts the Gamma API call
    const caller = createCaller({
      db: mockDb,
      user: null, // public procedure
    });
    const market = await caller.markets.bySlug({ slug: "test-market" });
    expect(market.slug).toBe("test-market");
  });

  it("orderbook returns bids and asks", async () => {
    const caller = createCaller({ db: mockDb, user: null });
    const book = await caller.markets.orderbook({
      tokenId: "test-token-id",
    });
    expect(book.bids.length).toBeGreaterThan(0);
    expect(book.asks.length).toBeGreaterThan(0);
  });
});
```

### 4. Integration Tests — Hono Endpoints (new)

**Use Hono's built-in `app.request()` — no supertest needed.**

```ts
import { app } from "apps/server/src/index";

it("health check returns 200", async () => {
  const res = await app.request("/health");
  expect(res.status).toBe(200);
});

it("tRPC batch request works", async () => {
  const res = await app.request(
    "/trpc/markets.bySlug?batch=1&input={\"0\":{\"slug\":\"test\"}}",
    { headers: { "Content-Type": "application/json" } }
  );
  expect(res.status).toBe(200);
});
```

### 5. E2E Tests — Playwright (new)

| Flow | What to Test | Priority |
|------|-------------|----------|
| Explore | Page loads, markets render, search works, category filter | P1 |
| Market page | Loads, orderbook renders, chart renders, price displays | P1 |
| Auth (email) | Login → callback → session established → redirect | P2 |
| Trading | Place order → confirmation → open orders update | P2 |
| Portfolio | Positions render, PnL displays, tab switching | P2 |
| Watchlist | Add/remove market, bar updates | P3 |

**E2E fixture pattern (Playwright):**

```ts
// tests/e2e/fixtures.ts
import { test as base } from "@playwright/test";

export const test = base.extend({
  marketPage: async ({ page }, use) => {
    await use({
      goto: async (slug: string) => {
        await page.goto(`/market/${slug}`);
        await page.waitForLoadState("networkidle");
      },
    });
  },
});
```

**E2E test example:**

```ts
// tests/e2e/explore.spec.ts
import { test, expect } from "@playwright/test";

test("explore page loads and shows markets", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByRole("heading", { name: /explore/i })).toBeVisible();
  await expect(page.locator("[data-testid='market-card']").first()).toBeVisible();
});

test("search finds markets", async ({ page }) => {
  await page.goto("/explore");
  await page.getByRole("button", { name: /search/i }).click();
  await page.getByRole("textbox").fill("bitcoin");
  await expect(page.getByText(/bitcoin/i).first()).toBeVisible();
});
```

---

## CI Integration

### Phase 1 — Unit tests in CI (immediate)

```yaml
# .github/workflows/ci.yml — add after typecheck job
test:
  name: Test
  runs-on: ubuntu-latest
  needs: [lint, typecheck]
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: pnpm test:unit
```

### Phase 2 — Integration tests in CI (after MSW setup)

```yaml
    - run: pnpm test:unit
    - run: pnpm test:integration  # MSW-backed, no live APIs
```

### Phase 3 — E2E tests in CI (after Playwright setup)

```yaml
e2e:
  name: E2E
  runs-on: ubuntu-latest
  needs: [test]
  steps:
    - uses: actions/checkout@v4
    - uses: pnpm/action-setup@v4
    - uses: actions/setup-node@v4
      with:
        node-version: 22
        cache: pnpm
    - run: pnpm install --frozen-lockfile
    - run: npx playwright install chromium --with-deps
    - run: pnpm build
    - run: pnpm test:e2e
    - uses: actions/upload-artifact@v4
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/
```

---

## Implementation Order

### Sprint 1 — Foundation (1-2 days)

1. Install `msw`, `@testing-library/user-event`, `@testing-library/jest-dom`
2. Create `tests/setup-dom.ts` with RTL cleanup + jest-dom matchers
3. Create `tests/handlers/` with MSW handlers for Gamma, CLOB, Data APIs
4. Create fixture factories for Gamma markets, CLOB orderbook, Data positions
5. Add fixture validation tests (Zod schema checks)
6. Add `pnpm test:unit` to `ci.yml`

### Sprint 2 — Store & Hook Tests (1-2 days)

7. Zustand store tests: wallet, preferences, connection
8. Hook tests: `useSession`, `useOrderbook` (with MSW + QueryClient wrapper)
9. Error class tests: `AppError`

### Sprint 3 — Component Tests (2-3 days)

10. `OrderFormUI` — states, CTAs, disabled logic
11. `OrderbookTable` — rendering, flash
12. `AuthGuard` — redirect behavior
13. `WatchlistBar` — items, loading, empty
14. `MarketHeader` — data display

### Sprint 4 — Router Integration Tests (2-3 days)

15. Set up `createCallerFactory` test harness with mock context
16. `markets` router — bySlug, list, orderbook, priceHistory
17. `auth` router — me, login, credentials
18. `orders` router — place, cancel, open
19. `portfolio` router — positions, value

### Sprint 5 — E2E Tests (2-3 days)

20. Install Playwright, create config
21. Explore page — loads, search, categories
22. Market page — loads, orderbook, chart
23. Portfolio — positions, tabs
24. Add Playwright to CI

### Sprint 6 — Coverage & Polish (1 day)

25. Set coverage thresholds (start at 50%, increase quarterly)
26. Add coverage reporting to CI (lcov → Codecov or similar)
27. Document test conventions in `tests/AGENTS.md`

---

## Conventions

### File Naming

- Unit tests: `{module}.test.ts` or `{component}.test.tsx`
- Integration tests: `{router}.test.ts`
- E2E tests: `{flow}.spec.ts` (Playwright convention)
- Property tests: `{module}.property.test.ts`
- Fixtures: `{domain}.ts` in `tests/fixtures/{domain}/`

### Test Structure

```ts
describe("module name", () => {
  // Setup
  beforeEach(() => { /* reset state */ });

  // Happy path first
  it("does the expected thing", () => {});

  // Edge cases
  it("handles empty input", () => {});

  // Error cases
  it("throws on invalid input", () => {});
});
```

### Rules

- No `.only` or `.skip` in committed code
- No `console.log` in tests — use `vi.spyOn(console, "log")`
- No `setTimeout` for waiting — use `waitFor()` or `vi.useFakeTimers()`
- No shared mutable state between tests — reset in `beforeEach`
- Every fixture factory validates against its Zod schema
- Integration tests that hit live APIs stay behind `hasServerEnv` guard
- E2E tests use user-facing locators (`getByRole`, `getByText`), not CSS selectors
