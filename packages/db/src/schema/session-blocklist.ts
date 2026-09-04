import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Revoked JWT session tokens.
 * On logout, the token's jti is inserted here.
 * The auth middleware rejects any token whose jti is in this table.
 * Rows expire naturally after the token's exp timestamp.
 */
export const sessionBlocklist = pgTable("session_blocklist", {
  jti: text("jti").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  revokedAt: timestamp("revoked_at").defaultNow().notNull(),
});
