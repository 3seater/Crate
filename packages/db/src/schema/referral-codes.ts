import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Canonical referral code records.
 * Stores both system codes (e.g. DOJI100, user_id = null) and user-owned codes.
 * One active code per user (unique user_id; Postgres allows multiple NULLs).
 */
export const referralCodes = pgTable(
  "referral_codes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** null for global/system codes (e.g. DOJI100) */
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "cascade",
    }),
    code: text("code").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    /** null = unlimited uses */
    maxUses: integer("max_uses"),
    useCount: integer("use_count").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("referral_codes_code_unique").on(table.code),
    unique("referral_codes_user_id_unique").on(table.userId),
    index("referral_codes_user_id_idx").on(table.userId),
    check("referral_codes_use_count_nonneg", sql`${table.useCount} >= 0`),
    check(
      "referral_codes_max_uses_positive",
      sql`${table.maxUses} IS NULL OR ${table.maxUses} > 0`
    ),
    check(
      "referral_codes_use_count_limit",
      sql`${table.maxUses} IS NULL OR ${table.useCount} <= ${table.maxUses}`
    ),
  ]
);
