import { describe, expect, it } from "vitest";
import { extractDateFromText } from "@/shared/utils/extract-date-from-text";

function nyCalendar(isoDate: string, d: Date | null | undefined) {
  expect(d).toBeDefined();
  expect(d?.toLocaleDateString("en-CA", { timeZone: "America/New_York" })).toBe(
    isoDate
  );
}

describe("extractDateFromText", () => {
  it("should parse ISO YYYY-MM-DD in question text without treating year as year-only Dec 31", () => {
    const d = extractDateFromText("Will Team A win on 2026-03-06?");
    nyCalendar("2026-03-06", d);
  });

  it("should parse US slash dates MM/DD/YYYY", () => {
    const d = extractDateFromText(
      "Market resolves after game scheduled for 4/16/2026."
    );
    nyCalendar("2026-04-16", d);
  });

  it("should parse named month dates", () => {
    const d = extractDateFromText("Will X happen by February 27, 2026?");
    nyCalendar("2026-02-27", d);
  });
});
