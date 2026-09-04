/**
 * Unit tests for the simplified V2 sign endpoint.
 *
 * Tests cover:
 * 1. Relayer request returns Builder API key headers (POLY_BUILDER_API_KEY, POLY_BUILDER_PASSPHRASE)
 * 2. Bearer auth is enforced when POLYMARKET_SIGN_TOKENS is configured
 * 3. Missing builder credentials returns 500
 *
 * _Requirements: 11.2, 11.3_
 */
import { describe, expect, it, vi } from "vitest";

// ─── Mock @sentry/node before importing the sign module ──────────────────────

vi.mock("@sentry/node", () => ({
  getActiveSpan: () => ({ setAttributes: vi.fn() }),
  metrics: {
    count: vi.fn(),
    distribution: vi.fn(),
  },
  logger: { warn: vi.fn() },
}));

// ─── Helper: import a fresh sign app with specific env values ────────────────

async function createSignApp(envOverrides: Record<string, unknown>) {
  // Reset modules so each test gets a fresh SIGN_TOKENS set and env
  vi.resetModules();

  vi.doMock("@doji/env/server", () => ({
    env: {
      POLYMARKET_BUILDER_ID: undefined,
      POLYMARKET_BUILDER_PASSPHRASE: undefined,
      POLYMARKET_SIGN_TOKENS: undefined,
      ...envOverrides,
    },
  }));

  // Re-mock Sentry after resetModules
  vi.doMock("@sentry/node", () => ({
    getActiveSpan: () => ({ setAttributes: vi.fn() }),
    metrics: {
      count: vi.fn(),
      distribution: vi.fn(),
    },
    logger: { warn: vi.fn() },
  }));

  const mod = await import(
    "../../apps/server/src/features/bridge/routes/sign.ts"
  );
  return mod.default;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("V2 sign endpoint", () => {
  it("returns Builder API key headers for a valid Relayer request", async () => {
    const app = await createSignApp({
      POLYMARKET_BUILDER_ID: "test-builder-id",
      POLYMARKET_BUILDER_PASSPHRASE: "test-passphrase",
      POLYMARKET_SIGN_TOKENS: "valid-token-123",
    });

    const res = await app.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token-123",
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      POLY_BUILDER_API_KEY: "test-builder-id",
      POLY_BUILDER_PASSPHRASE: "test-passphrase",
    });
    // V2: HMAC fields must NOT be present
    expect(body).not.toHaveProperty("POLY_BUILDER_SIGNATURE");
    expect(body).not.toHaveProperty("POLY_BUILDER_TIMESTAMP");
  });

  it("returns 401 when Bearer auth is missing", async () => {
    const app = await createSignApp({
      POLYMARKET_BUILDER_ID: "test-builder-id",
      POLYMARKET_BUILDER_PASSPHRASE: "test-passphrase",
      POLYMARKET_SIGN_TOKENS: "valid-token-123",
    });

    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when Bearer token is invalid", async () => {
    const app = await createSignApp({
      POLYMARKET_BUILDER_ID: "test-builder-id",
      POLYMARKET_BUILDER_PASSPHRASE: "test-passphrase",
      POLYMARKET_SIGN_TOKENS: "valid-token-123",
    });

    const res = await app.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer wrong-token",
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 500 when builder credentials are missing", async () => {
    const app = await createSignApp({
      POLYMARKET_BUILDER_ID: undefined,
      POLYMARKET_BUILDER_PASSPHRASE: undefined,
      POLYMARKET_SIGN_TOKENS: "valid-token-123",
    });

    const res = await app.request("/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer valid-token-123",
      },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Builder credentials not configured" });
  });

  it("skips auth when POLYMARKET_SIGN_TOKENS is not configured", async () => {
    const app = await createSignApp({
      POLYMARKET_BUILDER_ID: "test-builder-id",
      POLYMARKET_BUILDER_PASSPHRASE: "test-passphrase",
      POLYMARKET_SIGN_TOKENS: undefined,
    });

    // No Authorization header — should still succeed when tokens aren't configured
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      POLY_BUILDER_API_KEY: "test-builder-id",
      POLY_BUILDER_PASSPHRASE: "test-passphrase",
    });
  });
});
