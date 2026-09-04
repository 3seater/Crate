import { env } from "@doji/env/server";

/**
 * Public Polygon RPC endpoints used when POLYGON_RPC_URL fails or rate-limits.
 * Keep in sync with approval checks — some providers (e.g. dRPC free) may reject eth_call.
 */
export const POLYGON_FALLBACK_RPC_URLS = [
  "https://polygon.publicnode.com",
  "https://tenderly.rpc.polygon.community",
  "https://polygon-public.nodies.app",
] as const;

/** Primary URL first, then fallbacks (no duplicate if primary matches a fallback). */
export function getPolygonRpcUrlsToTry(): string[] {
  return [
    env.POLYGON_RPC_URL,
    ...POLYGON_FALLBACK_RPC_URLS.filter((u) => u !== env.POLYGON_RPC_URL),
  ];
}
