/**
 * Property-based tests for watchlist-items query module.
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
  addWatchlistItem,
  countWatchlistItems,
  listWatchlistItems,
  removeWatchlistItem,
  toggleWatchlistItem,
} from "../../../packages/db/src/queries/watchlist-items";
import * as schema from "../../../packages/db/src/schema";
import { watchlistItems } from "../../../packages/db/src/schema";
import { users } from "../../../packages/db/src/schema/users";
import { hasDatabase } from "../../helpers";

// ---------------------------------------------------------------------------
// Database setup
// ---------------------------------------------------------------------------

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/doji";

const db = drizzle(DATABASE_URL, { schema });

let testUserId: string;

beforeAll(async () => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const [u1] = await db
    .insert(users)
    .values({
      magicIssuer: `test-issuer-wl-${suffix}`,
      email: `wl-user-${suffix}@test.local`,
      walletAddress: `0x${Buffer.from(`wl-${suffix}`).toString("hex").padEnd(40, "0").slice(0, 40)}`,
    })
    .returning();
  testUserId = u1?.id;
});

afterEach(async () => {
  await db.delete(watchlistItems).where(eq(watchlistItems.userId, testUserId));
});

afterAll(async () => {
  if (testUserId) {
    await db.delete(users).where(eq(users.id, testUserId));
  }
});

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Valid conditionId: hex string between 10 and 64 chars */
const conditionIdArb = fc.stringMatching(/^[0-9a-f]{10,64}$/);

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

