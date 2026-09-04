/**
 * Health check endpoint — Hono route (not tRPC) at `/api/health`.
 *
 * Checks connectivity to all upstream Polymarket APIs and PostgreSQL.
 * Returns 200 if all healthy, 503 if any service is degraded.
 *
 * Each service check has a 10-second timeout via AbortController.
 */

import { db, sql } from "@doji/db";
import { env } from "@doji/env/server";
import * as Sentry from "@sentry/node";
import { Hono } from "hono";

const TIMEOUT_MS = 10_000;

interface ServiceStatus {
  name: string;
  responseTimeMs: number;
  status: "healthy" | "unhealthy";
}

interface HealthResponse {
  services: ServiceStatus[];
  status: "healthy" | "degraded";
  timestamp: string;
}

/**
 * Check a single HTTP service by making a GET request with a timeout.
 */
function checkHttpService(name: string, url: string): Promise<ServiceStatus> {
  return Sentry.startSpan(
    {
      op: "health.check.http",
      name: `health_check_${name}`,
      attributes: {
        "health.service_name": name,
        "health.service_type": "http",
      },
    },
    async (span) => {
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        const response = await fetch(url, { signal: controller.signal });
        const responseTimeMs = Date.now() - start;
        const status: ServiceStatus["status"] = response.ok
          ? "healthy"
          : "unhealthy";
        span.setAttributes({
          "health.response_time_ms": responseTimeMs,
          "health.status": status,
          "http.response.status_code": response.status,
        });
        Sentry.metrics.distribution("health_check_latency", responseTimeMs, {
          unit: "millisecond",
          attributes: {
            service: name,
            service_type: "http",
            status,
          },
        });
        Sentry.metrics.count("health_checks_total", 1, {
          attributes: {
            service: name,
            service_type: "http",
            status,
          },
        });
        return {
          name,
          status,
          responseTimeMs,
        } satisfies ServiceStatus;
      } catch {
        const responseTimeMs = Date.now() - start;
        span.setAttributes({
          "health.response_time_ms": responseTimeMs,
          "health.status": "unhealthy",
        });
        Sentry.metrics.distribution("health_check_latency", responseTimeMs, {
          unit: "millisecond",
          attributes: {
            service: name,
            service_type: "http",
            status: "unhealthy",
          },
        });
        Sentry.metrics.count("health_checks_total", 1, {
          attributes: {
            service: name,
            service_type: "http",
            status: "unhealthy",
          },
        });
        return {
          name,
          status: "unhealthy",
          responseTimeMs,
        } satisfies ServiceStatus;
      } finally {
        clearTimeout(timeoutId);
      }
    }
  );
}

/**
 * Check PostgreSQL connectivity by running `SELECT 1`.
 */
function checkPostgres(): Promise<ServiceStatus> {
  return Sentry.startSpan(
    {
      op: "health.check.db",
      name: "health_check_postgresql",
      attributes: {
        "health.service_name": "postgresql",
        "health.service_type": "database",
        "db.system": "postgresql",
      },
    },
    async (span) => {
      const start = Date.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      try {
        // Race the DB query against the abort signal timeout
        const result = await Promise.race([
          db.execute(sql`SELECT 1`),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener("abort", () => {
              reject(new Error("PostgreSQL health check timed out"));
            });
          }),
        ]);

        const responseTimeMs = Date.now() - start;
        const status: ServiceStatus["status"] = result
          ? "healthy"
          : "unhealthy";
        span.setAttributes({
          "health.response_time_ms": responseTimeMs,
          "health.status": status,
        });
        Sentry.metrics.distribution("health_check_latency", responseTimeMs, {
          unit: "millisecond",
          attributes: {
            service: "postgresql",
            service_type: "database",
            status,
          },
        });
        Sentry.metrics.count("health_checks_total", 1, {
          attributes: {
            service: "postgresql",
            service_type: "database",
            status,
          },
        });
        return {
          name: "postgresql",
          status,
          responseTimeMs,
        } satisfies ServiceStatus;
      } catch {
        const responseTimeMs = Date.now() - start;
        span.setAttributes({
          "health.response_time_ms": responseTimeMs,
          "health.status": "unhealthy",
        });
        Sentry.metrics.distribution("health_check_latency", responseTimeMs, {
          unit: "millisecond",
          attributes: {
            service: "postgresql",
            service_type: "database",
            status: "unhealthy",
          },
        });
        Sentry.metrics.count("health_checks_total", 1, {
          attributes: {
            service: "postgresql",
            service_type: "database",
            status: "unhealthy",
          },
        });
        return {
          name: "postgresql",
          status: "unhealthy",
          responseTimeMs,
        } satisfies ServiceStatus;
      } finally {
        clearTimeout(timeoutId);
      }
    }
  );
}

/**
 * Hono app for the health endpoint.
 * Mount with: `app.route("/api", healthApp)`
 */
export const healthApp = new Hono();

healthApp.get("/health", (c) =>
  Sentry.startSpan(
    {
      op: "health.request",
      name: "health_endpoint_check",
      attributes: {
        "api.route": "/api/health",
        "api.method": "GET",
      },
    },
    async (span) => {
      const services = await Promise.all([
        checkHttpService("gamma", `${env.GAMMA_API_URL}/status`),
        checkHttpService("data", `${env.DATA_API_URL}/`),
        checkHttpService("clob", `${env.CLOB_API_URL}/`),
        checkHttpService("bridge", `${env.BRIDGE_API_URL}/supported-assets`),
        checkPostgres(),
      ]);

      const healthyCount = services.filter(
        (s) => s.status === "healthy"
      ).length;
      const allHealthy = healthyCount === services.length;
      span.setAttributes({
        "health.service_count": services.length,
        "health.healthy_count": healthyCount,
        "health.unhealthy_count": services.length - healthyCount,
        "health.overall_status": allHealthy ? "healthy" : "degraded",
      });
      Sentry.metrics.count("health_requests_total", 1, {
        attributes: {
          overall_status: allHealthy ? "healthy" : "degraded",
        },
      });
      Sentry.metrics.gauge(
        "health_unhealthy_service_count",
        services.length - healthyCount
      );

      const body: HealthResponse = {
        status: allHealthy ? "healthy" : "degraded",
        services,
        timestamp: new Date().toISOString(),
      };

      return c.json(body, allHealthy ? 200 : 503);
    }
  )
);
