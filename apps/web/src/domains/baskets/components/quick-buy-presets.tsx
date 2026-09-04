"use client";

import { Button } from "@/ui/button";

const PRESETS = ["0.05", "0.1", "0.5", "1"] as const;

interface QuickBuyPresetsProps {
  onSelect: (amount: string) => void;
}

export function QuickBuyPresets({ onSelect }: QuickBuyPresetsProps) {
  return (
    <div className="scrollbar-hide flex gap-2 overflow-x-auto">
      {PRESETS.map((preset) => (
        <Button
          className="min-h-[44px] flex-none border border-[color:var(--border-default)] bg-transparent text-[color:var(--text-secondary)] text-xs hover:border-[color:var(--crate-orange)] hover:text-[color:var(--crate-orange)] sm:min-h-8"
          key={preset}
          onClick={() => onSelect(preset)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {preset} ETH
        </Button>
      ))}
    </div>
  );
}
