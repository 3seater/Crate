/**
 * Integration tests for the baskets tRPC router.
 *
 * Uses the tRPC caller pattern (no live server needed). External fetch calls
 * are stubbed with vi.stubGlobal so tests run in CI without network access.
 *
 * Requirements: 11.5, 12.4
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { createCaller } from "../../apps/server/src/routers";
import { createContextInner } from "../../packages/api/src/context";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Address pool — every test that needs a cache-clean address should pick a
 * unique one from here (the price-service has module-level LRU caches that
 * persist between tests in the same worker).
 */
const ADDR_A = "0xabc1230000000000000000000000000000000001" as const;
const ADDR_C = "0xabc1230000000000000000000000000000000003" as const;
const ADDR_D = "0xabc1230000000000000000000000000000000004" as const;
const ADDR_E = "0xabc1230000000000000000000000000000000005" as const;
const ADDR_F = "0xabc1230000000000000000000000000000000006" as const;

/** Alias for the most commonly used address */
const VALID_ADDRESS = ADDR_A;

/** Build a minimal tRPC caller backed by an empty public context */
function buildCaller() {
  const ctx = createContextInner({ session: null });
  return createCaller(ctx);
}

/** Create a fetch mock that returns the given JSON with ok:true */
function mockFetchOk(json: unknown): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => json,
    text: async () => JSON.stringify(json),
  });
}

