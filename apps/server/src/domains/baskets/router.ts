import { AppError, publicProcedure, router } from "@doji/api";
import { env } from "@doji/env/server";
import { TRPCError } from "@trpc/server";
import { BASKETS } from "../../config/baskets";
import { buildBuyBundle, buildExitBundle } from "./enso-client";
import { getEthPriceUsd, getLivePrices, getOhlcv } from "./price-service";
import {
  GetBundleInputSchema,
  GetLivePricesInputSchema,
  GetOhlcvInputSchema,
} from "./schemas";

/**
 * Baskets tRPC router.
 *
 * Procedures:
 * - getBundle   (mutation) — Build a buy or exit transaction bundle via Enso API.
 * - getLivePrices (query)  — Fetch live token prices from GeckoTerminal/DexScreener.
 * - getOhlcv    (query)    — Fetch OHLCV candlestick history for a timeframe.
 *
 * Requirements: 11.5, 12.4
 */
export const basketsRouter = router({
  /**
   * Build a transaction bundle for buying into or exiting a basket.
   *
   * For a buy, splits `amountInWei` across constituents by weight via Enso routing.
   * For an exit, swaps all non-zero constituent balances back to ETH.
   *
   * Requirements: 11.5
   */
  getBundle: publicProcedure
    .input(GetBundleInputSchema)
    .mutation(async ({ input }) => {
      const basket = BASKETS.find((b) => b.id === input.basketId);
      if (!basket) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: `Basket "${input.basketId}" not found`,
        });
      }

      if (input.isExit) {
        if (!input.exitBalances?.length) {
          throw new AppError({
            code: "BAD_REQUEST",
            message: "exitBalances required for exit flow",
            why: "The exit flow requires current token balances to build the swap bundle",
            fix: "Include exitBalances for each constituent token in the request",
          });
        }

        const tx = await buildExitBundle({
          fromAddress: input.fromAddress as `0x${string}`,
          exitBalances: input.exitBalances.map((b) => ({
            address: b.address as `0x${string}`,
            balanceWei: b.balanceWei,
          })),
          apiKey: env.ENSO_API_KEY,
        });

        return { tx };
      }

      const tx = await buildBuyBundle({
        fromAddress: input.fromAddress as `0x${string}`,
        constituents: basket.constituents.map((c) => ({
          address: c.address,
          weight: c.weight,
        })),
        inputAmountWei: BigInt(input.amountInWei),
        tokenIn: input.tokenIn as `0x${string}`,
        apiKey: env.ENSO_API_KEY,
      });

      return { tx };
    }),

  /**
   * Fetch ETH/USD spot price from Binance (server-side, no CORS).
   * Falls back to Coinbase if Binance fails.
   */
  getEthPrice: publicProcedure.query(async () => {
    const price = await getEthPriceUsd();
    return { priceUsd: price };
  }),

  /**
   * Fetch live prices for one or more pool addresses.
   * Returns partial results if some sources fail — see price-service.ts.
   *
   * Requirements: 12.4
   */
  getLivePrices: publicProcedure
    .input(GetLivePricesInputSchema)
    .query(async ({ input }) => getLivePrices(input.poolAddresses)),

  /**
   * Fetch OHLCV candlestick history for one or more pool addresses and a timeframe.
   * Returns partial results if some sources fail — see price-service.ts.
   *
   * Requirements: 12.4
   */
  getOhlcv: publicProcedure
    .input(GetOhlcvInputSchema)
    .query(async ({ input }) => getOhlcv(input.poolAddresses, input.timeframe)),
});
