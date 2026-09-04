/**
 * @doji/api CLOB module — Polymarket CLOB client.
 *
 * Thin wrapper around @polymarket/clob-client-v2. Uses viem WalletClient or EthersSigner for signing.
 */

export type { ClobMarketInfo, SignedOrderV2 } from "@doji/types";
export type { MarketDetails } from "@polymarket/clob-client-v2";
export { createAddressOnlySigner } from "./address-signer";
export {
  type BuilderConfigV2,
  type ClobClient,
  type ClobClientConfig,
  createClobClient,
  deriveOrCreateApiKey,
  normalizeCreds,
  OfficialOrderType,
  OfficialSide,
  type OrderType,
  PolymarketClobClient,
  type Side,
} from "./client";
