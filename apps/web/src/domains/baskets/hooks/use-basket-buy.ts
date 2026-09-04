"use client";

import type { BasketConstituent } from "@doji/types";
import { useCallback, useEffect, useState } from "react";
import { parseEther } from "viem";
import {
  useAccount,
  useSendTransaction,
  useWaitForTransactionReceipt,
} from "wagmi";
import { trpcClient } from "@/lib/trpc";

/** ETH sentinel address used by Enso to represent native ETH as input token. */
const ETH_ADDRESS =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const satisfies `0x${string}`;

/**
 * Discriminated union representing each step of the basket buy flow.
 *
 * State machine: idle → building → confirming → pending → confirmed | error
 *
 * - idle       : no action in progress
 * - building   : fetching the Enso bundle transaction from the server
 * - confirming : wallet confirmation prompt is open (waiting for user to sign)
 * - pending    : transaction submitted; waiting for on-chain inclusion
 * - confirmed  : transaction included; receipt available
 * - error      : any step failed; `error` holds a human-readable message
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 8.5, 8.6, 8.7, 8.8, 8.9, 8.10
 */
export type BuyState =
  | { status: "idle" }
  | { status: "building" }
  | { status: "confirming" }
  | { status: "pending"; txHash: `0x${string}` }
  | { status: "confirmed"; txHash: `0x${string}` }
  | { status: "error"; error: string };

interface UseBasketBuyParams {
  basketId: string;
  /** Included for future exit flow parity; not used in buy routing. */
  constituents: BasketConstituent[];
}

interface UseBasketBuyReturn {
  /** Trigger the full buy flow with a deposit amount expressed as an ETH string (e.g. "0.1"). */
  buy: (amountEth: string) => Promise<void>;
  buyState: BuyState;
  /** True while `useWaitForTransactionReceipt` is polling for inclusion. */
  isWaitingForReceipt: boolean;
  /** Reset state machine back to idle so the panel is ready for another purchase. */
  reset: () => void;
}

/**
 * Encapsulates the full basket buy state machine.
 *
 * Flow:
 *  1. `buy(amountEth)` is called → transitions to `building`
 *  2. Server returns Enso bundle tx → transitions to `confirming`
 *  3. Wallet sends tx → transitions to `pending` with txHash
 *  4. On-chain inclusion detected → transitions to `confirmed`
 *
 * Any error along the way transitions to `error` with a message.
 */
export function useBasketBuy({
  basketId,
  constituents: _constituents,
}: UseBasketBuyParams): UseBasketBuyReturn {
  const [buyState, setBuyState] = useState<BuyState>({ status: "idle" });

  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  // Derive the pending tx hash only when we are in the `pending` state so
  // `useWaitForTransactionReceipt` stays disabled for every other state.
  const pendingHash =
    buyState.status === "pending" ? buyState.txHash : undefined;

  const {
    data: receipt,
    isSuccess: receiptSuccess,
    isLoading: isWaitingForReceipt,
  } = useWaitForTransactionReceipt({
    hash: pendingHash,
  });

  // Watch for on-chain inclusion and advance the state machine to `confirmed`.
  // Using useEffect (not onSuccess) because wagmi v2+ removed the callbacks.
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
        // Step 1 — fetch Enso transaction bundle
        setBuyState({ status: "building" });

        const amountWei = parseEther(amountEth);

        const { tx } = await trpcClient.baskets.getBundle.mutate({
          basketId,
          fromAddress: address,
          amountInWei: amountWei.toString(),
          tokenIn: ETH_ADDRESS,
          isExit: false,
        });

        // Step 2 — prompt wallet to sign & broadcast
        setBuyState({ status: "confirming" });

        const txHash = await sendTransactionAsync({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value),
        });

        // Step 3 — wait for on-chain inclusion (handled by useEffect above)
        setBuyState({ status: "pending", txHash });
      } catch (err) {
        // Wallet rejections surfaced by wagmi have `name === "UserRejectedRequestError"`
        // but we normalise everything to a string for the UI.
        const message =
          err instanceof Error ? err.message : "Transaction failed";
        setBuyState({ status: "error", error: message });
      }
    },
    [address, basketId, sendTransactionAsync]
  );

  const reset = useCallback(() => setBuyState({ status: "idle" }), []);

  return {
    buyState,
    isWaitingForReceipt,
    buy,
    reset,
  };
}
