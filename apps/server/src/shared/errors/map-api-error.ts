import { env } from "@doji/env/server";
import { logger } from "@doji/logger";
import { TRPCError } from "@trpc/server";
import { ApiError, ErrorCode } from "./errors";

const SOURCE_LABELS: Record<string, string> = {
  gamma: "Market data",
  clob: "Trading service",
  "data-api": "Portfolio data",
  "clob-read": "Order data",
  subgraph: "On-chain data",
};

function friendlySourceLabel(source: string): string {
  return SOURCE_LABELS[source.toLowerCase()] ?? "This service";
}

/**
 * Wrapper that catches ApiError from Polymarket clients and rethrows mapApiErrorToTRPC.
 * Use around procedure bodies that call gamma, data, bridge, etc.
 */
export async function withPolymarketError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) {
      throw mapApiErrorToTRPC(err);
    }
    throw err;
  }
}

/** Marker so onError can tell properly-mapped ApiErrors from escaped ones. */
export const POLYMARKET_MAPPED = Symbol("polymarketMapped");

function mapped(err: TRPCError): TRPCError {
  (err as unknown as Record<symbol, boolean>)[POLYMARKET_MAPPED] = true;
  return err;
}

/**
 * Map ApiError to TRPCError with appropriate code and user-facing message.
 * Sets POLYMARKET_MAPPED so onError can distinguish these from ApiErrors that
 * escaped without being wrapped (forgot withPolymarketError).
 */
export function mapApiErrorToTRPC(apiError: ApiError): TRPCError {
  switch (apiError.code) {
    case ErrorCode.AUTH:
      return mapped(
        new TRPCError({
          code: "UNAUTHORIZED",
          message:
            "This service could not verify your request. Please try again.",
          cause: apiError,
        })
      );
    case ErrorCode.RATE_LIMIT:
      return mapped(
        new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Too many requests. Please wait a moment and try again.",
          cause: apiError,
        })
      );
    case ErrorCode.VALIDATION:
      return mapped(
        new TRPCError({
          code: "BAD_REQUEST",
          message: apiError.message ?? "Invalid request.",
          cause: apiError,
        })
      );
    case ErrorCode.CIRCUIT_OPEN: {
      const details = apiError.details as
        | { lastFailure?: string | null; state?: string }
        | undefined;
      const lastFailure =
        typeof details?.lastFailure === "string" &&
        details.lastFailure.length > 0
          ? details.lastFailure
          : null;
      logger.warn(
        {
          source: apiError.source,
          lastFailure,
          circuitState: details?.state,
        },
        "Upstream circuit breaker open (see lastFailure for errors before trip)"
      );
      const devSuffix =
        env.NODE_ENV === "development" && lastFailure !== null
          ? ` [last upstream failure: ${lastFailure.slice(0, 280)}]`
          : "";
      const sourceLabel = friendlySourceLabel(apiError.source);
      return mapped(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message:
            `${sourceLabel} is temporarily unavailable. Please try again later.` +
            devSuffix,
          cause: apiError,
        })
      );
    }
    case ErrorCode.NETWORK:
    case ErrorCode.SERVER: {
      const sourceLabel = friendlySourceLabel(apiError.source);
      return mapped(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `${sourceLabel} is temporarily unavailable. Please try again later.`,
          cause: apiError,
        })
      );
    }
    case ErrorCode.UNKNOWN:
      if (apiError.httpStatus === 404) {
        return mapped(
          new TRPCError({
            code: "NOT_FOUND",
            message: "The requested resource was not found.",
            cause: apiError,
          })
        );
      }
      return mapped(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong. Please try again.",
          cause: apiError,
        })
      );
    default:
      return mapped(
        new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Something went wrong. Please try again.",
          cause: apiError,
        })
      );
  }
}
