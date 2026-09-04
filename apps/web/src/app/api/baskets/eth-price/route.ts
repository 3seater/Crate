import { LRUCache } from "lru-cache";
import { NextResponse } from "next/server";

const cache = new LRUCache<string, number>({ max: 1, ttl: 30_000 });

async function fetchEthPrice(): Promise<number> {
  const hit = cache.get("eth");
  if (hit) { return hit; }

  // Primary: Binance public ticker
  try {
    const r = await fetch("https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT");
    if (r.ok) {
      const j = (await r.json()) as { price?: string };
      const p = Number(j.price);
      if (p > 0) { cache.set("eth", p); return p; }
    }
  } catch { /* fall through */ }

  // Fallback: Coinbase
  const r = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
  if (!r.ok) { throw new Error("ETH price unavailable"); }
  const j = (await r.json()) as { data?: { amount?: string } };
  const p = Number(j.data?.amount);
  if (!p) { throw new Error("ETH price invalid"); }
  cache.set("eth", p);
  return p;
}

export async function GET() {
  try {
    const priceUsd = await fetchEthPrice();
    return NextResponse.json(
      { priceUsd },
      { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}
