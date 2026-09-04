---
name: Utils standardization refactor
overview: Standardize and refactor utility code across the codebase by consolidating duplicated formatting logic, clarifying lib vs utils vs component-local conventions, and documenting when and where to add new helpers.
todos: []
isProject: false
---

# Utils Standardization and Refactor Plan

## Current state

### Layout and naming

- `**apps/web/src/lib/**` — Domain and UI helpers: [utils.ts](apps/web/src/lib/utils.ts) (only `cn`), [format.ts](apps/web/src/lib/format.ts), [trading-utils.ts](apps/web/src/lib/trading-utils.ts), [profile-utils.ts](apps/web/src/lib/profile-utils.ts), [leaderboard-utils.ts](apps/web/src/lib/leaderboard-utils.ts), [bridge-utils.ts](apps/web/src/lib/bridge-utils.ts), [market-utils.ts](apps/web/src/lib/market-utils.ts), plus subdirs (auth, magic, polymarket, websocket, seo).
- `**apps/web/src/utils/**` — Only tRPC: [trpc.ts](apps/web/src/utils/trpc.ts), [trpc-server.ts](apps/web/src/utils/trpc-server.ts). These are API client setup, not generic “utils.”
- **Component-local `*-utils.ts**` — Colocated with components: [activity-feed-utils.ts](apps/web/src/components/trading/activity/activity-feed-utils.ts), [whale-tracker-utils.ts](apps/web/src/components/trading/activity/whale-tracker-utils.ts), [price-chart-utils.ts](apps/web/src/components/trading/charts/price-chart-utils.ts), [comments-utils.ts](apps/web/src/components/market/comments-utils.ts), [crypto-prices-utils.ts](apps/web/src/components/market/crypto-prices-utils.ts), [pnl-card-utils.ts](apps/web/src/components/portfolio/pnl-card-utils.ts).

### Duplication


| Logic                                                 | Locations                                                                                                                                                                                                                                                                    | Notes                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| **formatCompact** (decimal formatting for K/M suffix) | [format.ts](apps/web/src/lib/format.ts) (private), [profile-utils.ts](apps/web/src/lib/profile-utils.ts) (private), [leaderboard-utils.ts](apps/web/src/lib/leaderboard-utils.ts) (private)                                                                                  | Identical; three copies.                                 |
| **Compact USD** (e.g. $1.2M, $500K)                   | [format.ts](apps/web/src/lib/format.ts) (`formatUsdValue` — not exported), [profile-utils.ts](apps/web/src/lib/profile-utils.ts) (`formatProfileValue`), [leaderboard-utils.ts](apps/web/src/lib/leaderboard-utils.ts) (`formatLeaderboardValue`)                            | Same algorithm; only zero display differs ($0.00 vs $0). |
| **K/M number formatting** (no currency)               | [trading-utils.ts](apps/web/src/lib/trading-utils.ts) `formatVolume`, [activity-feed-utils.ts](apps/web/src/components/trading/activity/activity-feed-utils.ts) `formatTradeSize`, [pnl-card-utils.ts](apps/web/src/components/portfolio/pnl-card-utils.ts) `formatCardSize` | Same pattern; could share a single helper.               |


### Server (apps/server) — audited

- **Layout:** All shared code lives in `src/lib/`. No top-level `utils/` folder; no `*-utils.ts` naming.
- **Formatting:** No display formatting (no number/currency/date formatters). Only “format” mentions are validation/API (DID token format, header format, HTTP-date in parseRetryAfter).
- **Recommendation:** No changes for utils standardization. Convention is clear; no duplication. If server later needs display formatting, use a shared formatter from web or a future `packages/format` package.

**Lib file-by-file (apps/server/src/lib/):**


