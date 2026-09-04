"use client";

import { useEffect, useState } from "react";

const TICK_MS = 30_000;

/**
 * Re-renders the caller periodically while the row's event is younger than `maxAgeSec`,
 * so relative labels (e.g. "12m ago", "3h") stay accurate and can cross into date+time.
 */
export function useTableTimeTick(
  timestamp: number | null | undefined,
  maxAgeSec: number
): void {
  const [, setTick] = useState(0);
  const ts = timestamp ?? 0;
  const age =
    ts > 0 ? Math.floor(Date.now() / 1000) - ts : Number.POSITIVE_INFINITY;
  const needsLive = ts > 0 && age >= 0 && age < maxAgeSec;

  useEffect(() => {
    if (!needsLive) {
      return;
    }
    const id = setInterval(() => setTick((n) => n + 1), TICK_MS);
    return () => clearInterval(id);
  }, [needsLive]);
}
