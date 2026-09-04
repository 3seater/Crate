import { LRUCache } from "lru-cache";
import { NextResponse } from "next/server";

const GECKO = "https://api.geckoterminal.com/api/v2";

interface OhlcvCandle { timestamp: number; open: number; high: number; low: number; close: number; volume: number; }

const PARAMS = {
  "24H": { tf: "hour", agg: 1,  limit: 24 },
  "7D":  { tf: "hour", agg: 4,  limit: 42 },
  "30D": { tf: "day",  agg: 1,  limit: 30 },
} as const;

const cache = new LRUCache<string, OhlcvCandle[]>({ max: 100, ttl: 300_000 });

async function fetchOhlcv(pool: string, timeframe: keyof typeof PARAMS): Promise<OhlcvCandle[]> {
  const key = `ohlcv:${timeframe}:${pool}`;
  const hit = cache.get(key);
  if (hit) { return hit; }

  const { tf, agg, limit } = PARAMS[timeframe];
  const url = `${GECKO}/networks/robinhood/pools/${pool}/ohlcv/${tf}?aggregate=${agg}&limit=${limit}&currency=usd`;
  const res = await fetch(url, { headers: { Accept: "application/json;version=20230302" } });
  if (!res.ok) { return []; }

  const json = (await res.json()) as { data?: { attributes?: { ohlcv_list?: [number,number,number,number,number,number][] } } };
  const list = json?.data?.attributes?.ohlcv_list ?? [];
  const candles: OhlcvCandle[] = list.map(([timestamp, open, high, low, close, volume]) => ({ timestamp, open, high, low, close, volume }));
  cache.set(key, candles);
  return candles;
}

export async function GET(req: Request) {
  const url       = new URL(req.url);
  const pools     = url.searchParams.get("pools")?.split(",").filter(Boolean) ?? [];
  const timeframe = (url.searchParams.get("timeframe") ?? "24H") as keyof typeof PARAMS;

  if (pools.length === 0 || !(timeframe in PARAMS)) {
    return NextResponse.json({ error: "pools and timeframe required" }, { status: 400 });
  }

  const entries = await Promise.all(pools.map(async (p) => [p, await fetchOhlcv(p, timeframe)] as const));
  const candles = Object.fromEntries(entries);

  return NextResponse.json(
    { candles },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}
