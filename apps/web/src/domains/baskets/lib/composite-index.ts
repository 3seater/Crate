import type { CompositeIndexPoint, OhlcvCandle } from "@doji/types";

export interface TokenCandles {
  candles: OhlcvCandle[];
  symbol: string;
  weight: number;
}

/**
 * Computes the normalized composite basket index from per-token OHLCV series.
 *
 * Algorithm (5 steps):
 * 1. Filter tokens with no candles.
 * 2. Re-normalize weights of remaining tokens so they sum to 1.0.
 * 3. Collect the union of all timestamps, sorted ascending.
 * 4. Anchor each token at t₀ (earliest timestamp): anchor price = close at t₀,
 *    falling back to the first candle's close if t₀ is not in the series.
 * 5. For each timestamp, compute the weighted normalized sum × 100.
 *
 * Invariant (Property 1): when input contains at least one valid token with
 * candles, the first returned point always has `value === 100.0`.
 *
 * Tokens with a zero anchor price are skipped per-token (zero-price guard).
 * Timestamps for which no token has a price are omitted from output.
 * If all tokens are filtered out, returns [].
 */
export function computeCompositeIndex(
  tokens: TokenCandles[]
): CompositeIndexPoint[] {
  // Step 1: filter tokens with no candle data
  const validTokens = tokens.filter((t) => t.candles.length > 0);
  if (validTokens.length === 0) {
    return [];
  }

  // Step 2: re-normalize weights so they sum to exactly 1.0
  const totalWeight = validTokens.reduce((sum, t) => sum + t.weight, 0);
  const normalizedWeights = validTokens.map((t) => t.weight / totalWeight);

  // Step 3: union of all timestamps across valid tokens, sorted ascending
  const timestampSet = new Set<number>();
  for (const token of validTokens) {
    for (const candle of token.candles) {
      timestampSet.add(candle.timestamp);
    }
  }
  const allTimestamps = [...timestampSet].sort((a, b) => a - b);

  if (allTimestamps.length === 0) {
    return [];
  }

  const t0 = allTimestamps[0];

  // Build per-token price lookup maps for O(1) access at each timestamp
  const priceMaps = validTokens.map(
    (token) => new Map(token.candles.map((c) => [c.timestamp, c.close]))
  );

  // Step 4: determine anchor price for each token at t₀
  // If t₀ is not in the series (or price is 0), fall back to the first candle's close
  const anchorPrices = validTokens.map((token, i) => {
    const atT0 = priceMaps[i].get(t0);
    if (atT0 !== undefined && atT0 > 0) {
      return atT0;
    }
    // fallback: first candle's close
    return token.candles[0].close;
  });

  // Step 5: weighted normalized sum at each timestamp
  const result: CompositeIndexPoint[] = [];

  for (const ts of allTimestamps) {
    let indexValue = 0;
    let totalContributingWeight = 0;

    for (let i = 0; i < validTokens.length; i++) {
      const anchorPrice = anchorPrices[i];

      // Zero anchor price guard — skip this token entirely
      if (anchorPrice === 0) {
        continue;
      }

      // Find the closest candle at or before ts (fall back to exact match only
      // since we use a Map; tokens without a candle at this ts are skipped)
      const priceAtTs = priceMaps[i].get(ts);
      if (priceAtTs === undefined) {
        continue;
      }

      // contribution = (P_i,t / P_i,0) × w_i × 100
      indexValue += (priceAtTs / anchorPrice) * normalizedWeights[i] * 100;
      totalContributingWeight += normalizedWeights[i];
    }

    // Only emit a point when at least one token contributed
    if (totalContributingWeight > 0) {
      // Re-scale so the weights of present tokens still sum to 1.0
      // (handles gap timestamps where only a subset of tokens have data)
      const scaledValue = indexValue / totalContributingWeight;
      result.push({ timestamp: ts, value: scaledValue });
    }
  }

  return result;
}
