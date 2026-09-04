/**
 * Startup config validation: builder credentials and sign-endpoint tokens.
 * Fail fast if builder sign is enabled but credentials are invalid or (in production) sign tokens missing.
 */

import { env } from "@doji/env/server";
import { logger } from "@doji/logger";

export function validateConfig(): void {
  // Skip in test
  if (env.NODE_ENV === "test") {
    return;
  }

  const hasBuilderId = Boolean(env.POLYMARKET_BUILDER_ID?.trim());
  const hasBuilderSecret = Boolean(env.POLYMARKET_BUILDER_SIGNING_KEY?.trim());
  const hasBuilderPassphrase = Boolean(
    env.POLYMARKET_BUILDER_PASSPHRASE?.trim()
  );

  // Builder ID, secret, and passphrase are all needed for Relayer HMAC auth.
  const builderCredsCount = [
    hasBuilderId,
    hasBuilderSecret,
    hasBuilderPassphrase,
  ].filter(Boolean).length;
  if (builderCredsCount > 0 && builderCredsCount < 3) {
    throw new Error(
      "Invalid config: POLYMARKET_BUILDER_ID, POLYMARKET_BUILDER_SECRET, and POLYMARKET_BUILDER_PASSPHRASE must all be set or all unset"
    );
  }

  if (builderCredsCount === 3) {
    const raw = env.POLYMARKET_SIGN_TOKENS;
    const hasSignTokens = Boolean(raw?.trim());
    if (!hasSignTokens) {
      throw new Error(
        "Invalid config: POLYMARKET_SIGN_TOKENS must be set whenever builder credentials are configured (to protect the sign endpoint). This applies in all environments."
      );
    }
  }

  // Warn about Polygonscan V1 API deprecation (Aug 2025)
  if (!env.ETHERSCAN_API_KEY?.trim()) {
    logger.warn(
      "ETHERSCAN_API_KEY not set — balance lookups will fall back to deprecated Polygonscan V1 API. Set ETHERSCAN_API_KEY for Etherscan V2."
    );
  }
}
