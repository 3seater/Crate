/**
 * Next.js (Node + Edge) trace sampling aligned with `apps/server/src/instrument.ts`
 * intent: down-sample noisy routes; boost auth and sensitive API handlers.
 */

/** Fallback rate for `webTracesSampler` (env `SENTRY_TRACES_SAMPLE_RATE`, else 0.1 in prod). */
export function getWebTracesFallbackRate(): number {
  if (process.env.NODE_ENV === "development") {
    return 1;
  }
  const raw = process.env.SENTRY_TRACES_SAMPLE_RATE;
  if (raw === undefined || raw === "") {
    return 0.1;
  }
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 0 && n <= 1) {
    return n;
  }
  return 0.1;
}

function toLowerString(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

/** Normalize dynamic segments in transaction names to limit cardinality (parity with server). */
export function sanitizeNextTransactionName(name: string): string {
  if (!name) {
    return name;
  }

  let normalized = name.split("?")[0]?.split("#")[0] ?? name;
  normalized = normalized.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    ":uuid"
  );
  normalized = normalized.replace(/\b\d{6,}\b/g, ":id");
  normalized = normalized.replace(/\/(0x)?[0-9a-f]{16,}/gi, "/:hex");
  return normalized;
}

interface WebTracesSamplingContext {
  attributes?: Record<string, unknown>;
  inheritOrSampleWith?: (rate: number) => number;
  name?: string;
  transactionContext?: { name?: string };
}

function applySamplerRate(ctx: WebTracesSamplingContext, rate: number): number {
  if (typeof ctx.inheritOrSampleWith === "function") {
    return ctx.inheritOrSampleWith(rate);
  }
  return rate;
}

/**
 * Production: sample low for tunnel/static/health; higher for auth and sensitive APIs.
 * Non-production: always 100%.
 */
export function webTracesSampler(
  samplingContext: WebTracesSamplingContext,
  fallbackRate: number
): number {
  if (process.env.NODE_ENV !== "production") {
    return 1;
  }

  const name = toLowerString(samplingContext.name);
  const route = toLowerString(
    samplingContext.attributes?.["api.route"] ??
      samplingContext.attributes?.["http.route"] ??
      samplingContext.attributes?.["next.route"]
  );
  const txName = toLowerString(samplingContext.transactionContext?.name);
  const combined = `${name} ${route} ${txName}`;

  if (
    combined.includes("/monitoring") ||
    combined.includes("/_next/static") ||
    combined.includes("webpack-hmr")
  ) {
    return applySamplerRate(samplingContext, 0.01);
  }

  if (
    combined.includes("/api/status") ||
    combined.includes("/health") ||
    combined.includes("health_check")
  ) {
    return applySamplerRate(samplingContext, 0.02);
  }

  if (combined.includes("/api/polymarket/sign")) {
    return applySamplerRate(samplingContext, Math.max(fallbackRate, 0.5));
  }

  if (
    combined.includes("/api/session") ||
    combined.includes("server_action") ||
    combined.includes("/login") ||
    combined.includes("auth")
  ) {
    return applySamplerRate(samplingContext, Math.max(fallbackRate, 0.35));
  }

  return applySamplerRate(samplingContext, fallbackRate);
}
