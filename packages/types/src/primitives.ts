/**
 * Primitive types used across Polymarket APIs
 */

/**
 * Ethereum address (0x-prefixed, 40 hex chars)
 * @example "0x56687bf447db6ffa42ffe2204a05edaa20f55839"
 */
export type Address = `0x${string}` | string;

/**
 * 64-byte hash (0x-prefixed, 64 hex chars)
 * Used for condition IDs, transaction hashes, etc.
 * @example "0xdd22472e552920b8438158ea7238bfadfa4f736aa4cee91a6b86c39ead110917"
 */
export type Hash64 = `0x${string}` | string;
