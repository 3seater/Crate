/**
 * Resilient fetch wrapper that composes all middleware into a single
 * `fetchJson` replacement used by all Polymarket API clients.
 *
 * Pipeline: rateLimiter → dedup → cache → circuitBreaker → retry → fetch + Zod validation
 *
 * Each API client creates its own instance via `createResilientFetch()`,
 * sharing a global cache and deduplicator (keys are namespaced by source).
 */

import { logger } from "@doji/logger";
import type { z } from "zod";
import {
  ApiError,
  classifyHttpError,
  classifyNetworkError,
  ErrorCode,
} from "./errors";
import { buildCacheKey, type QueryParams, TtlCache } from "./resilience/cache";
import { CircuitBreaker } from "./resilience/circuit-breaker";
import { RequestDeduplicator } from "./resilience/deduplicator";
import {
  type LimiterRegistry,
  sharedRegistry,
} from "./resilience/rate-limiter";
import type { RetryConfig } from "./resilience/retry";
import { withRetry } from "./resilience/retry";

/**
 * HTTP 404 from Gamma/Data/etc. usually means "this resource does not exist" (e.g. no public
 * profile for a wallet), not that the upstream is unhealthy. Counting those as circuit-breaker
 * failures trips the shared breaker after a few not-found responses and blocks all calls to that
 * API until cooldown — see events.publicProfile → GET /public-profile (404 = profile not found).
 */
function isBenignNotFoundForCircuit(error: unknown): boolean {
  return error instanceof ApiError && error.httpStatus === 404;
}

export interface ResilientFetchConfig {
  /** Base URL for the upstream API. */
  baseUrl: string;
  /** Cache configuration. Set to `false` to disable caching. */
  cache?: { ttlMs: number } | false;
  /** Whether to enable request deduplication. Defaults to `true`. */
  dedupe?: boolean;
  /** Rate limiter registry instance. Defaults to the shared global registry. */
  rateLimiter?: LimiterRegistry;
  /** Partial retry configuration overrides. */
  retry?: Partial<RetryConfig>;
  /** Identifier for the upstream API source (e.g., "gamma", "data", "clob", "bridge"). */
  source: string;
}

/** Default cache configuration for the shared cache instance. */
const DEFAULT_CACHE_CONFIG = {
  defaultTtlMs: 60_000,
  maxEntries: 1000,
};

/** Shared global cache instance. Keys are namespaced by source. */
const sharedCache = new TtlCache(DEFAULT_CACHE_CONFIG);

/** Shared global deduplicator instance. Keys are namespaced by source. */
const sharedDeduplicator = new RequestDeduplicator();

/**
 * Expose shared instances for testing and monitoring.
 */
export function getSharedCache(): TtlCache {
  return sharedCache;
}

export function getSharedDeduplicator(): RequestDeduplicator {
  return sharedDeduplicator;
}

export function getSharedRegistry(): LimiterRegistry {
  return sharedRegistry;
}

/**
 * Perform the raw HTTP fetch, classify errors, parse JSON, and validate
 * the response against a Zod schema.
 */
// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: param handling + fetch + validation
async function rawFetch<T>(
  baseUrl: string,
  source: string,
  path: string,
  schema: z.ZodType<T>,
  params?: QueryParams
): Promise<T> {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === "") {
        continue;
      }
      if (Array.isArray(value)) {
        for (const v of value) {
          if (v !== undefined && v !== "") {
            url.searchParams.append(key, v);
          }
        }
      } else {
        url.searchParams.set(key, value);
      }
    }
  }

  const FETCH_TIMEOUT_MS = 30_000;
  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    response = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);
  } catch (error) {
    throw classifyNetworkError(error, source, path);
  }

  if (!response.ok) {
    throw classifyHttpError(response.status, source, path, response.headers);
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch (error) {
    throw new ApiError({
      code: ErrorCode.VALIDATION,
      httpStatus: response.status,
      source,
      path,
      retryable: false,
      retryDelayMs: null,
      message: `${source} API returned invalid JSON for ${path}`,
      details: error,
    });
  }

  const result = schema.safeParse(json);
  if (!result.success) {
    const preview = JSON.stringify(json);
    logger.warn(
      {
        source,
        path,
        responsePreview:
          preview.length > 500 ? `${preview.slice(0, 500)}...` : preview,
        zodIssues: result.error.issues,
      },
      `${source} API response validation failed for ${path}`
    );
    throw new ApiError({
      code: ErrorCode.VALIDATION,
      httpStatus: response.status,
      source,
      path,
      retryable: false,
      retryDelayMs: null,
      message: `${source} API response validation failed for ${path}`,
      details: result.error,
    });
  }

  return result.data;
}

