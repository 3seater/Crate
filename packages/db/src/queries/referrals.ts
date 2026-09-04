import { and, count, eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "../schema";
import {
  referralCodeAliases,
  referralCodes,
  referralRedemptions,
  users,
} from "../schema";

/** Accepts both Neon (Vercel) and Node pg (local) database instances. */
type Database =
  | NodePgDatabase<typeof schema>
  | NeonDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

// ─── Code lookup ─────────────────────────────────────────────────────────────

/**
 * Find an active referral code record by code string.
 * Only matches referral_codes — does NOT match aliases (retired codes).
 */
export async function findActiveReferralCode(db: Database, code: string) {
  const [row] = await db
    .select()
    .from(referralCodes)
    .where(and(eq(referralCodes.code, code), eq(referralCodes.isActive, true)))
    .limit(1);
  return row ?? null;
}

/**
 * Check whether a code string is permanently reserved (exists in referral_codes OR aliases).
 * Used to prevent reuse when a user edits their code.
 */
export async function isCodeReserved(
  db: Database,
  code: string
): Promise<boolean> {
  const [inCodes] = await db
    .select({ id: referralCodes.id })
    .from(referralCodes)
    .where(eq(referralCodes.code, code))
    .limit(1);

  if (inCodes) {
    return true;
  }

  const [inAliases] = await db
    .select({ id: referralCodeAliases.id })
    .from(referralCodeAliases)
    .where(eq(referralCodeAliases.oldCode, code))
    .limit(1);

  return Boolean(inAliases);
}

// ─── Gate validation ──────────────────────────────────────────────────────────

/**
 * Validate that a code is active and has remaining uses.
 * Does NOT consume usage — call createUserWithReferral for atomic consume.
 *
 * Returns the code record on success, or an error reason string.
 */
export async function validateReferralCodeForGate(
  db: Database,
  code: string
): Promise<
  | { valid: true; codeRecord: typeof referralCodes.$inferSelect }
  | { valid: false; reason: string }
> {
  const record = await findActiveReferralCode(db, code);

  if (!record) {
    return { valid: false, reason: "Invalid or expired referral code" };
  }

  if (record.maxUses !== null && record.useCount >= record.maxUses) {
    return {
      valid: false,
      reason: "This referral code has reached its usage limit",
    };
  }

  return { valid: true, codeRecord: record };
}

// ─── Atomic user creation + referral bind ─────────────────────────────────────

/**
 * Create a new user and bind referral redemption atomically.
 * Uses SELECT ... FOR UPDATE on the referral_codes row to serialize concurrent signups.
 *
 * Enforces:
 * - Code must be active and have remaining uses
 * - use_count increment + redemption record creation happen in the same transaction as user insert
 *
 * @throws Error if code is invalid, exhausted, or race condition exceeds the limit
 */
export async function createUserWithReferral(
  db: Database,
  userData: { magicIssuer: string; email: string; walletAddress: string },
  referralCode: string
): Promise<typeof users.$inferSelect> {
  // Validate referral code (no FOR UPDATE — neon-http doesn't support transactions)
  const codeRecord = await findActiveReferralCode(db, referralCode);

  if (!codeRecord) {
    throw new Error("Invalid or expired referral code");
  }

  if (
    codeRecord.maxUses !== null &&
    codeRecord.useCount >= codeRecord.maxUses
  ) {
    throw new Error("This referral code has reached its usage limit");
  }

  // Insert user — handle race condition where concurrent login created the user
  const now = new Date();
  let newUser: typeof users.$inferSelect | undefined;
  try {
    const [inserted] = await db
      .insert(users)
      .values({ ...userData, updatedAt: now })
      .returning();
    newUser = inserted;
  } catch {
    // Unique constraint: user was created concurrently — look them up
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.magicIssuer, userData.magicIssuer))
      .limit(1);
    newUser = existing;
  }

  if (!newUser) {
    throw new Error("Failed to create user record");
  }

  // Increment use_count — use conditional update to guard against race conditions
  const [updated] = await db
    .update(referralCodes)
    .set({ useCount: sql`${referralCodes.useCount} + 1`, updatedAt: now })
    .where(
      and(
        eq(referralCodes.id, codeRecord.id),
        eq(referralCodes.isActive, true),
        codeRecord.maxUses === null
          ? sql`true`
          : sql`${referralCodes.useCount} < ${codeRecord.maxUses}`
      )
    )
    .returning();

  if (!updated) {
    throw new Error("This referral code has reached its usage limit");
  }

  // Create redemption record
  await db.insert(referralRedemptions).values({
    referralCodeId: codeRecord.id,
    referrerUserId: codeRecord.userId ?? null,
    refereeUserId: newUser.id,
    code: referralCode,
    source: "login_gate",
  });

  return newUser;
}

