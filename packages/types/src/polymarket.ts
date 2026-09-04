/**
 * Shared Polymarket constants used across apps and packages.
 * These represent production/default values; env vars can override in runtime.
 */

/** Polygon mainnet chain ID (Polymarket operates on Polygon) */
export const POLYGON_CHAIN_ID = 137;

/** Polymarket Builder Relayer API (Safe deployment) */
export const RELAYER_URL = "https://relayer-v2.polymarket.com";

/** Polymarket CLOB (Central Limit Order Book) API */
export const CLOB_HOST = "https://clob.polymarket.com";

/** Polymarket signature type for Gnosis Safe (0=EOA, 1=Magic proxy, 2=Safe) */
export const SAFE_SIGNATURE_TYPE = 2;
