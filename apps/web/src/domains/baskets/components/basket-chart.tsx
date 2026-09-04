"use client";

import type { BasketConstituent, TokenPrice } from "@doji/types";
import { useState } from "react";
import { useBasketTerminalStore } from "@/domains/baskets/stores/basket-terminal";
import { cn } from "@/utils/cn";
import { TimeframeSelector } from "./timeframe-selector";
import { TokenChartEmbed } from "./token-chart-embed";

interface BasketChartProps {
  constituents: BasketConstituent[];
  prices?: TokenPrice[];
}

export function BasketChart({ constituents }: BasketChartProps) {
  useBasketTerminalStore((s) => s.timeframe); // keep timeframe in sync for future use
  const [activeIdx, setActiveIdx] = useState(0);
  const active = constituents[activeIdx];

  if (!active) {
    return null;
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-md border border-border">
      {/* Control row */}
      <div className="flex items-stretch overflow-x-auto border-border border-b bg-muted/20">
        <div className="flex shrink-0 items-center border-border border-r px-2">
          <TimeframeSelector />
        </div>
        {constituents.map((c, i) => (
          <button
            className={cn(
              "shrink-0 border-b-2 px-5 py-3 font-medium text-sm transition-colors",
              activeIdx === i
                ? "border-primary bg-primary/10 text-primary"
                : "border-transparent text-text-secondary hover:bg-muted/50 hover:text-text-primary"
            )}
            key={c.symbol}
            onClick={() => setActiveIdx(i)}
            type="button"
          >
            {c.symbol}
          </button>
        ))}
      </div>
      {/* DexScreener embed — full chart with candles, volume, indicators */}
      <TokenChartEmbed
        height={520}
        poolAddress={active.poolAddress}
        symbol={active.symbol}
      />
    </div>
  );
}
