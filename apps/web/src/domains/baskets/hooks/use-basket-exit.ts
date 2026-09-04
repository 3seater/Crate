"use client";

import { useCallback, useEffect, useState } from "react";
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
 * A single token balance entry supplied by the caller.
 * `address` is the ERC-20 contract address; `balanceWei` is the raw balance
 * as a decimal string (e.g. from `balanceOf`).
 */
export interface ExitBalance {
  address: string;
  balanceWei: string;
}

/**
 * Discriminated union representing each step of the basket exit flow.
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
 * Requirements: 6.5, 6.6
 */
export type ExitState =
  | { status: "idle" }
  | { status: "building" }
  | { status: "confirming" }
  | { status: "pending"; txHash: `0x${string}` }
  | { status: "confirmed"; txHash: `0x${string}` }
  | { status: "error"; error: string };

interface UseBasketExitParams {
  basketId: string;
}

interface UseBasketExitReturn {
  /** Trigger the full exit flow with the caller-supplied token balances. */
  exit: (exitBalances: ExitBalance[]) => Promise<void>;
  exitState: ExitState;
  /** True while `useWaitForTransactionReceipt` is polling for inclusion. */
  isWaitingForReceipt: boolean;
  /** Reset state machine back to idle so the panel is ready for another exit. */
  reset: () => void;
}

/**
 * Encapsulates the full basket exit state machine.
 *
 * Flow:
 *  1. `exit(exitBalances)` is called → transitions to `building`
 *  2. Server returns Enso bundle tx (isExit: true) → transitions to `confirming`
 *  3. Wallet sends tx → transitions to `pending` with txHash
 *  4. On-chain inclusion detected → transitions to `confirmed`
 *
 * Any error along the way transitions to `error` with a message.
 */
export function useBasketExit({
  basketId,
}: UseBasketExitParams): UseBasketExitReturn {
  const [exitState, setExitState] = useState<ExitState>({ status: "idle" });

  const { address } = useAccount();
  const { sendTransactionAsync } = useSendTransaction();

  // Derive the pending tx hash only when we are in the `pending` state so
  // `useWaitForTransactionReceipt` stays disabled for every other state.
  const pendingHash =
    exitState.status === "pending" ? exitState.txHash : undefined;

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
        // Step 1 — fetch Enso transaction bundle for exit
        setExitState({ status: "building" });

        const { tx } = await trpcClient.baskets.getBundle.mutate({
          basketId,
          fromAddress: address,
          amountInWei: "0",
          tokenIn: ETH_ADDRESS,
          isExit: true,
          exitBalances,
        });

        // Step 2 — prompt wallet to sign & broadcast
        setExitState({ status: "confirming" });

        const txHash = await sendTransactionAsync({
          to: tx.to as `0x${string}`,
          data: tx.data as `0x${string}`,
          value: BigInt(tx.value),
        });

        // Step 3 — wait for on-chain inclusion (handled by useEffect above)
        setExitState({ status: "pending", txHash });
      } catch (err) {
        // Wallet rejections surfaced by wagmi have `name === "UserRejectedRequestError"`
        // but we normalise everything to a string for the UI.
        const message =
          err instanceof Error ? err.message : "Transaction failed";
        setExitState({ status: "error", error: message });
      }
    },
    [address, basketId, sendTransactionAsync]
  );

  const reset = useCallback(() => setExitState({ status: "idle" }), []);

  return {
    exitState,
    isWaitingForReceipt,
    exit,
    reset,
  };
}
