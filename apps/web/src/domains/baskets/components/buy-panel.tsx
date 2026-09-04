"use client";

import type { BasketConstituent } from "@doji/types";
import { useState } from "react";
import { useAccount, useChainId } from "wagmi";
import { ROBINHOOD_CHAIN_ID } from "@/config/chains";
import { useAllocationPreview } from "@/domains/baskets/hooks/use-allocation-preview";
import { useBasketBuy } from "@/domains/baskets/hooks/use-basket-buy";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { AllocationPreview } from "./allocation-preview";
import { CurrencyToggle } from "./currency-toggle";
import { QuickBuyPresets } from "./quick-buy-presets";
import { TxStatusBadge } from "./tx-status-badge";

interface BuyPanelProps {
  basketId: string;
  constituents: BasketConstituent[];
  ethPriceUsd?: number;
  priceMap?: Record<string, { priceUsd: number }>;
}

/**
 * Buy panel for a basket.
 * Composes CurrencyToggle, QuickBuyPresets, amount Input, AllocationPreview,
 * execute Button, and TxStatusBadge.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.5, 8.9, 8.10, 8.11, 8.12
 */
export function BuyPanel({
  basketId,
  constituents,
  priceMap = {},
  ethPriceUsd,
}: BuyPanelProps) {
  const [currency, setCurrency] = useState<"ETH" | "USDG">("ETH");
  const [amountStr, setAmountStr] = useState("");

  const { address } = useAccount();
  const chainId = useChainId();

  const { buy, buyState, reset } = useBasketBuy({ basketId, constituents });

  const amountEth = Number.parseFloat(amountStr) || 0;
  const allocationLines = useAllocationPreview(
    constituents,
    amountEth,
    priceMap,
    ethPriceUsd
  );

  const isNotConnected = !address;
  const isWrongChain = !!address && chainId !== ROBINHOOD_CHAIN_ID;
  const isBusy = buyState.status !== "idle";

  const isDisabled = isNotConnected || isWrongChain || isBusy;

  let buttonLabel = "Buy Crate";
  if (isNotConnected) {
    buttonLabel = "Connect Wallet";
  } else if (isWrongChain) {
    buttonLabel = "Switch Network";
  } else if (buyState.status === "building") {
    buttonLabel = "Building…";
  } else if (buyState.status === "confirming") {
    buttonLabel = "Confirm in Wallet…";
  } else if (buyState.status === "pending") {
    buttonLabel = "Transaction Pending…";
  } else if (buyState.status === "confirmed") {
    buttonLabel = "Buy Again";
  }

  const handleBuy = async () => {
    if (buyState.status === "confirmed") {
      reset();
      return;
    }
    if (!amountStr || amountEth <= 0) {
      return;
    }
    await buy(amountStr);
  };

  const handlePreset = (preset: string) => {
    setAmountStr(preset);
  };

  return (
    <div className="flex flex-col gap-4">
      <CurrencyToggle onChange={setCurrency} value={currency} />

      <QuickBuyPresets onSelect={handlePreset} />

      <div className="flex flex-col gap-1.5">
        <label
          className="text-text-secondary text-xs"
          htmlFor="buy-amount-input"
        >
          Amount ({currency})
        </label>
        <Input
          id="buy-amount-input"
          inputMode="decimal"
          min="0"
          onChange={(e) => setAmountStr(e.target.value)}
          placeholder="0.00"
          step="any"
          type="number"
          value={amountStr}
        />
      </div>

      {allocationLines.length > 0 && (
        <AllocationPreview lines={allocationLines} />
      )}

      <Button
        aria-disabled={
          isDisabled ||
          (buyState.status === "idle" && (!amountStr || amountEth <= 0))
        }
        className="w-full"
        disabled={
          isDisabled ||
          (buyState.status === "idle" && (!amountStr || amountEth <= 0))
        }
        onClick={handleBuy}
        tabIndex={0}
        type="button"
      >
        {buttonLabel}
      </Button>

      <TxStatusBadge state={buyState} />
    </div>
  );
}
