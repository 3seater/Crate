import { addBreadcrumb, setUser } from "@sentry/nextjs";
import type { QueryClient } from "@tanstack/react-query";
import { useWalletStore } from "@/stores/wallet";

/**
 * Robinhood Terminal uses wagmi-based wallet connections — no JWT session token.
 * This always returns null.
 */
export function getSessionToken(): string | null {
  return null;
}

// Module-level queryClient reference set by providers.tsx on mount
let _queryClient: QueryClient | null = null;
export function registerQueryClient(qc: QueryClient): void {
  _queryClient = qc;
}

/** Disconnect the wallet and clear React Query cache. */
export function clearAuthSession(): void {
  addBreadcrumb({
    category: "auth",
    level: "info",
    message: "clear_auth_session",
  });
  setUser(null);
  useWalletStore.getState().setDisconnected();
  _queryClient?.clear();
}
