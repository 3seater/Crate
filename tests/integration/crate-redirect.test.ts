/**
 * Property 3: Route Redirect Coverage
 *
 * For any basket ID in BASKETS, GET /baskets/${id} must respond with a
 * redirect status (301/307/308) and a Location header of /crates/${id}.
 * GET /baskets must redirect to /crates.
 *
 * Requires a running Next.js server. Set INTEGRATION_BASE_URL or NEXT_URL
 * to the base URL of the server (e.g. http://localhost:3000). The suite is
 * skipped entirely when neither variable is present.
 *
 * Validates: Requirements 8.3, 8.4
 */
import { describe, expect, it } from "vitest";

import { BASKETS } from "@/config/baskets";

const BASE_URL = process.env.INTEGRATION_BASE_URL ?? process.env.NEXT_URL;

const REDIRECT_STATUSES = new Set([301, 307, 308]);

describe.skipIf(!BASE_URL)("crate redirect — /baskets → /crates", () => {
  it("should redirect /baskets to /crates", async () => {
    const response = await fetch(`${BASE_URL}/baskets`, { redirect: "manual" });

    expect(
      REDIRECT_STATUSES.has(response.status),
      `expected redirect status (301/307/308), got ${response.status}`
    ).toBe(true);

    expect(response.headers.get("location")).toBe("/crates");
  });

  for (const basket of BASKETS) {
    it(`should redirect /baskets/${basket.id} to /crates/${basket.id}`, async () => {
      const response = await fetch(`${BASE_URL}/baskets/${basket.id}`, {
        redirect: "manual",
      });

      expect(
        REDIRECT_STATUSES.has(response.status),
        `expected redirect status (301/307/308), got ${response.status} for /baskets/${basket.id}`
      ).toBe(true);

      expect(response.headers.get("location")).toBe(`/crates/${basket.id}`);
    });
  }
});