describe.skipIf(!hasDatabase)("Watchlist Queries", () => {
  // Feature: watchlist-system, Property 1: Add returns a complete record
  describe("Property 1: Add returns a complete record", () => {
    /**
     * **Validates: Requirements 1.1, 2.1, 5.2**
     *
     * For any valid conditionId, adding a watchlist item returns a record
     * with id, userId, conditionId, createdAt, updatedAt.
     */
    it("returns a complete record for any valid conditionId", async () => {
      await fc.assert(
        fc.asyncProperty(conditionIdArb, async (conditionId) => {
          const result = await addWatchlistItem(db, testUserId, conditionId);

          expect(result.id).toBeDefined();
          expect(typeof result.id).toBe("string");
          expect(result.id.length).toBeGreaterThan(0);
          expect(result.userId).toBe(testUserId);
          expect(result.conditionId).toBe(conditionId);
          expect(result.createdAt).toBeInstanceOf(Date);
          expect(result.updatedAt).toBeInstanceOf(Date);

          // Clean up for next iteration
          await removeWatchlistItem(db, testUserId, conditionId);
        }),
        { numRuns: 100 }
      );
    }, 60_000);
  });

  // Feature: watchlist-system, Property 2: Duplicate condition ID prevention
  describe("Property 2: Duplicate condition ID prevention", () => {
    /**
     * **Validates: Requirements 1.2, 2.2**
     *
     * For any conditionId already in the watchlist, adding again throws CONFLICT
     * and the watchlist length remains unchanged.
     */
    it("rejects duplicate conditionId with CONFLICT", async () => {
      await fc.assert(
        fc.asyncProperty(conditionIdArb, async (conditionId) => {
          // First insert succeeds
          await addWatchlistItem(db, testUserId, conditionId);
          const countBefore = await countWatchlistItems(db, testUserId);

          // Second insert should fail with CONFLICT
          try {
            await addWatchlistItem(db, testUserId, conditionId);
            expect.unreachable("Expected CONFLICT error");
          } catch (err: unknown) {
            const e = err as { code?: string };
            expect(e.code).toBe("CONFLICT");
          }

          // Count unchanged
          const countAfter = await countWatchlistItems(db, testUserId);
          expect(countAfter).toBe(countBefore);

          // Clean up for next iteration
          await removeWatchlistItem(db, testUserId, conditionId);
        }),
        { numRuns: 100 }
      );
    }, 60_000);
  });

  // Feature: watchlist-system, Property 3: Watchlist limit enforcement
  describe("Property 3: Watchlist limit enforcement", () => {
    /**
     * **Validates: Requirements 1.4, 2.3**
     *
     * For any user at 200 items, adding another throws FORBIDDEN
     * and the count remains at 200.
     */
    it("rejects the 201st item with FORBIDDEN", async () => {
      // Insert 200 unique watchlist items
      for (let i = 0; i < 200; i++) {
        const cid = i.toString(16).padStart(10, "0");
        await addWatchlistItem(db, testUserId, cid);
      }

      // Build a set of existing conditionIds for fast lookup
      const existingIds = new Set(
        (await listWatchlistItems(db, testUserId)).map(
          (item) => item.conditionId
        )
      );

      await fc.assert(
        fc.asyncProperty(
          conditionIdArb.filter((cid) => !existingIds.has(cid)),
          async (conditionId) => {
            try {
              await addWatchlistItem(db, testUserId, conditionId);
              expect.unreachable("Expected FORBIDDEN error");
            } catch (err: unknown) {
              expect((err as { code: string }).code).toBe("FORBIDDEN");
            }

            const currentCount = await countWatchlistItems(db, testUserId);
            expect(currentCount).toBe(200);
          }
        ),
        { numRuns: 100 }
      );
    }, 120_000);
  });

  // Feature: watchlist-system, Property 4: Remove then absent
  describe("Property 4: Remove then absent", () => {
    /**
     * **Validates: Requirements 3.1**
     *
     * For any conditionId in the watchlist, removing it makes it absent
     * from the list and the list length decreases by one.
     */
    it("item disappears from list after removal", async () => {
      await fc.assert(
        fc.asyncProperty(conditionIdArb, async (conditionId) => {
          await addWatchlistItem(db, testUserId, conditionId);
          const countBefore = await countWatchlistItems(db, testUserId);

          const removed = await removeWatchlistItem(
            db,
            testUserId,
            conditionId
          );
          expect(removed).toBe(true);

          const countAfter = await countWatchlistItems(db, testUserId);
          expect(countAfter).toBe(countBefore - 1);

          const list = await listWatchlistItems(db, testUserId);
          const found = list.find((item) => item.conditionId === conditionId);
          expect(found).toBeUndefined();
        }),
        { numRuns: 100 }
      );
    }, 60_000);
  });

  // Feature: watchlist-system, Property 5: Idempotent delete
  describe("Property 5: Idempotent delete", () => {
    /**
     * **Validates: Requirements 3.2**
     *
     * For any conditionId NOT in the watchlist, removing succeeds
     * without error and the watchlist remains unchanged.
     */
    it("removing a non-existent conditionId succeeds without error", async () => {
      await fc.assert(
        fc.asyncProperty(conditionIdArb, async (conditionId) => {
          // Ensure the conditionId is not in the watchlist
          await removeWatchlistItem(db, testUserId, conditionId);

          const countBefore = await countWatchlistItems(db, testUserId);

          // Should not throw, returns false
          const removed = await removeWatchlistItem(
            db,
            testUserId,
            conditionId
          );
          expect(removed).toBe(false);

          const countAfter = await countWatchlistItems(db, testUserId);
          expect(countAfter).toBe(countBefore);
        }),
        { numRuns: 100 }
      );
    }, 60_000);
  });

  // Feature: watchlist-system, Property 6: Toggle round trip
  describe("Property 6: Toggle round trip", () => {
    /**
     * **Validates: Requirements 4.1, 4.2, 4.3**
     *
     * For any conditionId, toggle-add then toggle-remove restores
     * the original state.
     */
    it("toggle add then toggle remove restores original state", async () => {
      await fc.assert(
        fc.asyncProperty(conditionIdArb, async (conditionId) => {
          // Ensure clean state for this conditionId
          await removeWatchlistItem(db, testUserId, conditionId);

          const countBefore = await countWatchlistItems(db, testUserId);

          // First toggle: should add
          const first = await toggleWatchlistItem(db, testUserId, conditionId);
          expect(first.action).toBe("added");
          expect(first.item).toBeDefined();
          expect(first.item?.conditionId).toBe(conditionId);

          // Second toggle: should remove
          const second = await toggleWatchlistItem(db, testUserId, conditionId);
          expect(second.action).toBe("removed");

          // Count restored
          const countAfter = await countWatchlistItems(db, testUserId);
          expect(countAfter).toBe(countBefore);
        }),
        { numRuns: 100 }
      );
    }, 60_000);
  });

  // Feature: watchlist-system, Property 7: List sort order
  describe("Property 7: List sort order", () => {
    /**
     * **Validates: Requirements 5.1**
     *
     * For any N items, list returns N records sorted by createdAt DESC.
     */
    it("returns items sorted by createdAt descending", async () => {
      await fc.assert(
        fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (n) => {
          // Clean slate for this iteration
          await db
            .delete(watchlistItems)
            .where(eq(watchlistItems.userId, testUserId));

          const inserted: string[] = [];
          for (let i = 0; i < n; i++) {
            const cid = `${Date.now().toString(16)}${i.toString(16)}`.padStart(
              10,
              "0"
            );
            await addWatchlistItem(db, testUserId, cid);
            inserted.push(cid);
          }

          const list = await listWatchlistItems(db, testUserId);

          // Should have exactly n records
          expect(list.length).toBe(n);

          // Sorted by createdAt DESC
          for (let i = 0; i < list.length - 1; i++) {
            expect(list[i]?.createdAt.getTime()).toBeGreaterThanOrEqual(
              list[i + 1]?.createdAt.getTime()
            );
          }
        }),
        { numRuns: 100 }
      );
    }, 60_000);
  });
});
