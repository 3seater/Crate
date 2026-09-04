/**
 * Tests for referral query module.
 *
 * Covers:
 * - Existing-user bypass (no referral needed for updates)
 * - New-user path: code validation, max-use enforcement, redemption binding
 * - Race safety: concurrent signup at limit boundary
 * - Alias non-reuse after code rename
 * - DOJI100 seed idempotency
 *
 * Requires a running PostgreSQL database. Skipped in CI where only placeholder DATABASE_URL is configured.
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { afterEach, describe, expect, it } from "vitest";
import {
  createUserWithReferral,
  findActiveReferralCode,
  getUserReferralCode,
  isCodeReserved,
  seedSystemCode,
  updateUserReferralCode,
  validateReferralCodeForGate,
} from "../../../packages/db/src/queries/referrals";
import * as schema from "../../../packages/db/src/schema";
import {
  referralCodeAliases,
  referralCodes,
  referralRedemptions,
} from "../../../packages/db/src/schema";
import { users } from "../../../packages/db/src/schema/users";
import { hasDatabase } from "../../helpers";

const LIMIT_REGEX = /limit/i;
const TAKEN_REGEX = /taken/i;

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/doji";

const db = drizzle(DATABASE_URL, { schema });

const suffix = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

async function createTestUser(s: string) {
  const [u] = await db
    .insert(users)
    .values({
      magicIssuer: `test-issuer-ref-${s}`,
      email: `ref-user-${s}@test.local`,
      walletAddress: `0x${"a".repeat(40 - s.slice(0, 20).length)}${s.slice(0, 20)}`,
      updatedAt: new Date(),
    })
    .returning();
  if (!u) {
    throw new Error("Failed to create test user");
  }
  return u;
}

async function createTestCode(code: string, maxUses: number | null = null) {
  const [r] = await db
    .insert(referralCodes)
    .values({
      userId: null,
      code,
      isActive: true,
      maxUses: maxUses ?? null,
      useCount: 0,
    })
    .onConflictDoNothing({ target: referralCodes.code })
    .returning();
  return r;
}

// Track created resources for cleanup
const createdUserIds: string[] = [];
const createdCodes: string[] = [];

afterEach(async () => {
  // Clean redemptions first (FK)
  for (const id of createdUserIds) {
    await db
      .delete(referralRedemptions)
      .where(eq(referralRedemptions.refereeUserId, id));
  }
  // Then aliases
  for (const id of createdUserIds) {
    await db
      .delete(referralCodeAliases)
      .where(eq(referralCodeAliases.userId, id));
  }
  // Then referral codes owned by test users
  for (const id of createdUserIds) {
    await db.delete(referralCodes).where(eq(referralCodes.userId, id));
  }
  // Then system test codes
  for (const code of createdCodes) {
    await db.delete(referralCodes).where(eq(referralCodes.code, code));
  }
  // Then users
  for (const id of createdUserIds) {
    await db.delete(users).where(eq(users.id, id));
  }
  createdUserIds.length = 0;
  createdCodes.length = 0;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabase)("Referral Queries", () => {
  // ──────────────────────────────────────────────────────────────────────────
  describe("seedSystemCode", () => {
    it("should seed a code with correct values", async () => {
      const code = `SEED${suffix().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
      createdCodes.push(code);
      await seedSystemCode(db, code, 100);
      const record = await findActiveReferralCode(db, code);
      expect(record).not.toBeNull();
      expect(record?.code).toBe(code);
      expect(record?.maxUses).toBe(100);
      expect(record?.useCount).toBe(0);
      expect(record?.userId).toBeNull();
    });

    it("should be idempotent — second call does not error or duplicate", async () => {
      const code = `SEED${suffix().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
      createdCodes.push(code);
      await seedSystemCode(db, code, 50);
      await seedSystemCode(db, code, 50); // second call — must not throw
      const record = await findActiveReferralCode(db, code);
      expect(record?.useCount).toBe(0);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("validateReferralCodeForGate", () => {
    it("should return valid: true for an active code with remaining uses", async () => {
      const code = `VAL${suffix().replace(/-/g, "").slice(0, 7).toUpperCase()}`;
      createdCodes.push(code);
      await createTestCode(code, 10);
      const result = await validateReferralCodeForGate(db, code);
      expect(result.valid).toBe(true);
    });

    it("should return valid: false for a nonexistent code", async () => {
      const result = await validateReferralCodeForGate(
        db,
        "DOES_NOT_EXIST_999"
      );
      expect(result.valid).toBe(false);
    });

    it("should return valid: false when use_count has reached max_uses", async () => {
      const code = `FULL${suffix().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
      createdCodes.push(code);
      // Insert code already at max
      await db.insert(referralCodes).values({
        userId: null,
        code,
        isActive: true,
        maxUses: 2,
        useCount: 2,
      });
      const result = await validateReferralCodeForGate(db, code);
      expect(result.valid).toBe(false);
      expect((result as { reason: string }).reason).toMatch(LIMIT_REGEX);
    });

    it("should return valid: true for an unlimited code (maxUses null)", async () => {
      const code = `UNL${suffix().replace(/-/g, "").slice(0, 7).toUpperCase()}`;
      createdCodes.push(code);
      await createTestCode(code, null);
      const result = await validateReferralCodeForGate(db, code);
      expect(result.valid).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("createUserWithReferral", () => {
    it("should create user and bind redemption, increment use_count", async () => {
      const code = `CRE${suffix().replace(/-/g, "").slice(0, 7).toUpperCase()}`;
      createdCodes.push(code);
      await createTestCode(code, 5);

      const s = suffix();
      const user = await createUserWithReferral(
        db,
        {
          magicIssuer: `issuer-crw-${s}`,
          email: `crw-${s}@test.local`,
          walletAddress: `0x${"b".repeat(20)}${s.replace(/-/g, "").slice(0, 20)}`,
        },
        code
      );
      createdUserIds.push(user.id);

      expect(user.id).toBeDefined();
      expect(user.email).toContain("crw-");

      // use_count incremented
      const record = await findActiveReferralCode(db, code);
      expect(record?.useCount).toBe(1);

      // redemption created
      const [redemption] = await db
        .select()
        .from(referralRedemptions)
        .where(eq(referralRedemptions.refereeUserId, user.id));
      expect(redemption).toBeDefined();
      expect(redemption?.code).toBe(code);
    });

    it("should reject when code is exhausted (max-use enforcement)", async () => {
      const code = `EXH${suffix().replace(/-/g, "").slice(0, 7).toUpperCase()}`;
      createdCodes.push(code);
      // Insert at max
      await db.insert(referralCodes).values({
        userId: null,
        code,
        isActive: true,
        maxUses: 1,
        useCount: 1,
      });

      const s = suffix();
      await expect(
        createUserWithReferral(
          db,
          {
            magicIssuer: `issuer-exh-${s}`,
            email: `exh-${s}@test.local`,
            walletAddress: `0x${"c".repeat(20)}${s.replace(/-/g, "").slice(0, 20)}`,
          },
          code
        )
      ).rejects.toThrow(LIMIT_REGEX);
    });

    it("should enforce max-use atomically under concurrent signups (race safety)", async () => {
      const code = `RACE${suffix().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
      createdCodes.push(code);
      await createTestCode(code, 3);

      // Launch 5 concurrent signups for a code with max 3 uses
      const attempts = Array.from({ length: 5 }, (_, i) => {
        const s = suffix();
        return createUserWithReferral(
          db,
          {
            magicIssuer: `issuer-race-${i}-${s}`,
            email: `race-${i}-${s}@test.local`,
            walletAddress: `0x${"d".repeat(15)}${String(i).padStart(5, "0")}${s.replace(/-/g, "").slice(0, 20)}`,
          },
          code
        )
          .then((u) => {
            createdUserIds.push(u.id);
            return { ok: true as const, id: u.id };
          })
          .catch((err: Error) => ({
            ok: false as const,
            message: err.message,
          }));
      });

      const results = await Promise.all(attempts);
      const successes = results.filter((r) => r.ok);
      const failures = results.filter((r) => !r.ok);

      expect(successes.length).toBeLessThanOrEqual(3);
      expect(failures.length).toBeGreaterThanOrEqual(2);

      // use_count must not exceed maxUses
      const record = await findActiveReferralCode(db, code);
      expect(record?.useCount).toBeLessThanOrEqual(3);
    }, 30_000);
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("updateUserReferralCode — alias non-reuse", () => {
    it("should archive old code to aliases and write new code", async () => {
      const user = await createTestUser(suffix());
      createdUserIds.push(user.id);

      const codeA = `ALIASA${suffix().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
      const codeB = `ALIASB${suffix().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
      createdCodes.push(codeA, codeB);

      // Set initial code
      await updateUserReferralCode(db, user.id, codeA);

      // Rename to codeB
      const updated = await updateUserReferralCode(db, user.id, codeB);
      expect(updated.code).toBe(codeB);

      // Old code archived as alias
      const [alias] = await db
        .select()
        .from(referralCodeAliases)
        .where(eq(referralCodeAliases.oldCode, codeA));
      expect(alias).toBeDefined();

      // codeA must be reserved (not reusable)
      expect(await isCodeReserved(db, codeA)).toBe(true);
    });

    it("should prevent reusing any previously owned code", async () => {
      const user = await createTestUser(suffix());
      createdUserIds.push(user.id);

      const codeA = `REUSEA${suffix().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
      const codeB = `REUSEB${suffix().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
      createdCodes.push(codeA, codeB);

      await updateUserReferralCode(db, user.id, codeA);
      await updateUserReferralCode(db, user.id, codeB);

      // Attempting to reclaim codeA should fail
      await expect(updateUserReferralCode(db, user.id, codeA)).rejects.toThrow(
        TAKEN_REGEX
      );
    });

    it("should prevent a second user from claiming an aliased code", async () => {
      const u1 = await createTestUser(suffix());
      const u2 = await createTestUser(suffix());
      createdUserIds.push(u1.id, u2.id);

      const codeA = `STEAL1${suffix().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
      const codeB = `STEAL2${suffix().replace(/-/g, "").slice(0, 4).toUpperCase()}`;
      createdCodes.push(codeA, codeB);

      // u1 sets codeA, then renames to codeB (archives codeA)
      await updateUserReferralCode(db, u1.id, codeA);
      await updateUserReferralCode(db, u1.id, codeB);

      // u2 tries to claim the retired codeA
      await expect(updateUserReferralCode(db, u2.id, codeA)).rejects.toThrow(
        TAKEN_REGEX
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  describe("getUserReferralCode", () => {
    it("should return null for a user with no code", async () => {
      const user = await createTestUser(suffix());
      createdUserIds.push(user.id);
      const record = await getUserReferralCode(db, user.id);
      expect(record).toBeNull();
    });

    it("should return the code after it is set", async () => {
      const user = await createTestUser(suffix());
      createdUserIds.push(user.id);

      const code = `GUC${suffix().replace(/-/g, "").slice(0, 7).toUpperCase()}`;
      createdCodes.push(code);

      await updateUserReferralCode(db, user.id, code);
      const record = await getUserReferralCode(db, user.id);
      expect(record).not.toBeNull();
      expect(record?.code).toBe(code);
    });
  });
});
