"use client";

import { skipToken, useQuery } from "@tanstack/react-query";
import { STALE_REALTIME } from "@/config/query";
import { trpc } from "@/lib/trpc";

/**
 * Fetches live token prices for a set of pool addresses.
 * Refreshes every 30 seconds while the component is mounted.
 *
 * Requirements: 8.1, 8.2
 */
export function useBasketPrices(poolAddresses: string[] | undefined) {
  return useQuery({
    ...trpc.baskets.getLivePrices.queryOptions(
      poolAddresses && poolAddresses.length > 0 ? { poolAddresses } : skipToken
    ),
    staleTime: STALE_REALTIME,
    refetchInterval: 30_000,
  });
}
