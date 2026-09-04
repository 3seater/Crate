/**
 * Doji CLOB client — thin wrapper around @polymarket/clob-client-v2.
 *
 * Uses viem WalletClient or EthersSigner for signing. Extends the official client
 * with builder-operations endpoints (get/post) that the official package does not include.
 */

import type {
  ApiKeyCreds as ApiKeyCredsType,
  BuilderConfigV2,
  Chain,
} from "@doji/types";

export type { ApiKeyCreds, BuilderConfigV2 } from "@doji/types";

import {
  ClobClient as BaseClobClient,
  createL2Headers,
  type OrderType as OrderTypeEnum,
  type Side as SideEnum,
  type SignatureTypeV2,
} from "@polymarket/clob-client-v2";

import type { WalletClient } from "viem";

import { createAddressOnlySigner } from "./address-signer";

/** Matches the EthersSigner interface from @polymarket/clob-client-v2's ClobSigner union. */
interface EthersSigner {
  _signTypedData(
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, unknown>
  ): Promise<string>;
  getAddress(): Promise<string>;
}

/** Union matching the SDK's ClobSigner = EthersSigner | WalletClient. */
type ClobSigner = EthersSigner | WalletClient;

const GET_BUILDER_OPERATIONS = "/builder-operations";
const POST_BUILDER_OPERATIONS = "/builder-operations";
const GET_SIMPLIFIED_MARKET = "/simplified-markets";

const DEFAULT_NONCE = 0;

function extractKey(creds: ApiKeyCredsType): string | undefined {
  return (
    creds?.key ?? (creds as unknown as { apiKey?: string })?.apiKey ?? undefined
  );
}

export function normalizeCreds(creds: ApiKeyCredsType): ApiKeyCredsType {
  return {
    key: extractKey(creds) ?? "",
    secret: creds.secret ?? "",
    passphrase: creds.passphrase ?? "",
  };
}

/**
 * Derive existing API credentials first; create only if none exist.
 *
 * Workaround for Polymarket clob-client#202: createOrDeriveApiKey attempts
 * create-first, which fails with 400 when an API key already exists for nonce 0.
 * This helper uses derive-first, then create only when derive returns no key.
 *
 * NONCE_ALREADY_USED handling: if createApiKey throws because a key for this
 * nonce was created between our derive and create calls (race), we re-derive.
 */
export async function deriveOrCreateApiKey(
  client: {
    deriveApiKey: (nonce?: number) => Promise<ApiKeyCredsType>;
    createApiKey: (nonce?: number) => Promise<ApiKeyCredsType>;
  },
  nonce = DEFAULT_NONCE
): Promise<ApiKeyCredsType> {
  // Derive-first: if credentials exist for this nonce, return them.
  // A 400/error means no key exists yet — fall through to createApiKey.
  try {
    const derived = await client.deriveApiKey(nonce);
    if (extractKey(derived)) {
      return normalizeCreds(derived);
    }
  } catch {
    // Expected for new wallets — no credentials exist yet
  }

  try {
    const created = await client.createApiKey(nonce);
    return normalizeCreds(created);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("NONCE_ALREADY_USED")) {
      // Key was created between our derive and create calls — re-derive
      const rederived = await client.deriveApiKey(nonce);
      if (extractKey(rederived)) {
        return normalizeCreds(rederived);
      }
    }
    throw err;
  }
}

export {
  ClobClient as PolymarketClobClient,
  OrderType as OfficialOrderType,
  Side as OfficialSide,
} from "@polymarket/clob-client-v2";

export type OrderType = (typeof OrderTypeEnum)[keyof typeof OrderTypeEnum];
export type Side = (typeof SideEnum)[keyof typeof SideEnum];

export interface ClobClientConfig {
  builderConfig?: BuilderConfigV2;
  chain: Chain | number;
  creds?: ApiKeyCredsType;
  funderAddress?: string;
  host: string;
  retryOnError?: boolean;
  signatureType?: SignatureTypeV2;
  /** Signer for L1 (createOrDeriveApiKey) and order signing. Required for credential derivation. */
  signer?: ClobSigner;
  /** When no signer available (server-side L2-only), provide address for POLY_ADDRESS header. */
  signerAddress?: string;
  useServerTime?: boolean;
}

/**
 * Extended ClobClient that adds builder-operations methods.
 * The official @polymarket/clob-client-v2 does not include these endpoints.
 *
 * NOTE: The base class `get`/`post` are private, so custom endpoints use `fetch` directly.
 * `getClobMarketInfo` is inherited from the base class (returns `MarketDetails`).
 */
class DojiClobClient extends BaseClobClient {
  async getBuilderOperations(): Promise<unknown[]> {
    if (this.signer === undefined || this.creds === undefined) {
      throw new Error("L2 auth required for getBuilderOperations");
    }
    const headerArgs = {
      method: "GET" as const,
      requestPath: GET_BUILDER_OPERATIONS,
    };
    const headers = await createL2Headers(
      this.signer,
      this.creds,
      headerArgs,
      this.useServerTime ? await this.getServerTime() : undefined
    );
    const res = await fetch(`${this.host}${GET_BUILDER_OPERATIONS}`, {
      method: "GET",
      headers: headers as unknown as Record<string, string>,
    });
    const result = await res.json();
    return Array.isArray(result) ? result : [];
  }

  async postBuilderOperation(
    operation: Record<string, unknown>
  ): Promise<unknown> {
    if (this.signer === undefined || this.creds === undefined) {
      throw new Error("L2 auth required for postBuilderOperation");
    }
    const body = JSON.stringify(operation);
    const headerArgs = {
      method: "POST" as const,
      requestPath: POST_BUILDER_OPERATIONS,
      body,
    };
    const headers = await createL2Headers(
      this.signer,
      this.creds,
      headerArgs,
      this.useServerTime ? await this.getServerTime() : undefined
    );
    const res = await fetch(`${this.host}${POST_BUILDER_OPERATIONS}`, {
      method: "POST",
      headers: {
        ...(headers as unknown as Record<string, string>),
        "Content-Type": "application/json",
      },
      body,
    });
    return res.json();
  }

  /**
   * Fetches a single simplified market by condition ID.
   * The official @polymarket/clob-client-v2 only exposes getSimplifiedMarkets (paginated list).
   */
  async getSimplifiedMarketByConditionId(
    conditionId: string
  ): Promise<unknown> {
    const res = await fetch(
      `${this.host}${GET_SIMPLIFIED_MARKET}/${conditionId}`
    );
    return res.json();
  }
}

/**
 * Create a ClobClient from Doji-style config.
 *
 * - With signer: full L1 + L2 (createOrder, postOrder, etc.)
 * - With signerAddress + creds: L2-only (postOrder with pre-signed order, cancel, etc.)
 * - With neither: read-only (orderbook, prices, etc.)
 */
export function createClobClient(config: ClobClientConfig): DojiClobClient {
  const host = config.host.endsWith("/")
    ? config.host.slice(0, -1)
    : config.host;
  const chain = config.chain as number;

  const signer =
    config.signer ??
    (config.signerAddress
      ? createAddressOnlySigner(config.signerAddress)
      : undefined);

  return new DojiClobClient({
    host,
    chain,
    signer,
    creds: config.creds,
    signatureType: config.signatureType,
    funderAddress: config.funderAddress,
    useServerTime: config.useServerTime,
    builderConfig: config.builderConfig,
    retryOnError: config.retryOnError,
    throwOnError: true,
  });
}

export type ClobClient = DojiClobClient;
