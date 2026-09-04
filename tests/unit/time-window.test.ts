import { describe, expect, it } from "vitest";

import {
  computeRemainingSeconds,
  computeTimeWindow,
  formatTimeSlotLabelET,
  formatTimeWindowET,
  generateTimeSlots,
  TIMEFRAME_DURATIONS,
} from "@/shared/utils/time-window";

// --- computeTimeWindow Tests ---

describe("computeTimeWindow", () => {
  it("aligns 5-minute windows to grid boundaries", () => {
    // 2024-04-01 23:42:30 UTC → should align to 23:40:00
    const now = Date.UTC(2024, 3, 1, 23, 42, 30);
    const result = computeTimeWindow(TIMEFRAME_DURATIONS["5m"], now);
    const expectedStart = Date.UTC(2024, 3, 1, 23, 40, 0);
    expect(result.start).toBe(expectedStart);
    expect(result.end).toBe(expectedStart + 300_000);
  });

  it("aligns 15-minute windows to grid boundaries", () => {
    const now = Date.UTC(2024, 3, 1, 14, 22, 0);
    const result = computeTimeWindow(TIMEFRAME_DURATIONS["15m"], now);
    const expectedStart = Date.UTC(2024, 3, 1, 14, 15, 0);
    expect(result.start).toBe(expectedStart);
    expect(result.end).toBe(expectedStart + 900_000);
  });

  it("aligns 1-hour windows to grid boundaries", () => {
    const now = Date.UTC(2024, 3, 1, 14, 30, 0);
    const result = computeTimeWindow(TIMEFRAME_DURATIONS["1h"], now);
    const expectedStart = Date.UTC(2024, 3, 1, 14, 0, 0);
    expect(result.start).toBe(expectedStart);
    expect(result.end).toBe(expectedStart + 3_600_000);
  });

  it("aligns 4-hour windows to grid boundaries", () => {
    const now = Date.UTC(2024, 3, 1, 5, 30, 0);
    const result = computeTimeWindow(TIMEFRAME_DURATIONS["4h"], now);
    const expectedStart = Date.UTC(2024, 3, 1, 4, 0, 0);
    expect(result.start).toBe(expectedStart);
    expect(result.end).toBe(expectedStart + 14_400_000);
  });

  it("aligns daily windows to noon ET boundaries (Polymarket crypto)", () => {
    // `computeTimeWindow` uses noon ET alignment for daily crypto (see time-window.ts).
    const now = Date.UTC(2024, 3, 1, 2, 0, 0);
    const result = computeTimeWindow(TIMEFRAME_DURATIONS.daily, now);
    expect(result.end).toBe(result.start + 86_400_000);
    expect(result.start).toBe(1_711_900_800_000);
  });

  it("satisfies round-trip: end === start + duration", () => {
    const now = Date.UTC(2024, 6, 15, 10, 33, 0);
    for (const duration of Object.values(TIMEFRAME_DURATIONS)) {
      const result = computeTimeWindow(duration, now);
      expect(result.end).toBe(result.start + duration);
    }
  });

  it("contains the given timestamp within the window", () => {
    const now = Date.UTC(2024, 3, 15, 8, 22, 45);
    for (const duration of Object.values(TIMEFRAME_DURATIONS)) {
      const result = computeTimeWindow(duration, now);
      expect(result.start).toBeLessThanOrEqual(now);
      expect(result.end).toBeGreaterThan(now);
    }
  });

  it("handles exact boundary timestamps for sub-daily", () => {
    // Exactly on a 5-minute boundary
    const now = Date.UTC(2024, 3, 1, 12, 0, 0);
    const result = computeTimeWindow(TIMEFRAME_DURATIONS["5m"], now);
    expect(result.start).toBe(now);
    expect(result.end).toBe(now + 300_000);
  });
});

// --- computeRemainingSeconds Tests ---

describe("computeRemainingSeconds", () => {
  it("returns positive seconds when window is active", () => {
    const windowEnd = 1_700_000_000_000;
    const now = windowEnd - 120_000; // 2 minutes before end
    expect(computeRemainingSeconds(windowEnd, now)).toBe(120);
  });

  it("returns 0 when now equals windowEnd", () => {
    const windowEnd = 1_700_000_000_000;
    expect(computeRemainingSeconds(windowEnd, windowEnd)).toBe(0);
  });

  it("returns 0 when now is past windowEnd", () => {
    const windowEnd = 1_700_000_000_000;
    expect(computeRemainingSeconds(windowEnd, windowEnd + 5000)).toBe(0);
  });

  it("rounds up partial seconds", () => {
    const windowEnd = 1_700_000_000_000;
    const now = windowEnd - 1500; // 1.5 seconds before end
    expect(computeRemainingSeconds(windowEnd, now)).toBe(2);
  });

  it("returns 1 for 1ms remaining", () => {
    const windowEnd = 1_700_000_000_000;
    expect(computeRemainingSeconds(windowEnd, windowEnd - 1)).toBe(1);
  });
});

// --- generateTimeSlots Tests ---

