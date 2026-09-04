/**
 * Mark existing migrations as applied without running them.
 * Use when schema was created via `db:push` and you're switching to `db:migrate`.
 *
 * Run once: `pnpm db:baseline`
 *
 * Note: console.log/console.error are intentional for CLI user output (stdout/stderr).
 */

import "./load-env";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@doji/env/server";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import { normalizeConnectionUrl } from "./connection-url";

const __dirname = dirname(fileURLToPath(import.meta.url));

async function baseline() {
  const raw = env.DATABASE_URL_DIRECT ?? env.DATABASE_URL;
  if (!raw) {
    throw new Error("DATABASE_URL or DATABASE_URL_DIRECT is required");
  }
  const db = drizzle(normalizeConnectionUrl(raw));

  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS drizzle`);
  await db.execute(sql`
		CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
			id SERIAL PRIMARY KEY,
			hash TEXT NOT NULL,
			created_at BIGINT NOT NULL
		)
	`);

  const journalPath = join(__dirname, "migrations", "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: Array<{ when: number; tag: string }>;
  };

  console.log("Baseline: marking migrations as applied...");

  for (const entry of journal.entries) {
    const existing = await db.execute(
      sql`SELECT 1 FROM drizzle.__drizzle_migrations WHERE created_at = ${entry.when} LIMIT 1`
    );
    if (existing.rows.length > 0) {
      console.log(`  - ${entry.tag} already applied (skipped)`);
      continue;
    }
    await db.execute(
      sql`INSERT INTO drizzle.__drizzle_migrations (created_at, hash) VALUES (${entry.when}, 'baseline')`
    );
    console.log(`  ✓ ${entry.tag} (when: ${entry.when})`);
  }

  console.log(
    "✓ Baseline complete. Run `pnpm db:migrate` to apply any new migrations."
  );
}

baseline()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
