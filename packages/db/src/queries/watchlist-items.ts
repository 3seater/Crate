import { TRPCError } from "@trpc/server";
import { and, count, desc, eq, sql } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "../schema";
import { watchlistItems } from "../schema";

/** Accepts both Neon (Vercel) and Node pg (local) database instances. */
type Database =
  | NodePgDatabase<typeof schema>
  | NeonDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

const WATCHLIST_LIMIT = 200;

/** Canonical form for Polymarket condition IDs (hex is case-insensitive; Gamma mixes casing). */
export function normalizeWatchlistConditionId(conditionId: string): string {
  return conditionId.trim().toLowerCase();
}

function conditionIdEqualsNormalized(
  column: typeof watchlistItems.conditionId,
  normalized: string
) {
  return sql`lower(${column}) = ${normalized}`;
}

/**
 * Add a watchlist item for a user.
 *
 * Validates the 200-item limit inside a transaction.
 *
 * @throws TRPCError CONFLICT if the conditionId is already watchlisted by this user
 * @throws TRPCError FORBIDDEN if the user already has 200 watchlist items
 */
export async function addWatchlistItem(
  db: Database,
  userId: string,
  conditionId: string
) {
  const cid = normalizeWatchlistConditionId(conditionId);
  return await (async () => {
    // Check watchlist count limit
    const [result] = await db
      .select({ value: count() })
      .from(watchlistItems)
      .where(eq(watchlistItems.userId, userId));

    const currentCount = result?.value ?? 0;

    if (currentCount >= WATCHLIST_LIMIT) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Maximum of 200 watchlist items reached",
      });
    }

    // Attempt insert — unique constraint catches duplicates
    try {
      const [inserted] = await db
        .insert(watchlistItems)
        .values({ userId, conditionId: cid })
        .returning();

      // biome-ignore lint/style/noNonNullAssertion: insert always returns a row with .returning()
      return inserted!;
    } catch (err: unknown) {
      // Postgres unique violation code (may be wrapped by Drizzle)
      const pgCode =
        typeof err === "object" && err !== null
          ? ("code" in err && (err as { code: string }).code) ||
            ("cause" in err &&
              typeof (err as { cause: unknown }).cause === "object" &&
              (err as { cause: { code?: string } }).cause?.code)
          : undefined;

      if (pgCode === "23505") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This market is already in your watchlist",
        });
      }
      throw err;
    }
  })();
}

/**
 * Remove a watchlist item by userId + conditionId.
 *
 * Idempotent — returns true if a record was deleted, false if it didn't exist.
 */
export async function removeWatchlistItem(
  db: Database,
  userId: string,
  conditionId: string
) {
  const cid = normalizeWatchlistConditionId(conditionId);
  const deleted = await db
    .delete(watchlistItems)
    .where(
      and(
        eq(watchlistItems.userId, userId),
        conditionIdEqualsNormalized(watchlistItems.conditionId, cid)
      )
    )
    .returning();

  return deleted.length > 0;
}

/**
 * Toggle a watchlist item: add if absent, remove if present.
 *
 * Returns the action taken ("added" or "removed") and the item if added.
 */
export async function toggleWatchlistItem(
  db: Database,
  userId: string,
  conditionId: string
) {
  const cid = normalizeWatchlistConditionId(conditionId);
  const [existing] = await db
    .select()
    .from(watchlistItems)
    .where(
      and(
        eq(watchlistItems.userId, userId),
        conditionIdEqualsNormalized(watchlistItems.conditionId, cid)
      )
    )
    .limit(1);

  if (existing) {
    await db.delete(watchlistItems).where(eq(watchlistItems.id, existing.id));
    return { action: "removed" as const };
  }

  const item = await addWatchlistItem(db, userId, cid);
  return { action: "added" as const, item };
}

/**
 * List all watchlist items for a user, ordered by creation date descending.
 */
export async function listWatchlistItems(db: Database, userId: string) {
  return await db
    .select()
    .from(watchlistItems)
    .where(eq(watchlistItems.userId, userId))
    .orderBy(desc(watchlistItems.createdAt));
}

/**
 * Count the number of watchlist items for a user.
 */
export async function countWatchlistItems(db: Database, userId: string) {
  const [result] = await db
    .select({ value: count() })
    .from(watchlistItems)
    .where(eq(watchlistItems.userId, userId));

  return result?.value ?? 0;
}

/**
 * Remove all watchlist items for a user.
 *
 * Returns the number of items removed. Idempotent.
 */
export async function clearWatchlistItems(db: Database, userId: string) {
  const deleted = await db
    .delete(watchlistItems)
    .where(eq(watchlistItems.userId, userId))
    .returning();

  return deleted.length;
}
