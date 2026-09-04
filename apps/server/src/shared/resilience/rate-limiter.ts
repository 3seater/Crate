import { logger } from "@doji/logger";
import type {
  DualWindowLimit,
  RateLimit,
  RateLimitConfig,
} from "./rate-limit-config";
import { RATE_LIMIT_CONFIG, SOURCE_TO_FAMILY } from "./rate-limit-config";

interface TokenBucketConfig {
  limit: number;
  windowMs: number;
}

interface PendingRequest {
  resolve: () => void;
  timestamp: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly limit: number;
  private readonly refillRate: number;
  private queue: PendingRequest[] = [];
  private drainTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: TokenBucketConfig) {
    this.limit = config.limit;
    this.tokens = config.limit;
    this.lastRefill = Date.now();
    this.refillRate = config.limit / config.windowMs;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;
    const newTokens = elapsed * this.refillRate;
    this.tokens = Math.min(this.limit, this.tokens + newTokens);
    this.lastRefill = now;
  }

  async acquire(): Promise<void> {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    return await new Promise<void>((resolve) => {
      this.queue.push({ resolve, timestamp: Date.now() });
      this.scheduleDrain();
    });
  }

  tryAcquire(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }

  /** Check if a token is available without consuming it. */
  canAcquire(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  getQueueLength(): number {
    return this.queue.length;
  }

  private scheduleDrain(): void {
    if (this.drainTimer) {
      return;
    }
    const timeForOneToken = 1 / this.refillRate;
    this.drainTimer = setTimeout(() => {
      this.drainTimer = null;
      this.drainQueue();
    }, timeForOneToken);
  }

  private drainQueue(): void {
    this.refill();
    while (this.queue.length > 0 && this.tokens >= 1) {
      this.tokens -= 1;
      const pending = this.queue.shift();
      pending?.resolve();
    }
    if (this.queue.length > 0) {
      this.scheduleDrain();
    }
  }

  destroy(): void {
    if (this.drainTimer) {
      clearTimeout(this.drainTimer);
      this.drainTimer = null;
    }
    for (const pending of this.queue) {
      pending.resolve();
    }
    this.queue = [];
  }
}

export class DualWindowLimiter {
  private readonly burst: TokenBucket;
  private readonly sustained: TokenBucket;

  constructor(config: DualWindowLimit) {
    this.burst = new TokenBucket({
      limit: config.burst.limit,
      windowMs: config.burst.windowMs,
    });
    this.sustained = new TokenBucket({
      limit: config.sustained.limit,
      windowMs: config.sustained.windowMs,
    });
  }

  async acquire(): Promise<void> {
    await Promise.all([this.burst.acquire(), this.sustained.acquire()]);
  }

  tryAcquire(): boolean {
    if (!(this.burst.canAcquire() && this.sustained.canAcquire())) {
      return false;
    }
    // Both have tokens — consume from each
    this.burst.tryAcquire();
    this.sustained.tryAcquire();
    return true;
  }

  getQueueLength(): number {
    return Math.max(
      this.burst.getQueueLength(),
      this.sustained.getQueueLength()
    );
  }

  destroy(): void {
    this.burst.destroy();
    this.sustained.destroy();
  }
}

export interface BackoffConfig {
  baseDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
}

const DEFAULT_BACKOFF: BackoffConfig = {
  baseDelayMs: 1000,
  maxDelayMs: 30_000,
  multiplier: 2,
};

export function computeBackoffDelay(
  attempt: number,
  config: BackoffConfig = DEFAULT_BACKOFF
): number {
  const delay = config.baseDelayMs * config.multiplier ** attempt;
  return Math.min(delay, config.maxDelayMs);
}

// ---------------------------------------------------------------------------
// Limiter Registry — configuration-driven hierarchical rate limiting
// ---------------------------------------------------------------------------

/**
 * Creates a `TokenBucket` or `DualWindowLimiter` from a `RateLimit` config entry.
 */
function createBucketFromConfig(
  config: RateLimit
): TokenBucket | DualWindowLimiter {
  if (config.type === "dual") {
    return new DualWindowLimiter(config);
  }
  return new TokenBucket({ limit: config.limit, windowMs: config.windowMs });
}

