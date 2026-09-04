/**
 * Programmatic migration runner for Drizzle migrations.
 * Can be imported and used in server startup or CI/CD pipelines.
 *
 * Usage:
 *   - Via drizzle-kit: `pnpm db:migrate`
 *   - Programmatically: `import { runMigrations } from "@doji/db/migrate"`
 *
 * Note: console.log/console.error are intentional for CLI user output (stdout/stderr).
 */

import "./load-env";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "@doji/env/server";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { normalizeConnectionUrl } from "./connection-url";
import * as schema from "./schema";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Run all pending migrations.
 * Prefer DATABASE_URL_DIRECT (Neon direct connection) when set.
 * @throws Error if migrations fail
 */
export async function runMigrations() {
  const raw = env.DATABASE_URL_DIRECT ?? env.DATABASE_URL;
  const db = drizzle(normalizeConnectionUrl(raw), { schema });

  console.log("Running database migrations...");

  try {
    await migrate(db, {
      migrationsFolder: join(__dirname, "migrations"),
    });

    console.log("✓ Migrations completed successfully");
  } catch (error) {
    console.error("✗ Migration failed:", error);
    throw error;
  }
}

// Allow running directly: `node --loader tsx packages/db/src/migrate.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
