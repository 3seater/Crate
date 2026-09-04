# Doji V2 — Naming Conventions

> Consistent naming rules for files, exports, procedures, stores, hooks, schemas, and constants.
> Covers V2.md §17 — applied uniformly across the entire codebase.
>
> **Date:** 2026-05-02
> **Phase:** 0 (Foundations)
> **Risk:** Low
> **Status:** Planning

---

## Table of Contents

1. [File Naming](#1-file-naming)
2. [File Suffixes](#2-file-suffixes)
3. [Directories](#3-directories)
4. [tRPC Procedures](#4-trpc-procedures)
5. [Zustand Stores](#5-zustand-stores)
6. [Hooks](#6-hooks)
7. [Zod Schemas](#7-zod-schemas)
8. [Query Option Factories](#8-query-option-factories)
9. [Event Handlers](#9-event-handlers)
10. [Boolean Variables](#10-boolean-variables)
11. [Compound Component Parts](#11-compound-component-parts)
12. [Constants](#12-constants)
13. [Current Violations Audit](#13-current-violations-audit)
14. [Enforcement Plan](#14-enforcement-plan)

---

## 1. File Naming

Always `kebab-case`. Component exports inside files are `PascalCase`.

```
order-form-container.tsx    → export function OrderFormContainer(...)
use-session.ts              → export function useSession()
order-form-store.ts         → export const useOrderFormStore = create(...)
```

**Rules:**
- File names never contain uppercase letters
- File names never use camelCase or PascalCase
- The export name is derived from the file name by converting to PascalCase
- Hook files start with `use-`

---

## 2. File Suffixes

Suffixes are **required** for files that serve a specific infrastructure role. They are **optional** for general components — a file named `event-card.tsx` is fine on its own.

### Required Suffixes

| Suffix | Contains | Example |
|--------|---------|---------|
| `-skeleton.tsx` | Loading state component | `orderbook-skeleton.tsx` |
| `-provider.tsx` | React context provider | `order-form-provider.tsx` |
| `-modal.tsx` | Dialog or sheet | `bridge-modal.tsx` |
| `-store.ts` | Zustand store | `order-form-store.ts` |
| `-schema.ts` | Zod schema + inferred types | `place-order-schema.ts` |
| `-types.ts` | TypeScript-only type definitions | `market-types.ts` |
| `-constants.ts` | `UPPER_SNAKE_CASE` primitives | `explore-constants.ts` |
| `-utils.ts` | Pure functions, no side effects | `price-utils.ts` |

### Optional Suffixes

| Suffix | When to use | Example |
|--------|------------|---------|
| `-container.tsx` | Only when `-view.tsx` also exists | `orderbook-container.tsx` |
| `-view.tsx` | Only when `-container.tsx` also exists | `orderbook-view.tsx` |
| `-hooks.ts` | When a file has multiple related hooks | `order-form-hooks.ts` |

**Rule:** Use `-container.tsx` / `-view.tsx` only when both exist for the same concept. If there's only a container with no separate view, just name it descriptively (e.g., `orderbook.tsx`).

---

## 3. Directories

### `lib/` — All Logic

Contains pure utilities, transforms, AND external API clients. The `-service.ts` suffix on the file marks external I/O. No separate `services/` directory.

```
lib/
├── order-validation.ts      # Pure validation logic
├── clob-read.ts             # CLOB API reads
├── gamma.ts                 # Gamma API client
└── magic-auth.ts            # Magic SDK auth logic
```

### `config/` — Runtime Configuration

Values that change per environment or are derived from env vars.

```
config/
├── query.ts                 # staleTime tiers
├── app.ts                   # isProduction, baseUrl
└── features.ts              # Feature flags
```

### Domain `-constants.ts` — Fixed Values

Domain-specific fixed values that never change. Lives alongside the domain code, not in a shared `constants/` directory.

```
features/explore/explore-constants.ts
features/trading/activity-history-constants.ts
```

---

## 4. tRPC Procedures

### Queries: Noun (No `get` Prefix)

```ts
// ✅ Noun or noun phrase
orders.open                    // not orders.getOpenOrders
markets.orderbook              // not markets.getOrderBook
portfolio.positions            // not portfolio.getPositions
markets.bySlug                 // not markets.getBySlug
events.byId                    // not events.getById
data.value                     // not data.getValue
auth.me                        // not auth.getMe

// ❌ get prefix
orders.getOpenOrders
markets.getOrderBook
```

### Mutations: Verb

```ts
// ✅ Verb
orders.place                   // not orders.createAndPostOrder
orders.cancel                  // not orders.cancelOrder
watchlist.toggle               // not watchlist.toggleWatchlistItem
auth.logout                    // not auth.performLogout

// ❌ Verbose
orders.createAndPostOrder
watchlist.toggleWatchlistItem
```

---

## 5. Zustand Stores

### File Naming

Store files end in `-store.ts`. The hook export follows `use{Name}Store`:

```ts
// order-form-store.ts
export const useOrderFormStore = create<OrderFormState & OrderFormActions>()(...)
```

### Selector Enforcement

Access via selectors. `useOrderFormStore()` without a selector is a lint warning — it causes the component to re-render on any state change.

```ts
// ✅ Selector — component only re-renders when `side` changes
const side = useOrderFormStore((s) => s.side);

// ✅ Multiple values — still uses selector
const { side, price } = useOrderFormStore((s) => ({ side: s.side, price: s.price }));

// ❌ Full store — component re-renders on any state change
const store = useOrderFormStore();
```

---

## 6. Hooks

### Naming Patterns

| Pattern | Convention | Example |
|---------|-----------|---------|
| Read hooks | `use` + noun | `useSession()`, `useOrderbook(tokenId)`, `usePositions(address)` |
| Action hooks | `use` + verb phrase | `usePlaceOrder()`, `useDeploySafe()`, `useApproveTokens()` |
| Sync hooks (side effects) | `use` + noun + `Sync` | `useMarketSync(tokenId)`, `useAccountSync(address)` |

### No Infrastructure Names

Hook names describe what they do in domain terms, not which infrastructure they use.

```ts
// ✅ Domain names
useOrderClient()           // not useClobClient()
useHeartbeatSync()         // not useClobHeartbeat()
useMarketData()            // not useGammaData()
useRealtimePrice()         // not useWsPrice()

// ❌ Infrastructure names
useClobClient()
useClobHeartbeat()
useGammaMarket()
useWsOrderbook()
```

---

## 7. Zod Schemas

Schema variable is `camelCase` + `Schema` suffix. Inferred type drops the suffix.

```ts
// ✅ camelCase + Schema suffix
export const marketSchema = z.object({ ... });
export type Market = z.infer<typeof marketSchema>;

export const placeOrderSchema = z.object({ ... });
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;

// ❌ PascalCase schema name
export const MarketSchema = z.object({ ... });
export const BookMessageSchema = z.object({ ... });
```

---

## 8. Query Option Factories

`{entity}{Action}QueryOptions` pattern. These are functions that return query options for TanStack Query.

```ts
export const marketBySlugQueryOptions = (slug: string) =>
  trpc.markets.getBySlug.queryOptions({ slug });

export const openOrdersQueryOptions = (address: string) =>
  trpc.orders.open.queryOptions({ address });

export const orderbookQueryOptions = (tokenId: string) =>
  trpc.clob.getOrderBook.queryOptions({ tokenId });
```

**Note:** Currently the codebase uses inline `trpc.{router}.{proc}.queryOptions(input)` calls rather than extracted factories. V2 should extract these for reuse when the same query options are used in 2+ places.

---

## 9. Event Handlers

### Internal Handlers: `handle` Prefix

```tsx
function OrderForm() {
  const handleSubmit = () => { ... };
  const handlePriceChange = (v: string) => { ... };
  const handleTabSwitch = (tab: string) => { ... };
  return <form onSubmit={handleSubmit}>...</form>;
}
```

### Prop Callbacks: `on` Prefix

```tsx
type OrderFormProps = {
  onSubmit: (order: Order) => void;
  onChange: (values: FormValues) => void;
  onTabChange: (tab: string) => void;
};
```

**Rule:** Internal = `handle`. Prop = `on`. Never mix them.

---

## 10. Boolean Variables

Always prefix with `is`, `has`, `should`, or `can`:

```ts
// ✅ Prefixed booleans
const isLoading = true;
const hasCredentials = session.hasCredentials;
const shouldRefetch = staleTime < Date.now();
const canTrade = market.acceptingOrders && !closedOnlyMode;

// ❌ Unprefixed booleans
const loading = true;
const credentials = true;
const refetch = true;
const disabled = false;
```

**Exception:** Loop-scoped variables in render functions where the boolean is immediately consumed (e.g., `const active = selectedId === id` inside a `.map()`) are acceptable but should prefer `isActive` in new code.

---

## 11. Compound Component Parts

PascalCase nouns, exported as namespace object:

```ts
// ✅ Namespace export
export const Orderbook = { Root, Header, BidRows, AskRows, Spread };
export const OrderForm = { Provider, Frame, PriceField, AmountField, Submit };
export const Chart = { Provider, Canvas, Toolbar, TimeframeSelector };
```

**Rules:**
- Part names are PascalCase nouns (not verbs)
- The namespace object is the default way to consume compound components
- Each part is also individually exportable for tree-shaking if needed

---

## 12. Constants

`UPPER_SNAKE_CASE` for primitive constants. `camelCase` for structured config objects.

```ts
// ✅ Primitive constants — UPPER_SNAKE_CASE
export const STALE_REALTIME = 10_000;
export const STALE_DEFAULT  = 30_000;
export const STALE_STABLE   = 5 * 60_000;
export const STALE_STATIC   = 30 * 60_000;
export const MAX_RETRIES    = 3;

// ✅ Config objects — camelCase
export const queryDefaults = { staleTime: STALE_DEFAULT, gcTime: GC_DEFAULT };
export const chartConfig = { defaultTimeframe: "1D", maxCandles: 500 };

// ❌ camelCase for primitives
export const staleRealtime = 10000;

// ❌ UPPER_SNAKE_CASE for objects
export const QUERY_DEFAULTS = { staleTime: STALE_DEFAULT };
```

---

## 13. Current Violations Audit

Snapshot of naming violations as of 2026-05-02. This is not exhaustive — it covers the most impactful categories.

### Store Files Missing `-store.ts` Suffix

16 of 17 store files use generic names instead of the `-store.ts` suffix:

| Current file | Should be |
|-------------|-----------|
| `shared/stores/notifications.ts` | `notifications-store.ts` |
| `shared/stores/wallet.ts` | `wallet-store.ts` |
| `shared/stores/connection.ts` | `connection-store.ts` |
| `shared/stores/balances-hidden.ts` | `balances-hidden-store.ts` |
| `features/bridge/stores/bridge-activity.ts` | `bridge-activity-store.ts` |
| `features/trading/stores/orders.ts` | `orders-store.ts` |
| `features/trading/stores/cash-balance-pulse.ts` | `cash-balance-pulse-store.ts` |
| `features/trading/stores/scoreboard-widget.ts` | `scoreboard-widget-store.ts` |
| `features/trading/stores/orderbook.ts` | `orderbook-store.ts` |
| `features/trading/stores/pending-balance-deltas.ts` | `pending-balance-deltas-store.ts` |
| `features/trading/stores/pending-position-tokens.ts` | `pending-position-tokens-store.ts` |
| `features/trading/stores/positions.ts` | `positions-store.ts` |
| `features/trading/stores/order-form.ts` | `order-form-store.ts` |
| `features/trading/stores/workspace-layout.ts` | `workspace-layout-store.ts` |
| `features/wallet-tracker/stores/wallet-tracker-sound.ts` | `wallet-tracker-sound-store.ts` |
| `layout/stores/dock-layout.ts` | `dock-layout-store.ts` |

**Impact:** Low risk rename — imports update via find-and-replace. The `use{Name}Store` export names are already correct.

### tRPC Procedures with `get` Prefix

**55 of 140 procedures** (39%) use the `get` prefix on query names:

| Router | `get`-prefixed procedures |
|--------|--------------------------|
| `trading/router.ts` | 43 (e.g., `getOrderBook`, `getClobMarketInfo`, `getLiquidityMetrics`, `getMidpoint`) |
| `events/router.ts` | 4 (`getById`, `getBySlug`, `getCommentEntity`, `getTags`) |
| `markets/router.ts` | 3 (`getById`, `getBySlug`, `getTags`) |
| `auth/router.ts` | 2 (`getWalletLoginChallenge`, `getCredentials`) |
| `referrals/router.ts` | 2 (`getMyCode`, `getMyStats`) |
| `data/router.ts` | 1 (`getEventOutcomeCount`) |

**Impact:** High — renaming procedures is a coordinated change (server + all web call sites). Should be done as part of the Router Split Plan (doc 02).

### Zod Schemas with PascalCase Names

20 schemas use `PascalCase` instead of `camelCase`:

| File | PascalCase schemas |
|------|-------------------|
| `web/shared/lib/websocket/schemas.ts` | `BookMessageSchema`, `PriceChangeMessageSchema`, `LastTradePriceMessageSchema`, `BestBidAskMessageSchema`, `TickSizeChangeMessageSchema` (+ more) |
| `web/shared/lib/websocket/rtds-schemas.ts` | `CommentPayloadSchema`, `CryptoPricePayloadSchema` |
| `server/features/markets/schemas/gamma.ts` | `SearchTagSchema`, `PaginationSchema` |
| `server/features/bridge/schemas/bridge.ts` | `SupportedAssetsResponseSchema`, `SupportedAssetsNormalizedSchema` |
| `server/features/trading/schemas/clob.ts` | `PriceHistoryResponseSchema` |

**Impact:** Low — rename the variable, update imports. No API contract change.

### Hooks with Infrastructure Names

| Current name | Should be |
|-------------|-----------|
| `useClobClient` (`features/trading/hooks/use-clob-client.ts`) | `useOrderClient` |
| `useClobHeartbeat` (`features/trading/hooks/use-clob-heartbeat.ts`) | `useHeartbeatSync` |

**Impact:** Low — rename export + update consumers.

### Zustand Stores Accessed Without Selectors

2 files access stores without selectors (full store destructuring):

| File | Store |
|------|-------|
| `features/portfolio/components/portfolio-top-cards.tsx` | `useBalancesHiddenStore()` |
| `features/wallet-tracker/components/wallet-tracker-sound-controls.tsx` | `useWalletTrackerSoundStore()` |

**Impact:** Low — add selectors to reduce unnecessary re-renders.

### Boolean Variables Without Prefix

~13 instances of unprefixed booleans (`active`, `visible`, `open`, `selected`, `disabled`) found across components. Most are loop-scoped variables in `.map()` callbacks. Examples:

- `const active = selectedIds.includes(cid)` → `const isActive = ...`
- `const visible = DISPLAY_COLUMN_IDS.filter(...)` → `const isVisible = ...`
- `const open = Boolean(urlEntry) || manualOpen` → `const isOpen = ...`
- `const selected = group.tools[0]` → not a boolean, false positive

**Impact:** Very low — cosmetic rename, no behavior change.

---

## 14. Enforcement Plan

### Principle: New Code Follows Rules, Existing Code Updated When Touched

No big-bang rename. Instead:

### Immediate (New Code)

1. **Code review checklist** — reviewers check new files against this document
2. **PR template** — add "Naming conventions followed?" checkbox
3. **AGENTS.md update** — add naming rules to `apps/web/AGENTS.md` and `apps/server/AGENTS.md` so AI agents follow them

### Short-Term (When Touching Files)

1. **Store renames** — when modifying a store file, rename it to `-store.ts` suffix in the same PR
2. **Schema renames** — when modifying a schema file, rename PascalCase schemas to camelCase
3. **Hook renames** — when modifying `useClobClient` or `useClobHeartbeat`, rename to domain names
4. **Boolean renames** — when modifying a component, prefix unprefixed booleans

### Medium-Term (Coordinated with Router Split)

1. **tRPC procedure renames** — batch rename `get`-prefixed procedures during the Router Split Plan (doc 02). This is a coordinated server + web change that should not be done piecemeal.
2. **Query option factories** — extract inline `trpc.{router}.{proc}.queryOptions(input)` calls into named factories when the same options are used in 2+ places.

### Automated Enforcement (Future)

1. **Biome custom rule** — if Biome supports custom rules, add a rule for store file suffix and boolean prefix
2. **Knip** — already catches unused exports; can be extended to flag naming violations
3. **CI lint for new files** — a simple script that checks new `.ts`/`.tsx` files in the PR diff:
   - File name is kebab-case
   - Store files end in `-store.ts`
   - Schema files end in `-schema.ts`
   - No PascalCase Zod schema exports

```bash
# Example CI check for new files (add to .github/workflows/ci.yml)
git diff --name-only --diff-filter=A origin/main |
  grep -E '\.(ts|tsx)$' |
  grep -vE '^[a-z0-9\-/\.]+$' &&
  echo "ERROR: Non-kebab-case file names found" && exit 1
```

### Timeline

| When | What |
|------|------|
| Now | Update AGENTS.md with naming rules |
| Phase 0 | Rename store files when touched |
| Phase 0 | Rename PascalCase schemas when touched |
| Phase 2 (Router Split) | Batch rename `get`-prefixed tRPC procedures |
| Phase 6 (Domain Restructure) | Final sweep for remaining violations |
