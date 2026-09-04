/**
 * Branded types for domain identifiers.
 *
 * Uses a phantom brand field to create nominal types that prevent
 * accidentally passing one identifier type where another is expected.
 *
 * @example
 * ```ts
 * const token = tokenId("abc123");
 * const condition = conditionId("def456");
 *
 * // TypeScript will reject this at compile time:
 * // functionExpectingTokenId(condition); // Error!
 * ```
 */

declare const __brand: unique symbol;

/**
 * Utility type that brands a base type `T` with a phantom field `B`.
 * At runtime, branded values are identical to their base type.
 * At compile time, differently-branded values are incompatible.
 */
export type Brand<T, B extends string> = T & { readonly [__brand]: B };

/** A branded string representing a Polymarket token identifier. */
export type TokenId = Brand<string, "TokenId">;

/** A branded string representing a Polymarket condition identifier. */
export type ConditionId = Brand<string, "ConditionId">;

/** A branded string representing a Polymarket question identifier. */
export type QuestionId = Brand<string, "QuestionId">;

/** A branded string representing a Polymarket market slug. */
export type MarketSlug = Brand<string, "MarketSlug">;

/** A branded string representing an Ethereum wallet address. */
export type WalletAddress = Brand<string, "WalletAddress">;

/** A branded string representing a Polymarket order identifier. */
export type OrderId = Brand<string, "OrderId">;

/** Creates a branded `TokenId` from a plain string. */
export function tokenId(value: string): TokenId {
  return value as TokenId;
}

/** Creates a branded `ConditionId` from a plain string. */
export function conditionId(value: string): ConditionId {
  return value as ConditionId;
}

/** Creates a branded `QuestionId` from a plain string. */
export function questionId(value: string): QuestionId {
  return value as QuestionId;
}

/** Creates a branded `MarketSlug` from a plain string. */
export function marketSlug(value: string): MarketSlug {
  return value as MarketSlug;
}

/** Creates a branded `WalletAddress` from a plain string. */
export function walletAddress(value: string): WalletAddress {
  return value as WalletAddress;
}

/** Creates a branded `OrderId` from a plain string. */
export function orderId(value: string): OrderId {
  return value as OrderId;
}
