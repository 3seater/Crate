import { addBreadcrumb, setUser } from "@sentry/nextjs";
import { useWalletStore } from "@/stores/wallet";

/**
 * Robinhood Terminal uses wagmi-based wallet connections — no JWT session token.
 * This always returns null; the tRPC client sends no Authorization header.
 */
export function getSessionToken(): string | null {
  return null;
}

/** Disconnect the wallet and clear Sentry user context. */
export function clearAuthSession(): void {
  addBreadcrumb({
    category: "auth",
    level: "info",
    message: "clear_auth_session",
  });
  setUser(null);

  useWalletStore.getState().setDisconnected();

  // Clear all cached queries on sign-out.
  import("@/lib/trpc")
    .then(({ queryClient }) => {
      queryClient.clear();
    })
    .catch(() => undefined);
}
