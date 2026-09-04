/**
 * Deterministic ID helpers for fixtures.
 * Use createId from helpers for generic IDs; these add domain-specific formatting.
 */
import { createId } from "../helpers";

/** EIP-55–like placeholder (not real checksum). Use for wallet/safe addresses in tests. */
export function createAddress(seed = 1): string {
  const hex = createId("a", seed)
    .replace(/[^a-z0-9]/gi, "")
    .padEnd(40, "0");
  return `0x${hex.slice(0, 40)}`;
}

/** Token ID–shaped string (e.g. for CLOB). */
export function createTokenId(seed = 1): string {
  return createId("tok", seed);
}

/** Condition ID–shaped string (0x + 64 hex chars). */
export function createConditionId(seed = 1): string {
  const hex = createId("cond", seed)
    .replace(/\D/g, "")
    .padStart(64, "0")
    .slice(-64);
  return `0x${hex}`;
}

/** Market slug–shaped string. */
export function createMarketSlug(seed = 1): string {
  return `market-${createId("slug", seed)}`.toLowerCase().replace(/_/g, "-");
}

/** Order ID–shaped string. */
export function createOrderId(seed = 1): string {
  return createId("order", seed);
}
