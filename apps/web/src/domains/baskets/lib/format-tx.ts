import { robinhoodChain } from "@/config/chains";

/**
 * Truncates a transaction hash to the standard display format: 0x1234…5678
 * Shows first 6 chars (0x + 4) and last 4 chars.
 */
export function formatTxHash(hash: string): string {
  if (hash.length <= 14) {
    return hash;
  }
  return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}

/**
 * Returns the block explorer URL for a transaction hash on Robinhood Chain.
 * Uses the block explorer URL from the robinhoodChain config — no hardcoded values.
 */
export function blockExplorerTxUrl(hash: string): string {
  const baseUrl = robinhoodChain.blockExplorers.default.url;
  return `${baseUrl}/tx/${hash}`;
}
