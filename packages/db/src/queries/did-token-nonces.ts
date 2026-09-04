import { lt, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../schema";
import { didTokenNonces } from "../schema";

type Database =
  | NodePgDatabase<typeof schema>
  | NeonDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

/**
 * Attempt to consume a DID token nonce (tid).
 *
 * Returns true if the tid was new and successfully recorded (token is valid to use).
 * Returns false if the tid already exists (replay attack — reject the token).
 *
 * Uses INSERT ... ON CONFLICT DO NOTHING to handle concurrent requests atomically.
 */
export async function consumeDidTokenNonce(
  db: Database,
  tid: string,
  expiresAt: Date
): Promise<boolean> {
  const result = await db
    .insert(didTokenNonces)
    .values({ tid, expiresAt })
    .onConflictDoNothing({ target: didTokenNonces.tid })
    .returning();

  return result.length > 0;
}

/**
 * Delete expired nonces. Safe to call periodically (e.g. on each login request).
 */
export async function pruneExpiredNonces(db: Database): Promise<void> {
  await db
    .delete(didTokenNonces)
    .where(lt(didTokenNonces.expiresAt, sql`NOW()`));
}
