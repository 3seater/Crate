# Environment Package

> Scope: `packages/env` (inherits root [AGENTS.md](../../AGENTS.md) unless noted)

T3 Env validation for type-safe environment variables.

## Quick Facts

- **Package:** `@doji/env`
- **Commands:** `pnpm check-types`
- **Entrypoints:** `@doji/env/server`, `@doji/env/web`, `@doji/env/domains`

## Purpose

Centralized environment variable validation using T3 Env and Zod for both server and client.

## Structure

```
src/
├── domains.ts        # Domain map, CORS origins, Sentry env tags
├── server.ts         # Server-side env variables
└── web.ts            # Client-side env variables
```

## Installation

```bash
pnpm add @doji/env
```

## Server Environment

Source of truth: `src/server.ts`. Required (no default): `MAGIC_SECRET_KEY`, `CREDENTIAL_ENCRYPTION_KEY` (64 hex chars), `JWT_SESSION_SECRET` (min 32), `DATABASE_URL`, `CORS_ORIGIN`, `POLYMARKET_BUILDER_ID`, `POLYMARKET_BUILDER_SIGNING_KEY` (or `POLYMARKET_BUILDER_SECRET`), `POLY_BUILDER_CODE` (bytes32), `POLYMARKET_BUILDER_PASSPHRASE`. Optional / with defaults: `GAMMA_API_URL`, `DATA_API_URL`, `BRIDGE_API_URL`, `CLOB_API_URL`, `CHAIN_ID`, `SERVER_URL`, `PORT`, `NODE_ENV`, `DATABASE_URL_DIRECT` (for migrations when DATABASE_URL is pooled). `LOG_LEVEL` is in web env (server section) and used by `@doji/logger`.
Subgraph rollout envs: optional endpoint overrides (`POLYMARKET_SUBGRAPH_*_URL`) and `SUBGRAPH_ENABLE_TRADE_COUNTS` (default **on**). OI and positions use subgraph-first with automatic Data API fallback via `withSubgraphFallback` — no env flags needed. Shadow reads removed.

**Discord ops (optional):** `DISCORD_OPS_WEBHOOK_URL` — server-only incoming webhook for new signups and auth events.

**Builder credentials**: Required for the remote signing endpoint. Never expose client-side.

**Chain ID**: `CHAIN_ID` (server, default 137) and `NEXT_PUBLIC_CHAIN_ID` (client, default `"137"`) are the canonical sources. When set, they override the `POLYGON_CHAIN_ID` constant from `@doji/types`. Server code (CLOB, builder, etc.) uses `env.CHAIN_ID`; client code may use `Number(env.NEXT_PUBLIC_CHAIN_ID)` or fall back to `POLYGON_CHAIN_ID` when env is unavailable.

## Client Environment

Source of truth: `src/web.ts`. All `NEXT_PUBLIC_*` vars have defaults: `NEXT_PUBLIC_CLOB_API_URL`, `NEXT_PUBLIC_WS_MARKET_URL`, `NEXT_PUBLIC_WS_USER_URL`, `NEXT_PUBLIC_RTDS_URL`, `NEXT_PUBLIC_WS_SPORTS_URL`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_SERVER_URL`, `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY`, `NEXT_PUBLIC_POLYGON_RPC_URL`, `NEXT_PUBLIC_POLY_BUILDER_CODE` (bytes32, for client-side order signing). Optional client: `NEXT_PUBLIC_APP_URL` (metadata/sitemap base URL). Web also validates server-only vars for Next.js API routes: `POLYMARKET_SIGN_TOKEN` (sign proxy), `SITE_PASSWORD` (site protection), `VERCEL_URL` (Vercel-injected), `LOG_LEVEL` (used by `@doji/logger`), `DISCORD_BUG_REPORT_WEBHOOK_URL` (optional URL for `POST /api/report-bug` → Discord; never `NEXT_PUBLIC_`). **WebSocket URLs:** Market/user channels use `NEXT_PUBLIC_WS_MARKET_URL` / `NEXT_PUBLIC_WS_USER_URL`; RTDS uses `NEXT_PUBLIC_RTDS_URL`; Sports channel (optional) uses `NEXT_PUBLIC_WS_SPORTS_URL`. **Feature flags (optional):** `NEXT_PUBLIC_FEATURE_REFERRALS` — when `true`/`1`, enables the user referral program in the web app (`/referrals`, onboarding invite step); `NEXT_PUBLIC_FEATURE_FUNNELS` — when `true`/`1`, enables table funnel controls in Explore and Leaderboard. Defaults off.

## Sentry Environment Variables (web.ts)

The web T3 Env schema validates four Sentry-related vars in addition to the existing `SENTRY_TRACES_SAMPLE_RATE`:

| Variable | Side | Schema | Description |
|----------|------|--------|-------------|
| `SENTRY_DEBUG` | server | `z.coerce.boolean().default(false)` | Enable verbose Sentry debug logging |
| `SENTRY_RELEASE` | server | `z.string().optional()` | Sentry release identifier for source map association |
| `SENTRY_AUTH_TOKEN` | server | `z.string().optional()` | Build-time auth token for source map upload (sensitive) |
| `NEXT_PUBLIC_SENTRY_DEBUG` | client | `z.string().optional().transform(v => v === "true" \|\| v === "1")` | Client-side Sentry debug toggle (boolean transform) |

`SENTRY_AUTH_TOKEN` is build-time only and should be marked as sensitive in Vercel. `SENTRY_DEBUG` and `NEXT_PUBLIC_SENTRY_DEBUG` default to off; enable in development/preview for verbose Sentry output.

## Domain Configuration Map (`packages/env/src/domains.ts`)

Centralized mapping of Vercel deployment environment to domain URLs and CORS origins. Import via `@doji/env/domains`.

```typescript
import { DOMAIN_MAP, CORS_ORIGINS, SENTRY_ENVIRONMENT } from "@doji/env/domains";
```

### Exports

- **`DOMAIN_MAP`** — maps `VercelEnvironment` (`"production"` | `"preview"` | `"development"`) to `{ web, server, docs }` URLs
- **`CORS_ORIGINS`** — per-environment CORS origin lists (`{ origins: string[] }`)
- **`SENTRY_ENVIRONMENT`** — per-environment Sentry tags (production → `"production"`, preview → `"staging"`, development → `"development"`)

### Domain Map Values

| Environment | web | server | docs |
|-------------|-----|--------|------|
| production | `https://doji.bet` | `https://api.doji.bet` | `https://docs.doji.bet` |
| preview | `https://staging.doji.bet` | `https://staging-api.doji.bet` | `https://staging-docs.doji.bet` |
| development | `http://localhost:3000` | `http://localhost:3001` | `http://localhost:3002` |

