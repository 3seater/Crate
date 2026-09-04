"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { BASKETS } from "@/config/baskets";
import { useBasketPrices } from "@/domains/baskets/hooks/use-basket-prices";
import { useEthPrice } from "@/domains/baskets/hooks/use-eth-price";
import {
  BuyModal,
  CrateCard,
  type CrateData,
  type PriceMap,
  crates,
} from "@/domains/baskets/components/crate-app";

const ALL_POOL_ADDRESSES = BASKETS.flatMap((b) =>
  b.constituents.map((c) => c.poolAddress)
);

/** Drop-in crate grid with live prices and buy modal — usable on any page. */
export function CrateGrid() {
  const { isConnected } = useAccount();
  const { data: priceData } = useBasketPrices(ALL_POOL_ADDRESSES);
  const ethPriceUsd = useEthPrice();
  const [selected, setSelected] = useState<CrateData | null>(null);

  const priceMap = useMemo<PriceMap>(() => {
    const map: PriceMap = {};
    for (const p of priceData?.prices ?? []) {
      map[p.address.toLowerCase()] = {
        priceUsd: p.priceUsd,
        change24h: p.change24h,
        imageUrl: p.imageUrl,
      };
    }
    return map;
  }, [priceData]);

  return (
    <>
      <div className="crate-grid">
        {crates.map((crate) => (
          <CrateCard
            crate={crate}
            key={crate.id}
            onSelect={setSelected}
            priceMap={priceMap}
          />
        ))}
      </div>

      {selected !== null && (
        <BuyModal
          crate={selected}
          ethPriceUsd={ethPriceUsd}
          isConnected={isConnected}
          onClose={() => setSelected(null)}
          priceMap={priceMap}
        />
      )}
    </>
  );
}
