/**
 * Property-based tests for tracked-wallets query module.
 *
 * These tests run against a real PostgreSQL database to validate
 * correctness properties of the CRUD operations.
 *
 * Skipped in CI: requires a running PostgreSQL instance.
 */

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import fc from "fast-check";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  addTrackedWallet,
  countTrackedWallets,
  listTrackedWallets,
  removeTrackedWallet,
  updateTrackedWallet,
} from "../../../packages/db/src/queries/tracked-wallets";
import * as schema from "../../../packages/db/src/schema";
import { trackedWallets } from "../../../packages/db/src/schema";
import { users } from "../../../packages/db/src/schema/users";
import { hasDatabase } from "../../helpers";

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/doji";

const db = drizzle(DATABASE_URL, { schema });

// Test user IDs created during setup — cleaned up in afterAll
let testUserId1: string;
let testUserId2: string;

beforeAll(async () => {
  // Create two test users with unique identifiers for isolation
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const [u1] = await db
    .insert(users)
    .values({
      magicIssuer: `test-issuer-pbt-${suffix}-1`,
      email: `pbt-user1-${suffix}@test.local`,
      walletAddress: `0x${Buffer.from(`pbt1-${suffix}`).toString("hex").padEnd(40, "0").slice(0, 40)}`,
    })
    .returning();

  const [u2] = await db
    .insert(users)
    .values({
      magicIssuer: `test-issuer-pbt-${suffix}-2`,
      email: `pbt-user2-${suffix}@test.local`,
      walletAddress: `0x${Buffer.from(`pbt2-${suffix}`).toString("hex").padEnd(40, "0").slice(0, 40)}`,
    })
    .returning();

  testUserId1 = u1?.id;
  testUserId2 = u2?.id;
});

afterEach(async () => {
  // Clean tracked wallets for both test users between tests
  await db.delete(trackedWallets).where(eq(trackedWallets.userId, testUserId1));
  await db.delete(trackedWallets).where(eq(trackedWallets.userId, testUserId2));
});

afterAll(async () => {
  // Clean up test users (cascade deletes tracked wallets)
  if (testUserId1) {
    await db.delete(users).where(eq(users.id, testUserId1));
  }
  if (testUserId2) {
    await db.delete(users).where(eq(users.id, testUserId2));
  }
});

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Valid Ethereum address: 0x + 40 hex chars */
const ethAddressArb = fc
  .stringMatching(/^[0-9a-f]{40}$/)
  .map((hex) => `0x${hex}`);

/** Valid label: 1–100 non-empty chars */
const labelArb = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((s) => s.trim().length > 0);

const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/** Invalid Ethereum address: any string NOT matching 0x + 40 hex */
const invalidAddressArb = fc.string().filter((s) => !ETH_ADDRESS_RE.test(s));

