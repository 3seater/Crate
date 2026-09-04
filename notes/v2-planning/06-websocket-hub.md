# 06 — WebSocket Hub & Sync Hooks

> Phase 3 · ~2 weeks · Depends on: TanStack Query migration (Phase 2)

Refactor WebSocket infrastructure from direct Zustand writes to a hub pattern where components read exclusively from TanStack Query and the hub keeps the cache fresh.

---

## 1. Current State

### Connection Topology (3 connections)

| Connection | Transport | Channels |
|---|---|---|
| CLOB host | Single WebSocket | Market + User (multiplexed) |
| RTDS | Separate WebSocket | Real-time data service |
| Sports | Separate WebSocket | Sports events |

### Files (`apps/web/src/shared/lib/websocket/`)

| File | Role |
|---|---|
| `manager.ts` | Core `WebSocketManager` class — connect, reconnect, heartbeat, subscribe/unsubscribe |
| `backoff.ts` | `computeBackoffDelay()` — exponential backoff with jitter |
| `subscription-registry.ts` | Ref-counted subscription tracking (prevents duplicate WS subscribes) |
| `market-channel.ts` | Singleton `marketChannel` — parses book/price/trade events, dispatches to scoped handlers |
| `user-channel.ts` | Singleton `userChannel` — parses order/trade events, handles credential refresh on reconnect |
| `sports-channel.ts` | Sports event data |
| `rtds.ts` | RTDS client |
| `schemas.ts` | Zod schemas for market/user messages |
| `sports-schemas.ts` | Zod schemas for sports |
| `rtds-schemas.ts` | Zod schemas for RTDS |

### Stores That Consume WS Data

| Store | Consumers | Data Source |
|---|---|---|
| `useOrderbookStore` | 8 | Market channel (book events) |
| `useOrdersStore` | 12 | User channel (order events) |
| `usePositionsStore` | 11 | User channel (trade events) |
| `useConnectionStore` | 4 | All channels (status) |
| `useWalletTrackerLiveFeedStore` | 2 | RTDS (trades) |

### Known Issues

1. **Jitter range too narrow** — ±25% (`0.75 + Math.random() * 0.5`), should be 50–100%
2. **No max retry limit** — retries forever, never surfaces permanent disconnection
3. **No REST snapshot on reconnect** — data gap from missed messages while offline
4. **Connection state in Zustand** — `useConnectionStore` causes unnecessary re-renders; should use `useSyncExternalStore`

---

## 2. Hub Architecture (V2 Target)

### Principle

One hub manages all WebSocket connections. Components never subscribe to WebSocket events directly. Components read from TanStack Query. The hub's only job is keeping TQ cache fresh.

```
┌─────────────────────────────────────────────────┐
│  (app)/layout.tsx                               │
│  ┌───────────────────────────────────────────┐  │
│  │  WebSocketHub (singleton, layout-scoped)  │  │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────┐  │  │
│  │  │ Market  │ │  User    │ │ RTDS /    │  │  │
│  │  │ Channel │ │  Channel │ │ Sports    │  │  │
│  │  └────┬────┘ └────┬─────┘ └─────┬─────┘  │  │
│  │       │           │              │        │  │
│  │       ▼           ▼              ▼        │  │
│  │  ┌──────────────────────────────────────┐ │  │
│  │  │     queryClient.setQueryData()       │ │  │
│  │  │     queryClient.invalidateQueries()  │ │  │
│  │  └──────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Page containers (sync hooks)             │  │
│  │  useMarketSync(tokenId)                   │  │
│  │  useAccountSync(address, conditionIds?)   │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  ┌───────────────────────────────────────────┐  │
│  │  Leaf components                          │  │
│  │  useQuery(orderbookQueryOptions(...))     │  │
│  │  useQuery(ordersQueryOptions(...))        │  │
│  │  useQuery(positionsQueryOptions(...))     │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Data Flow

1. Page loads → TQ query fetches REST snapshot (initial data)
2. Sync hook subscribes to WS channel for that page's token/market
3. WS events arrive → hub writes deltas into TQ cache via `setQueryData`
4. Components re-render via TQ's built-in subscription (no Zustand)
5. On navigation → sync hook cleans up WS subscription; TQ cache persists with `staleTime`

---

## 3. WebSocketManager Improvements

Four targeted changes to the existing manager. No behavior change for current consumers — these are prerequisites for the hub migration.

### 3a. Widen Jitter Range

**File:** `apps/web/src/shared/lib/websocket/backoff.ts`

Current jitter is ±25% (`0.75 + Math.random() * 0.5` → range `0.75–1.25`). Widen to 50–100% of base delay (`0.5 + Math.random() * 0.5` → range `0.5–1.0`) for better thundering-herd prevention.

```ts
// Before (line 22)
return Math.round(base * (0.75 + Math.random() * 0.5));