// ─── User code management ─────────────────────────────────────────────────────

/**
 * Get the current active referral code for a user.
 * Returns null if the user has no code yet.
 */
export async function getUserReferralCode(db: Database, userId: string) {
  const [row] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.userId, userId))
    .limit(1);
  return row ?? null;
}

/**
 * Create or update a user's referral code.
 * - If the user has an existing code, archives it to referral_code_aliases first.
 * - Enforces global uniqueness: new code must not exist in referral_codes OR aliases.
 * - Returns the new code record.
 *
 * @throws Error if newCode is already reserved globally
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: multi-step transactional referral code update with alias management — complexity is inherent to the business logic
export async function updateUserReferralCode(
  db: Database,
  userId: string,
  newCode: string
): Promise<typeof referralCodes.$inferSelect> {
  const now = new Date();

  // Check global uniqueness (both tables)
  const reserved = await isCodeReserved(db, newCode);
  if (reserved) {
    throw new Error("Referral code is already taken");
  }

  // Get existing code
  const [existing] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.userId, userId))
    .limit(1);

  if (existing) {
    // Archive old code to aliases
    await db.insert(referralCodeAliases).values({
      referralCodeId: existing.id,
      userId,
      oldCode: existing.code,
      replacedAt: now,
    });

    // Update existing row with new code — handle race condition on unique constraint
    try {
      const [updated] = await db
        .update(referralCodes)
        .set({ code: newCode, updatedAt: now })
        .where(eq(referralCodes.id, existing.id))
        .returning();

      if (!updated) {
        throw new Error("Failed to update referral code");
      }
      return updated;
    } catch (err: unknown) {
      const pgCode =
        typeof err === "object" && err !== null
          ? ("code" in err && (err as { code: string }).code) ||
            ("cause" in err &&
              typeof (err as { cause: unknown }).cause === "object" &&
              (err as { cause: { code?: string } }).cause?.code)
          : undefined;
      if (pgCode === "23505") {
        throw new Error("Referral code is already taken");
      }
      throw err;
    }
  }

  // No existing code — create new
  try {
    const [created] = await db
      .insert(referralCodes)
      .values({ userId, code: newCode, isActive: true })
      .returning();

    if (!created) {
      throw new Error("Failed to create referral code");
    }
    return created;
  } catch (err: unknown) {
    const pgCode =
      typeof err === "object" && err !== null
        ? ("code" in err && (err as { code: string }).code) ||
          ("cause" in err &&
            typeof (err as { cause: unknown }).cause === "object" &&
            (err as { cause: { code?: string } }).cause?.code)
        : undefined;
    if (pgCode === "23505") {
      throw new Error("Referral code is already taken");
    }
    throw err;
  }
}

// ─── Stats + dashboard ────────────────────────────────────────────────────────

/**
 * Referral stats for a user: total referrals and their aggregate volume (placeholder 0 until trade data is wired).
 */
export async function getUserReferralStats(db: Database, userId: string) {
  const codeRecord = await getUserReferralCode(db, userId);

  if (!codeRecord) {
    return { totalReferrals: 0, totalVolume: 0 };
  }

  const [stats] = await db
    .select({ totalReferrals: count(referralRedemptions.id) })
    .from(referralRedemptions)
    .where(eq(referralRedemptions.referrerUserId, userId));

  return {
    totalReferrals: stats?.totalReferrals ?? 0,
    totalVolume: 0, // Wired to trade data in Phase 2
  };
}

/**
 * List all users referred by a given user (via their active referral code).
 */
export async function listUserReferrals(db: Database, userId: string) {
  return await db
    .select({
      refereeUserId: referralRedemptions.refereeUserId,
      code: referralRedemptions.code,
      source: referralRedemptions.source,
      createdAt: referralRedemptions.createdAt,
      email: users.email,
      walletAddress: users.walletAddress,
    })
    .from(referralRedemptions)
    .innerJoin(users, eq(referralRedemptions.refereeUserId, users.id))
    .where(eq(referralRedemptions.referrerUserId, userId))
    .orderBy(referralRedemptions.createdAt);
}

// ─── System seed ─────────────────────────────────────────────────────────────

/**
 * Seed the DOJI100 system code if it does not already exist.
 * Safe to call multiple times (idempotent).
 */
export async function seedSystemCode(
  db: Database,
  code: string,
  maxUses: number
): Promise<void> {
  await db
    .insert(referralCodes)
    .values({ userId: null, code, isActive: true, maxUses, useCount: 0 })
    .onConflictDoNothing({ target: referralCodes.code });
}
