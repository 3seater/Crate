"use client";

import dynamic from "next/dynamic";

const DynamicAnalytics = dynamic(
  () => import("@vercel/analytics/react").then((mod) => mod.Analytics),
  { ssr: false }
);
const DynamicSpeedInsights = dynamic(
  () => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights),
  { ssr: false }
);

/**
 * Client wrapper for Vercel Analytics + SpeedInsights (requires ssr: false).
 * Custom events: `trackWebEvent` from `@/lib/analytics/track-client` (client)
 * and `trackWebEventOnServer` from `@/lib/analytics/track-server` (server).
 */
export function AnalyticsScripts() {
  return (
    <>
      <DynamicAnalytics />
      <DynamicSpeedInsights />
    </>
  );
}
