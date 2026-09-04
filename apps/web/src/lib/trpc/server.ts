import "server-only";

import type { AppRouter } from "@doji/contract";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

/**
 * Absolute URL for server-side tRPC calls (SSR can't use relative paths).
 * Priority: NEXT_PUBLIC_APP_URL → Netlify URL → Vercel URL → localhost.
 */
function getServerTrpcUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.URL?.trim() || // Netlify
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    "http://localhost:3000";
  return `${base}/api/trpc`;
}

const SERVER_FETCH_TIMEOUT_MS = 30_000;

function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    SERVER_FETCH_TIMEOUT_MS
  );
  return fetch(input, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timeoutId)
  );
}

export const serverTrpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: getServerTrpcUrl(),
      fetch: fetchWithTimeout,
    }),
  ],
});
