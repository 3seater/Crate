import { env } from "@doji/env/server";
import { neon } from "@neondatabase/serverless";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-http";
import { drizzle } from "drizzle-orm/node-postgres";

import { normalizeConnectionUrl } from "./connection-url";
import * as schema from "./schema";

// Neon HTTP mode on Vercel (fastest for serverless — no connection setup).
// Falls back to node-postgres for local dev / non-Neon databases.
const isNeonServerless =
  process.env.VERCEL && env.DATABASE_URL?.includes("neon.tech");

const dbUrl = normalizeConnectionUrl(env.DATABASE_URL);

export { sql } from "drizzle-orm";
export const db = isNeonServerless
  ? neonDrizzle(neon(dbUrl), { schema })
  : drizzle(dbUrl, { schema });

export {
  consumeDidTokenNonce,
  pruneExpiredNonces,
} from "./queries/did-token-nonces";
export {
  createUserWithReferral,
  findActiveReferralCode,
  getUserReferralCode,
  getUserReferralStats,
  isCodeReserved,
  listUserReferrals,
  seedSystemCode,
  updateUserReferralCode,
  validateReferralCodeForGate,
} from "./queries/referrals";
export {
  isSessionRevoked,
  pruneExpiredSessions,
  revokeSession,
} from "./queries/session-blocklist";
export {
  addTrackedWallet,
  countTrackedWallets,
  listTrackedWallets,
  removeTrackedWallet,
  updateTrackedWallet,
} from "./queries/tracked-wallets";
export {
  findUserById,
  findUserByIssuer,
  findUserByWallet,
  updateUser,
  upsertUser,
} from "./queries/users";
export {
  addWatchlistItem,
  clearWatchlistItems,
  countWatchlistItems,
  listWatchlistItems,
  normalizeWatchlistConditionId,
  removeWatchlistItem,
  toggleWatchlistItem,
} from "./queries/watchlist-items";
