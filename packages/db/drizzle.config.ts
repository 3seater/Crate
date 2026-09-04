import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

import { normalizeConnectionUrl } from "./src/connection-url";

// Load apps/server/.env from config file location (not cwd) so db:push works from any cwd and on Windows
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", "..", "apps", "server", ".env") });

// Only DATABASE_URL (and optional DATABASE_URL_DIRECT) needed for schema push; avoid requiring full server env
const raw = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? "";
const dbUrl = raw ? normalizeConnectionUrl(raw) : "";

if (!dbUrl) {
  throw new Error(
    "DATABASE_URL is required for db:push. Copy apps/server/.env.example to apps/server/.env and set DATABASE_URL."
  );
}

export default defineConfig({
  schema: "./src/schema",
  out: "./src/migrations",
  dialect: "postgresql",
  dbCredentials: { url: dbUrl },
});
