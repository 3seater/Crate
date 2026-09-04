import {
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { referralCodes } from "./referral-codes";
import { users } from "./users";

/**
 * Historical codes after user edits.
 * Permanently blocks reuse of old codes (old_code globally unique).
 */
export const referralCodeAliases = pgTable(
  "referral_code_aliases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referralCodeId: uuid("referral_code_id")
      .notNull()
      .references(() => referralCodes.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    oldCode: text("old_code").notNull(),
    replacedAt: timestamp("replaced_at").defaultNow().notNull(),
  },
  (table) => [
    unique("referral_code_aliases_old_code_unique").on(table.oldCode),
    index("referral_code_aliases_referral_code_id_idx").on(
      table.referralCodeId
    ),
    index("referral_code_aliases_user_id_idx").on(table.userId),
  ]
);
