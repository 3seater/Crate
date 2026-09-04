# Logger Package

> Scope: `packages/logger` (inherits root [AGENTS.md](../../AGENTS.md) unless noted)

Shared Pino logger for server-side and client-safe logging.

## Quick Facts

- **Package:** `@doji/logger`
- **Commands:** `pnpm check-types`
- **Entrypoints:** `@doji/logger` (server), `@doji/logger/client` (browser)

## Purpose

Provides structured logging with:

- **Server-side** — Pino logger with pretty printing (dev) and JSON output (prod)
- **Client-side** — Console wrapper that's silent in production
- **Security** — Automatic redaction of sensitive fields
- **Context** — Child loggers for request tracking

## Structure

```
src/
├── index.ts          # Server-side Pino logger
└── client.ts         # Client-safe logger
```

## Configuration

### Environment Variables

- `NODE_ENV` — Controls pretty printing and client output (from `process.env`)
- `LOG_LEVEL` — Minimum log level (validated via `@doji/env/web`; default: "debug" in dev, "info" in prod)
- `SERVICE_NAME` — Service identifier in logs (default: "doji-server")

### Pretty Printing (Dev)

Pretty output is enabled only when **both** `NODE_ENV=development` and stdout is a TTY. In CI, Docker, or piped contexts, output remains JSON for consistency.

## Features

### Production Mode

- **JSON output** — Structured logs to stdout with ISO timestamps
- **Level labels** — Human-readable `level: "info"` (not numeric)
- **Log aggregation** — Compatible with ELK, CloudWatch, or any stdout consumer
- **Client silence** — No console output

### Security

Automatic redaction of sensitive fields: `password`, `token`, `authorization`, `cookie`, `secret`, `apiKey`, `credential`, `*.password`, `*.token`, `*.secret`, `req.headers.authorization`, `req.headers.cookie`.

## Type Safety

```typescript
import type { Logger } from "@doji/logger";

// Minimal interface for dependency injection
function createHandler(logger: Logger) {
  logger.info("Handler created");
  const childLogger = logger.child({ component: "handler" });
  childLogger.debug("Debug info");
}
```

## Related

- [API Package](../api/AGENTS.md)
- [Server API](../../apps/server/AGENTS.md)