// After
return Math.round(base * (0.5 + Math.random() * 0.5));
```

### 3b. Add Max Retry Limit

**File:** `apps/web/src/shared/lib/websocket/manager.ts`

Add a constant and check in `scheduleReconnect()`. After 12 attempts (~2 min with exponential backoff), stop retrying and surface a permanent disconnected state.

```ts
// After (add near top of file, after imports)
const MAX_RECONNECT_ATTEMPTS = 12;
```

```ts
// Before — scheduleReconnect() starts immediately with:
private scheduleReconnect(): void {
  this.clearReconnectTimer();
  const delay = computeBackoffDelay(this.reconnectAttempts);
  this.reconnectAttempts++;
  // ...continues with setTimeout

// After — add guard at top of scheduleReconnect():
private scheduleReconnect(): void {
  if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    logger.warn(
      { channel: this.config?.channel, attempts: this.reconnectAttempts },
      "[WebSocket] Max reconnect attempts reached, giving up"
    );
    metrics.count("websocket_reconnect_exhausted", 1, {
      attributes: { channel: this.config?.channel ?? "unknown" },
    });
    this.setConnected(false);
    return;
  }
  this.clearReconnectTimer();
  const delay = computeBackoffDelay(this.reconnectAttempts);
  this.reconnectAttempts++;
  // ...rest unchanged
```

Export the constant so tests and UI can reference it:

```ts
// backoff.ts — add export
export const MAX_RECONNECT_ATTEMPTS = 12;
```

### 3c. REST Snapshot on Reconnect

**File:** `apps/web/src/shared/lib/websocket/manager.ts`

The `onReconnect` callback already exists but is only used by `user-channel.ts` for credential refresh. Extend the `onopen` handler to call `onReconnect` after a successful reconnect (attempt > 0), which sync hooks will use to invalidate TQ queries.

Current `onopen` already resets `reconnectAttempts` to 0 and calls `sendInitialSubscription`. The `onReconnect` callback fires in `scheduleReconnect`'s timeout — this is correct. No manager change needed; the sync hooks (§4) will use the existing `onReconnect` config to call `queryClient.invalidateQueries()`.

### 3d. Connection State via useSyncExternalStore

**File:** New file `apps/web/src/shared/lib/websocket/use-connection-status.ts`

Replace `useConnectionStore` (Zustand) with a lightweight `useSyncExternalStore` wrapper over the manager's connection state. This avoids Zustand proxy overhead and unnecessary re-renders for unrelated state changes.

```ts
"use client";

import { useSyncExternalStore } from "react";

type ConnectionStatus = "disconnected" | "connecting" | "connected";

// Module-level state — one map, no Zustand
const statusMap = new Map<string, ConnectionStatus>();
const listeners = new Set<() => void>();

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function setConnectionStatus(
  channel: string,
  status: ConnectionStatus
): void {
  if (statusMap.get(channel) === status) return;
  statusMap.set(channel, status);
  emitChange();
}

export function getConnectionStatusSnapshot(
  channel: string
): ConnectionStatus {
  return statusMap.get(channel) ?? "disconnected";
}

/**
 * React hook — subscribes to connection status for a specific channel.
 * Uses useSyncExternalStore for tear-free reads.
 */
export function useConnectionStatus(channel: string): ConnectionStatus {
  return useSyncExternalStore(
    (onStoreChange) => {
      listeners.add(onStoreChange);
      return () => listeners.delete(onStoreChange);
    },
    () => getConnectionStatusSnapshot(channel),
    () => "disconnected" as ConnectionStatus // SSR
  );
}
```

**Migration:** Replace `useConnectionStore.getState().setStatus(channel, status)` calls in `market-channel.ts` and `user-channel.ts` with `setConnectionStatus(channel, status)`. Replace `useConnectionStore` hook usage in components with `useConnectionStatus(channel)`.

---

## 4. Sync Hooks Design

### useMarketSync

```
apps/web/src/shared/lib/websocket/use-market-sync.ts
```

Subscribes to market channel for a specific token pair. Writes orderbook deltas and price updates into TQ cache.

```ts
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { marketChannel } from "./market-channel";
import type { MarketChannelEvent } from "./market-channel";

/**
 * Sync market WebSocket data into TanStack Query cache.
 * Call once per market page — not per component.
 */
export function useMarketSync(tokenId: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!tokenId) return;

    const removeHandler = marketChannel.addScopedHandler(
      [tokenId],
      (event: MarketChannelEvent) => {
        switch (event.event_type) {
          case "book":
            // Pattern A: apply delta to orderbook cache
            queryClient.setQueryData(
              ["orderbook", tokenId],
              (prev: unknown) => applyBookDelta(prev, event)
            );
            break;
          case "price_change":
          case "last_trade_price":
          case "best_bid_ask":
            // Pattern A: update price cache
            queryClient.setQueryData(
              ["market-price", tokenId],
              (prev: unknown) => applyPriceUpdate(prev, event)
            );
            break;
        }
      }
    );

    // Subscribe to WS channel
    marketChannel.subscribe([tokenId]);

    return () => {
      removeHandler();
      marketChannel.unsubscribe([tokenId]);
    };
  }, [tokenId, queryClient]);
}
```

### useAccountSync

```
apps/web/src/shared/lib/websocket/use-account-sync.ts
```

Subscribes to user channel for the authenticated user. Merges order/position updates into TQ cache or invalidates for refetch.

```ts
"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { userChannel } from "./user-channel";
import type { UserChannelEvent } from "./user-channel";

