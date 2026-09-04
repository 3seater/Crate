/**
 * Map builder-relayer-client and builder-signing-sdk error messages to user-facing copy.
 * Shared between api package (server procedures) and web app.
 */

const RELAYER_MESSAGE_MAP: Record<string, string> = {
  "safe already deployed!": "Your Safe wallet is already set up.",
  "safe not deployed!": "Please deploy your Safe wallet first.",
  "signer is needed to interact with this endpoint!":
    "Please connect your wallet to continue.",
  "config is not supported on the chainid": "This network is not supported.",
  "invalid network": "This network is not supported.",
  "invalid signature": "Invalid signature. Please try again.",
  "invalid remote url!": "Builder signer is misconfigured. Please try again.",
  "invalid auth token": "Builder auth failed. Please try again.",
  "invalid local builder credentials!":
    "Builder credentials are invalid. Please try again.",
  "invalid builder creds configured!":
    "Builder signer unavailable. Please try again.",
  // CLOB client auth errors
  "api credentials are needed": "Builder signer unavailable. Please try again.",
  "builder api credentials needed":
    "Builder signer unavailable. Please try again.",
  "builder key auth failed": "Builder signer unavailable. Please try again.",
  "no orderbook": "Orderbook is empty. Please try again.",
  "no match": "No matching orders available. Try a different price.",
  "signer does not match": "Order signer does not match connected wallet.",
  // Split/merge on-chain failures
  "failed onchain":
    "Transaction reverted on-chain. Try merging a slightly smaller amount (e.g. 0.98 instead of 1.0).",
  // Rate limiting
  "quota exceeded": "Too many requests. Please wait a moment and try again.",
};

/**
 * Map SDK error message to user-facing string.
 */
export function mapRelayerOrBuilderMessage(message: string): string {
  const lower = message.toLowerCase().trim();
  for (const [key, value] of Object.entries(RELAYER_MESSAGE_MAP)) {
    if (lower.includes(key.toLowerCase())) {
      return value;
    }
  }
  try {
    const parsed = JSON.parse(message) as { error?: string; status?: number };
    if (typeof parsed.error === "string") {
      return mapRelayerOrBuilderMessage(parsed.error) || parsed.error;
    }
    if (parsed.status === 429) {
      return "Too many requests. Please wait and try again.";
    }
    if (parsed.status && parsed.status >= 500) {
      return "The service is temporarily unavailable. Please try again later.";
    }
  } catch {
    // Not JSON
  }
  return message;
}
