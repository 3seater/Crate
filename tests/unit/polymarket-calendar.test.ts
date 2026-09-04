import { describe, expect, it } from "vitest";
import {
  parsePolymarketGammaEndDateIso,
  polymarketEndOfCalendarDayEt,
} from "@/shared/utils/polymarket-calendar";

function nyCalendar(isoDate: string, d: Date | null | undefined) {
  expect(d).toBeDefined();
  expect(d?.toLocaleDateString("en-CA", { timeZone: "America/New_York" })).toBe(
    isoDate
  );
}

describe("polymarket-calendar", () => {
  it("maps date-only ISO to end of that calendar day in Eastern", () => {
    const d = parsePolymarketGammaEndDateIso("2026-04-28");
    nyCalendar("2026-04-28", d);
    expect(d?.getTime()).toBe(
      polymarketEndOfCalendarDayEt(2026, 3, 28).getTime()
    );
  });

  it("maps Gamma UTC-midnight placeholder to end of that calendar day ET", () => {
    const d = parsePolymarketGammaEndDateIso("2026-04-28T00:00:00.000Z");
    nyCalendar("2026-04-28", d);
  });

  it("maps Gamma Eastern-midnight UTC instants to end of that calendar day ET", () => {
    const d = parsePolymarketGammaEndDateIso("2026-04-28T04:00:00.000Z");
    nyCalendar("2026-04-28", d);
    expect(d?.getTime()).toBe(
      polymarketEndOfCalendarDayEt(2026, 3, 28).getTime()
    );
  });

  it("preserves explicit non-midnight UTC timestamps", () => {
    const d = parsePolymarketGammaEndDateIso("2026-04-28T18:30:00.000Z");
    expect(d?.toISOString()).toBe("2026-04-28T18:30:00.000Z");
  });
});
