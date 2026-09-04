/**
 * Unit tests for WebSocket backoff (computeBackoffDelay).
 */
import { describe, expect, it } from "vitest";
import {
  computeBackoffDelay,
  INITIAL_BACKOFF_MS,
  MAX_BACKOFF_MS,
} from "../../../apps/web/src/lib/websocket/backoff";

describe("computeBackoffDelay", () => {
  it("returns initial delay for attempt 0", () => {
    expect(computeBackoffDelay(0)).toBe(INITIAL_BACKOFF_MS);
  });

  it("doubles delay for each attempt", () => {
    expect(computeBackoffDelay(1)).toBe(INITIAL_BACKOFF_MS * 2);
    expect(computeBackoffDelay(2)).toBe(INITIAL_BACKOFF_MS * 4);
    expect(computeBackoffDelay(3)).toBe(INITIAL_BACKOFF_MS * 8);
  });

  it("caps at MAX_BACKOFF_MS", () => {
    const highAttempt = 20;
    expect(computeBackoffDelay(highAttempt)).toBe(MAX_BACKOFF_MS);
  });

  it("accepts custom options", () => {
    expect(computeBackoffDelay(0, { initialMs: 500, maxMs: 5000 })).toBe(500);
    expect(computeBackoffDelay(2, { initialMs: 500, maxMs: 5000 })).toBe(2000);
    expect(computeBackoffDelay(5, { initialMs: 500, maxMs: 5000 })).toBe(5000);
  });

  it("uses defaults when options partially provided", () => {
    expect(computeBackoffDelay(0, { initialMs: 2000 })).toBe(2000);
    expect(computeBackoffDelay(0, { maxMs: 5000 })).toBe(INITIAL_BACKOFF_MS);
  });
});
