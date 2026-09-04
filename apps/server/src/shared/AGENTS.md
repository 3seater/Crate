# Server Shared Module

> Feature-agnostic infrastructure: resilience, errors, onchain utilities, constants.

## Structure

- `resilience/` — cache (TTL LRU), circuit-breaker, deduplicator, rate-limiter, retry
- `errors/` — ApiError, error classification, mapApiErrorToTRPC, withPolymarketError
- `onchain/` — pUSD balance checks (`getPusdBalanceOnPolygon`), approval status, Polygon RPC URLs
- `resilient-fetch.ts` — Fetch wrapper with retry, circuit-breaker, rate-limiting, caching (shared by Gamma/CLOB and other outbound HTTP)
- `validate-config.ts` — Startup config validation
- `constants.ts` — Server-wide constants (cache TTLs, batch sizes, subgraph config)
- `discord-ops-webhook.ts` — Optional Discord incoming webhook for ops (login/logout, Safe + first credentials); see `apps/server/AGENTS.md`