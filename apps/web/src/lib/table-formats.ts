/**
 * Compact date/time formatters for data tables.
 * All formats are designed to stay on one line (no wrap).
 * Use with `whitespace-nowrap` on the containing cell.
 */

/**
 * Share quantities for read-only UI: two decimal places, en-US grouping.
 * (Distinct from `formatSharesDisplay` in trading-utils, which handles forms/dust.)
 */
export function formatSharesAmount(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Local date+time for table cells (browser timezone, 12-hour clock). */
const TABLE_COMPACT_DATE_TIME: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
};

/**
 * Format Unix timestamp (seconds) for table cells. Compact, single-line.
 * Uses the viewer's local timezone, e.g. "Dec 25, 3:05 PM".
 */
export function formatCompactDateTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", TABLE_COMPACT_DATE_TIME).format(date);
}

/**
 * Format expiration string (seconds or ISO) for order tables. Compact, single-line.
 * Local timezone, 12-hour clock, e.g. "Dec 25, 3:05 PM" or with year if not current year.
 */
export function formatCompactExpiration(expiration: string): string {
  if (!expiration) {
    return "—";
  }
  const parsed = Number.parseInt(expiration, 10);
  const date = Number.isNaN(parsed)
    ? new Date(expiration)
    : new Date(parsed * 1000);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  const now = new Date();
  const needsYear = date.getFullYear() !== now.getFullYear();
  return new Intl.DateTimeFormat("en-US", {
    ...TABLE_COMPACT_DATE_TIME,
    ...(needsYear && { year: "numeric" }),
  }).format(date);
}

/**
 * Format limit order expiration for both market and portfolio orders tables.
 * GTC orders use expiration 0 or empty → displays "GTC".
 * GTD orders with valid timestamp → displays formatted date.
 */
export function formatOrderExpiration(expiration: string): string {
  if (!expiration || expiration.trim() === "") {
    return "GTC";
  }
  const parsed = Number.parseInt(expiration, 10);
  if (!Number.isNaN(parsed) && parsed === 0) {
    return "GTC";
  }
  return formatCompactExpiration(expiration);
}

const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_WEEK = 7 * SECONDS_PER_DAY;

function ageSeconds(
  timestamp: number,
  nowSec = Math.floor(Date.now() / 1000)
): number {
  return nowSec - timestamp;
}

/**
 * History-style cells: under 24h → "45s ago", "12m ago", "3h ago"; older → local date+time.
 */
export function formatHistoryRelativeOrDateTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "—";
  }
  const a = ageSeconds(timestamp);
  if (a < 0) {
    return formatCompactDateTime(timestamp);
  }
  if (a < SECONDS_PER_DAY) {
    if (a < 60) {
      return `${Math.max(1, a)}s ago`;
    }
    if (a < 3600) {
      return `${Math.floor(a / 60)}m ago`;
    }
    return `${Math.floor(a / 3600)}h ago`;
  }
  return formatCompactDateTime(timestamp);
}

/**
 * Trades "age" column: compact labels without "ago" — now, 5m, 2h, 3d, 2w; older → local date+time.
 */
export function formatTradesAgeShort(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "—";
  }
  const a = ageSeconds(timestamp);
  if (a < 0) {
    return formatCompactDateTime(timestamp);
  }
  if (a < 45) {
    return "now";
  }
  if (a < 3600) {
    return `${Math.max(1, Math.floor(a / 60))}m`;
  }
  if (a < SECONDS_PER_DAY) {
    return `${Math.max(1, Math.floor(a / 3600))}h`;
  }
  if (a < 7 * SECONDS_PER_DAY) {
    return `${Math.max(1, Math.floor(a / SECONDS_PER_DAY))}d`;
  }
  if (a < 28 * SECONDS_PER_DAY) {
    return `${Math.max(1, Math.floor(a / SECONDS_PER_WEEK))}w`;
  }
  return formatCompactDateTime(timestamp);
}

/**
 * Trades tab "Age" column: second-level labels for the first minute (`12s`, `59s`), then compact `5m` / `2h` / …
 * Use with {@link useTradesAgeTick} so values update while the row is recent.
 */
export function formatTradesAgeLive(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "—";
  }
  const a = ageSeconds(timestamp);
  if (a < 0) {
    return formatCompactDateTime(timestamp);
  }
  if (a < 60) {
    return `${Math.max(1, a)}s`;
  }
  if (a < 3600) {
    return `${Math.max(1, Math.floor(a / 60))}m`;
  }
  if (a < SECONDS_PER_DAY) {
    return `${Math.max(1, Math.floor(a / 3600))}h`;
  }
  if (a < 7 * SECONDS_PER_DAY) {
    return `${Math.max(1, Math.floor(a / SECONDS_PER_DAY))}d`;
  }
  if (a < 28 * SECONDS_PER_DAY) {
    return `${Math.max(1, Math.floor(a / SECONDS_PER_WEEK))}w`;
  }
  return formatCompactDateTime(timestamp);
}

/** Max age (seconds) for which history-style rows should periodically refresh the label. */
export const HISTORY_TABLE_TICK_MAX_AGE_SEC = SECONDS_PER_DAY;

/** Max age (seconds) for which trades age cells should periodically refresh. */
export const TRADES_TABLE_TICK_MAX_AGE_SEC = 28 * SECONDS_PER_DAY;
