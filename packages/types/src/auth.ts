// ─── Auth Types ──────────────────────────────────────────────────────────────

/** Wallet signature type for CLOB order signing. */
export const SignatureType = {
  EOA: 0,
  POLY_PROXY: 1,
  GNOSIS_SAFE: 2,
} as const;
export type SignatureType = (typeof SignatureType)[keyof typeof SignatureType];

/**
 * Represents an authenticated user's public profile data.
 * Returned by auth endpoints after login or session verification.
 */
export interface AuthUser {
  email: string;
  hasCredentials: boolean;
  id: string;
  safeAddress: string | null;
  walletAddress: string;
}

/**
 * Full session state returned by `auth.me`.
 * Single source of truth for client auth — replaces localStorage wallet store fields.
 */
export interface Session extends AuthUser {
  authMethod: "email" | "wallet";
  funderAddress: string | null;
  onboardingCompleted: boolean;
  signatureType: SignatureType;
}

/**
 * Server-side session payload extracted from a verified JWT.
 * Attached to tRPC context by the auth middleware.
 */
export interface AuthSession {
  exp: number;
  issuer: string;
  jti: string;
  userId: string;
}

/** Input for creating a new session token (jti/exp are generated server-side). */
export interface AuthSessionInput {
  issuer: string;
  userId: string;
}

/**
 * AES-256-GCM encrypted data envelope.
 * All fields are hex-encoded strings.
 */
export interface EncryptedCredentials {
  ciphertext: string;
  /** 12-byte initialization vector (hex-encoded) */
  iv: string;
  /** 16-byte authentication tag (hex-encoded) */
  tag: string;
}

/**
 * Re-export ApiKeyCreds from clob module for auth-context convenience.
 * Represents CLOB API credentials: { key, secret, passphrase }.
 */
export type { ApiKeyCreds } from "./clob";
