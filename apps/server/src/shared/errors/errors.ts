/**
 * Structured error handling for Polymarket API clients.
 *
 * Provides typed error classification for all upstream API errors,
 * enabling programmatic retry/display logic.
 */

export const ErrorCode = {
  NETWORK: "NETWORK",
  AUTH: "AUTH",
  RATE_LIMIT: "RATE_LIMIT",
  VALIDATION: "VALIDATION",
  SERVER: "SERVER",
  CIRCUIT_OPEN: "CIRCUIT_OPEN",
  UNKNOWN: "UNKNOWN",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiErrorOptions {
  code: ErrorCode;
  details?: unknown;
  httpStatus: number | null;
  message?: string;
  path: string;
  retryable: boolean;
  retryDelayMs: number | null;
  source: string;
}

export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number | null;
  readonly source: string;
  readonly path: string;
  readonly retryable: boolean;
  readonly retryDelayMs: number | null;
  readonly details?: unknown;

  constructor(options: ApiErrorOptions) {
    const message =
      options.message ??
      `${options.source} API error: ${options.code} for ${options.path}`;
    super(message);
    this.name = "ApiError";
    this.code = options.code;
    this.httpStatus = options.httpStatus;
    this.source = options.source;
    this.path = options.path;
    this.retryable = options.retryable;
    this.retryDelayMs = options.retryDelayMs;
    this.details = options.details;
  }
}

/**
 * Default retry delay in milliseconds for retryable errors
 * when no specific delay is available (e.g., no Retry-After header).
 */
const DEFAULT_RETRY_DELAY_MS = 1000;

/**
 * Parse the Retry-After header value into milliseconds.
 *
 * Supports:
 * - Numeric seconds (e.g., "120" → 120000ms)
 * - HTTP-date format (e.g., "Wed, 21 Oct 2015 07:28:00 GMT")
 *
 * Returns null if the header is missing or unparseable.
 */
function parseRetryAfter(headers?: Headers): number | null {
  if (!headers) {
    return null;
  }

  const retryAfter = headers.get("retry-after");
  if (!retryAfter) {
    return null;
  }

  // Try parsing as numeric seconds
  const seconds = Number(retryAfter);
  if (!Number.isNaN(seconds) && seconds >= 0) {
    return Math.ceil(seconds * 1000);
  }

  // Try parsing as HTTP-date
  const date = new Date(retryAfter);
  if (!Number.isNaN(date.getTime())) {
    const delayMs = date.getTime() - Date.now();
    return delayMs > 0 ? Math.ceil(delayMs) : null;
  }

  return null;
}

/**
 * Classify an HTTP error response into a structured ApiError.
 *
 * Classification rules:
 * - 401, 403 → AUTH, not retryable
 * - 429 → RATE_LIMIT, retryable, delay from Retry-After header or 1000ms
 * - 500-599 → SERVER, retryable
 * - Everything else → UNKNOWN, not retryable
 */
export function classifyHttpError(
  status: number,
  source: string,
  path: string,
  headers?: Headers
): ApiError {
  if (status === 401 || status === 403) {
    return new ApiError({
      code: ErrorCode.AUTH,
      httpStatus: status,
      source,
      path,
      retryable: false,
      retryDelayMs: null,
      message: `${source} API auth error: HTTP ${status} for ${path}`,
    });
  }

  if (status === 429) {
    const retryDelayMs = parseRetryAfter(headers) ?? DEFAULT_RETRY_DELAY_MS;
    return new ApiError({
      code: ErrorCode.RATE_LIMIT,
      httpStatus: status,
      source,
      path,
      retryable: true,
      retryDelayMs,
      message: `${source} API rate limited: HTTP 429 for ${path}`,
    });
  }

  // 425 Too Early: matching engine restarting — retry with backoff
  if (status === 425) {
    return new ApiError({
      code: ErrorCode.SERVER,
      httpStatus: 425,
      source,
      path,
      retryable: true,
      retryDelayMs: DEFAULT_RETRY_DELAY_MS,
      message: `${source} matching engine restarting: HTTP 425 for ${path}`,
    });
  }

  // 503 Service Unavailable: exchange paused or cancel-only — do not retry,
  // the exchange is intentionally down and won't recover in seconds
  if (status === 503) {
    return new ApiError({
      code: ErrorCode.SERVER,
      httpStatus: 503,
      source,
      path,
      retryable: false,
      retryDelayMs: null,
      message: `${source} service unavailable: HTTP 503 for ${path}`,
    });
  }

  if (status >= 500 && status <= 599) {
    return new ApiError({
      code: ErrorCode.SERVER,
      httpStatus: status,
      source,
      path,
      retryable: true,
      retryDelayMs: DEFAULT_RETRY_DELAY_MS,
      message: `${source} API server error: HTTP ${status} for ${path}`,
    });
  }

  return new ApiError({
    code: ErrorCode.UNKNOWN,
    httpStatus: status,
    source,
    path,
    retryable: false,
    retryDelayMs: null,
    message: `${source} API error: HTTP ${status} for ${path}`,
  });
}

/**
 * Classify a network-level error (DNS, timeout, connection refused, etc.)
 * into a structured ApiError.
 */
export function classifyNetworkError(
  error: unknown,
  source: string,
  path: string
): ApiError {
  const message =
    error instanceof Error ? error.message : "Unknown network error";

  return new ApiError({
    code: ErrorCode.NETWORK,
    httpStatus: null,
    source,
    path,
    retryable: true,
    retryDelayMs: DEFAULT_RETRY_DELAY_MS,
    message: `${source} API network error for ${path}: ${message}`,
    details: error,
  });
}
