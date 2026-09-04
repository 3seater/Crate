import { createRequire } from "node:module";
import { env } from "@doji/env/server";
import * as Sentry from "@sentry/node";

const require = createRequire(import.meta.url);
type SentryIntegration = ReturnType<
  typeof Sentry.nodeRuntimeMetricsIntegration
>;

const DEFAULT_SENTRY_ATTRIBUTES = {
  app: "doji_server",
  platform: "hono",
  runtime: "node",
} as const;

function toLowerString(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function sanitizeTransactionName(name: string): string {
  if (!name) {
    return name;
  }

  let normalized = name;
  // Drop query strings/fragments from transaction names.
  normalized = normalized.split("?")[0]?.split("#")[0] ?? normalized;
  // Normalize dynamic path segments to avoid cardinality explosions.
  normalized = normalized.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    ":uuid"
  );
  normalized = normalized.replace(/\b\d{6,}\b/g, ":id");
  normalized = normalized.replace(/\/(0x)?[0-9a-f]{16,}/gi, "/:hex");
  return normalized;
}

function getProfilingIntegration(): SentryIntegration[] {
  try {
    const { nodeProfilingIntegration } = require("@sentry/profiling-node") as {
      nodeProfilingIntegration: () => SentryIntegration;
    };
    return [nodeProfilingIntegration()];
  } catch {
    // Native profiler binary may be unavailable for some Node runtimes (for example, bleeding-edge local versions).
    // Continue without profiling so error monitoring and tracing still work.
    return [];
  }
}

Sentry.init({
  dsn: env.SENTRY_DSN,
  ...(env.SENTRY_ORG_ID ? { orgId: env.SENTRY_ORG_ID } : {}),
  enabled: Boolean(env.SENTRY_DSN),
  debug: env.SENTRY_DEBUG,
  release: env.SENTRY_RELEASE,
  environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
  strictTraceContinuation:
    Boolean(env.SENTRY_ORG_ID) && env.SENTRY_STRICT_TRACE_CONTINUATION,
  integrations: [
    ...getProfilingIntegration(),
    Sentry.nodeRuntimeMetricsIntegration({
      collectionIntervalMs: 30_000,
    }),
    Sentry.extraErrorDataIntegration({
      depth: 2,
      captureErrorCause: true,
    }),
    Sentry.zodErrorsIntegration({
      limit: 10,
      saveZodIssuesAsAttachment: false,
    }),
    Sentry.pinoIntegration({
      log: { levels: ["info", "warn", "error", "fatal"] },
      error: { levels: ["error", "fatal"], handled: true },
    }),
  ],
  initialScope: {
    tags: {
      ...DEFAULT_SENTRY_ATTRIBUTES,
    },
  },
  sampleRate: env.SENTRY_ERROR_SAMPLE_RATE,
  enableLogs: true,
  tracesSampler(samplingContext) {
    if (env.NODE_ENV !== "production") {
      return 1;
    }

    const name = toLowerString(samplingContext.name);
    const route = toLowerString(
      samplingContext.attributes?.["api.route"] ??
        samplingContext.attributes?.["http.route"]
    );
    const combined = `${name} ${route}`;
    const fallbackRate = env.SENTRY_TRACES_SAMPLE_RATE;

    // Keep noisy operational endpoints very low-volume in production.
    if (
      combined.includes("/api/health") ||
      combined.includes("/health") ||
      combined.includes("health_endpoint_check")
    ) {
      return samplingContext.inheritOrSampleWith(0.01);
    }

    if (combined.includes("/api/openapi.json") || combined.includes("/docs")) {
      return samplingContext.inheritOrSampleWith(0.02);
    }

    // Keep security-sensitive and core auth flows highly visible.
    if (
      combined.includes("/api/polymarket/sign") ||
      combined.includes("builder_sign_proxy")
    ) {
      return samplingContext.inheritOrSampleWith(Math.max(fallbackRate, 0.5));
    }

    if (combined.includes("auth") || combined.includes("/trpc/auth")) {
      return samplingContext.inheritOrSampleWith(Math.max(fallbackRate, 0.4));
    }

    return samplingContext.inheritOrSampleWith(fallbackRate);
  },
  tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
  profileSessionSampleRate: env.SENTRY_PROFILES_SAMPLE_RATE,
  profileLifecycle: "trace",
  sendDefaultPii: true,
  enhanceFetchErrorMessages: "report-only",
  ignoreErrors: ["AbortError", "Non-Error exception captured"],
  beforeSendLog(log) {
    if (env.NODE_ENV === "production" && log.level === "debug") {
      return null;
    }

    if (log.attributes) {
      for (const key of [
        "password",
        "password_hash",
        "token",
        "access_token",
        "refresh_token",
        "authorization",
        "cookie",
        "secret",
        "api_key",
        "apiKey",
        "credential",
        "credentials",
      ]) {
        if (key in log.attributes) {
          log.attributes[key] = "[Filtered]";
        }
      }
    }

    return log;
  },
  beforeSend(event) {
    // Drop expected tRPC client errors (4xx-equivalent) — these are normal app flow,
    // not bugs. The trpcMiddleware captures all errors unconditionally.
    const exceptionValue = event.exception?.values?.[0]?.value ?? "";
    const trpcContext = event.contexts?.trpc as
      | Record<string, unknown>
      | undefined;
    if (trpcContext?.procedure_path) {
      const EXPECTED_MESSAGES = [
        "Complete onboarding",
        "Missing or malformed Authorization",
        "invite code",
        "usage limit",
      ];
      if (EXPECTED_MESSAGES.some((m) => exceptionValue.includes(m))) {
        return null;
      }
    }

    const section = event.tags?.section;
    const action = event.tags?.action;
    const route = event.tags?.route;
    const exceptionType = event.exception?.values?.[0]?.type;

    // Default strategy: preserve Sentry grouping and add stable app-level context.
    if (section && (action || route)) {
      event.fingerprint = [
        "{{ default }}",
        String(section),
        String(action ?? route),
        String(exceptionType ?? "unknown_exception"),
      ];
      return event;
    }

    // Fallback: for untagged server errors, keep grouping stable by route+exception.
    if (route && exceptionType) {
      event.fingerprint = [
        "{{ default }}",
        String(route),
        String(exceptionType),
      ];
    }

    return event;
  },
  beforeSendSpan(span) {
    span.data = {
      ...span.data,
      "app.name": "doji_server",
      "app.platform": "hono",
      "app.runtime": "node",
    };
    return span;
  },
  beforeSendMetric(metric) {
    if (env.NODE_ENV === "production" && metric.name.startsWith("debug_")) {
      return null;
    }

    metric.attributes = {
      ...metric.attributes,
      app: "doji_server",
      platform: "hono",
      runtime: "node",
    };
    return metric;
  },
});

Sentry.getGlobalScope().setAttributes(DEFAULT_SENTRY_ATTRIBUTES);
Sentry.getIsolationScope().setAttributes(DEFAULT_SENTRY_ATTRIBUTES);

Sentry.addEventProcessor((event) => {
  if (event.type === "transaction" && typeof event.transaction === "string") {
    event.transaction = sanitizeTransactionName(event.transaction);
  }
  return event;
});
