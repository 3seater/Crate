/**
 * Self-contained Next.js App Router tRPC handler.
 *
 * Runs basket procedures server-side — no separate API server needed.
 * All logic is inlined here to avoid cross-workspace import issues on Netlify.
 *
 * Set ENSO_API_KEY in Netlify env vars to enable getBundle (buy transactions).
 * getLivePrices, getOhlcv, and getEthPrice work without any env vars.
 */
import { AppError, publicProcedure, router } from "@doji/api";
import type { OhlcvCandle, Timeframe, TokenPrice } from "@doji/types";
import { TRPCError } from "@trpc/server";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { LRUCache } from "lru-cache";
import { z } from "zod";
import { BASKETS } from "@/config/baskets";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const GetLivePricesInput = z.object({
  poolAddresses: z.array(z.string().regex(/^0x[0-9a-fA-F]{40,64}$/)).min(1),
});

const GetOhlcvInput = z.object({
  poolAddresses: z.array(z.string().regex(/^0x[0-9a-fA-F]{40,64}$/)).min(1),
  timeframe: z.enum(["24H", "7D", "30D"]),
});

const GetBundleInput = z.object({
  basketId: z.string().min(1),
  fromAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amountInWei: z.string().regex(/^\d+$/),
  tokenIn: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  isExit: z.boolean().default(false),
  exitBalances: z
    .array(z.object({ address: z.string(), balanceWei: z.string() }))
    .optional(),
});

// ─── Price service ────────────────────────────────────────────────────────────

const GECKO_BASE = "https://api.geckoterminal.com/api/v2";
const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex";
const TIMEFRAME_PARAMS = {
  "24H": { timeframe: "hour", aggregate: 1, limit: 24 },
  "7D": { timeframe: "hour", aggregate: 4, limit: 42 },
  "30D": { timeframe: "day", aggregate: 1, limit: 30 },
} as const;

const livePriceCache = new LRUCache<string, TokenPrice>({
  max: 200,
  ttl: 30_000,
});
const ohlcvCache = new LRUCache<string, OhlcvCandle[]>({
  max: 100,
  ttl: 300_000,
});
const ethPriceCache = new LRUCache<string, number>({ max: 1, ttl: 30_000 });

async function fetchGeckoPrice(poolAddress: string): Promise<TokenPrice> {
  const url = `${GECKO_BASE}/networks/robinhood/pools/${poolAddress}`;
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
  const a = json?.data?.attributes;
  return {
    symbol: a?.base_token_symbol ?? "UNKNOWN",
    address: poolAddress,
    priceUsd: Number(a?.base_token_price_usd ?? 0),
    change24h:
      a?.price_change_percentage?.h24 == null
        ? null
        : Number(a.price_change_percentage.h24),
  };
}

async function fetchDexPrice(poolAddress: string): Promise<TokenPrice> {
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

async function getLivePrices(
  poolAddresses: string[]
): Promise<{ prices: TokenPrice[]; failedSymbols: string[] }> {
  const results: TokenPrice[] = [];
  const failedSymbols: string[] = [];
  await Promise.all(
    poolAddresses.map(async (poolAddress) => {
      const key = `live:${poolAddress}`;
      const cached = livePriceCache.get(key);
      if (cached) {
        results.push(cached);
        return;
      }
      const [geckoResult, dexResult] = await Promise.allSettled([
        fetchGeckoPrice(poolAddress),
        fetchDexPrice(poolAddress),
      ]);
      const gecko =
        geckoResult.status === "fulfilled" ? geckoResult.value : null;
      const dex = dexResult.status === "fulfilled" ? dexResult.value : null;
      if (!(gecko || dex)) {
        failedSymbols.push(poolAddress);
        return;
      }
      const base = gecko ?? dex;
      if (!base) {
        return;
      }
      if (base.priceUsd > 1_000_000_000) {
        failedSymbols.push(poolAddress);
        return;
      }
      const price: TokenPrice = {
        ...base,
        symbol:
          dex?.symbol && dex.symbol !== "UNKNOWN" ? dex.symbol : base.symbol,
        imageUrl: dex?.imageUrl ?? null,
      };
      livePriceCache.set(key, price);
      results.push(price);
    })
  );
  return { prices: results, failedSymbols };
}

async function getOhlcv(
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
      const key = `ohlcv:${timeframe}:${poolAddress}`;
      const cached = ohlcvCache.get(key);
      if (cached) {
        candles[poolAddress] = cached;
        return;
      }
      try {
        const { timeframe: tf, aggregate, limit } = TIMEFRAME_PARAMS[timeframe];
        const url = `${GECKO_BASE}/networks/robinhood/pools/${poolAddress}/ohlcv/${tf}?aggregate=${aggregate}&limit=${limit}&currency=usd`;
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
        const data: OhlcvCandle[] = list.map(
          ([timestamp, open, high, low, close, volume]) => ({
            timestamp,
            open,
            high,
            low,
            close,
            volume,
          })
        );
        ohlcvCache.set(key, data);
        candles[poolAddress] = data;
      } catch {
        failedSymbols.push(poolAddress);
      }
    })
  );
  return { candles, failedSymbols };
}

