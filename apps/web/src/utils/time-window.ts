/**
 * Pure time window utilities for recurring crypto markets.
 * No React or DOM dependencies — safe for any context.
 *
 * All functions accept an optional `now` parameter for testability
 * (defaults to Date.now()).
 */

/** Known timeframe durations in milliseconds */
export const TIMEFRAME_DURATIONS = {
  "5m": 300_000,
  "15m": 900_000,
  "1h": 3_600_000,
  "4h": 14_400_000,
  daily: 86_400_000,
} as const;

/** One day in milliseconds */
const MS_PER_DAY = 86_400_000;

/** Shared ET date formatter for extracting timezone offset */
const etDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hour12: false,
});

/**
 * Get the ET midnight timestamp for a given UTC timestamp.
 * Accounts for DST (UTC-4 or UTC-5) by using Intl to find the
 * ET date, then computing midnight of that date in ET.
 */
function getETMidnight(utcMs: number): number {
  const parts = etDateFormatter.formatToParts(new Date(utcMs));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);

  // The ET offset is the difference between the UTC time and the ET time components
  const hour = get("hour") === 24 ? 0 : get("hour");
  const minute = get("minute");
  const second = get("second");

  // Time elapsed since ET midnight in ms
  const etTimeSinceMidnight = (hour * 3600 + minute * 60 + second) * 1000;

  // ET midnight in UTC = utcMs - etTimeSinceMidnight
  // But we need to be precise about the millisecond component
  const msInSecond = utcMs % 1000;
  return utcMs - etTimeSinceMidnight - msInSecond;
}

/**
 * Compute the current time window boundaries for a given timeframe duration.
 *
 * Sub-daily windows (5min, 15min, 1hr, 4hr) use simple floor division
 * since they're UTC-aligned.
 *
 * Daily windows (86400000ms) align to midnight ET (UTC-4 or UTC-5
 * depending on DST).
 *
 * @param timeframeDurationMs - Duration of the timeframe in milliseconds
 * @param now - Current timestamp in ms (defaults to Date.now())
 * @returns Object with `start` and `end` timestamps in ms
 */
export function computeTimeWindow(
  timeframeDurationMs: number,
  now?: number
): { start: number; end: number } {
  const timestamp = now ?? Date.now();

  if (timeframeDurationMs === MS_PER_DAY) {
    // Daily windows align to noon ET (12 PM) — Polymarket resolves daily
    // crypto markets at 12 PM ET, not midnight.
    const NOON_OFFSET = 12 * 3_600_000;
    const etMidnight = getETMidnight(timestamp);
    const etNoon = etMidnight + NOON_OFFSET;
    // If before noon ET today, the current window started at noon yesterday
    if (timestamp < etNoon) {
      return { start: etNoon - MS_PER_DAY, end: etNoon };
    }
    return { start: etNoon, end: etNoon + MS_PER_DAY };
  }

  // Sub-daily: simple floor division (UTC-aligned)
  const start =
    Math.floor(timestamp / timeframeDurationMs) * timeframeDurationMs;
  return { start, end: start + timeframeDurationMs };
}

/**
 * Compute remaining seconds until a window ends.
 * Returns 0 if the window has already ended.
 *
 * @param windowEnd - Window end timestamp in ms
 * @param now - Current timestamp in ms (defaults to Date.now())
 * @returns Non-negative integer seconds remaining
 */
export function computeRemainingSeconds(
  windowEnd: number,
  now?: number
): number {
  const timestamp = now ?? Date.now();
  const remainingMs = windowEnd - timestamp;
  if (remainingMs <= 0) {
    return 0;
  }
  return Math.ceil(remainingMs / 1000);
}

/** Shared ET time formatter for slot labels */
const etTimeFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/**
 * Format a single timestamp as a time label in Eastern Time.
 * Example: "11:45 PM"
 *
 * @param timestamp - Timestamp in ms
 * @returns Formatted time string like "11:45 PM"
 */
export function formatTimeSlotLabelET(timestamp: number): string {
  return etTimeFormatter.format(new Date(timestamp));
}

/** Shared ET formatter for window display (month + day + time) */
const etMonthDayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "long",
  day: "numeric",
});

/** ET time formatter without AM/PM for the start time in a range */
const etTimeNoAmPmFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/**
 * Format a time window for display in Eastern Time.
 * Example: "April 1, 11:40-11:45PM ET"
 *
 * When start and end share the same AM/PM period, the start time
 * omits the AM/PM suffix. When they differ, both are shown.
 *
 * @param start - Window start timestamp in ms
 * @param end - Window end timestamp in ms
 * @returns Formatted string like "April 1, 11:40-11:45PM ET"
 */
export function formatTimeWindowET(start: number, end: number): string {
  const startDate = new Date(start);
  const endDate = new Date(end);

  const monthDay = etMonthDayFormatter.format(startDate);

  const startParts = etTimeNoAmPmFormatter.formatToParts(startDate);
  const endParts = etTimeNoAmPmFormatter.formatToParts(endDate);

  const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const startHour = getPart(startParts, "hour");
  const startMinute = getPart(startParts, "minute");
  const startPeriod = getPart(startParts, "dayPeriod");
  const endHour = getPart(endParts, "hour");
  const endMinute = getPart(endParts, "minute");
  const endPeriod = getPart(endParts, "dayPeriod");

  const startTime = `${startHour}:${startMinute}`;
  const endTime = `${endHour}:${endMinute}${endPeriod}`;

  // Include AM/PM on start only if it differs from end
  const startSuffix = startPeriod === endPeriod ? "" : startPeriod;

  return `${monthDay}, ${startTime}${startSuffix}-${endTime} ET`;
}

/** Time slot returned by generateTimeSlots */
export interface TimeSlotInfo {
  /** Slot end timestamp in ms */
  end: number;
  /** Whether this is the currently active slot */
  isActive: boolean;
  /** Whether this slot is in the past */
  isPast: boolean;
  /** Display label in ET, e.g. "11:45 PM" */
  label: string;
  /** Slot start timestamp in ms */
  start: number;
}

/**
 * Generate a list of contiguous time slots centered on the current window.
 *
 * The current window is placed roughly in the middle of the returned array.
 * Each slot has start, end, label, isPast, and isActive fields.
 *
 * @param timeframeDurationMs - Duration of each slot in ms
 * @param count - Total number of slots to generate
 * @param now - Current timestamp in ms (defaults to Date.now())
 * @returns Array of `count` contiguous TimeSlotInfo objects
 */
export function generateTimeSlots(
  timeframeDurationMs: number,
  count: number,
  now?: number
): TimeSlotInfo[] {
  const timestamp = now ?? Date.now();
  const currentWindow = computeTimeWindow(timeframeDurationMs, timestamp);

  // Place the current window roughly in the center
  const pastCount = Math.floor(count / 2);

  const slots: TimeSlotInfo[] = [];

  for (let i = 0; i < count; i++) {
    const offset = i - pastCount;
    const slotStart = currentWindow.start + offset * timeframeDurationMs;
    const slotEnd = slotStart + timeframeDurationMs;
    const isActive = offset === 0;
    const isPast = slotEnd <= timestamp;

    slots.push({
      start: slotStart,
      end: slotEnd,
      label: formatTimeSlotLabelET(slotStart),
      isPast,
      isActive,
    });
  }

  return slots;
}
