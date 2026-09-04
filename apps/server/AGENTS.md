# Server API

> Scope: `apps/server` (inherits root [AGENTS.md](../../AGENTS.md) unless noted)

Hono + tRPC backend for the Robinhood Chain Basket Terminal.

## Quick Facts

- **Port:** 3001
- **Commands:** `pnpm dev:server`, `pnpm build`, `pnpm check-types`, `pnpm test`, `pnpm fix`
- **Env:** `apps/server/.env.example`; see `packages/env/src/server.ts` for schema
- **Database:** Neon HTTP mode for queries (serverless-friendly, no persistent connections)

## Tech Stack

Hono · tRPC · TypeScript · Drizzle ORM · Neon (HTTP) · PostgreSQL · Vitest · `@sentry/node` (errors, tracing, profiling)

## Structure

```
src/
├── index.ts              # Server entry (Node dev / Vercel export)
├── app.ts                # Hono app (tRPC, health, openapi routes)
├── instrument.ts         # Sentry instrumentation (imported before app)
├── routers/
│   └── index.ts          # Root router — merges domain routers
├── domains/              # Domain-organized business logic
│   └── baskets/          # Chain basket trading
│       ├── enso-client.ts    # Enso Finance API client (bundle routing)
│       ├── price-service.ts  # GeckoTerminal + DexScreener price feeds with LRU cache
│       ├── router.ts         # basketsRouter (getBundle, getLivePrices, getOhlcv)
│       └── schemas.ts        # Zod schemas for all procedures
├── shared/               # Feature-agnostic infrastructure
│   ├── resilience/       # cache, retry, rate-limit, circuit-breaker, dedup
│   ├── errors/           # ApiError, tRPC mapping helpers
│   ├── resilient-fetch.ts
│   └── constants.ts      # Server-wide constants (cache TTLs, etc.)
└── health/               # Health check + OpenAPI
    ├── router.ts         # /api/health (DB ping + uptime)
    └── openapi.ts        # /api/openapi.json (auto-generated)
```

## Router Keys (API Contract)

| Key | Domain | Scope |
|-----|--------|-------|
| `healthCheck` | — | `publicProcedure.query(() => "OK")` (inline) |
| `baskets` | `baskets/` | Basket trading (getBundle, getLivePrices, getOhlcv) |

**These keys are the client API contract — do not rename without updating all web callers.**

## HTTP Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/trpc/*` | GET/POST | tRPC procedures |
| `/api/health` | GET | Health check (DB ping + uptime) |
| `/api/openapi.json` | GET | Auto-generated OpenAPI spec |
| `/docs` | GET | Scalar API reference (dev only) |

## Error Handling

### AppError (structured user-facing errors)

`AppError extends TRPCError` at `packages/api/src/lib/errors.ts`. Adds optional `why`, `fix`, and `link` fields for rich client UX (toasts, inline messages).

```typescript
throw new AppError({
  code: "PRECONDITION_FAILED",
  message: "Insufficient balance",
  why: "Your wallet balance is below the minimum order size",
  fix: "Add funds to your wallet",
  link: "/portfolio",
});
```

Use `AppError` when the error benefits from user-facing context. Use plain `TRPCError` for simple cases.

## Enso Finance Integration

`domains/baskets/enso-client.ts` — Bundle routing via the Enso Finance API. Fetches optimal swap routes for multi-token basket purchases in a single transaction.

- `getBundle` — Returns the calldata and routing details for a basket swap
- Route caching with short TTLs to balance freshness and API rate limits

## CDN Cache-Control

The tRPC middleware in `app.ts` sets `Cache-Control` headers on successful GET responses:

| Pattern | Cache | Use |
|---------|-------|-----|
| `baskets.getLivePrices` | `s-maxage=10, stale-while-revalidate=20` | Live price feeds |
| `baskets.getOhlcv` | `s-maxage=60, stale-while-revalidate=120` | OHLCV candles |
| `baskets.getBundle` | `s-maxage=5, stale-while-revalidate=10` | Routing quotes |

## Resilience Patterns

All in `shared/resilience/`:

- **`cache.ts`** — In-memory TTL cache (`getOrSet`)
- **`retry.ts`** — Configurable retry with backoff
- **`rate-limiter.ts`** — Per-key rate limiting
- **`circuit-breaker.ts`** — Failure threshold + reset timeout
- **`deduplicator.ts`** — Concurrent request dedup (same key → single flight)
- **`resilient-fetch.ts`** — Fetch wrapper composing retry + circuit-breaker + rate-limiting

## Environment Variables

See `packages/env/src/server.ts` for the full schema. Key variables:

- **`ENSO_API_KEY`** — Enso Finance API key for bundle routing

## Commands

```bash
pnpm dev:server       # Start dev server (localhost:3001)
pnpm build            # Build for production
pnpm check-types      # TypeScript validation
pnpm test             # Run tests (CI mode)
pnpm test:watch       # Run tests in watch mode
pnpm fix              # Format & lint
```

## Testing

- **Vitest** for unit and integration tests (run from repo root: `pnpm test`)
- Test files live in `tests/` at the repo root (not inside server)
- Tests cover routers, rate limiting, caching, retry logic, circuit breakers

## Finish the Task

- [ ] Run `pnpm fix` before committing.
- [ ] Update this AGENTS.md if you changed routes, routers, domains, or env.
- [ ] Summarize changes in conventional commit form (e.g. `feat(server): ...`, `fix(server): ...`).

## Related

- [Web App](../web/AGENTS.md)
- [API Package](../../packages/api/AGENTS.md)
- [Database](../../packages/db/AGENTS.md)
- [Types Package](../../packages/types/AGENTS.md)
