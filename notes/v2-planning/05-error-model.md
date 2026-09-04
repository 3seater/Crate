# 05 — Error Model: `AppError` Class Migration

> **Phase:** 0 (foundation) · **Risk:** Low · **Effort:** ~2–3 days · **Breaking changes:** None

Migrate from the current duck-typed `createAppError` pattern (monkey-patches `why`/`fix`/`link` onto a plain `TRPCError` via `Object.assign`) to a proper `AppError extends TRPCError` class with `instanceof` support.

---

## 1. Current State

### Error throw sites

| Pattern | Count | Files |
|---------|-------|-------|
| `throw new TRPCError(...)` | 64 | `auth/router.ts` (33), `trading/router.ts` (18), `auth/lib/magic-errors.ts` (12), `referrals/router.ts` (1) |
| `throw createAppError(...)` | 38 | `auth/router.ts` (15), `portfolio/router.ts` (8), `trading/router.ts` (6), `watchlist-router.ts` (5), `referrals/router.ts` (4) |
| `withPolymarketError(...)` | ~69 | `data/router.ts` (28), `events/router.ts` (24), `markets/router.ts` (9), `bridge/router.ts` (8) |
| `mapApiErrorToTRPC(...)` | 2 direct throw sites + 1 definition | `shared/errors/map-api-error.ts` |

### `createAppError` (packages/api/src/lib/errors.ts)

```ts
export function createAppError(opts: AppErrorOptions): TRPCError {
  const { message, code = "INTERNAL_SERVER_ERROR", why, fix, link, cause } = opts;
  const err = new TRPCError({ code, message, cause });
  if (why !== undefined || fix !== undefined || link !== undefined) {
    Object.assign(err, { why, fix, link }); // monkey-patches extra fields
  }
  return err;
}
```

Returns a plain `TRPCError` — no subclass, no prototype chain. The `why`/`fix`/`link` fields are invisible to TypeScript and only discoverable at runtime via `"why" in error`.

### Error formatter (packages/api/src/trpc.ts)

```ts
errorFormatter({ shape, error }) {
  const why = "why" in error ? (error.why as string | undefined) : undefined;
  const fix = "fix" in error ? (error.fix as string | undefined) : undefined;
  const link = "link" in error ? (error.link as string | undefined) : undefined;
  return {
    ...shape,
    data: { ...shape.data, zodError, ...(why && { why }), ...(fix && { fix }), ...(link && { link }) },
  };
}
```

Duck-typing: `"why" in error`. Works, but fragile — any object with a `why` property would match.

### `ApiError` class (apps/server/src/shared/errors/errors.ts)

Extends `Error` (not `TRPCError`). Represents upstream Polymarket API failures. Classified by `ErrorCode`: `NETWORK`, `AUTH`, `RATE_LIMIT`, `VALIDATION`, `SERVER`, `CIRCUIT_OPEN`, `UNKNOWN`. Converted to `TRPCError` at the router boundary via `mapApiErrorToTRPC` / `withPolymarketError`.

### Client-side display (apps/web/src/shared/lib/trpc/errors.ts)

- `getTrpcDisplayMessage(error)` — extracts `error.data.message` from the tRPC error shape. Used in ~13 files (toasts, error boundaries, inline UI).
- `getTrpcDisplayDetails(error)` — extracts `{ why, fix, link }` from `error.data`. Returns `null` if none present.

Both read from `error.data.*` (the formatter output), not from the error instance directly. **No client-side changes needed** — the formatter output shape stays identical.

---

## 2. AppError Class Design

```ts
// packages/api/src/lib/errors.ts

import { TRPCError } from "@trpc/server";
import type { TRPC_ERROR_CODE_KEY } from "@trpc/server/rpc";

export interface AppErrorOptions {
  cause?: unknown;
  code?: TRPC_ERROR_CODE_KEY;
  fix?: string;
  link?: string;
  message: string;
  why?: string;
}

export class AppError extends TRPCError {
  readonly why?: string;
  readonly fix?: string;
  readonly link?: string;

  constructor(opts: AppErrorOptions) {
    const { message, code = "INTERNAL_SERVER_ERROR", cause, why, fix, link } = opts;
    super({ code, message, cause });
    this.why = why;
    this.fix = fix;
    this.link = link;
  }
}
```

