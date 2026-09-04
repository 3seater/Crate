# Setup & Commands

## Tooling & Setup

- **Toolchain:** [mise](https://mise.jdx.dev/) — `mise trust && mise install` reads [`mise.toml`](../mise.toml) (Node **22**, pnpm **10.33.0**, matches CI and `package.json` `packageManager`)
- **Install:** `pnpm install` from repo root (`packageManager` pinned in `package.json`)
- **Runtime:** TypeScript throughout; database via PostgreSQL (hosted e.g. Neon, or any local Postgres you run yourself)
- **Environment:** Copy `apps/server/.env.example` → `apps/server/.env` and `apps/web/.env.example` → `apps/web/.env.local` (or `.env` per app README). Canonical schemas: `packages/env/src/server.ts`, `packages/env/src/web.ts`
- **Server secrets (placeholders validate but auth/trading need real values):** `DATABASE_URL`, `MAGIC_SECRET_KEY`, `CREDENTIAL_ENCRYPTION_KEY` (64 hex chars), `JWT_SESSION_SECRET` (32+ chars), `CORS_ORIGIN`, `POLYMARKET_BUILDER_ID`, `POLYMARKET_BUILDER_SIGNING_KEY` (or `POLYMARKET_BUILDER_SECRET`), `POLY_BUILDER_CODE` (bytes32), `POLYMARKET_BUILDER_PASSPHRASE` — see `.env.example` for the full list
- **Optional server vars:** `POLYGON_RPC_URL`, `ETHERSCAN_API_KEY`, `POLYMARKET_SIGN_TOKENS`, `POLYMARKET_SUBGRAPH_*_URL` (Goldsky subgraphs), `REFERRAL_GATE_ENABLED`, `SUBGRAPH_ENABLE_*`, `BRIDGE_DISABLED_CHAINS`/`BRIDGE_DISABLED_TOKENS`
- **Web vars:** `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SERVER_URL` (required). Optional: `NEXT_PUBLIC_WS_*_URL` (WebSocket), `NEXT_PUBLIC_CLOB_API_URL`, `NEXT_PUBLIC_POLY_BUILDER_CODE` (bytes32), `NEXT_PUBLIC_FEATURE_REFERRALS`, `NEXT_PUBLIC_APP_URL`
- **Optional logging:** `LOG_LEVEL` for Pino log level (see `packages/logger`)
- **Secrets:** Never commit real keys; keep `.env.example` and `packages/env` aligned when adding variables
- **Local database:** Point `DATABASE_URL` in `apps/server/.env` at your Postgres (e.g. Neon dev branch, `postgres` on localhost). Then `pnpm db:push`

## Development

- `pnpm dev` — Start all apps in development mode
- `pnpm dev:web` — Start web app only (localhost:3000)
- `pnpm dev:server` — Start server only (localhost:3001)
- `pnpm dev:docs` — Start docs only (localhost:3002)

## Build & Quality

- `pnpm build` — Build all apps for production
- `pnpm check-types` — TypeScript validation across all packages
- `pnpm fix` — Format & lint fix (Ultracite/Biome) **Run before committing**
- `pnpm check` — Check formatting & linting without fixing
- `pnpm knip` — Unused files/exports (see `knip.json`); **not** run in GitHub Actions — run locally when refactoring
- `pnpm dup` — Copy-paste / duplicated code (jscpd; config [`.jscpd.json`](.jscpd.json); HTML → `./jscpd-report`)
- `pnpm react-doctor` — React health scan of `apps/web` (full, verbose). Checks 60+ rules: state/effects, perf, architecture, security, a11y, Next.js-specific. Outputs 0–100 score.
- `pnpm react-doctor:diff` — Same scan but **only changed files** vs `main` (fast pre-PR check)

## Database

- `pnpm db:push` — Push schema changes to database (development)
- `pnpm db:generate` — Generate migration files
- `pnpm db:migrate` — Run pending migrations (production)
- `pnpm db:baseline` — Mark existing schema as baseline (run once when switching from push to migrate)
- `pnpm db:studio` — Open Drizzle Studio (database GUI)

## Testing

- Tests live in `tests/` (unit and integration). See `tests/README.md` for conventions.
- `pnpm test` — All tests (CI mode)
- `pnpm test:unit` — `tests/unit/` only
- `pnpm test:integration` — `tests/integration/` only
- `pnpm test:e2e` — `tests/e2e/` only
- `pnpm test:watch` — Watch mode
- `pnpm test:coverage` — Coverage (v8)
- **Lint/format:** `pnpm check` / `pnpm fix` at repo root (Ultracite); not defined as Turbo tasks — see `turbo.json` for package-level `build`, `check-types`, `test`
- **CI:** PR-only (+ `workflow_dispatch`); jobs skip heavy work when no TS or config files changed — see `.github/workflows/ci.yml` (no knip or test steps)
- **Deploy:** Pushes to `main` run `.github/workflows/deploy.yml` (Vercel CLI; set `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and per-app `VERCEL_PROJECT_ID_*` in GitHub Actions secrets)

## Vercel CLI (optional)

- `pnpm vercel:link` — `turbo login && turbo link` for remote caching
- `pnpm vercel:env:pull:web` / `pnpm vercel:env:pull:server` — Pull env into app `.env.local`

## Next.js Upgrade

Both `apps/web` and `apps/docs` run Next.js canary. To upgrade:

```bash
pnpm add next@canary --filter=web --filter=docs
```
