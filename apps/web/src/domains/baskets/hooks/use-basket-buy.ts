"use client";

import type { BasketConstituent } from "@doji/types";
import { useCallback, useEffect, useState } from "react";
import { parseEther } from "viem";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";

const ETH_ADDRESS =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const satisfies `0x${string}`;

export type BuyState =
  | { status: "idle" }
  | { status: "building" }
  | { status: "confirming" }
  | { status: "pending"; txHash: `0x${string}` }
  | { status: "confirmed"; txHash: `0x${string}` }
  | { status: "error"; error: string };

interface UseBasketBuyParams {
  basketId: string;
  constituents: BasketConstituent[];
}

export function useBasketBuy({ basketId }: UseBasketBuyParams) {
  const [buyState, setBuyState] = useState<BuyState>({ status: "idle" });
  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  const pendingHash =
    buyState.status === "pending" ? buyState.txHash : undefined;
  const {
    data: receipt,
    isSuccess: receiptSuccess,
    isLoading: isWaitingForReceipt,
  } = useWaitForTransactionReceipt({ hash: pendingHash });

  useEffect(() => {
    if (receiptSuccess && receipt && buyState.status === "pending") {
      setBuyState({ status: "confirmed", txHash: receipt.transactionHash });
    }
  }, [receiptSuccess, receipt, buyState.status]);

  const buy = useCallback(
    async (amountEth: string) => {
      if (!address) {
        setBuyState({ status: "error", error: "Wallet not connected" });
        return;
      }

      try {
        setBuyState({ status: "building" });

        const res = await fetch("/api/baskets/bundle", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            basketId,
            fromAddress: address,
            amountInWei: parseEther(amountEth).toString(),
            tokenIn: ETH_ADDRESS,
          }),
        });

        if (!res.ok) {
          const err = (await res.json()) as { error?: string };
          throw new Error(err.error ?? `Bundle request failed (${res.status})`);
        }

        const { tx } = (await res.json()) as {
          tx: { to: string; data: string; value: string };
        };

        setBuyState({ status: "confirming" });
        const txHash = await sendTransactionAsync({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value),
        });

        setBuyState({ status: "pending", txHash });
      } catch (err) {
        setBuyState({
          status: "error",
          error: err instanceof Error ? err.message : "Transaction failed",
        });
      }
    },
    [address, basketId, sendTransactionAsync]
  );

  const reset = useCallback(() => setBuyState({ status: "idle" }), []);

  return { buyState, isWaitingForReceipt, buy, reset };
}
