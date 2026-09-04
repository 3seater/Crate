/**
 * Hono app instance — shared between Node server (local dev) and Vercel serverless.
 */

import { randomUUID } from "node:crypto";
import { createContext } from "@doji/api/context";
import { env } from "@doji/env/server";
import { type Logger, logger } from "@doji/logger";
import { trpcServer } from "@hono/trpc-server";
import { Scalar } from "@scalar/hono-api-reference";
import * as Sentry from "@sentry/node";
import { TRPCError } from "@trpc/server";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

interface AppVariables {
  logger: Logger;
  requestId: string;
}

import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { showRoutes } from "hono/dev";
import { prettyJSON } from "hono/pretty-json";
import { secureHeaders } from "hono/secure-headers";
import { openapiApp } from "./health/openapi";
import { healthApp } from "./health/router";
import { appRouter } from "./routers/index";
import { ApiError } from "./shared/errors/errors";
import { POLYMARKET_MAPPED } from "./shared/errors/map-api-error";
import { validateConfig } from "./shared/validate-config";

const app = new Hono<{ Variables: AppVariables }>();
let activeRequests = 0;
const CSP_REPORT_GROUP = "csp-endpoint";

function getSentryCspReportUri(): string | null {
  if (!env.SENTRY_CSP_REPORT_URI) {
    return null;
  }

  const reportUrl = new URL(env.SENTRY_CSP_REPORT_URI);
  if (
    env.SENTRY_ENVIRONMENT &&
    !reportUrl.searchParams.has("sentry_environment")
  ) {
    reportUrl.searchParams.set("sentry_environment", env.SENTRY_ENVIRONMENT);
  }
  if (env.SENTRY_RELEASE && !reportUrl.searchParams.has("sentry_release")) {
    reportUrl.searchParams.set("sentry_release", env.SENTRY_RELEASE);
  }

  return reportUrl.toString();
}

function normalizeRouteTag(path: string): string {
  let normalized = path.split("?")[0]?.split("#")[0] ?? path;
  normalized = normalized.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi,
    ":uuid"
  );
  normalized = normalized.replace(/\b\d{6,}\b/g, ":id");
  normalized = normalized.replace(/\/(0x)?[0-9a-f]{16,}/gi, "/:hex");
  return normalized.slice(0, 200);
}

function getRequestOutcome(
  status: number
): "server_error" | "client_error" | "ok" {
  if (status >= 500) {
    return "server_error";
  }
  if (status >= 400) {
    return "client_error";
  }
  return "ok";
}

// Request-scoped logger (requestId, method, path) — must run first
app.use(async (c, next) => {
  const requestId =
    (c.req.header("x-request-id") as string | undefined) ?? randomUUID();
  const method = c.req.method;
  const path = c.req.path;
  const routeTag = normalizeRouteTag(path);
  const reqLogger = logger.child({ requestId, method, path }) as Logger;
  c.set("logger", reqLogger);
  c.set("requestId", requestId);
  Sentry.getIsolationScope().setAttributes({
    request_id: requestId,
    request_method: method,
    request_path: path,
  });
  Sentry.getIsolationScope().setTags({
    section: "hono_app",
    request_method: method,
    request_route: routeTag,
  });
  Sentry.metrics.count("api_requests_started", 1, {
    attributes: {
      method,
      route: routeTag,
    },
  });
  activeRequests += 1;
  Sentry.metrics.gauge("api_active_requests", activeRequests);
  await next();
});