### Why a subclass?

- `instanceof AppError` is reliable, fast, and type-safe.
- `why`/`fix`/`link` are real `readonly` properties — visible to TypeScript, autocomplete, and refactoring tools.
- Still a valid `TRPCError` — tRPC's error handling, serialization, and HTTP status mapping all work unchanged.
- The constructor signature is identical to `createAppError`'s options — migration is mechanical.

---

## 3. Migration Steps

### Step 1: Add `AppError` class

Add the class to `packages/api/src/lib/errors.ts` alongside the existing `createAppError`. Export from `packages/api/src/index.ts`.

```ts
// packages/api/src/index.ts
export { AppError, createAppError } from "./lib/errors";
```

Both coexist — nothing breaks.

### Step 2: Update error formatter

Update `packages/api/src/trpc.ts` to prefer `instanceof AppError`, with duck-typing as fallback for any remaining `createAppError` calls during migration.

### Step 3: Replace `createAppError` → `new AppError` (38 sites, 5 files)

Mechanical find-and-replace. Every `throw createAppError({...})` becomes `throw new AppError({...})`. The options object is identical.

### Step 4: Selective `TRPCError` → `AppError` (subset of 64 sites)

Only where `why`/`fix`/`link` would improve UX. Simple cases (`NOT_FOUND`, `UNAUTHORIZED` with no extra context) stay as `TRPCError`. See file-by-file breakdown in §4.

### Step 5: CI enforcement

Add a grep check to CI that flags raw `new TRPCError` in router files (see §7).

### Step 6: Remove `createAppError`

Delete the function and its export. Remove from `packages/api/src/index.ts`.

---

## 4. File-by-File Changes

### `packages/api/src/lib/errors.ts`

| Before | After |
|--------|-------|
| `createAppError` function + `AppErrorOptions` interface | Add `AppError` class (Step 1). Delete `createAppError` (Step 6). Keep `AppErrorOptions` — used by `AppError` constructor. |

### `packages/api/src/trpc.ts` (error formatter)

See §5 for before/after.

### `apps/server/src/features/auth/router.ts`

- **33 × `TRPCError`**: Most are auth guard checks (`UNAUTHORIZED`, `FORBIDDEN`, `BAD_REQUEST`). Keep as `TRPCError` — they're simple status+message with no user-actionable context.
- **15 × `createAppError`**: All become `new AppError`. These are user-facing auth errors (Safe deployment failures, credential derivation, onboarding) where `why`/`fix` guide the user.

### `apps/server/src/features/trading/router.ts`

- **18 × `TRPCError`**: Keep simple ones (`NOT_FOUND` for user/market, `BAD_REQUEST` for validation). Convert ~4 that deal with order failures or regional restrictions to `AppError` with `why`/`fix`.
- **6 × `createAppError`**: All become `new AppError`. These are order placement/cancel errors with user-facing guidance.

### `apps/server/src/features/auth/lib/magic-errors.ts`

- **12 × `TRPCError`**: These map Magic SDK error codes to tRPC errors. Keep as `TRPCError` — they're a classification layer, not user-guidance errors. If we later want `fix` hints ("Try logging in again"), convert selectively.

### `apps/server/src/features/portfolio/router.ts`

- **0 × `TRPCError`**, **8 × `createAppError`**: All become `new AppError`. Portfolio operations (redeem, merge, split) with user-facing `why`/`fix`.

### `apps/server/src/features/portfolio/watchlist-router.ts`

- **0 × `TRPCError`**, **5 × `createAppError`**: All become `new AppError`. Watchlist add/remove with user-facing messages.

