/**
 * API contract between server and client.
 *
 * Type imports only — zero runtime code. The web app imports from here
 * instead of reaching into server internals.
 *
 * @example
 * import type { AppRouter, RouterOutput, RouterInput } from "@doji/contract";
 * type Market = RouterOutput["markets"]["getBySlug"];
 */

import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

export type { AppRouter } from "server/routers/index";

// Re-import for local use in type aliases
type _AppRouter = import("server/routers/index").AppRouter;

/** Pre-computed output types for every procedure. */
export type RouterOutput = inferRouterOutputs<_AppRouter>;

/** Pre-computed input types for every procedure. */
export type RouterInput = inferRouterInputs<_AppRouter>;
