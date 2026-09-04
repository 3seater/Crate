import { loggerMiddleware } from "./middleware/logger";
import { sentryMiddleware } from "./middleware/sentry";
import { t } from "./trpc";

export { createContextInner } from "./context";
export { AppError } from "./lib/errors";
export { t } from "./trpc";

export const router = t.router;

export { loggerMiddleware } from "./middleware/logger";
export { sentryMiddleware } from "./middleware/sentry";

export const publicProcedure = t.procedure
  .use(sentryMiddleware)
  .use(loggerMiddleware);