### `apps/server/src/features/referrals/router.ts`

- **1 × `TRPCError`**: Keep — simple `CONFLICT` for duplicate invite code.
- **4 × `createAppError`**: All become `new AppError`. Referral validation with `why`/`fix`.

### `apps/server/src/shared/errors/map-api-error.ts`

- **`mapApiErrorToTRPC`**: Returns plain `TRPCError` (no `why`/`fix`/`link`). **No change needed** — these are upstream API errors with generic user messages. The `POLYMARKET_MAPPED` symbol marker stays.
- **`withPolymarketError`**: Catches `ApiError`, calls `mapApiErrorToTRPC`. **No change needed** — it doesn't produce `AppError`s.

### Summary table

| File | `createAppError` → `new AppError` | `TRPCError` → `AppError` | `TRPCError` stays |
|------|:-:|:-:|:-:|
| `auth/router.ts` | 15 | 0 | 33 |
| `trading/router.ts` | 6 | ~4 | ~14 |
| `auth/lib/magic-errors.ts` | 0 | 0 | 12 |
| `portfolio/router.ts` | 8 | 0 | 0 |
| `watchlist-router.ts` | 5 | 0 | 0 |
| `referrals/router.ts` | 4 | 0 | 1 |
| `map-api-error.ts` | 0 | 0 | ~12 |
| **Total** | **38** | **~4** | **~72** |

---

## 5. Error Formatter Update

### Before

```ts
// packages/api/src/trpc.ts
export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const zodError =
      error.code === "BAD_REQUEST" && error.cause instanceof ZodError
        ? flattenError(error.cause)
        : undefined;
    const why = "why" in error ? (error.why as string | undefined) : undefined;
    const fix = "fix" in error ? (error.fix as string | undefined) : undefined;
    const link = "link" in error ? (error.link as string | undefined) : undefined;
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError,
        ...(why !== undefined && { why }),
        ...(fix !== undefined && { fix }),
        ...(link !== undefined && { link }),
      },
    };
  },
});
```

### After

```ts
// packages/api/src/trpc.ts
import { AppError } from "./lib/errors";

export const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    const zodError =
      error.code === "BAD_REQUEST" && error.cause instanceof ZodError
        ? flattenError(error.cause)
        : undefined;

    // Prefer instanceof (proper class), fall back to duck-typing during migration
    const isAppError = error instanceof AppError;
    const why = isAppError ? error.why : "why" in error ? (error.why as string | undefined) : undefined;
    const fix = isAppError ? error.fix : "fix" in error ? (error.fix as string | undefined) : undefined;
    const link = isAppError ? error.link : "link" in error ? (error.link as string | undefined) : undefined;

    return {
      ...shape,
      data: {
        ...shape.data,
        zodError,
        ...(why !== undefined && { why }),
        ...(fix !== undefined && { fix }),
        ...(link !== undefined && { link }),
      },
    };
  },
});
```

After Step 6 (remove `createAppError`), simplify to:

```ts
const why = error instanceof AppError ? error.why : undefined;
const fix = error instanceof AppError ? error.fix : undefined;
const link = error instanceof AppError ? error.link : undefined;
```

---

## 6. Client-Side Error Display

### No changes required

The client reads from the **formatter output** (`error.data.why`, `error.data.fix`, `error.data.link`), not from the error class directly. The formatter output shape is identical before and after.

- `getTrpcDisplayMessage(error)` — reads `error.data.message`. Unchanged.
- `getTrpcDisplayDetails(error)` — reads `error.data.{ why, fix, link }`. Unchanged.

Both functions are in `apps/web/src/shared/lib/trpc/errors.ts` and used across ~13 files. Zero client-side migration work.

---

## 7. CI Enforcement

### Grep command

