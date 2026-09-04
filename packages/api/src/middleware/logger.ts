import { logger } from "@doji/logger";
import * as Sentry from "@sentry/node";

import { t } from "../trpc";

/**
 * tRPC middleware that logs procedure execution (path, type, duration, success/error).
 * Uses ctx.log when available (from Hono request context), otherwise falls back to root logger.
 */
/** Build base log context; includes user_id for filtering/correlation. */
function baseLogContext(
  path: string,
  type: string,
  session: { userId: string; issuer: string } | null
): {
  path: string;
  type: string;
  user_id?: string;
  user?: { id: string; issuer: string };
} {
  const base = { path, type };
  if (session) {
    return {
      ...base,
      user_id: session.userId,
      user: { id: session.userId, issuer: session.issuer },
    };
  }
  return base;
}

/**
 * tRPC v11+ `next()` resolves with `{ ok: false, error }` on resolver failure instead
 * of rejecting. Without this check, we would log success right before `onError`.
 */
function isMiddlewareFailureResult(
  value: unknown
): value is { ok: false; error: unknown } {
  return (
    typeof value === "object" &&
    value !== null &&
    "ok" in value &&
    (value as { ok: unknown }).ok === false &&
    "error" in value
  );
}

/** Client errors (4xx) are expected — log at warn, not error. */
const CLIENT_ERROR_CODES = new Set([
  "BAD_REQUEST",
  "NOT_FOUND",
  "FORBIDDEN",
  "UNAUTHORIZED",
  "PRECONDITION_FAILED",
  "METHOD_NOT_SUPPORTED",
  "TOO_MANY_REQUESTS",
  "CONFLICT",
  "PARSE_ERROR",
  "UNPROCESSABLE_CONTENT",
  "PAYLOAD_TOO_LARGE",
]);

function isClientError(error: unknown): boolean {
  if (error == null || typeof error !== "object") {
    return false;
  }
  const code = (error as { code?: string }).code;
  return typeof code === "string" && CLIENT_ERROR_CODES.has(code);
}

function logProcedureError(
  log: {
    error: (obj: unknown, msg: string) => void;
    warn: (obj: unknown, msg: string) => void;
  },
  context: Record<string, unknown>,
  error: unknown
): void {
  const { msg, ...rest } = context;
  const message = msg as string;
  if (isClientError(error)) {
    log.warn(rest, message);
  } else {
    log.error(rest, message);
  }
}

export const loggerMiddleware = t.middleware(
  async ({ path, type, ctx, next }) => {
    const log = ctx.log ?? logger;
    const start = Date.now();
    const base = baseLogContext(path, type, ctx.session);
    const hasSession = Boolean(ctx.session);

    Sentry.metrics.count("trpc_procedure_started", 1, {
      attributes: {
        procedure: path,
        type,
        has_session: hasSession,
      },
    });

    log.debug(base, "tRPC procedure started");

    try {
      const result = await next();
      const duration = Date.now() - start;
      if (isMiddlewareFailureResult(result)) {
        Sentry.metrics.count("trpc_procedure_completed", 1, {
          attributes: {
            procedure: path,
            type,
            has_session: hasSession,
            outcome: "error",
          },
        });
        Sentry.metrics.distribution("trpc_procedure_latency", duration, {
          unit: "millisecond",
          attributes: {
            procedure: path,
            type,
            has_session: hasSession,
            outcome: "error",
          },
        });
        logProcedureError(
          log,
          {
            ...base,
            duration,
            err: result.error,
            status: "error",
            msg: `tRPC ${path} error ${duration}ms`,
          },
          result.error
        );
        return result;
      }
      Sentry.metrics.count("trpc_procedure_completed", 1, {
        attributes: {
          procedure: path,
          type,
          has_session: hasSession,
          outcome: "ok",
        },
      });
      Sentry.metrics.distribution("trpc_procedure_latency", duration, {
        unit: "millisecond",
        attributes: {
          procedure: path,
          type,
          has_session: hasSession,
          outcome: "ok",
        },
      });
      log.info(
        { ...base, duration, status: "ok" },
        `tRPC ${path} ok ${duration}ms`
      );
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      Sentry.metrics.count("trpc_procedure_completed", 1, {
        attributes: {
          procedure: path,
          type,
          has_session: hasSession,
          outcome: "exception",
        },
      });
      Sentry.metrics.distribution("trpc_procedure_latency", duration, {
        unit: "millisecond",
        attributes: {
          procedure: path,
          type,
          has_session: hasSession,
          outcome: "exception",
        },
      });
      logProcedureError(
        log,
        {
          ...base,
          duration,
          err: error,
          msg: `tRPC ${path} error ${duration}ms`,
        },
        error
      );
      throw error;
    }
  }
);
