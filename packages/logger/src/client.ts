/**
 * Client-safe logger for browser environments.
 * - Development: forwards to console (warn, error, debug, info)
 * - Production: no-op (no console output)
 *
 * Use this in client components instead of console.* to comply with code standards.
 * For server-side code, use the main logger (pino) from @doji/logger.
 */

const isDev =
  typeof process !== "undefined" && process.env.NODE_ENV === "development";

function noop(): void {
  /* no-op in production */
}

export const logger = {
  warn: isDev ? (...args: unknown[]) => console.warn(...args) : noop,
  error: isDev ? (...args: unknown[]) => console.error(...args) : noop,
  debug: isDev ? (...args: unknown[]) => console.debug(...args) : noop,
  info: isDev ? (...args: unknown[]) => console.info(...args) : noop,
};
