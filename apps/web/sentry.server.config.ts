// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  getWebTracesFallbackRate,
  sanitizeNextTransactionName,
  webTracesSampler,
} from "./src/lib/sentry/sampling";
import {
  beforeSendEventFingerprint,
  beforeSendLogShared,
} from "./src/lib/sentry/send-hooks";

const DEFAULT_SENTRY_ATTRIBUTES = {
  app: "doji_web",
  platform: "nextjs",
  runtime: "server",
} as const;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  debug:
    process.env.NODE_ENV === "development" && process.env.SENTRY_DEBUG === "1",
  environment: process.env.NODE_ENV,
  release: process.env.SENTRY_RELEASE,
  sampleRate: process.env.NODE_ENV === "development" ? 1 : 1,
  integrations: [
    Sentry.zodErrorsIntegration({
      limit: 10,
      saveZodIssuesAsAttachment: false,
    }),
  ],
  initialScope: {
    tags: {
      ...DEFAULT_SENTRY_ATTRIBUTES,
    },
  },

  tracesSampleRate:
    process.env.NODE_ENV === "development" ? 1 : getWebTracesFallbackRate(),
  tracesSampler: (ctx) => webTracesSampler(ctx, getWebTracesFallbackRate()),
  // Keep propagation explicit to avoid tracing unrelated outbound traffic.
  tracePropagationTargets: [
    "localhost",
    process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001",
    /^https:\/\/([a-z0-9-]+\.)*doji\.bet/,
    /^https:\/\/([a-z0-9-]+\.)*sentry\.io/,
  ],

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,
  ignoreErrors: ["AbortError", "Non-Error exception captured"],
  // Keep runtime behavior stable while improving Sentry-side diagnostics.
  enhanceFetchErrorMessages: "report-only",
  beforeSendSpan(span) {
    span.data = {
      ...span.data,
      "app.name": "doji_web",
      "app.platform": "nextjs",
      "app.runtime": "server",
    };
    return span;
  },
  beforeSendLog(log) {
    return beforeSendLogShared(log, process.env.NODE_ENV === "production");
  },
  // Refine grouping when we explicitly tag capture sites with section/action/route.
  beforeSend: beforeSendEventFingerprint,
});

Sentry.addEventProcessor((event) => {
  if (event.type === "transaction" && typeof event.transaction === "string") {
    event.transaction = sanitizeNextTransactionName(event.transaction);
  }
  return event;
});

Sentry.getGlobalScope().setAttributes(DEFAULT_SENTRY_ATTRIBUTES);
Sentry.getIsolationScope().setAttributes(DEFAULT_SENTRY_ATTRIBUTES);
