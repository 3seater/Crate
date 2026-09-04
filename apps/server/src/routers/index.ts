import { publicProcedure, router, t } from "@doji/api";
import { basketsRouter } from "../domains/baskets/router";
import { tokensRouter } from "../domains/tokens/router";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => ({ status: "ok" as const })),
  baskets: basketsRouter,
  tokens: tokensRouter,
});

export const createCaller = t.createCallerFactory(appRouter);

export type AppRouter = typeof appRouter;
