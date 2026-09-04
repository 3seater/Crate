import type { BasketConstituent } from "@doji/types";

/** A single row in the allocation breakdown table. */
export interface AllocationLine {
  address: string;
  /** ETH amount allocated to this constituent: amountEth * weight */
  ethAmount: number;
  symbol: string;
  /** Token amount: usdAmount / priceUsd (null if priceUsd unavailable or zero) */
  tokenAmount: number | null;
  /** USD amount: ethAmount * ethPriceUsd (null if ethPriceUsd unavailable) */
  usdAmount: number | null;
  weight: number;
}

/**
 * Computes the per-constituent allocation for a given ETH deposit amount.
 *
 * Key invariant: the sum of all `ethAmount` values equals `amountEth`
 * (within floating-point tolerance).
 *
 * @param constituents - Ordered list of basket constituents with weights summing to 1.0
 * @param amountEth    - Total ETH deposit (e.g. 0.5 for 0.5 ETH)
 * @param priceMap     - Map of poolAddress → { priceUsd } for token USD prices
 * @param ethPriceUsd  - Current ETH/USD price; pass undefined when unavailable
 * @returns            - One AllocationLine per constituent
 */
export function computeAllocation(
  constituents: BasketConstituent[],
  amountEth: number,
  priceMap: Record<string, { priceUsd: number }>,
  ethPriceUsd?: number
): AllocationLine[] {
  return constituents.map((constituent) => {
    const ethAmount = amountEth * constituent.weight;

    const usdAmount = ethPriceUsd == null ? null : ethAmount * ethPriceUsd;

    const priceEntry = priceMap[constituent.poolAddress];
    const priceUsd = priceEntry?.priceUsd;

    const tokenAmount =
      usdAmount != null && priceUsd != null && priceUsd > 0
        ? usdAmount / priceUsd
        : null;

    return {
      symbol: constituent.symbol,
      address: constituent.address,
      weight: constituent.weight,
      ethAmount,
      tokenAmount,
      usdAmount,
    };
  });
}
