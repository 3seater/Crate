# 07 — Credential Migration

> **Phase:** 4 · **Risk:** Critical · **Status:** 🔴 Not started
>
> Moving from server-stored encrypted credentials to client-side-only credential derivation.
> This is the most security-critical migration in V2.

## Table of Contents

- [Current State](#current-state)
- [V2 Target: Client-Side Only](#v2-target-client-side-only)
- [Why This Is Safe](#why-this-is-safe)
- [Migration Path](#migration-path)
- [File-by-File Changes](#file-by-file-changes)
- [Onboarding Flow Changes](#onboarding-flow-changes)
- [Session Resumption Changes](#session-resumption-changes)
- [Edge Cases](#edge-cases)
- [Rollback Plan](#rollback-plan)
- [Security Considerations](#security-considerations)
- [Timeline](#timeline)

---

## Current State

### Server-Side Credential Storage

| Component | Location | Detail |
|-----------|----------|--------|
| DB column | `users.encrypted_creds` | JSON string of `{ciphertext, iv, tag}` — AES-256-GCM |
| Encryption key | `CREDENTIAL_ENCRYPTION_KEY` | 64 hex chars = 32 bytes, env var |
| Encrypt/decrypt | `packages/api/src/lib/crypto.ts` | `encrypt()` / `decrypt()` using `aes-256-gcm` |
| Factory | `packages/api/src/lib/clob-factory.ts` | `getEncryptionKey()` → `Buffer.from(env.CREDENTIAL_ENCRYPTION_KEY, "hex")` |

### Server Procedures

| Procedure | Type | What it does |
|-----------|------|-------------|
| `auth.storeCredentials` | Protected mutation | Accepts `{key, secret, passphrase}`, encrypts via `crypto.ts`, writes to `users.encrypted_creds` |
| `auth.getCredentials` | Protected query | Reads `users.encrypted_creds`, decrypts, returns plaintext `{key, secret, passphrase}` |

### Client Callers (5 files)

| File | Usage |
|------|-------|
| `trading/lib/clob-auth.ts` | `getCachedCredentials()` — 30s TTL promise cache wrapping `trpcClient.auth.getCredentials.query()` |
| `trading/hooks/use-clob-client.ts` | Calls `getCachedCredentials()` when `hasCredentialsStored === true`; calls `storeCredentials` when `false` via `persistCredentialsIfNeeded()` |
| `auth/components/onboarding/onboarding-account-setup-phase.tsx` | Calls `storeCredentials` in 2 flows: `runDerive()` and `runDeployThenDerive()` |
| `auth/lib/magic/import-safe.ts` | Calls `storeCredentials` after deriving creds during Safe import (Magic users only; skipped for wallet-login) |
| `trading/hooks/use-trading-init.ts` | Reads `hasCredentials` from wallet store to determine trading readiness |

### Credential Flow (Current)

```
1. User onboards (deploys Safe)
2. Client derives CLOB credentials from Magic signer + Safe address (L1 deriveApiKey)
3. Client calls trpcClient.auth.storeCredentials.mutate(creds)
   → server encrypts with AES-256-GCM → writes to users.encrypted_creds
4. On subsequent sessions:
   client calls trpcClient.auth.getCredentials.query()
   → server decrypts → returns plaintext {key, secret, passphrase}
5. Client uses plaintext creds to create authenticated ClobClient
```

### CREDENTIAL_ENCRYPTION_KEY References (22 files)

**Runtime (4 files):**
- `packages/env/src/server.ts` — env validation
- `packages/api/src/lib/crypto.ts` — encrypt/decrypt implementation
- `packages/api/src/lib/clob-factory.ts` — `getEncryptionKey()`, `createUserClobClient()`, `createUserClobClientForQueries()`, `deriveUserCredentials()`
- `apps/server/src/features/auth/router.ts` — `storeCredentials` / `getCredentials` procedures

**Config/docs/test (18 files):**
- `.env.example`, `apps/server/.env.example`
- `README.md`, `packages/env/AGENTS.md`, `apps/web/src/features/auth/AGENTS.md`
- `.ruler/setup.md`
- `.kiro/specs/vercel-env-alignment/{design,requirements}.md`
- `.cursor/commands/audit-alignment.md`
- `scripts/vercel-env-audit.ts`
- `tests/setup.ts`
- `tests/unit/clob-v2-credential-roundtrip.property.test.ts`
- `tests/unit/clob-v2-builder-attribution.property.test.ts`
- `tests/unit/clob-v2-query-client.property.test.ts`
- `notes/v2-planning/02-router-split-plan.md`
- `V2.md`
- `turbo.json`

### `hasCredentials` Flag (20 files, 74 matches)

Stored in `useWalletStore` as `hasCredentials: boolean`. Indicates whether the server has stored creds for this user. Consumed by:

- `auth-guard.tsx` — gates trading UI
- `use-trading-init.ts` — determines `isReady` / `needsOnboarding`
- `use-clob-client.ts` — decides server-fetch vs client-derive path
- `notifications-bell.tsx` — conditional rendering
- `instant-trade-popup.tsx` — conditional rendering
- `order-form.hooks.ts` — trading readiness
- `session-cookie-sync.tsx` — session hydration
- `onboarding-trigger.tsx` / `onboarding-modal-provider.tsx` — onboarding flow
- `user-menu.tsx` — menu state
- `header-wallet-balance.tsx` — balance display gating
- `quick-sell-modal.tsx` — sell flow gating
- `wallet-kit-login.tsx` — wallet login flow
- `auth/lib/magic/auth.ts` — Magic auth flow
- `login-callback-page.tsx` — OAuth callback
- `use-portfolio-data.ts` — portfolio gating
- `bug-report-widget.tsx` / `report-bug/route.ts` — diagnostic context
- `use-user-channel.ts` — WebSocket auth

---

## V2 Target: Client-Side Only

Credentials are derived deterministically — no server storage needed.

```
Signer (Magic or external wallet) + Safe address → deriveApiKey() → {key, secret, passphrase}
```

**Properties:**
- Same signer + same Safe = same credentials every time (deterministic)
- Can be re-derived at any time without server round-trip
- In-memory cache (`Map<safeAddress, ClobCredentials>`), cleared on tab close
- Server never sees plaintext credentials
- No encryption key needed — `CREDENTIAL_ENCRYPTION_KEY` removed from env

**New credential service:** `apps/web/src/domains/account/services/credentials.ts`

```ts
import type { ApiKeyCreds } from "@doji/types"

const credentialCache = new Map<string, ApiKeyCreds>()

export async function getCredentials(
  signer: Signer,
  safeAddress: string,
): Promise<ApiKeyCreds> {
  const cached = credentialCache.get(safeAddress)
  if (cached) return cached

  const creds = await deriveApiKey(signer) // L1 derivation
  credentialCache.set(safeAddress, creds)
  return creds
}

export function clearCredentials(): void {
  credentialCache.clear()
}
```

---

## Why This Is Safe

### CLOB credentials are derived values, not unique secrets

| Property | Implication |
|----------|-------------|
| **Deterministic** | `deriveApiKey(signer)` produces the same `{key, secret, passphrase}` every time for the same signer |
| **L1 derivation** | Only needs the wallet signer — no stored state, no server round-trip |
| **Both auth methods** | Magic users derive via Magic signer; wallet users derive via external signer (MetaMask/Phantom) |
| **No data loss** | Credentials aren't unique secrets that could be lost — they're re-derivable at will |
| **Polymarket precedent** | Polymarket's own frontend derives credentials client-side on every session |

### What changes for security posture

| Aspect | V1 (server-stored) | V2 (client-only) |
|--------|-------------------|-------------------|
| Credential storage | Encrypted in DB (AES-256-GCM) | In-memory only, cleared on tab close |
| Server exposure | Server decrypts and returns plaintext over HTTPS | Server never sees credentials |
| Encryption key | `CREDENTIAL_ENCRYPTION_KEY` — single point of compromise | No encryption key needed |
| DB breach risk | Attacker with DB + key = all user credentials | No credentials in DB |
| XSS risk | Credentials returned via tRPC (in JS memory anyway) | Same — credentials in JS memory |
| Tab close | Credentials cached 30s in promise cache | Cache cleared, re-derive on next session |

**Net security improvement:** Removing server-side storage eliminates the DB-as-attack-surface vector and the encryption key as a single point of compromise.

---

## Migration Path

Four phases. Phase A is the safety net — dual-path means zero risk of breaking existing users.

### Phase A: Dual-Path (3 days)

Add client-side derivation alongside server-stored credentials. Both paths work; client-side is preferred.

**New file:** `apps/web/src/domains/account/services/credentials.ts`

```ts
import type { ApiKeyCreds } from "@doji/types"
import { logger } from "@doji/logger/client"

const credentialCache = new Map<string, ApiKeyCreds>()

type CredentialSource = "client-derive" | "server-stored" | "failed"

export async function getCredentials(
  signer: Signer | null,
  safeAddress: string,
): Promise<{ creds: ApiKeyCreds; source: CredentialSource }> {
  // 1. Check in-memory cache
  const cached = credentialCache.get(safeAddress)
  if (cached) return { creds: cached, source: "client-derive" }

  // 2. Try client-side derivation
  if (signer) {
    try {
      const creds = await deriveApiKey(signer)
      credentialCache.set(safeAddress, creds)
      logger.info({ source: "client-derive" }, "Credentials derived client-side")
      return { creds, source: "client-derive" }
    } catch (err) {
      logger.warn({ err }, "Client-side credential derivation failed, falling back to server")
    }
  }

  // 3. Fall back to server-stored credentials
  try {
    const serverCreds = await trpcClient.auth.getCredentials.query()
    const creds = { key: serverCreds.key, secret: serverCreds.secret, passphrase: serverCreds.passphrase }
    credentialCache.set(safeAddress, creds)
    logger.info({ source: "server-stored" }, "Credentials fetched from server (fallback)")
    return { creds, source: "server-stored" }
  } catch (err) {
    logger.error({ err }, "Both credential paths failed")
    throw new Error("Unable to obtain trading credentials")
  }
}

export function clearCredentials(): void {
  credentialCache.clear()
}
```

**Monitoring:** Track `source` field via analytics:
```ts
trackWebEvent(AnalyticsEvents.credentialSource, { source })
```

### Phase B: Monitor and Validate (2 weeks)

| Metric | Target | Alert |
|--------|--------|-------|
| % sessions using `client-derive` | 100% | Any session using `server-stored` after week 1 |
| Derivation failure rate | < 0.1% | > 1% triggers investigation |
| Trading success rate | No regression from V1 baseline | Any drop > 2% |

**Dashboard:** Add Vercel Web Analytics custom event for `credentialSource` with `source` property.

**Exit criteria for Phase C:**
- 100% client-side for 2 consecutive weeks
- Zero server-stored fallbacks in production
- No trading regression in error rates

### Phase C: Remove Server-Side (2 days)

Once Phase B confirms 100% client-side, remove all server-side credential infrastructure.

**Remove:**
| What | File |
|------|------|
| `auth.storeCredentials` procedure | `apps/server/src/features/auth/router.ts` |
| `auth.getCredentials` procedure | `apps/server/src/features/auth/router.ts` |
| `encrypt()` / `decrypt()` | `packages/api/src/lib/crypto.ts` |
| `getEncryptionKey()` | `packages/api/src/lib/clob-factory.ts` |
| `deriveUserCredentials()` | `packages/api/src/lib/clob-factory.ts` |
| `createUserClobClient()` | `packages/api/src/lib/clob-factory.ts` (if no other server-side CLOB usage remains) |
| `createUserClobClientForQueries()` | `packages/api/src/lib/clob-factory.ts` (same condition) |
| `CREDENTIAL_ENCRYPTION_KEY` | `packages/env/src/server.ts`, `.env.example`, `apps/server/.env.example` |
| `hasCredentials` field | `useWalletStore` + all 20 consumer files |
| `getCachedCredentials()` | `trading/lib/clob-auth.ts` |
| `persistCredentialsIfNeeded()` | `trading/hooks/use-clob-client.ts` |
| Server fallback path | `domains/account/services/credentials.ts` |

**Keep:**
| What | Why |
|------|-----|
| `users.encrypted_creds` column | Don't drop data yet — Phase D |
| `EncryptedCredentials` type | May be used elsewhere; remove if orphaned |

**`hasCredentials` replacement:** In V2, trading readiness is determined by `hasSigner` (Magic SDK loaded or wallet connected) + `hasSafe` (Safe address present). No server round-trip needed.

```ts
// V1
const isReady = Boolean(isConnected && safeAddress && hasCredentials)

// V2
const isReady = Boolean(isConnected && safeAddress && hasSigner)
```

### Phase D: Database Cleanup (whenever convenient)

```sql
ALTER TABLE users DROP COLUMN encrypted_creds;
```

- Generate Drizzle migration: `pnpm db:generate`
- Run: `pnpm db:migrate`
- Remove `encryptedCreds` from Drizzle schema in `packages/db/src/schema/`
- Remove `EncryptedCredentials` type from `@doji/types` if orphaned
- Remove credential-related test files:
  - `tests/unit/clob-v2-credential-roundtrip.property.test.ts`
- Update all 18 config/docs files that reference `CREDENTIAL_ENCRYPTION_KEY`

---

## File-by-File Changes

### Client Caller 1: `trading/lib/clob-auth.ts`

**Current:** Promise cache wrapping `trpcClient.auth.getCredentials.query()` with 30s TTL.

**Phase A:** Replace `getCachedCredentials()` internals to call `getCredentials()` from the new credential service. Keep the export signature identical so callers don't change yet.

```ts
// Phase A — dual-path via credential service
export function getCachedCredentials(
  signer: Signer | null,
  safeAddress: string,
): Promise<{ key: string; secret: string; passphrase: string }> {
  return getCredentials(signer, safeAddress).then(({ creds }) => creds)
}
```

**Phase C:** Delete this file entirely. All callers import from `domains/account/services/credentials.ts` directly.

### Client Caller 2: `trading/hooks/use-clob-client.ts`

**Current:** Branches on `hasCredentialsStored` — if `true`, calls `getCachedCredentials()` (server fetch); if `false`, derives client-side and calls `persistCredentialsIfNeeded()`.

**Phase A:** Always derive client-side via credential service. Remove `hasCredentialsStored` prop and `persistCredentialsIfNeeded()`.

```ts
// Phase A — always client-derive
const { creds } = await getCredentials(signer, safeAddress)
```

**Phase C:** Remove `hasCredentialsStored` from `UseClobClientOptions`. Remove `persistCredentialsIfNeeded()` helper. Remove `getCachedCredentials` import.

### Client Caller 3: `auth/components/onboarding/onboarding-account-setup-phase.tsx`

**Current:** Two call sites — `runDerive()` and `runDeployThenDerive()` both call `trpcClient.auth.storeCredentials.mutate()`.

**Phase A:** After deriving, cache in credential service instead of storing on server. Keep `storeCredentials` call as fire-and-forget backup (dual-path).

```ts
// Phase A — cache locally, store on server as backup
const creds = await deriveCredentialsL1(signer)
credentialCache.set(safeAddress, creds) // immediate local cache
trpcClient.auth.storeCredentials.mutate({ credentials: creds }).catch(() => {}) // fire-and-forget backup
```

**Phase C:** Remove all `storeCredentials` calls. Remove `setCredentialsStatus(true)` — replace with signer-based readiness.

### Client Caller 4: `auth/lib/magic/import-safe.ts`

**Current:** After importing Safe, derives creds and calls `storeCredentials` (Magic users only; skipped for wallet-login).

**Phase A:** Cache derived creds locally. Keep `storeCredentials` as fire-and-forget backup.

**Phase C:** Remove `storeCredentials` call. Remove the `if (isWalletLogin)` skip — both paths just cache locally.

### Client Caller 5: `trading/hooks/use-trading-init.ts`

**Current:** Reads `hasCredentials` from wallet store. Sets `isReady = isConnected && safeAddress && hasCredentials`.

**Phase A:** No change — `hasCredentials` still set by onboarding flow.

**Phase C:** Replace `hasCredentials` with signer availability check:

```ts
// Phase C
const hasSigner = useWalletStore((s) => s.hasSigner) // new field: true when Magic loaded or wallet connected
const isReady = Boolean(isConnected && safeAddress && hasSigner)
```

### Server Files

**`apps/server/src/features/auth/router.ts`:**
- Phase A: No change (procedures still exist for fallback)
- Phase C: Remove `storeCredentials` and `getCredentials` procedures. Remove `crypto.ts` and `clob-factory.ts` imports related to credentials.

**`packages/api/src/lib/crypto.ts`:**
- Phase C: Delete entire file

**`packages/api/src/lib/clob-factory.ts`:**
- Phase C: Remove `getEncryptionKey()`, `deriveUserCredentials()`. Evaluate whether `createUserClobClient()` and `createUserClobClientForQueries()` are still needed for server-side order posting (builder relayer). If server-side CLOB client is still needed for builder signing, it must use a different auth mechanism (builder credentials, not user credentials).

**`packages/env/src/server.ts`:**
- Phase C: Remove `CREDENTIAL_ENCRYPTION_KEY` from env schema. Make it optional in Phase A if needed for gradual rollout.

---

## Onboarding Flow Changes

### Current (V1)

```
deploy Safe → derive creds (L1) → storeCredentials on server → set hasCredentials = true → ready
```

Files: `onboarding-account-setup-phase.tsx`, `import-safe.ts`

### New (V2)

```
deploy Safe → derive creds (L1) → cache in memory → ready
```

- No server round-trip for credential storage
- No `hasCredentials` flag — readiness = `hasSafe && hasSigner`
- Onboarding completes faster (one fewer network call)
- `setCredentialsStatus()` calls removed from onboarding flow

### Wallet Users (MetaMask/Phantom)

Current: SIWE login → import Safe → skip `storeCredentials` (wallet-login users derive on-demand in `use-clob-client`)

New: Same flow, but on-demand derivation uses the credential service cache instead of the ad-hoc path in `use-clob-client`.

---

## Session Resumption Changes

### Current (V1)

```
page load → auth.me (has hasCredentials: true)
  → getCachedCredentials() → trpcClient.auth.getCredentials.query()
  → server decrypts → returns plaintext
  → create ClobClient
```

Latency: ~200-400ms (server decrypt + network round-trip)

### New (V2)

```
page load → Magic SDK loads (or wallet reconnects)
  → getCredentials(signer, safeAddress)
  → deriveApiKey(signer) — client-side, ~50-100ms
  → cache in Map
  → create ClobClient
```

Latency: ~50-100ms (local derivation, no network)

**Improvement:** Faster session resumption, no dependency on server availability for trading readiness.

---

## Edge Cases

### 1. Derivation fails (Magic SDK not loaded)

**Scenario:** Page loads, `auth.me` returns user data, but Magic SDK hasn't initialized yet.

**Phase A:** Fall back to server `getCredentials`. Log `source: "server-stored"`.

**Phase C:** Wait for Magic SDK to load before attempting derivation. The credential service returns a pending promise that resolves when the signer becomes available. Trading UI shows loading state until signer is ready (same as current behavior when `getCachedCredentials` is in-flight).

### 2. Derivation fails (signer unavailable)

**Scenario:** Magic SDK loaded but `getSigner()` throws (e.g., session expired, network issue).

**Phase A:** Fall back to server `getCredentials`.

**Phase C:** Show "Session expired — please log in again" error. Same as current behavior when server `getCredentials` fails.

### 3. Wallet users (external signer)

**Scenario:** MetaMask/Phantom user — signer is the external wallet, not Magic.

**Current:** Wallet users already derive on-demand in `use-clob-client` (the `hasCredentialsStored === false` path). Server storage is skipped for wallet-login in `import-safe.ts`.

**V2:** Same derivation path, but through the unified credential service. No special case needed — `getCredentials(externalSigner, safeAddress)` works identically.

### 4. Users who never stored creds (`hasCredentials === false`)

**Scenario:** User has Safe but onboarding was interrupted before `storeCredentials` completed.

**Current:** `use-clob-client` detects `hasCredentialsStored === false`, derives client-side, then calls `persistCredentialsIfNeeded()`.

**V2:** No issue — credentials are always derived client-side. No flag to check.

### 5. Tab close → reopen

**Current:** Promise cache expires after 30s; next call hits server.

**V2:** In-memory `Map` is cleared on tab close. Next session re-derives from signer (~50-100ms). No persistence needed because derivation is deterministic and fast.

### 6. Multiple tabs

**Current:** Each tab has its own promise cache; each may hit server independently.

**V2:** Each tab has its own `Map` cache; each derives independently. Derivation is idempotent — same result every time. No coordination needed.

### 7. Signer changes (user switches wallet)

**Current:** Not handled — `getCachedCredentials` returns stale creds until TTL expires.

**V2:** `clearCredentials()` called on logout/wallet-switch. Next `getCredentials()` call derives fresh creds for the new signer.

---

## Rollback Plan

### Phase A is inherently safe

The dual-path design means rollback is trivial:

1. **If client-side derivation has issues:** The server fallback path handles it automatically. No code change needed — just monitor the `source` metric.

2. **If we need to fully revert Phase A:** Revert the credential service file and restore direct `getCachedCredentials()` calls. No data loss, no user impact — server-stored credentials are untouched.

3. **Phase C is only entered after 2 weeks of 100% client-side.** If Phase C reveals issues (shouldn't — Phase B validated), re-add the server procedures. The `users.encrypted_creds` column still has data (not dropped until Phase D).

### What could go wrong

| Scenario | Impact | Mitigation |
|----------|--------|------------|
| `deriveApiKey` returns different creds than stored | Trading fails (wrong API key) | Phase B catches this — if server fallback is ever used, investigate |
| Magic SDK initialization slower than expected | Delayed trading readiness | Acceptable — same UX as current "loading credentials" state |
| External wallet popup fatigue (derivation triggers signing) | UX regression for wallet users | Verify: does `deriveApiKey` require a signature prompt? If yes, cache aggressively |

---

## Security Considerations

### Memory-only credentials

| Property | Detail |
|----------|--------|
| Storage | `Map<string, ApiKeyCreds>` in JS heap — never `localStorage`, `sessionStorage`, `cookies`, or `IndexedDB` |
| Lifetime | Cleared on tab close (garbage collected) |
| XSS exposure | Credentials are in JS memory (same as V1 — server returns plaintext to JS anyway) |
| DOM exposure | Credentials never rendered in DOM, never in `data-*` attributes |
| Network exposure | Credentials never sent to our server (improvement over V1) |

### Signer requirement

Derivation requires an active wallet signer:
- **Magic users:** Magic SDK must be initialized with a valid session
- **Wallet users:** External wallet must be connected and authorized

An attacker with XSS access could call `deriveApiKey()` if the signer is available — but this is identical to V1 where the attacker could call `trpcClient.auth.getCredentials.query()`. The attack surface is unchanged.

### What improves

- **No encryption key:** `CREDENTIAL_ENCRYPTION_KEY` is eliminated. No single secret that, if leaked, compromises all user credentials.
- **No DB storage:** Database breach no longer exposes credential ciphertexts.
- **No server decryption:** Server never handles plaintext credentials — reduces server-side attack surface.
- **Shorter credential lifetime:** Credentials exist in memory only for the duration of the tab session, vs. indefinitely in the database.

---

## Timeline

| Phase | Duration | Dependencies | Exit Criteria |
|-------|----------|-------------|---------------|
| **A: Dual-path** | 3 days | None — can start immediately | All 5 client callers migrated to credential service; analytics tracking `source` |
| **B: Monitor** | 2 weeks | Phase A deployed to production | 100% `client-derive` for 2 consecutive weeks; zero `server-stored` fallbacks |
| **C: Remove server-side** | 2 days | Phase B exit criteria met | All server credential code removed; `hasCredentials` replaced with `hasSigner`; 20 consumer files updated |
| **D: DB cleanup** | 1 day | Phase C stable in production | `encrypted_creds` column dropped; Drizzle migration applied |

**Total: ~3 weeks** (including 2-week monitoring window)

### Dependencies on other V2 docs

| Doc | Dependency |
|-----|-----------|
| [03 — Session Model](./03-session-model.md) | Session must provide signer availability signal (`hasSigner`) for Phase C |
| [04 — State Ownership](./04-state-ownership.md) | `hasCredentials` removal from wallet store must align with state ownership migration |
| [02 — Router Split Plan](./02-router-split-plan.md) | `auth.storeCredentials` / `auth.getCredentials` removal in Phase C must coordinate with router restructuring |

### Blocked by

Nothing — Phase A can start immediately. Phase C depends on Phase B monitoring, which depends on Phase A being in production.