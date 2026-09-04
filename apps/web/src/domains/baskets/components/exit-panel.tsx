"use client";

import type { BasketConstituent } from "@doji/types";
import { useAccount, useChainId } from "wagmi";
import { ROBINHOOD_CHAIN_ID } from "@/config/chains";
import type { ExitBalance } from "@/domains/baskets/hooks/use-basket-exit";
import { useBasketExit } from "@/domains/baskets/hooks/use-basket-exit";
import { Button } from "@/ui/button";
import { TxStatusBadge } from "./tx-status-badge";

interface ExitPanelProps {
  basketId: string;
  constituents: BasketConstituent[];
  /** Caller-supplied ERC-20 balances. Button disabled when absent or empty. */
  exitBalances?: ExitBalance[];
}

/**
 * Exit panel for a basket.
 * Swaps all constituent token balances back to ETH via an Enso bundle.
 *
 * The exit button is disabled when:
 * - wallet is not connected
 * - connected to the wrong network
 * - exitBalances are not provided or all zero
 * - a transaction is already in progress
 *
 * Requirements: 9.1, 9.2, 9.3, 9.7
 */
export function ExitPanel({
  basketId,
  constituents: _constituents,
  exitBalances,
}: ExitPanelProps) {
  const { address } = useAccount();
  const chainId = useChainId();

  const { exit, exitState, reset } = useBasketExit({ basketId });

  const isNotConnected = !address;
  const isWrongChain = !!address && chainId !== ROBINHOOD_CHAIN_ID;
  const isBusy = exitState.status !== "idle";

  const hasBalances =
    exitBalances != null &&
    exitBalances.length > 0 &&
    exitBalances.some((b) => BigInt(b.balanceWei) > 0n);

  const isDisabled = isNotConnected || isWrongChain || isBusy || !hasBalances;

  let buttonLabel = "Exit to ETH";
  if (isNotConnected) {
    buttonLabel = "Connect Wallet";
  } else if (isWrongChain) {
    buttonLabel = "Switch Network";
  } else if (!hasBalances) {
    buttonLabel = "No Crate Tokens";
  } else if (exitState.status === "building") {
    buttonLabel = "Building…";
  } else if (exitState.status === "confirming") {
    buttonLabel = "Confirm in Wallet…";
  } else if (exitState.status === "pending") {
    buttonLabel = "Transaction Pending…";
  } else if (exitState.status === "confirmed") {
    buttonLabel = "Exit Again";
  }

  const handleExit = async () => {
    if (exitState.status === "confirmed") {
      reset();
      return;
    }
    if (!exitBalances) {
      return;
    }
    await exit(exitBalances);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-raised)] p-3">
        <p className="text-text-secondary text-xs">Estimated return</p>
        <p className="mt-0.5 text-sm text-text-primary">
          {hasBalances ? "~estimated ETH" : "—"}
        </p>
        <p className="mt-1 text-[10px] text-text-muted">
          Final amount depends on execution price and slippage.
        </p>
      </div>

      <Button
        className="w-full"
        disabled={isDisabled}
        onClick={handleExit}
        type="button"
        variant="destructive"
      >
        {buttonLabel}
      </Button>

      <TxStatusBadge state={exitState} />
    </div>
  );
}
