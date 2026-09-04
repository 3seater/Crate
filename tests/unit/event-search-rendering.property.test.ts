/**
 * Unit + property test for event search result rendering — Property 4.
 *
 * **Validates: Requirements 2.4**
 *
 * Verifies that event items render correct `/market/{slug}` links and
 * formatted volume using schema-typed data (ValidatedEvent).
 *
 * Since ValidatedEvent has `slug: string` (required) and
 * `volume: z.coerce.number()` (number), the component should:
 * - Always produce `/market/{slug}` hrefs (never "/explore" fallback)
 * - Always format volume as a number (never "—" fallback)
 */
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  formatEventVolume,
  formatVolume,
  getEventHref,
} from "../../apps/web/src/components/layout/global-search-utils";
import type { Event } from "../../apps/web/src/lib/trpc/types";

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Arbitrary for a valid Gamma slug (lowercase alphanumeric with hyphens). */
const slugArb = fc
  .array(
    fc
      .array(fc.constantFrom(..."abcdefghijklmnopqrstuvwxyz0123456789"), {
        minLength: 1,
        maxLength: 10,
      })
      .map((chars) => chars.join("")),
    { minLength: 1, maxLength: 4 }
  )
  .map((parts) => parts.join("-"));

/** Arbitrary for a positive volume number (matching z.coerce.number()). */
const volumeArb = fc.oneof(
  fc.nat({ max: 999 }),
  fc.integer({ min: 1000, max: 999_999 }),
  fc.integer({ min: 1_000_000, max: 100_000_000 })
);

/** Build a minimal ValidatedEvent with the given overrides. */
function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "test-event-1",
    slug: "test-event",
    title: "Test Event",
    description: "",
    markets: [],
    image: "",
    icon: "",
    active: true,
    closed: false,
    archived: false,
    series: [],
    ...overrides,
  } as Event;
}

// ---------------------------------------------------------------------------
// Unit tests — formatVolume
// ---------------------------------------------------------------------------

describe("formatVolume (global-search)", () => {
  it("formats millions with $ and M suffix", () => {
    expect(formatVolume(1_500_000)).toBe("$1.5M");
    expect(formatVolume(1_000_000)).toBe("$1.0M");
  });

  it("formats thousands with $ and k suffix", () => {
    expect(formatVolume(1500)).toBe("$1.5k");
    expect(formatVolume(50_000)).toBe("$50.0k");
  });

  it("formats small values with $ prefix", () => {
    expect(formatVolume(500)).toBe("$500");
    expect(formatVolume(0)).toBe("$0");
  });
});

// ---------------------------------------------------------------------------
// Unit tests — getEventHref
// ---------------------------------------------------------------------------

describe("getEventHref", () => {
  it("returns /market/{slug} for a valid slug", () => {
    expect(getEventHref("us-presidential-election")).toBe(
      "/market/us-presidential-election"
    );
  });

  it("returns /explore for undefined slug", () => {
    expect(getEventHref(undefined)).toBe("/explore");
  });

  it("returns /explore for null slug", () => {
    expect(getEventHref(null)).toBe("/explore");
  });

  it("returns /explore for empty string slug", () => {
    expect(getEventHref("")).toBe("/explore");
  });
});

// ---------------------------------------------------------------------------
// Unit tests — formatEventVolume
// ---------------------------------------------------------------------------

describe("formatEventVolume", () => {
  it("formats a numeric volume with $ prefix", () => {
    expect(formatEventVolume(50_000)).toBe("$50.0k");
  });

  it("returns dash for undefined volume", () => {
    expect(formatEventVolume(undefined)).toBe("—");
  });

  it("formats zero volume", () => {
    expect(formatEventVolume(0)).toBe("$0");
  });
});

// ---------------------------------------------------------------------------
// Unit tests — ValidatedEvent schema guarantees
// ---------------------------------------------------------------------------

describe("ValidatedEvent schema-typed event rendering", () => {
  it("event with required slug always produces /market/{slug} href", () => {
    const event = makeEvent({ slug: "where-will-barron-attend-college" });
    expect(getEventHref(event.slug)).toBe(
      "/market/where-will-barron-attend-college"
    );
  });

  it("event with numeric volume (z.coerce.number) formats correctly", () => {
    const event = makeEvent({ volume: 1_234_567 });
    expect(formatEventVolume(event.volume)).toBe("$1.2M");
  });

  it("event with volume=0 formats as '$0'", () => {
    const event = makeEvent({ volume: 0 });
    expect(formatEventVolume(event.volume)).toBe("$0");
  });
});

// ---------------------------------------------------------------------------
// Property tests — event slug routing
// ---------------------------------------------------------------------------

const MILLIONS_RE = /^\$\d+\.\dM$/;
const THOUSANDS_RE = /^\$\d+\.\dk$/;
const SMALL_RE = /^\$\d+$/;

describe("Property 4: event items render correct /market/{slug} links with schema-typed data", () => {
  it("for any ValidatedEvent with a slug, getEventHref produces /market/{slug}", () => {
    fc.assert(
      fc.property(slugArb, (slug) => {
        const event = makeEvent({ slug });
        const href = getEventHref(event.slug);
        expect(href).toBe(`/market/${slug}`);
        expect(href).not.toBe("/explore");
        expect(href.startsWith("/market/")).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it("for any ValidatedEvent with numeric volume, formatEventVolume never returns dash", () => {
    fc.assert(
      fc.property(volumeArb, (volume) => {
        const event = makeEvent({ volume });
        const formatted = formatEventVolume(event.volume);
        expect(formatted).not.toBe("—");
        expect(typeof formatted).toBe("string");
        expect(formatted.length).toBeGreaterThan(0);
      }),
      { numRuns: 200 }
    );
  });

  it("for any volume, formatVolume returns a string matching expected format", () => {
    fc.assert(
      fc.property(volumeArb, (volume) => {
        const result = formatVolume(volume);
        if (volume >= 1_000_000) {
          expect(result).toMatch(MILLIONS_RE);
        } else if (volume >= 1000) {
          expect(result).toMatch(THOUSANDS_RE);
        } else {
          expect(result).toMatch(SMALL_RE);
        }
      }),
      { numRuns: 200 }
    );
  });

  it("for any slug+volume combo, both href and volume format are valid", () => {
    fc.assert(
      fc.property(slugArb, volumeArb, (slug, volume) => {
        const event = makeEvent({ slug, volume });
        const href = getEventHref(event.slug);
        const vol = formatEventVolume(event.volume);

        // Href is always /market/{slug}
        expect(href).toBe(`/market/${slug}`);
        // Volume is always a formatted string (never dash)
        expect(vol).not.toBe("—");
      }),
      { numRuns: 200 }
    );
  });
});
