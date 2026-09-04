/**
 * Application configuration for SEO, metadata, and app-wide constants.
 */

import { env } from "@doji/env/web";
import { API_PATH_POLYMARKET_SIGN } from "@/config";

export const APP_NAME = "Crate";
export const APP_TITLE = "Crate";
export const APP_DESCRIPTION = "Curated exposure for chaotic markets.";
export const APP_KEYWORDS = [
  "Polymarket",
  "prediction markets",
  "trading",
  "crypto",
  "politics",
  "forecasting",
];

const FALLBACK_URL = "https://doji.bet";

function withHttps(host: string): string {
  return host.startsWith("http") ? host : `https://${host}`;
}

function getBaseURL(): string {
  const url = env.NEXT_PUBLIC_APP_URL?.trim();
  if (url) {
    return url;
  }
  // Server: metadataBase / og:image must use the public domain. If we fall back to
  // VERCEL_URL alone, og:image points at *.vercel.app — Discord/embeds fetch that host
  // and often fail (wrong deployment, HTML instead of PNG).
  if (typeof window === "undefined") {
    const vercelEnv = process.env.VERCEL_ENV;
    const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
    if (vercelEnv === "production" && productionHost) {
      return withHttps(productionHost);
    }
    if (vercelEnv === "production") {
      return FALLBACK_URL;
    }
    const vercel = process.env.VERCEL_URL?.trim();
    if (vercel) {
      return `https://${vercel}`;
    }
  }
  return process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : FALLBACK_URL;
}

export const BASE_URL = getBaseURL();

/** Full URL for the Polymarket remote sign endpoint. */
export function getSigningEndpointUrl(): string {
  return `${BASE_URL}${API_PATH_POLYMARKET_SIGN}`;
}
