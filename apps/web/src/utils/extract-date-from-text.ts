import { polymarketEndOfCalendarDayEt } from "@/utils/polymarket-calendar";

const MONTHS: Record<string, number> = {
  january: 0,
  february: 1,
  march: 2,
  april: 3,
  may: 4,
  june: 5,
  july: 6,
  august: 7,
  september: 8,
  october: 9,
  november: 10,
  december: 11,
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

const MONTH_PATTERN = Object.keys(MONTHS).join("|");

// "February 27, 2026" or "Feb 27, 2026" or "February 27 2026"
const FULL_DATE_RE = new RegExp(
  `(${MONTH_PATTERN})\\s+(\\d{1,2})(?:,|\\s)\\s*(\\d{4})`,
  "i"
);

/** e.g. "win on 2026-03-06" in sports questions — must parse before YEAR_ONLY_RE */
const ISO_DATE_RE = /\b(20\d{2})-(\d{2})-(\d{2})\b/;

/** US-style "4/16/2026" / "04/16/2026" (Polymarket copy); interpreted as MM/DD/YYYY */
const US_SLASH_DATE_RE = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/;

// "March 31" or "Jun 30" (no year — assume current or next occurrence)
const MONTH_DAY_RE = new RegExp(`(${MONTH_PATTERN})\\s+(\\d{1,2})`, "i");

// "in 2025" or "2025?" at end
const YEAR_ONLY_RE = /\b(20\d{2})\b/;

/**
 * Extract the last/most-relevant date from free-form text (e.g. market questions).
 * Returns a Date or null if no date found.
 *
 * Handles:
 * - "February 27, 2026" / "Feb 27, 2026"
 * - "2026-03-06" (ISO date in question text — sports slugs)
 * - "4/16/2026" (US slash dates in descriptions / rules)
 * - "March 31" (no year → infers current/next year)
 * - "in 2025" (year only → end of Dec 31 that year, US Eastern)
 */
export function extractDateFromText(text: string): Date | null {
  // Try full date first (Month Day, Year)
  const full = FULL_DATE_RE.exec(text);
  if (full) {
    const month = MONTHS[full[1].toLowerCase()];
    const day = Number.parseInt(full[2], 10);
    const year = Number.parseInt(full[3], 10);
    if (month != null) {
      return polymarketEndOfCalendarDayEt(year, month, day);
    }
  }

  const iso = ISO_DATE_RE.exec(text);
  if (iso) {
    const year = Number.parseInt(iso[1], 10);
    const month = Number.parseInt(iso[2], 10) - 1;
    const day = Number.parseInt(iso[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return polymarketEndOfCalendarDayEt(year, month, day);
    }
  }

  const usSlash = US_SLASH_DATE_RE.exec(text);
  if (usSlash) {
    const month = Number.parseInt(usSlash[1], 10) - 1;
    const day = Number.parseInt(usSlash[2], 10);
    const year = Number.parseInt(usSlash[3], 10);
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      return polymarketEndOfCalendarDayEt(year, month, day);
    }
  }

  // Try Month Day (no year)
  const md = MONTH_DAY_RE.exec(text);
  if (md) {
    const month = MONTHS[md[1].toLowerCase()];
    const day = Number.parseInt(md[2], 10);
    if (month != null) {
      // Check for a year elsewhere in the text
      const yearMatch = YEAR_ONLY_RE.exec(text);
      const year = yearMatch
        ? Number.parseInt(yearMatch[1], 10)
        : new Date().getFullYear();
      return polymarketEndOfCalendarDayEt(year, month, day);
    }
  }

  // Year only → end of that year
  const yearOnly = YEAR_ONLY_RE.exec(text);
  if (yearOnly) {
    return polymarketEndOfCalendarDayEt(
      Number.parseInt(yearOnly[1], 10),
      11,
      31
    );
  }

  return null;
}
