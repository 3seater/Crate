import { z } from "zod";

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/** Single-window rate limit. */
export interface SingleWindowLimit {
  limit: number;
  type: "single";
  windowMs: number;
}

/** Dual-window rate limit (burst + sustained). */
export interface DualWindowLimit {
  burst: { limit: number; windowMs: number };
  sustained: { limit: number; windowMs: number };
  type: "dual";
}

/** A rate limit is either single-window or dual-window. */
export type RateLimit = SingleWindowLimit | DualWindowLimit;

/** Configuration for one API family. */
export interface ApiFamilyConfig {
  endpoints: Record<string, RateLimit>;
  general: SingleWindowLimit;
}

/** Full rate limit configuration keyed by API family name. */
export type RateLimitConfig = Record<string, ApiFamilyConfig>;

// ---------------------------------------------------------------------------
// Zod schemas for validation
// ---------------------------------------------------------------------------

const SingleWindowLimitSchema = z.object({
  type: z.literal("single"),
  limit: z.number().positive(),
  windowMs: z.number().positive(),
});

const DualWindowLimitSchema = z.object({
  type: z.literal("dual"),
  burst: z.object({
    limit: z.number().positive(),
    windowMs: z.number().positive(),
  }),
  sustained: z.object({
    limit: z.number().positive(),
    windowMs: z.number().positive(),
  }),
});

const RateLimitSchema = z.discriminatedUnion("type", [
  SingleWindowLimitSchema,
  DualWindowLimitSchema,
]);

const ApiFamilyConfigSchema = z.object({
  general: SingleWindowLimitSchema,
  endpoints: z.record(z.string(), RateLimitSchema),
});

export const RateLimitConfigSchema: z.ZodType<RateLimitConfig> = z.record(
  z.string(),
  ApiFamilyConfigSchema
);

// ---------------------------------------------------------------------------
// Source-to-family mapping
// ---------------------------------------------------------------------------

export const SOURCE_TO_FAMILY: Record<string, string> = {
  gamma: "gamma",
  data: "data",
  clob: "clob",
  bridge: "general",
  relayer: "relayer",
  user_pnl: "user_pnl",
};

// ---------------------------------------------------------------------------
// Complete rate limit configuration
// ---------------------------------------------------------------------------

export const RATE_LIMIT_CONFIG: RateLimitConfig = {
  general: {
    general: { type: "single", limit: 15_000, windowMs: 10_000 },
    endpoints: {
      "/": { type: "single", limit: 100, windowMs: 10_000 },
    },
  },
  data: {
    general: { type: "single", limit: 1000, windowMs: 10_000 },
    endpoints: {
      "/trades": { type: "single", limit: 200, windowMs: 10_000 },
      "/positions": { type: "single", limit: 150, windowMs: 10_000 },
      "/closed-positions": { type: "single", limit: 150, windowMs: 10_000 },
      "/activity": { type: "single", limit: 150, windowMs: 10_000 },
      "/value": { type: "single", limit: 200, windowMs: 10_000 },
      "/traded": { type: "single", limit: 200, windowMs: 10_000 },
      "/oi": { type: "single", limit: 300, windowMs: 10_000 },
      "/live-volume": { type: "single", limit: 200, windowMs: 10_000 },
      "/holders": { type: "single", limit: 150, windowMs: 10_000 },
      "/v1/accounting/snapshot": {
        type: "single",
        limit: 50,
        windowMs: 10_000,
      },
      "/v1/leaderboard": { type: "single", limit: 100, windowMs: 10_000 },
      "/": { type: "single", limit: 100, windowMs: 10_000 },
    },
  },
  gamma: {
    general: { type: "single", limit: 4000, windowMs: 10_000 },
    endpoints: {
      "/comments": { type: "single", limit: 200, windowMs: 10_000 },
      "/events": { type: "single", limit: 500, windowMs: 10_000 },
      "/markets": { type: "single", limit: 300, windowMs: 10_000 },
      "/tags": { type: "single", limit: 200, windowMs: 10_000 },
      "/series": { type: "single", limit: 200, windowMs: 10_000 },
      "/sports": { type: "single", limit: 100, windowMs: 10_000 },
      "/teams": { type: "single", limit: 200, windowMs: 10_000 },
      "/public-profile": { type: "single", limit: 200, windowMs: 10_000 },
      "/public-search": { type: "single", limit: 350, windowMs: 10_000 },
    },
  },
  clob: {
    general: { type: "single", limit: 9000, windowMs: 10_000 },
    endpoints: {
      "GET /balance-allowance": {
        type: "single",
        limit: 200,
        windowMs: 10_000,
      },
      "UPDATE /balance-allowance": {
        type: "single",
        limit: 50,
        windowMs: 10_000,
      },
      "/book": { type: "single", limit: 1500, windowMs: 10_000 },
      "/books": { type: "single", limit: 500, windowMs: 10_000 },
      "/price": { type: "single", limit: 1500, windowMs: 10_000 },
      "/prices": { type: "single", limit: 500, windowMs: 10_000 },
      "/midpoint": { type: "single", limit: 1500, windowMs: 10_000 },
      "/midpoints": { type: "single", limit: 500, windowMs: 10_000 },
      "/ledger": { type: "single", limit: 900, windowMs: 10_000 },
      "/data/orders": { type: "single", limit: 500, windowMs: 10_000 },
      "/data/trades": { type: "single", limit: 500, windowMs: 10_000 },
      "/notifications": { type: "single", limit: 125, windowMs: 10_000 },
      "/price-history": { type: "single", limit: 1000, windowMs: 10_000 },
      "/tick-size": { type: "single", limit: 200, windowMs: 10_000 },
      "/api-keys": { type: "single", limit: 100, windowMs: 10_000 },
      "POST /order": {
        type: "dual",
        burst: { limit: 3500, windowMs: 10_000 },
        sustained: { limit: 36_000, windowMs: 600_000 },
      },
      "DELETE /order": {
        type: "dual",
        burst: { limit: 3000, windowMs: 10_000 },
        sustained: { limit: 30_000, windowMs: 600_000 },
      },
      "POST /orders": {
        type: "dual",
        burst: { limit: 1000, windowMs: 10_000 },
        sustained: { limit: 15_000, windowMs: 600_000 },
      },
      "DELETE /orders": {
        type: "dual",
        burst: { limit: 1000, windowMs: 10_000 },
        sustained: { limit: 15_000, windowMs: 600_000 },
      },
      "DELETE /cancel-all": {
        type: "dual",
        burst: { limit: 250, windowMs: 10_000 },
        sustained: { limit: 6000, windowMs: 600_000 },
      },
      "DELETE /cancel-market-orders": {
        type: "dual",
        burst: { limit: 1000, windowMs: 10_000 },
        sustained: { limit: 1500, windowMs: 600_000 },
      },
    },
  },
  relayer: {
    general: { type: "single", limit: 25, windowMs: 60_000 },
    endpoints: {},
  },
  user_pnl: {
    general: { type: "single", limit: 200, windowMs: 10_000 },
    endpoints: {},
  },
};
