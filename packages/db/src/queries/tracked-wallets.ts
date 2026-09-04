import { TRPCError } from "@trpc/server";
import { and, count, desc, eq } from "drizzle-orm";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";
import type { NeonDatabase } from "drizzle-orm/neon-serverless";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

import type * as schema from "../schema";
import { trackedWallets } from "../schema";

/** Accepts both Neon (Vercel) and Node pg (local) database instances. */
type Database =
  | NodePgDatabase<typeof schema>
  | NeonDatabase<typeof schema>
  | NeonHttpDatabase<typeof schema>;

const MAX_WALLETS_PER_USER = 50;

/**
 * Build a default label from a wallet address: first 6 + "..." + last 4 chars.
 */
function defaultLabel(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Add a tracked wallet for a user.
 *
 * Validates the 50-wallet limit inside a transaction, normalizes the address
 * to lowercase, and assigns a default label when none is provided.
 *
 * @throws TRPCError CONFLICT if the address is already tracked by this user
 * @throws TRPCError FORBIDDEN if the user already has 50 wallets
 */
export async function addTrackedWallet(
  db: Database,
  userId: string,
  address: string,
  label?: string
) {
  const normalizedAddress = address.toLowerCase();
  const walletLabel = label ?? defaultLabel(normalizedAddress);

  return await (async () => {
    // Check wallet count limit
    const [result] = await db
      .select({ value: count() })
      .from(trackedWallets)
      .where(eq(trackedWallets.userId, userId));

    const currentCount = result?.value ?? 0;

    if (currentCount >= MAX_WALLETS_PER_USER) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Maximum of 50 tracked wallets reached",
      });
    }

    // Attempt insert — unique constraint catches duplicates
    try {
      const [inserted] = await db
        .insert(trackedWallets)
        .values({
          userId,
          address: normalizedAddress,
          label: walletLabel,
        })
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
          message: "This wallet address is already tracked",
        });
      }
      throw err;
    }
  })();
}

/**
 * List all tracked wallets for a user, ordered by creation date descending.
 */
export async function listTrackedWallets(db: Database, userId: string) {
  return await db
    .select()
    .from(trackedWallets)
    .where(eq(trackedWallets.userId, userId))
    .orderBy(desc(trackedWallets.createdAt));
}

/**
 * Update the label of a tracked wallet.
 *
 * Returns the updated record, or null if the wallet doesn't exist
 * or doesn't belong to the requesting user.
 */
export async function updateTrackedWallet(
  db: Database,
  userId: string,
  walletId: string,
  label: string
) {
  const [updated] = await db
    .update(trackedWallets)
    .set({
      label,
      updatedAt: new Date(),
    })
    .where(
      and(eq(trackedWallets.id, walletId), eq(trackedWallets.userId, userId))
    )
    .returning();

  return updated ?? null;
}

/**
 * Remove a tracked wallet if it belongs to the requesting user.
 *
 * Returns true if a record was deleted, false otherwise.
 */
export async function removeTrackedWallet(
  db: Database,
  userId: string,
  walletId: string
) {
  const deleted = await db
    .delete(trackedWallets)
    .where(
      and(eq(trackedWallets.id, walletId), eq(trackedWallets.userId, userId))
    )
    .returning();

  return deleted.length > 0;
}

/**
 * Count the number of tracked wallets for a user.
 */
export async function countTrackedWallets(db: Database, userId: string) {
  const [result] = await db
    .select({ value: count() })
    .from(trackedWallets)
    .where(eq(trackedWallets.userId, userId));

  return result?.value ?? 0;
}
