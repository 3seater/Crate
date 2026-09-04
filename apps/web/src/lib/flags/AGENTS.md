# Feature Flags

> Scope: `apps/web/src/lib/flags/`

Ops kill switches and feature flags via Vercel Flags SDK + Edge Config.

## Architecture

**Server/client split** — Edge Config uses `"use cache"` internally, so `definitions.ts` is server-only. Client Components get flag values through a React context seeded at render time.

| File | Side | Purpose |
|------|------|---------|
| `definitions.ts` | Server only | Flag definitions with Edge Config adapter. 7 ops flags. |
| `guards.ts` | Server only | Composite guards (`isTradingEnabled()`) |
| `provider.tsx` | Client | `FlagProvider` context + `useFlag(name)` hook |
| `client.ts` | Client | Re-exports `FlagProvider` and `useFlag` (safe import path) |
| `types.ts` | Shared | `FlagType`, `FlagMeta` interfaces |
| `index.ts` | Server only | Re-exports definitions + guards |

## Import Rules

```ts
// Server Components / RSC
import { opsClob, opsMagic } from "@/lib/flags";

// Client Components
import { useFlag } from "@/lib/flags/client";
```

Never import `@/lib/flags` (or `@/lib/flags/definitions`) from a Client Component — it will break the build.

## Current Flags

All 7 are ops kill switches (type `"ops"`, default `true`):
`opsClob`, `opsMagic`, `opsSafeDeploy`, `opsBridge`, `opsOnboarding`, `opsWalletLogin`, `opsReferrals`
