# Doji

<!-- BEGIN:nextjs-agent-rules -->

# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `apps/web/node_modules/next/dist/docs/`. Your training data is outdated — the docs are the source of truth.

<!-- END:nextjs-agent-rules -->

> Scope: Root project (applies to all subdirectories unless overridden)

Full-stack TypeScript monorepo for Polymarket prediction market applications.

## Quick Facts

- **Primary Language:** TypeScript
- **Package Manager:** pnpm (never npm/yarn)
- **Monorepo Tool:** Turborepo
- **Node.js:** Node 22 in CI (see `.github/workflows/ci.yml`)
- **Key Commands:** `pnpm dev`, `pnpm build`, `pnpm fix`, `pnpm knip` (unused files/exports, local only), `pnpm dup` (copy-paste / duplication scan)
- **Ports:** Web (3000), Server (3001), Docs (3002)
- **CI/CD:** GitHub Actions — PR workflow `ci.yml` (lint, typecheck, build; knip is local-only); `deploy.yml` deploys to Vercel via CLI on `main` (owner token; no extra seats for collaborators)
- **Automation:** Root `package.json` scripts only — no `Justfile` or `Makefile`

## Repository Tour

- **`apps/web/`** — Next.js frontend (terminal-style trading UI); entry `apps/web/src/`, design tokens in `apps/web/src/index.css`
- **`apps/server/`** — Hono + tRPC API; features under `apps/server/src/domains/`
- **`apps/docs/`** — Fumadocs documentation site; production URLs are root-relative (`/getting-started`, …) on a dedicated host such as `docs.doji.bet`
- **`packages/*`** — Shared libraries: `api` (tRPC), `db` (Drizzle), `env` (T3 Env), `hooks`, `logger`, `types`, `config` (TS/Biome presets)
- **`tests/`** — Vitest suites: `unit/`, `integration/`, `e2e/`; shared `fixtures/`, `tests/README.md`
- **`notes/`** — Markdown references (Polymarket deep dives, production checklist, design audits); not the Fumadocs app
- **`.github/workflows/`** — `ci.yml` (PR checks), `deploy.yml` (Vercel CLI on `main`); **`.github/renovate.json5`** — Renovate (install [GitHub App](https://github.com/apps/renovate))
- **`.kiro/specs/`** — Feature specs and audits (e.g. Magic + Safe, trading terminal); **`.kiro/audits/`** — occasional agent/process audits
- **`.ruler/`** — Single source of truth for AI agent instructions; run `pnpm ruler` (or `pnpm dlx @intellectronica/ruler apply --no-backup`) to regenerate root `AGENTS.md` / `CLAUDE.md` and agent outputs

Trimmed layout (gitignored paths omitted):

```
apps
├── docs/          # Fumadocs
├── server/        # Hono + tRPC
└── web/           # Next.js
packages
├── api/
├── config/
├── db/
├── env/
├── hooks/
├── logger/
└── types/
tests
├── e2e/
├── fixtures/
├── integration/
└── unit/
notes/             # Repo Markdown docs (see list in README)
.github/workflows/
```

## Sub-AGENTS.md Directory

Each major domain has its own AGENTS.md with deeper context. **Read the relevant one before touching that domain.**

| Domain | File |
|--------|------|
| Web app (routes, structure, design system) | `apps/web/AGENTS.md` |
| Server (Hono, auth, middleware) | `apps/server/AGENTS.md` |
| Trading routers (CLOB, orders, error mapping) | `apps/server/src/domains/trading/AGENTS.md` |
| Market routers (Gamma, enrichment, filters) | `apps/server/src/domains/markets/AGENTS.md` |
| Polymarket API clients + schemas | `apps/server/src/shared/AGENTS.md` |
| Trading UI (orderbook, order form, charts) | `apps/web/src/domains/trading/AGENTS.md` |
| Explore / discovery | `apps/web/src/domains/explore/AGENTS.md` |
| App shell (header, nav, dock, widgets) | `apps/web/src/shell/AGENTS.md` |
| Auth (login, onboarding, Magic SDK, wallet login) | `apps/web/src/domains/auth/AGENTS.md` |
| Portfolio, bridge, watchlist, tracker, etc. | `apps/web/src/domains/{domain}/AGENTS.md` |
| WebSocket / RTDS client | `apps/web/src/lib/ws/AGENTS.md` |
| Database (Drizzle schema, migrations) | `packages/db/AGENTS.md` |
| Shared types + CLOB constants | `packages/types/AGENTS.md` |
| tRPC client + inferred types | `packages/api/AGENTS.md` |
| Environment variables (T3 Env) | `packages/env/AGENTS.md` |
| Tests (Vitest, fixtures, conventions) | `tests/AGENTS.md` |

## Where to Look

| Task | Primary path | Notes |
|------|-------------|-------|
| Add a web page/route | `apps/web/src/app/{route}/page.tsx` | Server Component by default |
| Add a React component | `apps/web/src/domains/{domain}/components/` | See domain AGENTS.md |
| Add a tRPC procedure | `apps/server/src/domains/{domain}/router.ts` | Register in `routers/index.ts` |
| Add a Zustand store | `apps/web/src/domains/{domain}/stores/` | Shared stores → `stores/` |
| Add a custom hook | `apps/web/src/domains/{domain}/hooks/` | Shared hooks → `hooks/` or `packages/hooks` |
| Change DB schema | `packages/db/src/schema/` | `pnpm db:push` (dev), `db:migrate` (prod) |
| Add/change env var | `packages/env/src/server.ts` or `web.ts` | Also update `.env.example` |
| Add real-time feature | `apps/web/src/lib/ws/` | RTDS or market/user channels |
| Fix trading logic | `apps/web/src/domains/trading/lib/` + `apps/server/src/domains/trading/` | Both sides |
| Add shared domain types | `packages/types/src/` | Imported as `@doji/types` |
| Add nav link | `apps/web/src/shell/header-nav.tsx` | Also update `bottom-bar.tsx` |

## Import Aliases

- **`@/`** → `apps/web/src/` (web) or `apps/server/src/` (server) — same alias, different root per tsconfig
- **`@doji/api`** → tRPC router types; `trpc` (React Query hooks) and `trpcClient` (imperative) helpers
- **`@doji/db`** → Drizzle schema, `db` client, query helpers
- **`@doji/env/server`** / **`@doji/env/web`** → validated, typed env vars
- **`@doji/hooks`** → shared UI hooks (`useDebounce`, `useMediaQuery`, `useMobile`, `useCopyToClipboard`)
- **`@doji/types`** → shared domain types (CLOB constants, order types, chain IDs, Polymarket types)
- **`@doji/logger`** → structured Pino logger

## Tech Stack

Next.js 16.2 (App Router, canary) · React 19 · TailwindCSS · shadcn/ui · base-ui · Hono · tRPC · PostgreSQL · Drizzle ORM · Magic Link · Gnosis Safe · TanStack Query · KLineChart v10 · Recharts · Turborepo · pnpm · Vitest · Biome (Ultracite) · React Compiler · Fumadocs · Sentry (`@sentry/nextjs` / `@sentry/node`) · Vercel Web Analytics (custom events in `apps/web/src/lib/analytics/`)

**Brand: Doji green** — `#DBFF55`. Use for nav active states, primary buttons, accents, value highlights, and the logo. Defined as `--doji-green` in `apps/web/src/index.css`; `text-primary`, `bg-primary`, and related tokens reference it in dark mode.

## Authentication & Trading

- **Auth**: Magic SDK (@magic-ext/oauth2 for Google OAuth) + External Wallets (MetaMask/Phantom via server-verified signed challenge + session JWT)
- **Wallets**: Gnosis Safe (gasless deployment via Builder Program)
- **Trading**: Polymarket CLOB V2 Client (non-custodial, pUSD collateral)
- **Flow (Google OAuth)**: Login → OAuth redirect → getRedirectResult → Deploy Safe → Derive Credentials → Trade
- **Flow (Wallet)**: Connect wallet → Switch to Polygon → server-issued signable challenge (`getWalletLoginChallenge`) → `walletLogin` with signature → Import/Deploy Safe → Derive Credentials → Trade

See [Magic + Safe Integration](./.kiro/specs/magic-safe-implementation.md) for details.
