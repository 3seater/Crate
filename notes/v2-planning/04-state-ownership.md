# 04 — State Ownership Map

> Maps every piece of state in the app to its owner (current and V2), with file-level detail.
> Covers all 17 Zustand stores, TanStack Query cache, and the migration plan for each.
>
> **Snapshot date:** 2026-05-02

## 1. State Ownership Table

### Legend

| Category | V2 Owner | Persist? |
|----------|----------|----------|
| Server data (fetched from API) | TanStack Query | Query cache (gcTime) |
| Real-time streaming data | Zustand (WS-updated) | No (in-memory) |
| Optimistic/ephemeral | Zustand (not persisted) | No |
| User preferences | Zustand (persisted) | localStorage |
| Wallet connection | Zustand (persisted) | localStorage |
| Session/auth | TanStack Query (V2) | HttpOnly cookie |

### Wallet & Auth State

| State | Current Owner | V2 Owner | Persist? | Cleared on Logout? | Migration? |
|-------|--------------|----------|----------|-------------------|------------|
| `address` | useWalletStore | useWalletStore (trimmed) | localStorage | ✅ | Remove from auth flow |
| `chainId` | useWalletStore | useWalletStore (trimmed) | localStorage | ✅ | Keep |
| `signatureType` | useWalletStore | useWalletStore (trimmed) | localStorage | ✅ | Keep |
| `isConnected` | useWalletStore | useWalletStore (trimmed) | localStorage | ✅ | Keep |
| `funderAddress` | useWalletStore | useWalletStore (trimmed) | localStorage | ✅ | Keep |
| `authMethod` | useWalletStore | useWalletStore (trimmed) | localStorage | ✅ | Keep |
| `sessionToken` | useWalletStore | TanStack Query + HttpOnly cookie | Cookie | ✅ | **Yes** — see 03-session-model.md |
| `userId` | useWalletStore | TanStack Query (session query) | Cookie | ✅ | **Yes** — derived from session |
| `email` | useWalletStore | TanStack Query (session query) | Cookie | ✅ | **Yes** — derived from session |
| `safeAddress` | useWalletStore | TanStack Query (session query) | Cookie | ✅ | **Yes** — derived from session |
| `hasCredentials` | useWalletStore | TanStack Query (session query) | Cookie | ✅ | **Yes** — derived from session |
| `onboardingCompleted` | useWalletStore | TanStack Query (session query) | Cookie | ✅ | **Yes** — derived from session |

### Workspace & Layout State

| State | Current Owner | V2 Owner | Persist? | Cleared on Logout? | Migration? |
|-------|--------------|----------|----------|-------------------|------------|
| `panelOrder` | useWorkspaceLayoutStore | Same | localStorage v5 | ❌ | No |
| `orderbookWidthPct` | useWorkspaceLayoutStore | Same | localStorage v5 | ❌ | No |
| `chartHeight` | useWorkspaceLayoutStore | Same | localStorage v5 | ❌ | No |
| `activeTab` | useWorkspaceLayoutStore | Same | localStorage v5 | ❌ | No |
| `chartInterval` | useWorkspaceLayoutStore | Same | localStorage v5 | ❌ | No |
| `chartType` | useWorkspaceLayoutStore | Same | localStorage v5 | ❌ | No |
| `allMarketsMode` | useWorkspaceLayoutStore | Same | localStorage v5 | ❌ | No |
| `visibleMarketIds` | useWorkspaceLayoutStore | Same | localStorage v5 | ❌ | No |
| `leftSlot` / `rightSlot` | useDockLayoutStore | Same | localStorage v3 | ❌ | No |
| `widths` / `widthRatios` | useDockLayoutStore | Same | localStorage v3 | ❌ | No |

### User Preferences

| State | Current Owner | V2 Owner | Persist? | Cleared on Logout? | Migration? |
|-------|--------------|----------|----------|-------------------|------------|
| `preferences.*` (notifications) | useNotificationsStore | Same | localStorage | ❌ | No |
| `side`, `orderType`, `size`, `price`, `limitExpiration`, `postOnly` | useOrderFormStore | Same | localStorage | ❌ | No |
| `balancesHidden` | useBalancesHiddenStore | Same | localStorage | ❌ | No |
| `enabled`, `soundName`, `volume` (tracker sound) | useWalletTrackerSoundStore | Same | localStorage | ❌ | No |

### Ephemeral UI State

| State | Current Owner | V2 Owner | Persist? | Cleared on Logout? | Migration? |
|-------|--------------|----------|----------|-------------------|------------|
| `staleAt` (cash balance pulse) | useCashBalancePulseStore | **Remove** → `useMutationState` | No | N/A | **Yes** |
| `gameId`, `isOpen`, `position` (scoreboard) | useScoreboardWidgetStore | Same | No | ❌ | No |
| `status`, `errors`, `lastConnected` (WS) | useConnectionStore | Same | No | ✅ | No |

### Trading — Hybrid Stores