/**
 * Sync user WebSocket data into TanStack Query cache.
 * Call once in app layout — persists across navigation.
 */
export function useAccountSync(
  address: string | undefined,
  conditionIds?: string[]
): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!address) return;

    const removeHandler = userChannel.addHandler(
      (event: UserChannelEvent) => {
        switch (event.event_type) {
          case "order":
            // Pattern B: merge or invalidate
            queryClient.invalidateQueries({ queryKey: ["orders", address] });
            break;
          case "trade":
            // Pattern B: invalidate positions + balance
            queryClient.invalidateQueries({ queryKey: ["positions", address] });
            queryClient.invalidateQueries({ queryKey: ["balance", address] });
            break;
        }
      }
    );

    // Subscribe to user markets if provided
    if (conditionIds?.length) {
      userChannel.subscribe(conditionIds);
    }

    return () => {
      removeHandler();
      if (conditionIds?.length) {
        userChannel.unsubscribe(conditionIds);
      }
    };
  }, [address, conditionIds, queryClient]);
}
```

### Rules

- **Called once per page**, not per component — avoids duplicate subscriptions
- **Lives in page containers**, not leaf components
- Hub in layout (persists across navigation), sync hooks in pages (change per route)
- Leaf components use `useQuery()` to read from TQ cache — they never import channel singletons

---

## 5. Integration Patterns

### Pattern A: Snapshot + Delta (orderbook, prices)

For data that changes frequently and can be incrementally updated.

```
1. Page mounts → useQuery(["orderbook", tokenId]) fetches REST snapshot
2. useMarketSync subscribes to WS for that tokenId
3. WS "book" event → queryClient.setQueryData(["orderbook", tokenId], applyDelta)
4. Components re-render via TQ subscription — same queryKey, no Zustand
5. Page unmounts → useMarketSync cleanup unsubscribes from WS
```

**Key:** `setQueryData` applies the delta function to the existing cache entry. The REST snapshot provides the base; WS events patch it. No full refetch on every tick.

### Pattern B: Merge + Invalidate (orders, positions)

For data that changes infrequently and is cheaper to refetch than merge.

```
1. Page mounts → useQuery(["orders", address]) fetches from tRPC
2. useAccountSync subscribes to user WS channel
3. WS "order" event → queryClient.invalidateQueries(["orders", address])
4. TQ refetches in background → components update
5. Layout persists → useAccountSync stays active across navigation
```

**Key:** `invalidateQueries` marks the cache stale and triggers a background refetch. For high-frequency events, debounce the invalidation (e.g. 500ms) to batch rapid order updates.

### When to Use Which

| Pattern | Use When | Examples |
|---|---|---|
| A (Snapshot + Delta) | High-frequency, incrementally updatable | Orderbook, prices, best bid/ask |
| B (Merge + Invalidate) | Low-frequency, complex state | Orders, positions, balances |

---

## 6. Placement Rules

Where each piece lives in the component tree:

```
(app)/layout.tsx
├── WebSocketHub lifecycle (connect/disconnect on mount)
├── useAccountSync(address)          ← persists across pages
│
├── /market/[slug]/page.tsx
│   └── MarketPageContainer
│       ├── useMarketSync(tokenId)   ← changes per market
│       └── <TradingLayout>
│           ├── <Orderbook />        ← useQuery(["orderbook", tokenId])
│           ├── <OrderForm />        ← useQuery(["market-price", tokenId])
│           └── <Chart />            ← useQuery(["price-history", tokenId])
│
├── /portfolio/page.tsx
│   └── PortfolioContainer
│       └── <PositionsTable />       ← useQuery(["positions", address])
│
└── /explore/page.tsx
    └── <EventCards />               ← useQuery(["events"]) (no WS sync needed)
