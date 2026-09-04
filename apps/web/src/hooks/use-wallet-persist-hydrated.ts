"use client";

import { useSyncExternalStore } from "react";
import { useWalletStore } from "@/stores/wallet";

/**
 * True after `persist` has rehydrated wallet state from localStorage.
 * Before this, `address` / `isConnected` may still be initial `null` / `false`
 * even for a logged-in user — do not show "connect wallet" until hydrated.
 */
export function useWalletPersistHydrated(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const unsub = useWalletStore.persist.onFinishHydration(() => {
        onStoreChange();
      });
      return unsub;
    },
    () => useWalletStore.persist.hasHydrated(),
    () => false
  );
}
