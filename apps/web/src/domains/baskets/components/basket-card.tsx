import type { BasketConfig, TokenPrice } from "@doji/types";
import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/utils/cn";

interface BasketCardProps {
  basket: BasketConfig;
  prices?: TokenPrice[];
}

/**
 * Truncates an address to `0x1234…abcd` format.
 */
function truncateAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Displays a crate summary card with constituent weights and 24h performance.
 * Requirements: 6.1–6.6, 8.5, 12.8
 */
export function BasketCard({ basket, prices }: BasketCardProps) {
  const performance = computeWeightedPerformance(basket, prices);
  let performanceClass = "text-[color:var(--text-secondary)]";
  if (performance !== null) {
    performanceClass =
      performance >= 0
        ? "text-[color:var(--color-positive)]"
        : "text-[color:var(--color-negative)]";
  }

  return (
    <Link
      className="block border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-5 transition-colors duration-150 hover:bg-[color:var(--bg-surface-raised)]"
      href={`/crates/${basket.id}` as Route}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium text-[color:var(--text-primary)] text-sm">
            {basket.name}
          </p>
          <p className="mt-0.5 text-[color:var(--crate-orange)] text-xs">
            {basket.id.toUpperCase()}
          </p>
        </div>

        {/* 24h performance */}
        <div className="shrink-0 text-right">
          <p
            className={cn("font-medium text-sm tabular-nums", performanceClass)}
          >
            {performance === null
              ? "—"
              : `${performance >= 0 ? "+" : ""}${performance.toFixed(2)}%`}
          </p>
          <p className="mt-0.5 text-[color:var(--text-secondary)] text-xs">
            24h
          </p>
        </div>
      </div>

      {/* Constituent weights */}
      <p className="mt-3 text-[color:var(--text-secondary)] text-xs">
        {basket.constituents
          .map((c) => `${c.symbol} ${Math.round(c.weight * 100)}%`)
          .join(" · ")}
      </p>

      {/* Explorer link — first constituent's pool address */}
      {basket.constituents[0]?.poolAddress && (
        <a
          className="mt-2 block text-[color:var(--text-secondary)] text-xs hover:text-[color:var(--text-primary)]"
          href={`https://explorer.robinhood.com/address/${basket.constituents[0].poolAddress}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          {truncateAddr(basket.constituents[0].poolAddress)} ↗
        </a>
      )}
    </Link>
  );
}

/**
 * Computes the basket's weighted 24h performance as a percentage.
 * Returns null when no price data is available for any constituent.
 */
function computeWeightedPerformance(
  basket: BasketConfig,
  prices: TokenPrice[] | undefined
): number | null {
  if (!prices || prices.length === 0) {
    return null;
  }

  const priceMap = new Map<string, TokenPrice>(
    prices.map((p) => [p.symbol.toUpperCase(), p])
  );

  let weightedSum = 0;
  let coveredWeight = 0;

  for (const constituent of basket.constituents) {
    const price = priceMap.get(constituent.symbol.toUpperCase());
    if (price?.change24h != null) {
      weightedSum += price.change24h * constituent.weight;
      coveredWeight += constituent.weight;
    }
  }

  if (coveredWeight === 0) {
    return null;
  }

  // Re-normalise in case only a subset of constituents have price data
  return weightedSum / coveredWeight;
}
