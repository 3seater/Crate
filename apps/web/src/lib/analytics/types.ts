/**
 * Vercel Web Analytics custom event payload.
 * Flat key/value only — nested objects are rejected by the collector.
 * Event names, keys, and string values must be ≤255 characters (plan limits apply).
 *
 * @see https://vercel.com/docs/analytics/custom-events
 */
export type AnalyticsEventProps = Record<
  string,
  string | number | boolean | null | undefined
>;
