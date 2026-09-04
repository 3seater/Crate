import { TZDate } from "@date-fns/tz";

/**
 * Polymarket lists end/open times in **US Eastern** for most markets (sports copy,
 * rules). Calendar-only strings (“Apr 28”, `YYYY-MM-DD`) mean that **whole day** in
 * Eastern, not UTC midnight (which is still the previous evening in ET).
 */
export const POLYMARKET_DISPLAY_TIMEZONE = "America/New_York";

/**
 * Last millisecond of a calendar day in {@link POLYMARKET_DISPLAY_TIMEZONE}, as a UTC
 * `Date` (for comparisons and sorting).
 */
export function polymarketEndOfCalendarDayEt(
  year: number,
  monthIndex: number,
  day: number
): Date {
  return new Date(
    new TZDate(
      year,
      monthIndex,
      day,
      23,
      59,
      59,
      999,
      POLYMARKET_DISPLAY_TIMEZONE
    ).getTime()
  );
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Gamma often sends `…T00:00:00.000Z` as a stand-in for “this calendar date”, not a
 * real instant at UTC midnight — treat like date-only → end of that **local calendar
 * date** in Eastern (same Y-M-D as in the string).
 */
const UTC_MIDNIGHT_Z_RE = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.000)?Z$/;

function getEasternWallClockParts(d: Date): {
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} | null {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: POLYMARKET_DISPLAY_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = dtf.formatToParts(d);
  const val = (type: Intl.DateTimeFormatPart["type"]) =>
    parts.find((p) => p.type === type)?.value;
  const year = Number(val("year"));
  const month = Number(val("month"));
  const day = Number(val("day"));
  const hour = Number(val("hour"));
  const minute = Number(val("minute"));
  const second = Number(val("second"));
  if ([year, month, day, hour, minute, second].some((n) => Number.isNaN(n))) {
    return null;
  }
  return {
    year,
    monthIndex: month - 1,
    day,
    hour,
    minute,
    second,
  };
}

/**
 * Parse API / ISO end strings the way Polymarket implies for listing: date-only,
 * UTC-midnight placeholders, and **Eastern midnight** instants (e.g. `…T04:00:00.000Z`
 * during EDT) → end of that Eastern calendar day; otherwise preserve real timestamps.
 */
export function parsePolymarketGammaEndDateIso(iso: string): Date | null {
  const trimmed = iso.trim();

  const dateOnly = DATE_ONLY_RE.exec(trimmed);
  if (dateOnly) {
    return polymarketEndOfCalendarDayEt(
      Number.parseInt(dateOnly[1], 10),
      Number.parseInt(dateOnly[2], 10) - 1,
      Number.parseInt(dateOnly[3], 10)
    );
  }

  const utcMidnight = UTC_MIDNIGHT_Z_RE.exec(trimmed);
  if (utcMidnight) {
    return polymarketEndOfCalendarDayEt(
      Number.parseInt(utcMidnight[1], 10),
      Number.parseInt(utcMidnight[2], 10) - 1,
      Number.parseInt(utcMidnight[3], 10)
    );
  }

  try {
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    const eastern = getEasternWallClockParts(parsed);
    if (
      eastern &&
      eastern.minute === 0 &&
      eastern.second === 0 &&
      (eastern.hour === 0 || eastern.hour === 24)
    ) {
      // `en-US` + some runtimes emit hour 24 for midnight; treat both as start-of-calendar-day ET.
      return polymarketEndOfCalendarDayEt(
        eastern.year,
        eastern.monthIndex,
        eastern.day
      );
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Slash date `M/D/YY` using the Eastern calendar date of the instant (Polymarket-style). */
export function formatPolymarketSlashDateYy(d: Date): string {
  return d.toLocaleDateString("en-US", {
    timeZone: POLYMARKET_DISPLAY_TIMEZONE,
    month: "numeric",
    day: "numeric",
    year: "2-digit",
  });
}

/** Long label like `Apr 28, 2026` in Eastern for that instant. */
export function formatPolymarketLongMonthDayYear(d: Date): string {
  return d.toLocaleDateString("en-US", {
    timeZone: POLYMARKET_DISPLAY_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
