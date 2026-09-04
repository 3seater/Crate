/**
 * Preservation property test for gammaMarketToDiscoveryCard() slug — Property 3.
 *
 * **Validates: Requirements 2.3**
 *
 * For any market with a valid `slug` field, gammaMarketToDiscoveryCard()
 * returns the same slug as before the fix. The fix only changed the fallback
 * chain when `slug` is undefined; when `slug` is present, it remains the
 * first choice and is returned unchanged.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gammaMarketToDiscoveryCard } from "../../apps/web/src/lib/markets/gamma-to-ui";
import type { Market } from "../../apps/web/src/lib/trpc/types";

/** Arbitrary for a valid slug word (lowercase alphanumeric). */
const slugWordArb = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), {
    minLength: 1,
    maxLength: 12,
  })
  .map((chars) => chars.join(""));

/** Arbitrary for a valid Gamma slug (lowercase alphanumeric with hyphens, non-empty). */
const validSlugArb = fc
  .array(slugWordArb, { minLength: 1, maxLength: 5 })
  .map((parts) => parts.join("-"));

/** Build a minimal Market with the given overrides. */
function makeMarket(overrides: Record<string, unknown> = {}): Market {
  return {
    question: "Test market?",
    active: true,
    closed: false,
    archived: false,
    outcomePrices: ["0.50", "0.50"],
    ...overrides,
  } as Market;
}

describe("Property 3 (preservation): gammaMarketToDiscoveryCard returns slug unchanged when present", () => {
  it("returns the exact slug value for any valid slug string", () => {
    fc.assert(
      fc.property(validSlugArb, (slug) => {
        const card = gammaMarketToDiscoveryCard(makeMarket({ slug }));
        expect(card.slug).toBe(slug);
      }),
      { numRuns: 200 }
    );
  });

  it("returns slug unchanged regardless of market_slug, condition_id, or id values", () => {
    fc.assert(
      fc.property(
        validSlugArb,
        fc.option(validSlugArb, { nil: undefined }),
        fc.option(
          fc
            .array(fc.constantFrom(..."0123456789abcdef"), {
              minLength: 4,
              maxLength: 40,
            })
            .map((chars) => `0x${chars.join("")}`),
          { nil: undefined }
        ),
        fc.option(fc.nat({ max: 999_999 }).map(String), { nil: undefined }),
        (slug, marketSlug, conditionId, numericId) => {
          const card = gammaMarketToDiscoveryCard(
            makeMarket({
              slug,
              market_slug: marketSlug,
              condition_id: conditionId,
              id: numericId,
            })
          );
          // slug field takes priority — returned unchanged
          expect(card.slug).toBe(slug);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("slug is preserved even when other market fields vary", () => {
    fc.assert(
      fc.property(
        validSlugArb,
        fc.boolean(),
        fc.boolean(),
        fc.option(fc.double({ min: 0, max: 1e9, noNaN: true }), {
          nil: undefined,
        }),
        (slug, active, closed, volume) => {
          const card = gammaMarketToDiscoveryCard(
            makeMarket({
              slug,
              active,
              closed,
              volume: volume === undefined ? undefined : String(volume),
            })
          );
          expect(card.slug).toBe(slug);
        }
      ),
      { numRuns: 200 }
    );
  });
});
