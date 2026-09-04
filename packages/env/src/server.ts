import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    GAMMA_API_URL: z.url().default("https://gamma-api.polymarket.com"),
    DATA_API_URL: z.url().default("https://data-api.polymarket.com"),
    BRIDGE_API_URL: z.url().default("https://bridge.polymarket.com"),
    CLOB_API_URL: z.url().default("https://clob.polymarket.com"),
    CHAIN_ID: z.coerce.number().default(137),
    SERVER_URL: z.url().default("http://localhost:3001"),
    MAGIC_SECRET_KEY: z.string().min(1),
    CREDENTIAL_ENCRYPTION_KEY: z.string().length(64),
    JWT_SESSION_SECRET: z.string().min(32),
    DATABASE_URL: z.string().min(1),
    /** Optional: Neon direct (non-pooled) connection for migrations. Use when DATABASE_URL is pooled. */
    DATABASE_URL_DIRECT: z.url().optional(),
    PORT: z.string().default("3001"),
    /** Comma-separated browser origins allowed for CORS (e.g. localhost vs 127.0.0.1). */
    CORS_ORIGIN: z
      .string()
      .transform((s) =>
        s
          .split(",")
          .map((p) => p.trim())
          .filter((p) => p.length > 0)
      )
      .pipe(z.array(z.string().url()).min(1)),
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    SENTRY_DSN: z.url().optional(),
    SENTRY_CSP_REPORT_URI: z.url().optional(),
    SENTRY_ORG_ID: z.coerce.number().optional(),
    SENTRY_ENVIRONMENT: z.string().min(1).optional(),
    SENTRY_RELEASE: z.string().optional(),
    SENTRY_DEBUG: z.coerce.boolean().default(false),
    SENTRY_STRICT_TRACE_CONTINUATION: z.coerce.boolean().default(false),
    SENTRY_ERROR_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(1),
    SENTRY_TRACES_SAMPLE_RATE: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(process.env.NODE_ENV === "development" ? 1 : 0.1),
    SENTRY_PROFILES_SAMPLE_RATE: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(process.env.NODE_ENV === "development" ? 1 : 0.1),
    // Polymarket Builder Program — all 3 needed for Relayer HMAC auth (gasless txns).
    // CLOB V2 orders use builderCode instead; these are only for the Relayer.
    // Get all 3 from https://polymarket.com/settings?tab=builder
    POLYMARKET_BUILDER_ID: z.string().min(1),
    /**
     * Builder API secret for Relayer HMAC signing.
     * Accepts either POLYMARKET_BUILDER_SIGNING_KEY or POLYMARKET_BUILDER_SECRET —
     * Polymarket docs call it "secret", older configs use "signing key". Same credential.
     */
    POLYMARKET_BUILDER_SIGNING_KEY: z
      .string()
      .min(1)
      .default(process.env.POLYMARKET_BUILDER_SECRET ?? ""),
    POLYMARKET_BUILDER_PASSPHRASE: z.string().min(1),
    /** CLOB V2 builder code (bytes32 hex) for order attribution. Required for builder fee revenue. */
    POLY_BUILDER_CODE: z
      .string()
      .regex(/^0x[a-fA-F0-9]{64}$/)
      .min(1),
    /** Feature flag: enable CLOB V2 code paths. Default true (V2 is production after Apr 28 2026). */
    CLOB_V2_ENABLED: z.coerce.boolean().default(true),
    /** Comma-separated Bearer tokens for /api/polymarket/sign. When set, requests must include Authorization: Bearer <token>. */
    POLYMARKET_SIGN_TOKENS: z.string().optional(),
    /** Polygon RPC URL for on-chain verification (e.g. Safe bytecode check). */
    POLYGON_RPC_URL: z.url().default("https://polygon.drpc.org"),
    /** Optional: Etherscan API key for tokentx (Activity tab). V2 required since Aug 2025. Get at etherscan.io/apidashboard. */
    ETHERSCAN_API_KEY: z.string().optional(),
    /** Optional: Public Goldsky endpoints for Polymarket subgraphs. */
    POLYMARKET_SUBGRAPH_OI_URL: z.url().optional(),
    POLYMARKET_SUBGRAPH_ORDERS_URL: z.url().optional(),
    POLYMARKET_SUBGRAPH_ACTIVITY_URL: z.url().optional(),
    POLYMARKET_SUBGRAPH_PNL_URL: z.url().optional(),
    POLYMARKET_SUBGRAPH_POSITIONS_URL: z.url().optional(),
    /**
     * When true, new-user account creation requires a valid referral/invite code.
     * Existing users can always log in without a code.
     * Default false for development; enable for private beta.
     */
    REFERRAL_GATE_ENABLED: z
      .enum(["true", "false", "0", "1", ""])
      .default("false")
      .transform((v) => v === "true" || v === "1"),
    /** Feature flags for progressive subgraph rollout with API fallback. */
    /** Explore / bulk trade counts: prefer orderbook subgraph (`tradesQuantity`); set false to use Data API /trades only. */
    SUBGRAPH_ENABLE_TRADE_COUNTS: z.coerce.boolean().default(true),
    /** Optional: Comma-separated chain IDs to disable in bridge (e.g. "999,2741"). */
    BRIDGE_DISABLED_CHAINS: z.string().optional(),
    /** Optional: Comma-separated token symbols to disable in bridge (e.g. "TRUMP,MEME"). */
    BRIDGE_DISABLED_TOKENS: z.string().optional(),
    /**
     * Optional Discord incoming webhook for internal ops (new signups, successful order posts).
     * Separate from bug-report webhook (`DISCORD_BUG_REPORT_WEBHOOK_URL` on web).
     */
    DISCORD_OPS_WEBHOOK_URL: z.url().optional(),
    /** Enso Finance API key for bundle routing (basket buy/exit transactions). */
    ENSO_API_KEY: z.string().min(1),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