// Response logging + x-request-id header (try/finally ensures logging on errors)
app.use(async (c, next) => {
  const start = Date.now();
  try {
    await next();
  } finally {
    const duration = Date.now() - start;
    const span = Sentry.getActiveSpan();
    const reqLogger = c.get("logger");
    const status = c.res.status;
    const method = c.req.method;
    const path = c.req.path;
    const routeTag = normalizeRouteTag(path);
    span?.setAttributes({
      "http.response.status_code": status,
      "request.duration_ms": duration,
      "request.outcome": getRequestOutcome(status),
    });
    if (span) {
      Sentry.setHttpStatus(span, status);
    }
    const msg =
      status >= 400
        ? `Request failed ${method} ${path} ${status} ${duration}ms`
        : `${method} ${path} ${status} ${duration}ms`;
    reqLogger.info({ status, duration }, msg);
    const outcome = getRequestOutcome(status);
    Sentry.metrics.distribution("api_request_latency", duration, {
      unit: "millisecond",
      attributes: {
        method,
        route: routeTag,
        outcome,
        status_class: `${Math.floor(status / 100)}xx`,
      },
    });
    Sentry.metrics.count("api_requests_completed", 1, {
      attributes: {
        method,
        route: routeTag,
        outcome,
        status_class: `${Math.floor(status / 100)}xx`,
      },
    });
    activeRequests = Math.max(0, activeRequests - 1);
    Sentry.metrics.gauge("api_active_requests", activeRequests);
    if (status >= 500) {
      Sentry.logger.error("api_request_completed", {
        request_id: c.get("requestId"),
        method,
        route: path,
        status_code: status,
        duration_ms: duration,
        outcome: "server_error",
      });
    } else if (status >= 400) {
      Sentry.logger.warn("api_request_completed", {
        request_id: c.get("requestId"),
        method,
        route: path,
        status_code: status,
        duration_ms: duration,
        outcome: "client_error",
      });
    }
    c.header("x-request-id", c.get("requestId"));
  }
});

app.use("*", prettyJSON());

// TODO: Resolve if this is needed in vercel
app.use("*", compress());

// TODO: check CORS requirements
app.use(
  "*",
  secureHeaders({
    crossOriginResourcePolicy: false,
    xFrameOptions: false,
  })
);

app.use("*", async (c, next) => {
  await next();
  const reportUri = getSentryCspReportUri();
  if (!reportUri) {
    return;
  }

  const reportToPayload = JSON.stringify({
    group: CSP_REPORT_GROUP,
    max_age: 10_886_400,
    include_subdomains: true,
    endpoints: [{ url: reportUri }],
  });

  const reportOrigin = new URL(reportUri).origin;
  const cspReportOnly = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `connect-src 'self' ${reportOrigin}`,
    `report-uri ${reportUri}`,
    `report-to ${CSP_REPORT_GROUP}`,
  ].join("; ");

  c.header("Content-Security-Policy-Report-Only", cspReportOnly);
  c.header("Report-To", reportToPayload);
  c.header("Reporting-Endpoints", `${CSP_REPORT_GROUP}="${reportUri}"`);
});

// TODO: Define what credentials is for?
app.use(
  "/*",
  cors({
    origin: env.CORS_ORIGIN,
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "sentry-trace",
      "baggage",
      "traceparent",
    ],
    credentials: true,
  })
);

