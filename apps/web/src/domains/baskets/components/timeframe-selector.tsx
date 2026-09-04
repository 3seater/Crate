"use client";

import type { Timeframe } from "@doji/types";
import { useBasketTerminalStore } from "@/domains/baskets/stores/basket-terminal";
import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";

const TIMEFRAMES: Timeframe[] = ["24H", "7D", "30D"];

export function TimeframeSelector() {
  const timeframe = useBasketTerminalStore((s) => s.timeframe);
  const setTimeframe = useBasketTerminalStore((s) => s.setTimeframe);

  return (
    <fieldset className="m-0 flex items-center gap-1 border-none p-0">
      <legend className="sr-only">Chart timeframe</legend>
      {TIMEFRAMES.map((tf) => (
        <Button
          aria-pressed={timeframe === tf}
          className={cn(
            timeframe === tf
              ? "h-8 min-h-[44px] border-transparent bg-[color:var(--crate-orange)] font-medium text-[#0a0a0a] sm:min-h-8"
              : "h-8 min-h-[44px] border border-[color:var(--border-default)] bg-transparent text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] sm:min-h-8"
          )}
          key={tf}
          onClick={() => setTimeframe(tf)}
          size="sm"
          variant="ghost"
        >
          {tf}
        </Button>
      ))}
    </fieldset>
  );
}