describe("generateTimeSlots", () => {
  it("returns the requested number of slots", () => {
    const now = Date.UTC(2024, 3, 1, 12, 7, 0);
    const slots = generateTimeSlots(TIMEFRAME_DURATIONS["5m"], 5, now);
    expect(slots).toHaveLength(5);
  });

  it("slots are contiguous (each end equals next start)", () => {
    const now = Date.UTC(2024, 3, 1, 12, 7, 0);
    const slots = generateTimeSlots(TIMEFRAME_DURATIONS["5m"], 7, now);
    for (let i = 0; i < slots.length - 1; i++) {
      expect(slots[i].end).toBe(slots[i + 1].start);
    }
  });

  it("each slot has end = start + duration", () => {
    const duration = TIMEFRAME_DURATIONS["15m"];
    const now = Date.UTC(2024, 3, 1, 12, 7, 0);
    const slots = generateTimeSlots(duration, 5, now);
    for (const slot of slots) {
      expect(slot.end).toBe(slot.start + duration);
    }
  });

  it("has exactly one active slot", () => {
    const now = Date.UTC(2024, 3, 1, 12, 7, 0);
    const slots = generateTimeSlots(TIMEFRAME_DURATIONS["5m"], 5, now);
    const activeSlots = slots.filter((s) => s.isActive);
    expect(activeSlots).toHaveLength(1);
  });

  it("active slot contains the current timestamp", () => {
    const now = Date.UTC(2024, 3, 1, 12, 7, 0);
    const slots = generateTimeSlots(TIMEFRAME_DURATIONS["5m"], 5, now);
    const active = slots.find((s) => s.isActive);
    expect(active).toBeDefined();
    expect(active?.start).toBeLessThanOrEqual(now);
    expect(active?.end).toBeGreaterThan(now);
  });

  it("past slots have isPast=true, future slots have isPast=false", () => {
    const now = Date.UTC(2024, 3, 1, 12, 7, 0);
    const slots = generateTimeSlots(TIMEFRAME_DURATIONS["5m"], 5, now);
    for (const slot of slots) {
      if (slot.end <= now) {
        expect(slot.isPast).toBe(true);
      }
    }
  });

  it("each slot has a non-empty label", () => {
    const now = Date.UTC(2024, 3, 1, 12, 7, 0);
    const slots = generateTimeSlots(TIMEFRAME_DURATIONS["5m"], 5, now);
    for (const slot of slots) {
      expect(slot.label.length).toBeGreaterThan(0);
    }
  });
});

// --- formatTimeSlotLabelET Tests ---

describe("formatTimeSlotLabelET", () => {
  it("formats a timestamp as ET time with AM/PM", () => {
    // 2024-04-01 03:45 UTC = 11:45 PM ET (EDT, UTC-4)
    const ts = Date.UTC(2024, 3, 1, 3, 45, 0);
    const label = formatTimeSlotLabelET(ts);
    expect(label).toContain("11:45");
    expect(label).toContain("PM");
  });

  it("formats morning times with AM", () => {
    // 2024-04-01 14:30 UTC = 10:30 AM ET (EDT)
    const ts = Date.UTC(2024, 3, 1, 14, 30, 0);
    const label = formatTimeSlotLabelET(ts);
    expect(label).toContain("10:30");
    expect(label).toContain("AM");
  });

  it("returns a non-empty string", () => {
    const label = formatTimeSlotLabelET(Date.UTC(2024, 0, 1, 0, 0, 0));
    expect(label.length).toBeGreaterThan(0);
  });
});

// --- formatTimeWindowET Tests ---

describe("formatTimeWindowET", () => {
  it("formats a 5-minute window in ET", () => {
    // 2024-04-01 03:40 UTC = 11:40 PM ET (EDT)
    // 2024-04-01 03:45 UTC = 11:45 PM ET (EDT)
    const start = Date.UTC(2024, 3, 1, 3, 40, 0);
    const end = Date.UTC(2024, 3, 1, 3, 45, 0);
    const result = formatTimeWindowET(start, end);
    expect(result).toContain("March");
    expect(result).toContain("31");
    expect(result).toContain("ET");
    expect(result).toContain("11:40");
    expect(result).toContain("11:45");
    expect(result).toContain("PM");
  });

  it("includes AM/PM on start when periods differ", () => {
    // Window crossing noon: 11:55 AM to 12:00 PM ET
    // 11:55 AM ET (EDT) = 15:55 UTC
    // 12:00 PM ET (EDT) = 16:00 UTC
    const start = Date.UTC(2024, 3, 1, 15, 55, 0);
    const end = Date.UTC(2024, 3, 1, 16, 0, 0);
    const result = formatTimeWindowET(start, end);
    expect(result).toContain("AM");
    expect(result).toContain("PM");
  });

  it("contains month name, day number, and ET suffix", () => {
    const start = Date.UTC(2024, 6, 15, 18, 0, 0);
    const end = Date.UTC(2024, 6, 15, 19, 0, 0);
    const result = formatTimeWindowET(start, end);
    expect(result).toContain("July");
    expect(result).toContain("15");
    expect(result).toContain("ET");
  });
});
