/**
 * Shared Sentry `beforeSend` / `beforeSendLog` logic for Next.js client, server,
 * and edge entrypoints — keeps scrubbing and fingerprint rules in one place.
 */

import type { EventHint, ErrorEvent as SentryErrorEvent } from "@sentry/core";

/** Keys scrubbed from structured logs sent to Sentry. */
export const SENTRY_SENSITIVE_LOG_KEYS = [
  "password",
  "password_hash",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "cookie",
  "secret",
  "apiKey",
  "api_key",
  "credential",
  "credentials",
] as const;

export function scrubSentryLogAttributes(
  attributes: Record<string, unknown> | undefined
): void {
  if (!attributes) {
    return;
  }
  for (const key of SENTRY_SENSITIVE_LOG_KEYS) {
    if (key in attributes) {
      attributes[key] = "[Filtered]";
    }
  }
}

/** Drop debug logs in production; scrub sensitive keys from attributes. */
export function beforeSendLogShared<
  L extends {
    level?: string;
    attributes?: Record<string, unknown>;
    message?: unknown;
  },
>(log: L, isProduction: boolean): L | null {
  if (isProduction && log.level === "debug") {
    return null;
  }
  if (log.attributes) {
    scrubSentryLogAttributes(log.attributes);
  }
  return log;
}

/** Group tagged errors by section + action/route when those tags are set. */
export function beforeSendEventFingerprint(
  event: SentryErrorEvent,
  _hint?: EventHint
): SentryErrorEvent | null {
  const section = event.tags?.section;
  const action = event.tags?.action;
  const route = event.tags?.route;

  if (section && (action || route)) {
    event.fingerprint = [
      "{{ default }}",
      String(section),
      String(action ?? route),
    ];
  }

  return event;
}
