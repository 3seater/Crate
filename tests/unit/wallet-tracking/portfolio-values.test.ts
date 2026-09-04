/**
 * Property-based tests for portfolio value mapping (Property 13).
 *
 * Tests pure mapping logic without hitting the database or external APIs.
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Pure logic function extracted from the wallets router
// ---------------------------------------------------------------------------

interface TrackedWallet {
  address: string;
  id: string;
  label: string;
}

interface WalletValue {
  address: string;
  label: string;
  value: number | null;
  walletId: string;
}

/**
 * Map wallet list + Promise.allSettled results into portfolio value entries.
 * Mirrors the logic in the `wallets.values` procedure.
 */
function mapPortfolioValues(
  wallets: TrackedWallet[],
  results: PromiseSettledResult<{ value: number }[]>[]
): WalletValue[] {
  return wallets.map((wallet, i) => {
    const result = results[i];
    let value: number | null = null;
    if (result?.status === "fulfilled") {
      const entries = result.value;
      if (entries.length > 0) {
        value = entries.reduce((sum, e) => sum + e.value, 0);
      } else {
        value = 0;
      }
    }
    return {
      walletId: wallet.id,
      address: wallet.address,
      label: wallet.label,
      value,
    };
  });
}

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/** Random tracked wallet */
const walletArb = fc.record({
  id: fc.uuid(),
  address: fc.stringMatching(/^[0-9a-f]{40}$/).map((hex) => `0x${hex}`),
  label: fc
    .string({ minLength: 1, maxLength: 50 })
    .filter((s) => s.trim().length > 0),
});

/** A fulfilled result with a random portfolio value */
const fulfilledValueArb: fc.Arbitrary<
  PromiseSettledResult<{ value: number }[]>
> = fc
  .array(
    fc.record({ value: fc.float({ min: 0, max: 100_000, noNaN: true }) }),
    { minLength: 0, maxLength: 5 }
  )
  .map((entries) => ({ status: "fulfilled" as const, value: entries }));

/** A rejected result simulating a Data API failure */
const rejectedValueArb: fc.Arbitrary<
  PromiseSettledResult<{ value: number }[]>
> = fc.string().map((reason) => ({ status: "rejected" as const, reason }));

/** Either a fulfilled or rejected result */
const settledResultArb = fc.oneof(fulfilledValueArb, rejectedValueArb);

// ---------------------------------------------------------------------------
// Property Tests
// ---------------------------------------------------------------------------

// Feature: wallet-tracking, Property 13: Portfolio value mapping completeness
describe("Property 13: Portfolio value mapping completeness", () => {
  /**
   * **Validates: Requirements 7.2**
   *
   * For any N wallets, the response contains exactly N entries,
   * one per wallet, with value as number or null.
   */
  it("returns exactly N entries for N wallets, each with value as number or null", () => {
    fc.assert(
      fc.property(
        fc.array(walletArb, { minLength: 0, maxLength: 20 }),
        (wallets) => {
          // Generate one settled result per wallet
          const results: PromiseSettledResult<{ value: number }[]>[] =
            wallets.map((_, i) =>
              i % 2 === 0
                ? { status: "fulfilled" as const, value: [{ value: i * 100 }] }
                : { status: "rejected" as const, reason: "API error" }
            );

          const mapped = mapPortfolioValues(wallets, results);

          // Exactly N entries
          expect(mapped.length).toBe(wallets.length);

          // Each entry maps to the correct wallet
          for (let i = 0; i < wallets.length; i++) {
            expect(mapped[i]?.walletId).toBe(wallets[i]?.id);
            expect(mapped[i]?.address).toBe(wallets[i]?.address);
            expect(mapped[i]?.label).toBe(wallets[i]?.label);
          }

          // Each value is number or null
          for (const entry of mapped) {
            expect(
              typeof entry.value === "number" || entry.value === null
            ).toBe(true);
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  it("fulfilled results produce numeric values, rejected results produce null", () => {
    fc.assert(
      fc.property(
        fc.array(walletArb, { minLength: 1, maxLength: 10 }),
        fc.array(settledResultArb, { minLength: 1, maxLength: 10 }),
        (wallets, rawResults) => {
          // Ensure results array matches wallets length
          const results = wallets.map(
            (_, i) =>
              rawResults.at(i % rawResults.length) as PromiseSettledResult<
                {
                  value: number;
                }[]
              >
          );

          const mapped = mapPortfolioValues(wallets, results);

          expect(mapped.length).toBe(wallets.length);

          for (let i = 0; i < wallets.length; i++) {
            const result = results[i];
            if (result?.status === "fulfilled") {
              expect(typeof mapped[i]?.value).toBe("number");
            } else {
              expect(mapped[i]?.value).toBeNull();
            }
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});