```bash
# Fail if any router file uses raw `new TRPCError` instead of `new AppError`
# Exceptions: map-api-error.ts (converts ApiError → TRPCError by design),
#             magic-errors.ts (classification layer)
grep -rn "new TRPCError" \
  apps/server/src/features/*/router.ts \
  apps/server/src/features/portfolio/watchlist-router.ts \
  --include="*.ts" \
  | grep -v "map-api-error.ts" \
  | grep -v "magic-errors.ts"
```

### What it catches

- Raw `throw new TRPCError(...)` in any router file — forces developers to use `AppError` (with `why`/`fix`) or consciously add an exception.

### What it allows

- `new TRPCError` in `map-api-error.ts` — these are upstream API error conversions, not user-guidance errors.
- `new TRPCError` in `magic-errors.ts` — Magic SDK error classification layer.
- `new TRPCError` in non-router files (middleware, context, etc.).
- `new AppError` everywhere.

### Phased rollout

Initially run as a **warning** (non-blocking) in CI. After all 64 `TRPCError` sites are triaged (converted or explicitly allowed), promote to a blocking check.

Alternatively, add an `// allow-trpc-error` comment convention and grep for `new TRPCError` lines that lack the comment:

```bash
grep -rn "new TRPCError" apps/server/src/features/*/router.ts \
  | grep -v "map-api-error.ts" \
  | grep -v "magic-errors.ts" \
  | grep -v "allow-trpc-error"
```

---

## 8. `withPolymarketError` Integration

### Current flow

```
Router procedure body
  → calls Gamma/CLOB/Data API client
  → client throws ApiError on failure
  → withPolymarketError catches ApiError
  → calls mapApiErrorToTRPC(apiError) → returns TRPCError
  → throws the TRPCError (with POLYMARKET_MAPPED symbol)
```

### Should `mapApiErrorToTRPC` return `AppError`?

**No.** The mapped errors are generic upstream failures ("This service is temporarily unavailable") with no user-actionable `why`/`fix`/`link`. Converting them to `AppError` would add no value — the fields would all be `undefined`.

If we later want to add guidance to specific upstream errors (e.g., `RATE_LIMIT` → `fix: "Wait 30 seconds and try again"`), we can selectively return `AppError` for those cases. But that's a separate enhancement, not part of this migration.

### No changes to `withPolymarketError` or `mapApiErrorToTRPC`

The 69 `withPolymarketError` call sites and the `mapApiErrorToTRPC` function are untouched by this migration. They continue to produce plain `TRPCError` instances, which the formatter handles via the duck-typing fallback (and eventually just ignores — no `why`/`fix`/`link` to extract).

---

## 9. Timeline

| Day | Work | Files touched |
|-----|------|---------------|
| 1 | Add `AppError` class, update formatter (Steps 1–2) | `packages/api/src/lib/errors.ts`, `packages/api/src/index.ts`, `packages/api/src/trpc.ts` |
| 1–2 | Replace `createAppError` → `new AppError` (Step 3) | 5 router files (38 sites) |
| 2 | Selective `TRPCError` → `AppError` in trading router (Step 4) | `trading/router.ts` (~4 sites) |
| 2–3 | Add CI check, remove `createAppError` (Steps 5–6) | CI config, `packages/api/src/lib/errors.ts`, `packages/api/src/index.ts` |
| 3 | Verify: `pnpm check-types`, `pnpm test`, manual smoke test | — |

**Total: ~2–3 days.** Low risk — the formatter output shape is unchanged, so the client is unaffected. Each step is independently deployable.

---

## 10. Risks & Rollback

| Risk | Mitigation |
|------|------------|
| `instanceof` breaks across package boundaries | `AppError` lives in `@doji/api`, which is the same package that creates the tRPC instance. All routers import from `@doji/api`. Single class identity guaranteed. |
| Formatter regression | Duck-typing fallback during migration (Step 2) ensures no gap. Remove fallback only after Step 6. |
| CI check too strict | Start as warning, promote to error after triage. `allow-trpc-error` escape hatch for legitimate simple throws. |
| `mapApiErrorToTRPC` callers confused | No change to that path — document clearly that `withPolymarketError` is out of scope. |
