import type { OhlcvCandle, Timeframe, TokenPrice } from "@doji/types";
import { LRUCache } from "lru-cache";

const GECKO_BASE = "https://api.geckoterminal.com/api/v2";
const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex";
const ROBINHOOD_CHAIN_GECKO_ID = "robinhood"; // GeckoTerminal chain slug

/** TTLs in milliseconds */
const TTL_LIVE = 30 * 1000; // 30 seconds for live prices
const TTL_HISTORICAL = 5 * 60 * 1000; // 5 minutes for OHLCV history

/** Timeframe → GeckoTerminal API params */
const TIMEFRAME_PARAMS = {
  "24H": { timeframe: "hour", aggregate: 1, limit: 24 },
  "7D": { timeframe: "hour", aggregate: 4, limit: 42 },
  "30D": { timeframe: "day", aggregate: 1, limit: 30 },
} as const;

const livePriceCache = new LRUCache<string, TokenPrice>({
  max: 200,
  ttl: TTL_LIVE,
});
const ohlcvCache = new LRUCache<string, OhlcvCandle[]>({
  max: 100,
  ttl: TTL_HISTORICAL,
});

// ─── Live prices ──────────────────────────────────────────────────────────────

export async function getLivePrices(poolAddresses: string[]): Promise<{
  prices: TokenPrice[];
  failedSymbols: string[];
}> {
  const results: TokenPrice[] = [];
  const failedSymbols: string[] = [];

  await Promise.all(
    poolAddresses.map(async (poolAddress) => {
      const cacheKey = `live:${poolAddress}`;
      const cached = livePriceCache.get(cacheKey);
      if (cached) {
        results.push(cached);
        return;
      }

      // Run Gecko (price) and DexScreener (image) in parallel
      const [geckoResult, dexResult] = await Promise.allSettled([
        fetchLivePriceGecko(poolAddress),
        fetchLivePriceDexScreener(poolAddress),
      ]);

      const geckoPrice =
        geckoResult.status === "fulfilled" ? geckoResult.value : null;
      const dexPrice =
        dexResult.status === "fulfilled" ? dexResult.value : null;

      if (!(geckoPrice || dexPrice)) {
        failedSymbols.push(poolAddress);
        return;
      }

      const base = geckoPrice ?? dexPrice;
      if (!base) {
        return;
      }
      // Sanity check: reject obviously corrupt prices (> $1B per token is invalid)
      if (base.priceUsd > 1_000_000_000) {
        failedSymbols.push(poolAddress);
        return;
      }
      const price: TokenPrice = {
        ...base,
        // Prefer DexScreener symbol/image (Gecko often returns UNKNOWN)
        symbol:
          dexPrice?.symbol && dexPrice.symbol !== "UNKNOWN"
            ? dexPrice.symbol
            : base.symbol,
        imageUrl: dexPrice?.imageUrl ?? null,
      };
      livePriceCache.set(cacheKey, price);
      results.push(price);
    })
  );

  return { prices: results, failedSymbols };
}
async function fetchLivePriceGecko(poolAddress: string): Promise<TokenPrice> {
  const url = `${GECKO_BASE}/networks/${ROBINHOOD_CHAIN_GECKO_ID}/pools/${poolAddress}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json;version=20230302" },
  });
  if (!res.ok) {
    throw new Error(`GeckoTerminal ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: {
      attributes?: {
        base_token_symbol?: string;
        base_token_price_usd?: string;
        price_change_percentage?: { h24?: string };
      };
    };
  };
  const attrs = json?.data?.attributes;
  return {
    symbol: attrs?.base_token_symbol ?? "UNKNOWN",
    address: poolAddress,
    priceUsd: Number(attrs?.base_token_price_usd ?? 0),
    change24h:
      attrs?.price_change_percentage?.h24 == null
        ? null
        : Number(attrs.price_change_percentage.h24),
  };
}

