# Production Checklist for Launch

Adapted from [Vercel's production checklist](https://vercel.com/docs/production-checklist) for the Doji stack (Next.js + Hono on Vercel).

## Operational excellence

- [ ] Define incident response plan: escalation paths, [Vercel status](https://www.vercel-status.com/), rollback strategy
- [ ] Familiarize with [staging, promote, rollback](https://vercel.com/docs/deployments/managing-deployments) deployments
- [x] Turborepo caching configured (`vercel.json` Ignored Build Step, `turbo build`)
- [ ] Zero-downtime migration to [Vercel DNS](https://vercel.com/kb/guide/zero-downtime-migration-for-dns) if using custom domain

## Security

- [x] Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy) in `apps/web/vercel.json`
- [ ] Content Security Policy (CSP) — start with [Report-Only](https://vercel.com/docs/headers/security-headers) mode
- [ ] Enable [Deployment Protection](https://vercel.com/docs/security/deployment-protection) for previews
- [ ] **OPTIONS Allowlist:** If Deployment Protection is enabled on the **server** project, add `/api` (and `/trpc`) to [OPTIONS Allowlist](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/options-allowlist) so CORS preflight requests succeed from the web app
- [ ] Configure [Vercel WAF](https://vercel.com/docs/security/vercel-waf) (custom rules, IP blocking)
- [ ] Enable [Log Drains](https://vercel.com/docs/drains)
- [x] Lockfiles committed (`pnpm-lock.yaml`)
- [ ] [Rate limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting) for API routes
- [ ] Review [access roles](https://vercel.com/docs/rbac/access-roles)

## Reliability

- [ ] Enable [Observability Plus](https://vercel.com/docs/observability/observability-plus) (Pro/Enterprise)
- [ ] Implement [caching headers](https://vercel.com/docs/cdn-cache) for static assets and API responses
- [ ] Consider [Tracing](https://vercel.com/docs/tracing) for distributed tracing

## Build time (Vercel)

- [ ] **Remote Cache:** In Vercel project env, set `TURBO_TOKEN` and `TURBO_TEAM` (from [Vercel Remote Caching](https://vercel.com/docs/monorepos/remote-caching)); then run `pnpm vercel:link` from repo root once. Cache hits skip unchanged work and cut build time. Each Vercel project (web, server, docs) needs its own env vars if deployed separately.
- [x] **Scoped build:** Web/Server/Docs use `turbo build --filter=<app>` so only that app is built per project.
- [x] **Ignored Build Step:** `npx turbo-ignore --fallback=HEAD^1` skips deploys when the app’s inputs didn’t change.
- [x] **Optional – Next.js standalone:** In `apps/web/next.config.ts`, set `output: "standalone"` for a smaller server bundle and faster cold starts (if you don’t rely on Vercel’s default Node runtime behavior).

## Performance

- [x] [Speed Insights](https://vercel.com/docs/speed-insights) enabled
- [ ] [Web Analytics](https://vercel.com/docs/analytics) (optional; for page views)
- [x] [Image Optimization](https://vercel.com/docs/image-optimization) via `next/image`
- [x] [Font Optimization](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) via `next/font`
- [ ] Vercel Function region aligned with API/database region
- [ ] Review [TTFB](https://vercel.com/docs/speed-insights/metrics#time-to-first-byte-ttfb)

## Cost optimization

- [ ] [Fluid compute](https://vercel.com/docs/fluid-compute) is default for new projects — verify enabled
- [ ] Configure [Spend Management](https://vercel.com/docs/spend-management) and alerts
- [ ] Review Function [duration](https://vercel.com/docs/functions/configuring-functions/duration) and [memory](https://vercel.com/docs/functions/configuring-functions/memory)
- [ ] Move large media to [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) if needed

## Doji-specific

- [ ] **Web:** `NEXT_PUBLIC_SERVER_URL` points to deployed API — not localhost
- [ ] **Server:** Add Neon or Supabase from Vercel Marketplace; `DATABASE_URL` auto-injected
- [ ] **Server:** `CORS_ORIGIN` includes web app URL(s), e.g. `https://your-app.vercel.app`
- [ ] All env vars from `apps/web/.env.example` and `apps/server/.env.example` set
- [ ] Database migrations: run `pnpm db:migrate` before first deploy. If using Neon pooled `DATABASE_URL`, set `DATABASE_URL_DIRECT` (direct connection) for migrations to avoid PgBouncer DDL issues
- [ ] Magic Link, Polymarket builder credentials configured for production

## Vercel project setup (monorepo)

For each app, configure in Vercel Dashboard or `vercel.json`:

| Project | Root Directory | Build Command | Notes |
|---------|----------------|---------------|-------|
| Web | `apps/web` | `cd ../.. && pnpm exec turbo build --filter=web` | Framework: Next.js. Explicit filter so only web (not server/docs) is built. |
| Server | `apps/server` | `cd ../.. && pnpm exec turbo build --filter=server` | Framework: null; Hono default export from `src/index.ts`. Build ensures workspace deps (@doji/api, etc.) are compiled. |
| Docs | `apps/docs` | `cd ../.. && pnpm exec turbo build --filter=docs` | Framework: Fumadocs / Next.js. Use explicit filter when Root Directory is apps/docs. |

**Server 404s:** If `https://your-server.vercel.app` returns 404 for all routes, verify Root Directory is `apps/server` and build succeeds. `vercel.json` uses `framework: "hono"` (not null).

**Server NODEJS_HELPERS:** Set `NODEJS_HELPERS=0` in the server project's Vercel env vars. Required for Hono POST/body handling on Vercel serverless (tRPC, mutations). Without it, POST requests may fail.
