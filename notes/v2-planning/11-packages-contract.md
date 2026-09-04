# 11 — Packages & Contracts

> **Phase 0** · Risk: Low · Status: 🔴 Not started
>
> New `packages/contract` package for the API contract, pre-computed type helpers,
> branded types, and Zod v4 patterns.

## Current State (2026-05-02 survey)

| Metric | Current |
|--------|---------|
| `AppRouter` imports (web) | 7 files, all `from "server/routers/index"` |
| `inferRouterOutputs` call sites | 4 files (types.ts, query-client.ts, market-terminal-shell.tsx, portfolio/page.tsx) |
| `inferRouterInputs` call sites | 1 file (query-client.ts) |
| Branded types | Defined in `packages/types/src/branded.ts` — 6 types, 6 constructors, **zero enforcement** |
| Zod version | v4.3.6 (catalog in pnpm-workspace.yaml) |
| `packages/contract` | Does not exist |

### AppRouter Import Locations

| File | Import | Usage |
|------|--------|-------|
| `apps/web/src/shared/lib/trpc/index.ts` | `import type { AppRouter } from "server/routers/index"` | `createTRPCClient<AppRouter>`, `createTRPCOptionsProxy<AppRouter>` |
| `apps/web/src/shared/lib/trpc/server.ts` | same | `createTRPCClient<AppRouter>` (server-side) |
| `apps/web/src/shared/lib/trpc/keys.ts` | same | `createTRPCOptionsProxy<AppRouter>`, `createTRPCClient<AppRouter>` |
| `apps/web/src/shared/lib/trpc/query-client.ts` | same | `inferRouterInputs<AppRouter>`, `inferRouterOutputs<AppRouter>` |
| `apps/web/src/shared/lib/trpc/types.ts` | same | `inferRouterOutputs<AppRouter>` |
| `apps/web/src/features/watchlist/hooks/use-watchlist.ts` | same | `TRPCClientErrorLike<AppRouter>` |
| `apps/web/src/app/(trading)/market/[slug]/market-terminal-shell.tsx` | same | `inferRouterOutputs<AppRouter>["markets"]["getBySlug"]` |
| `apps/web/src/app/portfolio/page.tsx` | same | `inferRouterOutputs<AppRouter>["data"]["closedPositions"][number]` |

**Problem:** Web imports directly from `server/routers/index` — a cross-app boundary that only works because of TypeScript path aliases. This couples the web build to server internals and prevents independent package versioning.

---

## Section 1: `packages/contract` Design

Purpose: The API contract between server and client. **Type imports only, zero runtime code.** This package re-exports `AppRouter` and pre-computes `RouterOutput`/`RouterInput` so consumers never import from server internals.

### 1a. Directory Structure

```
packages/contract/
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

### 1b. File Contents

**`packages/contract/package.json`**

```json
{
  "name": "@doji/contract",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@trpc/server": "catalog:"
  },
  "devDependencies": {
    "@doji/config": "workspace:*",
    "typescript": "catalog:"
  }
}
```

> No runtime dependencies. `@trpc/server` is needed only for `inferRouterOutputs`/`inferRouterInputs` types. The server app is referenced via TypeScript path alias (same pattern as today), but only this one package crosses that boundary — web never does.

**`packages/contract/tsconfig.json`**

```json
{
  "extends": "@doji/config/tsconfig.base.json",
  "compilerOptions": {
    "paths": {
      "server/*": ["../../apps/server/src/*"]
    }
  },
  "include": ["src"]
}
```

**`packages/contract/src/index.ts`**

```ts
/**
 * @doji/contract — API contract between server and client.
 *
 * Type-only package. Re-exports AppRouter and pre-computes RouterOutput/RouterInput
 * so consumers never import from server internals directly.
 *
 * Usage:
 *   import type { AppRouter, RouterOutput, RouterInput } from "@doji/contract";
 *   type Market = RouterOutput["markets"]["getBySlug"];
 */
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter as _AppRouter } from "server/routers/index";

// --- Core types ---

export type { _AppRouter as AppRouter };

/** Pre-computed output types for every tRPC procedure. */
export type RouterOutput = inferRouterOutputs<_AppRouter>;

/** Pre-computed input types for every tRPC procedure. */
export type RouterInput = inferRouterInputs<_AppRouter>;

// --- Procedure-level helpers (add as needed) ---

