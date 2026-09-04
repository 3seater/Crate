/**
 * Per-API-source circuit breaker with three states.
 *
 * Tracks consecutive failures to an upstream API and temporarily
 * stops sending requests when a failure threshold is exceeded.
 *
 * State transitions:
 * - CLOSED: normal operation. Failures increment counter. When counter ≥ threshold → OPEN.
 * - OPEN: all requests rejected immediately. After cooldownMs → HALF_OPEN.
 * - HALF_OPEN: one request allowed through. Success → CLOSED. Failure → OPEN.
 */

import { logger } from "@doji/logger";
import { ApiError, ErrorCode } from "../errors/errors";

const MAX_FAILURE_SUMMARY_LEN = 500;

function summarizeFailureReason(reason: unknown): string {
  if (reason instanceof ApiError) {
    const parts = [
      reason.code,
      reason.httpStatus == null ? null : `HTTP ${reason.httpStatus}`,
      reason.path ? `path=${reason.path}` : null,
      reason.message,
    ].filter(Boolean);
    return parts.join(" | ").slice(0, MAX_FAILURE_SUMMARY_LEN);
  }
  if (reason instanceof Error) {
    return reason.message.slice(0, MAX_FAILURE_SUMMARY_LEN);
  }
  try {
    return JSON.stringify(reason).slice(0, MAX_FAILURE_SUMMARY_LEN);
  } catch {
    return String(reason).slice(0, MAX_FAILURE_SUMMARY_LEN);
  }
}

export const CircuitState = {
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN",
} as const;

export type CircuitState = (typeof CircuitState)[keyof typeof CircuitState];

export interface CircuitBreakerConfig {
  cooldownMs: number;
  failureThreshold: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  cooldownMs: 30_000,
};

export class CircuitBreaker {
  private readonly source: string;
  private readonly config: CircuitBreakerConfig;

  private currentState: CircuitState = CircuitState.CLOSED;
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenRequestAllowed = false;
  /** Last upstream error that contributed to failure count (why the circuit may trip). */
  private lastFailureSummary: string | null = null;

  constructor(source: string, config?: Partial<CircuitBreakerConfig>) {
    this.source = source;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  get state(): CircuitState {
    if (this.currentState === CircuitState.OPEN) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.cooldownMs) {
        this.currentState = CircuitState.HALF_OPEN;
        this.halfOpenRequestAllowed = true;
      }
    }
    return this.currentState;
  }

  /**
   * Call before making a request.
   * Throws ApiError with CIRCUIT_OPEN if the circuit is open.
   * In HALF_OPEN state, allows exactly one request through.
   */
  preRequest(): void {
    const currentState = this.state;

    if (currentState === CircuitState.OPEN) {
      throw new ApiError({
        code: ErrorCode.CIRCUIT_OPEN,
        httpStatus: null,
        source: this.source,
        path: "",
        retryable: false,
        retryDelayMs: null,
        message: `Circuit breaker is open for ${this.source}`,
        details: {
          lastFailure: this.lastFailureSummary,
          state: "OPEN" as const,
        },
      });
    }

    if (currentState === CircuitState.HALF_OPEN) {
      if (!this.halfOpenRequestAllowed) {
        throw new ApiError({
          code: ErrorCode.CIRCUIT_OPEN,
          httpStatus: null,
          source: this.source,
          path: "",
          retryable: false,
          retryDelayMs: null,
          message: `Circuit breaker is half-open for ${this.source}, request already in flight`,
          details: { state: "HALF_OPEN_IN_FLIGHT" as const },
        });
      }
      this.halfOpenRequestAllowed = false;
    }
  }

  /**
   * Call after a successful request.
   * Resets failure count and transitions HALF_OPEN → CLOSED.
   */
  onSuccess(): void {
    this.failures = 0;
    this.currentState = CircuitState.CLOSED;
    this.lastFailureSummary = null;
  }

  /**
   * Call after a failed request.
   * Increments failures. Transitions CLOSED → OPEN if threshold met.
   * Transitions HALF_OPEN → OPEN immediately.
   */
  onFailure(reason: unknown): void {
    this.lastFailureSummary = summarizeFailureReason(reason);
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.currentState === CircuitState.HALF_OPEN) {
      this.currentState = CircuitState.OPEN;
      logger.warn(
        {
          source: this.source,
          lastFailure: this.lastFailureSummary,
          failureCount: this.failures,
        },
        "Circuit breaker re-opened (half-open probe failed)"
      );
      return;
    }

    if (
      this.currentState === CircuitState.CLOSED &&
      this.failures >= this.config.failureThreshold
    ) {
      this.currentState = CircuitState.OPEN;
      logger.warn(
        {
          source: this.source,
          failureCount: this.failures,
          threshold: this.config.failureThreshold,
          lastFailure: this.lastFailureSummary,
        },
        "Circuit breaker tripped — upstream calls short-circuited until cooldown"
      );
    }
  }

  /**
   * Resets the circuit breaker to CLOSED state with zero failures.
   */
  reset(): void {
    this.currentState = CircuitState.CLOSED;
    this.failures = 0;
    this.lastFailureTime = 0;
    this.halfOpenRequestAllowed = false;
    this.lastFailureSummary = null;
  }
}
