# Tests

Root-level test suite for the Doji monorepo. All tests use **Vitest**; config is at repo root (`vitest.config.mts`).

## Quick Facts

- **Runner:** Vitest (globals, `tests/setup.ts` loads `apps/server/.env`)
- **File pattern:** `*.test.ts` or `*.test.tsx` under `tests/` (no `.spec.` in this repo)
- **Commands:** From repo root — `pnpm test`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm test:watch`, `pnpm test:coverage`

## Structure

| Path | Purpose |
|------|---------|
| `setup.ts` | Load env; add jest-dom when needed |
| `helpers.ts` | Shared utilities (e.g. `createId`) |
| `fixtures/` | Factory (`createFixture`), ID helpers (`createAddress`, `createTokenId`), auth shapes (`createAuthUser`) |
| `unit/` | Pure unit tests (no DB, no server) |
| `unit/websocket/` | WebSocket/RTDS unit tests (schemas, backoff, subscription-registry, RtdsClient, WebSocketManager) |
| `integration/` | Integration tests (API clients, tRPC); requires `DATABASE_URL` for DB-dependent tests |
| `e2e/` | E2E smoke; Playwright/browser when added |

## Conventions

- **AAA:** Arrange, Act, Assert
- **Fixtures:** Use `createFixture`, `createAuthUser`, `createTokenId`, etc. from `fixtures/`
- **No `.only` / `.skip`** in committed code

See [tests/AGENTS.md](./AGENTS.md) for scope and [tests/integration/README.md](./integration/README.md) for integration test details.
