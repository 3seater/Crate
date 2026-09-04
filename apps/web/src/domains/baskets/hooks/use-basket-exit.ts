"use client";

import { useCallback, useEffect, useState } from "react";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";

const ETH_ADDRESS =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const satisfies `0x${string}`;

export interface ExitBalance {
  address: string;
  balanceWei: string;
}

export type ExitState =
  | { status: "idle" }
  | { status: "building" }
  | { status: "confirming" }
  | { status: "pending"; txHash: `0x${string}` }
  | { status: "confirmed"; txHash: `0x${string}` }
  | { status: "error"; error: string };

export function useBasketExit({ basketId }: { basketId: string }) {
  const [exitState, setExitState] = useState<ExitState>({ status: "idle" });
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  const pendingHash =
    exitState.status === "pending" ? exitState.txHash : undefined;
  const {
    data: receipt,
    isSuccess: receiptSuccess,
    isLoading: isWaitingForReceipt,
  } = useWaitForTransactionReceipt({ hash: pendingHash });

  useEffect(() => {
    if (receiptSuccess && receipt && exitState.status === "pending") {
      setExitState({ status: "confirmed", txHash: receipt.transactionHash });
    }
  }, [receiptSuccess, receipt, exitState.status]);

  const exit = useCallback(
    async (exitBalances: ExitBalance[]) => {
      if (!address) {
        setExitState({ status: "error", error: "Wallet not connected" });
        return;
      }
      try {
        setExitState({ status: "building" });
        const res = await fetch("/api/baskets/bundle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            basketId,
            fromAddress: address,
            amountInWei: "0",
            tokenIn: ETH_ADDRESS,
            isExit: true,
            exitBalances,
          }),
        });
        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? `Bundle request failed (${res.status})`);
        }
        const { tx } = (await res.json()) as {
          tx: { to: string; data: string; value: string };
        };
        setExitState({ status: "confirming" });
        const txHash = await sendTransactionAsync({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value),
        });
        setExitState({ status: "pending", txHash });
      } catch (err) {
        setExitState({
          status: "error",
          error: err instanceof Error ? err.message : "Transaction failed",
        });
      }
    },
    [address, basketId, sendTransactionAsync]
  );

  const reset = useCallback(() => setExitState({ status: "idle" }), []);
  return { exitState, isWaitingForReceipt, exit, reset };
}
