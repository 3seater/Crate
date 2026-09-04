# Next.js Rules

## Critical Rules

- Package manager is **pnpm**. Never use npm or yarn.
- Run `pnpm fix` before committing to ensure Ultracite/Biome compliance.
- Always read `node_modules/next/dist/docs/` (or `.next-docs/`) before making Next.js changes — your training data may be wrong.

## Next.js 16 Performance Principles

Hard-won rules from the PPR / streaming / caching optimization spec. Violating these causes build errors or runtime crashes.

### Server vs Client Boundaries

- `next/dynamic` with `ssr: false` is **NOT allowed in Server Components**. Wrap in a `"use client"` component.
- `usePathname()`, `useState`, `createContext` — anything that needs a client boundary must be in a `"use client"` file. Extract the minimal client piece; keep the parent a Server Component.
- `import "server-only"` at the top of any module that must never be bundled client-side (e.g. `trpc-server.ts`).

### PPR and Date.now()

- `QueryClient` (TanStack Query) calls `Date.now()` internally. Next.js 16 PPR forbids `Date.now()` before any dynamic data access.
- Fix: call `await connection()` (from `next/server`) before creating a `QueryClient`, **and** ensure there is a `<Suspense>` boundary above the component that calls `connection()`.
- `"use cache"` functions are still considered **static** by PPR — they do NOT satisfy the "uncached data access" requirement.

### Caching Layers (use all three together)

| Layer | Scope | API | When |
|-------|-------|-----|------|
| Request dedup | Single request | `React.cache()` | `generateMetadata` + page component share same fetch |
| In-memory LRU | Cross-request, same process | `lru-cache` | Hot data (markets, events) — 30-60s TTL |
| Framework cache | Cross-request, persistent | `"use cache"` + `cacheLife()` | Public data — `cacheLife("minutes")` = 1h expire, 1m revalidate |

- `cacheLife` expire must be **≥5 minutes** for PPR static shell eligibility.
- `cacheTag("market", slug)` for targeted invalidation. `revalidateTag` = background refresh; `updateTag` = immediate (Server Actions only).

### Streaming & Suspense

- Never wrap the entire page in a single `<Suspense>` — push boundaries down to individual dynamic regions.
- Defer `searchParams` and `params` access below `<Suspense>` boundaries when possible for PPR.
- Use streaming dehydration: configure `shouldDehydrateQuery` to include `status === 'pending'` so `prefetchQuery()` without `await` streams data to the client.

### React 19 Patterns

- `<Activity mode="visible"|"hidden">` preserves DOM and state for toggled components (tabs, panels). Replaces conditional `{active && <X />}` rendering.
- `suppressHydrationWarning` on time-dependent renders (e.g. "5m ago") instead of `useState` + `useEffect` hydration workarounds.
- Sticky data: use `useState` + `useEffect` (no deps) to hold the last defined value — the React Compiler cannot optimize ref reads during render, so prefer state over `useRef` for values consumed in JSX.

### Query Configuration

- Use centralized `staleTime` tiers from `@/config/query`: `STALE_REALTIME` (10s), `STALE_DEFAULT` (30s), `STALE_STABLE` (5min), `STALE_STATIC` (30min).
- Define `select` functions at module level (outside components) for referential stability — React Query memoizes via structural sharing.
- `content-visibility: auto` on long list rows for off-screen rendering optimization.
- Wrap sort/filter state updates in `startTransition` to keep UI responsive during expensive re-renders.
