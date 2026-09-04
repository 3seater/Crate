import "server-only";

import { track as vercelTrack } from "@vercel/analytics/server";

import type { AnalyticsEventProps } from "./types";

const enabled = process.env.NODE_ENV === "production";

/**
 * Server-side custom event (Server Actions, Route Handlers, etc.).
 * No-ops when `NODE_ENV !== "production"`.
 *
 * If the deployment uses Vercel Deployment Protection, ensure
 * `VERCEL_AUTOMATION_BYPASS_SECRET` is set so `track` can reach `/_vercel/insights/event`.
 *
 * @see https://vercel.com/docs/analytics/custom-events#deployment-protection-and-server-side-events
 */
export async function trackWebEventOnServer(
  name: string,
  properties?: AnalyticsEventProps
): Promise<void> {
  if (!enabled) {
    return;
  }
  await vercelTrack(name, properties);
}
