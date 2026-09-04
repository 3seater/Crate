# Database Package

> Scope: `packages/db` (inherits root [AGENTS.md](../../AGENTS.md) unless noted)

Drizzle ORM schema and database utilities for PostgreSQL.

## Quick Facts

- **Package:** `@doji/db`
- **Commands:** `pnpm db:push`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`, `pnpm check-types`, `pnpm test`

## Purpose

Centralized database schema, migrations, and query utilities using Drizzle ORM.

## Structure

```
src/
├── index.ts          # Main exports (Neon serverless or node-postgres)
├── connection-url.ts # normalizeConnectionUrl (sslmode→verify-full for pg)
├── baseline.ts      # Mark existing schema as migrated (db:baseline)
├── migrate.ts       # Programmatic migration runner (db:migrate)
├── seed-referral.ts # Seed/reset DOJI100 system code (pnpm db:seed-referral)
├── load-env.ts      # dotenv for scripts
├── schema/           # Database schema definitions
│   ├── index.ts
│   ├── users.ts
│   ├── tracked-wallets.ts
│   ├── watchlist-items.ts
│   ├── referral-codes.ts        # Canonical referral codes (system + user-owned)
│   ├── referral-code-aliases.ts # Retired codes (permanently blocked from reuse)
│   ├── referral-redemptions.ts  # Immutable attribution ledger
│   ├── did-token-nonces.ts      # DID token single-use enforcement (replay protection)
│   └── session-blocklist.ts     # Revoked JWT jti store (real logout)
├── migrations/       # Generated and applied migrations (drizzle-kit)
└── queries/
    ├── users.ts              # findUserById, findUserByIssuer, upsertUser, etc.
    ├── referrals.ts          # validateReferralCodeForGate, createUserWithReferral, getUserReferralCode, etc.
    ├── did-token-nonces.ts   # consumeDidTokenNonce, pruneExpiredNonces
    ├── session-blocklist.ts  # revokeSession, isSessionRevoked, pruneExpiredSessions
    ├── tracked-wallets.ts    # Wallet tracking queries
    └── watchlist-items.ts    # Watchlist CRUD queries
```

## Key Scripts

- `pnpm db:seed-referral` — Create or reset the DOJI100 system referral code (0/100 uses). Safe to run multiple times.

## Migration baseline

If the schema was created via `db:push` and you're switching to `db:migrate`, run `pnpm db:baseline` once to mark existing migrations as applied. This prevents "relation already exists" when running `db:migrate`.

CLI scripts (`baseline.ts`, `migrate.ts`) use `console.log`/`console.error` intentionally for stdout/stderr user output.

## Installation

```bash
pnpm add @doji/db
```

## Configuration

```typescript
// drizzle.config.ts
import { defineConfig } from "drizzle-kit";
import { normalizeConnectionUrl } from "./src/connection-url";

const raw = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL || "";
const dbUrl = raw ? normalizeConnectionUrl(raw) : "";

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: { url: dbUrl },
});
```

## Schema Definition

```typescript
// src/schema/users.ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  magicIssuer: text("magic_issuer").notNull().unique(),
  email: text("email").notNull(),
  walletAddress: text("wallet_address").notNull().unique(),
  safeAddress: text("safe_address"),
  encryptedCreds: text("encrypted_creds"), // JSON string of EncryptedData
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

## Database Client

The package uses **node-postgres** (`drizzle-orm/node-postgres`) by default, or **Neon serverless** (`@neondatabase/serverless`) when `VERCEL` is set and `DATABASE_URL` contains `neon.tech`. The connection URL is normalized via `normalizeConnectionUrl` (replaces `sslmode=require`/`prefer`/`verify-ca` with `verify-full`) to satisfy pg's security warning and future pg v9 behavior.

```typescript
// src/index.ts (simplified)
import { drizzle } from "drizzle-orm/node-postgres";
import { normalizeConnectionUrl } from "./connection-url";
import * as schema from "./schema";

const dbUrl = normalizeConnectionUrl(env.DATABASE_URL);
export const db = drizzle(dbUrl, { schema });
```

## Queries

### User Management

**`upsertUser`** - Insert or update user with conflict handling:

```typescript
import { upsertUser } from "@doji/db/queries/users";

const user = await upsertUser(db, {
  magicIssuer: "did:magic:...",
  email: "user@example.com",
  walletAddress: "0x...",
});
```

**Features:**

