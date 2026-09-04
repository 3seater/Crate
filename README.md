# Doji

Doji is a terminal-style trading interface for [Polymarket](https://polymarket.com) prediction markets. Trade on real-world outcomes across politics, sports, crypto, and more — with a non-custodial wallet and zero fees.

Think Bloomberg for Polymarket — top-of-the-line charting, wallet tracking and watchlists, event calendars, live WebSocket data, quick trading, and enriched market data.

## Tech Stack

| Layer | Stack |
|-------|-------|
| **Frontend** | Next.js 16 · React 19 · TailwindCSS · shadcn/ui · base-ui · Zustand · TanStack Query |
| **Backend** | Hono · tRPC · PostgreSQL · Drizzle ORM |
| **Auth & Wallets** | Magic Link (email + social OAuth) · External Wallets (MetaMask/Phantom via SIWE) · Gnosis Safe · viem |
| **Trading** | Polymarket CLOB V2 Client · Builder Program · Builder Relayer Client |
| **Charts** | KLineChart v10 · Recharts |
| **Observability** | Pino (structured logging) |
| **Tooling** | Turborepo · pnpm · Vitest · Biome (Ultracite) · React Compiler |
| **Documentation** | Fumadocs |

## Hosting

- **Web & Server** — [Vercel](https://vercel.com) (web app at `apps/web`, API at `apps/server`; separate projects, root directory set per app)
- **Database** — [Neon](https://neon.tech) (serverless Postgres); `DATABASE_URL` injected via Vercel Neon integration

## Quick Start

```bash
# Toolchain (Node 22 + pnpm 10.33 — see mise.toml)
mise trust
mise install

# Install dependencies
pnpm install

# Set up environment variables
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env

# Push database schema
pnpm db:push

# Start development servers
pnpm dev
```

| App | URL |
|-----|-----|
| Web | <http://localhost:3000> |
| Server | <http://localhost:3001> |
| Docs | <http://localhost:3002> |

## Authentication & Trading Flow

### Email Users
1. **Login** → Magic Link (email OTP or social OAuth)
2. **Onboarding** → Gasless Safe deployment via Builder Program
3. **Register** → Safe + credentials stored server-side
4. **Session cookie** → JWT synced to HttpOnly cookie for server-side prefetching
5. **Trade** → Orders signed client-side, posted via tRPC; server signs with Builder credentials

### Wallet Users (MetaMask/Phantom)
1. **Login** → SIWE via Magic WalletKit widget
2. **Import** → Existing Polymarket Safe imported automatically
3. **Credentials** → Derived via external wallet EIP-712 signature during onboarding
4. **Trade** → Orders signed by external wallet, posted via tRPC; server signs with Builder credentials

Non-custodial: users control their Safe; orders execute from their wallet.

## Project Structure

```
apps/
├── web/                              # Next.js 16 frontend (terminal-style trading UI)
│   └── src/
│       ├── app/                      # App Router pages & route handlers
│       │   ├── layout.tsx            # Root layout (Providers, AppShell)
│       │   ├── (app)/               # Authenticated route group
│       │   │   ├── explore/          # Market discovery
│       │   │   ├── portfolio/        # Positions, orders, activity
│       │   │   ├── leaderboard/      # Top traders
│       │   │   ├── watchlist/        # Starred markets
│       │   │   ├── wallet-tracker/   # External wallet tracking
│       │   │   ├── referrals/        # Invite codes & stats
│       │   │   └── market/[slug]/    # Market terminal
│       │   ├── (auth)/login/         # Login + OAuth callback
│       │   ├── api/                  # Route handlers (session, geoblock, share-pnl, etc.)
│       │   └── dev/                  # Dev-only pages
│       ├── domains/                  # Feature domains (components, hooks, stores, lib)
│       │   ├── auth/                 # Login, onboarding, Magic SDK, Safe, wallet login
│       │   ├── trading/              # Order form, orderbook, charts, market pages
│       │   ├── explore/              # Event discovery, category browsing
│       │   ├── portfolio/            # Position tables, redeem, PnL sharing
│       │   ├── bridge/               # USDC deposit/withdraw flows
│       │   ├── watchlist/            # Watchlist widget
│       │   ├── tracker/              # Wallet tracking widget
│       │   ├── leaderboard/          # Leaderboard data table
│       │   ├── profile/              # Profile hover card & modal
│       │   ├── comments/             # Market comments
│       │   └── referrals/            # Referral program
│       ├── shell/                    # App shell, header, nav, dock, widgets
│       ├── hooks/                    # Shared hooks (useSession, etc.)
│       ├── stores/                   # Shared Zustand stores (wallet, preferences)
│       ├── lib/                      # tRPC, WebSocket, flags, Sentry, SEO
│       │   ├── trpc/                 # Client + server callers
│       │   └── ws/                   # Market, user, sports, RTDS channels
│       ├── ui/                       # shadcn/ui components
│       ├── utils/                    # Pure helpers (cn, format, type-guards)
│       └── config/                   # Query config, app constants, feature flags
├── server/                           # Hono + tRPC API
│   └── src/
│       ├── domains/                  # Domain routers
│       │   ├── auth/                 # Magic Link, JWT sessions, Safe registration
│       │   ├── orders/               # CLOB order placement, cancellation, open orders
│       │   ├── markets/              # Gamma API, market/event queries, enrichment
│       │   ├── trading/              # CLOB client factory, error mapping (no router)
│       │   ├── data/                 # Data API client, subgraph queries (no router)
│       │   ├── activity/             # Trade feeds, volume, open interest
│       │   ├── portfolio/            # Positions, watchlist
│       │   ├── leaderboard/          # PnL/volume/ROI rankings
│       │   ├── rewards/              # Liquidity rewards, maker rebates
│       │   ├── tracker/              # Tracked wallet management
│       │   ├── referrals/            # Invite codes, referral tracking
│       │   ├── bridge/               # USDC bridging, builder signing
│       │   └── events/               # Event queries
│       ├── shared/                   # Resilience, errors, onchain utilities
│       └── routers/                  # Root router (wires all domain routers)
└── docs/                             # Fumadocs documentation site

packages/
├── api/          # tRPC setup, middleware, auth procedures
├── config/       # Shared TypeScript & Biome configs
├── db/           # Drizzle schema, queries & migrations
├── env/          # T3 Env validation (server + web)
├── hooks/        # Shared React hooks
├── logger/       # Pino logger (server) & browser-safe client logger
└── types/        # Shared TypeScript types & Polymarket constants

tests/
├── unit/
├── integration/
└── e2e/

notes/            # Markdown reference docs (not the Fumadocs app)
```

Polymarket API clients live in `apps/server/src/domains/markets/lib/` (Gamma), `apps/server/src/domains/trading/lib/` (CLOB), and `apps/server/src/domains/data/lib/` (Data API).

## Commands

### Development

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps |
| `pnpm dev:web` | Web only (port 3000) |
| `pnpm dev:server` | Server only (port 3001) |
| `pnpm dev:docs` | Docs only (port 3002) |

### Build & Quality

| Command | Description |
|---------|-------------|
| `pnpm build` | Build all apps for production |
| `pnpm check-types` | TypeScript validation across all packages |
| `pnpm check` | Lint & format check (Biome) |
| `pnpm fix` | Auto-fix lint/format — **run before committing** |
| `pnpm knip` | Detect unused files and exports (local; not run in GitHub Actions) |
| `pnpm dup` | Detect copy-paste / duplicated code |
| `pnpm react-doctor` | React health scan of `apps/web` (60+ rules, 0–100 score) |
| `pnpm react-doctor:diff` | Same scan, changed files only (fast pre-PR check) |

### Testing

| Command | Description |
|---------|-------------|
| `pnpm test` | Run all tests |
| `pnpm test:unit` | Unit tests only |
| `pnpm test:integration` | Integration tests only |
| `pnpm test:e2e` | E2E tests only |
| `pnpm test:watch` | Watch mode |
| `pnpm test:coverage` | Coverage report (v8) |

### Database

| Command | Description |
|---------|-------------|
| `pnpm db:push` | Push schema changes (development) |
| `pnpm db:generate` | Generate migration files |
| `pnpm db:migrate` | Run pending migrations (production) |
| `pnpm db:baseline` | Baseline existing schema (run once when switching to migrate) |
| `pnpm db:studio` | Open Drizzle Studio |

## Environment Variables

Validated by `@doji/env`. Copy example files and fill in secrets.

### Server (`apps/server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | Neon (or any Postgres) connection string |
| `DATABASE_URL_DIRECT` | — | Non-pooled connection for migrations (when `DATABASE_URL` is pooled) |
| `MAGIC_SECRET_KEY` | ✅ | Magic Link secret key |
| `CREDENTIAL_ENCRYPTION_KEY` | ✅ | 64-char hex key for encrypting stored credentials |
| `JWT_SESSION_SECRET` | ✅ | 32+ char secret for session JWTs |
| `CORS_ORIGIN` | ✅ | Comma-separated allowed origins (e.g. `http://localhost:3000`) |
| `POLYMARKET_BUILDER_ID` | ✅ | Builder Program ID |
| `POLY_BUILDER_CODE` | ✅ | Builder code (bytes32) for CLOB V2 orders |
| `POLYMARKET_BUILDER_PASSPHRASE` | ✅ | Builder passphrase |
| `POLYMARKET_SIGN_TOKENS` | — | Comma-separated Bearer tokens for `/api/polymarket/sign` |
| `POLYGON_RPC_URL` | — | Polygon RPC (default: `https://polygon.drpc.org`) |
| `ETHERSCAN_API_KEY` | — | Etherscan V2 API key for activity tab |
| `POLYMARKET_SUBGRAPH_OI_URL` | — | Goldsky open interest subgraph URL |
| `POLYMARKET_SUBGRAPH_ORDERS_URL` | — | Goldsky orders subgraph URL |
| `POLYMARKET_SUBGRAPH_ACTIVITY_URL` | — | Goldsky activity subgraph URL |
| `POLYMARKET_SUBGRAPH_PNL_URL` | — | Goldsky PnL subgraph URL |
| `POLYMARKET_SUBGRAPH_POSITIONS_URL` | — | Goldsky positions subgraph URL |
| `REFERRAL_GATE_ENABLED` | — | Require invite code for new accounts (default: `false`) |
| `SUBGRAPH_ENABLE_TRADE_COUNTS` | — | Use orderbook subgraph for trade counts (default: `true`) |
| `BRIDGE_DISABLED_CHAINS` | — | Comma-separated chain IDs to disable in bridge |
| `BRIDGE_DISABLED_TOKENS` | — | Comma-separated token symbols to disable in bridge |

### Web (`apps/web/.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY` | ✅ | Magic Link publishable key |
| `NEXT_PUBLIC_SERVER_URL` | ✅ | API server URL (default: `http://localhost:3001`) |
| `NEXT_PUBLIC_WS_MARKET_URL` | — | Market WebSocket URL |
| `NEXT_PUBLIC_WS_USER_URL` | — | User WebSocket URL |
| `NEXT_PUBLIC_WS_SPORTS_URL` | — | Sports WebSocket URL |
| `NEXT_PUBLIC_RTDS_URL` | — | RTDS (real-time data) WebSocket URL |
| `NEXT_PUBLIC_CLOB_API_URL` | — | CLOB API URL (default: `https://clob.polymarket.com`) |
| `NEXT_PUBLIC_POLYGON_RPC_URL` | — | Polygon RPC URL |
| `NEXT_PUBLIC_CHAIN_ID` | — | Chain ID (default: `137`) |
| `NEXT_PUBLIC_APP_URL` | — | Public app URL for metadata/sitemap |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | — | WalletConnect project ID |
| `NEXT_PUBLIC_FEATURE_REFERRALS` | — | Enable referral program UI |
| `NEXT_PUBLIC_DISABLE_GEOBLOCK` | — | Bypass geoblock check (dev only) |
| `NEXT_PUBLIC_SIMULATE_GEOBLOCKED` | — | Simulate geoblocked UI (dev only) |
| `NEXT_PUBLIC_POST_ORDER_CLIENT_SIDE` | — | Post orders from client directly (debug only) |
| `POLYMARKET_SIGN_TOKEN` | — | Bearer token forwarded to server sign endpoint |
| `VERCEL_URL` | — | Injected by Vercel; used as fallback for `NEXT_PUBLIC_APP_URL` |
| `LOG_LEVEL` | — | Log level: `trace` `debug` `info` `warn` `error` `fatal` |

On Vercel, link Neon via the [Vercel Neon integration](https://vercel.com/integrations/neon) so `DATABASE_URL` is injected automatically for the server.

## CI/CD

- **Pull requests:** `.github/workflows/ci.yml` — lint, typecheck, and build (path-based skipping; draft PRs skipped). Optional `TURBO_TOKEN` / `TURBO_TEAM` for [Vercel Remote Caching](https://vercel.com/docs/monorepos/remote-caching). Run `pnpm test` locally or on Vercel as needed.
- **Production on `main`:** `.github/workflows/deploy.yml` — **Vercel CLI** deploy (owner `VERCEL_TOKEN`) for web, API, and docs so collaborators can push without extra Vercel seats. GitHub secret: **`VERCEL_TOKEN`** only (required). Project/org ids are in `deploy.yml` (dojibet `team_uFjyxuuasdE7p77Rg5jl6uYh`). One-shot: `VERCEL_TOKEN='…' ./scripts/set-github-vercel-deploy-secrets.sh` (requires `gh auth login`). Legacy deploy-hook secrets are unused.

Run `pnpm knip` locally when cleaning up exports; it is intentionally not part of CI.

## Package Manager

**pnpm only.** Never use npm or yarn. Versions are pinned in `package.json` (`packageManager`) and [`mise.toml`](./mise.toml).

**Recommended (mise):**

```bash
mise trust && mise install   # Node 22 + pnpm 10.33.0 in this directory
```

**Alternative (Corepack):**

```bash
corepack enable
corepack prepare pnpm@10.33.0 --activate
```

## Documentation

| Document | Description |
|----------|-------------|
| [AGENTS.md](./AGENTS.md) | Project overview, glossary, common tasks |

### Apps

| Document | Description |
|----------|-------------|
| [apps/web/AGENTS.md](./apps/web/AGENTS.md) | Frontend structure, routes, auth flow |
| [apps/server/AGENTS.md](./apps/server/AGENTS.md) | API, tRPC routers, resilience patterns |
| [apps/docs/AGENTS.md](./apps/docs/AGENTS.md) | Fumadocs documentation site |

### Packages

| Document | Description |
|----------|-------------|
| [packages/api/AGENTS.md](./packages/api/AGENTS.md) | tRPC setup & middleware |
| [packages/config/AGENTS.md](./packages/config/AGENTS.md) | Shared TypeScript & Biome configs |
| [packages/db/AGENTS.md](./packages/db/AGENTS.md) | Drizzle schema & queries |
| [packages/env/AGENTS.md](./packages/env/AGENTS.md) | T3 Env validation |
| [packages/hooks/AGENTS.md](./packages/hooks/AGENTS.md) | Shared React hooks |
| [packages/logger/AGENTS.md](./packages/logger/AGENTS.md) | Pino logger (server & client) |
| [packages/types/AGENTS.md](./packages/types/AGENTS.md) | Polymarket API types & CLOB constants |

### Tests

| Document | Description |
|----------|-------------|
| [tests/AGENTS.md](./tests/AGENTS.md) | Test structure, conventions, commands |
| [tests/README.md](./tests/README.md) | Test overview and layout |
| [tests/integration/README.md](./tests/integration/README.md) | Integration test coverage and rate limits |

### Web — Domains

| Document | Description |
|----------|-------------|
| [apps/web/src/domains/auth/AGENTS.md](./apps/web/src/domains/auth/AGENTS.md) | Login, auth guards, onboarding, Magic SDK, wallet login |
| [apps/web/src/domains/trading/AGENTS.md](./apps/web/src/domains/trading/AGENTS.md) | Order form, orderbook, charts, market pages |
| [apps/web/src/domains/explore/AGENTS.md](./apps/web/src/domains/explore/AGENTS.md) | Event & market discovery |
| [apps/web/src/domains/portfolio/AGENTS.md](./apps/web/src/domains/portfolio/AGENTS.md) | Position tables, redeem, PnL sharing |
| [apps/web/src/domains/bridge/AGENTS.md](./apps/web/src/domains/bridge/AGENTS.md) | USDC bridging |
| [apps/web/src/domains/leaderboard/AGENTS.md](./apps/web/src/domains/leaderboard/AGENTS.md) | Top trader rankings |
| [apps/web/src/domains/watchlist/AGENTS.md](./apps/web/src/domains/watchlist/AGENTS.md) | Watchlist widget |
| [apps/web/src/domains/tracker/AGENTS.md](./apps/web/src/domains/tracker/AGENTS.md) | Wallet tracking |
| [apps/web/src/domains/profile/AGENTS.md](./apps/web/src/domains/profile/AGENTS.md) | User profile modal |
| [apps/web/src/domains/comments/AGENTS.md](./apps/web/src/domains/comments/AGENTS.md) | Market comments |
| [apps/web/src/domains/referrals/AGENTS.md](./apps/web/src/domains/referrals/AGENTS.md) | Referral program |

### Web — Shell & Infrastructure

| Document | Description |
|----------|-------------|
| [apps/web/src/shell/AGENTS.md](./apps/web/src/shell/AGENTS.md) | App shell, header, nav, dock, widgets |
| [apps/web/src/lib/ws/AGENTS.md](./apps/web/src/lib/ws/AGENTS.md) | Market, user & sports WebSocket clients |

### Server — Domains

| Document | Description |
|----------|-------------|
| [apps/server/src/domains/auth/AGENTS.md](./apps/server/src/domains/auth/AGENTS.md) | Magic Link, sessions, Safe registration |
| [apps/server/src/domains/trading/AGENTS.md](./apps/server/src/domains/trading/AGENTS.md) | CLOB client, error mapping, enrichment |
| [apps/server/src/domains/markets/AGENTS.md](./apps/server/src/domains/markets/AGENTS.md) | Gamma API, market/event queries, enrichment |
| [apps/server/src/domains/data/AGENTS.md](./apps/server/src/domains/data/AGENTS.md) | Data API client, subgraph queries |
| [apps/server/src/domains/orders/AGENTS.md](./apps/server/src/domains/orders/AGENTS.md) | CLOB order management, placement, cancellation |
| [apps/server/src/domains/activity/AGENTS.md](./apps/server/src/domains/activity/AGENTS.md) | Trade feeds, volume, open interest |
| [apps/server/src/domains/leaderboard/AGENTS.md](./apps/server/src/domains/leaderboard/AGENTS.md) | PnL/volume/ROI rankings |
| [apps/server/src/domains/portfolio/AGENTS.md](./apps/server/src/domains/portfolio/AGENTS.md) | Positions, watchlist |
| [apps/server/src/domains/rewards/AGENTS.md](./apps/server/src/domains/rewards/AGENTS.md) | Liquidity rewards, maker rebates |
| [apps/server/src/domains/tracker/AGENTS.md](./apps/server/src/domains/tracker/AGENTS.md) | Tracked wallet management |
| [apps/server/src/domains/bridge/AGENTS.md](./apps/server/src/domains/bridge/AGENTS.md) | USDC bridging, builder signing |
| [apps/server/src/domains/referrals/AGENTS.md](./apps/server/src/domains/referrals/AGENTS.md) | Invite codes, referral tracking |
| [apps/server/src/domains/events/AGENTS.md](./apps/server/src/domains/events/AGENTS.md) | Event queries |
| [apps/server/src/shared/AGENTS.md](./apps/server/src/shared/AGENTS.md) | Resilience, errors, onchain utilities |
| [apps/server/src/health/AGENTS.md](./apps/server/src/health/AGENTS.md) | Health check, OpenAPI |
