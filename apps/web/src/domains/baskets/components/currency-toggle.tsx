"use client";

import { Button } from "@/ui/button";

type Currency = "ETH" | "USDG";

interface CurrencyToggleProps {
  onChange: (currency: Currency) => void;
  value: Currency;
}

const CURRENCIES: Currency[] = ["ETH", "USDG"];

export function CurrencyToggle({ value, onChange }: CurrencyToggleProps) {
  return (
    <div className="flex gap-0.5 border border-[color:var(--border-default)] p-0.5">
      {CURRENCIES.map((currency) => (
        <Button
          aria-pressed={value === currency}
          className={
            value === currency
              ? "h-7 min-h-[44px] flex-1 bg-[color:var(--crate-orange)] text-[#0a0a0a] text-xs"
              : "h-7 min-h-[44px] flex-1 bg-transparent text-[color:var(--text-secondary)] text-xs hover:text-[color:var(--text-primary)]"
          }
          key={currency}
          onClick={() => onChange(currency)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {currency}
        </Button>
      ))}
    </div>
  );
}