async function getEthPriceUsd(): Promise<number> {
  const cached = ethPriceCache.get("eth");
  if (cached) {
    return cached;
  }
  try {
    const res = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT"
    );
    if (res.ok) {
      const json = (await res.json()) as { price?: string };
      const price = Number(json.price);
      if (price > 0) {
        ethPriceCache.set("eth", price);
        return price;
      }
    }
  } catch {
    /* fall through */
  }
  const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
  if (!res.ok) {
    throw new Error("ETH price fetch failed");
  }
  const json = (await res.json()) as { data?: { amount?: string } };
  const price = Number(json.data?.amount);
  if (!price || price <= 0) {
    throw new Error("Invalid ETH price");
  }
  ethPriceCache.set("eth", price);
  return price;
}

// ─── Enso client ──────────────────────────────────────────────────────────────

const ENSO_BASE = "https://api.enso.finance/api/v1";
const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;

async function callEnsoBundle(
  fromAddress: `0x${string}`,
  actions: unknown[],
  apiKey: string
) {
  const searchParams = new URLSearchParams({
    chainId: "4663",
    fromAddress,
    routingStrategy: "router",
    receiver: fromAddress,
  });
  const res = await fetch(`${ENSO_BASE}/shortcuts/bundle?${searchParams}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(actions),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AppError({
      code: res.status === 400 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
      message: `Enso API error (${res.status})`,
      why: body || "The routing API returned a non-2xx response",
      fix: "Check input amounts are above the minimum and try again",
    });
  }
  const json = (await res.json()) as {
    tx: { to: string; data: string; value: string };
  };
  return json.tx;
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const webAppRouter = router({
  healthCheck: publicProcedure.query(() => ({ status: "ok" as const })),
  baskets: router({
    getLivePrices: publicProcedure
      .input(GetLivePricesInput)
      .query(({ input }) => getLivePrices(input.poolAddresses)),

    getOhlcv: publicProcedure
      .input(GetOhlcvInput)
      .query(({ input }) => getOhlcv(input.poolAddresses, input.timeframe)),

    getEthPrice: publicProcedure.query(() =>
      getEthPriceUsd().then((priceUsd) => ({ priceUsd }))
    ),

    getBundle: publicProcedure
      .input(GetBundleInput)
      .mutation(async ({ input }) => {
        const basket = BASKETS.find((b) => b.id === input.basketId);
        if (!basket) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: `Basket "${input.basketId}" not found`,
          });
        }
        const apiKey = process.env.ENSO_API_KEY ?? "";
        if (!apiKey) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "ENSO_API_KEY not configured",
          });
        }

        if (input.isExit) {
          const balances = (input.exitBalances ?? []).filter(
            (b) => BigInt(b.balanceWei) > 0n
          );
          if (balances.length === 0) {
            throw new AppError({
              code: "BAD_REQUEST",
              message: "No token balances to exit",
              why: "All balances are zero",
              fix: "Buy into the basket first",
            });
          }
          const actions = balances.map((b) => ({
            protocol: "enso",
            action: "route",
            args: {
              tokenIn: b.address,
              tokenOut: ETH_ADDRESS,
              amountIn: b.balanceWei,
              slippage: 100,
            },
          }));
          const tx = await callEnsoBundle(
            input.fromAddress as `0x${string}`,
            actions,
            apiKey
          );
          return { tx };
        }

        const amountWei = BigInt(input.amountInWei);
        const actions = basket.constituents.map((c) => ({
          protocol: "enso",
          action: "route",
          args: {
            tokenIn: input.tokenIn as `0x${string}`,
            tokenOut: c.address,
            amountIn: (
              (amountWei * BigInt(Math.round(c.weight * 1e6))) /
              BigInt(1e6)
            ).toString(),
            slippage: 50,
          },
        }));
        const tx = await callEnsoBundle(
          input.fromAddress as `0x${string}`,
          actions,
          apiKey
        );
        return { tx };
      }),
  }),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: webAppRouter,
    createContext: () => ({}),
  });

export { handler as GET, handler as POST };