/** Create a fetch mock that always returns a non-2xx response */
function mockFetchError(status = 500): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({}),
    text: async () => "Internal Server Error",
  });
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("baskets router", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ─── getLivePrices ──────────────────────────────────────────────────────────

  describe("getLivePrices", () => {
    it("returns prices array and failedSymbols when fetch succeeds", async () => {
      const geckoResponse = {
        data: {
          attributes: {
            base_token_symbol: "WETH",
            base_token_price_usd: "3000.50",
            price_change_percentage: { h24: "2.5" },
          },
        },
      };
      vi.stubGlobal("fetch", mockFetchOk(geckoResponse));

      const caller = buildCaller();
      const result = await caller.baskets.getLivePrices({
        poolAddresses: [VALID_ADDRESS],
      });

      expect(result).toHaveProperty("prices");
      expect(result).toHaveProperty("failedSymbols");
      expect(Array.isArray(result.prices)).toBe(true);
      expect(Array.isArray(result.failedSymbols)).toBe(true);
    });

    it("populates price fields from GeckoTerminal response", async () => {
      const geckoResponse = {
        data: {
          attributes: {
            base_token_symbol: "WETH",
            base_token_price_usd: "3000.50",
            price_change_percentage: { h24: "2.5" },
          },
        },
      };
      vi.stubGlobal("fetch", mockFetchOk(geckoResponse));

      const caller = buildCaller();
      const { prices } = await caller.baskets.getLivePrices({
        poolAddresses: [VALID_ADDRESS],
      });

      expect(prices).toHaveLength(1);
      const price = prices[0];
      expect(price?.symbol).toBe("WETH");
      expect(price?.address).toBe(VALID_ADDRESS);
      expect(price?.priceUsd).toBeCloseTo(3000.5);
      expect(price?.change24h).toBeCloseTo(2.5);
    });

    it("adds pool address to failedSymbols when both sources fail", async () => {
      vi.stubGlobal("fetch", mockFetchError(503));

      const caller = buildCaller();
      const result = await caller.baskets.getLivePrices({
        poolAddresses: [ADDR_C],
      });

      expect(result.prices).toHaveLength(0);
      expect(result.failedSymbols).toContain(ADDR_C);
    });

    it("falls back to DexScreener when GeckoTerminal fails", async () => {
      const dexResponse = {
        pair: {
          baseToken: { symbol: "USDG" },
          priceUsd: "1.001",
          priceChange: { h24: "0.1" },
        },
      };

      let callCount = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn().mockImplementation((_url: string) => {
          callCount++;
          // First call (Gecko) fails; second call (DexScreener) succeeds
          if (callCount === 1) {
            return {
              ok: false,
              status: 429,
              json: async () => ({}),
              text: async () => "",
            };
          }
          return {
            ok: true,
            status: 200,
            json: async () => dexResponse,
            text: async () => JSON.stringify(dexResponse),
          };
        })
      );

      const caller = buildCaller();
      const { prices, failedSymbols } = await caller.baskets.getLivePrices({
        poolAddresses: [ADDR_D],
      });

      expect(failedSymbols).toHaveLength(0);
      expect(prices).toHaveLength(1);
      expect(prices[0]?.symbol).toBe("USDG");
    });

    it("handles multiple pool addresses in parallel", async () => {
      const geckoResponse = {
        data: {
          attributes: {
            base_token_symbol: "TOKEN",
            base_token_price_usd: "1.00",
            price_change_percentage: { h24: "0" },
          },
        },
      };
      vi.stubGlobal("fetch", mockFetchOk(geckoResponse));

      const caller = buildCaller();
      const result = await caller.baskets.getLivePrices({
        poolAddresses: [ADDR_E, ADDR_F],
      });

      expect(result.prices).toHaveLength(2);
      expect(result.failedSymbols).toHaveLength(0);
    });

    it("throws BAD_REQUEST when poolAddresses is empty", async () => {
      const caller = buildCaller();

      await expect(
        caller.baskets.getLivePrices({ poolAddresses: [] })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("throws BAD_REQUEST when address format is invalid", async () => {
      const caller = buildCaller();

      await expect(
        caller.baskets.getLivePrices({
          poolAddresses: ["not-an-address"] as any,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  // ─── getOhlcv ───────────────────────────────────────────────────────────────

  describe("getOhlcv", () => {
    it("returns candles record and failedSymbols when fetch succeeds", async () => {
      const geckoOhlcvResponse = {
        data: {
          attributes: {
            ohlcv_list: [
              [1_700_000_000, 2900, 3100, 2800, 3000, 1_000_000],
              [1_700_003_600, 3000, 3200, 2950, 3100, 900_000],
            ],
          },
        },
      };
      vi.stubGlobal("fetch", mockFetchOk(geckoOhlcvResponse));

      const caller = buildCaller();
      const result = await caller.baskets.getOhlcv({
        poolAddresses: [VALID_ADDRESS],
        timeframe: "24H",
      });

      expect(result).toHaveProperty("candles");
      expect(result).toHaveProperty("failedSymbols");
      expect(typeof result.candles).toBe("object");
      expect(Array.isArray(result.failedSymbols)).toBe(true);
    });

    it("returns candles keyed by pool address", async () => {
      const geckoOhlcvResponse = {
        data: {
          attributes: {
            ohlcv_list: [[1_700_000_000, 2900, 3100, 2800, 3000, 1_000_000]],
          },
        },
      };
      vi.stubGlobal("fetch", mockFetchOk(geckoOhlcvResponse));

      const caller = buildCaller();
      const { candles } = await caller.baskets.getOhlcv({
        poolAddresses: [VALID_ADDRESS],
        timeframe: "7D",
      });

      expect(candles).toHaveProperty(VALID_ADDRESS);
      expect(Array.isArray(candles[VALID_ADDRESS])).toBe(true);
    });

    it("adds pool address to failedSymbols when all sources fail", async () => {
      vi.stubGlobal("fetch", mockFetchError(502));

      const caller = buildCaller();
      const result = await caller.baskets.getOhlcv({
        poolAddresses: [VALID_ADDRESS],
        timeframe: "30D",
      });

      expect(result.candles).not.toHaveProperty(VALID_ADDRESS);
      expect(result.failedSymbols).toContain(VALID_ADDRESS);
    });

    it("returns results for all three supported timeframes", async () => {
      const geckoOhlcvResponse = {
        data: { attributes: { ohlcv_list: [] } },
      };
      vi.stubGlobal("fetch", mockFetchOk(geckoOhlcvResponse));

      const caller = buildCaller();

      const [r24h, r7d, r30d] = await Promise.all([
        caller.baskets.getOhlcv({
          poolAddresses: [VALID_ADDRESS],
          timeframe: "24H",
        }),
        caller.baskets.getOhlcv({
          poolAddresses: [VALID_ADDRESS],
          timeframe: "7D",
        }),
        caller.baskets.getOhlcv({
          poolAddresses: [VALID_ADDRESS],
          timeframe: "30D",
        }),
      ]);

      for (const result of [r24h, r7d, r30d]) {
        expect(result).toHaveProperty("candles");
        expect(result).toHaveProperty("failedSymbols");
      }
    });

    it("throws BAD_REQUEST when poolAddresses is empty", async () => {
      const caller = buildCaller();

      await expect(
        caller.baskets.getOhlcv({ poolAddresses: [], timeframe: "24H" })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("throws BAD_REQUEST when timeframe is invalid", async () => {
      const caller = buildCaller();

      await expect(
        caller.baskets.getOhlcv({
          poolAddresses: [VALID_ADDRESS],
          timeframe: "1W" as any,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });

  // ─── getBundle ──────────────────────────────────────────────────────────────

  describe("getBundle", () => {
    it("throws NOT_FOUND for an unknown basketId", async () => {
      const caller = buildCaller();

      await expect(
        caller.baskets.getBundle({
          basketId: "does-not-exist",
          fromAddress: VALID_ADDRESS,
          amountInWei: "1000000000000000000",
          tokenIn: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("returns a transaction bundle for a valid buy", async () => {
      const ensoResponse = {
        tx: {
          to: "0x1234560000000000000000000000000000000001",
          data: "0xdeadbeef",
          value: "0",
        },
      };
      vi.stubGlobal("fetch", mockFetchOk(ensoResponse));

      const caller = buildCaller();
      const result = await caller.baskets.getBundle({
        basketId: "defi-blue-chips",
        fromAddress: VALID_ADDRESS,
        amountInWei: "1000000000000000000",
        tokenIn: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      });

      expect(result).toHaveProperty("tx");
      expect(result.tx).toHaveProperty("to");
      expect(result.tx).toHaveProperty("data");
      expect(result.tx).toHaveProperty("value");
    });

    it("throws BAD_REQUEST for exit without exitBalances", async () => {
      const caller = buildCaller();

      await expect(
        caller.baskets.getBundle({
          basketId: "defi-blue-chips",
          fromAddress: VALID_ADDRESS,
          amountInWei: "0",
          tokenIn: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
          isExit: true,
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("returns a transaction bundle for a valid exit", async () => {
      const ensoResponse = {
        tx: {
          to: "0x1234560000000000000000000000000000000001",
          data: "0xcafebabe",
          value: "0",
        },
      };
      vi.stubGlobal("fetch", mockFetchOk(ensoResponse));

      const caller = buildCaller();
      const result = await caller.baskets.getBundle({
        basketId: "defi-blue-chips",
        fromAddress: VALID_ADDRESS,
        amountInWei: "0",
        tokenIn: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        isExit: true,
        exitBalances: [
          {
            address: "0x4200000000000000000000000000000000000006",
            balanceWei: "500000000000000000",
          },
        ],
      });

      expect(result.tx).toHaveProperty("to");
      expect(result.tx).toHaveProperty("data");
      expect(result.tx).toHaveProperty("value");
    });

    it("throws BAD_REQUEST when fromAddress is invalid", async () => {
      const caller = buildCaller();

      await expect(
        caller.baskets.getBundle({
          basketId: "defi-blue-chips",
          fromAddress: "not-an-address" as any,
          amountInWei: "1000000000000000000",
          tokenIn: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    it("throws BAD_REQUEST when amountInWei is not numeric", async () => {
      const caller = buildCaller();

      await expect(
        caller.baskets.getBundle({
          basketId: "defi-blue-chips",
          fromAddress: VALID_ADDRESS,
          amountInWei: "abc" as any,
          tokenIn: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        })
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });
  });
});
