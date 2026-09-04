import type { BasketConstituent, TokenPrice } from "@doji/types";
import Image from "next/image";
import { cn } from "@/utils/cn";

interface ConstituentListItemProps {
  constituent: BasketConstituent;
  imageUrl?: string | null;
  price?: TokenPrice;
}

export function ConstituentListItem({
  constituent,
  imageUrl,
  price,
}: ConstituentListItemProps) {
  const weightPct = `${Math.round(constituent.weight * 100)}%`;

  let priceDisplay = "—";
  if (price != null) {
    if (price.priceUsd < 0.0001) {
      priceDisplay = `$${price.priceUsd.toExponential(2)}`;
    } else if (price.priceUsd < 1) {
      priceDisplay = `$${price.priceUsd.toPrecision(4)}`;
    } else {
      priceDisplay = `$${price.priceUsd.toFixed(2)}`;
    }
  }

  let changeClass = "text-[color:var(--text-tertiary)]";
  if (price?.change24h != null) {
    changeClass =
      price.change24h >= 0
        ? "text-[color:var(--color-positive)]"
        : "text-[color:var(--color-negative)]";
  }

  const changeDisplay =
    price?.change24h == null
      ? "—"
      : `${price.change24h >= 0 ? "+" : ""}${price.change24h.toFixed(2)}%`;

  return (
    <div className="flex items-center gap-3 border-[color:var(--border-subtle)] border-b px-3 py-3 last:border-0">
      {/* Token icon */}
      {imageUrl ? (
        <Image
          alt={constituent.symbol}
          className="size-7 shrink-0 rounded-full object-cover"
          height={28}
          src={imageUrl}
          unoptimized
          width={28}
        />
      ) : (
        <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--bg-surface-raised)] font-medium text-[10px] text-[color:var(--text-tertiary)]">
          {constituent.symbol.slice(0, 2).toUpperCase()}
        </div>
      )}

      {/* Token identity */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-[color:var(--text-primary)] text-sm">
          {constituent.symbol}
        </p>
        <p className="truncate text-[color:var(--text-secondary)] text-xs">
          {constituent.name}
        </p>
      </div>

      {/* Price */}
      <p
        className={cn(
          "w-20 text-right text-sm tabular-nums",
          price == null
            ? "text-[color:var(--text-tertiary)]"
            : "text-[color:var(--text-primary)]"
        )}
      >
        {priceDisplay}
      </p>

      {/* 24h change */}
      <p className={cn("w-16 text-right text-xs tabular-nums", changeClass)}>
        {changeDisplay}
      </p>

      {/* Weight */}
      <p className="w-10 text-right text-[color:var(--text-secondary)] text-xs tabular-nums">
        {weightPct}
      </p>
    </div>
  );
}
