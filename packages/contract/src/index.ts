/**
 * API contract between server and client.
 *
 * Type imports only — zero runtime code. The web app imports from here
 * instead of reaching into server or route file internals directly.
 *
 * @example
 * import type { AppRouter, RouterOutput, RouterInput } from "@doji/contract";
 * type BasketPrices = RouterOutput["baskets"]["getLivePrices"];
 */

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export type { webAppRouter as AppRouter } from "web/src/app/api/trpc/[...trpc]/route";

// Re-import for local use in type aliases
type _AppRouter = import("web/src/app/api/trpc/[...trpc]/route").webAppRouter;

/** Pre-computed output types for every procedure. */
export type RouterOutput = inferRouterOutputs<_AppRouter>;

/** Pre-computed input types for every procedure. */
export type RouterInput = inferRouterInputs<_AppRouter>;