// Markets
export type MarketBySlug = RouterOutput["markets"]["getBySlug"];
export type MarketSearch = RouterOutput["markets"]["search"];

// Events
export type EventBySlug = RouterOutput["events"]["getBySlug"];
export type EventList = RouterOutput["events"]["list"];
export type EventSeries = RouterOutput["events"]["seriesById"];

// Data
export type PositionsOutput = RouterOutput["data"]["positions"];
export type ClosedPositionItem =
  RouterOutput["data"]["closedPositions"][number];
export type ActivityItem = RouterOutput["data"]["activity"][number];
export type ActivityWithMarketsItem =
  RouterOutput["data"]["activityWithMarkets"][number];
export type LeaderboardOutput = RouterOutput["data"]["leaderboard"];
export type OpenInterestOutput = RouterOutput["data"]["openInterest"];
export type LiveVolumeOutput = RouterOutput["data"]["liveVolume"];
export type TradesWithMarketsItem =
  RouterOutput["data"]["tradesWithMarkets"][number];
export type HoldersPage = RouterOutput["data"]["holders"];

// Trading / CLOB
export type OrderBookOutput = RouterOutput["clob"]["getOrderBook"];
export type OpenOrdersWithMarkets =
  RouterOutput["clob"]["getOpenOrdersWithMarkets"];
export type BalanceAllowance = RouterOutput["clob"]["getBalanceAllowance"];

// Watchlist
export type WatchlistItem = RouterOutput["watchlist"]["list"][number];
export type WatchlistToggleOutput = RouterOutput["watchlist"]["toggle"];

// Wallets
export type TrackedWalletItem = RouterOutput["wallets"]["list"][number];
export type WalletActivityPage = RouterOutput["wallets"]["activity"];

// Auth
export type MeOutput = RouterOutput["auth"]["me"];

// Input helpers (for cached server functions)
export type EventListInput = RouterInput["events"]["list"];
export type LeaderboardInput = RouterInput["data"]["leaderboard"];
export type OpenInterestInput = RouterInput["data"]["openInterest"];
export type LiveVolumeInput = RouterInput["data"]["liveVolume"];
```

---

## Section 2: Usage Migration

### 2a. Web tRPC Files

Every file that currently imports `from "server/routers/index"` switches to `from "@doji/contract"`.

**`apps/web/src/shared/lib/trpc/index.ts`**

```diff
- import type { AppRouter } from "server/routers/index";
+ import type { AppRouter } from "@doji/contract";
```

**`apps/web/src/shared/lib/trpc/server.ts`**

```diff
- import type { AppRouter } from "server/routers/index";
+ import type { AppRouter } from "@doji/contract";
```

**`apps/web/src/shared/lib/trpc/keys.ts`**

```diff
- import type { AppRouter } from "server/routers/index";
+ import type { AppRouter } from "@doji/contract";
```

**`apps/web/src/shared/lib/trpc/query-client.ts`**

```diff
- import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
- import type { AppRouter } from "server/routers/index";
+ import type {
+   EventBySlug as EventBySlugOutput,
+   EventListInput,
+   EventListOutput,
+   LeaderboardInput,
+   LeaderboardOutput,
+   LiveVolumeInput,
+   LiveVolumeOutput,
+   MarketBySlug as MarketBySlugOutput,
+   OpenInterestInput,
+   OpenInterestOutput,
+ } from "@doji/contract";

- type RouterInput = inferRouterInputs<AppRouter>;
- type RouterOutput = inferRouterOutputs<AppRouter>;
- type EventListInput = RouterInput["events"]["list"];
- type EventListOutput = RouterOutput["events"]["list"];
- type LeaderboardInput = RouterInput["data"]["leaderboard"];
- type LeaderboardOutput = RouterOutput["data"]["leaderboard"];
- type OpenInterestInput = RouterInput["data"]["openInterest"];
- type OpenInterestOutput = RouterOutput["data"]["openInterest"];
- type LiveVolumeInput = RouterInput["data"]["liveVolume"];
- type LiveVolumeOutput = RouterOutput["data"]["liveVolume"];
- type MarketBySlugOutput = RouterOutput["markets"]["getBySlug"];
- type EventBySlugOutput = RouterOutput["events"]["getBySlug"];
```

> Note: `EventListOutput` needs to be added to `@doji/contract` (it's `RouterOutput["events"]["list"]` — already there as `EventList`). Alias or rename as needed.

**`apps/web/src/shared/lib/trpc/types.ts`**

```diff
- import type { inferRouterOutputs } from "@trpc/server";
+ import type { RouterOutput } from "@doji/contract";
  import type {
    ValidatedEvent,
    ValidatedMarket,
    ValidatedMarketToken,
    ValidatedPosition,
    ValidatedTag,
    ValidatedTrade,
  } from "server/lib/polymarket/schemas/index";
