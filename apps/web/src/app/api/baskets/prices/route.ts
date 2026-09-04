import { LRUCache } from "lru-cache";
import { NextResponse } from "next/server";

const GECKO = "https://api.geckoterminal.com/api/v2";
const DEX   = "https://api.dexscreener.com/latest/dex";

interface TokenPrice {
  address: string;
  symbol: string;
  priceUsd: number;
  change24h: number | null;
  imageUrl?: string | null;
}

const cache = new LRUCache<string, TokenPrice>({ max: 200, ttl: 30_000 });

async function fetchPrice(pool: string): Promise<TokenPrice | null> {
  const key = `price:${pool}`;
  const hit = cache.get(key);
  if (hit) { return hit; }

  const [gecko, dex] = await Promise.allSettled([
    fetch(`${GECKO}/networks/robinhood/pools/${pool}`, {
      headers: { Accept: "application/json;version=20230302" },
    }).then(async (r) => {
      if (!r.ok) { return null; }
      const j = (await r.json()) as { data?: { attributes?: { base_token_symbol?: string; base_token_price_usd?: string; price_change_percentage?: { h24?: string } } } };
      const a = j?.data?.attributes;
      return a ? { symbol: a.base_token_symbol ?? "UNKNOWN", priceUsd: Number(a.base_token_price_usd ?? 0), change24h: a.price_change_percentage?.h24 == null ? null : Number(a.price_change_percentage.h24), imageUrl: null } : null;
    }),
    fetch(`${DEX}/pairs/robinhood/${pool}`).then(async (r) => {
      if (!r.ok) { return null; }
      const j = (await r.json()) as { pair?: { baseToken?: { symbol?: string }; priceUsd?: string; priceChange?: { h24?: string }; info?: { imageUrl?: string } }; pairs?: Array<{ baseToken?: { symbol?: string }; priceUsd?: string; priceChange?: { h24?: string }; info?: { imageUrl?: string } }> };
      const p = j?.pair ?? j?.pairs?.[0];
      return p ? { symbol: p.baseToken?.symbol ?? "UNKNOWN", priceUsd: Number(p.priceUsd ?? 0), change24h: p.priceChange?.h24 == null ? null : Number(p.priceChange.h24), imageUrl: p.info?.imageUrl ?? null } : null;
    }),
  ]);

  const g = gecko.status === "fulfilled" ? gecko.value : null;
  const d = dex.status   === "fulfilled" ? dex.value   : null;
  if (!g && !d) { return null; }

  const base = g ?? d!;
  if (base.priceUsd > 1_000_000_000) { return null; }

  const price: TokenPrice = {
    address: pool,
    symbol:  d?.symbol && d.symbol !== "UNKNOWN" ? d.symbol : base.symbol,
    priceUsd: base.priceUsd,
    change24h: base.change24h,
    imageUrl: d?.imageUrl ?? null,
  };
  cache.set(key, price);
  return price;
}

export async function GET(req: Request) {
  const url   = new URL(req.url);
  const pools = url.searchParams.get("pools")?.split(",").filter(Boolean) ?? [];
  if (pools.length === 0) {
    return NextResponse.json({ error: "pools param required" }, { status: 400 });
  }

  const results = await Promise.all(pools.map(fetchPrice));
  const prices  = results.filter((p): p is TokenPrice => p !== null);

  return NextResponse.json(
    { prices },
    { headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=20" } }
  );
}