### Per-Environment CORS_ORIGIN Values

Set as comma-separated strings in the Vercel env store for the server project (`CORS_ORIGIN`):

| Environment | Value |
|-------------|-------|
| Production | `https://doji.bet,https://www.doji.bet` |
| Preview | `https://staging.doji.bet,https://doji.bet,https://www.doji.bet` |
| Development | `http://localhost:3000,http://127.0.0.1:3000` |

Preview includes production origins so the prod web app can hit the staging API during testing. No wildcard (`*`) origins are allowed.

## Usage

### Server-Side

```typescript
import { env } from "@doji/env/server";

const db = connectToDatabase(env.DATABASE_URL);
const port = env.PORT;
```

### Client-Side (Next.js)

```typescript
import { env } from "@doji/env/web";

const apiUrl = env.NEXT_PUBLIC_SERVER_URL;
const wsUrl = env.NEXT_PUBLIC_WS_MARKET_URL;
```

## Validation

T3 Env validates environment variables at build time and runtime:

```typescript
// ✓ Valid
DATABASE_URL=postgresql://localhost:5432/poly

// ✗ Invalid - throws error
DATABASE_URL=not-a-url
```

## Type Safety

Environment variables are fully typed:

```typescript
import { env } from "@doji/env/server";

// env.DATABASE_URL is string
// env.PORT is number
// env.NODE_ENV is "development" | "production" | "test"
```

## Default Values

Use `.default()` for optional variables:

```typescript
PORT: z.coerce.number().default(3000),
NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
```

## Optional Variables

Use `.optional()` for truly optional variables:

```typescript
SOME_OPTIONAL_VAR: z.string().optional(),
```

## Transformations

Use Zod transformations for complex validation:

```typescript
DATABASE_URL: z.string().url().transform((url) => {
  // Ensure SSL in production
  if (process.env.NODE_ENV === "production" && !url.includes("sslmode=require")) {
    return `${url}?sslmode=require`;
  }
  return url;
}),
```

## Environment Files

- **Server:** `apps/server/.env` — copy from `apps/server/.env.example`. Used by the server app and by `@doji/api` tests (vitest loads it in `packages/api/vitest.config.mts`).
- **Web:** `apps/web/.env` or `apps/web/.env.local` — copy from `apps/web/.env.example`. Next.js loads `.env.local` over `.env`.

Root has no `.env`; see root `.env.example` for a short index of where vars live.

### Production

Set variables in your host (Vercel, etc.); no `.env` file in repo.

## Best Practices

1. **Validation** — Always validate with Zod schemas
2. **Type Safety** — Import from `@doji/env` for full typing
3. **Prefixes** — Use `NEXT_PUBLIC_` for client-side variables
4. **Secrets** — Never commit `.env` files with secrets
5. **Defaults** — Provide sensible defaults for development
6. **Documentation** — Document required variables in README

## Error Messages

T3 Env provides clear error messages:

```
❌ Invalid environment variables:
  DATABASE_URL: Invalid url
  PORT: Expected number, received string
```

## Testing

- **@doji/api:** Vitest loads `apps/server/.env` in `packages/api/vitest.config.mts` so tests that import `@doji/env/server` get valid env without a root `.env`.
- **Other packages:** Mock env in tests that need it:

```typescript
vi.mock("@doji/env/server", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    PORT: "3001",
    NODE_ENV: "test",
    // ... other required server vars if the test touches code that uses them
  },
}));
```

## Commands

```bash
pnpm check-types      # TypeScript validation
```

## Finish the Task

- [ ] Run `pnpm fix` before committing.
- [ ] Update this AGENTS.md and `.env.example` files when adding or changing env vars.
- [ ] Summarize changes in conventional commit form (e.g. `feat(env): ...`).

## Related

- [Server API](../../apps/server/AGENTS.md)
- [Web App](../../apps/web/AGENTS.md)
- [Database Package](../db/AGENTS.md)
- [Code Standards](../../.agents/code-standards.md)
