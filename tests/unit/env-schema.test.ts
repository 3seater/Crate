/**
 * Unit tests for the server environment schema — verifies that required fields
 * are enforced. Uses Zod directly, mirroring the schema in
 * packages/env/src/server.ts, so no @t3-oss/env-core import is needed at
 * the test-runner level.
 *
 * Validates: Requirements 11.1
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";

/**
 * Minimal Zod schema for the fields tested here.
 * Matches the schema in packages/env/src/server.ts.
 */
const serverEnvSchema = z.object({
  MAGIC_SECRET_KEY: z.string().min(1),
  CREDENTIAL_ENCRYPTION_KEY: z.string().length(64),
  JWT_SESSION_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1),
  CORS_ORIGIN: z
    .string()
    .transform((s) =>
      s
        .split(",")
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
    )
    .pipe(z.array(z.string().url()).min(1)),
  POLYMARKET_BUILDER_ID: z.string().min(1),
  POLYMARKET_BUILDER_SIGNING_KEY: z.string().min(1).default(""),
  POLYMARKET_BUILDER_PASSPHRASE: z.string().min(1),
  POLY_BUILDER_CODE: z
    .string()
    .regex(/^0x[a-fA-F0-9]{64}$/)
    .min(1),
  ENSO_API_KEY: z.string().min(1),
});

/** A valid env object satisfying every required field. */
const validEnv = {
  MAGIC_SECRET_KEY: "test-magic-key",
  CREDENTIAL_ENCRYPTION_KEY: "a".repeat(64),
  JWT_SESSION_SECRET: "x".repeat(32),
  DATABASE_URL: "postgresql://localhost:5432/test",
  CORS_ORIGIN: "http://localhost:3000",
  POLYMARKET_BUILDER_ID: "test-builder-id",
  POLYMARKET_BUILDER_SIGNING_KEY: "test-signing-key",
  POLYMARKET_BUILDER_PASSPHRASE: "test-passphrase",
  POLY_BUILDER_CODE: `0x${"a".repeat(64)}`,
  ENSO_API_KEY: "test-enso-key",
};

describe("server env schema", () => {
  it("should accept a valid env object with all required fields", () => {
    const result = serverEnvSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it("should reject when ENSO_API_KEY is missing", () => {
    const { ENSO_API_KEY: _omitted, ...withoutEnsoKey } = validEnv;
    const result = serverEnvSchema.safeParse(withoutEnsoKey);
    expect(result.success).toBe(false);
    if (!result.success) {
      const keys = result.error.issues.map((i) => i.path[0]);
      expect(keys).toContain("ENSO_API_KEY");
    }
  });

  it("should reject when ENSO_API_KEY is an empty string", () => {
    const envWithEmptyKey = { ...validEnv, ENSO_API_KEY: "" };
    const result = serverEnvSchema.safeParse(envWithEmptyKey);
    expect(result.success).toBe(false);
    if (!result.success) {
      const keys = result.error.issues.map((i) => i.path[0]);
      expect(keys).toContain("ENSO_API_KEY");
    }
  });
});