- Handles unique constraint conflicts on both `walletAddress` and `magicIssuer`
- Prioritizes wallet address over Magic issuer for user matching
- Transaction-based conflict resolution
- Handles race conditions during concurrent user creation
- Updates existing users when wallet or issuer changes

### Select

```typescript
import { db } from "@doji/db";
import { users } from "@doji/db/schema";
import { eq } from "drizzle-orm";

// Get all users
const allUsers = await db.select().from(users);

// Get by ID
const user = await db
  .select()
  .from(users)
  .where(eq(users.id, "user-123"));

// Get by wallet address
const userByWallet = await db
  .select()
  .from(users)
  .where(eq(users.walletAddress, "0x..."))
  .limit(1);
```

### Insert

```typescript
import { db } from "@doji/db";
import { users } from "@doji/db/schema";

const newUser = await db
  .insert(users)
  .values({
    magicIssuer: "did:magic:...",
    email: "user@example.com",
    walletAddress: "0x...",
    safeAddress: "0x...",
  })
  .returning();
```

### Update

```typescript
import { db } from "@doji/db";
import { users } from "@doji/db/schema";
import { eq } from "drizzle-orm";

await db
  .update(users)
  .set({ safeAddress: "0x...", updatedAt: new Date() })
  .where(eq(users.id, "user-123"));
```

### Delete

```typescript
import { db } from "@doji/db";
import { users } from "@doji/db/schema";
import { eq } from "drizzle-orm";

await db
  .delete(users)
  .where(eq(users.id, "user-123"));
```

## Transactions

```typescript
import { db } from "@doji/db";
import { users } from "@doji/db/schema";

await db.transaction(async (tx) => {
  const user = await tx
    .insert(users)
    .values({ 
      magicIssuer: "did:magic:...",
      email: "user@example.com",
      walletAddress: "0x..."
    })
    .returning();

  // Additional operations within the transaction
  await tx
    .update(users)
    .set({ safeAddress: "0x..." })
    .where(eq(users.id, user[0].id));
});
```

## Migrations

### Generate Migration

```bash
pnpm db:generate
```

Creates migration files in `src/migrations/`.

### Run Migrations

```bash
pnpm db:migrate
```

Applies pending migrations to the database.

### Push Schema (Development)

```bash
pnpm db:push
```

Pushes schema changes directly without creating migration files. Use for rapid development.

## Drizzle Studio

Visual database browser:

```bash
pnpm db:studio
```

Opens at `https://local.drizzle.studio`.

## Type Safety

Drizzle provides full type inference:

```typescript
import { db } from "@doji/db";
import { users } from "@doji/db/schema";

const result = await db.select().from(users);
// result is typed as Array<{ id: string; email: string; ... }>

const user = result[0];
// user.email is string
// user.walletAddress is string
// user.createdAt is Date
```

## Best Practices

1. **Schema Organization** — One file per table
2. **Timestamps** — Always include `createdAt` and `updatedAt`
3. **Indexes** — Add indexes for frequently queried columns
4. **Transactions** — Use transactions for multi-step operations
5. **Type Safety** — Leverage Drizzle's type inference
6. **Migrations** — Use migrations in production, push in development

## Environment Variables

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/poly
# Optional: Neon direct (non-pooled) for migrations; use sslmode=verify-full for Neon.
# DATABASE_URL_DIRECT=postgresql://...@...neon.tech/neondb?sslmode=verify-full
```

See `packages/env/src/server.ts` for validation. The connection URL is normalized (e.g. `sslmode=require` → `verify-full`) before use to silence pg-connection-string security warnings.

## Commands

```bash
pnpm db:push          # Push schema changes (development)
pnpm db:generate      # Generate migrations
pnpm db:migrate       # Run migrations (production)
pnpm db:studio        # Open Drizzle Studio
pnpm check-types      # TypeScript validation
pnpm test             # Run tests (CI mode)
pnpm test:watch       # Run tests in watch mode
```

## Finish the Task

- [ ] Run `pnpm fix` before committing.
- [ ] Update this AGENTS.md if you changed schema, queries, or migration workflow.
- [ ] Summarize changes in conventional commit form (e.g. `feat(db): ...`).

## Related

- [API Package](../api/AGENTS.md)
- [Server API](../../apps/server/AGENTS.md)
- [Types Package](../types/AGENTS.md)
- [Code Standards](../../.agents/code-standards.md)
