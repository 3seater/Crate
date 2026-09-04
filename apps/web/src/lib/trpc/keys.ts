import type { AppRouter } from "@doji/contract";
import { QueryClient } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";

/**
 * Isomorphic tRPC proxy for query key generation only.
 *
 * Safe to import in both Server Components and Client Components.
 * Does NOT make real network requests — use this only for
 * `.queryOptions(input).queryKey` and `.queryKey(input)` calls
 * to seed HydrationBoundary or build stable query keys.
 */
export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: "/trpc" })],
  }),
  queryClient: () => new QueryClient(),
});
