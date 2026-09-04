"use client";

import { formatUnits } from "viem";
import { useAccount, useBalance, useChainId, useConnect } from "wagmi";
import { useHydrated } from "@/hooks/use-hydrated";
import { Button } from "@/ui/button";
import { Skeleton } from "@/ui/skeleton";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}\u2026${addr.slice(-4)}`;
}

/** Client island: wagmi-based wallet display (address, balance, connect). */
export function HeaderActions() {
  const hydrated = useHydrated();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: balance } = useBalance({ address });
  const { connect, connectors } = useConnect();

  if (!hydrated) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-32" />
      </div>
    );
  }

  if (isConnected && address) {
    const formattedBalance = balance
      ? `${Number(formatUnits(balance.value, balance.decimals)).toFixed(4)} ${balance.symbol}`
      : "—";

    return (
      <div className="flex items-center gap-3">
        <span className="hidden text-text-secondary text-xs lg:inline">
          Chain {chainId}
        </span>
        <div
          aria-label={`Wallet connected: ${truncateAddress(address)}`}
          className="flex h-8 items-center gap-2 border border-[color:var(--border-strong)] px-3 font-normal text-[color:var(--text-primary)] text-sm"
          role="status"
        >
          <span>{truncateAddress(address)}</span>
          <span className="text-[color:var(--text-secondary)]">
            {formattedBalance}
          </span>
        </div>
      </div>
    );
  }

  return (
    <Button
      aria-label="Connect wallet"
      className="h-8"
      onClick={() => {
        const connector = connectors[0];
        if (connector) {
          connect({ connector });
        }
      }}
      variant="outline"
    >
      Connect Wallet
    </Button>
  );
}