| State | Current Owner | V2 Owner | Persist? | Cleared on Logout? | Migration? |
|-------|--------------|----------|----------|-------------------|------------|
| `bids`, `asks`, `spread`, `midpoint`, `bestBid`, `bestAsk` | useOrderbookStore | Same (WS streaming) | No | ✅ | **Optimize** — REST snapshot via TQ |
| `displayPrice`, `lastTradePrice`, `lastTradeSide` | useOrderbookStore | Same (WS streaming) | No | ✅ | No |
| `books` (multi-token cache) | useOrderbookStore | Same | No | ✅ | No |
| `tokenId`, `orderbookClickPrefill`, `preferredOrderSide` | useOrderbookStore | Same | No | ✅ | No |
| `wsLiveTokens` | useOrderbookStore | Same | No | ✅ | No |
| `negRisk`, `minOrderSize`, `tickSize` | useOrderbookStore | Same | No | ✅ | No |
| `orders` (StoreOrder[]) | useOrdersStore | **Optimize** — TQ initial + WS overlay | No | ✅ | **Yes** |
| `recentlyFilledOrders` (Map) | useOrdersStore | Same | No | ✅ | No |
| `positions` (LocalPosition[]) | usePositionsStore | **Optimize** — TQ initial + WS overlay | No | ✅ | **Yes** |
| `tradeHistory` (TradeRecord[]) | usePositionsStore | Same | No | ✅ | No |
| `entries` (pending balance deltas) | usePendingBalanceDeltasStore | **Remove** → `useMutationState` | No | ✅ | **Yes** |
| `byKey` (pending position tokens) | usePendingPositionTokensStore | Same (evaluate later) | sessionStorage | ✅ | No |
| `byWallet` (bridge activity) | useBridgeActivityStore | Same | localStorage | ✅ | No |
| `trades`, `ownerUserId` (tracker feed) | useWalletTrackerLiveFeedStore | Same | sessionStorage v1 | ✅ | No |

---

## 2. Per-Store Analysis

### Store 1: useWalletStore

- **File:** `apps/web/src/shared/stores/wallet.ts`
- **Persistence:** localStorage (`wallet-storage`)
- **Consumers:** 55 files (204 matches)
- **V2 Decision:** **Optimize** — remove auth/session fields, keep wallet-connection fields

**State shape:**

```ts
interface WalletState {
  address: string | null;           // KEEP — wallet connection
  authMethod: "email" | "wallet" | null; // KEEP — needed for UI branching
  chainId: number | null;           // KEEP — wallet connection
  email: string | null;             // REMOVE → session query
  funderAddress: string | null;     // KEEP — trading address
  hasCredentials: boolean;          // REMOVE → session query
  isConnected: boolean;             // KEEP — wallet connection
  onboardingCompleted: boolean;     // REMOVE → session query
  safeAddress: string | null;       // REMOVE → session query
  sessionToken: string | null;      // REMOVE → HttpOnly cookie
  signatureType: SignatureType;     // KEEP — order signing
  userId: string | null;            // REMOVE → session query
}
```

**Top consumers (by import count):**

| File | Reads |
|------|-------|
| `shared/components/session-cookie-sync.tsx` | sessionToken, userId, address |
| `features/auth/components/onboarding/*` | onboardingCompleted, safeAddress, hasCredentials |
| `features/auth/components/user-menu.tsx` | email, address, authMethod |
| `features/auth/components/auth-guard.tsx` | isConnected, sessionToken, onboardingCompleted |
| `features/trading/hooks/use-user-channel.ts` | address, funderAddress, sessionToken |
| `features/trading/hooks/use-trading-init.ts` | address, funderAddress, signatureType |
| `layout/header-wallet-balance.tsx` | address, funderAddress |
| `features/trading/components/orders/order-form.hooks.ts` | address, funderAddress, signatureType |

**Migration steps:**

1. Create `useSessionQuery` (TQ) — returns `{ userId, email, safeAddress, hasCredentials, onboardingCompleted }`
2. Remove those 6 fields from `WalletState` and `partialize`
3. Remove `setAuthSession` / `clearAuthSession` — session lifecycle moves to TQ + cookie
4. Keep `setConnected` / `setDisconnected` for wallet-connection-only state
5. Update 55 consumer files to read session fields from `useSessionQuery` instead
6. See **03-session-model.md** for full session migration plan

---

### Store 2: useWorkspaceLayoutStore

- **File:** `apps/web/src/features/trading/stores/workspace-layout.ts`
- **Persistence:** localStorage (`workspace-layout`, version 5)
- **Consumers:** 6 files
- **V2 Decision:** **Keep as-is**

**State shape:**

