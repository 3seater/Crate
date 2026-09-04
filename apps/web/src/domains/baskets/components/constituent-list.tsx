import type { BasketConstituent, TokenPrice } from "@doji/types";
import { ConstituentListItem } from "./constituent-list-item";

interface ConstituentListProps {
  constituents: BasketConstituent[];
  prices?: TokenPrice[];
}

export function ConstituentList({
  constituents,
  prices,
}: ConstituentListProps) {
  const priceMap = new Map<string, TokenPrice>(
    prices?.map((p) => [p.address.toLowerCase(), p]) ?? []
  );

  return (
    <div className="flex flex-col rounded-md border border-border">
      {/* Header */}
      <div className="flex items-center gap-3 border-border border-b px-3 py-1.5">
        <div className="size-7 shrink-0" />
        <p className="flex-1 font-medium text-text-muted text-xs">Token</p>
        <p className="w-20 text-right font-medium text-text-muted text-xs">
          Price
        </p>
        <p className="w-16 text-right font-medium text-text-muted text-xs">
          24h
        </p>
        <p className="w-10 text-right font-medium text-text-muted text-xs">
          Wt
        </p>
      </div>

      {constituents.map((constituent) => {
        const price = priceMap.get(constituent.poolAddress.toLowerCase());
        return (
          <ConstituentListItem
            constituent={constituent}
            imageUrl={price?.imageUrl}
            key={constituent.poolAddress}
            price={price}
          />
        );
      })}
    </div>
  );
}