- import type { AppRouter } from "server/routers/index";

- type RouterOutputs = inferRouterOutputs<AppRouter>;
+ type RouterOutputs = RouterOutput;
```

> The `server/lib/polymarket/schemas/index` import remains — those are Zod-validated types not derivable from `inferRouterOutputs` (due to `.loose()` schemas). This is acceptable; only `AppRouter` and inference move to `@doji/contract`.

### 2b. Feature Files

**`apps/web/src/features/watchlist/hooks/use-watchlist.ts`**

```diff
- import type { TRPCClientErrorLike } from "@trpc/client";
- import type { AppRouter } from "server/routers/index";
+ import type { AppRouter } from "@doji/contract";
+ import type { TRPCClientErrorLike } from "@trpc/client";
```

**`apps/web/src/app/(trading)/market/[slug]/market-terminal-shell.tsx`**

```diff
- import type { inferRouterOutputs } from "@trpc/server";
- import type { AppRouter } from "server/routers/index";
+ import type { MarketBySlug } from "@doji/contract";

- type MarketBySlugQueryData =
-   inferRouterOutputs<AppRouter>["markets"]["getBySlug"];
+ type MarketBySlugQueryData = MarketBySlug;
```

**`apps/web/src/app/portfolio/page.tsx`**

```diff
- import type { inferRouterOutputs } from "@trpc/server";
- import type { AppRouter } from "server/routers/index";
+ import type { ClosedPositionItem } from "@doji/contract";

- type ClosedPositionItem =
-   inferRouterOutputs<AppRouter>["data"]["closedPositions"][number];
```

### 2c. Server Files (no change)

`apps/server/src/routers/index.ts` continues to define and export `AppRouter` — it's the source of truth. `@doji/contract` re-exports it.

`apps/server/src/health/openapi.ts` and `apps/server/src/app.ts` import `appRouter` (the value, not the type) from `../routers/index` — these stay as-is since they're within the server app.

---

## Section 3: Pre-Computed Type Helpers

The `@doji/contract` package pre-computes common procedure output types so components never need `inferRouterOutputs` directly.

### Current Pattern (scattered)

```ts
// market-terminal-shell.tsx
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "server/routers/index";
type MarketBySlugQueryData = inferRouterOutputs<AppRouter>["markets"]["getBySlug"];

// portfolio/page.tsx
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "server/routers/index";
type ClosedPositionItem = inferRouterOutputs<AppRouter>["data"]["closedPositions"][number];
```

### New Pattern (centralized)

```ts
// market-terminal-shell.tsx
import type { MarketBySlug } from "@doji/contract";

// portfolio/page.tsx
import type { ClosedPositionItem } from "@doji/contract";
```

### Relationship to `trpc/types.ts`

`apps/web/src/shared/lib/trpc/types.ts` already centralizes some types (Market, Event, Position, etc.) but uses validated schema types for some and `inferRouterOutputs` for others. After migration:

- **`@doji/contract`** — canonical source for all `RouterOutput`-derived types
- **`trpc/types.ts`** — re-exports validated schema types (Market, Event, Position, Trade) that can't be derived from `inferRouterOutputs` due to `.loose()` schemas, plus any web-specific aliases

Over time, `trpc/types.ts` should thin out as validated schemas align with router outputs.

---

## Section 4: Branded Types

### 4a. Current State

`packages/types/src/branded.ts` already defines:

| Type | Constructor | Status |
|------|------------|--------|
| `TokenId` | `tokenId(s)` | ✅ Defined, not enforced |
| `ConditionId` | `conditionId(s)` | ✅ Defined, not enforced |
| `QuestionId` | `questionId(s)` | ✅ Defined, not enforced |
| `MarketSlug` | `marketSlug(s)` | ✅ Defined, not enforced |
| `WalletAddress` | `walletAddress(s)` | ✅ Defined, not enforced |
| `OrderId` | `orderId(s)` | ✅ Defined, not enforced |

### 4b. Missing Types to Add

```ts
// packages/types/src/branded.ts — additions

