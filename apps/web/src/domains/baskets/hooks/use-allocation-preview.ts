"use client";

import { useDebounce } from "@doji/hooks";
import type { BasketConstituent } from "@doji/types";
import { useMemo } from "react";
import type { AllocationLine } from "@/domains/baskets/lib/allocation";
import { computeAllocation } from "@/domains/baskets/lib/allocation";

/**
 * Computes a debounced allocation preview for the buy panel.
 * Debounces the amount input by 500ms to avoid recomputing on every keystroke.
 *
 * Requirements: 8.3, 8.4
 */
export function useAllocationPreview(
  constituents: BasketConstituent[],
  amountEth: number,
  priceMap: Record<string, { priceUsd: number }>,
  ethPriceUsd?: number
): AllocationLine[] {
  const debouncedAmount = useDebounce(amountEth, 500);

  return useMemo(() => {
    if (debouncedAmount <= 0 || constituents.length === 0) {
      return [];
    }
    return computeAllocation(
      constituents,
      debouncedAmount,
      priceMap,
      ethPriceUsd
    );
  }, [constituents, debouncedAmount, priceMap, ethPriceUsd]);
}
