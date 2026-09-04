# Common Patterns

## Add a tRPC endpoint

1. Define in `apps/server/src/domains/{domain}/router.ts` — use `protectedProcedure` (requires auth) or `publicProcedure`
2. Validate input with Zod inline; throw `TRPCError` or `AppError` on failure — never raw `Error`
3. Polymarket client errors: catch at router boundary, convert via `mapApiErrorToTRPC`
4. Ensure the router is wired in `apps/server/src/routers/index.ts` (imports from `domains/*/router.ts`)
5. **Web query:** `useQuery(trpc.{router}.{proc}.queryOptions(input))` — use `skipToken` when input is absent
6. **Web mutation / imperative:** `trpcClient.{router}.{proc}.mutate(input)`

## Add a web page

1. Create `apps/web/src/app/{route}/page.tsx` — default export `async function` (Server Component)
2. Fetch data at the top via `import { trpc } from "@/lib/trpc/server"` for RSC (not client hooks)
3. Wrap content: `<ContentWidth variant="..."><ContentSpacing>...</ContentSpacing></ContentWidth>`
4. Add the route to the routes list in `apps/web/AGENTS.md`
5. Add a nav link in `shell/header-nav.tsx` and/or `shell/bottom-bar.tsx`

## Add a UI component

1. Place in `apps/web/src/domains/{domain}/components/` — file name `kebab-case.tsx`
2. Add `"use client"` only if it needs hooks or event handlers; prefer Server Components otherwise
3. Follow design tokens (see design-system.md): no hardcoded colors, 6-size type scale only
4. No raw `<button>` — use `Button` from `@/ui/button` with an appropriate variant
5. No `title` attribute for tooltips — use `@/ui/tooltip` or `aria-label`
