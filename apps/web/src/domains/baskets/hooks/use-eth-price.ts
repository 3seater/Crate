"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchEthPrice(): Promise<number> {
  // Try CoinGecko first
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
      { headers: { Accept: "application/json" } }
    );
    if (res.ok) {
      const json = (await res.json()) as { ethereum?: { usd?: number } };
      const price = json.ethereum?.usd;
      if (price && price > 0) {
        return price;
      }
    }
  } catch {
    // fall through to next source
  }

  // Fallback: Binance public API (no auth, no rate limit for light use)
  try {
    const res = await fetch(
      "https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT"
    );
    if (res.ok) {
      const json = (await res.json()) as { price?: string };
      const price = Number(json.price);
      if (price > 0) {
        return price;
      }
    }
  } catch {
    // fall through
  }

  // Second fallback: Coinbase
  const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
  if (!res.ok) {
    throw new Error("All ETH price sources failed");
  }
  const json = (await res.json()) as { data?: { amount?: string } };
  const price = Number(json.data?.amount);
  if (!price || price <= 0) {
    throw new Error("Invalid ETH price");
  }
  return price;
}

/** Fetches ETH/USD spot price with multiple fallbacks. Refreshes every 60s. */
export function useEthPrice(): number | undefined {
  const { data } = useQuery({
    queryKey: ["eth-price-usd"],
    queryFn: fetchEthPrice,
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 3,
    retryDelay: 1000,
  });
  return data ?? undefined;
}
