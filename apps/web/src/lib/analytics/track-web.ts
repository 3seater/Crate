import { track as vercelTrack } from "@vercel/analytics";

import type { AnalyticsEventProps } from "./types";

const enabled = process.env.NODE_ENV === "production";

/**
 * Production-only Vercel custom event. Safe to import from non-React modules
 * that run only in the browser (e.g. auth helpers used from client components).
 */
export function trackWebEvent(
  name: string,
  properties?: AnalyticsEventProps
): void {
  if (!enabled) {
    return;
  }
  vercelTrack(name, properties);
}