async function fetchLivePriceDexScreener(
  poolAddress: string
): Promise<TokenPrice> {
  const url = `${DEXSCREENER_BASE}/pairs/robinhood/${poolAddress}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`DexScreener ${res.status}`);
  }
  const json = (await res.json()) as {
    pair?: {
      baseToken?: { symbol?: string };
      priceUsd?: string;
      priceChange?: { h24?: string };
      info?: { imageUrl?: string };
    };
    pairs?: Array<{
      baseToken?: { symbol?: string };
      priceUsd?: string;
      priceChange?: { h24?: string };
      info?: { imageUrl?: string };
    }>;
  };
  const pair = json?.pair ?? json?.pairs?.[0];
  return {
    symbol: pair?.baseToken?.symbol ?? "UNKNOWN",
    address: poolAddress,
    priceUsd: Number(pair?.priceUsd ?? 0),
    change24h:
      pair?.priceChange?.h24 == null ? null : Number(pair.priceChange.h24),
    imageUrl: pair?.info?.imageUrl ?? null,
  };
}

// ─── OHLCV history ────────────────────────────────────────────────────────────

export async function getOhlcv(
  poolAddresses: string[],
  timeframe: Timeframe
): Promise<{
  candles: Record<string, OhlcvCandle[]>;
  failedSymbols: string[];
}> {
  const candles: Record<string, OhlcvCandle[]> = {};
  const failedSymbols: string[] = [];

  await Promise.all(
    poolAddresses.map(async (poolAddress) => {
      const cacheKey = `ohlcv:${timeframe}:${poolAddress}`;
      const cached = ohlcvCache.get(cacheKey);
      if (cached) {
        candles[poolAddress] = cached;
        return;
      }

      try {
        const data = await fetchOhlcvGecko(poolAddress, timeframe);
        ohlcvCache.set(cacheKey, data);
        candles[poolAddress] = data;
      } catch {
        try {
          const data = await fetchOhlcvDexScreener(poolAddress, timeframe);
          ohlcvCache.set(cacheKey, data);
          candles[poolAddress] = data;
        } catch {
          failedSymbols.push(poolAddress);
        }
      }
    })
  );

  return { candles, failedSymbols };
}

async function fetchOhlcvGecko(
  poolAddress: string,
  timeframe: Timeframe
): Promise<OhlcvCandle[]> {
  const { timeframe: tf, aggregate, limit } = TIMEFRAME_PARAMS[timeframe];
  const url = `${GECKO_BASE}/networks/${ROBINHOOD_CHAIN_GECKO_ID}/pools/${poolAddress}/ohlcv/${tf}?aggregate=${aggregate}&limit=${limit}&currency=usd`;
  const res = await fetch(url, {
    headers: { Accept: "application/json;version=20230302" },
  });
  if (!res.ok) {
    throw new Error(`GeckoTerminal OHLCV ${res.status}`);
  }
  const json = (await res.json()) as {
    data?: {
      attributes?: {
        ohlcv_list?: [number, number, number, number, number, number][];
      };
    };
  };
  const list = json?.data?.attributes?.ohlcv_list ?? [];
  return list.map(([timestamp, open, high, low, close, volume]) => ({
    timestamp,
    open,
    high,
    low,
    close,
    volume,
  }));
}

async function fetchOhlcvDexScreener(
  poolAddress: string,
  _timeframe: Timeframe
): Promise<OhlcvCandle[]> {
  // DexScreener free tier does not expose raw OHLCV. We synthesize a single
  // candle from the pair's current price as a best-effort fallback.
  const url = `${DEXSCREENER_BASE}/pairs/robinhood/${poolAddress}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`DexScreener OHLCV ${res.status}`);
  }
  const json = (await res.json()) as {
    pair?: { priceUsd?: string };
    pairs?: Array<{ priceUsd?: string }>;
  };
  const pair = json?.pair ?? json?.pairs?.[0];
  const priceUsd = Number(pair?.priceUsd ?? 0);
  const now = Math.floor(Date.now() / 1000);
  return [
    {
      timestamp: now,
      open: priceUsd,
      high: priceUsd,
      low: priceUsd,
      close: priceUsd,
      volume: 0,
    },
  ];
}