/**
 * Create a resilient `fetchJson` function that composes the full middleware
 * pipeline: rateLimiter → dedup → cache → circuitBreaker → retry → fetch + Zod validation.
 *
 * Each API client creates its own instance:
 * ```typescript
 * const fetchJson = createResilientFetch({
 *   source: "gamma",
 *   baseUrl: env.GAMMA_API_URL,
 *   cache: { ttlMs: 60_000 },
 * });
 * ```
 */
export function createResilientFetch(config: ResilientFetchConfig) {
  const {
    source,
    baseUrl,
    cache: cacheConfig,
    retry: retryConfig,
    dedupe: dedupeEnabled = true,
  } = config;

  const rateLimiter = config.rateLimiter ?? sharedRegistry;
  const circuitBreaker = new CircuitBreaker(source);
  const cacheEnabled = cacheConfig !== undefined && cacheConfig !== false;
  const cacheTtlMs = cacheEnabled ? cacheConfig.ttlMs : undefined;

  /**
   * Fetch JSON from the upstream API with full resilience pipeline.
   *
   * @param path - API path (e.g., "/events", "/v1/leaderboard")
   * @param schema - Zod schema to validate the response
   * @param params - Optional query parameters
   * @param method - Optional HTTP method for method-sensitive rate limits (e.g., CLOB trading endpoints)
   * @returns Validated response data
   */
  async function fetchJson<T>(
    path: string,
    schema: z.ZodType<T>,
    params?: QueryParams,
    method?: string
  ): Promise<T> {
    const cacheKey = buildCacheKey(source, path, params);

    // Layer 5 (innermost): raw fetch + Zod validation
    const doFetch = () => rawFetch(baseUrl, source, path, schema, params);

    // Layer 4: retry with exponential backoff
    const doRetry = () => withRetry(doFetch, retryConfig);

    // Layer 3: circuit breaker
    const doCircuitBreaker = async (): Promise<T> => {
      circuitBreaker.preRequest();
      try {
        const result = await doRetry();
        circuitBreaker.onSuccess();
        return result;
      } catch (error) {
        if (
          error instanceof ApiError &&
          error.code === ErrorCode.CIRCUIT_OPEN
        ) {
          throw error;
        }
        if (!isBenignNotFoundForCircuit(error)) {
          circuitBreaker.onFailure(error);
        }
        throw error;
      }
    };

    // Layer 2: cache lookup / store
    const doCache = async (): Promise<T> => {
      if (cacheEnabled) {
        const cached = sharedCache.get<T>(cacheKey);
        if (cached !== undefined) {
          return cached;
        }
      }

      const result = await doCircuitBreaker();

      if (cacheEnabled) {
        sharedCache.set(cacheKey, result, cacheTtlMs);
      }

      return result;
    };

    // Layer 1: request deduplication
    const doDedup = (): Promise<T> => {
      if (dedupeEnabled) {
        return sharedDeduplicator.dedupe(cacheKey, doCache);
      }
      return doCache();
    };

    // Layer 0 (outermost): rate limiting
    await rateLimiter.acquire(source, path, method);

    return doDedup();
  }

  return fetchJson;
}
