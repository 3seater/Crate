"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import { STALE_REALTIME } from "@/config/query";

interface TokenPrice {
  address: string;
  symbol: string;
  priceUsd: number;
  change24h: number | null;
  imageUrl?: string | null;
}

async function fetchPrices(pools: string[]): Promise<{ prices: TokenPrice[] }> {
  const res = await fetch(`/api/baskets/prices?pools=${pools.join(",")}`);
  if (!res.ok) {
    throw new Error("Failed to fetch prices");
  }
  return res.json() as Promise<{ prices: TokenPrice[] }>;
}

export function useBasketPrices(poolAddresses: string[] | undefined) {
  return useQuery({
    queryKey: ["basket-prices", poolAddresses],
    queryFn:
      poolAddresses && poolAddresses.length > 0
        ? () => fetchPrices(poolAddresses)
        : skipToken,
    staleTime: STALE_REALTIME,
    refetchInterval: 30_000,
  });
}
