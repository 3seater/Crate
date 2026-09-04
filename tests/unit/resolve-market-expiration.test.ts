import { describe, expect, it } from "vitest";
import type { Event, Market } from "@/shared/lib/trpc/types";
import { resolveMarketExpirationDate } from "@/shared/utils/resolve-market-expiration";

function nyCalendar(isoDate: string, d: Date | null | undefined) {
  expect(d).toBeDefined();
  expect(d?.toLocaleDateString("en-CA", { timeZone: "America/New_York" })).toBe(
    isoDate
  );
}

describe("resolveMarketExpirationDate", () => {
  it("falls back to parent event when nested market omits endDate", () => {
    const market = {
      question: "Team A vs Team B — Winner?",
      description: "",
      active: true,
      closed: false,
      archived: false,
    } as Market;

    const event = {
      id: "1",
      slug: "cs-match",
      title: "CS: Example Match",
      description: "",
      active: true,
      closed: false,
      archived: false,
      endDate: "2026-04-16T00:00:00Z",
    } as Event;

    const d = resolveMarketExpirationDate(market, event);
    nyCalendar("2026-04-16", d);
  });

  it("prefers Gamma endDate over ISO embedded in question (rescheduled sports listing)", () => {
    const market = {
      question:
        "T. Schoolkate vs F. Sun — match originally listed atp-su-schoolk-2026-04-26",
      description:
        "Originally scheduled for April 26, 2026 at 11:00PM ET. Rules apply.",
      active: true,
      closed: false,
      archived: false,
      endDate: "2026-05-04T00:00:00Z",
    } as Market;

    const d = resolveMarketExpirationDate(market);
    nyCalendar("2026-05-04", d);
  });

  it("prefers market dates over event when market has parseable endDate", () => {
    const market = {
      question: "Outcome before umbrella",
      description: "",
      active: true,
      closed: false,
      archived: false,
      endDate: "2026-05-01T00:00:00Z",
    } as Market;

    const event = {
      id: "1",
      slug: "ev",
      title: "Event",
      description: "",
      active: true,
      closed: false,
      archived: false,
      endDate: "2026-12-31T00:00:00Z",
    } as Event;

    const d = resolveMarketExpirationDate(market, event);
    nyCalendar("2026-05-01", d);
  });
});
