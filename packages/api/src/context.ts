import type { Logger } from "@doji/logger";
import type { AuthSession } from "@doji/types";
import type { Context as HonoContext } from "hono";

export interface Context {
  /** The raw Hono request context, used by tRPC middleware to read headers (e.g. Authorization). */
  honoContext: HonoContext;
  /** Request-scoped logger (when available from Hono context). */
  log?: Logger;
  /** Populated by the auth middleware for protected procedures; null for public requests. */
  session: AuthSession | null;
}

interface CreateContextOptions {
  context: HonoContext;
  /** Request-scoped logger from Hono middleware. */
  log?: Logger;
}

/**
 * Options for creating tRPC context without a full Hono request (e.g. tests, server-side callers).
 * When `honoContext` is omitted, a minimal mock is used so procedures that only need `session` still work.
 */
export interface CreateContextInnerOptions {
  /** Hono request context. Omitted in tests; middleware will use pre-set `session` when provided. */
  honoContext?: HonoContext;
  /** Pre-set logger for request-scoped logging. Populated from Hono context when available. */
  log?: Logger;
  /** Pre-set session for protected procedure tests or server-side callers. */
  session?: AuthSession | null;
}

/**
 * Minimal Hono-like context for createContextInner when no real request is available (e.g. tests).
 * Only provides req.header(); other Hono APIs are not available.
 */
function createMockHonoContext(): HonoContext {
  return {
    req: {
      header: (_name: string) => undefined,
    },
  } as unknown as HonoContext;
}

/**
 * Creates tRPC context for use in tests or server-side callers (e.g. createCaller).
 * Use this when you do not have a real Hono request. For protected procedure tests,
 * pass `session: { userId, issuer }`; the auth middleware will trust a pre-set session.
 *
 * @see apps/server/src/__tests__/ for usage
 */
export function createContextInner(
  opts: CreateContextInnerOptions = {}
): Context {
  const honoContext = opts.honoContext ?? createMockHonoContext();
  const log =
    opts.log ??
    ("get" in honoContext &&
    typeof (honoContext as { get?: (k: string) => unknown }).get === "function"
      ? ((honoContext as { get: (k: string) => unknown }).get("logger") as
          | Logger
          | undefined)
      : undefined);
  return {
    honoContext,
    session: opts.session ?? null,
    log,
  };
}

export function createContext(opts: CreateContextOptions): Context {
  const log =
    opts.log ??
    ("get" in opts.context &&
    typeof (opts.context as { get?: (k: string) => unknown }).get === "function"
      ? ((opts.context as { get: (k: string) => unknown }).get("logger") as
          | Logger
          | undefined)
      : undefined);
  return createContextInner({
    honoContext: opts.context,
    session: null,
    log,
  });
}
