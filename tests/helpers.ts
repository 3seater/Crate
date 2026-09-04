/**
 * Shared test utilities.
 *
 * Usage: import { createId, hasServerEnv, hasDatabase } from "../helpers" (from any test file)
 */

/** Generate a deterministic fake ID for test fixtures. */
export function createId(prefix = "test", n = 1): string {
  return `${prefix}_${String(n).padStart(6, "0")}`;
}

/**
 * Whether the required server environment variables were present
 * BEFORE setup.ts injected placeholders. Set by setup.ts via globalThis.
 * False in CI where secrets are not injected.
 */
export const hasServerEnv: boolean =
  (globalThis as Record<string, unknown>).__TEST_HAS_SERVER_ENV === true;

/**
 * Whether a real PostgreSQL database URL was configured BEFORE
 * setup.ts injected placeholders. Set by setup.ts via globalThis.
 * False in CI where only a placeholder DATABASE_URL is provided.
 */
export const hasDatabase: boolean =
  (globalThis as Record<string, unknown>).__TEST_HAS_DATABASE === true;
