# Infrastructure

## Turborepo Configuration

### Package Tasks

- `build` — Build packages/apps (depends on `^build`)
- `test` — Run tests (depends on `^build`)
- `test:watch` — Watch mode tests (no cache, persistent)
- `check-types` — Type check (runs in parallel across packages)
- `dev` — Development servers (no cache, persistent)

Lint/format runs at repo level via `pnpm check` and `pnpm fix` (Ultracite), not as turbo package tasks.

## CI/CD

**Pull requests:** `.github/workflows/ci.yml` — lint, typecheck, and build with path-based skipping; Node 22; optional `TURBO_TOKEN` / `TURBO_TEAM` for [Vercel Remote Caching](https://vercel.com/docs/monorepos/remote-caching). **Knip** (`pnpm knip`) is not run in CI; use it locally when cleaning exports. Tests are not run in this workflow — use `pnpm test` locally or your Vercel/check setup.

**Production:** `.github/workflows/deploy.yml` deploys via Vercel CLI on `main` (owner `VERCEL_TOKEN`) for web, API, and docs so collaborators can push without Pro seats; `git.deploymentEnabled.main: false` and `github.silent` in each app's `vercel.json` keep Git-on-main checks quiet while previews still use the Git integration.

## Vercel Deployment

**Hosting:** Web and Server are separate Vercel projects. Database is Neon (serverless Postgres) via [Vercel Neon integration](https://vercel.com/integrations/neon).

**Main app:** Set **Root Directory** to `apps/web` in Project Settings → Build & Deployment. Do not use `apps/docs` for the main deployment.

- `apps/web/vercel.json` configures build (`turbo build --filter=web` from repo root), Ignored Build Step, security headers. To reduce build time: enable [Vercel Remote Caching](https://vercel.com/docs/monorepos/remote-caching) (set `TURBO_TOKEN`/`TURBO_TEAM`, run `pnpm vercel:link` once). See [Production checklist](notes/production-checklist.md) (build time section).
- `apps/docs` is a separate Fumadocs app—create a second Vercel project if needed with Root Directory `apps/docs`
- [Production checklist](notes/production-checklist.md) for launch readiness

## Vercel Server (Hono API)

**API server:** Create a second Vercel project for the Hono API. Root Directory: `apps/server`.

- `apps/server/vercel.json` — framework: Other (Hono)
- `apps/server/src/index.ts` exports the Hono app; Vercel uses it as the serverless handler
- Add **Neon** or **Supabase** from [Vercel Marketplace](https://vercel.com/marketplace?category=storage); integration injects `DATABASE_URL`
- Set env vars from `apps/server/.env.example`; `CORS_ORIGIN` must include the web app URL(s)
- Point web's `NEXT_PUBLIC_SERVER_URL` at the deployed server URL

## Cursor Cloud / Sandbox Notes

Ports, install, env files, and required secrets are covered under **Quick Facts** and **Setup**. Use **Neon** (or another Postgres) for `DATABASE_URL`; there is no repo-managed Docker Compose for the database.

**Gotchas**

- **pnpm v10:** dependency build scripts may be blocked; `esbuild` may not be on `PATH` for direct CLI use — Next.js/tsdown still resolve it; fallback path: `node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild`.
- **Lint/types:** Treat `pnpm check` and `pnpm check-types` as the current health baseline.
- **Tests:** Report failing suites from the latest `pnpm test` output, not historical counts.