```

### Rationale

| Component | Location | Why |
|---|---|---|
| Hub lifecycle | `(app)/layout.tsx` | Persists across all navigation — one connection for the session |
| `useAccountSync` | `(app)/layout.tsx` | User data (orders, positions) is relevant on every page |
| `useMarketSync` | `market/[slug]` page container | Only needed when viewing a specific market; cleans up on navigate away |
| `useConnectionStatus` | Any component that shows connection indicator | Lightweight `useSyncExternalStore` — no provider needed |

---

## 7. Reconnect Strategy

When a WebSocket reconnects after a disconnection, there's a data gap — messages were missed while offline. The reconnect strategy fills this gap:

```
Disconnect detected
  ↓
Exponential backoff (max 12 attempts)
  ↓
Connection re-established
  ↓
Re-subscribe to all active channels (manager handles this via sendInitialSubscription)
  ↓
onReconnect callback fires
  ↓
Sync hooks invalidate relevant TQ queries:
  - useMarketSync → invalidateQueries(["orderbook", tokenId])
  - useAccountSync → invalidateQueries(["orders", address], ["positions", address])
  ↓
TQ refetches REST snapshots in background (fills the gap)
  ↓
WS resumes delivering deltas (applied on top of fresh snapshot)
```

### Why This Works

- **No sequence numbers needed** — REST snapshot is the source of truth; WS deltas are optimistic updates on top
- **No message replay** — Polymarket WS doesn't support replay; REST refetch is the only way to fill gaps
- **Automatic** — sync hooks register `onReconnect` callbacks; no manual intervention

### Edge Case: Rapid Reconnect

If reconnect happens within the TQ `staleTime` window, the cache is still fresh and `invalidateQueries` is a no-op (data isn't stale). This prevents unnecessary refetches for brief network blips.

---

## 8. Migration Steps

Each step is independently shippable. No step breaks existing consumers.

### Step 1: WebSocketManager Improvements

**Scope:** `backoff.ts`, `manager.ts`
**Changes:** Widen jitter (§3a), add max retry limit (§3b)
**Risk:** None — backoff changes are invisible to consumers
**Verify:** Unit test `computeBackoffDelay` range; integration test that manager stops after 12 attempts

### Step 2: Create useMarketSync Hook

**Scope:** New file `use-market-sync.ts`
**Changes:** Additive — new hook, not yet consumed
**Risk:** None — no existing code changes
**Verify:** Mount in market page alongside existing Zustand flow; confirm TQ cache updates match Zustand

### Step 3: Create useAccountSync Hook

**Scope:** New file `use-account-sync.ts`
**Changes:** Additive — new hook, not yet consumed
**Risk:** None — no existing code changes
**Verify:** Mount in layout alongside existing Zustand flow; confirm TQ invalidations fire correctly

### Step 4: Migrate Orderbook from Zustand to TQ + Sync Hook

**Scope:** `useOrderbookStore` consumers (8 components)
**Changes:**
- Replace `useOrderbookStore` reads with `useQuery(["orderbook", tokenId])`
- `useMarketSync` becomes the sole writer to orderbook TQ cache
- Remove orderbook Zustand store
**Risk:** Medium — 8 consumers must be updated atomically
**Verify:** Orderbook renders correctly; prices update in real-time; no stale data after navigation

### Step 5: Migrate Orders from Zustand to TQ + Sync Hook

**Scope:** `useOrdersStore` consumers (12 components)
**Changes:**
- Replace `useOrdersStore` reads with `useQuery(["orders", address])`
- `useAccountSync` invalidates on order events
- Remove orders Zustand store
**Risk:** Medium — 12 consumers; order state machine logic must move to TQ select functions
**Verify:** Order status updates in real-time; cancel/fill transitions work; no phantom orders

### Step 6: Replace useConnectionStore with useSyncExternalStore

**Scope:** `connection.ts` store, 4 consumers, `market-channel.ts`, `user-channel.ts`
**Changes:**
- Create `use-connection-status.ts` (§3d)
- Replace `useConnectionStore.getState().setStatus()` calls in channels with `setConnectionStatus()`
- Replace `useConnectionStore` hook usage in components with `useConnectionStatus(channel)`
- Delete `connection.ts` store
**Risk:** Low — 4 consumers, straightforward replacement
**Verify:** Connection indicator shows correct status; reconnect transitions display properly

---

## 9. Timeline

| Week | Steps | Deliverable |
|---|---|---|
| Week 1 | Steps 1–3 | Manager hardened, sync hooks created (additive, no breakage) |
| Week 2 | Steps 4–6 | Orderbook + orders migrated to TQ, connection store replaced |

**Prerequisites:** TanStack Query migration (Phase 2) must be complete — sync hooks write to TQ cache, so query keys and cache structure must be established first.

**Phase 3 total:** ~2 weeks, parallelizable with other Phase 3 work (the manager improvements in Step 1 can land immediately).
