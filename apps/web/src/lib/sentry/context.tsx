"use client";

import { setContext, setUser } from "@sentry/nextjs";
import { useEffect } from "react";
import { useWalletStore } from "@/stores/wallet";

/**
 * Syncs Sentry user context from the wagmi-backed wallet store.
 * Sets user id to the connected wallet address when available.
 */
export function SentryContext() {
  const address = useWalletStore((s) => s.address);

  useEffect(() => {
    if (address) {
      setUser({ id: address });
      setContext("wallet", { address });
    } else {
      setUser(null);
      setContext("wallet", null);
    }
  }, [address]);

  return null;
}
