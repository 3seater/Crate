/**
 * Fix-checking property test for gammaMarketToDiscoveryCard() slug — Property 3.
 *
 * **Validates: Requirements 2.3**
 *
 * For any market, the resulting slug is never a condition_id or numeric id —
 * it's either a valid slug string or empty string.
 *
 * The fix uses `market.slug ?? market.market_slug ?? ""` — no fallback to
 * condition_id or numeric id.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gammaMarketToDiscoveryCard } from "../../apps/web/src/lib/markets/gamma-to-ui";
import type { Market } from "../../apps/web/src/lib/trpc/types";

/** Arbitrary for a valid Gamma slug word (lowercase alphanumeric). */
const slugWordArb = fc
  .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), {
    minLength: 1,
    maxLength: 10,
  })
  .map((chars) => chars.join(""));

/** Arbitrary for a valid Gamma slug (lowercase alphanumeric with hyphens). */
const slugArb = fc
  .array(slugWordArb, { minLength: 1, maxLength: 4 })
  .map((parts) => parts.join("-"));

/** Arbitrary for a hex condition_id like "0xabc123...". */
const conditionIdArb = fc
  .array(fc.constantFrom(..."0123456789abcdef"), {
    minLength: 4,
    maxLength: 40,
  })
  .map((chars) => `0x${chars.join("")}`);

/** Arbitrary for a numeric id string like "12345". */
const numericIdArb = fc.nat({ max: 999_999 }).map(String);

/** Build a minimal Market with the given slug-related overrides. */
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

describe("Property 3 (fix-checking): gammaMarketToDiscoveryCard slug is never condition_id or numeric id", () => {
  it("slug is never the condition_id value regardless of slug/market_slug presence", () => {
    fc.assert(
      fc.property(
        conditionIdArb,
        fc.option(slugArb, { nil: undefined }),
        fc.option(slugArb, { nil: undefined }),
        numericIdArb,
        (conditionId, slug, marketSlug, numericId) => {
          const card = gammaMarketToDiscoveryCard(
            makeMarket({
              slug,
              market_slug: marketSlug,
              condition_id: conditionId,
              id: numericId,
            })
          );
          // Slug should never equal the condition_id
          expect(card.slug).not.toBe(conditionId);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("slug is never the numeric id value when slug and market_slug are absent", () => {
    fc.assert(
      fc.property(numericIdArb, conditionIdArb, (numericId, conditionId) => {
        const card = gammaMarketToDiscoveryCard(
          makeMarket({
            slug: undefined,
            market_slug: undefined,
            condition_id: conditionId,
            id: numericId,
          })
        );
        // When no slug or market_slug, result should be "" — never the numeric id
        expect(card.slug).not.toBe(numericId);
        expect(card.slug).toBe("");
      }),
      { numRuns: 200 }
    );
  });

  it("slug never starts with 0x when slug and market_slug are absent", () => {
    fc.assert(
      fc.property(conditionIdArb, numericIdArb, (conditionId, numericId) => {
        const card = gammaMarketToDiscoveryCard(
          makeMarket({
            slug: undefined,
            market_slug: undefined,
            condition_id: conditionId,
            id: numericId,
          })
        );
        // Should be "" — never a hex condition_id
        expect(card.slug.startsWith("0x")).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("slug equals market.slug when slug is present", () => {
    fc.assert(
      fc.property(
        slugArb,
        fc.option(slugArb, { nil: undefined }),
        conditionIdArb,
        numericIdArb,
        (slug, marketSlug, conditionId, numericId) => {
          const card = gammaMarketToDiscoveryCard(
            makeMarket({
              slug,
              market_slug: marketSlug,
              condition_id: conditionId,
              id: numericId,
            })
          );
          expect(card.slug).toBe(slug);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("slug equals market_slug when slug is undefined", () => {
    fc.assert(
      fc.property(
        slugArb,
        conditionIdArb,
        numericIdArb,
        (marketSlug, conditionId, numericId) => {
          const card = gammaMarketToDiscoveryCard(
            makeMarket({
              slug: undefined,
              market_slug: marketSlug,
              condition_id: conditionId,
              id: numericId,
            })
          );
          expect(card.slug).toBe(marketSlug);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('slug is "" when both slug and market_slug are undefined', () => {
    fc.assert(
      fc.property(conditionIdArb, numericIdArb, (conditionId, numericId) => {
        const card = gammaMarketToDiscoveryCard(
          makeMarket({
            slug: undefined,
            market_slug: undefined,
            condition_id: conditionId,
            id: numericId,
          })
        );
        expect(card.slug).toBe("");
      }),
      { numRuns: 200 }
    );
  });
});
