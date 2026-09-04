# 16 — Database Changes

> **Phase:** 0/5 (foundations + polish) · **Risk:** Low · **Status:** 🔴 Not started
>
> Schema additions, TTL indexes, cleanup cron, connection pattern, and column conventions for V2.
> No structural changes to existing tables — all additive.

---

## Table of Contents

- [Current Schema Inventory](#current-schema-inventory)
- [Schema Additions](#schema-additions)
- [TTL Indexes](#ttl-indexes)
- [Cleanup Cron](#cleanup-cron)
- [Connection Pattern](#connection-pattern)
- [Identity Column Convention](#identity-column-convention)
- [Credential Column Cleanup](#credential-column-cleanup)
- [Migration Execution](#migration-execution)
- [Timeline](#timeline)

---

## Current Schema Inventory

8 tables across `packages/db/src/schema/`.

### `users` (`users.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, `defaultRandom()` |
| `magic_issuer` | `text` | NOT NULL, UNIQUE |
| `email` | `text` | NOT NULL |
| `wallet_address` | `text` | NOT NULL, UNIQUE |
| `safe_address` | `text` | nullable |
| `encrypted_creds` | `text` | nullable — JSON string of `{ciphertext, iv, tag}` (AES-256-GCM) |
| `created_at` | `timestamp` | NOT NULL, `defaultNow()` |
| `updated_at` | `timestamp` | NOT NULL, `defaultNow()` |

### `session_blocklist` (`session-blocklist.ts`)

Revoked JWT session tokens. Auth middleware rejects any token whose jti is in this table.

| Column | Type | Constraints |
|--------|------|-------------|
| `jti` | `text` | PK |
| `expires_at` | `timestamp` | NOT NULL |
| `revoked_at` | `timestamp` | NOT NULL, `defaultNow()` |

### `did_token_nonces` (`did-token-nonces.ts`)

DID token replay prevention. Each `tid` from a Magic DID token is recorded on first use.

| Column | Type | Constraints |
|--------|------|-------------|
| `tid` | `text` | PK |
| `expires_at` | `timestamp` | NOT NULL |
| `used_at` | `timestamp` | NOT NULL, `defaultNow()` |

### `referral_codes` (`referral-codes.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, `defaultRandom()` |
| `user_id` | `uuid` | nullable, FK → `users.id` (CASCADE), UNIQUE |
| `code` | `text` | NOT NULL, UNIQUE |
| `is_active` | `boolean` | NOT NULL, default `true` |
| `max_uses` | `integer` | nullable |
| `use_count` | `integer` | NOT NULL, default `0` |
| `created_at` | `timestamp` | NOT NULL, `defaultNow()` |
| `updated_at` | `timestamp` | NOT NULL, `defaultNow()` |

Check constraints: `use_count >= 0`, `max_uses IS NULL OR max_uses > 0`, `use_count <= max_uses`.
Indexes: `referral_codes_user_id_idx`.

### `referral_redemptions` (`referral-redemptions.ts`)

Immutable attribution ledger — one permanent attribution per referee.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, `defaultRandom()` |
| `referral_code_id` | `uuid` | NOT NULL, FK → `referral_codes.id` |
| `referrer_user_id` | `uuid` | nullable, FK → `users.id` (SET NULL) |
| `referee_user_id` | `uuid` | NOT NULL, FK → `users.id` (CASCADE), UNIQUE |
| `code` | `text` | NOT NULL — snapshot at redemption time |
| `source` | `text` | NOT NULL, default `'login_gate'` |
| `created_at` | `timestamp` | NOT NULL, `defaultNow()` |

Indexes: `referral_redemptions_referrer_id_idx`, `referral_redemptions_code_id_idx`.

### `referral_code_aliases` (`referral-code-aliases.ts`)

Historical codes after user edits. Permanently blocks reuse of old codes.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, `defaultRandom()` |
| `referral_code_id` | `uuid` | NOT NULL, FK → `referral_codes.id` (CASCADE) |
| `user_id` | `uuid` | NOT NULL, FK → `users.id` (CASCADE) |
| `old_code` | `text` | NOT NULL, UNIQUE |
| `replaced_at` | `timestamp` | NOT NULL, `defaultNow()` |

Indexes: `referral_code_aliases_referral_code_id_idx`, `referral_code_aliases_user_id_idx`.

### `watchlist_items` (`watchlist-items.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, `defaultRandom()` |
| `user_id` | `uuid` | NOT NULL, FK → `users.id` (CASCADE) |
| `condition_id` | `text` | NOT NULL |
| `created_at` | `timestamp` | NOT NULL, `defaultNow()` |
| `updated_at` | `timestamp` | NOT NULL, `defaultNow()` |

Unique: `(user_id, condition_id)`. Index: `watchlist_items_user_id_idx`.

### `tracked_wallets` (`tracked-wallets.ts`)

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | `uuid` | PK, `defaultRandom()` |
| `user_id` | `uuid` | NOT NULL, FK → `users.id` (CASCADE) |
| `address` | `text` | NOT NULL |
| `label` | `text` | NOT NULL |
| `created_at` | `timestamp` | NOT NULL, `defaultNow()` |
| `updated_at` | `timestamp` | NOT NULL, `defaultNow()` |

Unique: `(user_id, address)`. Index: `tracked_wallets_user_id_idx`.

---

## Schema Additions

### 1. `users.archivedAt` — Soft Delete

Add a nullable timestamp column for soft-deleting users. `NULL` = active, non-null = archived.

**Drizzle schema change** (`packages/db/src/schema/users.ts`):

```ts
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  magicIssuer: text("magic_issuer").notNull().unique(),
  email: text("email").notNull(),
  walletAddress: text("wallet_address").notNull().unique(),
  safeAddress: text("safe_address"),
  encryptedCreds: text("encrypted_creds"),
  archivedAt: timestamp("archived_at"),  // ← NEW: soft delete
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
```

**Generated migration SQL:**

```sql
ALTER TABLE "users" ADD COLUMN "archived_at" timestamp;
```

**Query updates required:**

All user queries that should exclude archived users need a `WHERE archived_at IS NULL` filter. Files to update:

| File | Function | Change |
|------|----------|--------|
| `packages/db/src/queries/users.ts` | `findUserByIssuer()` | Add `.where(isNull(users.archivedAt))` |
| `packages/db/src/queries/users.ts` | `findUserByWallet()` | Add `.where(isNull(users.archivedAt))` |
| `packages/db/src/queries/users.ts` | `findUserById()` | Add `.where(isNull(users.archivedAt))` |
| `apps/server/src/features/auth/router.ts` | `auth.me` | Already reads via `findUserById` — covered |

**New query helper:**

```ts
// packages/db/src/queries/users.ts
export async function archiveUser(db: Database, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ archivedAt: sql`NOW()` })
    .where(eq(users.id, userId));
}
```

---

## TTL Indexes

Both `session_blocklist` and `did_token_nonces` grow without bound. TTL indexes speed up the cleanup cron's `DELETE WHERE expires_at < NOW()` queries.

### `session_blocklist.expires_at`

```sql
CREATE INDEX CONCURRENTLY idx_session_blocklist_expires_at
  ON "session_blocklist" ("expires_at");
```

**Drizzle schema change** (`packages/db/src/schema/session-blocklist.ts`):

```ts
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const sessionBlocklist = pgTable(
  "session_blocklist",
  {
    jti: text("jti").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    revokedAt: timestamp("revoked_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_session_blocklist_expires_at").on(table.expiresAt),
  ],
);
```

### `did_token_nonces.expires_at`

```sql
CREATE INDEX CONCURRENTLY idx_did_token_nonces_expires_at
  ON "did_token_nonces" ("expires_at");
```

**Drizzle schema change** (`packages/db/src/schema/did-token-nonces.ts`):

```ts
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const didTokenNonces = pgTable(
  "did_token_nonces",
  {
    tid: text("tid").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_did_token_nonces_expires_at").on(table.expiresAt),
  ],
);
```

**Note:** `CREATE INDEX CONCURRENTLY` is the safe way to add indexes on a live database — it doesn't lock the table. Drizzle's `db:generate` produces a standard `CREATE INDEX`; for production, manually edit the generated SQL to add `CONCURRENTLY` before running `db:migrate`, or run the SQL directly via `psql` / Neon SQL Editor.

---

## Cleanup Cron

Vercel scheduled function to prune expired sessions and nonces. Runs daily.

### File: `apps/web/src/app/api/cron/cleanup/route.ts`

```ts
import { db, pruneExpiredNonces, pruneExpiredSessions } from "@doji/db";
import { env } from "@doji/env/web";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await pruneExpiredSessions(db);
  await pruneExpiredNonces(db);

  return NextResponse.json({ ok: true });
}
```

### Environment variable

Add `CRON_SECRET` to `packages/env/src/web.ts`:

```ts
CRON_SECRET: z.string().min(16).optional(),
```

Also add to `apps/web/.env.example`:

```
# Vercel Cron secret — auto-injected by Vercel when crons are configured
CRON_SECRET=
```

**Note:** Vercel automatically injects `CRON_SECRET` when you configure crons in `vercel.json`. The route handler validates the `Authorization: Bearer <CRON_SECRET>` header to prevent unauthorized access.

### Vercel cron config

Add to `apps/web/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

Runs daily at 3:00 AM UTC. Adjust frequency based on table growth — for low-traffic apps, daily is sufficient. For high-traffic, consider every 6 hours (`0 */6 * * *`).

### Existing prune functions

Already implemented in `packages/db/src/queries/`:

- `pruneExpiredSessions(db)` — `DELETE FROM session_blocklist WHERE expires_at < NOW()`
- `pruneExpiredNonces(db)` — `DELETE FROM did_token_nonces WHERE expires_at < NOW()`

Both are already exported from `packages/db/src/index.ts`. No new query code needed.

---

## Connection Pattern

V2.md §15 specifies using Neon's HTTP driver for regular queries and WebSocket for transactions. The current implementation already uses the WebSocket `Pool` driver via `@neondatabase/serverless` on Vercel.

### Current (`packages/db/src/index.ts`)

```ts
const isNeonServerless =
  process.env.VERCEL && env.DATABASE_URL?.includes("neon.tech");

export const db = isNeonServerless
  ? neonDrizzle(new Pool({ connectionString: dbUrl }), { schema })
  : drizzle(dbUrl, { schema });
```

Uses `Pool` (WebSocket) for all queries on Vercel. This works but is suboptimal — HTTP is faster for single non-interactive queries in serverless.

### V2 Target (`packages/db/src/index.ts`)

```ts
import { env } from "@doji/env/server";
import { neon, Pool } from "@neondatabase/serverless";
import { drizzle as neonHttpDrizzle } from "drizzle-orm/neon-http";
import { drizzle as neonWsDrizzle } from "drizzle-orm/neon-serverless";
import { drizzle as pgDrizzle } from "drizzle-orm/node-postgres";

import { normalizeConnectionUrl } from "./connection-url";
import * as schema from "./schema";

const dbUrl = normalizeConnectionUrl(env.DATABASE_URL);
const isNeon = process.env.VERCEL && dbUrl.includes("neon.tech");

// HTTP client — fastest for single, non-interactive queries in serverless
// WebSocket pool — required for transactions (multi-statement sessions)
// node-postgres — local development fallback
export const db = isNeon
  ? neonHttpDrizzle(neon(dbUrl), { schema })
  : pgDrizzle(dbUrl, { schema });

export const dbTx = isNeon
  ? neonWsDrizzle(new Pool({ connectionString: dbUrl }), { schema })
  : pgDrizzle(dbUrl, { schema });
```

**Usage rules:**

| Operation | Client | Why |
|-----------|--------|-----|
| Single query (SELECT, INSERT, UPDATE, DELETE) | `db` (HTTP) | Fastest for serverless — no connection setup overhead |
| Transaction (`db.transaction(...)`) | `dbTx` (WebSocket) | HTTP mode does not support multi-statement interactive sessions |
| Local development | Both resolve to `node-postgres` | Same driver, no distinction needed |

**Migration:** Update callers that use `db.transaction(...)` to use `dbTx.transaction(...)` instead. Search for `db.transaction` across the codebase:

```bash
grep -r "db\.transaction" apps/server/src packages/db/src --include="*.ts"
```

### Export changes

Add `dbTx` to `packages/db/src/index.ts` exports. Update `packages/db/package.json` if needed.

---

## Identity Column Convention

For all **new** tables, use `generatedByDefaultAsIdentity()` instead of `serial()`.

### Why

- `serial` is PostgreSQL-specific legacy shorthand that implicitly creates a sequence
- Identity columns follow the SQL standard (SQL:2003) and give explicit control over the sequence
- `generatedByDefaultAsIdentity()` allows explicit ID inserts (needed for seed scripts and test fixtures)
- `generatedAlwaysAsIdentity()` is stricter — DB owns the sequence, no manual inserts

### Convention

```ts
// ✅ V2 convention — new tables only
id: integer("id").primaryKey().generatedByDefaultAsIdentity(),

// ❌ Legacy — don't add new serial columns
id: serial("id").primaryKey(),

// ✅ Also acceptable — UUID primary keys (current convention for most tables)
id: uuid("id").defaultRandom().primaryKey(),
```

### When

- **New tables:** Use `generatedByDefaultAsIdentity()` for integer PKs, or `uuid().defaultRandom()` for UUID PKs
- **Existing tables:** Do NOT migrate existing `serial` columns — the risk/effort ratio is not worth it for a cosmetic change

---

## Credential Column Cleanup

Drop `users.encrypted_creds` after the credential migration (doc 07) Phase C is complete and stable in production.

### Prerequisites

- [07 — Credential Migration](./07-credential-migration.md) Phase C must be complete
- 100% client-side credential derivation confirmed for 2+ weeks
- Zero `server-stored` fallbacks in production analytics

### Drizzle schema change

Remove from `packages/db/src/schema/users.ts`:

```diff
 export const users = pgTable("users", {
   id: uuid("id").defaultRandom().primaryKey(),
   magicIssuer: text("magic_issuer").notNull().unique(),
   email: text("email").notNull(),
   walletAddress: text("wallet_address").notNull().unique(),
   safeAddress: text("safe_address"),
-  encryptedCreds: text("encrypted_creds"),
   archivedAt: timestamp("archived_at"),
   createdAt: timestamp("created_at").defaultNow().notNull(),
   updatedAt: timestamp("updated_at").defaultNow().notNull(),
 });
```

### Migration SQL

```sql
ALTER TABLE "users" DROP COLUMN "encrypted_creds";
```

### Additional cleanup

After dropping the column, also remove:
- `EncryptedCredentials` type from `@doji/types` (if orphaned)
- Credential-related test: `tests/unit/clob-v2-credential-roundtrip.property.test.ts`
- All 18 config/docs files referencing `CREDENTIAL_ENCRYPTION_KEY` (listed in doc 07)

---

## Migration Execution

Standard Drizzle workflow for all schema changes in this doc.

### Development (push)

```bash
# 1. Edit schema files in packages/db/src/schema/
# 2. Push directly to dev database (no migration files)
pnpm db:push
```

### Production (generate + migrate)

```bash
# 1. Edit schema files in packages/db/src/schema/
# 2. Generate migration SQL
pnpm db:generate

# 3. Review generated SQL in packages/db/drizzle/
#    - For TTL indexes: manually add CONCURRENTLY to CREATE INDEX statements
#    - For column drops: verify the correct column is being dropped

# 4. Run migration
pnpm db:migrate
```

### Order of operations

Apply schema changes in this order to avoid dependency issues:

1. **TTL indexes** — safe, additive, no schema change
2. **`users.archivedAt`** — additive column, nullable, no breaking change
3. **Cleanup cron** — depends on TTL indexes for performance but works without them
4. **Connection pattern** — code change only, no schema change
5. **Credential column drop** — destructive, must wait for doc 07 Phase C

---

## Timeline

| Item | Effort | Dependencies | Phase |
|------|--------|-------------|-------|
| TTL indexes (session-blocklist + did-token-nonces) | 1 hour | None | 0 |
| `users.archivedAt` column + query updates | 2 hours | None | 0 |
| Cleanup cron (route + vercel.json + env) | 2 hours | TTL indexes (for perf) | 0 |
| Connection pattern (HTTP + WebSocket split) | 3 hours | None — can do anytime | 0 |
| Identity column convention | 0 hours | N/A — convention for future tables only | — |
| Credential column drop | 1 hour | Doc 07 Phase C complete | 5 |

**Total active work:** ~1 day (excluding the credential column drop which is blocked by doc 07).

### Dependencies on other V2 docs

| Doc | Dependency |
|-----|-----------|
| [07 — Credential Migration](./07-credential-migration.md) | Credential column drop (Phase D) blocked until Phase C is stable |
| [03 — Session Model](./03-session-model.md) | `archivedAt` soft delete may interact with session validation — verify `auth.me` excludes archived users |
| [10 — Feature Flags](./10-feature-flags.md) | `CRON_SECRET` env var must be added to Vercel project settings |
