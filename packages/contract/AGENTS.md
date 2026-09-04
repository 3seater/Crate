# Contract

> Scope: `packages/contract/`

Type-only API contract between server and client. Zero runtime code — only re-exports `AppRouter` and inferred type helpers.

## Exports

| Export | Description |
|--------|-------------|
| `AppRouter` | Root tRPC router type (re-exported from `apps/server`) |
| `RouterOutput` | `inferRouterOutputs<AppRouter>` — output types for every procedure |
| `RouterInput` | `inferRouterInputs<AppRouter>` — input types for every procedure |

## Usage

```ts
import type { RouterOutput, RouterInput } from "@doji/contract";

type Market = RouterOutput["markets"]["bySlug"];
type OrderInput = RouterInput["orders"]["place"];
```

## Why This Exists

Prevents the web app from importing directly from `apps/server/` internals. The contract package is the only allowed bridge between server types and client code.

## Related

- [tRPC setup](../api/AGENTS.md)
- [Server routers](../../apps/server/AGENTS.md)
