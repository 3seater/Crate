import type { TokenPrice } from "@doji/types";
import { BASKETS } from "@/config/baskets";
import { Button } from "@/ui/button";
import { BasketCard } from "./basket-card";
import { BasketCardSkeleton } from "./basket-card-skeleton";

interface BasketCatalogGridProps {
  /** When true, renders skeletons in place of cards (price data still loading). */
  isLoading?: boolean;
  /** Live price data for constituent tokens. Used by each card to compute 24h performance. */
  prices?: TokenPrice[];
}

/**
 * Responsive grid of BasketCard components for all configured baskets.
 * 1 column on mobile, 2 on tablet (sm), 3 on desktop (lg).
 *
 * Requirements: 5.5, 14.3
 */
export function BasketCatalogGrid({
  prices,
  isLoading,
}: BasketCatalogGridProps) {
  if (!isLoading && BASKETS.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <svg
          aria-hidden="true"
          className="h-10 w-10 text-[color:var(--text-tertiary)]"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="font-medium text-[color:var(--text-primary)] text-lg">
          No crates yet.
        </p>
        <p className="text-[color:var(--text-secondary)] text-sm">
          Check back soon.
        </p>
        <Button variant="outline">Browse markets</Button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {isLoading
        ? BASKETS.map((basket) => <BasketCardSkeleton key={basket.id} />)
        : BASKETS.map((basket) => (
            <BasketCard basket={basket} key={basket.id} prices={prices} />
          ))}
    </div>
  );
}
