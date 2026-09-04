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
 * Immutable attribution ledger — created on first successful new-account login.
 * One permanent attribution per referee (unique referee_user_id).
 */
export const referralRedemptions = pgTable(
  "referral_redemptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referralCodeId: uuid("referral_code_id")
      .notNull()
      .references(() => referralCodes.id),
    /** null for system/global codes */
    referrerUserId: uuid("referrer_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    refereeUserId: uuid("referee_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Snapshot of the code at redemption time */
    code: text("code").notNull(),
    /** Origination context (e.g. login_gate, referral_link) */
    source: text("source").default("login_gate").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("referral_redemptions_referee_unique").on(table.refereeUserId),
    index("referral_redemptions_referrer_id_idx").on(table.referrerUserId),
    index("referral_redemptions_code_id_idx").on(table.referralCodeId),
  ]
);
