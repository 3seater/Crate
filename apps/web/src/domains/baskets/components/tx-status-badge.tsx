"use client";

import { CheckCircle } from "lucide-react";
import type React from "react";
import type { BuyState } from "@/domains/baskets/hooks/use-basket-buy";
import type { ExitState } from "@/domains/baskets/hooks/use-basket-exit";
import {
  blockExplorerTxUrl,
  formatTxHash,
} from "@/domains/baskets/lib/format-tx";

type TxState = BuyState | ExitState;

interface TxStatusBadgeProps {
  state: TxState;
}

const SPINNER = (
  <span
    aria-hidden="true"
    className="inline-block h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"
  />
);

/**
 * Renders a compact status line reflecting the current transaction state.
 *
 * The wrapping div with aria-live="polite" is always present in the DOM so
 * screen readers announce state transitions without a mount/unmount cycle.
 *
 * Requirements: 6.15, 8.7, 9.5, 10.6, 10.7, 10.8, 12.9
 */
export function TxStatusBadge({ state }: TxStatusBadgeProps) {
  let content: React.ReactNode = null;

  if (state.status === "building") {
    content = (
      <p className="flex items-center gap-1.5 text-[color:var(--crate-orange)] text-xs">
        {SPINNER}
        Building transaction…
      </p>
    );
  } else if (state.status === "confirming") {
    content = (
      <p className="flex items-center gap-1.5 text-[color:var(--crate-orange)] text-xs">
        {SPINNER}
        Confirm in wallet…
      </p>
    );
  } else if (state.status === "pending") {
    content = (
      <p className="flex items-center gap-1.5 text-[color:var(--crate-orange)] text-xs">
        {SPINNER}
        Transaction pending…{" "}
        <a
          className="underline underline-offset-2 hover:text-[color:var(--crate-orange)]"
          href={blockExplorerTxUrl(state.txHash)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {formatTxHash(state.txHash)}
        </a>
      </p>
    );
  } else if (state.status === "confirmed") {
    content = (
      <p className="flex items-center gap-1.5 text-[color:var(--color-positive)] text-xs">
        <CheckCircle aria-hidden="true" className="h-3 w-3" />
        Transaction confirmed{" "}
        <a
          className="underline underline-offset-2 hover:opacity-80"
          href={blockExplorerTxUrl(state.txHash)}
          rel="noopener noreferrer"
          target="_blank"
        >
          {formatTxHash(state.txHash)}
        </a>
      </p>
    );
  } else if (state.status === "error") {
    content = (
      <p className="text-[color:var(--color-negative)] text-xs" role="alert">
        {state.error}
      </p>
    );
  }

  return (
    <div aria-atomic="true" aria-live="polite">
      {content}
    </div>
  );
}
