/**
 * Pure formatting utilities — framework-agnostic, no app imports.
 */

/**
 * Threshold above which we use compact notation (K/M).
 * Values >= this are shown as e.g. "1.2K", "500K" in formatUsdCompact and formatVolumeLike.
 */
export const FORMAT_COMPACT_NUMBER_THRESHOLD = 1000;

/**
 * Intl.NumberFormat fraction options for USD: 2 decimal places.
 * Used by formatUsdCompact and other USD formatters for non-compact values.
 */
export const FORMAT_USD_FRACTION_OPTIONS: {
  minimumFractionDigits: number;
  maximumFractionDigits: number;
} = {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
};

/**
 * Format a compact decimal for use as a K/M suffix multiplier.
 * Examples: 1.23 → "1.23", 12.3 → "12.3", 123 → "123"
 */
export function formatCompactNumber(value: number): string {
  if (value >= 100) {
    return value.toFixed(0);
  }
  if (value >= 10) {
    return value.toFixed(1);
  }
  return value.toFixed(2);
}

/**
 * Format USD with compact notation for large values (e.g. $1.2M, $500K).
 * Small values use Intl.NumberFormat with 2 decimals.
 *
 * @param value - The numeric value to format
 * @param options.zeroDisplay - Display for zero (default "$0"). Use "$0.00" for profile-style.
 * @param options.compact - When false, always use Intl.NumberFormat (e.g. $1,234.56). Default true.
 */
export function formatUsdCompact(
  value: number,
  options?: { zeroDisplay?: string; compact?: boolean }
): string {
  if (value === 0) {
    return options?.zeroDisplay ?? "$0";
  }

  const absValue = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (options?.compact === false) {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      ...FORMAT_USD_FRACTION_OPTIONS,
    }).format(absValue);
    return value < 0 ? `-${formatted}` : formatted;
  }

  if (absValue >= 1_000_000) {
    const millions = absValue / 1_000_000;
    return `${sign}$${formatCompactNumber(millions)}M`;
  }
  if (absValue >= FORMAT_COMPACT_NUMBER_THRESHOLD) {
    const thousands = absValue / FORMAT_COMPACT_NUMBER_THRESHOLD;
    return `${sign}$${formatCompactNumber(thousands)}K`;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    ...FORMAT_USD_FRACTION_OPTIONS,
  }).format(absValue);
  return value < 0 ? `-${formatted}` : formatted;
}

/**
 * Format a Unix timestamp (seconds) as relative time: "1s ago", "15s ago", "1m ago", "5m ago", "1h ago", "2d ago".
 */
export function formatTimeAgo(tsSeconds: number): string {
  const diffSec = Math.floor(Date.now() / 1000 - tsSeconds);
  if (diffSec < 0) {
    return "now";
  }
  if (diffSec < 60) {
    return `${Math.max(1, diffSec)}s ago`;
  }
  if (diffSec < 3600) {
    return `${Math.floor(diffSec / 60)}m ago`;
  }
  if (diffSec < 86_400) {
    return `${Math.floor(diffSec / 3600)}h ago`;
  }
  return `${Math.floor(diffSec / 86_400)}d ago`;
}

/**
 * Format a number with K/M compact notation (no currency).
 * Used for volume, trade size, position size display.
 *
 * @param value - The numeric value
 * @param smallValueDecimals - Decimals for values below 1000 (default 0). Use 1 for card/size display, 2 for trade size.
 */
export function formatVolumeLike(
  value: number,
  smallValueDecimals = 0
): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= FORMAT_COMPACT_NUMBER_THRESHOLD) {
    return `${(value / FORMAT_COMPACT_NUMBER_THRESHOLD).toFixed(1)}K`;
  }
  return value.toFixed(smallValueDecimals);
}
