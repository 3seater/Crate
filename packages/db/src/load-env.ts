/**
 * Load env from apps/server/.env before @doji/env so migrations work when run from packages/db.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../../../apps/server/.env") });
