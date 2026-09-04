"use client";

import type { OhlcvCandle, Timeframe } from "@doji/types";
import { skipToken, useQuery } from "@tanstack/react-query";
import { STALE_REALTIME, STALE_STABLE } from "@/config/query";

async function fetchOhlcv(
  pools: string[],
  timeframe: Timeframe
): Promise<{ candles: Record<string, OhlcvCandle[]> }> {
  const res = await fetch(
    `/api/baskets/ohlcv?pools=${pools.join(",")}&timeframe=${timeframe}`
  );
  if (!res.ok) {
    throw new Error("Failed to fetch OHLCV");
  }
  return res.json() as Promise<{ candles: Record<string, OhlcvCandle[]> }>;
}

export function useOhlcv(
  poolAddresses: string[] | undefined,
  timeframe: Timeframe
) {
  const is24H = timeframe === "24H";
  return useQuery({
    queryKey: ["ohlcv", poolAddresses, timeframe],
    queryFn:
      poolAddresses && poolAddresses.length > 0
        ? () => fetchOhlcv(poolAddresses, timeframe)
        : skipToken,
    staleTime: is24H ? STALE_REALTIME : STALE_STABLE,
    refetchInterval: is24H ? 30_000 : undefined,
  });
}
