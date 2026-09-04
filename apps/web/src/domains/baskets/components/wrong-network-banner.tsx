"use client";

import { useChainId, useSwitchChain } from "wagmi";
import { ROBINHOOD_CHAIN_ID, robinhoodChain } from "@/config/chains";
import { Button } from "@/ui/button";

export function WrongNetworkBanner() {
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (chainId === ROBINHOOD_CHAIN_ID) {
    return null;
  }

  return (
    <div className="flex items-center justify-between gap-4 border border-[color:var(--border-default)] bg-[color:var(--bg-surface)] px-4 py-3">
      <p className="text-sm text-text-primary">
        You are on the wrong network. Switch to {robinhoodChain.name} to trade
        crates.
      </p>
      <Button
        onClick={() => switchChain({ chainId: ROBINHOOD_CHAIN_ID })}
        size="sm"
        variant="default"
      >
        Switch Network
      </Button>
    </div>
  );
}
