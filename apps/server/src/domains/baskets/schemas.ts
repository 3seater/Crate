import { z } from "zod";

// ─── Constituent ─────────────────────────────────────────────────────────────

export const BasketConstituentSchema = z.object({
  symbol: z.string(),
  address: z.string().regex(/^0x[0-9a-fA-F]{40,64}$/),
  poolAddress: z.string().regex(/^0x[0-9a-fA-F]{40,64}$/),
  weight: z.number().positive(),
});

export type BasketConstituent = z.infer<typeof BasketConstituentSchema>;

// ─── Bundle Input / Output ────────────────────────────────────────────────────

export const GetBundleInputSchema = z.object({
  basketId: z.string().min(1),
  fromAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amountInWei: z.string().regex(/^\d+$/),
  /** ETH = 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee */
  tokenIn: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/)
    .describe("ETH = 0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"),
  isExit: z.boolean().default(false),
  exitBalances: z
    .array(
      z.object({
        address: z.string(),
        balanceWei: z.string(),
      })
    )
    .optional(),
});

export type GetBundleInput = z.infer<typeof GetBundleInputSchema>;

export const TxBundleSchema = z.object({
  to: z.string(),
  data: z.string(),
  value: z.string(),
});

export type TxBundle = z.infer<typeof TxBundleSchema>;

export const GetBundleOutputSchema = z.object({
  tx: TxBundleSchema,
});

export type GetBundleOutput = z.infer<typeof GetBundleOutputSchema>;

// ─── Price Feed Inputs ────────────────────────────────────────────────────────

export const GetLivePricesInputSchema = z.object({
  poolAddresses: z.array(z.string().regex(/^0x[0-9a-fA-F]{40,64}$/)).min(1),
});

export type GetLivePricesInput = z.infer<typeof GetLivePricesInputSchema>;

export const GetOhlcvInputSchema = z.object({
  poolAddresses: z.array(z.string().regex(/^0x[0-9a-fA-F]{40,64}$/)).min(1),
  timeframe: z.enum(["24H", "7D", "30D"]),
});

export type GetOhlcvInput = z.infer<typeof GetOhlcvInputSchema>;

// ─── Price Data Output ────────────────────────────────────────────────────────

export const TokenPriceSchema = z.object({
  symbol: z.string(),
  address: z.string(),
  priceUsd: z.number(),
  change24h: z.number().nullable(),
});

export type TokenPrice = z.infer<typeof TokenPriceSchema>;

/**
 * A single OHLCV candlestick as a fixed-length tuple:
 * [timestamp, open, high, low, close, volume]
 */
export const OhlcvCandleSchema = z.tuple([
  z.number(), // timestamp (unix seconds)
  z.number(), // open
  z.number(), // high
  z.number(), // low
  z.number(), // close
  z.number(), // volume
]);

export type OhlcvCandle = z.infer<typeof OhlcvCandleSchema>;

export const OhlcvResponseSchema = z.object({
  /** Symbol → OHLCV candle array */
  candles: z.record(z.string(), z.array(OhlcvCandleSchema)),
  /** Symbols for which all price sources failed */
  failedSymbols: z.array(z.string()),
});

export type OhlcvResponse = z.infer<typeof OhlcvResponseSchema>;