```ts
interface WorkspaceLayoutState {
  panelOrder: "default" | "swapped";
  orderbookWidthPct: number;        // 17–26%, default 21.3
  chartHeight: number;              // 30–95%, default 65
  activeTab: string;                // "Positions" default
  chartInterval: IntervalValue;     // "max" default
  chartType: ChartDisplayType;      // "line" | "candle"
  allMarketsMode: boolean;
  visibleMarketIds: string[];
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `features/trading/components/trading-layout-terminal.tsx` | chartHeight, orderbookWidthPct, panelOrder |
| `features/trading/components/trading-selector-card.tsx` | allMarketsMode, visibleMarketIds |
| `features/trading/components/charts/polymarket-kline-chart.tsx` | chartInterval, chartType |
| `features/trading/components/market/market-header-trading.tsx` | allMarketsMode |
| `features/trading/components/market/market-tabs.tsx` | activeTab |
| `app/(trading)/market/[slug]/market-terminal-shell.tsx` | chartHeight (CSS var sync) |

No migration needed. Pure client-UI preferences.

---

### Store 3: useDockLayoutStore

- **File:** `apps/web/src/layout/stores/dock-layout.ts`
- **Persistence:** localStorage (`doji-dock-layout-storage`, version 3, skipHydration)
- **Consumers:** 9 files
- **V2 Decision:** **Keep as-is**

**State shape:**

```ts
interface DockLayoutState {
  leftSlot: DockableWidgetId | null;
  rightSlot: DockableWidgetId | null;
  widths: Record<DockableWidgetId, number>;
  widthRatios: Record<DockableWidgetId, number>;
}
// DockableWidgetId = "wallet-tracker" | "activity" | "watchlist" | "portfolio"
```

**Consumers:**

| File | Reads |
|------|-------|
| `layout/dock-shell.tsx` | leftSlot, rightSlot, widths |
| `layout/dock-slot.tsx` | widths |
| `layout/dock-resize-handle.tsx` | setWidth |
| `layout/widgets/widget-dock-controls.tsx` | leftSlot, rightSlot, dockWidget, undockWidget |
| `layout/bottom-bar.tsx` | leftSlot, rightSlot |
| `layout/trading-settings-widget.tsx` | leftSlot, rightSlot |

No migration needed. Uses `skipHydration` pattern — rehydrates in `useEffect` to avoid SSR mismatch.

---

### Store 4: useNotificationsStore

- **File:** `apps/web/src/shared/stores/notifications.ts`
- **Persistence:** localStorage (`doji-notifications-storage`)
- **Consumers:** 5 files
- **V2 Decision:** **Keep as-is**

**State shape:**

```ts
interface NotificationPreferences {
  displayToasts: boolean;       // default: true
  soundEnabled: boolean;        // default: false
  soundName: NotificationSound; // default: "ding"
  soundVolume: number;          // default: 50 (0–100)
  toastPosition: ToastPosition; // default: "bottom-right"
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `shared/components/ui/sonner.tsx` | toastPosition |
| `shared/lib/notification-sound.ts` | soundEnabled, soundName, soundVolume |
| `shared/lib/app-toast.ts` | displayToasts |
| `layout/trading-settings-widget.tsx` | all preferences (settings UI) |
| `layout/notifications-bell.tsx` | preferences |

No migration needed.

---

### Store 5: useOrderFormStore

- **File:** `apps/web/src/features/trading/stores/order-form.ts`
- **Persistence:** localStorage (`order-form-storage`)
- **Consumers:** 1 file (order-form.hooks.ts — 13 matches)
- **V2 Decision:** **Keep as-is**

**State shape:**

```ts
interface OrderFormState {
  side: "BUY" | "SELL";
  orderType: "market" | "limit" | "split" | "merge";
  size: string;
  price: string;
  limitExpiration: LimitExpiration; // "GTC" | "5m" | "1h" | "12h" | "24h" | "EOD" | "custom"
  postOnly: boolean;
}
```

**Consumer:**

| File | Reads |
|------|-------|
| `features/trading/components/orders/order-form.hooks.ts` | All fields (form state) |

No migration needed. Single-consumer, pure UI state.

---

### Store 6: useBalancesHiddenStore

- **File:** `apps/web/src/shared/stores/balances-hidden.ts`
- **Persistence:** localStorage (`balances-hidden`)
- **Consumers:** 2 files
- **V2 Decision:** **Keep as-is**

**State shape:**

```ts
interface BalancesHiddenState {
  balancesHidden: boolean; // default: false
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `layout/header-wallet-balance.tsx` | balancesHidden |
| `features/portfolio/components/portfolio-top-cards.tsx` | balancesHidden |

No migration needed.

---

### Store 7: useWalletTrackerSoundStore

- **File:** `apps/web/src/features/wallet-tracker/stores/wallet-tracker-sound.ts`
- **Persistence:** localStorage (`doji-wallet-tracker-sound`)
- **Consumers:** 2 files
- **V2 Decision:** **Keep as-is**

**State shape:**

```ts
interface WalletTrackerSoundState {
  enabled: boolean;              // default: false
  soundName: NotificationSound;  // default: "coin"
  volume: number;                // default: 70 (0–100)
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `features/wallet-tracker/components/wallet-tracker-sound-controls.tsx` | all fields |
| `features/wallet-tracker/components/wallet-tracker-loading-skeleton.tsx` | enabled |

No migration needed.

---

### Store 8: useCashBalancePulseStore

- **File:** `apps/web/src/features/trading/stores/cash-balance-pulse.ts`
- **Persistence:** None (in-memory)
- **Consumers:** 4 files
- **V2 Decision:** **Remove** → replace with `useMutationState` (TQ v5)

**State shape:**

```ts
interface CashBalancePulseState {
  staleAt: number; // 0 = not stale; auto-clears after 15s
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `features/trading/hooks/use-cash-balance-pulse.ts` | staleAt (derives `isPulsing`) |
| `shared/lib/trpc/index.ts` | markStale (called in `invalidatePostTradeQueriesWithRetry`) |
| `features/trading/hooks/use-split-merge.ts` | markStale |
| `features/trading/components/market/instant-trade-popup.tsx` | (indirect via invalidation) |

**Migration plan:**

Replace with `useMutationState` from TanStack Query v5. Trade mutations already go through TQ — derive "is any trade mutation pending?" from mutation state instead of a separate store.

```ts
// V2 replacement
const isPulsing = useMutationState({
  filters: { mutationKey: ["trade"], status: "pending" },
  select: (m) => m.state.status === "pending",
}).some(Boolean);
```

---

### Store 9: useScoreboardWidgetStore

- **File:** `apps/web/src/features/trading/stores/scoreboard-widget.ts`
- **Persistence:** None (in-memory)
- **Consumers:** 3 files
- **V2 Decision:** **Keep as-is**

**State shape:**

```ts
interface ScoreboardWidgetState {
  gameId: string | null;
  isOpen: boolean;
  position: { x: number; y: number }; // default: { x: 100, y: 100 }
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `features/trading/components/market/scoreboard-widget.tsx` | all fields |
| `features/trading/components/market/live-pill.tsx` | open (action) |
| `features/trading/components/market/market-header-trading.tsx` | open (action) |

No migration needed. Pure ephemeral UI state.

---

### Store 10: useConnectionStore

- **File:** `apps/web/src/shared/stores/connection.ts`
- **Persistence:** None (in-memory)
- **Consumers:** 4 files
- **V2 Decision:** **Keep as-is**

**State shape:**

```ts
interface ConnectionState {
  status: Map<string, ConnectionStatus>;       // "disconnected" | "connecting" | "connected" | "error"
  errors: Map<string, string>;
  lastConnected: Map<string, number>;
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `shared/lib/websocket/market-channel.ts` | setStatus, setError, markConnected |
| `shared/lib/websocket/user-channel.ts` | setStatus, setError, markConnected |
| `shared/lib/websocket/sports-channel.ts` | setStatus, setError, markConnected |
| `shared/lib/websocket/rtds.ts` | setStatus, setError, markConnected |

No migration needed. Internal WS infrastructure state.

---

### Store 11: useOrderbookStore (Hybrid)

- **File:** `apps/web/src/features/trading/stores/orderbook.ts`
- **Persistence:** None (in-memory)
- **Consumers:** 8 files (41 matches)
- **V2 Decision:** **Optimize** — REST snapshot via TQ, WS deltas stay in Zustand

**State shape:**

```ts
interface OrderbookState extends TokenBook {
  books: Record<string, TokenBook>;  // Multi-token cache
  tokenId: string | null;
  orderbookClickPrefill: { price: number; tokenId: string } | null;
  preferredOrderSide: "BUY" | "SELL" | null;
  wsLiveTokens: Set<string>;
}

interface TokenBook {
  bids: OrderLevel[];
  asks: OrderLevel[];
  spread: number;
  midpoint: number;
  bestBid: number;
  bestAsk: number;
  displayPrice: number;
  lastTradePrice: number;
  lastTradeSide: "BUY" | "SELL" | null;
  negRisk: boolean | null;
  minOrderSize: number | null;
  tickSize: number | null;
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `features/trading/hooks/use-orderbook.ts` | All book fields (21 matches — main orchestrator) |
| `features/trading/components/market/market-trading-context.tsx` | tokenId, books, displayPrice |
| `features/trading/components/orders/order-form.hooks.ts` | bestBid, bestAsk, orderbookClickPrefill, preferredOrderSide |
| `features/trading/components/trading-layout-terminal.tsx` | tokenId, reset |
| `features/trading/components/market/quick-sell-modal.tsx` | bestBid, bestAsk |
| `features/trading/components/market/instant-trade-popup.tsx` | bestBid, bestAsk |
| `features/trading/components/trading-layout.tsx` | tokenId |
| `features/trading/components/orderbook.tsx` | bids, asks, spread, orderbookClickPrefill |

**Why Zustand stays for orderbook:**

Orderbook receives 10–50+ WS price_change events/second. TanStack Query's `setQueryData` would trigger structural sharing on every update — too expensive. Zustand's direct `set()` with module-level `bookHash` dedup is the correct pattern for high-frequency streaming data.

**V2 optimization:**

1. Initial REST snapshot fetched via `trpc.markets.orderbook` → TQ cache (staleTime: STALE_REALTIME)
2. On TQ success, call `useOrderbookStore.getState().setBookForToken(tokenId, bids, asks)`
3. WS `book` and `price_change` events continue updating Zustand directly
4. `wsLiveTokens` Set distinguishes "has WS data" from "REST-only stale snapshot"

---

### Store 12: useOrdersStore (Hybrid)

- **File:** `apps/web/src/features/trading/stores/orders.ts`
- **Persistence:** None (in-memory)
- **Consumers:** 12 files (42 matches)
- **V2 Decision:** **Optimize** — TQ for initial hydration, WS overlay in Zustand

**State shape:**

```ts
interface OrdersState {
  orders: StoreOrder[];  // Open/partially-filled orders
  recentlyFilledOrders: Map<string, RecentlyFilledEntry>; // 15s TTL cache
}

interface StoreOrder extends OpenOrder {
  derivedStatus: OrderStatus; // State machine: PENDING → OPEN → PARTIALLY_FILLED → FILLED/CANCELLED
}

interface RecentlyFilledEntry {
  side: "BUY" | "SELL";
  asset_id: string;
  price: string;
  outcome: string;
  expiresAt: number;
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `features/trading/hooks/use-user-channel.ts` | addOrder, updateOrder, removeOrder (12 matches — WS handler) |
| `features/trading/components/orders/open-orders.tsx` | orders (display) |
| `features/trading/components/market/tabs/orders-tab.tsx` | orders (filtered by market) |
| `features/trading/components/orderbook.tsx` | orders (highlight user's price levels) |
| `features/trading/components/market/market-tabs.tsx` | orders.length (tab badge) |
| `features/trading/components/trading-layout-terminal.tsx` | orders (tab count) |
| `features/trading/components/trading-layout.tsx` | orders (tab count) |
| `features/auth/components/auth-guard.tsx` | clearAll (logout) |
| `features/auth/components/user-menu.tsx` | clearAll (logout) |
| `features/auth/lib/magic/auth.ts` | clearAll (logout) |
| `shared/lib/session-manager.ts` | hydrateFromApi, clearAll |
| `layout/widgets/portfolio-widget-content.tsx` | orders (widget display) |

**V2 optimization:**

1. Initial load: `trpc.clob.getOpenOrdersWithMarkets` → TQ cache
2. On TQ success: `useOrdersStore.getState().hydrateFromApi(data.orders)`
3. WS user channel events (`PLACEMENT`, `TRADE`, `CANCELLATION`) update Zustand via state machine
4. `recentlyFilledOrders` stays in Zustand (15s TTL, not worth TQ overhead)
5. On reconnect: re-fetch via TQ invalidation, re-hydrate store

---

### Store 13: usePositionsStore (Hybrid)

- **File:** `apps/web/src/features/trading/stores/positions.ts`
- **Persistence:** None (in-memory)
- **Consumers:** 11 files (23 matches)
- **V2 Decision:** **Optimize** — TQ for initial hydration, WS trade events build local overlay

**State shape:**

```ts
interface PositionsState {
  positions: LocalPosition[];    // Built from WS trade events
  tradeHistory: TradeRecord[];   // Append-only trade log
}

interface LocalPosition {
  asset: string;
  conditionId: string;
  size: number;
  curPrice: number;
  avgCost?: number;
  outcome: string;
}

interface TradeRecord {
  id: string;
  asset_id: string;
  market: string;
  side: "BUY" | "SELL";
  size: string;
  price: string;
  status: string;
  timestamp: number;
  outcome?: string;
  txHash?: string;
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `features/trading/hooks/use-user-channel.ts` | applyTrade (WS handler) |
| `features/auth/components/auth-guard.tsx` | clearAll (logout) |
| `features/auth/components/user-menu.tsx` | clearAll (logout) |
| `features/auth/lib/magic/auth.ts` | clearAll (logout) |
| `shared/lib/session-manager.ts` | clearAll |
| `features/portfolio/hooks/use-merged-market-positions.ts` | positions (merge with API data) |
| `features/portfolio/components/position-table.tsx` | positions (display) |
| `features/trading/hooks/use-optimistic-token-balance.ts` | positions (balance calc) |
| `features/trading/components/charts/use-trade-markers.ts` | tradeHistory (chart markers) |
| `app/portfolio/use-portfolio-data.ts` | positions |
| `layout/widgets/portfolio-widget-content.tsx` | positions |

**V2 optimization:**

1. Initial load: `trpc.data.positions` → TQ cache (server positions)
2. WS trade events continue building `LocalPosition[]` overlay in Zustand
3. `use-merged-market-positions.ts` merges TQ server positions + Zustand local overlay
4. `tradeHistory` stays in Zustand (append-only session log, not server data)

---

### Store 14: usePendingBalanceDeltasStore (Hybrid)

- **File:** `apps/web/src/features/trading/stores/pending-balance-deltas.ts`
- **Persistence:** None (in-memory)
- **Consumers:** 9 files (42 matches including helper exports)
- **V2 Decision:** **Remove** → replace with `useMutationState` (TQ v5)

**State shape:**

```ts
interface PendingEntry {
  delta: number;
  baseline: number;  // Server balance snapshot at delta creation
  clearAt: number;   // Auto-clear after 18s
}

// entries: Map<`${address}:${tokenId}`, PendingEntry>
```

**Consumers:**

| File | Reads |
|------|-------|
| `features/trading/hooks/use-optimistic-token-balance.ts` | useEffectiveBalance (5 matches) |
| `features/trading/lib/merge-market-positions.ts` | getEffectiveBalance (4 matches) |
| `features/portfolio/components/position-table.tsx` | useEffectiveBalance (6 matches) |
| `features/portfolio/hooks/use-merged-market-positions.ts` | getEffectiveBalance |
| `features/trading/hooks/use-user-channel.ts` | addDelta (on trade fill) |
| `features/auth/components/auth-guard.tsx` | clearAll (logout) |
| `features/auth/components/user-menu.tsx` | clearAll (logout) |
| `features/auth/lib/magic/auth.ts` | clearAll (logout) |
| `shared/lib/session-manager.ts` | clearAll |

**Migration plan:**

The baseline+delta anti-double-counting pattern is complex. Two options:

**Option A (recommended):** Keep the store but simplify. The `getEffectiveBalance` logic with baseline snapshots is battle-tested. Removing it risks balance flash regressions. Instead, simplify the API surface and ensure it integrates cleanly with TQ's `onMutate` / `onSettled` optimistic update pattern.

**Option B:** Replace with TQ `useMutationState` + optimistic updates in `onMutate`. This is cleaner architecturally but requires reimplementing the baseline anti-double-counting logic inside TQ's optimistic update callbacks. Higher risk.

**Decision:** Option A for V2 launch. Revisit Option B post-launch.

---

### Store 15: usePendingPositionTokensStore (Hybrid)

- **File:** `apps/web/src/features/trading/stores/pending-position-tokens.ts`
- **Persistence:** sessionStorage (`doji-pending-position-tokens`)
- **Consumers:** 6 files (19 matches)
- **V2 Decision:** **Keep as-is** (evaluate post-launch)

**State shape:**

```ts
// byKey: Record<`${address}:${tokenId}`, StoredFill>
interface StoredFill {
  expiresAt: number;    // 24h TTL
  fillPrice: number;
  conditionId: string;
  outcome: string;
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `features/portfolio/components/position-table.tsx` | selectPendingFillsForAddress (6 matches) |
| `features/trading/hooks/use-user-channel.ts` | rememberBuyFill (on trade fill) |
| `features/auth/components/auth-guard.tsx` | clearAll (logout) |
| `features/auth/components/user-menu.tsx` | clearAll (logout) |
| `features/auth/lib/magic/auth.ts` | clearAll (logout) |
| `shared/lib/session-manager.ts` | clearAll |

**Rationale for keeping:** Bridges the gap between a confirmed BUY fill and the Data API listing the position. The 24h TTL and sessionStorage persistence are correct for this use case — the Data API can lag minutes to hours. No TQ equivalent exists for this "remember until server catches up" pattern.

---

### Store 16: useBridgeActivityStore (Hybrid)

- **File:** `apps/web/src/features/bridge/stores/bridge-activity.ts`
- **Persistence:** localStorage (`doji-bridge-activity`)
- **Consumers:** 2 files
- **V2 Decision:** **Keep as-is**

**State shape:**

```ts
// byWallet: Record<string, BridgeActivityEntry[]>  (max 50 per wallet)
interface BridgeActivityEntry {
  type: "DEPOSIT" | "WITHDRAW";
  fromAmountBaseUnit: string;
  timestamp: number;
  txHash?: string;
  createdTimeMs?: number;
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `features/bridge/components/withdraw-status-view.tsx` | addCompleted |
| `features/bridge/components/deposit-notification-card.tsx` | addCompleted |

No migration needed. Client-side activity log for bridge operations that may not appear in the API.

---

### Store 17: useWalletTrackerLiveFeedStore (Hybrid)

- **File:** `apps/web/src/features/wallet-tracker/stores/wallet-tracker-live-feed-store.ts`
- **Persistence:** sessionStorage (`doji-wallet-tracker-live-feed`, version 1)
- **Consumers:** 2 files (+ subscriber component)
- **V2 Decision:** **Keep as-is**

**State shape:**

```ts
interface WalletTrackerLiveFeedState {
  trades: WalletTrackerLiveTrade[];  // max 100, RTDS streaming buffer
  ownerUserId: string | null;
}
```

**Consumers:**

| File | Reads |
|------|-------|
| `features/wallet-tracker/components/wallet-tracker-live-feed-subscriber.tsx` | prependTrades, filterToTrackedAddresses (10 matches) |
| `features/wallet-tracker/hooks/use-wallet-tracker-live-trades.ts` | trades |
| `features/wallet-tracker/components/wallet-tracker-content.tsx` | trades |

No migration needed. RTDS streaming buffer with sessionStorage persistence for tab-scoped data.

---

## 3. Hybrid Store Optimization Plan

The "TQ for fetch, Zustand for streaming" pattern applies to stores 11–13. The key principle: **TanStack Query owns the initial data fetch and cache lifecycle; Zustand owns high-frequency streaming updates.**

### Pattern: Orderbook (Store 11)

```
┌─────────────┐     REST snapshot      ┌──────────────────┐
│  TQ Cache    │ ◄──────────────────── │ trpc.markets.     │
│  (staleTime: │     on mount/refocus   │   orderbook       │
│   REALTIME)  │                        └──────────────────┘
└──────┬───────┘
       │ onSuccess → setBookForToken()
       ▼
┌──────────────┐     WS price_change    ┌──────────────────┐
│  Zustand     │ ◄──────────────────── │ market-channel.ts │
│  orderbook   │     10–50+ events/sec  │   (WebSocket)     │
│  store       │                        └──────────────────┘
└──────────────┘
```

- **TQ role:** Fetch REST snapshot on mount, refocus, reconnect. `staleTime: STALE_REALTIME` (10s).
- **Zustand role:** Apply WS `book`, `price_change`, `last_trade_price` events. Binary-search insert, dedup via `bookHash`.
- **Why not TQ for streaming:** 10–50+ events/sec × structural sharing = too expensive. Zustand's `set()` is O(1) for the store update.

### Pattern: Orders (Store 12)

```
┌─────────────┐     REST open orders    ┌──────────────────┐
│  TQ Cache    │ ◄──────────────────── │ trpc.clob.        │
│  (staleTime: │     on mount/refocus   │   getOpenOrders   │
│   DEFAULT)   │                        └──────────────────┘
└──────┬───────┘
       │ onSuccess → hydrateFromApi()
       ▼
┌──────────────┐     WS user events     ┌──────────────────┐
│  Zustand     │ ◄──────────────────── │ user-channel.ts   │
│  orders      │     PLACEMENT/TRADE/   │   (WebSocket)     │
│  store       │     CANCELLATION       └──────────────────┘
└──────────────┘
```

- **TQ role:** Fetch open orders on mount, refocus, reconnect. `staleTime: STALE_DEFAULT` (30s).
- **Zustand role:** Apply WS user channel events via state machine (PENDING → OPEN → PARTIALLY_FILLED → FILLED/CANCELLED). `recentlyFilledOrders` cache (15s TTL) for side resolution.
- **Reconnect:** TQ invalidation triggers re-fetch → `hydrateFromApi()` resets Zustand to server truth.

### Pattern: Positions (Store 13)

```
┌─────────────┐     REST positions      ┌──────────────────┐
│  TQ Cache    │ ◄──────────────────── │ trpc.data.        │
│  (staleTime: │     on mount/refocus   │   positions       │
│   DEFAULT)   │                        └──────────────────┘
└──────┬───────┘
       │ read by use-merged-market-positions.ts
       ▼
┌──────────────┐     WS trade events    ┌──────────────────┐
│  Zustand     │ ◄──────────────────── │ user-channel.ts   │
│  positions   │     applyTrade()       │   (WebSocket)     │
│  store       │                        └──────────────────┘
└──────┬───────┘
       │ merged in use-merged-market-positions.ts
       ▼
┌──────────────┐
│  Merged view │  TQ server positions + Zustand local overlay
└──────────────┘
```

- **TQ role:** Fetch server positions (Data API). `staleTime: STALE_DEFAULT` (30s).
- **Zustand role:** Build `LocalPosition[]` from WS trade events. Tracks `avgCost`, `curPrice`, `size` changes in real-time.
- **Merge layer:** `use-merged-market-positions.ts` combines both sources. Server positions are the baseline; Zustand overlay provides instant updates before the Data API indexes.

---

## 4. Stores Being Removed or Replaced

### 4a. Auth Fields from useWalletStore

**Fields removed:** `sessionToken`, `userId`, `email`, `safeAddress`, `hasCredentials`, `onboardingCompleted`

**Replaced by:** `useSessionQuery` (TanStack Query) backed by HttpOnly cookie.

**Full plan:** See **03-session-model.md**.

### 4b. useCashBalancePulseStore → useMutationState

**Current:** Separate store with `staleAt` timestamp, `markStale()` called after trade, auto-clears 15s.

**V2:** Derive from TQ mutation state:

```ts
// In use-cash-balance-pulse.ts (V2)
import { useMutationState } from "@tanstack/react-query";

export function useCashBalancePulse(): boolean {
  const pendingTrades = useMutationState({
    filters: { mutationKey: ["trade"], status: "pending" },
    select: (m) => m.state.status,
  });
  return pendingTrades.length > 0;
}
```

**Migration:** 4 consumer files. Low risk — the pulse is purely cosmetic.

### 4c. usePendingBalanceDeltasStore — Keep (Revised)

**Original plan:** Remove → `useMutationState`.

**Revised decision:** **Keep** the store. The baseline anti-double-counting logic (`getEffectiveBalance`) is non-trivial and battle-tested. Reimplementing it in TQ optimistic updates is high-risk for a cosmetic improvement. Simplify the API surface instead:

- Remove `prune()` from public API (make internal)
- Remove `getDelta()` (consumers use `getEffectiveBalance` or `useEffectiveBalance`)
- Keep `addDelta()`, `clearAll()`, `getEntry()`

---

## 5. Post-Trade Invalidation

### Current State

Post-trade invalidation is handled by `invalidatePostTradeQueriesWithRetry()` in `shared/lib/trpc/index.ts`. It fires immediately + at 3s, 8s, 15s, 30s delays to catch slow Data API indexing.

**Call sites (6):**

| File | Trigger |
|------|---------|
| `features/trading/components/orders/order-form.hooks.ts` | After order placement (2 calls) |
| `features/trading/components/market/instant-trade-popup.tsx` | After instant trade (2 calls) |
| `features/trading/components/market/quick-sell-modal.tsx` | After quick sell |
| `features/trading/lib/execute-redeem-groups.ts` | After redeem |

**Queries invalidated per call:**

| Query Key | Scope | Why |
|-----------|-------|-----|
| `trpc.data.positions` | Always | Position sizes change |
| `trpc.data.ctfTokenBalances` | Always | Token balances change |
| `trpc.data.value` | Always | Portfolio value changes |
| `trpc.clob.getBalanceAllowance` | Always | Available balance changes |
| `trpc.data.activity` | Always | New activity entry |
| `trpc.data.activityWithMarkets` | Always | New activity with market data |
| `trpc.data.trades` | Always | New trade record |
| `trpc.clob.getOpenOrdersWithMarkets` | Always | Order may be filled/cancelled |
| `trpc.data.closedPositions` | Post-trade only | Position may have closed |
| `trpc.data.usdcBalance` | Post-trade only | USDC balance changes |

**Additional invalidation in `use-split-merge.ts`:**

Same delay schedule (3s/8s/15s/30s) but calls `invalidateRealtimeQueries` directly with custom scope (includes positions, ctfBalances, value, balanceAllowance).

### V2 Plan: Unified `usePostTradeInvalidation` Hook

```ts
// apps/web/src/shared/hooks/use-post-trade-invalidation.ts
export function usePostTradeInvalidation() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    // 1. Mark cash balance as stale (or use useMutationState in V2)
    useCashBalancePulseStore.getState().markStale();

    // 2. Immediate invalidation
    invalidateRealtimeQueries(queryClient, POST_TRADE_SCOPE);

    // 3. Delayed retries for slow Data API indexing
    for (const delay of QUERY_POST_TRADE_INVALIDATION_DELAYS_MS) {
      setTimeout(() => {
        invalidateRealtimeQueries(queryClient, POST_TRADE_SCOPE);
      }, delay);
    }
  }, [queryClient]);
}
```

**Changes from current:**

1. Wrap in a hook (currently a bare function that takes `QueryClient`)
2. Single import point for all 6 call sites
3. Future: integrate with TQ mutation `onSettled` callbacks instead of manual calls

---

## 6. TanStack Query Configuration

### staleTime Tiers

Defined in `apps/web/src/shared/constants/query.ts`:

| Tier | Value | Use Case |
|------|-------|----------|
| `STALE_REALTIME` | 10s | Orderbook, prices, live trades |
| `STALE_DEFAULT` | 30s | General data (positions, orders, activity) |
| `STALE_STABLE` | 5min | Profile, leaderboard, tags, categories, related markets |
| `STALE_STATIC` | 30min | Feature flags, chain config, rarely-changing reference data |

### gcTime Tiers (V2 — to be added)

```ts
// apps/web/src/shared/constants/query.ts (V2 additions)

/** 2 min — orderbook, prices. Short-lived, high-frequency. */
export const GC_REALTIME = 120_000;

/** 5 min — general data. Default for most queries. */
export const GC_DEFAULT = 300_000;

/** 30 min — profile, leaderboard. Infrequently accessed. */
export const GC_STABLE = 1_800_000;

/** 2 hours — reference data. Rarely changes. */
export const GC_STATIC = 7_200_000;
```

### Rule: gcTime ≥ staleTime (always)

| Tier | staleTime | gcTime | Ratio |
|------|-----------|--------|-------|
| REALTIME | 10s | 2min | 12× |
| DEFAULT | 30s | 5min | 10× |
| STABLE | 5min | 30min | 6× |
| STATIC | 30min | 2h | 4× |

**Why:** `gcTime` controls how long inactive query data stays in memory. If `gcTime < staleTime`, data is garbage-collected before it goes stale — meaning every re-mount triggers a fresh fetch even though the data was still "fresh." The ratio decreases for longer-lived data because the cost of a re-fetch is lower relative to the cache duration.

### QueryClient Defaults (V2)

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_DEFAULT,
      gcTime: GC_DEFAULT,
      refetchOnWindowFocus: true,
      retry: 1,
    },
    mutations: {
      retry: 0,
    },
    dehydrate: {
      shouldDehydrateQuery: (query) =>
        defaultShouldDehydrateQuery(query) || query.state.status === "pending",
    },
  },
});
```

---

## 7. Selector Best Practices

### Atomic Picks (Reference-Stable)

```ts
// ✅ GOOD — single primitive pick, reference-stable
const address = useWalletStore((s) => s.address);
const isConnected = useWalletStore((s) => s.isConnected);

// ❌ BAD — new object every render, triggers re-render every time
const { address, isConnected } = useWalletStore((s) => ({
  address: s.address,
  isConnected: s.isConnected,
}));
```

### useShallow for Multi-Pick Objects

```ts
import { useShallow } from "zustand/react/shallow";

// ✅ GOOD — useShallow does shallow equality on the returned object
const { address, chainId, signatureType } = useWalletStore(
  useShallow((s) => ({
    address: s.address,
    chainId: s.chainId,
    signatureType: s.signatureType,
  }))
);
```

### Module-Level Selector Functions

```ts
// ✅ GOOD — defined outside component, referentially stable
const selectBestBidAsk = (s: OrderbookState) => ({
  bestBid: s.bestBid,
  bestAsk: s.bestAsk,
});

function OrderFormPrice() {
  const { bestBid, bestAsk } = useOrderbookStore(useShallow(selectBestBidAsk));
  // ...
}

// ✅ GOOD — derived value selector at module level
const selectSpreadPct = (s: OrderbookState): number => {
  if (s.midpoint === 0) return 0;
  return (s.spread / s.midpoint) * 100;
};

function SpreadDisplay() {
  const spreadPct = useOrderbookStore(selectSpreadPct);
  // ...
}
```

### Never Inline Object/Array Creation

```ts
// ❌ BAD — new array every render
const orders = useOrdersStore((s) => s.orders.filter((o) => o.market === marketId));

// ✅ GOOD — stable empty array constant + useMemo for derived
import { useMemo } from "react";

const allOrders = useOrdersStore((s) => s.orders);
const marketOrders = useMemo(
  () => allOrders.filter((o) => o.market === marketId),
  [allOrders, marketId]
);
```

### Stable Empty Constants

```ts
// Used in pending-balance-deltas.ts
export const EMPTY_PENDING_DELTA_SLICE: readonly number[] = [];

// Used in bridge-activity.ts
const EMPTY_ENTRIES: BridgeActivityEntry[] = [];
```

Return these from selectors when the result is empty to avoid creating new array references.

### Action-Only Subscriptions

```ts
// ✅ GOOD — subscribe to actions only (no state, no re-renders)
const markStale = useCashBalancePulseStore((s) => s.markStale);
const addDelta = usePendingBalanceDeltasStore((s) => s.addDelta);

// ✅ ALSO GOOD — getState() for fire-and-forget (no subscription at all)
useCashBalancePulseStore.getState().markStale();
```

---

## Summary: Migration Priority

| Priority | Store | Action | Risk | Effort |
|----------|-------|--------|------|--------|
| **P0** | useWalletStore | Remove auth fields → session query | High | Large (55 files) |
| **P1** | useOrdersStore | Add TQ initial hydration | Medium | Medium |
| **P1** | usePositionsStore | Add TQ initial hydration | Medium | Medium |
| **P2** | useOrderbookStore | Add TQ REST snapshot | Low | Small |
| **P2** | useCashBalancePulseStore | Replace with `useMutationState` | Low | Small (4 files) |
| **P3** | usePendingBalanceDeltasStore | Simplify API surface | Low | Small |
| **—** | All other stores (11) | Keep as-is | None | None |
