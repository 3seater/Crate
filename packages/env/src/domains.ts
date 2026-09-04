/**
 * Centralized domain configuration map for all Vercel deployment environments.
 * Single source of truth for domain URLs and CORS origins.
 */

export type VercelEnvironment = "production" | "preview" | "development";

export interface DomainConfig {
  docs: string;
  server: string;
  web: string;
}

export const DOMAIN_MAP: Record<VercelEnvironment, DomainConfig> = {
  production: {
    web: "https://doji.bet",
    server: "https://api.doji.bet",
    docs: "https://docs.doji.bet",
  },
  preview: {
    web: "https://staging.doji.bet",
    server: "https://staging-api.doji.bet",
    docs: "https://staging-docs.doji.bet",
  },
  development: {
    web: "http://localhost:3000",
    server: "http://localhost:3001",
    docs: "http://localhost:3002",
  },
} as const;

/** Sentry environment tag per Vercel deployment target. Set explicitly — do not rely on NODE_ENV fallback. */
export const SENTRY_ENVIRONMENT: Record<VercelEnvironment, string> = {
  production: "production",
  preview: "staging",
  development: "development",
} as const;
export interface CorsConfig {
  origins: string[];
}

export const CORS_ORIGINS: Record<VercelEnvironment, CorsConfig> = {
  production: {
    origins: ["https://doji.bet", "https://www.doji.bet"],
  },
  preview: {
    origins: [
      "https://staging.doji.bet",
      "https://doji.bet",
      "https://www.doji.bet",
    ],
  },
  development: {
    origins: ["http://localhost:3000", "http://127.0.0.1:3000"],
  },
} as const;
