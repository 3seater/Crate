# API Package

> Scope: `packages/api` (inherits root [AGENTS.md](../../AGENTS.md) unless noted)

tRPC setup and middleware for type-safe API communication between frontend and backend.

## Quick Facts

- **Package:** `@doji/api`
- **Commands:** `pnpm check-types`, `pnpm test` (from root or `--filter @doji/api`)

## Purpose

Foundational tRPC setup (context, middleware, procedures). Routers live in `apps/server/src/routers/`.

## Current Status

This package provides the foundational tRPC setup including:
- **Context creation** — Request context with database and user info
- **Middleware** — Logging and authentication middleware  
- **Base procedures** — Public procedure with logging
- **Utilities** — Builder client, CLOB factory, session management

**Note**: Individual routers are defined in the server app (`apps/server/src/routers/`), not in this package.

## Structure

```
src/
├── index.ts          # Main exports
├── trpc.ts           # tRPC instance
├── context.ts        # tRPC context creation
├── middleware/       # tRPC middleware
│   ├── logger.ts     # Request logging
│   ├── auth.ts       # Authentication (protectedProcedure)
│   └── sentry.ts     # Sentry error reporting middleware
└── lib/              # Utility functions
    ├── clob-factory.ts # CLOB client factory
    ├── session.ts    # Session management
    ├── crypto.ts     # Encryption utilities
    ├── errors.ts     # AppError
    └── clob/         # CLOB client (exported as @doji/api/lib/clob)
        ├── index.ts
        ├── client.ts
        └── address-signer.ts
```

## Installation

```bash
pnpm add @doji/api
```

## Usage

### Basic Setup

```typescript
// src/trpc.ts
import { initTRPC } from "@trpc/server";
import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();
```

### Context Creation

```typescript
// src/context.ts
import { db } from "@doji/db";
import type { User } from "@doji/types";

export interface Context {
  db: typeof db;
  user?: User;
  req?: Request;
}

export async function createContextInner(opts: {
  req?: Request;
  user?: User;
}): Promise<Context> {
  return {
    db,
    user: opts.user,
    req: opts.req,
  };
}
```

### Middleware Usage

```typescript
import { publicProcedure, loggerMiddleware } from "@doji/api";

// Public procedure with logging
export const myProcedure = publicProcedure
  .input(z.object({ id: z.string() }))
  .query(async ({ input, ctx }) => {
    // Automatically logged
    return { id: input.id };
  });
```

## Utilities

### CLOB Factory

```typescript
import { createClobClient } from "@doji/api/lib/clob";

const clobClient = createClobClient({
  host: env.CLOB_API_URL,
  chain: env.CHAIN_ID,
});
```

## Error Handling

- **AppError** — Use when why/fix/link improve UX (auth, trading). Client receives `error.data.why`, `error.data.fix`, `error.data.link`.
- **TRPCError** — Use for simple cases. Client receives `error.message` and `error.data.code`.
- Client should use `getTrpcDisplayMessage(error)` (web) to extract user-facing text from tRPC error shape.

## Finish the Task

- [ ] Run `pnpm fix` before committing.
- [ ] Update this AGENTS.md if you changed context, middleware, or exports.
- [ ] Summarize changes in conventional commit form (e.g. `feat(api): ...`).

## Related

- [Server API](../../apps/server/AGENTS.md)
- [Database Package](../db/AGENTS.md)
- [Types Package](../types/AGENTS.md)
- [Code Standards](../../.agents/code-standards.md)
