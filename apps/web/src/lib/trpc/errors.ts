/**
 * Client-side error display helpers for tRPC errors.
 *
 * Use getTrpcDisplayMessage when the error comes from a tRPC query/mutation.
 * Use getUserMessage from @/lib/magic/errors for Magic SDK errors (login, social flows).
 *
 * The client should use error.data.message / error.data.why / error.data.fix / error.data.link
 * for display when available (from our tRPC formatter).
 */

/** Type guard: error has tRPC-shaped data (from our formatter). */
function hasTrpcData(
  err: unknown
): err is { message: string; data?: Record<string, unknown> } {
  if (!err || typeof err !== "object") {
    return false;
  }
  const obj = err as Record<string, unknown>;
  // tRPC client errors expose .data from the formatter
  return (
    "data" in obj && (obj.data === undefined || typeof obj.data === "object")
  );
}

/**
 * Whether the error is a tRPC BAD_REQUEST caused by Zod input validation.
 * These are programmer bugs (bad client inputs), not user-facing issues.
 */
export function isInputValidationError(err: unknown): boolean {
  if (!hasTrpcData(err)) {
    return false;
  }
  const data = err.data as Record<string, unknown> | undefined;
  return data?.zodError != null && typeof data.zodError === "object";
}

/**
 * Get user-facing message from a tRPC or generic error.
 * Prefers error.data.message, then zodError (first issue or "Validation failed"), then error.message.
 * Also handles axios-style errors (response.data.error).
 *
 * Input validation errors (BAD_REQUEST with zodError) are replaced with a
 * generic message — raw Zod messages like "Invalid input: expected array,
 * received undefined" are technical and confusing to users.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: maps several backend/client error shapes to user-safe messages
export function getTrpcDisplayMessage(error: unknown): string {
  // tRPC-shaped or generic object with data
  if (hasTrpcData(error)) {
    const data = error.data as Record<string, unknown> | undefined;
    if (!data) {
      return error.message || "Something went wrong";
    }

    // Input validation errors: show generic message instead of raw Zod output
    if (data.zodError != null && typeof data.zodError === "object") {
      return "Something went wrong. Please try again.";
    }

    // Structured message from formatter (AppError / mapApiErrorToTRPC)
    const dataMessage = data.message;
    if (typeof dataMessage === "string" && dataMessage.length > 0) {
      // Replace raw fetch/network errors with actionable guidance
      const lower = dataMessage.toLowerCase();
      if (
        lower === "fetch failed" ||
        lower.includes("failed to fetch") ||
        lower.includes("network error")
      ) {
        return "Could not reach the server. Check that the API is running (port 3001) and try again.";
      }
      return dataMessage;
    }

    // data.error (e.g. axios-style or API error payload)
    const dataError = data.error;
    if (typeof dataError === "string" && dataError.length > 0) {
      return dataError;
    }

    return error.message || "Something went wrong";
  }

  // Axios-style: response.data.error or data.error
  const obj = error as {
    response?: { data?: { error?: string } };
    data?: { error?: string };
  };
  const dataError = obj?.response?.data?.error ?? obj?.data?.error;
  if (typeof dataError === "string" && dataError.length > 0) {
    return dataError;
  }

  if (error instanceof Error && error.message) {
    // Generic fetch/network errors — show actionable guidance
    const msg = error.message.toLowerCase();
    if (
      msg === "fetch failed" ||
      msg.includes("failed to fetch") ||
      msg.includes("network")
    ) {
      return "Could not reach the server. Check that the API is running (port 3001) and try again.";
    }
    return error.message;
  }
  return "Something went wrong";
}

export interface TrpcDisplayDetails {
  fix?: string;
  link?: string;
  why?: string;
}

/**
 * Get optional structured details (why, fix, link) from tRPC error data.
 * Use in toast descriptions or inline hints.
 */
export function getTrpcDisplayDetails(
  error: unknown
): TrpcDisplayDetails | null {
  if (!hasTrpcData(error)) {
    return null;
  }
  const data = error.data as Record<string, unknown> | undefined;
  if (!data) {
    return null;
  }

  const why = data.why;
  const fix = data.fix;
  const link = data.link;
  if (
    typeof why !== "string" &&
    typeof fix !== "string" &&
    typeof link !== "string"
  ) {
    return null;
  }
  return {
    ...(typeof why === "string" && { why }),
    ...(typeof fix === "string" && { fix }),
    ...(typeof link === "string" && { link }),
  };
}

/**
 * TanStack Query keys from @trpc/tanstack-react-query are typically
 * `[['router','procedure'], { type, input }]`. Returns `router.procedure` or null.
 */
export function getTrpcProcedurePathFromQueryKey(
  queryKey: readonly unknown[]
): string | null {
  for (const part of queryKey) {
    if (
      Array.isArray(part) &&
      part.length >= 2 &&
      typeof part[0] === "string" &&
      typeof part[1] === "string"
    ) {
      return `${part[0]}.${part[1]}`;
    }
  }
  return null;
}

/**
 * NOT_FOUND on these queries is often benign (CLOB has no midpoint/liquidity for the
 * token yet, or server tradeability cache) — avoid global error toasts that imply the
 * whole market failed to load.
 */
export const TRPC_QUERY_SILENT_NOT_FOUND_PATHS = new Set<string>([
  "markets.midpoint",
  "markets.calculateMarketPrice",
  "markets.liquidityMetrics",
  /** CLOB often 404s tick for resolved / depleted outcome tokens while the sibling token still has book data. */
  "markets.tickSize",
]);

/**
 * Queries where ALL errors are silenced (no toast). The UI handles these inline
 * (e.g. order form shows "no liquidity" state instead of a global toast).
 */
export const TRPC_QUERY_FULLY_SILENT_PATHS = new Set<string>([
  "markets.calculateMarketPrice",
]);