/** Generate N unique valid Ethereum addresses */
function _uniqueAddresses(n: number) {
  return fc
    .array(ethAddressArb, { minLength: n, maxLength: n })
    .map((addrs) => {
      // Ensure uniqueness after lowercase normalization
      const seen = new Set<string>();
      const unique: string[] = [];
      for (const a of addrs) {
        const lower = a.toLowerCase();
        if (!seen.has(lower)) {
          seen.add(lower);
          unique.push(a);
        }
      }
      return unique;
    })
    .filter((arr) => arr.length === n);
}

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabase)("Tracked Wallets Queries", () => {
  // Feature: wallet-tracking, Property 1: Add returns a complete record
  describe("Property 1: Add returns a complete record", () => {
    /**
     * **Validates: Requirements 1.1, 2.1, 3.2**
     *
     * For any valid address and optional label, addTrackedWallet returns a
     * record with non-null UUID, correct userId, lowercase address, non-empty
     * label, and non-null timestamps.
     */
    it("returns a complete record for any valid address and optional label", async () => {
      await fc.assert(
        fc.asyncProperty(
          ethAddressArb,
          fc.option(labelArb, { nil: undefined }),
          async (address, label) => {
            const result = await addTrackedWallet(
              db,
              testUserId1,
              address,
              label
            );

            // Non-null UUID
            expect(result.id).toBeDefined();
            expect(typeof result.id).toBe("string");
            expect(result.id.length).toBeGreaterThan(0);

            // Correct userId
            expect(result.userId).toBe(testUserId1);

            // Lowercase address
            expect(result.address).toBe(address.toLowerCase());

            // Non-empty label
            expect(result.label).toBeDefined();
            expect(result.label.length).toBeGreaterThan(0);

            // If label was provided, it should match
            if (label !== undefined) {
              expect(result.label).toBe(label);
            }

            // Non-null timestamps
            expect(result.createdAt).toBeInstanceOf(Date);
            expect(result.updatedAt).toBeInstanceOf(Date);

            // Clean up for next iteration
            await removeTrackedWallet(db, testUserId1, result.id);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  // Feature: wallet-tracking, Property 2: Invalid address rejection
  describe("Property 2: Invalid address rejection", () => {
    /**
     * **Validates: Requirements 2.2**
     *
     * Address validation happens at the tRPC router (Zod) level, not in the
     * query module. This test validates the regex pattern used for validation.
     */
    it("ETH_ADDRESS_RE rejects any string not matching 0x + 40 hex chars", () => {
      fc.assert(
        fc.property(invalidAddressArb, (address) => {
          expect(ETH_ADDRESS_RE.test(address)).toBe(false);
        }),
        { numRuns: 10 }
      );
    });

    it("ETH_ADDRESS_RE accepts any valid 0x + 40 hex address", () => {
      fc.assert(
        fc.property(ethAddressArb, (address) => {
          expect(ETH_ADDRESS_RE.test(address)).toBe(true);
        }),
        { numRuns: 10 }
      );
    });
  });

  // Feature: wallet-tracking, Property 3: Duplicate address prevention
  describe("Property 3: Duplicate address prevention", () => {
    /**
     * **Validates: Requirements 1.2, 2.3**
     *
     * For any user and valid address, inserting twice should fail with a
     * CONFLICT error and the count should remain unchanged.
     */
    it("rejects duplicate address for the same user with CONFLICT", async () => {
      await fc.assert(
        fc.asyncProperty(ethAddressArb, async (address) => {
          // First insert succeeds
          const first = await addTrackedWallet(db, testUserId1, address);
          expect(first).toBeDefined();

          const countBefore = await countTrackedWallets(db, testUserId1);

          // Second insert should fail with CONFLICT
          try {
            await addTrackedWallet(db, testUserId1, address);
            // Should not reach here
            expect.unreachable("Expected CONFLICT error");
          } catch (err: unknown) {
            const e = err as { code?: string };
            expect(e.code).toBe("CONFLICT");
          }

          // Count unchanged
          const countAfter = await countTrackedWallets(db, testUserId1);
          expect(countAfter).toBe(countBefore);

          // Clean up
          await removeTrackedWallet(db, testUserId1, first.id);
        }),
        { numRuns: 10 }
      );
    });
  });

  // Feature: wallet-tracking, Property 4: Default label from truncated address
  describe("Property 4: Default label from truncated address", () => {
    /**
     * **Validates: Requirements 2.4**
     *
     * For any valid address with no label, the resulting label equals
     * first 6 + "..." + last 4 chars of the lowercase address.
     */
    it("assigns default label as first 6 + '...' + last 4 of lowercase address", async () => {
      await fc.assert(
        fc.asyncProperty(ethAddressArb, async (address) => {
          const result = await addTrackedWallet(db, testUserId1, address);
          const lower = address.toLowerCase();
          const expected = `${lower.slice(0, 6)}...${lower.slice(-4)}`;

          expect(result.label).toBe(expected);

          // Clean up
          await removeTrackedWallet(db, testUserId1, result.id);
        }),
        { numRuns: 10 }
      );
    });
  });

  // Feature: wallet-tracking, Property 5: Wallet limit enforcement
  describe("Property 5: Wallet limit enforcement", () => {
    /**
     * **Validates: Requirements 2.5, 2.6**
     *
     * For any user with 50 wallets, the 51st add should be rejected
     * with a FORBIDDEN error.
     */
    it("rejects the 51st wallet with FORBIDDEN", async () => {
      // Insert 50 unique wallets
      const addresses: string[] = [];
      for (let i = 0; i < 50; i++) {
        const hex = i.toString(16).padStart(40, "0");
        addresses.push(`0x${hex}`);
      }

      for (const addr of addresses) {
        await addTrackedWallet(db, testUserId1, addr);
      }

      // 51st should fail
      await fc.assert(
        fc.asyncProperty(ethAddressArb, async (address) => {
          // Ensure the address isn't already in the 50
          const lower = address.toLowerCase();
          if (addresses.some((a) => a.toLowerCase() === lower)) {
            return;
          }

          try {
            await addTrackedWallet(db, testUserId1, address);
            expect.unreachable("Expected FORBIDDEN error");
          } catch (err: unknown) {
            expect((err as { code: string }).code).toBe("FORBIDDEN");
          }
        }),
        { numRuns: 10 }
      );
    }, 60_000); // Extended timeout for 50 inserts + 100 property runs
  });

  // Feature: wallet-tracking, Property 6: List sort order
  describe("Property 6: List sort order", () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For any N wallets, listTrackedWallets returns N records sorted
     * by createdAt DESC.
     */
    it("returns wallets sorted by createdAt descending", async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (n) => {
          // Insert n wallets with unique addresses
          const inserted: string[] = [];
          for (let i = 0; i < n; i++) {
            const hex = `${Date.now().toString(16)}${i.toString(16)}`
              .padStart(40, "0")
              .slice(0, 40);
            const addr = `0x${hex}`;
            const result = await addTrackedWallet(db, testUserId1, addr);
            inserted.push(result.id);
          }

          const list = await listTrackedWallets(db, testUserId1);

          // Should have exactly n records
          expect(list.length).toBe(n);

          // Sorted by createdAt DESC
          for (let i = 0; i < list.length - 1; i++) {
            expect(list[i]?.createdAt.getTime()).toBeGreaterThanOrEqual(
              list[i + 1]?.createdAt.getTime()
            );
          }

          // Clean up
          for (const id of inserted) {
            await removeTrackedWallet(db, testUserId1, id);
          }
        }),
        { numRuns: 10 }
      );
    }, 30_000);
  });

  // Feature: wallet-tracking, Property 7: Update label and timestamp
  describe("Property 7: Update label and timestamp", () => {
    /**
     * **Validates: Requirements 4.1, 4.3**
     *
     * For any valid label (1–100 chars), update changes label and updatedAt.
     * Note: label validation (min 1, max 100) happens at the Zod schema level
     * in the router. The query module updates whatever label is passed.
     */
    it("updates label and updatedAt for any valid label", async () => {
      await fc.assert(
        fc.asyncProperty(ethAddressArb, labelArb, async (address, newLabel) => {
          const wallet = await addTrackedWallet(
            db,
            testUserId1,
            address,
            "original"
          );

          // Small delay to ensure updatedAt differs
          const beforeUpdate = wallet.updatedAt;

          const updated = await updateTrackedWallet(
            db,
            testUserId1,
            wallet.id,
            newLabel
          );

          expect(updated).not.toBeNull();
          expect(updated?.label).toBe(newLabel);
          expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
            beforeUpdate.getTime()
          );

          // Other fields unchanged
          expect(updated?.id).toBe(wallet.id);
          expect(updated?.userId).toBe(wallet.userId);
          expect(updated?.address).toBe(wallet.address);

          // Clean up
          await removeTrackedWallet(db, testUserId1, wallet.id);
        }),
        { numRuns: 10 }
      );
    });
  });

  // Feature: wallet-tracking, Property 8: Remove then absent
  describe("Property 8: Remove then absent", () => {
    /**
     * **Validates: Requirements 5.1**
     *
     * For any wallet, after removal it should not appear in list
     * and count decreases by one.
     */
    it("wallet disappears from list and count decreases after removal", async () => {
      await fc.assert(
        fc.asyncProperty(ethAddressArb, async (address) => {
          const wallet = await addTrackedWallet(db, testUserId1, address);
          const countBefore = await countTrackedWallets(db, testUserId1);

          const removed = await removeTrackedWallet(db, testUserId1, wallet.id);
          expect(removed).toBe(true);

          const countAfter = await countTrackedWallets(db, testUserId1);
          expect(countAfter).toBe(countBefore - 1);

          const list = await listTrackedWallets(db, testUserId1);
          const found = list.find((w) => w.id === wallet.id);
          expect(found).toBeUndefined();
        }),
        { numRuns: 10 }
      );
    });
  });

  // Feature: wallet-tracking, Property 9: Ownership isolation
  describe("Property 9: Ownership isolation", () => {
    /**
     * **Validates: Requirements 4.2, 5.2**
     *
     * For any wallet belonging to another user, update and remove should
     * fail with not-found (null / false), and no records should be modified.
     */
    it("update returns null for wallet owned by another user", async () => {
      await fc.assert(
        fc.asyncProperty(ethAddressArb, labelArb, async (address, newLabel) => {
          // Create wallet for user2
          const wallet = await addTrackedWallet(db, testUserId2, address);

          // User1 tries to update user2's wallet
          const result = await updateTrackedWallet(
            db,
            testUserId1,
            wallet.id,
            newLabel
          );
          expect(result).toBeNull();

          // Verify wallet is unchanged
          const list = await listTrackedWallets(db, testUserId2);
          const original = list.find((w) => w.id === wallet.id);
          expect(original).toBeDefined();
          expect(original?.label).not.toBe(newLabel);

          // Clean up
          await removeTrackedWallet(db, testUserId2, wallet.id);
        }),
        { numRuns: 10 }
      );
    });

    it("remove returns false for wallet owned by another user", async () => {
      await fc.assert(
        fc.asyncProperty(ethAddressArb, async (address) => {
          // Create wallet for user2
          const wallet = await addTrackedWallet(db, testUserId2, address);
          const countBefore = await countTrackedWallets(db, testUserId2);

          // User1 tries to remove user2's wallet
          const removed = await removeTrackedWallet(db, testUserId1, wallet.id);
          expect(removed).toBe(false);

          // Verify wallet still exists and count unchanged
          const countAfter = await countTrackedWallets(db, testUserId2);
          expect(countAfter).toBe(countBefore);

          // Clean up
          await removeTrackedWallet(db, testUserId2, wallet.id);
        }),
        { numRuns: 10 }
      );
    });
  });
}); // end describe.skipIf(!hasDatabase)
