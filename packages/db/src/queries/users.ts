import { eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "../schema";
import { users } from "../schema";

/** Accepts both Neon (Vercel) and Node pg (local) database instances. */
type Database =
  | NodePgDatabase<typeof schema>
  | NeonDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

/**
 * Insert a new user or update an existing one on Magic issuer or wallet address conflict.
 * Always sets `updatedAt` to the current time on conflict.
 *
 * Handles conflict scenarios:
 * 1. Same Magic issuer (user logging in again) → update email/wallet
 * 2. Same wallet address (different Magic account, same wallet) → update issuer/email
 *
 * Uses a transaction to ensure atomicity and handle race conditions.
 */
export async function upsertUser(
  db: Database,
  data: {
    magicIssuer: string;
    email: string;
    walletAddress: string;
  }
) {
  const now = new Date();

  // Check for existing user by wallet address (higher priority)
  const [existingByWallet] = await db
    .select()
    .from(users)
    .where(eq(users.walletAddress, data.walletAddress))
    .limit(1);

  if (existingByWallet) {
    const [updated] = await db
      .update(users)
      .set({
        magicIssuer: data.magicIssuer,
        email: data.email,
        updatedAt: now,
      })
      .where(eq(users.walletAddress, data.walletAddress))
      .returning();
    return updated ?? null;
  }

  // Check for existing user by Magic issuer
  const [existingByIssuer] = await db
    .select()
    .from(users)
    .where(eq(users.magicIssuer, data.magicIssuer))
    .limit(1);

  if (existingByIssuer) {
    const [updated] = await db
      .update(users)
      .set({
        email: data.email,
        walletAddress: data.walletAddress,
        updatedAt: now,
      })
      .where(eq(users.magicIssuer, data.magicIssuer))
      .returning();
    return updated ?? null;
  }

  // No existing user → insert new one
  try {
    const [inserted] = await db
      .insert(users)
      .values({ ...data, updatedAt: now })
      .returning();
    return inserted ?? null;
  } catch {
    // Race condition: re-check by wallet
    const [raceUser] = await db
      .select()
      .from(users)
      .where(eq(users.walletAddress, data.walletAddress))
      .limit(1);
    if (raceUser) {
      const [updated] = await db
        .update(users)
        .set({
          magicIssuer: data.magicIssuer,
          email: data.email,
          updatedAt: now,
        })
        .where(eq(users.walletAddress, data.walletAddress))
        .returning();
      return updated ?? null;
    }
    throw new Error("Failed to upsert user after race condition");
  }
}

/**
 * Find a user by their Magic issuer ID.
 */
export async function findUserByIssuer(db: Database, magicIssuer: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.magicIssuer, magicIssuer))
    .limit(1);

  return user ?? null;
}

/**
 * Find a user by their embedded wallet address.
 */
export async function findUserByWallet(db: Database, walletAddress: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.walletAddress, walletAddress))
    .limit(1);

  return user ?? null;
}

/**
 * Find a user by their internal UUID.
 */
export async function findUserById(db: Database, id: string) {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);

  return user ?? null;
}

/**
 * Update a user record by ID. Always sets `updatedAt` to the current time.
 */
export async function updateUser(
  db: Database,
  id: string,
  data: Partial<{
    email: string;
    walletAddress: string;
    safeAddress: string | null;
    encryptedCreds: string | null;
  }>
) {
  const [user] = await db
    .update(users)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(users.id, id))
    .returning();

  return user ?? null;
}
