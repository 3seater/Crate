"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { BASKETS } from "@/config/baskets";
import { useBasketPrices } from "@/domains/baskets/hooks/use-basket-prices";
import { useEthPrice } from "@/domains/baskets/hooks/use-eth-price";
import { CrateCard, BuyModal } from "@/domains/baskets/components/crate-app";

const ALL_POOL_ADDRESSES = BASKETS.flatMap((b) =>
  b.constituents.map((c) => c.poolAddress)
);

type PriceMap = Record<string, {
  priceUsd: number;
  change24h: number | null;
  imageUrl?: string | null;
}>;

/** Drop-in crate grid with live prices and buy modal — usable on any page. */
export function CrateGrid() {
  const { isConnected } = useAccount();
  const { data: priceData } = useBasketPrices(ALL_POOL_ADDRESSES);
  const ethPriceUsd = useEthPrice();

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

  const crates = useMemo(
    () => BASKETS.map((basket) => ({
      id: basket.id,
      name: basket.name,
      ticker: basket.id.replace(/-/g, "").toUpperCase().slice(0, 8),
      description: basket.description,
      constituents: basket.constituents,
      tokens: basket.constituents.map((c, ci) => ({
        symbol: c.symbol,
        name: c.name,
        address: c.address,
        poolAddress: c.poolAddress,
        weight: Math.round(c.weight * 100),
        rawWeight: c.weight,
        color: (["#d4b2ff","#f0a56a","#8c7bb5","#b9a4c9","#f0b2c9","#caa5f5","#8d779e","#e3cfda"] as const)[ci % 8] ?? "#d4b2ff",
      })),
      color: (["#f0a56a", "#f6bd86", "#d8a878"] as const)[BASKETS.indexOf(basket) % 3] ?? "#f0a56a",
      category: (["Core", "AI & Infra", "Cats"] as const)[BASKETS.indexOf(basket)] ?? "Core",
    })),
    []
  );

  type CrateData = (typeof crates)[number];
  const [selected, setSelected] = useState<CrateData | null>(null);

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
