import fc from "fast-check";
import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ShareCard } from "../../apps/web/src/components/share-pnl/share-card";
import {
  computePnlPercentage,
  formatPnlForCard,
  formatPriceCentsForCard,
  generateFilename,
  outcomeColorClassForCard,
  pnlColorClass,
  positionToSharePnlData,
  redeemableGroupToSharePnlData,
} from "../../apps/web/src/components/share-pnl/share-pnl-utils";
import type { SharePnlData } from "../../apps/web/src/components/share-pnl/types";

function makeSharePnlData(overrides: Partial<SharePnlData> = {}): SharePnlData {
  return {
    marketTitle: "Test Market",
    marketIcon: null,
    outcome: "Yes",
    avgPrice: 0.5,
    currentPrice: 0.7,
    pnlUsd: 100,
    userAvatar: null,
    username: "testuser",
    slug: "test-market",
    ...overrides,
  };
}

const SLUG_PATTERN = /^[a-z0-9-]+$/;
const FILENAME_PATTERN = /^doji-pnl-.+\.png$/;
const SAFE_STRING_PATTERN = /^[A-Za-z0-9_]+$/;

/** Strip HTML tags and React comment nodes from rendered output for text assertions. */
function stripHtml(html: string): string {
  return html.replace(/<!--.*?-->/g, "").replace(/<[^>]+>/g, "");
}

