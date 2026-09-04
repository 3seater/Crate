/**
 * Next.js App Router tRPC handler.
 *
 * Runs the basket router server-side so the web app is fully self-contained
 * on Netlify — no separate API server deployment needed.
 *
 * ENSO_API_KEY must be set in Netlify env vars for getBundle (buy txns).
 * getLivePrices and getEthPrice work without any env vars.
 */
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { basketsRouter } from "apps/server/src/domains/baskets/router";
import { router, publicProcedure } from "@doji/api";

/** Minimal router — just the basket domain. */
const webAppRouter = router({
  healthCheck: publicProcedure.query(() => ({ status: "ok" as const })),
  baskets: basketsRouter,
});

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: webAppRouter,
    createContext: () => ({
      // Minimal context: no Hono, no session, no logger
      honoContext: {
        req: { header: (_name: string) => undefined },
      } as never,
      session: null,
      log: undefined,
    }),
    onError:
      process.env.NODE_ENV === "development"
        ? ({ error }) => {
            console.error("tRPC error:", error); // eslint-disable-line no-console
          }
        : undefined,
  });

export { handler as GET, handler as POST };
