import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  magicIssuer: text("magic_issuer").notNull().unique(),
  email: text("email").notNull(),
  walletAddress: text("wallet_address").notNull().unique(),
  safeAddress: text("safe_address"),
  encryptedCreds: text("encrypted_creds"), // JSON string of EncryptedData
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
