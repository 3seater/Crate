"use client";

import { useQuery } from "@tanstack/react-query";
import { STALE_REALTIME } from "@/config/query";
import { trpc } from "@/lib/trpc";

/** ETH/USD spot price fetched server-side via tRPC. Refreshes every 30s. */
export function useEthPrice(): number | undefined {
  const { data } = useQuery({
    ...trpc.baskets.getEthPrice.queryOptions(),
    staleTime: STALE_REALTIME,
    refetchInterval: 30_000,
  });
  return data?.priceUsd;
}
