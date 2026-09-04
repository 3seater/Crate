/**
 * Shared Pino logger for server-side logging.
 *
 * - Development: pretty-printed, colorized output (when stdout is TTY)
 * - Production: JSON to stdout (ELK, CloudWatch compatible)
 * - Sensitive fields redacted
 * - Child loggers for request context (requestId, path, etc.)
 *
 * Uses pino.multistream + pino-pretty (main process) instead of pino.transport
 * so bundlers (Next.js) don't need worker-path overrides (see getpino.io bundling docs).
 */

import { createRequire } from "node:module";
import { env } from "@doji/env/web";
import pino from "pino";

const require = createRequire(import.meta.url);

const isDev = process.env.NODE_ENV === "development";
const isTTY = Boolean(process.stdout?.isTTY);
const logLevel = env.LOG_LEVEL ?? (isDev ? "debug" : "info");

function createDestination(): pino.DestinationStream {
  if (isDev && isTTY) {
    try {
      return require("pino-pretty")({
        colorize: true,
        translateTime: "SYS:standard",
        ignore: "pid,hostname",
      });
    } catch {
      return pino.destination(1);
    }
  }
  return pino.destination(1);
}

const dest = createDestination();
const usePretty = isDev && isTTY;

const opts = {
  level: logLevel,
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: usePretty
    ? undefined
    : { level: (label: string) => ({ level: label }) },
  redact: {
    paths: [
      "password",
      "token",
      "authorization",
      "cookie",
      "secret",
      "apiKey",
      "credential",
      "encryptedCreds",
      "didToken",
      "sessionToken",
      "privateKey",
      "*.password",
      "*.token",
      "*.secret",
      "*.credential",
      "*.encryptedCreds",
      "*.didToken",
      "*.sessionToken",
      "*.privateKey",
      "req.headers.authorization",
      "req.headers.cookie",
    ],
    censor: "[REDACTED]",
  },
  base: {
    service: process.env.SERVICE_NAME?.trim() || "doji-server",
    env: process.env.NODE_ENV || undefined,
    ...(process.env.SERVICE_VERSION?.trim() && {
      version: process.env.SERVICE_VERSION?.trim(),
    }),
    ...(process.env.COMMIT_SHA && { commit: process.env.COMMIT_SHA }),
    ...(process.env.VERCEL_GIT_COMMIT_SHA && {
      commit: process.env.VERCEL_GIT_COMMIT_SHA,
    }),
    ...(process.env.VERCEL_REGION && { region: process.env.VERCEL_REGION }),
  },
};

export const logger = pino(opts, dest);

/** Minimal logger interface for dependency injection (e.g. tRPC context). */
export type Logger = Pick<
  typeof logger,
  "debug" | "info" | "warn" | "error" | "child"
>;

export default logger;
