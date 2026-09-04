/**
 * Preservation property test for expiring filters in useFilteredSearch — Property 6.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 *
 * Verifies that expiring filters (1h, 1d, 1w, 1m) continue to filter markets
 * by end date correctly. The hook uses gammaMarketToDiscoveryCard() to get
 * endDateIso, then computes daysLeft = (endDate - now) / MS_PER_DAY and
 * checks daysLeft <= maxDays[filter].
 *
 * Since useFilteredSearch is a React hook, we test the pure filtering logic
 * directly: compute daysLeft from card.endDateIso and a fixed `now`, then
 * check the threshold.
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { gammaMarketToDiscoveryCard } from "../../apps/web/src/lib/markets/gamma-to-ui";
import type { Market } from "../../apps/web/src/lib/trpc/types";

// ---------------------------------------------------------------------------
// Constants — mirrors useFilteredSearch
// ---------------------------------------------------------------------------

const MAX_DAYS: Record<string, number> = {
  "1h": 1 / 24,
  "1d": 1,
  "1w": 7,
  "1m": 30,
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal Market with a given endDateIso and closed state. */
function makeMarket(opts: {
  endDateIso?: string | null;
  closed?: boolean;
}): Market {
  return {
    question: "Test market?",
    active: true,
    closed: opts.closed ?? false,
    archived: false,
    slug: "test-market",
    outcomePrices: '["0.50","0.50"]',
    volume: 100_000,
    endDateIso: opts.endDateIso ?? null,
  } as Market;
}

/**
 * Replicate the expiring filter logic from useFilteredSearch.
 * Returns true if the market passes the filter.
 */