| File                                                                                                                                                                                                                                                                                                      | Purpose                                                                                                  | Notes                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| [errors.ts](apps/server/src/lib/errors.ts)                                                                                                                                                                                                                                                                | ApiError, ErrorCode, classifyHttpError, classifyNetworkError, parseRetryAfter (private)                  | Single source for upstream API error classification.                                                    |
| [map-api-error.ts](apps/server/src/lib/map-api-error.ts)                                                                                                                                                                                                                                                  | mapApiErrorToTRPC, withPolymarketError                                                                   | Maps ApiError → TRPCError at router boundary. Depends on errors.ts.                                     |
| [retry.ts](apps/server/src/lib/retry.ts)                                                                                                                                                                                                                                                                  | withRetry, computeDelay                                                                                  | Exponential backoff + jitter; only retries ApiError when retryable.                                     |
| [cache.ts](apps/server/src/lib/cache.ts)                                                                                                                                                                                                                                                                  | TtlCache (LRU), buildCacheKey                                                                            | In-memory TTL cache; key format `${source}:${path}?params`.                                             |
| [rate-limiter.ts](apps/server/src/lib/rate-limiter.ts)                                                                                                                                                                                                                                                    | TokenBucket, DualWindowLimiter, LimiterRegistry, sharedRegistry, destroyAllLimiters, computeBackoffDelay | Config-driven; depends on rate-limit-config.                                                            |
| [rate-limit-config.ts](apps/server/src/lib/rate-limit-config.ts)                                                                                                                                                                                                                                          | Types, Zod schemas, SOURCE_TO_FAMILY, RATE_LIMIT_CONFIG                                                  | Config only; no runtime “utils” logic.                                                                  |
| [circuit-breaker.ts](apps/server/src/lib/circuit-breaker.ts)                                                                                                                                                                                                                                              | CircuitBreaker (CLOSED/OPEN/HALF_OPEN)                                                                   | Throws ApiError(CIRCUIT_OPEN). Used by resilient-fetch.                                                 |
| [deduplicator.ts](apps/server/src/lib/deduplicator.ts)                                                                                                                                                                                                                                                    | RequestDeduplicator.dedupe(key, fn)                                                                      | Coalesces in-flight requests by key.                                                                    |
| [balance.ts](apps/server/src/lib/balance.ts)                                                                                                                                                                                                                                                              | getUsdcBalanceOnPolygon(address)                                                                         | Ethers provider + ERC20 balanceOf. Single purpose.                                                      |
| [validate-config.ts](apps/server/src/lib/validate-config.ts)                                                                                                                                                                                                                                              | validateConfig()                                                                                         | Startup check: builder creds and (prod) sign tokens.                                                    |
| [polymarket/resilient-fetch.ts](apps/server/src/lib/polymarket/resilient-fetch.ts)                                                                                                                                                                                                                        | createResilientFetch, rawFetch                                                                           | Composes rateLimiter → dedup → cache → circuitBreaker → retry → fetch + Zod. Shared cache/deduplicator. |
| [polymarket/gamma.ts](apps/server/src/lib/polymarket/gamma.ts), [data.ts](apps/server/src/lib/polymarket/data.ts), [clob-read.ts](apps/server/src/lib/polymarket/clob-read.ts), [bridge.ts](apps/server/src/lib/polymarket/bridge.ts)                                                                     | API clients                                                                                              | All use createResilientFetch; throw ApiError on failure.                                                |
| [polymarket/schemas/*](apps/server/src/lib/polymarket/schemas/)                                                                                                                                                                                                                                           | Zod schemas for Gamma, Data, CLOB, Bridge                                                                | Validation only.                                                                                        |
| [polymarket/filters.ts](apps/server/src/lib/polymarket/filters.ts), [enrich-positions.ts](apps/server/src/lib/polymarket/enrich-positions.ts), [tradeability-cache.ts](apps/server/src/lib/polymarket/tradeability-cache.ts), [liquidity-metrics.ts](apps/server/src/lib/polymarket/liquidity-metrics.ts) | Domain helpers                                                                                           | No “utils” naming; clear single purpose each.                                                           |


No duplicated logic across these files. Error flow: ApiError (errors.ts) → mapApiErrorToTRPC (map-api-error.ts) → TRPCError; web consumes via getTrpcDisplayMessage.

### Packages — audited

- **Recommendation:** No changes. No duplicated utils or formatting. Error layers are distinct and consistent (see below). If we add shared display formatting later, that would be a new `packages/format` package.

**Lib file-by-file by package:**

**packages/api/src/lib/**


| File                                                                  | Purpose                                                       | Notes                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [errors.ts](packages/api/src/lib/errors.ts)                           | createAppError(opts) → TRPCError with why/fix/link            | Procedure-originated errors for rich client UX. Different from server ApiError (upstream API). |
| [relayer-errors.ts](packages/api/src/lib/relayer-errors.ts)           | mapRelayerOrBuilderMessage(message)                           | SDK/relayer error strings → user-facing copy. Used by builder.ts.                              |
| [builder.ts](packages/api/src/lib/builder.ts)                         | deploySafe, createRelayClient                                 | Uses relayer-errors for thrown messages.                                                       |
| [session.ts](packages/api/src/lib/session.ts)                         | createSessionToken, verifySessionToken (JWT)                  | jose; no formatting.                                                                           |
| [crypto.ts](packages/api/src/lib/crypto.ts)                           | encrypt, decrypt (AES-256-GCM)                                | Node crypto; no formatting.                                                                    |
| [approval-txs.ts](packages/api/src/lib/approval-txs.ts)               | createApprovalTransactions                                    | Ethers interfaces (ethers.utils.Interface — external). Constants + ABIs.                       |
| [clob-factory.ts](packages/api/src/lib/clob-factory.ts)               | createUserClobClient                                          | Uses clob + crypto; factory only.                                                              |
| [clob/client.ts](packages/api/src/lib/clob/client.ts)                 | deriveOrCreateApiKey, re-exports from @polymarket/clob-client | Thin wrapper; uses @polymarket/order-utils type only.                                          |
| [clob/address-signer.ts](packages/api/src/lib/clob/address-signer.ts) | createAddressOnlySigner                                       | L2 signer for server-side CLOB.                                                                |


**packages/db/src/** (no dedicated lib/; top-level helpers)


| File                                                                                 | Purpose                      | Notes                                                     |
| ------------------------------------------------------------------------------------ | ---------------------------- | --------------------------------------------------------- |
| [connection-url.ts](packages/db/src/connection-url.ts)                               | normalizeConnectionUrl(url)  | Replaces deprecated sslmode values for pg. Single helper. |
| [load-env.ts](packages/db/src/load-env.ts)                                           | dotenv.config for migrations | Bootstrap when running from packages/db.                  |
| [migrate.ts](packages/db/src/migrate.ts), [baseline.ts](packages/db/src/baseline.ts) | Migration runners            | Entrypoints; not “utils.”                                 |
| [queries/users.ts](packages/db/src/queries/users.ts)                                 | upsertUser, etc.             | Query layer; not lib.                                     |


**packages/logger/src/** — index.ts (Pino logger, formatters config), client.ts (client-safe logger). No lib/; no formatting logic.

**packages/env/src/** — server.ts, web.ts (createEnv). Entrypoints only; no lib/.

**packages/types** — Type definitions only; no runtime lib.

**Error layering (no duplication):** Procedure throws createAppError (api) or withPolymarketError wraps and mapApiErrorToTRPC (server); client uses getTrpcDisplayMessage (web). Relayer/SDK errors use mapRelayerOrBuilderMessage (api). Each layer has a clear role.

Server and packages do not define their own “utils” modules for formatting; standardization work is scoped to the web app unless a shared package is introduced later.

### CLOB and order utils (audit notes)

- **CLOB client bootstrap** — Already standardized and **multi-user**. Single entry points: `createClobClient(config)` in [packages/api/src/lib/clob/client.ts](packages/api/src/lib/clob/client.ts), `createUserClobClient(user)` in [packages/api/src/lib/clob-factory.ts](packages/api/src/lib/clob-factory.ts). Server uses `getUserClient(userId)` → fetches user → `createUserClobClient(user)` with that user’s decrypted CLOB creds and Safe; web uses the current session’s signer/Safe. Env (CLOB_API_URL, CHAIN_ID) is app-level; per-user data (encryptedCreds, safeAddress) is in the user record. Reference-example “bootstrap” (load one .env → one client) is **single-user/script-only** and not applicable to Doji. No new CLOB bootstrap util needed for this plan.
- **Order expiration** — Single helper already exists: `calculateExpiration(orderType, userExpiration?)` in [apps/web/src/lib/polymarket/order-utils.ts](apps/web/src/lib/polymarket/order-utils.ts) (GTC/FOK/FAK → "0"; GTD → userExpiration + 60s threshold). [place-order-client.ts](apps/web/src/lib/polymarket/place-order-client.ts) currently hardcodes `expiration: 0` when creating orders; the util is the single place for the logic but is not yet wired for GTD with user-set expiry. Optional follow-up when we add GTD + user expiration in the UI: pass `params.expiration` and use `calculateExpiration("GTD", params.expiration)` in place-order-client.
- **Reference scripts (clob-client)** — Audited `references/clob-client/examples`: no shared utils there; each script does its own dotenv + client setup. Those scripts are **single-user** (one .env = one PK, one set of CLOB creds per run). Any shared bootstrap there (e.g. `_bootstrap.ts`: load dotenv, getClobEnv, createClobClientFromEnv) would be for that single-user script use only. Doji handles **multiple users** via `createUserClobClient(user)` and does not use script-style bootstrap. That would live in the reference repo only and does not change Doji.
- **Reference scripts (builder-relayer-client)** — Same idea: examples are **single-user** (one .env per run). deploy.ts, approve.ts, etc. load dotenv and build one RelayClient for one wallet. Doji is multi-user: `createRelayClient(signer)` is called with the signer from the current auth context (per request/per session). No plan changes; optional reference-repo improvement would be a shared single-user bootstrap for those examples only.
- **Reference clob-order-utils** (`references/clob-order-utils` = `@polymarket/order-utils`): Official package for EIP-712 order building and signing. Exports `ExchangeOrderBuilder`, `EIP712_DOMAIN`, `ORDER_STRUCTURE`, `SignatureType` (EOA, POLY_PROXY, POLY_GNOSIS_SAFE), `Order`/`OrderData`/`SignedOrder`, and a non-exported `generateOrderSalt()` (weak: `Math.random()` + `Date.now()`). Doji uses it only for the **SignatureType** type ([packages/api/src/lib/clob/client.ts](packages/api/src/lib/clob/client.ts)); order creation and posting go through `@polymarket/clob-client` (createOrder/postOrder). Our [apps/web/src/lib/polymarket/order-utils.ts](apps/web/src/lib/polymarket/order-utils.ts) is higher-level: contract addresses, `generateSalt` (crypto.getRandomValues, stronger than the package’s), `toRawAmount`/`calculateAmounts`, `getExchangeAddress(negRisk)`, `calculateExpiration`, `sideToNumeric`. No duplication of EIP-712 or order signing; our utils complement the package. No plan changes needed.

---

## Architecture principle

We organize by **technical layer first** (components, hooks, lib, utils, stores), then by **feature/domain within each layer** (e.g. `components/trading/`, `lib/trading-utils.ts`). We do not use a top-level `features/` folder. Next.js does not assign special meaning to `lib` or `utils`; our convention is for consistency and dependency boundaries only.

---

## Goals

1. **Single source of truth** for number/currency/compact formatting (no duplicated `formatCompact` or compact USD).
2. **Clear convention**: when code lives in `lib/` vs `utils/` vs component-local `*-utils.ts`.
3. **Strict module boundary**: utils = pure, no app imports; lib = integrations + domain, may import utils.
4. **Documentation** in AGENTS.md for future additions.

---

## Module boundaries (lib vs utils)

- **utils/** — Pure, framework-agnostic helper functions only. **No imports from other app code** (no `@/lib`, `@/components`, `@/stores`, etc.). Rule of thumb: *Could this code work in any JavaScript project?* If yes, it belongs in utils. Examples: number/date/string formatters, compact number formatting.
- **lib/** — Framework-specific code, third-party integrations, app-level glue, and domain helpers. **May import from utils** and from other lib modules. Examples: tRPC client, Magic auth, `cn()` (shadcn), trading-utils, profile-utils, bridge-utils, formatPnl (if it composes utils).
- **Dependency direction:** lib → utils is allowed; utils → lib is not. Component-local `*-utils.ts` may import from both but should prefer utils for pure formatting to avoid duplication.
- *Optional (later):* Enforce "utils has no internal app imports" via lint or import rules.

---

## Plan

### 1. Consolidate formatting; put pure formatters in utils, keep domain/formatPnl in lib

- **Create [utils/format.ts**](apps/web/src/utils/format.ts) with pure helpers only (no app imports): `formatCompactNumber`, `formatUsdCompact`, `formatVolumeLike`. These are framework-agnostic and belong in utils per the module boundary.
- **Keep [lib/format.ts**](apps/web/src/lib/format.ts) for `formatPnl` (which uses formatUsdCompact) and re-export the pure helpers from `@/utils/format` so existing `@/lib/format` imports keep working. lib/format.ts thus composes utils and stays in lib.
- **Export from utils/format.ts:** `formatCompactNumber`, `formatUsdCompact`, `formatVolumeLike`. Implement once; remove duplicated logic from profile-utils, leaderboard-utils, trading-utils, and optionally from activity-feed-utils and pnl-card-utils.
- **Refactor profile-utils and leaderboard-utils:** Have them call `formatUsdCompact` from `@/utils/format` (or re-export from lib/format). Thin wrappers for backward compatibility (e.g. `zeroDisplay: "$0.00"` for profile) are fine.
- **trading-utils:** Use `formatVolumeLike` from `@/utils/format` for `formatVolume`. Other trading helpers (getConditionId, formatPriceCents, formatEndDate, formatResolutionDate) stay in lib; they can import from `@/utils/format`.
- **Optional:** Refactor activity-feed-utils and pnl-card-utils to import `formatVolumeLike` or format helpers from `@/utils/format` instead of reimplementing.

### 2. Clarify `lib/` vs `utils/` and naming

- **Option A (recommended):** Move tRPC to `lib/trpc/` (client and server); keep `utils/` for pure formatters only ([utils/format.ts](apps/web/src/utils/format.ts)). Update imports to `@/lib/trpc` and `@/lib/trpc-server`. Result: utils/ = pure helpers; lib/ = tRPC, cn, domain utils, lib/format (re-exports + formatPnl). Dependency: lib may import utils; utils never imports lib.
- **Option B:** Keep `utils/` but reserve it for “app wiring” (tRPC, future API clients). Document in AGENTS.md that `lib/` = domain + UI helpers + formatting, `utils/` = client/wiring only.
- **Rename or document** [lib/utils.ts](apps/web/src/lib/utils.ts): keep filename for shadcn compatibility; in AGENTS.md state that `lib/utils.ts` is for generic UI helpers (e.g. `cn`) only, and that domain-specific helpers live in `lib/<domain>-utils.ts` or `lib/format.ts`.

### 3. Component-local utils

- **Keep** component-local `*-utils.ts` files for:
  - Component-specific types (e.g. `ActivityFeedItem`, `Comment`, `PnlCardData`).
  - Logic that is only used by that component subtree (e.g. whale detection, comment normalization).
- **Refactor** only where they duplicate formatting: replace local number/currency formatting with imports from `@/utils/format` or `@/lib/format` (and `@/lib/trading-utils` for price/date where it stays there). Do not move component-only types or logic into lib unless multiple apps or packages need them.

### 4. Documentation updates

- **[apps/web/src/lib/AGENTS.md](apps/web/src/lib/AGENTS.md):**
  - **Architecture principle:** Technical layer first (components, hooks, lib, utils, stores), then feature/domain within each layer. Next.js does not assign special meaning to folder names.
  - **Module boundary:** utils/ = pure helpers (no app imports). lib/ may import from utils. Dependency: lib → utils only.
  - List **utils/format.ts** and **lib/format.ts**: pure formatters in utils; formatPnl and re-exports in lib.
  - Add a short “Where to add new helpers” section:
    - **utils/format.ts** — Pure formatters (formatCompactNumber, formatUsdCompact, formatVolumeLike). No app imports.
    - **lib/format.ts** — formatPnl and re-exports from utils/format.
    - **lib/****-utils.ts** — Domain logic and domain-specific formatting (e.g. trading-utils, bridge-utils) used across the app.
    - **lib/utils.ts** — Generic UI helpers (e.g. `cn`); keep minimal.
    - **Component `*-utils.ts**` — Types and logic used only by that component (or its subtree); use `@/utils/format` or `@/lib/format` (and lib domain-utils) instead of reimplementing formatting.
  - Note: tRPC lives under `lib/trpc`; pure formatters in `utils/format.ts`.
- **Root or web AGENTS.md:** One line on technical-layer-first organization and that utils/ is for pure helpers only.

### 5. Testing and quality

- **Tests:** Ensure utils/format.ts and lib/format.ts (and any new helpers) have unit tests for edge cases (zero, negatives, large numbers). Existing tests that import from profile-utils or leaderboard-utils should keep passing after switching to formatUsdCompact from utils/format.
- **Lint/format:** Run `pnpm fix` after all edits.
- **No new package in this phase:** Keep formatting in the web app. If the server (or another app) later needs the same formatting, extract a `@doji/format` (or similar) package in a follow-up.

---

## Implementation order (suggested)

1. **Format consolidation** — Create utils/format.ts with formatCompactNumber, formatUsdCompact, formatVolumeLike (pure). Refactor lib/format.ts to re-export and keep formatPnl. Refactor profile-utils, leaderboard-utils, trading-utils; optionally activity-feed-utils and pnl-card-utils. Add/update tests.
2. **Location/naming** — Move tRPC to lib/trpc (Option A); utils/ stays for pure formatters. Update imports and AGENTS.md.
3. **Component utils** — Replace duplicated formatting with @/utils/format or @/lib/format where it makes sense.
4. **AGENTS.md** — Finalize “Where to add new helpers” and format.ts description.

---

## Out of scope (for later)

- Moving shared formatting into a `packages/format` (or `@doji/format`) package.
- Changing server or packages structure for “utils” (audited above; server and all packages have no utils duplication or naming issues).
- Large renames of existing files beyond the tRPC move (e.g. renaming all `*-utils.ts` to `*-helpers.ts`).
- **CLOB / order utils:** No new standardized utils needed from CLOB example scripts; we already have centralized **multi-user** client creation (`createUserClobClient(user)`, `createRelayClient(signer)` with auth context) and `calculateExpiration`. Reference-example bootstrap is single-user/script-only and not for Doji. If we add our own CLOB/relayer scripts under `tools/` or `scripts/` later (e.g. one-off ops), a small single-user script bootstrap could be added then. Wiring `calculateExpiration` into place-order-client for GTD with user expiration is an optional follow-up when that UI exists.

