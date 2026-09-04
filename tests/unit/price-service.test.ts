/**
 * Property 4: DexScreener fallback always attempted when GeckoTerminal fails
 *
 * Validates: Requirements 12.1, 12.2
 *
 * When GeckoTerminal fails for ALL pool addresses, DexScreener MUST be
 * attempted for each pool. The function should return successful results
 * from DexScreener and no failed symbols.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getLivePrices } from "../../apps/server/src/domains/baskets/price-service";

describe("price-service getLivePrices — DexScreener fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Property 4: DexScreener is attempted when GeckoTerminal fails", async () => {
    // Use unique pool addresses to avoid LRU cache hits from other tests
    const pools = ["0xfallback_pool_a", "0xfallback_pool_b"];
    const dexscreenerCalls: string[] = [];

    vi.stubGlobal("fetch", (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes("geckoterminal")) {
        throw new Error("GeckoTerminal unavailable");
      }
      if (urlStr.includes("dexscreener")) {
        dexscreenerCalls.push(urlStr);
        return Promise.resolve(
          new Response(
            JSON.stringify({
              pair: {
                baseToken: { symbol: "WETH" },
                priceUsd: "2000",
                priceChange: { h24: "1.5" },
              },
            }),
            { status: 200 }
          )
        );
      }
      throw new Error(`Unexpected URL: ${urlStr}`);
    });

    const result = await getLivePrices(pools);

    // DexScreener should have been called for both pool addresses
    expect(dexscreenerCalls.length).toBeGreaterThan(0);

    // Both pools should have successfully fetched from DexScreener
    expect(result.prices.length).toBe(2);
    expect(result.failedSymbols.length).toBe(0);

    // Each price entry should reference a pool from the input
    for (const price of result.prices) {
      expect(pools).toContain(price.address);
    }
  });
});
