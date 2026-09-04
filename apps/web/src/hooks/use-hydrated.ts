import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {
  /* no-op unsubscribe */
};

/**
 * Returns `true` on the client after hydration, `false` on the server and during SSR.
 * Uses `useSyncExternalStore` to avoid the setState-in-useEffect flash pattern.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}
