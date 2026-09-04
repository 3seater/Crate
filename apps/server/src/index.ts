import "./instrument";
import { env } from "@doji/env/server";
import { logger } from "@doji/logger";
import { serve } from "@hono/node-server";
import * as Sentry from "@sentry/node";
// biome-ignore lint/style/noExportedImports: app needed for both Node serve() and Vercel default export
import { app } from "./app";
import { destroyAllLimiters } from "./shared/resilience/rate-limiter";

function toError(value: unknown, fallbackMessage: string): Error {
  if (value instanceof Error) {
    return value;
  }
  let message = fallbackMessage;
  if (typeof value === "string") {
    message = value;
  } else if (value && typeof value === "object") {
    message = JSON.stringify(value);
  }
  return new Error(message);
}

if (!env.SENTRY_DSN) {
  logger.warn("SENTRY_DSN is not configured; Sentry SDK will not send events");
} else if (Sentry.isEnabled()) {
  logger.info(
    {
      sentry_environment: env.SENTRY_ENVIRONMENT ?? env.NODE_ENV,
      sentry_release: env.SENTRY_RELEASE,
      traces_sample_rate: env.SENTRY_TRACES_SAMPLE_RATE,
      error_sample_rate: env.SENTRY_ERROR_SAMPLE_RATE,
      profiles_sample_rate: env.SENTRY_PROFILES_SAMPLE_RATE,
    },
    "Sentry SDK initialized"
  );
}

process.on("unhandledRejection", (reason) => {
  const error = toError(reason, "Unhandled promise rejection");
  Sentry.metrics.count("runtime_unhandled_rejections", 1);
  Sentry.captureException(error, {
    tags: { section: "runtime", action: "unhandled_rejection" },
  });
  logger.error(
    { reason, message: error.message },
    "Unhandled promise rejection"
  );
});

process.on("uncaughtException", (err) => {
  Sentry.metrics.count("runtime_uncaught_exceptions", 1);
  Sentry.captureException(err);
  logger.fatal({ err }, "Uncaught exception — shutting down");
  Sentry.flush(2000).finally(() => {
    process.exit(1);
  });
});

// Local dev: run Node HTTP server. Vercel uses default export only.
if (!process.env.VERCEL) {
  const port = Number(env.PORT) || 3001;

  const server = serve(
    {
      fetch: app.fetch,
      port,
    },
    (info) => {
      Sentry.addBreadcrumb({
        category: "lifecycle",
        level: "info",
        message: "server_started",
        data: { port: info.port, sentry_enabled: Sentry.isEnabled() },
      });
      logger.info({ port: info.port }, "Server started");
    }
  );

  let shuttingDown = false;

  function shutdown() {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;

    Sentry.addBreadcrumb({
      category: "lifecycle",
      level: "info",
      message: "server_shutdown_started",
    });
    logger.info("SIGTERM received, starting graceful shutdown");

    server.close(async () => {
      destroyAllLimiters();
      await Sentry.close(2000);
      logger.info("Server shut down gracefully");
      process.exit(0);
    });

    setTimeout(() => {
      logger.warn("Forced shutdown after 10s timeout");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// Vercel serverless: requires default export from src/index.ts
// TODO: Confirm if this is true? ^
export default app;
