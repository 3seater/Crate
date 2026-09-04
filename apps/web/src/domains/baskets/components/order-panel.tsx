"use client";

import type { BasketConstituent } from "@doji/types";
import { useState } from "react";
import type { ExitBalance } from "@/domains/baskets/hooks/use-basket-exit";
import { Button } from "@/ui/button";
import { cn } from "@/utils/cn";
import { BuyPanel } from "./buy-panel";
import { ExitPanel } from "./exit-panel";

type Tab = "buy" | "exit";

interface OrderPanelProps {
  basketId: string;
  constituents: BasketConstituent[];
  ethPriceUsd?: number;
  exitBalances?: ExitBalance[];
  priceMap?: Record<string, { priceUsd: number }>;
}

/**
 * Root order panel with Buy / Exit tabs.
 * Composes BuyPanel and ExitPanel; each panel owns its own TxStatusBadge.
 *
 * Requirements: 6.5, 8.7, 8.8
 */
export function OrderPanel({
  basketId,
  constituents,
  priceMap,
  ethPriceUsd,
  exitBalances,
}: OrderPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("buy");

  return (
    <div className="flex flex-col gap-4 border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] p-4">
      {/* Tab headers */}
      <div className="flex gap-1 border-[color:var(--border-default)] border-b pb-3">
        <Button
          aria-selected={activeTab === "buy"}
          className={cn(
            activeTab === "buy"
              ? "-mb-[1px] h-8 px-4 text-[color:var(--text-primary)] text-sm [border-bottom:2px_solid_var(--crate-orange)]"
              : "h-8 px-4 text-[color:var(--text-secondary)] text-sm hover:text-[color:var(--text-primary)]"
          )}
          onClick={() => setActiveTab("buy")}
          role="tab"
          type="button"
          variant="ghost"
        >
          Buy Crate
        </Button>
        <Button
          aria-selected={activeTab === "exit"}
          className={cn(
            activeTab === "exit"
              ? "-mb-[1px] h-8 px-4 text-[color:var(--text-primary)] text-sm [border-bottom:2px_solid_var(--crate-orange)]"
              : "h-8 px-4 text-[color:var(--text-secondary)] text-sm hover:text-[color:var(--text-primary)]"
          )}
          onClick={() => setActiveTab("exit")}
          role="tab"
          type="button"
          variant="ghost"
        >
          Exit Crate
        </Button>
      </div>

      {/* Tab panels */}
      {activeTab === "buy" ? (
        <BuyPanel
          basketId={basketId}
          constituents={constituents}
          ethPriceUsd={ethPriceUsd}
          priceMap={priceMap}
        />
      ) : (
        <ExitPanel
          basketId={basketId}
          constituents={constituents}
          exitBalances={exitBalances}
        />
      )}
    </div>
  );
}
