/**
 * Property 5: Partial results on partial source failure
 *
 * Validates: Requirements 12.1, 12.2
 *
 * When SOME pools fail both GeckoTerminal and DexScreener, the function
 * must return partial results — successful prices for the pools that
 * resolved, and the failed pool addresses in `failedSymbols`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { getLivePrices } from "../../apps/server/src/domains/baskets/price-service";

describe("price-service getLivePrices — partial results", () => {
  afterEach(() => vi.restoreAllMocks());

  it("Property 5: returns partial results when some pools fail both sources", async () => {
    // Use unique pool addresses to avoid LRU cache hits from other tests
    const goodPool = "0xpartial_good_pool";
    const badPool = "0xpartial_bad_pool";

    vi.stubGlobal("fetch", (url: string | URL) => {
      const urlStr = url.toString();
      if (urlStr.includes(goodPool)) {
        // GeckoTerminal success for the good pool
        return Promise.resolve(
          new Response(
            JSON.stringify({
              data: {
                attributes: {
                  base_token_symbol: "WETH",
                  base_token_price_usd: "2000",
                  price_change_percentage: { h24: "1.5" },
                },
              },
            }),
            { status: 200 }
          )
        );
      }
      // Bad pool fails for both GeckoTerminal and DexScreener
      throw new Error("Fetch failed");
    });

    const result = await getLivePrices([goodPool, badPool]);

    // Good pool succeeds, bad pool is recorded as failed
    expect(result.prices.length).toBe(1);
    expect(result.prices[0].address).toBe(goodPool);

    expect(result.failedSymbols).toContain(badPool);
    expect(result.failedSymbols.length).toBe(1);
  });
});