function passesExpiringFilter(
  market: Market,
  filterKey: string,
  now: number
): boolean {
  if (filterKey === "All") {
    return true;
  }

  const card = gammaMarketToDiscoveryCard(market);
  const max = MAX_DAYS[filterKey] ?? 999;

  if ((market as { closed?: boolean }).closed) {
    return false;
  }
  if (!card.endDateIso) {
    return max >= 999;
  }
  const end = new Date(card.endDateIso).getTime();
  const daysLeft = (end - now) / MS_PER_DAY;
  if (daysLeft < 0) {
    return max >= 999;
  }
  return daysLeft <= max;
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const filterKeyArb = fc.constantFrom("1h", "1d", "1w", "1m");

/** Fixed reference time for deterministic tests. */
const NOW = new Date("2025-06-01T12:00:00Z").getTime();

/**
 * Generate a daysLeft value that spans interesting ranges:
 * negative (past), zero, within each threshold, and beyond 30 days.
 */
const daysLeftArb = fc.oneof(
  fc.double({ min: -30, max: -0.001, noNaN: true }), // past end date
  fc.constant(0), // exactly now
  fc.double({ min: 0.001, max: 1 / 24, noNaN: true }), // within 1h
  fc.double({ min: 1 / 24 + 0.001, max: 1, noNaN: true }), // within 1d but not 1h
  fc.double({ min: 1.001, max: 7, noNaN: true }), // within 1w but not 1d
  fc.double({ min: 7.001, max: 30, noNaN: true }), // within 1m but not 1w
  fc.double({ min: 30.001, max: 365, noNaN: true }) // beyond 1m
);

/** Convert a daysLeft offset to an ISO date string relative to NOW. */
function daysLeftToIso(daysLeft: number): string {
  return new Date(NOW + daysLeft * MS_PER_DAY).toISOString();
}

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe("Property 6 (preservation): expiring filters in useFilteredSearch", () => {
  it("market within threshold passes the filter", () => {
    fc.assert(
      fc.property(filterKeyArb, (filterKey) => {
        const max = MAX_DAYS[filterKey];
        // Market expiring at half the threshold
        const halfMax = max / 2;
        const market = makeMarket({ endDateIso: daysLeftToIso(halfMax) });
        expect(passesExpiringFilter(market, filterKey, NOW)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("market exactly at threshold passes the filter", () => {
    fc.assert(
      fc.property(filterKeyArb, (filterKey) => {
        const max = MAX_DAYS[filterKey];
        const market = makeMarket({ endDateIso: daysLeftToIso(max) });
        expect(passesExpiringFilter(market, filterKey, NOW)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("market beyond threshold fails the filter", () => {
    fc.assert(
      fc.property(filterKeyArb, (filterKey) => {
        const max = MAX_DAYS[filterKey];
        // Market expiring well beyond the threshold
        const market = makeMarket({
          endDateIso: daysLeftToIso(max + 1),
        });
        expect(passesExpiringFilter(market, filterKey, NOW)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("for any daysLeft and filter, result matches daysLeft >= 0 && daysLeft <= max", () => {
    fc.assert(
      fc.property(daysLeftArb, filterKeyArb, (daysLeft, filterKey) => {
        const max = MAX_DAYS[filterKey];
        const market = makeMarket({ endDateIso: daysLeftToIso(daysLeft) });
        const expected = daysLeft >= 0 && daysLeft <= max;
        expect(passesExpiringFilter(market, filterKey, NOW)).toBe(expected);
      }),
      { numRuns: 500 }
    );
  });

  it("closed markets always fail expiring filters", () => {
    fc.assert(
      fc.property(daysLeftArb, filterKeyArb, (daysLeft, filterKey) => {
        const market = makeMarket({
          endDateIso: daysLeftToIso(daysLeft),
          closed: true,
        });
        expect(passesExpiringFilter(market, filterKey, NOW)).toBe(false);
      }),
      { numRuns: 200 }
    );
  });

  it("markets without endDateIso fail all named expiring filters", () => {
    fc.assert(
      fc.property(filterKeyArb, (filterKey) => {
        const market = makeMarket({ endDateIso: null });
        expect(passesExpiringFilter(market, filterKey, NOW)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("markets with past end date fail all named expiring filters", () => {
    fc.assert(
      fc.property(
        fc.double({ min: -365, max: -0.001, noNaN: true }),
        filterKeyArb,
        (daysLeft, filterKey) => {
          const market = makeMarket({ endDateIso: daysLeftToIso(daysLeft) });
          expect(passesExpiringFilter(market, filterKey, NOW)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });

  it("'All' filter passes all non-closed markets regardless of end date", () => {
    fc.assert(
      fc.property(daysLeftArb, (daysLeft) => {
        const market = makeMarket({ endDateIso: daysLeftToIso(daysLeft) });
        expect(passesExpiringFilter(market, "All", NOW)).toBe(true);
      }),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Unit tests — specific boundary cases
// ---------------------------------------------------------------------------

describe("Expiring filter boundary cases", () => {
  for (const [label, max] of Object.entries(MAX_DAYS)) {
    it(`${label}: market expiring in exactly ${max} days passes`, () => {
      const market = makeMarket({ endDateIso: daysLeftToIso(max) });
      expect(passesExpiringFilter(market, label, NOW)).toBe(true);
    });

    it(`${label}: market expiring in ${max + 1} days fails`, () => {
      const market = makeMarket({ endDateIso: daysLeftToIso(max + 1) });
      expect(passesExpiringFilter(market, label, NOW)).toBe(false);
    });
  }

  it("closed market with valid end date fails all filters", () => {
    for (const key of Object.keys(MAX_DAYS)) {
      const market = makeMarket({
        endDateIso: daysLeftToIso(0.01),
        closed: true,
      });
      expect(passesExpiringFilter(market, key, NOW)).toBe(false);
    }
  });

  it("market with no endDateIso fails all named filters", () => {
    for (const key of Object.keys(MAX_DAYS)) {
      expect(
        passesExpiringFilter(makeMarket({ endDateIso: null }), key, NOW)
      ).toBe(false);
    }
  });

  it("market expiring right now (daysLeft=0) passes all filters", () => {
    const market = makeMarket({ endDateIso: daysLeftToIso(0) });
    for (const key of Object.keys(MAX_DAYS)) {
      expect(passesExpiringFilter(market, key, NOW)).toBe(true);
    }
  });
});
