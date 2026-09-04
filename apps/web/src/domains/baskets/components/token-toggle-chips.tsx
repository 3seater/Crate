"use client";

import type { BasketConstituent } from "@doji/types";
import { useBasketTerminalStore } from "@/domains/baskets/stores/basket-terminal";
import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";

interface TokenToggleChipsProps {
  constituents: BasketConstituent[];
}

export function TokenToggleChips({ constituents }: TokenToggleChipsProps) {
  const activeTokens = useBasketTerminalStore((s) => s.activeTokens);
  const toggleToken = useBasketTerminalStore((s) => s.toggleToken);

  return (
    <fieldset className="m-0 flex flex-wrap gap-1.5 border-none p-0">
      <legend className="sr-only">Token filter</legend>
      {constituents.map((c) => {
        const isActive = activeTokens.includes(c.symbol);
        return (
          <Button
            aria-label={`Toggle ${c.symbol}`}
            aria-pressed={isActive}
            className={cn(
              isActive
                ? "h-6 border-transparent bg-[color:var(--crate-orange)] px-2.5 text-[#0a0a0a] text-[10px]"
                : "h-6 border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] px-2.5 text-[10px] text-[color:var(--text-secondary)]"
            )}
            key={c.symbol}
            onClick={() => toggleToken(c.symbol)}
            size="sm"
            variant="ghost"
          >
            {c.symbol}
          </Button>
        );
      })}
    </fieldset>
  );
}