/** A branded string representing a Polymarket event slug. */
export type EventSlug = Brand<string, "EventSlug">;

/** A branded string representing a user identifier (database PK). */
export type UserId = Brand<string, "UserId">;

/** A branded string representing an Ethereum address (checksummed). */
export type Address = Brand<string, "Address">;

/** Creates a branded `EventSlug` from a plain string. */
export function eventSlug(value: string): EventSlug {
  return value as EventSlug;
}

/** Creates a branded `UserId` from a plain string. */
export function userId(value: string): UserId {
  return value as UserId;
}

/** Creates a branded `Address` from a plain string. */
export function address(value: string): Address {
  return value as Address;
}
```

> `Address` vs `WalletAddress`: `WalletAddress` is already defined. Consider whether to keep both (wallet-specific vs generic contract address) or alias `Address = WalletAddress`. Recommendation: keep `WalletAddress` for user wallets, add `Address` for generic Ethereum addresses (contracts, tokens). They're structurally identical but semantically distinct.

### 4c. Zod Schema Integration

Branded type coercion at Zod parse boundaries — the API layer brands strings as they enter the system:

```ts
import { z } from "zod";
import { conditionId, marketSlug, tokenId } from "@doji/types";

// In a tRPC router input schema:
const getBySlugInput = z.object({
  slug: z.string().transform(marketSlug),
});

// In a Gamma API response schema:
const marketSchema = z.object({
  condition_id: z.string().transform(conditionId),
  market_slug: z.string().transform(marketSlug),
  tokens: z.array(
    z.object({
      token_id: z.string().transform(tokenId),
    })
  ),
});
```

This means:
- **Input validation** brands strings at the tRPC boundary → procedures receive `MarketSlug` not `string`
- **API response parsing** brands strings at the Gamma/CLOB boundary → internal code works with branded types
- **No runtime cost** — `transform` calls are just type casts at runtime

### 4d. Enforcement Strategy

| Phase | Scope | Effort | Breaking? |
|-------|-------|--------|-----------|
| **Phase 1** (done) | Define types and constructors in `packages/types` | ✅ Complete | No |
| **Phase 2** (next) | Use branded types in all **new** code | Low | No |
| **Phase 3** (gradual) | Add `.transform()` to Zod schemas at parse boundaries | Medium | No — output types change but callers get stricter types for free |
| **Phase 4** (gradual) | Update function signatures to accept branded types | Medium | Yes — but file-by-file |
| **Never** | Big-bang enforcement across all files | — | — |

**Phase 2 rules for new code:**

1. New tRPC input schemas use `.transform(brandConstructor)` for ID fields
2. New function parameters use branded types (`slug: MarketSlug` not `slug: string`)
3. New components receive branded types from props
4. Existing code is not touched unless you're already modifying the file

**Phase 3 priority order:**

1. Gamma API response schemas (brands at the data source)
2. CLOB API response schemas
3. tRPC router input schemas
4. Component props and hook parameters

---

## Section 5: Zod v4 Patterns

Zod v4 (`^4.3.6`) is already installed via the pnpm catalog. Key differences from v3 that affect our codebase:

### 5a. Breaking Changes

| v3 | v4 | Impact |
|----|-----|--------|
| `z.string().email()` | `z.email()` | Top-level string format validators |
| `z.string().url()` | `z.url()` | Same pattern |
| `z.string().uuid()` | `z.uuid()` | Same pattern |
| `z.string().min(n)` | `z.string().check(z.minLength(n))` | Or use `z.minLength(n)` pipe |
| `z.ZodError` | `z.ZodError` (same) | But `flatten()` → `flattenError()` (standalone) |
| `.refine()` | `.check()` | `.refine()` still works but `.check()` is preferred |
| `z.infer<typeof schema>` | `z.infer<typeof schema>` | Same — no change |
| Error `message` param | `error` param | `z.string({ error: "msg" })` not `z.string({ message: "msg" })` |

### 5b. Performance Gains

| Operation | Speedup |
|-----------|---------|
| String parsing | 14× faster |
| Array parsing | 7× faster |
| Object parsing | 7× faster |
| Union parsing | 12× faster |

These are free — no code changes needed.

### 5c. New Features We Should Use

**`z.interface()` for loose objects:**

```ts
// v3: z.object({...}).passthrough() or .loose()
// v4: z.interface() — designed for this
const gammaMarket = z.interface({
  condition_id: z.string(),
  question: z.string(),
  // extra fields pass through
});
```

**`z.stringbrand()` for branded types (alternative to `.transform()`):**

```ts
// v4 native branded strings — evaluate if this replaces our Brand<> pattern
const TokenIdSchema = z.string().brand("TokenId");
type TokenId = z.infer<typeof TokenIdSchema>;
```

> **Decision needed:** Zod v4's `.brand()` creates its own brand type. Our `Brand<string, "TokenId">` in `packages/types` uses a phantom field. These are **not compatible** — Zod's brand uses `Symbol.for("zod.brand")`. Recommendation: **keep our `Brand<>` pattern** and use `.transform(tokenId)` at parse boundaries. This keeps branded types independent of Zod and usable in code that doesn't import Zod.

### 5d. Migration Steps

The codemod handles most changes automatically:

```bash
# Run from repo root — transforms all .ts/.tsx files
npx @zod/codemod --transform v3-to-v4
```

**What the codemod does:**
- `z.string().email()` → `z.email()`
- `z.string().url()` → `z.url()`
- `z.string().uuid()` → `z.uuid()`
- `message:` → `error:` in schema options
- `ZodError.flatten()` → `flattenError(zodError)`

**What needs manual review:**
- `.refine()` → `.check()` (optional, `.refine()` still works)
- `.passthrough()` → consider `z.interface()` for Gamma schemas
- Custom error maps

### 5e. tRPC v11 Compatibility

Confirmed compatible. Our `errorFormatter` in `packages/api/src/trpc.ts` already uses:

```ts
import { flattenError, ZodError } from "zod";
```

This is the v4 API — we're already on v4 patterns in the error formatter. The `error.cause instanceof ZodError` check works with both v3 and v4.

---

## Section 6: `createCallerFactory` for RSC

The current server-side tRPC setup uses `createTRPCClient` with HTTP calls back to the server:

```ts
// Current: apps/web/src/shared/lib/trpc/server.ts
export const serverTrpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: `${serverUrl}/trpc` })],
});
```

This works but makes a network round-trip from the Next.js server to the Hono server for every RSC data fetch. An alternative is `createCallerFactory` which calls procedures directly (in-process):

### 6a. Direct Caller Pattern

```ts
// packages/contract/src/caller.ts (or apps/web/src/shared/lib/trpc/caller.ts)
import "server-only";
import { cache } from "react";
import { createCaller } from "server/routers/index";
import { createContextInner } from "@doji/api/context";

