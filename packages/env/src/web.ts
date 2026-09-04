import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    /** Token to forward to server sign endpoint (matches one in server's POLYMARKET_SIGN_TOKENS). */
    POLYMARKET_SIGN_TOKEN: z.string().optional(),
    /** Vercel deployment URL (injected by Vercel). */
    VERCEL_URL: z.string().optional(),
    /** Log level: trace, debug, info, warn, error, fatal. Used by @doji/logger. */
    LOG_LEVEL: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .optional(),
    /** Discord webhook URL that receives in-app bug reports. Server-only (never expose client-side). */
    DISCORD_BUG_REPORT_WEBHOOK_URL: z.url().optional(),
    /** Base trace sample rate for Next.js server/edge (`tracesSampler` applies on top). Mirrors server `SENTRY_TRACES_SAMPLE_RATE`. */
    SENTRY_TRACES_SAMPLE_RATE: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(process.env.NODE_ENV === "development" ? 1 : 0.1),
    /** Enable verbose Sentry debug logging. */
    SENTRY_DEBUG: z.coerce.boolean().default(false),
    /** Sentry release identifier for source map association. */
    SENTRY_RELEASE: z.string().optional(),
    /** Sentry auth token for source map upload at build time. */
    SENTRY_AUTH_TOKEN: z.string().optional(),
  },
  client: {
    /** Optional Sentry CSP reporting endpoint from Project Settings -> Security Headers. */
    NEXT_PUBLIC_SENTRY_CSP_REPORT_URI: z.url().optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.url().optional(),
    /** Enable verbose Sentry debug logging on the client. */
    NEXT_PUBLIC_SENTRY_DEBUG: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    /** Public app URL for metadata/sitemap. Falls back to VERCEL_URL on Vercel. */
    NEXT_PUBLIC_APP_URL: z.url().optional(),
    NEXT_PUBLIC_CLOB_API_URL: z.url().default("https://clob.polymarket.com"),
    NEXT_PUBLIC_WS_MARKET_URL: z
      .url()
      .default("wss://ws-subscriptions-clob.polymarket.com/ws/market"),
    NEXT_PUBLIC_WS_USER_URL: z
      .url()
      .default("wss://ws-subscriptions-clob.polymarket.com/ws/user"),
    NEXT_PUBLIC_RTDS_URL: z.url().default("wss://ws-live-data.polymarket.com"),
    NEXT_PUBLIC_CHAIN_ID: z.string().default("137"),
    NEXT_PUBLIC_SERVER_URL: z.url().default("http://localhost:3001"),
    NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY: z.string().min(1).default("placeholder"),
    NEXT_PUBLIC_POLYGON_RPC_URL: z.url().default("https://polygon.drpc.org"),
    NEXT_PUBLIC_WS_SPORTS_URL: z
      .url()
      .default("wss://sports-api.polymarket.com/ws"),
    /** When true, bypass geoblock check (trading allowed regardless of region). Ignored in production. */
    NEXT_PUBLIC_DISABLE_GEOBLOCK: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    /** Dev only: when true, always show RestrictedRegionButton (simulate geoblocked for UI preview). Ignored in production. */
    NEXT_PUBLIC_SIMULATE_GEOBLOCKED: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    /**
     * When true, enable the user referral program (/referrals).
     * Default off for launch (landing uses one-time codes only).
     */
    NEXT_PUBLIC_FEATURE_REFERRALS: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    /**
     * When true, enable table funnel controls in Explore and Leaderboard.
     * Default off to reduce UI clutter; can be re-enabled with env.
     */
    NEXT_PUBLIC_FEATURE_FUNNELS: z
      .string()
      .optional()
      .transform((v) => v === "true" || v === "1"),
    /** CLOB V2 builder code (bytes32 hex) for order attribution. Public identifier — appears onchain. */
    NEXT_PUBLIC_POLY_BUILDER_CODE: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/)
      .default(
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      ),
  },
  // Explicitly tell T3 env when we're on server vs client (helps Fast Refresh / bundling edge cases).
  isServer: typeof globalThis === "undefined" || !("window" in globalThis),
  runtimeEnv: {
    POLYMARKET_SIGN_TOKEN: process.env.POLYMARKET_SIGN_TOKEN,
    VERCEL_URL: process.env.VERCEL_URL,
    LOG_LEVEL: process.env.LOG_LEVEL,
    DISCORD_BUG_REPORT_WEBHOOK_URL: process.env.DISCORD_BUG_REPORT_WEBHOOK_URL,
    SENTRY_TRACES_SAMPLE_RATE: process.env.SENTRY_TRACES_SAMPLE_RATE,
    SENTRY_DEBUG: process.env.SENTRY_DEBUG,
    SENTRY_RELEASE: process.env.SENTRY_RELEASE,
    SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
    NEXT_PUBLIC_SENTRY_CSP_REPORT_URI:
      process.env.NEXT_PUBLIC_SENTRY_CSP_REPORT_URI,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_SENTRY_DEBUG: process.env.NEXT_PUBLIC_SENTRY_DEBUG,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_CLOB_API_URL: process.env.NEXT_PUBLIC_CLOB_API_URL,
    NEXT_PUBLIC_WS_MARKET_URL: process.env.NEXT_PUBLIC_WS_MARKET_URL,
    NEXT_PUBLIC_WS_USER_URL: process.env.NEXT_PUBLIC_WS_USER_URL,
    NEXT_PUBLIC_RTDS_URL: process.env.NEXT_PUBLIC_RTDS_URL,
    NEXT_PUBLIC_CHAIN_ID: process.env.NEXT_PUBLIC_CHAIN_ID,
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
    NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY,
    NEXT_PUBLIC_POLYGON_RPC_URL: process.env.NEXT_PUBLIC_POLYGON_RPC_URL,
    NEXT_PUBLIC_WS_SPORTS_URL: process.env.NEXT_PUBLIC_WS_SPORTS_URL,
    NEXT_PUBLIC_DISABLE_GEOBLOCK: process.env.NEXT_PUBLIC_DISABLE_GEOBLOCK,
    NEXT_PUBLIC_SIMULATE_GEOBLOCKED:
      process.env.NEXT_PUBLIC_SIMULATE_GEOBLOCKED,
    NEXT_PUBLIC_FEATURE_REFERRALS: process.env.NEXT_PUBLIC_FEATURE_REFERRALS,
    NEXT_PUBLIC_FEATURE_FUNNELS: process.env.NEXT_PUBLIC_FEATURE_FUNNELS,
    NEXT_PUBLIC_POLY_BUILDER_CODE: process.env.NEXT_PUBLIC_POLY_BUILDER_CODE,
  },
  emptyStringAsUndefined: true,
});
