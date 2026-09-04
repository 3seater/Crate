/**
 * Web app constants: API paths, query timing, bridge UI.
 *
 * CLOB/order constants live in @doji/types. Path constants are segment-only (no origin);
 * use with BASE_URL or getSigningEndpointUrl() for full URLs.
 */

// ─── Doji API paths (path segment only; no origin) ───────────────────────────

/** Next.js API route for remote Polymarket signing. Use getSigningEndpointUrl() for full URL. */
export const API_PATH_POLYMARKET_SIGN = "/api/polymarket/sign";

/** Next.js API route that proxies Polymarket geoblock. Client fetches this to avoid CORS. */
export const API_PATH_GEOBLOCK = "/api/geoblock";

/** Health check path (server or Next.js route). */
export const API_PATH_HEALTH = "/api/health";

// ─── App paths ──────────────────────────────────────────────────────────────

// ─── Query / data-fetching ──────────────────────────────────────────────────

/** Delays (ms) for post-trade invalidation retries. Catches slow Data API indexing. */
export const QUERY_POST_TRADE_INVALIDATION_DELAYS_MS = [
  3000, 8000, 15_000, 30_000,
] as const;

/** Notifications retention (48h). Match Polymarket server; used for persisted cache expiry. */
export const POLYMARKET_NOTIFICATIONS_RETENTION_MS = 48 * 60 * 60 * 1000;

// ─── Bridge UI ──────────────────────────────────────────────────────────────

/** Min time (ms) to show "processing" state before revealing final status (avoids flicker). */
export const BRIDGE_MIN_PROCESSING_DISPLAY_MS = 2000;

/** Poll interval (ms) for bridge deposit/withdraw status. Docs recommend 10–30s. */
export const BRIDGE_STATUS_POLL_MS = 15_000;

// ─── Session Cookies ────────────────────────────────────────────────────────

/** HttpOnly cookie name for JWT session token (server-side prefetch). */
export const SESSION_COOKIE_NAME = "x-session-token";

/** Cookie name for portfolio address (server-side prefetch). */
export const ADDRESS_COOKIE_NAME = "x-portfolio-address";