app.use("/trpc/*", async (c, next) => {
  await next();
  if (c.req.method === "GET" && c.res.status < 400) {
    const path = c.req.path;

    const isPublicDiscovery =
      path.includes("markets.list") ||
      path.includes("markets.calendarList") ||
      path.includes("markets.bySlug") ||
      path.includes("events.list") ||
      path.includes("events.bySlug") ||
      path.includes("events.tags") ||
      path.includes("events.search") ||
      path.includes("leaderboard.rankings") ||
      path.includes("leaderboard.holders") ||
      path.includes("activity.tradeCounts");
    const isPublicHistory = path.includes("markets.priceHistory");
    const isPublicOrderbook = path.includes("markets.orderbooks");
    const isUserSpecific =
      path.includes("portfolio.positions") ||
      path.includes("portfolio.ctfTokenBalances") ||
      path.includes("activity.trades") ||
      path.includes("portfolio.value") ||
      path.includes("portfolio.closedPositions") ||
      path.includes("portfolio.usdcBalance") ||
      path.includes("activity.") ||
      path.includes("orders.balanceAllowance") ||
      path.includes("auth.");

    if (isUserSpecific) {
      c.header("Cache-Control", "private, no-store");
    } else if (isPublicDiscovery) {
      // Gamma server cache is 60s — CDN refreshing at 10s was hitting a stale
      // upstream anyway. 30s CDN cache with 60s SWR lets the server breathe
      // while keeping discovery data fresh enough for a trading context.
      c.header(
        "Cache-Control",
        "public, s-maxage=30, stale-while-revalidate=60"
      );
    } else if (isPublicHistory) {
      // Historical price candles are immutable once closed. Only the trailing
      // edge of the most recent candle changes. 2-minute CDN cache with 5-minute
      // SWR is safe and dramatically reduces upstream pressure.
      c.header(
        "Cache-Control",
        "public, s-maxage=120, stale-while-revalidate=300"
      );
    } else if (isPublicOrderbook) {
      // Orderbook is public but changes frequently. Short CDN cache reduces
      // upstream pressure; client refreshes via WebSocket anyway.
      c.header(
        "Cache-Control",
        "public, s-maxage=5, stale-while-revalidate=10"
      );
    }
  }
});

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (_opts, honoContext) => {
      const log = honoContext.get("logger");
      return createContext({
        context: honoContext,
        log,
      }) as unknown as Record<string, unknown>;
    },
    onError: ({ error, path }) => {
      // Safety net: if an unwrapped ApiError escaped a procedure (forgot withPolymarketError).
      // Skip errors already mapped by mapApiErrorToTRPC — those carry POLYMARKET_MAPPED.
      const isMapped =
        (error as unknown as Record<symbol, boolean>)[POLYMARKET_MAPPED] ===
        true;
      const cause = error.cause;
      if (cause instanceof ApiError && !isMapped) {
        logger.warn(
          { path, code: cause.code },
          "Unmapped ApiError in tRPC procedure — add withPolymarketError"
        );
      }
      const logPayload = {
        code: error.code,
        path: path ?? ("path" in error ? error.path : undefined),
        message: error.message,
      };
      // Expected validation / auth outcomes (e.g. referral gate FORBIDDEN) are TRPCErrors with
      // non-internal codes. Pino `error` level is wired to Sentry issues — avoid noise for those.
      const isTrpcClientFailure =
        error instanceof TRPCError && error.code !== "INTERNAL_SERVER_ERROR";
      if (isTrpcClientFailure) {
        logger.warn(logPayload, "tRPC client error");
      } else {
        logger.error(logPayload, "tRPC error");
      }
    },
  })
);

app.onError((err, c) => {
  const reqLogger = c.get("logger");
  const httpStatus = err instanceof HTTPException ? err.status : 500;
  const rawPath = c.req.path;
  const routeTag = normalizeRouteTag(rawPath);
  const span = Sentry.getActiveSpan();
  if (span) {
    Sentry.setHttpStatus(span, httpStatus);
  }
  if (httpStatus >= 500) {
    Sentry.metrics.count("api_unhandled_errors", 1, {
      attributes: {
        method: c.req.method,
        route: routeTag,
        status_class: "5xx",
      },
    });
    Sentry.captureException(err, {
      tags: {
        section: "hono_app",
        route: routeTag,
      },
      contexts: {
        request: {
          method: c.req.method,
          path: rawPath,
          request_id: c.get("requestId"),
        },
      },
    });
  }
  if (httpStatus >= 400 && httpStatus < 500) {
    Sentry.metrics.count("api_unhandled_errors", 1, {
      attributes: {
        method: c.req.method,
        route: routeTag,
        status_class: "4xx",
      },
    });
  }
  reqLogger.error(
    { message: err.message, name: err.name },
    "Unhandled error in Hono"
  );
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  return c.json({ error: "Internal Server Error" }, 500);
});

app.route("/api", healthApp);
app.route("/api", openapiApp);

app.get("/", (c) => c.text("OK"));

if (process.env.NODE_ENV !== "production") {
  app.get("/debug-sentry", async () => {
    await Sentry.startSpan(
      {
        op: "test",
        name: "debug_sentry_route",
        attributes: {
          route: "/debug-sentry",
          source: "manual_test",
        },
      },
      () => {
        Sentry.logger.info("debug_sentry_route_triggered", {
          route: "/debug-sentry",
          test_kind: "manual_verification",
        });
        Sentry.metrics.count("debug_sentry_hits", 1, {
          attributes: { route: "/debug-sentry" },
        });
        throw new Error("My first Sentry error!");
      }
    );
    return new Response("ok");
  });
}

if (process.env.NODE_ENV === "development") {
  app.get(
    "/docs",
    Scalar({
      url: `${env.SERVER_URL}/api/openapi.json`,
      pageTitle: "Doji API",
    })
  );
} else {
  app.get("/docs", (c) => c.text("Not Found", 404));
}

// test
validateConfig();

if (process.env.NODE_ENV === "development") {
  showRoutes(app);
}

export { app };