/**
 * Matches a request path (and optional method) against a set of endpoint keys.
 *
 * Endpoint keys are either:
 * - A plain path prefix, e.g. `/trades`
 * - A method-prefixed key, e.g. `POST /order`
 *
 * Keys are checked longest-first so the most specific match wins.
 * Returns the matching key or `undefined` if no endpoint matches.
 */
function matchEndpoint(
  endpointKeys: string[],
  path: string,
  method?: string
): string | undefined {
  // Sort by length descending for most-specific-first matching
  const sorted = [...endpointKeys].sort((a, b) => b.length - a.length);

  for (const key of sorted) {
    if (key.includes(" ")) {
      // Method-prefixed key: "POST /order"
      const spaceIdx = key.indexOf(" ");
      const keyMethod = key.slice(0, spaceIdx);
      const keyPath = key.slice(spaceIdx + 1);

      if (
        method &&
        method.toUpperCase() === keyMethod.toUpperCase() &&
        path.startsWith(keyPath)
      ) {
        return key;
      }
    } else if (path.startsWith(key)) {
      return key;
    }
  }

  return;
}

export class LimiterRegistry {
  private readonly config: RateLimitConfig;
  private readonly sourceToFamily: Record<string, string>;
  private readonly buckets = new Map<string, TokenBucket | DualWindowLimiter>();

  constructor(config: RateLimitConfig, sourceToFamily: Record<string, string>) {
    this.config = config;
    this.sourceToFamily = sourceToFamily;
  }

  /**
   * Acquire rate limit tokens for a request.
   *
   * Resolves the API family from the source, matches the request path against
   * endpoint-specific patterns, and acquires tokens from all applicable buckets
   * (endpoint-specific + general).
   */
  async acquire(source: string, path: string, method?: string): Promise<void> {
    const family = this.resolveFamily(source);
    const familyConfig = this.config[family];

    if (!familyConfig) {
      // No config for this family — nothing to enforce
      return;
    }

    const endpointKeys = Object.keys(familyConfig.endpoints);
    const matchedKey = matchEndpoint(endpointKeys, path, method);

    // Always acquire from the general bucket
    const generalBucket = this.getOrCreateBucket(
      `${family}:general`,
      familyConfig.general
    );

    if (matchedKey) {
      const endpointConfig = familyConfig.endpoints[matchedKey];
      if (endpointConfig) {
        const endpointBucket = this.getOrCreateBucket(
          `${family}:endpoint:${matchedKey}`,
          endpointConfig
        );
        // Acquire from both endpoint and general buckets
        await Promise.all([endpointBucket.acquire(), generalBucket.acquire()]);
        return;
      }
    }

    // No endpoint match — only the general bucket applies
    await generalBucket.acquire();
  }

  /** Destroy all buckets and clear the registry. */
  destroyAll(): void {
    for (const bucket of this.buckets.values()) {
      bucket.destroy();
    }
    this.buckets.clear();
  }

  /**
   * Resolve the API family for a given source.
   * Falls back to "general" for unknown sources with a warning.
   */
  private resolveFamily(source: string): string {
    const family = this.sourceToFamily[source];
    if (family) {
      return family;
    }
    logger.warn(
      { source, family: "general" },
      "Unknown rate-limit source, falling back to general family"
    );
    return "general";
  }

  /**
   * Get an existing bucket or lazily create and cache one.
   */
  private getOrCreateBucket(
    cacheKey: string,
    config: RateLimit
  ): TokenBucket | DualWindowLimiter {
    let bucket = this.buckets.get(cacheKey);
    if (!bucket) {
      bucket = createBucketFromConfig(config);
      this.buckets.set(cacheKey, bucket);
    }
    return bucket;
  }
}

// ---------------------------------------------------------------------------
// Shared global registry instance
// ---------------------------------------------------------------------------

/** Shared global rate limiter registry used by the resilient-fetch pipeline. */
export const sharedRegistry = new LimiterRegistry(
  RATE_LIMIT_CONFIG,
  SOURCE_TO_FAMILY
);

/**
 * Destroy all rate limiter buckets in the shared registry.
 * Called during graceful server shutdown to release timers and queued promises.
 */
export function destroyAllLimiters(): void {
  sharedRegistry.destroyAll();
}
