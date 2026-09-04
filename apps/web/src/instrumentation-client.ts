// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import {
  browserProfilingIntegration,
  browserTracingIntegration,
  captureRouterTransitionStart,
  getGlobalScope,
  getIsolationScope,
  init,
} from "@sentry/nextjs";

import {
  beforeSendEventFingerprint,
  beforeSendLogShared,
} from "@/lib/sentry/send-hooks";

const DEFAULT_SENTRY_ATTRIBUTES = {
  app: "doji_web",
  platform: "nextjs",
  runtime: "client",
} as const;

const DYNAMIC_SEGMENT_PATTERNS: [RegExp, string][] = [
  [/\/market\/[^/?#]+/g, "/market/:slug"],
  [/\/event\/[^/?#]+/g, "/event/:slug"],
  [/\/profile\/[^/?#]+/g, "/profile/:id"],
  [
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    ":uuid",
  ],
  [/\b\d{6,}\b/g, ":id"],
];

function normalizeSpanName(name: string): string {
  let normalized = name;
  for (const [pattern, replacement] of DYNAMIC_SEGMENT_PATTERNS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  debug:
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_SENTRY_DEBUG === "1",
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  sampleRate: process.env.NODE_ENV === "development" ? 1 : 1,
  integrations: [
    browserTracingIntegration({
      // Avoid noisy spans from Sentry ingest/tunnel and health checks.
      shouldCreateSpanForRequest(url) {
        return !(
          url.includes("/monitoring") ||
          url.endsWith("/health") ||
          url.includes("/health?")
        );
      },
      beforeStartSpan(context) {
        return {
          ...context,
          name: normalizeSpanName(context.name),
          attributes: {
            ...context.attributes,
            "app.runtime": "client",
          },
        };
      },
    }),
    browserProfilingIntegration(),
  ],
  initialScope: {
    tags: {
      ...DEFAULT_SENTRY_ATTRIBUTES,
    },
  },

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  // Keep trace propagation explicit to avoid unwanted CORS preflights.
  tracePropagationTargets: [
    "localhost",
    process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001",
    /^https:\/\/([a-z0-9-]+\.)*doji\.bet/,
  ],
  // Also emit W3C traceparent for non-Sentry backends and OTEL interoperability.
  propagateTraceparent: true,
  // Browser profiling is Chromium-only and sampled per session.
  profileSessionSampleRate: process.env.NODE_ENV === "development" ? 1 : 0.1,
  profileLifecycle: "trace",
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  // Drop common browser noise that does not represent actionable app faults.
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "AbortError",
    "Non-Error exception captured",
    "Error in input stream", // Firefox decompression error on interrupted streams (dev/refresh)
  ],
  beforeBreadcrumb(breadcrumb) {
    const data = breadcrumb.data as Record<string, unknown> | undefined;
    if (data) {
      for (const key of [
        "authorization",
        "cookie",
        "password",
        "token",
        "secret",
      ]) {
        if (key in data) {
          data[key] = "[Filtered]";
        }
      }
    }
    return breadcrumb;
  },
  // Keep runtime behavior stable while improving Sentry-side diagnostics.
  enhanceFetchErrorMessages: "report-only",
  beforeSendSpan(span) {
    span.data = {
      ...span.data,
      "app.name": "doji_web",
      "app.platform": "nextjs",
      "app.runtime": "client",
    };
    return span;
  },
  beforeSendLog(log) {
    return beforeSendLogShared(log, process.env.NODE_ENV === "production");
  },
  // Refine grouping when we explicitly tag capture sites with section/action/route.
  beforeSend: beforeSendEventFingerprint,
});

getGlobalScope().setAttributes(DEFAULT_SENTRY_ATTRIBUTES);
getIsolationScope().setAttributes(DEFAULT_SENTRY_ATTRIBUTES);

export const onRouterTransitionStart = captureRouterTransitionStart;
