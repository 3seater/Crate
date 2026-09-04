/**
 * Retry logic with exponential backoff and jitter for retryable API errors.
 *
 * Wraps async functions with configurable retry behavior. Only retries
 * on `ApiError` instances where `retryable` is `true`. Non-retryable
 * errors and non-ApiError errors are rethrown immediately.
 */

import { ApiError } from "../errors";

export interface RetryConfig {
  /** Base delay in milliseconds for exponential backoff. Default: 500 */
  baseDelayMs: number;
  /** Jitter factor as a fraction (±percentage). Default: 0.2 (±20%) */
  jitterFactor: number;
  /** Maximum number of attempts (including the initial call). Default: 3 */
  maxAttempts: number;
  /** Maximum delay in milliseconds (cap for backoff). Default: 10_000 */
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelayMs: 500,
  maxDelayMs: 10_000,
  jitterFactor: 0.2,
};

/**
 * Compute the delay for a given attempt using exponential backoff with jitter.
 *
 * Formula: `min(baseDelayMs * 2^attempt, maxDelayMs) * (1 ± jitterFactor)`
 *
 * @param attempt - Zero-based attempt index (0 = first retry, 1 = second retry, etc.)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function computeDelay(attempt: number, config: RetryConfig): number {
  const exponentialDelay = config.baseDelayMs * 2 ** attempt;
  const clampedDelay = Math.min(exponentialDelay, config.maxDelayMs);

  const jitterMin = 1 - config.jitterFactor;
  const jitterMax = 1 + config.jitterFactor;
  const jitterMultiplier = jitterMin + Math.random() * (jitterMax - jitterMin);

  return Math.round(clampedDelay * jitterMultiplier);
}

/**
 * Default sleep implementation using setTimeout.
 */
function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Options for `withRetry` including internal overrides for testing.
 */
export interface WithRetryOptions {
  /** @internal Override sleep for testing. */
  _sleep?: (ms: number) => Promise<void>;
  config?: Partial<RetryConfig>;
}

/**
 * Execute an async function with retry logic for retryable API errors.
 *
 * - Catches `ApiError` instances and checks the `retryable` flag
 * - Retries with exponential backoff plus jitter up to `maxAttempts`
 * - Non-retryable `ApiError` instances are rethrown immediately
 * - Non-`ApiError` errors are rethrown immediately
 * - After exhausting all attempts, the last error is rethrown
 *
 * @param fn - Async function to execute
 * @param configOrOptions - Optional partial retry configuration or options object
 * @returns The result of the async function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  configOrOptions?: Partial<RetryConfig> | WithRetryOptions
): Promise<T> {
  let resolvedConfig: RetryConfig;
  let sleep: (ms: number) => Promise<void>;

  if (configOrOptions && "_sleep" in configOrOptions) {
    const opts = configOrOptions as WithRetryOptions;
    resolvedConfig = { ...DEFAULT_RETRY_CONFIG, ...opts.config };
    sleep = opts._sleep ?? defaultSleep;
  } else {
    resolvedConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...(configOrOptions as Partial<RetryConfig> | undefined),
    };
    sleep = defaultSleep;
  }

  let lastError: ApiError | undefined;

  for (let attempt = 0; attempt < resolvedConfig.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      // Non-ApiError errors are rethrown immediately
      if (!(error instanceof ApiError)) {
        throw error;
      }

      // Non-retryable ApiErrors are rethrown immediately
      if (!error.retryable) {
        throw error;
      }

      lastError = error;

      // Don't delay after the last attempt
      if (attempt < resolvedConfig.maxAttempts - 1) {
        const delay = computeDelay(attempt, resolvedConfig);
        await sleep(delay);
      }
    }
  }

  // All attempts exhausted — rethrow the last error
  throw lastError;
}
