import * as Sentry from "@sentry/node";

import { t } from "../trpc";

/**
 * Sentry middleware for tRPC handlers.
 *
 * We keep `attachRpcInput` disabled to avoid sending potentially sensitive
 * procedure input values. Flip to true only for short-lived debugging sessions.
 */
export const sentryMiddleware = t.middleware(
  Sentry.trpcMiddleware({
    attachRpcInput: false,
  })
);
