import { lt, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../schema";
import { sessionBlocklist } from "../schema";

type Database =
  | NodePgDatabase<typeof schema>
  | NeonDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

/** Add a jti to the blocklist (called on logout). */
export async function revokeSession(
  db: Database,
  jti: string,
  expiresAt: Date
): Promise<void> {
  await db
    .insert(sessionBlocklist)
    .values({ jti, expiresAt })
    .onConflictDoNothing({ target: sessionBlocklist.jti });
}

/** Returns true if the jti has been revoked. */
export async function isSessionRevoked(
  db: Database,
  jti: string
): Promise<boolean> {
  const [row] = await db
    .select({ jti: sessionBlocklist.jti })
    .from(sessionBlocklist)
    .where(sql`${sessionBlocklist.jti} = ${jti}`)
    .limit(1);
  return Boolean(row);
}

/** Delete expired blocklist entries. */
export async function pruneExpiredSessions(db: Database): Promise<void> {
  await db
    .delete(sessionBlocklist)
    .where(lt(sessionBlocklist.expiresAt, sql`NOW()`));
}
