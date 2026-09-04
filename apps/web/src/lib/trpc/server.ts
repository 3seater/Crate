import "server-only";

import type { AppRouter } from "@doji/contract";
import { env } from "@doji/env/web";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

const serverUrl = env.NEXT_PUBLIC_SERVER_URL;

/** Timeout for server tRPC calls (prevents indefinite hangs if server is unreachable). */
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
  return fetch(input, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeoutId));
}

export const serverTrpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: `${serverUrl}/trpc`,
      fetch: fetchWithTimeout,
    }),
  ],
});

/**
 * Authenticated server-side tRPC caller.
 * Reads the session JWT from the HttpOnly cookie and forwards it
 * as Authorization header. Returns null if no cookie is present.
 *
 * Usage: `const caller = await getAuthenticatedServerTrpc();`
 * Always check for null before using — falls back gracefully.
 */
export async function getAuthenticatedServerTrpc() {
  const { cookies } = await import("next/headers");
  const { SESSION_COOKIE_NAME, ADDRESS_COOKIE_NAME } = await import("@/config");
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE_NAME)?.value;
  const address = jar.get(ADDRESS_COOKIE_NAME)?.value;

  if (!(token && address)) {
    return null;
  }

  const client = createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${serverUrl}/trpc`,
        fetch: fetchWithTimeout,
        headers: () => ({ Authorization: `Bearer ${token}` }),
      }),
    ],
  });

  return { client, address };
}
