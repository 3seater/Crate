import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * DID token nonce store — prevents replay attacks on Magic DID tokens.
 *
 * Each `tid` (token ID) from a Magic DID token is recorded on first use.
 * Subsequent presentations of the same token are rejected.
 * Rows expire naturally after the token's `ext` (expiry) timestamp.
 *
 * Cleanup: run `DELETE FROM did_token_nonces WHERE expires_at < NOW()` periodically.
 */
export const didTokenNonces = pgTable("did_token_nonces", {
  tid: text("tid").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at").defaultNow().notNull(),
});
