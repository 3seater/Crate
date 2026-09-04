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
 * Vercel Analytics + SpeedInsights — only renders on Vercel deployments.
 * On Netlify/other hosts VERCEL is undefined, so these are no-ops.
 */
export function AnalyticsScripts() {
  // VERCEL env var is injected automatically on Vercel; absent everywhere else.
  if (!process.env.VERCEL) {
    return null;
  }
  return (
    <>
      <DynamicAnalytics />
      <DynamicSpeedInsights />
    </>
  );
}
