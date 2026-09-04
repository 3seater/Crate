/**
 * Preservation property test for volume filters in useFilteredSearch — Property 6.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 *
 * Verifies that volume filters (≥10k, ≥50k, ≥100k, ≥250k) continue to
 * filter markets correctly. The hook uses gammaMarketToDiscoveryCard() to
 * compute volumeNum, then compares against the threshold.
 *
 * Since useFilteredSearch is a React hook, we test the pure filtering logic
 * directly: gammaMarketToDiscoveryCard().volumeNum >= threshold.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gammaMarketToDiscoveryCard } from "../../apps/web/src/lib/markets/gamma-to-ui";
import type { Market } from "../../apps/web/src/lib/trpc/types";

// ---------------------------------------------------------------------------
// Volume thresholds — mirrors useFilteredSearch
// ---------------------------------------------------------------------------

const VOLUME_THRESHOLDS: Record<string, number> = {
  "10k": 10_000,
  "50k": 50_000,
  "100k": 100_000,
  "250k": 250_000,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Market with a given volume. */
function makeMarket(volume: number): Market {
  return {
    question: "Test market?",
    active: true,
    closed: false,
    archived: false,
    slug: "test-market",
    outcomePrices: '["0.50","0.50"]',
    volume,
  } as Market;
}

/**
 * Replicate the volume filtering logic from useFilteredSearch:
 * convert market → card, then check card.volumeNum >= minVol.
 */
function passesVolumeFilter(market: Market, filterKey: string | null): boolean {
  const minVol = filterKey ? (VOLUME_THRESHOLDS[filterKey] ?? 0) : 0;
  const card = gammaMarketToDiscoveryCard(market);
  return card.volumeNum >= minVol;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary for a non-negative volume (covers 0 through large values). */
const volumeArb = fc.oneof(
  fc.constant(0),
  fc.nat({ max: 9999 }),
  fc.integer({ min: 10_000, max: 49_999 }),
  fc.integer({ min: 50_000, max: 99_999 }),
  fc.integer({ min: 100_000, max: 249_999 }),
  fc.integer({ min: 250_000, max: 10_000_000 })
);

/** Arbitrary for a volume filter key. */
const filterKeyArb = fc.constantFrom("10k", "50k", "100k", "250k");

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("Property 6 (preservation): volume filters in useFilteredSearch", () => {
  it("markets with volumeNum >= threshold always pass the filter", () => {
    fc.assert(
      fc.property(filterKeyArb, (filterKey) => {
        const threshold = VOLUME_THRESHOLDS[filterKey];
        // Market at exactly the threshold
        const atThreshold = makeMarket(threshold);
        expect(passesVolumeFilter(atThreshold, filterKey)).toBe(true);

        // Market above the threshold
        const above = makeMarket(threshold + 1);
        expect(passesVolumeFilter(above, filterKey)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("markets with volumeNum < threshold always fail the filter", () => {
    fc.assert(
      fc.property(filterKeyArb, (filterKey) => {
        const threshold = VOLUME_THRESHOLDS[filterKey];
        if (threshold > 0) {
          const below = makeMarket(threshold - 1);
          expect(passesVolumeFilter(below, filterKey)).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("for any volume and filter, the result matches volumeNum >= threshold", () => {
    fc.assert(
      fc.property(volumeArb, filterKeyArb, (volume, filterKey) => {
        const market = makeMarket(volume);
        const card = gammaMarketToDiscoveryCard(market);
        const threshold = VOLUME_THRESHOLDS[filterKey];
        const expected = card.volumeNum >= threshold;
        expect(passesVolumeFilter(market, filterKey)).toBe(expected);
      }),
      { numRuns: 300 }
    );
  });

  it("null filter (no volume filter) passes all markets", () => {
    fc.assert(
      fc.property(volumeArb, (volume) => {
        const market = makeMarket(volume);
        expect(passesVolumeFilter(market, null)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("gammaMarketToDiscoveryCard preserves numeric volume correctly", () => {
    fc.assert(
      fc.property(volumeArb, (volume) => {
        const market = makeMarket(volume);
        const card = gammaMarketToDiscoveryCard(market);
        expect(card.volumeNum).toBe(volume);
      }),
      { numRuns: 200 }
    );
  });

  it("string volume is parsed to number for filtering", () => {
    fc.assert(
      fc.property(volumeArb, filterKeyArb, (volume, filterKey) => {
        // Gamma API sometimes returns volume as a string
        const market = {
          question: "Test?",
          active: true,
          closed: false,
          archived: false,
          slug: "test",
          outcomePrices: '["0.50","0.50"]',
          volume: String(volume),
        } as unknown as Market;
        const card = gammaMarketToDiscoveryCard(market);
        const threshold = VOLUME_THRESHOLDS[filterKey];
        expect(card.volumeNum >= threshold).toBe(volume >= threshold);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests — specific threshold boundaries
// ---------------------------------------------------------------------------

describe("Volume filter boundary cases", () => {
  for (const [label, threshold] of Object.entries(VOLUME_THRESHOLDS)) {
    it(`≥${label}: market at ${threshold} passes`, () => {
      expect(passesVolumeFilter(makeMarket(threshold), label)).toBe(true);
    });

    it(`≥${label}: market at ${threshold - 1} fails`, () => {
      expect(passesVolumeFilter(makeMarket(threshold - 1), label)).toBe(false);
    });

    it(`≥${label}: market at ${threshold + 1} passes`, () => {
      expect(passesVolumeFilter(makeMarket(threshold + 1), label)).toBe(true);
    });
  }

  it("zero volume passes null filter", () => {
    expect(passesVolumeFilter(makeMarket(0), null)).toBe(true);
  });

  it("zero volume fails all named filters", () => {
    for (const key of Object.keys(VOLUME_THRESHOLDS)) {
      expect(passesVolumeFilter(makeMarket(0), key)).toBe(false);
    }
  });
});
