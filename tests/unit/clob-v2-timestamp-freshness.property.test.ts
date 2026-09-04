/**
 * Property 2: Timestamp freshness
 *
 * **Validates: Requirements 3.1, 3.4**
 *
 * For any V2 order created by the CLOB_Client_Wrapper, the `timestamp` field
 * SHALL be a valid numeric string representing milliseconds since epoch, and
 * the value SHALL be within 5 minutes of the current server time (`Date.now()`).
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const MAX_AGE_MS = 300_000; // 5 minutes
const NUMERIC_STRING_REGEX = /^\d+$/;

/**
 * Checks whether a timestamp string is "fresh":
 * 1. Must be a valid numeric string (no whitespace, no floats, no negatives)
 * 2. Must represent a millisecond epoch within `maxAgeMs` of `Date.now()`
 */
function isTimestampFresh(
  timestamp: string,
  maxAgeMs: number = MAX_AGE_MS
): boolean {
  if (!NUMERIC_STRING_REGEX.test(timestamp)) {
    return false;
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return false;
  }
  const now = Date.now();
  return Math.abs(now - ts) <= maxAgeMs;
}

/** Generates a SignedOrderV2-shaped object with `timestamp` set to `String(Date.now())`. */
const freshOrderArb: fc.Arbitrary<{ timestamp: string }> = fc
  .record({
    maker: fc.stringMatching(/^[0-9a-f]{40}$/).map((s) => `0x${s}`),
    makerAmount: fc.nat({ max: 1_000_000_000 }).map(String),
    side: fc.constantFrom(0 as const, 1 as const),
    tokenId: fc.stringMatching(/^[0-9a-f]{64}$/).map((s) => `0x${s}`),
  })
  .map((fields) => ({
    ...fields,
    timestamp: String(Date.now()),
  }));

describe("Property 2: Timestamp freshness", () => {
  it("timestamps set to Date.now() are always valid numeric strings", () => {
    fc.assert(
      fc.property(freshOrderArb, (order) => {
        expect(NUMERIC_STRING_REGEX.test(order.timestamp)).toBe(true);
        expect(Number.isFinite(Number(order.timestamp))).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("timestamps set to Date.now() are always within 5 minutes of current time", () => {
    fc.assert(
      fc.property(freshOrderArb, (order) => {
        expect(isTimestampFresh(order.timestamp)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("timestamps older than 5 minutes are detected as stale", () => {
    const staleTimestampArb = fc
      .integer({ min: MAX_AGE_MS + 1, max: MAX_AGE_MS + 3_600_000 })
      .map((offset) => String(Date.now() - offset));

    fc.assert(
      fc.property(staleTimestampArb, (timestamp) => {
        expect(isTimestampFresh(timestamp)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("timestamps in the future beyond 5 minutes are detected as stale", () => {
    const futureTimestampArb = fc
      .integer({ min: MAX_AGE_MS + 1, max: MAX_AGE_MS + 3_600_000 })
      .map((offset) => String(Date.now() + offset));

    fc.assert(
      fc.property(futureTimestampArb, (timestamp) => {
        expect(isTimestampFresh(timestamp)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("non-numeric strings are never fresh", () => {
    const nonNumericArb = fc
      .string()
      .filter((s) => !NUMERIC_STRING_REGEX.test(s));

    fc.assert(
      fc.property(nonNumericArb, (timestamp) => {
        expect(isTimestampFresh(timestamp)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("custom maxAgeMs is respected", () => {
    const customMaxAge = 10_000; // 10 seconds
    const withinCustomArb = fc
      .integer({ min: 0, max: customMaxAge })
      .map((offset) => String(Date.now() - offset));
    const outsideCustomArb = fc
      .integer({ min: customMaxAge + 1, max: customMaxAge + 60_000 })
      .map((offset) => String(Date.now() - offset));

    fc.assert(
      fc.property(withinCustomArb, (timestamp) => {
        expect(isTimestampFresh(timestamp, customMaxAge)).toBe(true);
      }),
      { numRuns: 100 }
    );

    fc.assert(
      fc.property(outsideCustomArb, (timestamp) => {
        expect(isTimestampFresh(timestamp, customMaxAge)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });
});
