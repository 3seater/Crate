/**
 * Seed or reset the DOJI100 system referral code.
 *
 * - Creates the code if it doesn't exist (max 100 uses).
 * - Resets use_count to 0 if it already exists.
 *
 * Run: `pnpm db:seed-referral`
 */

import "./load-env";
import { env } from "@doji/env/server";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import { normalizeConnectionUrl } from "./connection-url";
import { referralCodes } from "./schema";

const CODE = "DOJI100";
const MAX_USES = 100;

async function main() {
  const raw = env.DATABASE_URL_DIRECT ?? env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL or DATABASE_URL_DIRECT is required");
  }
  const db = drizzle(normalizeConnectionUrl(raw));

  const [existing] = await db
    .select()
    .from(referralCodes)
    .where(eq(referralCodes.code, CODE))
    .limit(1);

  if (existing) {
    await db
      .update(referralCodes)
      .set({ useCount: 0, isActive: true, updatedAt: new Date() })
      .where(eq(referralCodes.id, existing.id));
    console.log(
      `✓ Reset ${CODE}: use_count 0/${MAX_USES} (was ${existing.useCount}/${existing.maxUses})`
    );
  } else {
    await db.insert(referralCodes).values({
      userId: null,
      code: CODE,
      isActive: true,
      maxUses: MAX_USES,
      useCount: 0,
    });
    console.log(`✓ Created ${CODE}: 0/${MAX_USES} uses`);
  }

  await db.execute(sql`SELECT 1`).then(() => process.exit(0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
