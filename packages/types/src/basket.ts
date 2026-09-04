/** A single ERC-20 constituent token within a basket. */
export interface BasketConstituent {
  /** ERC-20 contract address on Robinhood Chain */
  address: `0x${string}`;
  /** Optional CoinGecko coin ID for icon lookup */
  coingeckoId?: string;
  /** Optional direct logo image URL — used as fallback when DexScreener has no image */
  logoUrl?: string;
  /** Display name, e.g. "Wrapped Ether" */
  name: string;
  /** DEX pool address used for price feeds (GeckoTerminal / DexScreener) */
  poolAddress: `0x${string}`;
  /** Token symbol, e.g. "WETH" */
  symbol: string;
  /**
   * Normalized weight in range (0, 1).
   * All weights in a basket MUST sum to 1.0 ± WEIGHT_TOLERANCE.
   */
  weight: number;
}

/** A curated token basket tradeable as a single transaction bundle. */
export interface BasketConfig {
  /** Ordered list of constituent tokens */
  constituents: BasketConstituent[];
  /** Short description shown on cards and terminal header */
  description: string;
  /** URL-safe unique slug, e.g. "defi-blue-chips" */
  id: string;
  /** Display name shown in header and cards */
  name: string;
}

/** A single OHLCV candlestick from GeckoTerminal or DexScreener. */
export interface OhlcvCandle {
  close: number;
  high: number;
  low: number;
  open: number;
  /** Unix timestamp (seconds) */
  timestamp: number;
  volume: number;
}

/** Current price data for a single token. */
export interface TokenPrice {
  address: string;
  /** Percentage price change over the last 24 hours, or null if unavailable. */
  change24h: number | null;
  /** Token icon URL from DexScreener, or null if unavailable. */
  imageUrl?: string | null;
  priceUsd: number;
  symbol: string;
}

/** A single data point on the basket's composite index chart. */
export interface CompositeIndexPoint {
  /** Unix timestamp (seconds) */
  timestamp: number;
  /** Weighted composite value in USD */
  value: number;
}

/** Chart timeframe selector options. */
export type Timeframe = "24H" | "7D" | "30D";

/** Response shape returned by OHLCV fetch utilities. */
export interface OhlcvResponse {
  /** Map of token symbol → OHLCV candles. */
  candles: Record<string, OhlcvCandle[]>;
  /** Symbols for which price data could not be fetched. */
  failedSymbols: string[];
}
