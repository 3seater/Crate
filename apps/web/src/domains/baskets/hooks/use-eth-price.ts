"use client";

import { useQuery } from "@tanstack/react-query";

/** Fetches ETH/USD spot price from CoinGecko public API. Refreshes every 60s. */
export function useEthPrice(): number | undefined {
  const { data } = useQuery({
    queryKey: ["eth-price-usd"],
    queryFn: async () => {
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd"
      );
      if (!res.ok) { throw new Error("CoinGecko fetch failed"); }
      const json = (await res.json()) as { ethereum?: { usd?: number } };
      return json.ethereum?.usd ?? null;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    retry: 2,
  });
  return data ?? undefined;
}
