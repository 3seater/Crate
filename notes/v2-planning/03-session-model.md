# 03 — Session Model Migration

> **Status:** Planning  
> **Impact:** High — touches 54 files across every domain  
> **Estimated effort:** ~1 week (10 steps, incremental)

Migrate auth state from localStorage-persisted Zustand (`useWalletStore`) to TanStack Query backed by the server JWT cookie. This is the single most impactful change in V2: it eliminates the client-as-source-of-truth anti-pattern, removes the `SessionCookieSync` side-effect component, and makes auth state automatically consistent with the server.

---

## Table of Contents

1. [Current State](#1-current-state)
2. [Target Architecture](#2-target-architecture)
3. [Session Type](#3-session-type)
4. [Migration Steps](#4-migration-steps) (includes file-by-file patterns per step)
5. [Login Flow Changes](#6-login-flow-changes)
6. [Logout Flow Changes](#7-logout-flow-changes)
7. [Rollback Plan](#8-rollback-plan)
8. [Verification Checklist](#9-verification-checklist)
9. [Timeline](#10-timeline)

---

## 1. Current State

### Wallet Store (`shared/stores/wallet.ts`)

Zustand store persisted to `localStorage` key `wallet-storage`. Mixes two concerns:

| Auth fields (server-owned) | Connection fields (client-owned) |
|---|---|
| `sessionToken: string \| null` | `address: string \| null` (EOA) |
| `userId: string \| null` | `chainId: number \| null` (NOT persisted) |
| `email: string \| null` | `isConnected: boolean` |
| `safeAddress: string \| null` | `signatureType: 0 \| 1 \| 2` |
| `funderAddress: string \| null` | |
| `hasCredentials: boolean` | |
| `onboardingCompleted: boolean` | |
| `authMethod: "email" \| "wallet" \| null` | |

The store also exposes actions: `setAuthSession`, `clearAuthSession`, `setConnected`, `setDisconnected`, `setSafeAddress`, `setCredentialsStatus`, `setOnboardingCompleted`, `setAuthMethod`, `setSignatureType`, `setFunderAddress`.

### Consumer Count

**54 files** import `useWalletStore`. Top consumers by match density:

| File | Matches | Domain |
|------|---------|--------|
| `layout/notifications-bell.tsx` | 36 | Layout |
| `trading/hooks/use-clob-client.ts` | 26 | Trading |
| `auth/components/auth-guard.tsx` | 23 | Auth |
| `shared/stores/wallet.ts` | 22 | Shared (definition) |
| `trading/components/market/instant-trade-popup.tsx` | 20 | Trading |
| `shared/components/session-cookie-sync.tsx` | 19 | Shared |
| `auth/lib/magic/auth.ts` | 19 | Auth |
| `auth/components/user-menu.tsx` | 17 | Auth |
| `auth/components/wallet-kit-login.tsx` | 15 | Auth |

By domain: Trading (14), Auth (10), Layout (8), Portfolio (4+), Bridge (3), Watchlist (2), Wallet tracker (3), Shared (3+), App routes (3).

### Session Cookie Sync (`shared/components/session-cookie-sync.tsx`)

Side-effect component rendered in root layout. Reads ALL auth fields from wallet store and syncs to:

1. **HttpOnly cookie** `x-session-token` via `POST /api/session` (route handler)
2. **Non-HttpOnly cookie** `x-portfolio-address` (same route handler)
3. **Sentry context** (`setUser`, `setTags`, `setContext`)

This is the core anti-pattern: the client writes auth state to localStorage, then a side-effect syncs it to cookies so the server can read it. The server already sets the JWT on login — the sync is redundant plumbing.

### Server-Side Cookie Reader (`shared/lib/trpc/server.ts`)

`getAuthenticatedServerTrpc()` reads `SESSION_COOKIE_NAME` (`x-session-token`) and `ADDRESS_COOKIE_NAME` (`x-portfolio-address`) from `next/headers` cookies for RSC tRPC calls. This stays unchanged — the cookie is the stable contract.

### `trpc.auth.me` Procedure

Already exists on the server (`apps/server/src/features/auth/router.ts`). Protected procedure that returns `AuthUser` from the JWT session:

```ts
// Server: auth/router.ts
me: protectedProcedure.query(async ({ ctx }) => {
  const user = await findUserById(db, ctx.session.userId);
  return toAuthUser(user); // → AuthUser
});
```

Currently used in 7 files: `auth-guard.tsx` (fetchQuery), `use-trading-init.ts` (useQuery), `use-clob-client.ts` (invalidateQueries), `use-user-channel.ts` (invalidateQueries), `leaderboard-your-ranking.tsx` (useQuery), `login-callback-page.tsx` (setQueryData), `shared/lib/trpc/index.ts` (invalidateQueries).

---

## 2. Target Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Server (Hono + tRPC)                  │
│                                                         │
│  login/walletLogin → Set-Cookie: x-session-token (JWT)  │
│  auth.me → Read JWT → Return Session                    │
│  logout → Clear cookie                                  │
└──────────────────────┬──────────────────────────────────┘
                       │ HttpOnly cookie (unchanged)
┌──────────────────────▼──────────────────────────────────┐
│                    Client (Next.js)                      │
│                                                         │
│  useSession() → useQuery(trpc.auth.me.queryOptions())   │
│    staleTime: STALE_STABLE (5min)                       │
│    retry: false                                         │
│    Returns: Session | null | undefined                  │
│      undefined = loading                                │
│      null = not authenticated                           │
│      Session = authenticated                            │
│                                                         │
│  Login: server sets cookie → setQueryData seeds cache   │
│  Logout: queryClient.clear() + server clears cookie     │
│                                                         │
│  Wallet store (reduced): address, chainId,              │
│    signatureType, isConnected (connection state only)   │
└─────────────────────────────────────────────────────────┘
```

**Ground truth:** HttpOnly JWT cookie (already exists, set by server on login).

**Client representation:** TanStack Query cache entry from `trpc.auth.me`. Single source of truth for all components.

**No more:** localStorage auth fields, `SessionCookieSync`, client-to-server cookie sync via `POST /api/session`.

---

## 3. Session Type

The `AuthUser` type already exists in `@doji/types` (`packages/types/src/auth.ts`):

```ts
// packages/types/src/auth.ts (existing)
export interface AuthUser {
  email: string;
  hasCredentials: boolean;
  id: string;
  safeAddress: string | null;
  walletAddress: string;
}
```

For the `useSession()` hook, we extend this with fields currently derived client-side:

```ts
// packages/types/src/auth.ts (V2 — extend AuthUser or create Session)
export interface Session {
  userId: string;
  email: string | null;
  address: string | null;       // EOA (walletAddress)
  safeAddress: string | null;
  hasCredentials: boolean;
  authMethod: "email" | "wallet";
  signatureType: SignatureType;
  funderAddress: string | null;
  onboardingCompleted: boolean;
}
```

**Server change required:** `auth.me` must return `authMethod`, `signatureType`, and `funderAddress`. These are currently only stored client-side. Options:

- **Option A (recommended):** Add `authMethod` column to users table. `signatureType` is always `2` (Gnosis Safe) for Doji users. `funderAddress` equals `safeAddress`. `onboardingCompleted` = `safeAddress != null && hasCredentials`.
- **Option B:** Derive all fields from existing data: `authMethod` from login route used, `signatureType` = `GNOSIS_SAFE` (constant), `funderAddress` = `safeAddress`, `onboardingCompleted` = `Boolean(safeAddress && hasCredentials)`.

Option B avoids a schema migration and is accurate for all current users. The `auth.me` response becomes:

```ts
// Server: toSessionUser(user, authMethod?)
{
  userId: user.id,
  email: user.email,
  address: user.walletAddress,
  safeAddress: user.safeAddress,
  hasCredentials: user.encryptedCreds !== null,
  authMethod: user.authMethod ?? "email",  // new column or JWT claim
  signatureType: SignatureType.GNOSIS_SAFE, // constant for all Doji users
  funderAddress: user.safeAddress,          // Safe is always the funder
  onboardingCompleted: Boolean(user.safeAddress && user.encryptedCreds),
}
```

---

## 4. Migration Steps

### Step 1: Create `useSession()` hook

**Additive — no breaking changes. Coexists with wallet store.**

File: `apps/web/src/shared/hooks/use-session.ts`

```ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { STALE_STABLE } from "@/shared/constants/query";
import { trpc } from "@/shared/lib/trpc";

export function useSession() {
  const { data, isPending, isError } = useQuery({
    ...trpc.auth.me.queryOptions(),
    staleTime: STALE_STABLE, // 5min
    retry: false,
  });

  return {
    session: data ?? null,   // Session | null
    isPending,               // true while loading
    isAuthenticated: data != null && !isError,
  };
}
```

**Convenience selectors** (avoid re-renders when only one field is needed):

```ts
export function useSessionField<K extends keyof Session>(field: K) {
  const { session } = useSession();
  return session?.[field] ?? null;
}
```

### Step 2: Seed query cache on login

After successful auth, immediately populate the TanStack Query cache so `useSession()` returns data without waiting for a network round-trip.

**Files to modify:**

#### `auth/lib/magic/auth.ts` — `loginWithEmail`, `handleWalletKitLogin`, `handleOAuthCallback`

Current pattern (all three functions):
```ts
// After server responds with AuthResult:
return {
  sessionToken: result.sessionToken,
  user: { id, email, walletAddress, safeAddress, hasCredentials },
};
// Caller then does: useWalletStore.getState().setAuthSession(...)
```

New pattern — add cache seeding inside each function:
```ts
import { queryClient, trpc } from "@/shared/lib/trpc";

// After server responds:
const session: Session = {
  userId: result.user.id,
  email: result.user.email,
  address: result.user.walletAddress,
  safeAddress: result.user.safeAddress,
  hasCredentials: result.user.hasCredentials,
  authMethod: "email", // or "wallet" for handleWalletKitLogin
  signatureType: SignatureType.GNOSIS_SAFE,
  funderAddress: result.user.safeAddress,
  onboardingCompleted: Boolean(result.user.safeAddress && result.user.hasCredentials),
};
queryClient.setQueryData(trpc.auth.me.queryKey(), session);
```

#### `app/login/callback/login-callback-page.tsx`

Already seeds the cache: `queryClient.setQueryData(trpc.auth.me.queryKey(), oauthUser)`. Update to use the full `Session` shape instead of `AuthUser`.

#### `auth/components/wallet-kit-login.tsx` — `connectWallet`

Current: calls `actions.setAuthSession(...)` after `handleWalletKitLogin`.
New: also call `queryClient.setQueryData(trpc.auth.me.queryKey(), session)`.

### Step 3: Migrate AuthGuard

File: `apps/web/src/features/auth/components/auth-guard.tsx` (23 matches)

**Current pattern:**
```ts
const sessionToken = useWalletStore((s) => s.sessionToken);
const authMethod = useWalletStore((s) => s.authMethod);
const clearAuthSession = useWalletStore((s) => s.clearAuthSession);
const setSafeAddress = useWalletStore((s) => s.setSafeAddress);
const setCredentialsStatus = useWalletStore((s) => s.setCredentialsStatus);
const isWalletHydrated = useWalletPersistHydrated();
// ... complex effect checking Magic + sessionToken + hydration
```

**New pattern:**
```ts
const { session, isPending, isAuthenticated } = useSession();
const { magic, isLoading: isMagicLoading } = useMagic();
const authMethod = session?.authMethod ?? null;
```

Key changes:
- **Remove** `isWalletHydrated` check — TanStack Query doesn't need localStorage hydration.
- **Remove** `syncWalletFromAuthMe` — `useSession()` IS the auth.me query.
- **Remove** `setSafeAddress` / `setCredentialsStatus` syncing — data lives in query cache.
- **Simplify** auth check: `isPending` → loading, `isAuthenticated` → render children, else → redirect.
- **Keep** Magic `isLoggedIn()` probe for email users (validates Magic session is alive).
- **Keep** visibility change re-check for email users.

**Edge case:** The current AuthGuard waits for Zustand persist hydration before treating missing `sessionToken` as logged-out. With `useSession()`, the `isPending` state from TanStack Query serves the same purpose — no false redirects on hard refresh because the cookie is sent automatically.

### Step 4: Migrate layout components (8 files)

Each file replaces `useWalletStore(s => s.field)` with `useSession()`.

#### `layout/header-actions.tsx`

```ts
// Before:
const isAuthenticated = useWalletStore(
  (s) => s.isConnected && Boolean(s.sessionToken)
);
// After:
const { isAuthenticated } = useSession();
```

#### `layout/header-wallet-balance.tsx`

```ts
// Before:
const address = useWalletStore((s) => s.address);
const safeAddress = useWalletStore((s) => s.safeAddress);
const hasCredentials = useWalletStore((s) => s.hasCredentials);
const isAuthenticated = useWalletStore(
  (s) => s.isConnected && Boolean(s.sessionToken)
);
// After:
const { session, isAuthenticated } = useSession();
const address = session?.address ?? null;
const safeAddress = session?.safeAddress ?? null;
const hasCredentials = session?.hasCredentials ?? false;
```

#### `layout/header-wrap-button.tsx`

```ts
// Before:
const safeAddress = useWalletStore((s) => s.safeAddress);
const sessionToken = useWalletStore((s) => s.sessionToken);
// After:
const { session } = useSession();
const safeAddress = session?.safeAddress ?? null;
const isAuthenticated = session != null;
```

#### `layout/notifications-bell.tsx`

```ts
// Before:
const isAuthenticated = useWalletStore(
  (s) => s.isConnected && Boolean(s.sessionToken)
);
const safeAddress = useWalletStore((s) => s.safeAddress);
const hasCredentials = useWalletStore((s) => s.hasCredentials);
// After:
const { session, isAuthenticated } = useSession();
const safeAddress = session?.safeAddress ?? null;
const hasCredentials = session?.hasCredentials ?? false;
```

#### `layout/bottom-bar.tsx`

```ts
// Before:
const sessionToken = useWalletStore((s) => s.sessionToken);
// After:
const { isAuthenticated } = useSession();
// Replace: Boolean(sessionToken) → isAuthenticated
```

#### `layout/watchlist-bar.tsx`

```ts
// Before:
const sessionToken = useWalletStore((s) => s.sessionToken);
// After:
const { isAuthenticated } = useSession();
```

#### `layout/widgets/portfolio-widget-content.tsx`

```ts
// Before:
const address = useWalletStore((s) => s.safeAddress);
const sessionToken = useWalletStore((s) => s.sessionToken);
// After:
const { session } = useSession();
const address = session?.safeAddress ?? null;
const isAuthenticated = session != null;
```

#### `layout/bug-report-widget.tsx`

```ts
// Before:
const userId = useWalletStore((s) => s.userId);
const email = useWalletStore((s) => s.email);
const address = useWalletStore((s) => s.address);
const safeAddress = useWalletStore((s) => s.safeAddress);
const authMethod = useWalletStore((s) => s.authMethod);
// After:
const { session } = useSession();
const userId = session?.userId ?? null;
const email = session?.email ?? null;
const address = session?.address ?? null;
const safeAddress = session?.safeAddress ?? null;
const authMethod = session?.authMethod ?? null;
```

### Step 5: Migrate trading components (14 files)

These are the most sensitive — trading requires `safeAddress`, `hasCredentials`, and `sessionToken` for CLOB auth.

#### `trading/hooks/use-trading-init.ts`

**Current:** Reads `safeAddress`, `hasCredentials`, `isConnected`, `sessionToken` from wallet store. Runs `useQuery(trpc.auth.me)` separately and syncs results back to wallet store via `useEffect`.

**New:** Replace entirely with `useSession()`:
```ts
export function useTradingInit(): UseTradingInitReturn {
  const { session, isPending } = useSession();

  const isReady = Boolean(
    session?.safeAddress && session?.hasCredentials
  );
  const needsOnboarding = Boolean(
    session && !(session.safeAddress && session.hasCredentials)
  );

  return { isReady, needsOnboarding, isSyncing: isPending };
}
```

**Gotcha:** The current hook syncs `setSafeAddress` / `setCredentialsStatus` back to the wallet store. After migration, nothing reads those fields from the store, so the sync is unnecessary.

#### `trading/hooks/use-clob-client.ts`

**Current:** Receives `safeAddress`, `walletAddress`, `hasCredentialsStored` as props (from wallet store at call site). Uses `useWalletStore.getState().setCredentialsStatus(true)` after persisting credentials.

**New:** Call site passes values from `useSession()` instead. Remove `setCredentialsStatus` call — invalidate the query cache instead:
```ts
// Instead of: useWalletStore.getState().setCredentialsStatus(true);
queryClient.invalidateQueries({ queryKey: trpc.auth.me.queryKey() });
// (this line already exists in the current code)
```

#### `trading/hooks/use-user-channel.ts`

**Current:** Reads `sessionToken` and `safeAddress` from wallet store for WebSocket auth.

**New:** Receive from `useSession()`. The WebSocket needs a token — but `useSession()` doesn't expose `sessionToken` (it's in the HttpOnly cookie). **Resolution:** The user channel WebSocket already authenticates via the session cookie forwarded by the server. If it needs an explicit token, read it from the query cache or pass it as a prop from the auth context.

**Gotcha:** This is the one place where `sessionToken` as a raw string is needed client-side for WebSocket auth headers. Options:
1. Add `sessionToken` to the `Session` type returned by `auth.me` (leaks token to client — already happens today via localStorage).
2. Keep a minimal `useConnectionStore` with just the WebSocket token, set on login.
3. Use a separate `auth.wsToken` procedure that returns a short-lived WS token.

**Recommendation:** Option 1 for now (parity with current behavior), migrate to Option 3 later.

#### `trading/components/orders/order-form.hooks.ts`

**Current:** Reads `sessionToken`, `safeAddress`, `hasCredentials` for order submission gating.

**New:**
```ts
const { session, isAuthenticated } = useSession();
const canTrade = isAuthenticated && session?.safeAddress && session?.hasCredentials;
```

#### `trading/components/market/instant-trade-popup.tsx`

**Current:** Reads `sessionToken`, `safeAddress`, `hasCredentials`, `isConnected` for trade gating and CLOB client init.

**New:** Same pattern as order-form — derive from `useSession()`.

#### `trading/components/trading-layout.tsx`, `trading-layout-terminal.tsx`

**Current:** Read `sessionToken` / `safeAddress` to conditionally render trading UI.

**New:** `const { session, isAuthenticated } = useSession();`

#### `trading/components/market/market-tabs.tsx`, `positions-tab.tsx`, `quick-sell-modal.tsx`

**Current:** Read `safeAddress` / `sessionToken` for query enabling and position display.

**New:** Derive from `useSession()`.

#### `trading/components/charts/use-trade-markers.ts`

**Current:** Reads `safeAddress` to filter user's trades on chart.

**New:** `const { session } = useSession(); const safeAddress = session?.safeAddress;`

#### `trading/lib/place-order-client.ts`

**Current:** Reads `useWalletStore.getState().sessionToken` imperatively for order signing.

**New:** Accept `sessionToken` as a parameter from the calling hook (which gets it from `useSession()`), or read from query cache: `queryClient.getQueryData(trpc.auth.me.queryKey())?.sessionToken`.

### Step 6: Migrate auth components (10 files)

#### `auth/components/user-menu.tsx`

**Current:**
```ts
const address = useWalletStore((s) => s.address);
const email = useWalletStore((s) => s.email);
const safeAddress = useWalletStore((s) => s.safeAddress);
const hasCredentials = useWalletStore((s) => s.hasCredentials);
const authMethod = useWalletStore((s) => s.authMethod);
```

**New:**
```ts
const { session } = useSession();
const address = session?.address ?? null;
const email = session?.email ?? null;
const safeAddress = session?.safeAddress ?? null;
const hasCredentials = session?.hasCredentials ?? false;
const authMethod = session?.authMethod ?? null;
```

**Gotcha:** `handleLogout` reads `useWalletStore.getState().sessionToken` imperatively. After migration, read from query cache or use the new logout flow (Step 7 below).

#### `auth/components/wallet-kit-login.tsx`

**Current:** Calls `useWalletStore((s) => s.setAuthSession)` and `useWalletStore((s) => s.setSafeAddress)` after login.

**New:** Replace `setAuthSession` with `queryClient.setQueryData(trpc.auth.me.queryKey(), session)`. Keep `setSafeAddress` only if wallet store still tracks connection state during onboarding import flow.

**Gotcha:** The `connectWallet` helper is called with `actions.setAuthSession` — refactor to accept a `seedSession` callback that sets query data instead.

#### `auth/components/wallet-kit-login.tsx` — `connectWallet` helper

**Current:**
```ts
actions.setAuthSession({
  sessionToken: auth.sessionToken,
  userId: u.id,
  email: u.email,
  address: u.walletAddress,
  safeAddress: u.safeAddress,
  hasCredentials: u.hasCredentials,
});
useWalletStore.getState().setAuthMethod("wallet");
```

**New:**
```ts
const session: Session = {
  userId: u.id,
  email: u.email,
  address: u.walletAddress,
  safeAddress: u.safeAddress,
  hasCredentials: u.hasCredentials,
  authMethod: "wallet",
  signatureType: SignatureType.GNOSIS_SAFE,
  funderAddress: u.safeAddress,
  onboardingCompleted: Boolean(u.safeAddress && u.hasCredentials),
};
queryClient.setQueryData(trpc.auth.me.queryKey(), session);
// Keep wallet connection state:
useWalletStore.getState().setConnected(u.walletAddress, 137, SignatureType.GNOSIS_SAFE, u.safeAddress);
```

#### `auth/lib/magic/auth.ts` — `logout`

See [Logout Flow Changes](#7-logout-flow-changes) below.

#### `auth/components/onboarding/onboarding-modal-provider.tsx`

**Current:** Reads wallet store to check onboarding state.

**New:** Use `useSession()` — `session?.onboardingCompleted`.

#### `auth/components/onboarding/onboarding-trigger.tsx`

**Current:** Reads `safeAddress`, `hasCredentials` from wallet store.

**New:** Derive from `useSession()`.

#### `auth/components/onboarding/onboarding-account-setup-phase.tsx`

**Current:** Calls `setSafeAddress`, `setCredentialsStatus`, `setOnboardingCompleted` on wallet store after Safe deploy + credential derivation.

**New:** After onboarding completes, invalidate the query cache:
```ts
await queryClient.invalidateQueries({ queryKey: trpc.auth.me.queryKey() });
```
The server already has the updated Safe address and credentials — `auth.me` will return the fresh state.

#### `auth/components/onboarding/onboarding-wallet-ready-phase.tsx`

**Current:** Reads `safeAddress` from wallet store.

**New:** `const { session } = useSession(); const safeAddress = session?.safeAddress;`

#### `auth/components/login-redirect.tsx`

**Current:** Reads `sessionToken` to check if already logged in.

**New:** `const { isAuthenticated } = useSession();`

#### `auth/components/auth-button.tsx`

**Current:** Reads `sessionToken` / `isConnected` for conditional rendering.

**New:** `const { isAuthenticated } = useSession();`

#### `auth/components/v2-approval-migration-modal.tsx`

**Current:** Reads `safeAddress` from wallet store.

**New:** `const { session } = useSession();`

### Step 7: Migrate remaining domains (11 files)

#### Portfolio (4+ files)

| File | Current reads | New pattern |
|------|--------------|-------------|
| `portfolio/components/position-table.tsx` | `safeAddress` | `session?.safeAddress` |
| `portfolio/components/closed-positions.tsx` | `safeAddress` | `session?.safeAddress` |
| `portfolio/components/redeem-tab.tsx` | `safeAddress` | `session?.safeAddress` |
| `portfolio/components/redeem-modal.tsx` | `safeAddress` | `session?.safeAddress` |
| `portfolio/components/share-pnl/share-pnl-modal.tsx` | `safeAddress` | `session?.safeAddress` |
| `app/portfolio/portfolio-page.tsx` | `safeAddress` | `session?.safeAddress` |
| `app/portfolio/use-portfolio-data.ts` | `safeAddress`, `sessionToken` | `session?.safeAddress`, `isAuthenticated` |

#### Bridge (3 files)

| File | Current reads | New pattern |
|------|--------------|-------------|
| `bridge/hooks/use-auto-wrap.ts` | `safeAddress` | `session?.safeAddress` |
| `bridge/components/deposit-flow.tsx` | `safeAddress` | `session?.safeAddress` |
| `bridge/components/withdraw-flow.tsx` | `safeAddress` | `session?.safeAddress` |
| `bridge/components/bridge-modal-header.tsx` | `safeAddress` | `session?.safeAddress` |

#### Watchlist (1 file)

| File | Current reads | New pattern |
|------|--------------|-------------|
| `watchlist/hooks/use-watchlist.ts` | `sessionToken` (for query enabling) | `isAuthenticated` |

#### Wallet Tracker (3 files)

| File | Current reads | New pattern |
|------|--------------|-------------|
| `wallet-tracker/components/wallet-tracker-content.tsx` | `sessionToken` | `isAuthenticated` |
| `wallet-tracker/components/wallet-tracker-live-feed-subscriber.tsx` | `sessionToken` | `isAuthenticated` |
| `wallet-tracker/stores/wallet-tracker-live-feed-store.ts` | `sessionToken` (imperative) | Read from query cache |

#### Shared (3 files)

| File | Current reads | New pattern |
|------|--------------|-------------|
| `shared/hooks/use-prefetch-bottom-bar-widgets.ts` | `sessionToken` | `isAuthenticated` |
| `shared/lib/session-manager.ts` | `sessionToken` (imperative) | Read from query cache or remove |
| `shared/hooks/use-wallet-persist-hydrated.ts` | Zustand hydration check | **Delete** — no longer needed |

#### Leaderboard (1 file)

| File | Current reads | New pattern |
|------|--------------|-------------|
| `leaderboard/components/leaderboard-your-ranking.tsx` | Already uses `trpc.auth.me` | No change needed |

### Step 8: Remove auth fields from wallet store

After all consumers are migrated, slim down the wallet store:

```ts
// shared/stores/wallet.ts (V2)
export interface WalletState {
  address: string | null;      // EOA — needed for wallet connection
  chainId: number | null;      // Current chain
  isConnected: boolean;        // Wallet provider connected
  signatureType: SignatureType; // Wallet type (EOA/Safe)
}

interface WalletActions {
  setConnected: (address: string, chainId: number, signatureType?: SignatureType) => void;
  setDisconnected: () => void;
  setSignatureType: (signatureType: SignatureType) => void;
}
```

**Removed fields:** `sessionToken`, `userId`, `email`, `safeAddress`, `funderAddress`, `hasCredentials`, `onboardingCompleted`, `authMethod`.

**Removed actions:** `setAuthSession`, `clearAuthSession`, `setSafeAddress`, `setCredentialsStatus`, `setOnboardingCompleted`, `setAuthMethod`, `setFunderAddress`.

**localStorage key:** Keep `wallet-storage` but only persist `address`, `isConnected`, `signatureType`. Or rename to `wallet-connection` to signal the change.

**Gotcha:** `auth/lib/magic/get-signer.ts` reads `useWalletStore` for `address` — this stays, since `address` (EOA) is a connection field.

### Step 9: Remove `session-cookie-sync.tsx`

**Current:** `SessionCookieSync` in root layout reads wallet store → syncs to cookies via route handler.

**New:** The server sets the `x-session-token` cookie on login (`Set-Cookie` header). The `x-portfolio-address` cookie can be set in the same response. No client-side sync needed.

**Changes:**
1. **Delete** `apps/web/src/shared/components/session-cookie-sync.tsx`
2. **Remove** `<SessionCookieSync />` from root layout (`apps/web/src/app/layout.tsx`)
3. **Move Sentry context** to a simpler component or `useEffect` in root layout:

```ts
// shared/components/sentry-context.tsx (new, minimal)
"use client";

import { setContext, setTag, setTags, setUser } from "@sentry/nextjs";
import { useEffect } from "react";
import { useSession } from "@/shared/hooks/use-session";

export function SentryContext() {
  const { session } = useSession();

  useEffect(() => {
    if (session) {
      setUser({ id: session.userId, ...(session.email ? { email: session.email } : {}) });
      setTags({
        auth_method: session.authMethod,
        has_safe_address: String(Boolean(session.safeAddress)),
        has_credentials: String(session.hasCredentials),
      });
      setContext("wallet", {
        address: session.address,
        safe_address: session.safeAddress,
        funder_address: session.funderAddress,
      });
    } else {
      setUser(null);
      setContext("wallet", null);
      setTag("auth_method", "none");
    }
  }, [session]);

  return null;
}
```

4. **Server-side cookie setting:** Modify `auth.login` and `auth.walletLogin` responses to include `Set-Cookie` headers for both `x-session-token` and `x-portfolio-address`. This may require changes to the Hono middleware or tRPC context.

5. **Delete** `POST /api/session` and `DELETE /api/session` route handlers (no longer needed).

### Step 10: Extract `preferences-store.ts`

Move user preferences out of scattered stores into a unified preferences store:

```ts
// shared/stores/preferences.ts (new)
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PreferencesState {
  hideBalances: boolean;
  soundEnabled: boolean;
  setHideBalances: (hide: boolean) => void;
  setSoundEnabled: (enabled: boolean) => void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      hideBalances: false,
      soundEnabled: true,
      setHideBalances: (hide) => set({ hideBalances: hide }),
      setSoundEnabled: (enabled) => set({ soundEnabled: enabled }),
    }),
    { name: "doji-preferences" }
  )
);
```

**Migrate from:**
- `balances-hidden` store → `hideBalances` field
- `notifications` store → `soundEnabled` field (if applicable)

This is a low-risk cleanup that can happen in parallel with the auth migration.

---

## 6. Login Flow Changes

### Current Flow (V1)

```
User authenticates (Magic OTP / OAuth / Wallet SIWE)
  → Server validates, returns { sessionToken, user }
  → Client calls useWalletStore.getState().setAuthSession({...})
  → Zustand persists to localStorage
  → SessionCookieSync detects change
  → POST /api/session sends token + address to route handler
  → Route handler sets HttpOnly cookie
  → RSC can now read cookie for server-side tRPC calls
```

**Problems:** Race condition between store write and cookie sync. Cookie may not be set before navigation. Multiple sources of truth (localStorage, cookie, server).

### New Flow (V2)

```
User authenticates (Magic OTP / OAuth / Wallet SIWE)
  → Server validates, returns { session } + Set-Cookie header
  → Cookie is set immediately by the browser (server response)
  → Client calls queryClient.setQueryData(trpc.auth.me.queryKey(), session)
  → useSession() returns data instantly (no network round-trip)
  → RSC can read cookie immediately (already set)
  → Navigate to post-auth page
```

**Benefits:** No race condition. Cookie is set atomically with the server response. Query cache is seeded synchronously. Single source of truth (server JWT).

### Transition Period

During incremental migration (Steps 1-7), both systems coexist:
- `useSession()` reads from query cache (new)
- `useWalletStore` still has auth fields (old, being phased out)
- `SessionCookieSync` still runs (removed in Step 9)
- Login seeds both: `setAuthSession` + `setQueryData`

---

## 7. Logout Flow Changes

### Current Flow (V1)

```ts
// auth/lib/magic/auth.ts — logout()
function logout(magic) {
  // 1. Set pending logout token for tRPC headers
  setPendingLogoutToken(sessionToken);
  // 2. Start server invalidation
  trpcClient.auth.logout.mutate();
  // 3. Clear ALL client stores
  useWalletStore.getState().setDisconnected();  // resets to initialState
  useOrdersStore.getState().clearAll();
  usePositionsStore.getState().clearAll();
  usePendingBalanceDeltasStore.getState().clearAll();
  usePendingPositionTokensStore.getState().clearAll();
  clearCachedProvider();
  // 4. Clear Magic localStorage
  localStorage.removeItem("magic_3pw_provider");
  // 5. Best-effort Magic logout
  magic.user.logout();
  // 6. SessionCookieSync detects null token → DELETE /api/session
}
```

### New Flow (V2)

```ts
async function logout(magic?: Magic) {
  // 1. Server invalidation (clears cookie via Set-Cookie)
  await trpcClient.auth.logout.mutate().catch(() => {});
  // 2. Clear query cache (all queries, not just auth.me)
  queryClient.clear();
  // 3. Clear trading stores (orders, positions, deltas)
  useOrdersStore.getState().clearAll();
  usePositionsStore.getState().clearAll();
  usePendingBalanceDeltasStore.getState().clearAll();
  usePendingPositionTokensStore.getState().clearAll();
  // 4. Clear credential cache
  clearCachedProvider();
  clearCachedCredentials();
  // 5. Reset wallet connection state (keep store, just disconnect)
  useWalletStore.getState().setDisconnected();
  // 6. Best-effort Magic logout
  if (magic) {
    magic.user.logout().catch(() => {});
  }
  // 7. Navigate
  window.location.href = "/";
}
```

**Key differences:**
- `queryClient.clear()` replaces individual store clears for auth data
- Server `logout` response includes `Set-Cookie` to clear the HttpOnly cookie
- No `SessionCookieSync` needed — cookie cleared by server response
- `setPendingLogoutToken` no longer needed — server clears cookie directly
- Wallet store only resets connection fields (address, chainId, isConnected)

---

## 8. Rollback Plan

The migration is designed to be incrementally reversible at each step:

| Step | Rollback |
|------|----------|
| 1 (useSession hook) | Delete the hook. No consumers yet. |
| 2 (cache seeding) | Remove `setQueryData` calls. Login still writes to wallet store. |
| 3 (AuthGuard) | Revert to wallet store reads. Hook still exists but unused by guard. |
| 4-7 (component migration) | Revert individual files to wallet store reads. |
| 8 (store cleanup) | Re-add auth fields to wallet store. |
| 9 (remove SessionCookieSync) | Re-add the component to root layout. |

**Critical invariant:** The HttpOnly JWT cookie infrastructure never changes. It exists today and continues to exist in V2. The cookie is the stable contract between client and server. If `useSession()` breaks, reverting to wallet store reads restores the old behavior because `SessionCookieSync` is only removed in Step 9.

**Recommended rollback strategy:** If issues arise during Steps 3-7, revert the specific file(s) to wallet store reads. The `useSession()` hook and cache seeding (Steps 1-2) are additive and can stay in place.

---

## 9. Verification Checklist

### Automated

- [ ] `pnpm check-types` passes (no type errors from removed wallet store fields)
- [ ] `pnpm check` passes (Biome lint/format)
- [ ] `pnpm build` succeeds (no build errors)
- [ ] `pnpm test` passes (existing tests)

### Manual — Auth Flows

- [ ] Email OTP login → redirects to explore → `useSession()` returns session
- [ ] Google OAuth login → callback → redirects → session available
- [ ] MetaMask wallet login → SIWE → import Safe → session available
- [ ] Phantom wallet login → SIWE → session available
- [ ] Logout → clears session → redirects to `/` → `useSession()` returns null
- [ ] Hard refresh on protected page → no false redirect (cookie sent, auth.me succeeds)
- [ ] Tab backgrounding + foregrounding → session still valid (Magic probe for email users)
- [ ] Session expiry → auth.me returns 401 → redirect to login

### Manual — Trading

- [ ] Order form enabled when `hasCredentials` is true
- [ ] CLOB client initializes with correct Safe address
- [ ] Orders submit successfully (server signs with builder credentials)
- [ ] Orderbook WebSocket connects with auth
- [ ] Position updates arrive via user channel

### Manual — Layout

- [ ] Header shows wallet balance when authenticated
- [ ] Notifications bell loads and displays notifications
- [ ] User menu shows email/address, logout works
- [ ] Bottom bar widgets gate on auth correctly
- [ ] Watchlist bar gates on auth correctly

### Manual — RSC Prefetching

- [ ] Server-side tRPC calls still work (cookie forwarded via `getAuthenticatedServerTrpc`)
- [ ] Portfolio page prefetches positions server-side
- [ ] Market page prefetches market data server-side

### Grep Verification

After Step 8, these should return **zero matches** in `apps/web/src/` (excluding `shared/stores/wallet.ts` definition and test files):

```bash
# No remaining reads of removed auth fields from wallet store
grep -r "useWalletStore.*sessionToken" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "useWalletStore.*userId" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "useWalletStore.*email" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "useWalletStore.*safeAddress" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "useWalletStore.*hasCredentials" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "useWalletStore.*onboardingCompleted" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "useWalletStore.*authMethod" apps/web/src/ --include="*.ts" --include="*.tsx"
grep -r "useWalletStore.*funderAddress" apps/web/src/ --include="*.ts" --include="*.tsx"
```

After Step 9:
```bash
# SessionCookieSync removed
grep -r "SessionCookieSync" apps/web/src/ --include="*.ts" --include="*.tsx"
# Should return zero matches
```

---

## 10. Timeline

| Step | Description | Est. effort | Dependencies |
|------|-------------|-------------|--------------|
| 0 | Server: extend `auth.me` to return `Session` shape | 2h | None |
| 1 | Create `useSession()` hook | 1h | Step 0 |
| 2 | Seed query cache on login (3 login paths) | 2h | Step 1 |
| 3 | Migrate AuthGuard | 3h | Steps 1-2 |
| 4 | Migrate layout components (8 files) | 3h | Step 1 |
| 5 | Migrate trading components (14 files) | 4h | Steps 1-2 |
| 6 | Migrate auth components (10 files) | 3h | Steps 1-2 |
| 7 | Migrate remaining domains (11 files) | 2h | Step 1 |
| 8 | Remove auth fields from wallet store | 2h | Steps 3-7 |
| 9 | Remove SessionCookieSync + route handlers | 2h | Steps 8, server cookie changes |
| 10 | Extract preferences store | 1h | Independent |
| — | **Total** | **~25h (~1 week)** | |

**Recommended execution order:** 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

Steps 4-7 can be parallelized (independent file sets). Step 10 can happen anytime.

**Ship incrementally:** Each step is independently deployable. Steps 1-2 are invisible to users. Steps 3-7 change internal wiring but not behavior. Steps 8-9 are the cleanup that removes the old system.
