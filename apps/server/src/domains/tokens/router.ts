import { publicProcedure, router } from "@doji/api";
import { LRUCache } from "lru-cache";
import { z } from "zod";

const DEXSCREENER_BASE = "https://api.dexscreener.com/latest/dex";
const ROBINHOOD_CHAIN = "robinhood";
const TTL_TOP_TOKENS = 2 * 60 * 1000;

interface DexPair {
  baseToken: { address: string; name: string; symbol: string };
  chainId: string;
  dexId: string;
  fdv?: number;
  info?: { imageUrl?: string };
  liquidity?: { usd?: number };
  marketCap?: number;
  pairAddress: string;
  priceChange?: { h24?: number };
  priceUsd?: string;
  volume?: { h24?: number };
}

interface DexSearchResponse {
  pairs: DexPair[] | null;
}

export interface TopToken {
  address: string;
  change24h: number | null;
  dexId: string;
  imageUrl: string | null;
  liquidity: number;
  marketCap: number;
  name: string;
  poolAddress: string;
  priceUsd: number;
  symbol: string;
  volume24h: number;
}

const topTokensCache = new LRUCache<string, TopToken[]>({
  max: 1,
  ttl: TTL_TOP_TOKENS,
});

const CACHE_KEY = "top-tokens-robinhood";

const SEARCH_QUERIES = [
  "PONS",
  "CASHCAT",
  "AI",
  "BONER",
  "CHUMP",
  "TENDIES",
  "microduck",
  "STONKBROKER",
  "HOOKR",
  "MOO",
  "NUDES",
  "HMM",
  "Index",
  "HIMS",
  "NVDA",
  "SNAP",
];

/** Update the seen map if this pair is for Robinhood Chain and has better liquidity. */
function upsertPair(pair: DexPair, seen: Map<string, TopToken>): void {
  if (pair.chainId !== ROBINHOOD_CHAIN) {
    return;
  }
  const liq = pair.liquidity?.usd ?? 0;
  const key = pair.baseToken.address.toLowerCase();
  const mcap = pair.marketCap ?? pair.fdv ?? 0;
  if (mcap < 100_000) {
    return;
  }
  const existing = seen.get(key);
  if (existing && existing.liquidity >= liq) {
    return;
  }
  seen.set(key, {
    address: pair.baseToken.address,
    symbol: pair.baseToken.symbol,
    name: pair.baseToken.name,
    poolAddress: pair.pairAddress,
    priceUsd: Number(pair.priceUsd ?? 0),
    marketCap: mcap,
    volume24h: pair.volume?.h24 ?? 0,
    change24h: pair.priceChange?.h24 ?? null,
    liquidity: liq,
    imageUrl: pair.info?.imageUrl ?? null,
    dexId: pair.dexId,
  });
}

/** Fetch one search query and upsert results into the seen map. */
async function fetchQuery(
  q: string,
  seen: Map<string, TopToken>
): Promise<void> {
  const res = await fetch(
    `${DEXSCREENER_BASE}/search?q=${encodeURIComponent(q)}`,
    {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    }
  );
  if (!res.ok) {
    return;
  }
  const json = (await res.json()) as DexSearchResponse;
  for (const pair of json.pairs ?? []) {
    upsertPair(pair, seen);
  }
}

async function fetchTopTokens(limit: number): Promise<TopToken[]> {
  const cached = topTokensCache.get(CACHE_KEY);
  if (cached) {
    return cached.slice(0, limit);
  }

  const seen = new Map<string, TopToken>();
  await Promise.allSettled(SEARCH_QUERIES.map((q) => fetchQuery(q, seen)));

  const sorted = [...seen.values()].sort((a, b) => b.marketCap - a.marketCap);
  topTokensCache.set(CACHE_KEY, sorted);
  return sorted.slice(0, limit);
}

export const tokensRouter = router({
  /** Top tokens on Robinhood Chain sorted by market cap. Cached 2 minutes. */
  topTokens: publicProcedure
    .input(z.object({ limit: z.number().int().min(1).max(100).default(50) }))
    .query(async ({ input }) => {
      const tokens = await fetchTopTokens(input.limit);
      return { tokens };
    }),
});
