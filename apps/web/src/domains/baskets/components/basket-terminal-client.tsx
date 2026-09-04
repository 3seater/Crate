"use client";

import type { BasketConstituent } from "@doji/types";
import { useBasketPrices } from "@/domains/baskets/hooks/use-basket-prices";
import { BasketChart } from "./basket-chart";
import { ConstituentList } from "./constituent-list";

interface BasketTerminalClientProps {
  constituents: BasketConstituent[];
}

/**
 * Client component that owns the live price subscription and shares
 * price data (including images) with both ConstituentList and BasketChart.
 * This ensures prices update every 30s even if SSR prefetch failed.
 */
export function BasketTerminalClient({
  constituents,
}: BasketTerminalClientProps) {
  const poolAddresses = constituents.map((c) => c.poolAddress);
  const { data: priceData } = useBasketPrices(poolAddresses);

  const prices = priceData?.prices;

  return (
    <>
      <ConstituentList constituents={constituents} prices={prices} />
      <BasketChart constituents={constituents} prices={prices} />
    </>
  );
}
