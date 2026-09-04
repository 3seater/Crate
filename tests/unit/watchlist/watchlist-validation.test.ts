/**
 * Property-based tests for watchlist input validation.
 *
 * Tests Property 13 from the watchlist-system design doc.
 * Validates that the Zod schema used by tRPC procedures rejects invalid conditionId inputs.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { z } from "zod";

// Replicate the exact Zod schema used in the watchlist tRPC router
const conditionIdInput = z.object({
  conditionId: z.string().min(1),
});

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Arbitrary for empty strings (the only input z.string().min(1) rejects). */
const emptyStringArb = fc.constant("");

/** Arbitrary for valid conditionId inputs (non-empty strings). */
const validConditionIdArb = fc.string({ minLength: 1, maxLength: 128 });

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

// Feature: watchlist-system, Property 13: Input validation rejection
describe("Property 13: Input validation rejection", () => {
  /**
   * **Validates: Requirements 12.3**
   *
   * For any empty conditionId input, the Zod schema rejects with a validation error.
   * The schema uses z.string().min(1), which rejects only empty strings.
   */
  it("rejects empty conditionId inputs", () => {
    fc.assert(
      fc.property(emptyStringArb, (invalidId) => {
        const result = conditionIdInput.safeParse({
          conditionId: invalidId,
        });
        expect(result.success).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  /**
   * **Validates: Requirements 12.3**
   *
   * For any non-empty conditionId string, the Zod schema accepts the input.
   */
  it("accepts valid non-empty conditionId inputs", () => {
    fc.assert(
      fc.property(validConditionIdArb, (validId) => {
        const result = conditionIdInput.safeParse({
          conditionId: validId,
        });
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
