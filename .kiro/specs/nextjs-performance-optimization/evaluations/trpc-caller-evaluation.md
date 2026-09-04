# Evaluation: Direct tRPC Caller vs httpBatchLink for Server-Side Calls

**Task:** 13.5 — Evaluate direct tRPC caller for server-side calls
**Requirements:** 26.1, 26.2, 26.3
**Date:** 2025-07-15
**Status:** Evaluation complete — retain current approach

## Question

Should `serverTrpc` (used by Next.js Server Components) switch from `httpBatchLink` to a direct tRPC `caller` API to eliminate the HTTP round trip?

## Finding: Servers Are Separate Deployments

Evidence from the codebase:

1. **AGENTS.md** explicitly states: _"Hono API server as a separate deployment"_ and _"HTTP hop for `serverTrpc` is unavoidable unless co-located"_.

2. **Separate Vercel projects** — each app has its own `vercel.json`:
   - `apps/web/vercel.json` — framework: `nextjs`, builds with `turbo build --filter=web`
   - `apps/server/vercel.json` — framework: `hono`, builds with `turbo build --filter=server`

3. **Cross-origin communication** — the web app uses `NEXT_PUBLIC_SERVER_URL` env var to reach the server, and `CORS_ORIGIN` is configured on the server side. This confirms network-level separation.

4. **Current implementation** (`apps/web/src/lib/trpc/server.ts`) uses `httpBatchLink` pointing at `${serverUrl}/trpc` with a 30s fetch timeout — standard HTTP client pattern for a remote service.

## Decision: Retain `httpBatchLink`-based `serverTrpc`

Per Requirement 26.3: _"IF the servers are separate deployments, THEN THE current `httpBatchLink`-based `serverTrpc` approach SHALL be retained as the network hop is unavoidable."_

The direct `caller` API requires the tRPC router to be importable and executable in the same Node.js process. Since the Hono server runs in a separate Vercel serverless function (different project, different runtime), the router's dependencies (database connection, Polymarket clients, auth middleware) are not available in the Next.js runtime. A direct caller is not feasible without co-locating the deployments.

## Mitigations Already in Place

The HTTP hop latency is already mitigated by other tasks in this spec:

- **LRU cache** (Task 3.5) — cross-request in-memory cache reduces redundant HTTP calls
- **`"use cache"` + `cacheLife`** (Task 3.2) — framework-level caching avoids repeat fetches
- **`React.cache()`** (Task 7.4) — request-scoped dedup prevents duplicate calls within a single render
- **Streaming dehydration** (Task 1.3) — non-blocking prefetches so the HTTP hop doesn't block the page
- **Batch link** — `httpBatchLink` already batches multiple tRPC calls into a single HTTP request

## Future Consideration

If the architecture ever moves to a monolithic deployment (Hono embedded in Next.js custom server or API routes), the direct `caller` approach should be revisited. This would eliminate ~5-20ms of network latency per server-side fetch.
