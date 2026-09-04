import { env } from "@doji/env/server";
import type { ApiKeyCreds, Chain, EncryptedCredentials } from "@doji/types";
import { isValidBuilderCode } from "@doji/types";
import { createClobClient, deriveOrCreateApiKey } from "./clob";

import { decrypt, encrypt } from "./crypto";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  return Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, "hex");
}

// ─── User Record Shape ───────────────────────────────────────────────────────

interface UserWithCredentials {
  encryptedCreds: string | null;
  safeAddress: string | null;
  /** Wallet address (EOA) for L2 POLY_ADDRESS header. Required for server-side client. */
  walletAddress: string;
}

// ─── Factory Functions ───────────────────────────────────────────────────────

/**
 * Creates a CLOB client for L2-only operations (postOrder, cancel, etc.)
 * using the user's stored credentials and Safe address.
 *
 * Uses an address-only signer since the server has no access to the user's wallet.
 * Order creation is not supported on the server—use client-side signing.
 *
 * @param user - User record with safeAddress, encryptedCreds, and walletAddress
 */
export function createUserClobClient(
  user: UserWithCredentials
): ReturnType<typeof createClobClient> {
  if (!user.safeAddress) {
    throw new Error(
      "Cannot create CLOB client: user has no Gnosis Safe address"
    );
  }

  if (!user.encryptedCreds) {
    throw new Error(
      "Cannot create CLOB client: user has no encrypted credentials"
    );
  }

  const key = getEncryptionKey();

  let creds: ApiKeyCreds;
  try {
    const encryptedData = JSON.parse(
      user.encryptedCreds
    ) as EncryptedCredentials;
    const plaintext = decrypt(encryptedData, key);
    creds = JSON.parse(plaintext) as ApiKeyCreds;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Credential decryption failed: ${message}`);
  }

  // V2: validate POLY_BUILDER_CODE for order attribution (static builderCode, no HMAC signing)
  const builderCode = env.POLY_BUILDER_CODE;
  if (!builderCode) {
    throw new Error(
      "POLY_BUILDER_CODE is missing or invalid. Expected a bytes32 hex string (0x + 64 hex chars)."
    );
  }
  if (!isValidBuilderCode(builderCode)) {
    throw new Error(
      `POLY_BUILDER_CODE is invalid: "${builderCode}". Expected a bytes32 hex string (0x + 64 hex chars).`
    );
  }

  return createClobClient({
    host: env.CLOB_API_URL,
    chain: env.CHAIN_ID as Chain,
    signerAddress: user.walletAddress,
    creds,
    signatureType: 2, // Gnosis Safe
    funderAddress: user.safeAddress,
    builderConfig: { builderCode },
    useServerTime: true,
  });
}

/**
 * Creates a CLOB client for user-scoped queries (getOpenOrders, getOrder, etc.)
 * WITHOUT builder config — prevents returning all builder-attributed orders.
 */
export function createUserClobClientForQueries(
  user: UserWithCredentials
): ReturnType<typeof createClobClient> {
  if (!user.safeAddress) {
    throw new Error(
      "Cannot create CLOB client: user has no Gnosis Safe address"
    );
  }
  if (!user.encryptedCreds) {
    throw new Error(
      "Cannot create CLOB client: user has no encrypted credentials"
    );
  }

  const key = getEncryptionKey();
  const encryptedData = JSON.parse(user.encryptedCreds) as EncryptedCredentials;
  const plaintext = decrypt(encryptedData, key);
  const creds = JSON.parse(plaintext) as ApiKeyCreds;

  return createClobClient({
    host: env.CLOB_API_URL,
    chain: env.CHAIN_ID as Chain,
    signerAddress: user.walletAddress,
    creds,
    signatureType: 2,
    funderAddress: user.safeAddress,
    useServerTime: true,
  });
}

/**
 * Derives CLOB API credentials using a signer.
 * Call from client-side with Magic provider or viem WalletClient.
 *
 * @param signer - ClobSigner (EthersSigner or viem WalletClient)
 */
export async function deriveUserCredentials(
  signer: NonNullable<Parameters<typeof createClobClient>[0]["signer"]>
): Promise<string> {
  const tempClient = createClobClient({
    host: env.CLOB_API_URL,
    chain: env.CHAIN_ID as Chain,
    signer,
  });

  let creds: ApiKeyCreds;
  try {
    creds = await deriveOrCreateApiKey(tempClient);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Credential derivation failed: ${message}`);
  }

  const key = getEncryptionKey();
  const plaintext = JSON.stringify(creds);
  const encryptedData = encrypt(plaintext, key);

  return JSON.stringify(encryptedData);
}
