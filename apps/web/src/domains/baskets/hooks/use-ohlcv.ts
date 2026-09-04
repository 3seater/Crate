"use client";

import type { Timeframe } from "@doji/types";
import { skipToken, useQuery } from "@tanstack/react-query";
import { STALE_REALTIME, STALE_STABLE } from "@/config/query";
import { trpc } from "@/lib/trpc";

export function useOhlcv(
  poolAddresses: string[] | undefined,
  timeframe: Timeframe
) {
  const is24H = timeframe === "24H";

  return useQuery({
    ...trpc.baskets.getOhlcv.queryOptions(
      poolAddresses && poolAddresses.length > 0
        ? { poolAddresses, timeframe }
        : skipToken
    ),
    staleTime: is24H ? STALE_REALTIME : STALE_STABLE,
    refetchInterval: is24H ? 30_000 : undefined,
  });
}
