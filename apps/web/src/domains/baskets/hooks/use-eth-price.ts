"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchEthPrice(): Promise<number> {
  const res = await fetch("/api/baskets/eth-price");
  if (!res.ok) {
    throw new Error("ETH price unavailable");
  }
  const json = (await res.json()) as { priceUsd: number };
  return json.priceUsd;
}

export function useEthPrice(): number | undefined {
  const { data } = useQuery({
    queryKey: ["eth-price"],
    queryFn: fetchEthPrice,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 2,
  });
  return data;
}