/**
 * Server-side tRPC caller for RSC.
 * Calls procedures directly (no HTTP round-trip).
 * Memoized per request via React.cache().
 */
export const getServerCaller = cache(() => {
  return createCaller(createContextInner());
});

/**
 * Authenticated server-side tRPC caller.
 * Reads session from cookies and creates a caller with auth context.
 */
export const getAuthenticatedServerCaller = cache(async () => {
  const { cookies } = await import("next/headers");
  const { SESSION_COOKIE_NAME } = await import("@/shared/constants");
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  // Verify JWT and extract session
  const { verifySessionToken } = await import("@doji/api/lib/session");
  const session = await verifySessionToken(token);
  if (!session) return null;

  return createCaller(createContextInner({ session }));
});
```

### 6b. Why We Don't Do This Yet

The current architecture has the **Hono server as a separate process** (port 3001). `createCallerFactory` requires the server code to be importable into the Next.js process, which means:

1. All server dependencies (Drizzle, Polymarket clients, ethers) get bundled into the Next.js server
2. Database connections would be shared/duplicated
3. Environment variables need to be available in the Next.js process

**Current approach (HTTP calls) is correct** for our split-server architecture. `createCallerFactory` is the right pattern when server and web are in the same process (e.g., Next.js API routes or a future monolith mode).

### 6c. When to Revisit

- If we move tRPC routers into Next.js API routes (eliminating the Hono server)
- If we add a "monolith mode" for local development
- If network latency between Next.js and Hono becomes a bottleneck

For now, the `createTRPCClient` + `httpBatchLink` approach in `server.ts` is the right call.

---

## Section 7: Implementation Steps

### Step 1: Create `packages/contract` (30 min)

```bash
mkdir -p packages/contract/src
```

Create the three files from Section 1b:
- `packages/contract/package.json`
- `packages/contract/tsconfig.json`
- `packages/contract/src/index.ts`

### Step 2: Wire into Workspace (5 min)

`packages/contract/` is already covered by the `packages/*` glob in `pnpm-workspace.yaml`. Run:

```bash
pnpm install
```

### Step 3: Add Dependency to Web (5 min)

```bash
pnpm add @doji/contract --filter=web --workspace
```

This adds `"@doji/contract": "workspace:*"` to `apps/web/package.json`.

### Step 4: Migrate AppRouter Imports (1 hour)

Update the 8 files listed in Section 2. Order:

1. `shared/lib/trpc/types.ts` — central type file
2. `shared/lib/trpc/query-client.ts` — cached server functions
3. `shared/lib/trpc/server.ts` — server-side client
4. `shared/lib/trpc/keys.ts` — query key proxy
5. `shared/lib/trpc/index.ts` — client-side client
6. `features/watchlist/hooks/use-watchlist.ts` — feature file
7. `app/(trading)/market/[slug]/market-terminal-shell.tsx` — page component
8. `app/portfolio/page.tsx` — page component

### Step 5: Remove `server/*` Path Alias from Web (10 min)

After all imports are migrated, remove the `server/*` path from `apps/web/tsconfig.json` (if it exists). This enforces that web never imports server internals directly.

> **Check first:** `server/lib/polymarket/schemas/index` is still imported in `trpc/types.ts`. This import needs to either:
> - Move to `@doji/contract` (if the schemas are stable)
> - Stay with an explicit exception in tsconfig
> - Be replaced by deriving types from `RouterOutput` once `.loose()` schemas are fixed

### Step 6: Add Branded Type Additions (15 min)

Add `EventSlug`, `UserId`, `Address` and their constructors to `packages/types/src/branded.ts` per Section 4b.

### Step 7: Verify (15 min)

```bash
pnpm check-types   # All packages type-check
pnpm check         # Biome lint passes
pnpm build         # Full build succeeds
```

### Step 8: Start Using in New Code (ongoing)

Follow Phase 2 rules from Section 4d. No big-bang migration.

---

## Section 8: Timeline

| Task | Effort | Depends on |
|------|--------|------------|
| Create `packages/contract` + wire up | 30 min | Nothing |
| Migrate 8 AppRouter imports | 1 hour | packages/contract exists |
| Add pre-computed type helpers | 30 min | packages/contract exists |
| Add missing branded types | 15 min | Nothing |
| Run Zod v4 codemod (if not already done) | 15 min | Nothing |
| Verify build | 15 min | All above |
| **Total for packages/contract** | **~3 hours** | |
| Branded type enforcement (Phase 3+) | Ongoing | packages/contract done |
| Zod v4 patterns | Already done | — |

**Realistic calendar:** 1 day for `packages/contract` (including review). Branded type enforcement is gradual — no deadline, just adopt in new code.

---

## Appendix A: Full Branded Types Reference

After additions, `packages/types/src/branded.ts` will contain:

| Type | Brand | Constructor | Use case |
|------|-------|------------|----------|
| `TokenId` | `"TokenId"` | `tokenId(s)` | CLOB token identifiers |
| `ConditionId` | `"ConditionId"` | `conditionId(s)` | Market condition IDs |
| `QuestionId` | `"QuestionId"` | `questionId(s)` | UMA oracle question IDs |
| `MarketSlug` | `"MarketSlug"` | `marketSlug(s)` | Market URL slugs |
| `EventSlug` | `"EventSlug"` | `eventSlug(s)` | Event URL slugs |
| `WalletAddress` | `"WalletAddress"` | `walletAddress(s)` | User wallet addresses |
| `Address` | `"Address"` | `address(s)` | Generic Ethereum addresses |
| `OrderId` | `"OrderId"` | `orderId(s)` | CLOB order identifiers |
| `UserId` | `"UserId"` | `userId(s)` | Database user PKs |

## Appendix B: Zod v4 Codemod Dry Run

Before running the codemod, do a dry run to see what changes:

```bash
# Dry run (no writes)
npx @zod/codemod --transform v3-to-v4 --dry

# Apply
npx @zod/codemod --transform v3-to-v4

# Verify
pnpm check-types
pnpm fix
```

## Appendix C: Future — `@doji/contract` as Validation Boundary

Once branded types are enforced at Zod parse boundaries (Phase 3), `@doji/contract` could also export shared Zod schemas for input validation — making it the single source of truth for both types and runtime validation. This is a Phase 4+ consideration and not needed for the initial implementation.
