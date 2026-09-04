import { resolve } from "node:path";
import dotenv from "dotenv";

// Load server env so @doji/env validation passes during integration tests
dotenv.config({ path: resolve(process.cwd(), "apps/server/.env") });

// Snapshot which required env vars are present BEFORE we set placeholders.
// Tests use these flags (via helpers.ts) to skip when infrastructure is missing.
const SERVER_ENV_KEYS = [
  "MAGIC_SECRET_KEY",
  "CREDENTIAL_ENCRYPTION_KEY",
  "JWT_SESSION_SECRET",
  "DATABASE_URL",
  "CORS_ORIGIN",
  "POLYMARKET_BUILDER_ID",
  "POLYMARKET_BUILDER_PASSPHRASE",
];

(globalThis as Record<string, unknown>).__TEST_HAS_SERVER_ENV =
  SERVER_ENV_KEYS.every(
    (k) => typeof process.env[k] === "string" && process.env[k] !== ""
  );

const dbUrl = process.env.DATABASE_URL ?? "";
(globalThis as Record<string, unknown>).__TEST_HAS_DATABASE =
  dbUrl.startsWith("postgresql://") &&
  !dbUrl.includes("__ci_") &&
  !dbUrl.includes("placeholder");

// In CI (or when .env is empty), set placeholder values for required server
// env vars so @t3-oss/env-core validation passes at module-load time.
// Integration tests that actually need real credentials should guard
// themselves with `hasServerEnv` from helpers.ts.
const placeholders: Record<string, string> = {
  MAGIC_SECRET_KEY: "test-placeholder",
  CREDENTIAL_ENCRYPTION_KEY:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  JWT_SESSION_SECRET: "test-placeholder-jwt-secret-at-least-32-chars-long",
  DATABASE_URL: "postgresql://localhost:5432/__ci_test_placeholder__",
  CORS_ORIGIN: "http://localhost:3000",
  POLYMARKET_BUILDER_ID: "test-placeholder",
  POLYMARKET_BUILDER_SIGNING_KEY: "test-placeholder",
  POLYMARKET_BUILDER_PASSPHRASE: "test-placeholder",
  POLY_BUILDER_CODE:
    "0x0000000000000000000000000000000000000000000000000000000000000001",
  ENSO_API_KEY: "test-placeholder",
};

for (const [key, value] of Object.entries(placeholders)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