// Feature: share-pnl, Property 1: Card Content Completeness
describe("Property 1: Card Content Completeness", () => {
  it("rendered ShareCard contains @{username} and marketTitle for any valid inputs", () => {
    // **Validates: Requirements 2.2, 2.4**
    const safeString = fc.stringMatching(SAFE_STRING_PATTERN, { minLength: 1 });
    fc.assert(
      fc.property(safeString, safeString, (username, marketTitle) => {
        const data = makeSharePnlData({ username, marketTitle });
        const html = renderToString(React.createElement(ShareCard, { data }));
        const text = stripHtml(html);
        expect(text).toContain(`@${username}`);
        expect(text).toContain(marketTitle);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: share-pnl, Property 2: Icon Fallback Character
describe("Property 2: Icon Fallback Character", () => {
  it("rendered ShareCard shows icon-fallback with first character of marketTitle when marketIcon is null", () => {
    // **Validates: Requirements 2.3**
    const safeString = fc.stringMatching(SAFE_STRING_PATTERN, { minLength: 1 });
    fc.assert(
      fc.property(safeString, (marketTitle) => {
        const data = makeSharePnlData({ marketTitle, marketIcon: null });
        const html = renderToString(React.createElement(ShareCard, { data }));
        expect(html).toContain('data-testid="icon-fallback"');
        const text = stripHtml(html);
        expect(text).toContain(marketTitle.charAt(0));
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: share-pnl, Property 3: Outcome Pill Color Mapping
describe("Property 3: Outcome Pill Color Mapping", () => {
  it("returns positive classes for any casing of 'yes'", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("yes", "Yes", "YES", "yEs", "yeS", "YeS"),
        (outcome) => {
          expect(outcomeColorClassForCard(outcome)).toBe(
            "bg-positive/10 text-positive"
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns negative classes for any casing of 'no'", () => {
    fc.assert(
      fc.property(fc.constantFrom("no", "No", "NO", "nO"), (outcome) => {
        expect(outcomeColorClassForCard(outcome)).toBe(
          "bg-negative/10 text-negative"
        );
      }),
      { numRuns: 100 }
    );
  });

  it("returns muted classes for arbitrary non-yes/no strings", () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 0 })
          .filter((s) => !["yes", "no"].includes(s.toLowerCase())),
        (outcome) => {
          expect(outcomeColorClassForCard(outcome)).toBe(
            "bg-muted text-muted-foreground"
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: share-pnl, Property 4: Price Formatting in Cents
describe("Property 4: Price Formatting in Cents", () => {
  it("formats any price in [0,1] as cents ending with ¢", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (price) => {
        const result = formatPriceCentsForCard(price);
        expect(result.endsWith("¢")).toBe(true);
        const numericPart = Number(result.slice(0, -1));
        // Value is rounded to 1 decimal place (e.g. 0.999 → 99.9¢, not 100¢)
        const expected = Math.round(price * 1000) / 10;
        expect(numericPart).toBeCloseTo(expected, 5);
      }),
      { numRuns: 100 }
    );
  });

  it("shows whole cents without decimal for round values", () => {
    expect(formatPriceCentsForCard(0.5)).toBe("50¢");
    expect(formatPriceCentsForCard(1.0)).toBe("100¢");
    expect(formatPriceCentsForCard(0)).toBe("0¢");
  });

  it("shows one decimal place for non-whole cent values", () => {
    expect(formatPriceCentsForCard(0.999)).toBe("99.9¢");
    expect(formatPriceCentsForCard(0.242)).toBe("24.2¢");
    expect(formatPriceCentsForCard(0.055)).toBe("5.5¢");
  });
});

// Feature: share-pnl, Property 5: PNL Display Formatting and Color
describe("Property 5: PNL Display Formatting and Color", () => {
  it("uses + prefix for non-negative PNL and - prefix for negative PNL", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (pnl) => {
          const formatted = formatPnlForCard(pnl);
          if (pnl >= 0) {
            expect(formatted.startsWith("+")).toBe(true);
          } else {
            expect(formatted.startsWith("-")).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns correct color class based on PNL sign", () => {
    fc.assert(
      fc.property(
        fc.double({ noNaN: true, noDefaultInfinity: true }),
        (pnl) => {
          if (pnl >= 0) {
            expect(pnlColorClass(pnl)).toBe("text-doji-green");
          } else {
            expect(pnlColorClass(pnl)).toBe("text-loss");
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: share-pnl, Property 6: Download Filename Pattern
describe("Property 6: Download Filename Pattern", () => {
  it("generates filename matching doji-pnl-{slug}.png", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => SLUG_PATTERN.test(s)),
        (slug) => {
          const filename = generateFilename(slug);
          expect(filename).toBe(`doji-pnl-${slug}.png`);
          expect(filename).toMatch(FILENAME_PATTERN);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: share-pnl, Property 7: Data Normalization Produces Valid SharePnlData
describe("Property 7: Data Normalization Produces Valid SharePnlData", () => {
  const slugArb = fc
    .string({ minLength: 1 })
    .filter((s) => SLUG_PATTERN.test(s));

  it("positionToSharePnlData produces valid SharePnlData from Position-like objects", () => {
    fc.assert(
      fc.property(
        fc.record({
          proxyWallet: fc.string({ minLength: 1 }),
          asset: fc.string({ minLength: 1 }),
          conditionId: fc.string({ minLength: 1 }),
          size: fc.double({ min: 0.01, max: 10_000, noNaN: true }),
          avgPrice: fc.double({ min: 0.01, max: 1, noNaN: true }),
          curPrice: fc.double({ min: 0.01, max: 1, noNaN: true }),
          redeemable: fc.constant(false),
          title: fc.string({ minLength: 1 }),
          outcome: fc.string({ minLength: 1 }),
          icon: fc.option(fc.webUrl(), { nil: undefined }),
          eventSlug: fc.option(slugArb, { nil: undefined }),
          realizedPnl: fc.constant(0),
          unrealizedPnl: fc.constant(0),
        }),
        fc.option(fc.webUrl(), { nil: null }),
        fc.string({ minLength: 1 }),
        (position, avatar, username) => {
          const result = positionToSharePnlData(
            position as never,
            avatar,
            username
          );
          expect(result.marketTitle.length).toBeGreaterThan(0);
          expect(typeof result.avgPrice).toBe("number");
          expect(typeof result.currentPrice).toBe("number");
          expect(Number.isFinite(result.pnlUsd)).toBe(true);
          expect(result.username).toBe(username);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("redeemableGroupToSharePnlData produces valid SharePnlData from RedeemableGroup-like objects", () => {
    fc.assert(
      fc.property(
        fc.record({
          conditionId: fc.string({ minLength: 1 }),
          title: fc.string({ minLength: 1 }),
          icon: fc.option(fc.webUrl(), { nil: null }),
          bet: fc.double({ min: 0.01, max: 100_000, noNaN: true }),
          pnl: fc.double({ min: -100_000, max: 100_000, noNaN: true }),
          eventSlug: fc.option(slugArb, { nil: undefined }),
        }),
        fc.option(fc.webUrl(), { nil: null }),
        fc.string({ minLength: 1 }),
        (group, avatar, username) => {
          const result = redeemableGroupToSharePnlData(
            group as never,
            avatar,
            username
          );
          expect(result.marketTitle).toBe(group.title);
          expect(result.marketTitle.length).toBeGreaterThan(0);
          expect(typeof result.avgPrice).toBe("number");
          expect(result.avgPrice).toBeGreaterThanOrEqual(0);
          expect(result.avgPrice).toBeLessThanOrEqual(1);
          expect(result.currentPrice).toBe(1.0);
          expect(Number.isFinite(result.pnlUsd)).toBe(true);
          expect(result.username).toBe(username);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: share-pnl, Property 8: PNL Percentage Computation
describe("Property 8: PNL Percentage Computation", () => {
  it("computes PNL percentage as (pnl / bet) * 100", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 100_000, noNaN: true }),
        fc.double({ min: -100_000, max: 100_000, noNaN: true }),
        (bet, pnl) => {
          const result = computePnlPercentage(pnl, bet);
          const expected = (pnl / bet) * 100;
          expect(result).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });
});
