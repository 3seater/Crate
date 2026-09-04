# Design Document: Magic-Safe Audit

## Overview

This design addresses the remaining gaps in Doji's Magic Link + Gnosis Safe integration identified through auditing the codebase against the reference implementation (`references/magic-safe-builder-example`) and Magic SDK documentation. The design covers 15 requirements:

**Core Refactoring (Requirements 1-4):**
- Extract shared Magic signer helper
- Extract shared CLOB credential helper
- Add CSP headers for Magic SDK
- Add Magic SDK type augmentation

**User Experience (Requirements 5-8):**
- Harden OAuth callback error handling
- Add wallet key export
- Enhance transaction signing feedback
- Add token approval recovery

**Code Quality (Requirement 9):**
- Clean up redundant CLOB auth utilities

**Authentication & Infrastructure (Requirements 10-15):**
- Integrate Magic Wallet Kit for unified auth
- Implement Magic Provider Pattern (React Context)
- Configure Magic Dashboard settings
- Implement server-side DID token verification
- Handle rate limiting
- Implement error handling patterns

### Magic Wallet Kit Integration
> Requirement 10: Magic Wallet Kit Integration

Replace custom login UI with Magic's pre-built Wallet Kit component (`@magic-ext/wallet-kit`). This provides:
- OAuth providers (Google, Apple, GitHub, etc. — configured in dashboard)
- Farcaster login (via `enableFarcaster` prop)
- External wallets (MetaMask, Coinbase, WalletConnect, etc. — via `wallets` prop)

**Note:** Email OTP is disabled. Users authenticate via OAuth social providers, Farcaster, or external wallets only.

**Alternative:** Magic also provides `magic.wallet.connectWithUI()` which shows a pre-built login UI with email OTP and configured OAuth providers. However, Wallet Kit (`<MagicWidget />`) offers more control and supports external wallets and Farcaster.

**Benefits:**
- Pre-built UI with dashboard theming
- Support for Farcaster and external wallets
- Consistent UX across auth methods
- Reduced maintenance burden
- No need to build custom login forms

**Implementation Required:**
1. Install `@magic-ext/wallet-kit`
2. Initialize Magic with `WalletKitExtension` (with Reown project ID for WalletConnect)
3. Replace custom login components with `<MagicWidget />`
4. Handle different result types (`oauth`, `farcaster`, `wallet`)
5. Update CSP headers for WalletConnect/Reown
6. Remove deprecated custom login components
7. Disable email authentication in Magic Dashboard

**Documentation Reference:** https://docs.magic.link/llms.txt → Wallet Kit section

### Already Resolved (No Action Needed)

- OAuth callback page (`/login/callback/page.tsx`) — exists and works
- `initializeTrading` dead code — removed; `useTradingInit` correctly exposes `needsOnboarding`
- Sign route — already uses `buildHmacSignature` from `@polymarket/builder-signing-sdk`
- Session token in tRPC — wallet store's `sessionToken` is sent as `Authorization: Bearer` header

### Scope

All changes are in the `apps/web` package (client-side). No server-side changes are needed.

## Architecture

The audit fixes follow a layered approach:

```
┌─────────────────────────────────────────────────────┐
│                    UI Components                     │
│  user-menu.tsx  safe-onboarding.tsx  login/callback  │
├─────────────────────────────────────────────────────┤
│                    React Hooks                       │
│  useDeploySafe  useClobClient  useSetTokenApprovals  │
├─────────────────────────────────────────────────────┤
│              Shared Helpers (NEW)                     │
│  magic-signer.ts    clob-credentials.ts              │
├─────────────────────────────────────────────────────┤
│                  Magic SDK + ethers                   │
│  magic.rpcProvider → Web3Provider → Signer           │
└─────────────────────────────────────────────────────┘
```

The key architectural change is introducing a shared helpers layer between the hooks and the Magic SDK. Currently, each hook independently creates a `Web3Provider`, calls `eth_requestAccounts`, resolves the EOA address, and creates a signer. This is extracted into `magic-signer.ts`. Similarly, the credential derivation pattern (create temp ClobClient → `deriveOrCreateApiKey`) is extracted into `clob-credentials.ts`.

### Safe Deployment Approaches

**Current Implementation (Polymarket Builder Program):**
- Uses `@polymarket/builder-relayer-client` for Safe deployment
- Gasless deployment via Builder Program attribution
- Remote signing with Builder credentials (server-side)
- Optimized for Polymarket trading (CLOB integration)

**Alternative Approach (Safe Relay Kit):**
Magic's official Safe integration guide uses a different approach:
- Uses `@safe-global/relay-kit` (Safe4337Pack)
- Full account abstraction with bundler and paymaster
- Uses Pimlico for bundler and paymaster services
- Uses `viem` instead of `ethers`
- Uses `permissionless` package for smart account signer
- Gasless transactions via paymaster sponsorship

**Comparison:**

| Feature | Polymarket Builder | Safe Relay Kit |
|---------|-------------------|----------------|
| **Deployment** | Builder Relayer | Safe4337Pack |
| **Gasless** | Builder Program | Pimlico Paymaster |
| **Library** | ethers v5 | viem |
| **Use Case** | Polymarket trading | General EVM |
| **Bundler** | No | Yes (Pimlico) |
| **Paymaster** | No | Yes (Pimlico) |
| **Attribution** | Builder rewards | N/A |

**Recommendation:** Continue with Polymarket Builder approach. It's specifically designed for Polymarket integration and provides Builder attribution for order rewards. The Safe Relay Kit approach would require:
- Additional dependencies (`@safe-global/relay-kit`, `permissionless`, `viem`)
- Pimlico API key and sponsorship policy setup
- Migration from ethers to viem
- Loss of Builder Program benefits

**Future Consideration:** If Doji expands beyond Polymarket, the Safe Relay Kit approach provides more flexibility for general EVM interactions.

## Components and Interfaces

### 1. Magic Signer Helper (`apps/web/src/lib/magic/signer.ts`)
> Requirement 1: Extract Shared Magic Signer Helper

Consolidates the duplicated signer creation pattern from 4 files.

```typescript
import type { Signer } from "@ethersproject/abstract-signer";
import type { Magic } from "magic-sdk";

interface MagicSignerResult {
  signer: Signer;
  address: string;
}

/**
 * Create an ethers Signer from a Magic SDK instance.
 *
 * @param magic - Magic SDK instance
 * @param walletAddress - Optional EOA address (avoids "unknown account #0")
 * @returns Signer and resolved EOA address
 * @throws Error if no wallet address can be resolved
 */
export async function getMagicSigner(
  magic: Magic,
  walletAddress?: string | null
): Promise<MagicSignerResult>;
```

Current duplicated pattern (in `useDeploySafe`, `useClobClient`, `useSetTokenApprovals`, `place-order-client.ts`):
```typescript
// This exact pattern appears 4 times:
let accountForSigner = walletAddress?.trim() || undefined;
if (!accountForSigner) {
  const userInfo = (await magic.user.getInfo()) as {
    publicAddress?: string;
    wallets?: { ethereum?: { publicAddress?: string } };
  } | null;
  accountForSigner =
    userInfo?.publicAddress ?? userInfo?.wallets?.ethereum?.publicAddress;
}
const provider = new Web3Provider(magic.rpcProvider as never);
await provider.send("eth_requestAccounts", []);
const signer = accountForSigner
  ? await provider.getSigner(accountForSigner)
  : await provider.getSigner();
```

After refactor, each call site becomes:
```typescript
const { signer, address } = await getMagicSigner(magic, walletAddress);
```

### 2. CLOB Credential Helper (`apps/web/src/lib/magic/clob-credentials.ts`)
> Requirement 2: Extract Shared CLOB Credential Derivation Helper

Consolidates the duplicated credential derivation pattern from 3 files.

```typescript
import type { Signer } from "@ethersproject/abstract-signer";
import type { ApiKeyCreds } from "@doji/types";

/**
 * Derive or create CLOB API credentials from a signer.
 * Creates a temporary ClobClient, calls deriveOrCreateApiKey, returns creds.
 *
 * @param signer - ethers Signer (from getMagicSigner)
 * @returns CLOB API credentials { key, secret, passphrase }
 */
export async function getOrCreateClobCredentials(
  signer: Signer
): Promise<ApiKeyCreds>;
```

### 3. Magic SDK Type Augmentation (`apps/web/src/types/magic.d.ts`)
> Requirement 4: Add Magic SDK Type Augmentation

Extends Magic SDK types to include the `wallets` property that exists at runtime.

```typescript
import "magic-sdk";

declare module "magic-sdk" {
  interface MagicUserMetadata {
    wallets?: {
      ethereum?: {
        publicAddress?: string;
      };
    };
  }
}
```

This eliminates the `as` casts currently used in 5 files when accessing `userInfo.wallets?.ethereum?.publicAddress`.

**Additional Type Augmentations:**

```typescript
import "magic-sdk";
import type { 
  MagicUserMetadata,
  RecoveryFactor,
  RecoveryMethodType,
  LoginWithEmailOTPConfiguration,
  LoginWithEmailOTPEventHandlers,
  LoginWithEmailOTPEventEmit,
  LoginWithEmailOTPEventOnReceived,
  DeviceVerificationEventEmit,
  DeviceVerificationEventOnReceived,
} from "magic-sdk";

// Re-export types for use in components
export type {
  MagicUserMetadata,
  RecoveryFactor,
  RecoveryMethodType,
  LoginWithEmailOTPConfiguration,
  LoginWithEmailOTPEventHandlers,
  LoginWithEmailOTPEventEmit,
  LoginWithEmailOTPEventOnReceived,
  DeviceVerificationEventEmit,
  DeviceVerificationEventOnReceived,
};

// Augment MagicUserMetadata with wallets property
declare module "magic-sdk" {
  interface MagicUserMetadata {
    wallets?: {
      ethereum?: {
        publicAddress?: string;
      };
      // Add other chains if needed
      solana?: {
        publicAddress?: string;
      };
      bitcoin?: {
        publicAddress?: string;
      };
    };
  }
}
```

**Note:** Magic SDK v30.0.0+ includes `wallets` in `MagicUserMetadata` by default. This augmentation is only needed for older SDK versions or to add type safety for the nested structure.

### 4. CSP Headers (`apps/web/vercel.json`)
> Requirement 3: Add Content Security Policy Headers for Magic SDK

Add Content-Security-Policy header for Magic SDK iframe, API access, and WalletConnect.

```json
{
  "key": "Content-Security-Policy",
  "value": "frame-src 'self' https://auth.magic.link; connect-src 'self' https://*.magic.link https://*.polygon-rpc.com https://polygon-rpc.com https://*.polymarket.com wss://*.polymarket.com https://*.walletconnect.com https://*.reown.com;"
}
```

The CSP must allow:
- `frame-src https://auth.magic.link` — Magic's authentication iframe
- `connect-src https://*.magic.link` — Magic API calls
- `connect-src https://*.walletconnect.com https://*.reown.com` — WalletConnect/Reown for external wallets
- `connect-src` for Polygon RPC and Polymarket endpoints

**Magic Dashboard CSP Configuration:**
- Magic maintains a predefined list of RPC URLs in its internal CSP
- Custom RPC URLs must be added in Magic Dashboard → Settings → Content Security Policy
- Add your Polygon RPC URL (e.g., `https://polygon-rpc.com` or Alchemy/Infura endpoint)
- This ensures Magic's iframe can connect to your custom RPC node
- **Important:** Both your app's CSP (in `vercel.json`) and Magic's CSP (in dashboard) must allow the RPC URL

### 5. Wallet Key Export (in `user-menu.tsx`)
> Requirement 6: Wallet Key Export

Add an "Export Private Key" menu item that calls `magic.user.revealEVMPrivateKey()`.

```typescript
// In UserMenu component:
<DropdownMenuItem onClick={handleExportKey}>
  <Key className="size-3.5" />
  <span>Export Private Key</span>
</DropdownMenuItem>
```

**Implementation:**
```typescript
const handleExportKey = async () => {
  try {
    await magic.user.revealEVMPrivateKey();
  } catch (error) {
    console.error('Failed to reveal private key:', error);
  }
};
```

**Important Notes:**
- Magic SDK v31.0.0+ uses `revealEVMPrivateKey()` for EVM chains (breaking change from `revealPrivateKey()`)
- Magic displays a secure UI modal for key reveal — neither Magic nor the developer can see the key
- Only the end user can view their private key
- Consider adding a confirmation dialog before calling the method
- The key reveal UI matches dashboard branding settings

### 6. Transaction Signing Feedback (in `safe-onboarding.tsx`)
> Requirement 7: Transaction Signing Confirmation UI

Enhance the onboarding flow to show what's being signed at each step:

- "Deploying Safe..." → "Deploying your trading wallet (gasless)..."
- "Setting approvals..." → "Approving USDC.e and outcome tokens for trading..."
- Add a step indicator showing which approval is in progress

**Magic Signing UI:**
- **Transaction Signing UI:** Appears when `sendTransaction` is called (shows transaction details, gas fees, confirmation prompt)
- **Personal Signature UI:** Appears when `personal_sign`, `signTypedData_v3`, or `signTypedData_v4` is called (shows message signing prompt)
- Both UIs are disabled by default and must be enabled in Magic Dashboard → Customization → Widget UI
- **Recommendation:** Enable both UIs in dashboard for better UX during Safe deployment, token approvals, and CLOB credential derivation
- **Sign Confirmation:** Additional security feature that opens confirmation in a Magic-hosted browser window (Settings → Sign Confirmation)
  - Protects against front-end attacks (malicious overlays, phishing)
  - Recommended for production apps
  - Opted out by default; must be explicitly enabled
  - Works with both Transaction Signing UI and Personal Signature UI

**Implementation Note:** The signing UIs are automatic when enabled in the dashboard. No code changes needed — just ensure they're enabled for production.

**CLOB Credential Derivation:** The `deriveOrCreateApiKey` method uses `personal_sign` to create deterministic API credentials. With Personal Signature UI enabled, users will see a signing prompt during this step.

### 7. Token Approval Recovery (in `user-menu.tsx` or settings)
> Requirement 8: Token Approval Status and Recovery

Add a "Fix Approvals" action accessible from the user menu when the user has a Safe but encounters approval errors. Uses the existing `useSetTokenApprovals` hook.

### 8. OAuth Callback Page (in `login/callback/page.tsx`)
> Requirement 5: Harden OAuth Callback Error Handling

**Current Implementation:** Has a dedicated OAuth callback page.

**Wallet Kit Behavior:** When using Wallet Kit with `connectWithUI()` or `<MagicWidget />`, OAuth redirects go to Magic's infrastructure first, then back to your app. The widget handles `getRedirectResult()` internally.

**Decision:** The callback page may not be needed with Wallet Kit. Verify during implementation:
- If OAuth works without callback page → Remove it
- If callback page is still needed → Simplify to show loading state only (no manual `getRedirectResult()` call)

**If Keeping Callback Page:**
- Add timeout detection (30s) with retry option
- Add direct navigation detection (no OAuth params in URL)
- Add better error logging with provider context
- Show loading indicator during redirect processing

### 9. Magic Instance Creation (in `apps/web/src/lib/magic/index.ts`)
> Requirement 11: Magic Provider Pattern

**Current Implementation:** Magic instance is created in a module-level singleton.

**Best Practice (from Magic docs):** Create Magic instance in a React Context Provider with `useMemo` to prevent recreating on every render. This is the recommended pattern for Next.js apps.

**Required Changes:**
1. Create `MagicProvider` context component (see Magic Next.js integration docs)
2. Initialize Magic instance in `useEffect` with `useMemo` for value
3. Export `useMagic()` hook to access Magic instance across app
4. Wrap app with `<MagicProvider>` in root layout
5. Replace all direct Magic imports with `useMagic()` hook

**Benefits:**
- Prevents Magic instance recreation on re-renders
- Ensures single instance across entire app
- Follows Magic's recommended Next.js pattern
- Better SSR compatibility (Magic only initialized client-side)

## Data Models

No new data models are needed. All changes are client-side refactors and UI additions. The existing data models (wallet store, user record, CLOB credentials) remain unchanged.

### Affected Files Summary

| File | Change Type |
|------|-------------|
| `apps/web/package.json` | Add `@magic-ext/wallet-kit` (OAuth Extension not needed) |
| `apps/web/src/lib/magic/provider.tsx` | New — MagicProvider context component |
| `apps/web/src/lib/magic/index.ts` | Update — export `useMagic` hook instead of singleton |
| `apps/web/src/app/layout.tsx` | Wrap app with `<MagicProvider>` |
| `apps/web/src/lib/magic/signer.ts` | New — shared signer helper |
| `apps/web/src/lib/magic/clob-credentials.ts` | New — shared credential helper |
| `apps/web/src/types/magic.d.ts` | New — type augmentation |
| `apps/web/src/components/auth/login-form.tsx` | Replace with `<MagicWidget />` |
| `apps/web/src/app/login/page.tsx` | Update to use Wallet Kit |
| `apps/web/src/app/login/callback/page.tsx` | Evaluate if needed; simplify or remove |
| `apps/web/src/hooks/use-deploy-safe.ts` | Refactor — use `useMagic()` + shared helpers |
| `apps/web/src/hooks/use-clob-client.ts` | Refactor — use `useMagic()` + shared helpers |
| `apps/web/src/hooks/use-set-token-approvals.ts` | Refactor — use `useMagic()` + shared helper |
| `apps/web/src/lib/polymarket/place-order-client.ts` | Refactor — use shared helpers |
| `apps/web/src/components/auth/user-menu.tsx` | Add key export + fix approvals |
| `apps/web/src/components/onboarding/safe-onboarding.tsx` | Enhance signing feedback |
| `apps/web/vercel.json` | Add CSP headers (including WalletConnect) |
| `apps/web/src/lib/auth/clob-auth.ts` | Evaluate for dead code removal |

## Additional Considerations

### Magic SDK Constructor Options

**Current Implementation:** Basic Magic initialization with API key, network, and WalletKitExtension.

**Additional Options to Consider:**

```typescript
const magic = new Magic('PUBLISHABLE_API_KEY', {
  network: { rpcUrl: '...', chainId: 137 },
  extensions: [new WalletKitExtension({ projectId: '...' })],
  
  // Performance optimization
  deferPreload: true,  // Delay iframe asset loading until first SDK call
  
  // Session management
  useStorageCache: true,  // Cache isLoggedIn in localStorage for faster checks
  
  // Localization
  locale: 'en',  // Customize language (en, es, fr, etc.)
});
```

**Performance Optimization (`deferPreload`):**
- Delays loading Magic iframe's static assets until an SDK method is called
- Useful if latency bottlenecks are a concern during initial page load
- Trade-off: First SDK call will be slightly slower
- **Recommendation:** Test with and without to measure impact

**Session Management (`useStorageCache`):**
- Caches `isLoggedIn` result in localStorage for faster checks
- Reduces network calls on page load
- **Requirement:** Must implement `magic.user.onUserLoggedOut` event listener to handle session expiration
- **Example:**
  ```typescript
  magic.user.onUserLoggedOut((isLoggedOut) => {
    if (isLoggedOut) {
      // Redirect to login, clear app state, etc.
      router.push('/login');
    }
  });
  ```

**Recommendation:** Enable `useStorageCache` for better UX, implement `onUserLoggedOut` handler in root layout.

### Server-Side DID Token Verification
> Requirement 13: Server-Side DID Token Verification

**Current Implementation:** Server validates DID tokens from Magic authentication.

**Magic Admin SDK (Node.js):**
```typescript
// apps/server/src/lib/magic/index.ts
import { Magic } from '@magic-sdk/admin';

const magic = await Magic.init(process.env.MAGIC_SECRET_KEY!);

// Validate DID token
await magic.token.validate(didToken);

// Get user metadata
const metadata = await magic.users.getMetadataByToken(didToken);
// Returns: { issuer, publicAddress, email, phoneNumber, oauthProvider, wallets }

// Extract issuer (DID) from token
const issuer = magic.token.getIssuer(didToken);

// Extract public address from token
const publicAddress = magic.token.getPublicAddress(didToken);

// Parse Authorization header
const didToken = magic.utils.parseAuthorizationHeader(req.headers.authorization);
```

**Error Handling:**
```typescript
import { SDKError, ErrorCode } from '@magic-sdk/admin';

try {
  await magic.token.validate(didToken);
} catch (err) {
  if (err instanceof SDKError) {
    switch (err.code) {
      case ErrorCode.TokenExpired:
        // Token expired, require re-authentication
        break;
      case ErrorCode.IncorrectSignerAddress:
        // Token signature invalid
        break;
      case ErrorCode.MalformedTokenError:
        // Token format invalid
        break;
    }
  }
}
```

**Current Usage:**
- OAuth flow: Validate `idToken` from Wallet Kit OAuth results
- Farcaster flow: Validate `didToken` from Farcaster login
- API authentication: Parse `Authorization: Bearer <didToken>` header

**Recommendation:** Implement structured error handling in tRPC auth middleware. Use `getMetadataByToken` to fetch user data after validation.

### Complete Authentication Flow

**Client to Server Flow:**
1. User authenticates with Magic (OAuth, Farcaster, or external wallet)
2. Client receives DID token from Magic
3. Client sends POST request to server with `Authorization: Bearer <didToken>` header
4. Server parses authorization header: `magic.utils.parseAuthorizationHeader(req.headers.authorization)`
5. Server validates token: `await magic.token.validate(didToken)`
6. Server fetches user metadata: `await magic.users.getMetadataByToken(didToken)`
7. Server performs custom logic (create user record, generate session, etc.)
8. Server returns response to client

**Example Server Endpoint (tRPC):**
```typescript
// apps/server/src/routers/auth.ts
import { Magic } from '@magic-sdk/admin';
import { TRPCError } from '@trpc/server';

const magic = await Magic.init(process.env.MAGIC_SECRET_KEY!);

export const authRouter = router({
  validateSession: publicProcedure
    .input(z.object({ didToken: z.string() }))
    .mutation(async ({ input }) => {
      try {
        // Validate token
        await magic.token.validate(input.didToken);
        
        // Get user metadata
        const metadata = await magic.users.getMetadataByToken(input.didToken);
        
        // Custom logic (create/update user, generate session, etc.)
        const user = await db.user.upsert({
          where: { issuer: metadata.issuer },
          create: {
            issuer: metadata.issuer,
            email: metadata.email,
            publicAddress: metadata.publicAddress,
          },
          update: {
            email: metadata.email,
          },
        });
        
        return { authenticated: true, user };
      } catch (error) {
        if (error instanceof SDKError) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: error.message,
          });
        }
        throw error;
      }
    }),
});
```

**Example Client Call:**
```typescript
// apps/web/src/hooks/use-auth.ts
const { magic } = useMagic();

// After OAuth/Farcaster login
const didToken = await magic.user.getIdToken();

// Validate with server
const result = await trpc.auth.validateSession.mutate({ didToken });
```

**Security Notes:**
- Always validate tokens on the server (never trust client-side validation)
- Use HTTPS for all requests containing DID tokens
- Set appropriate token lifespans (default 15 minutes)
- Implement rate limiting on authentication endpoints
- Store user sessions securely (HTTP-only cookies, encrypted database)

### Rate Limiting
> Requirement 14: Rate Limiting Handling

**Magic API Rate Limit:** 500 requests per minute (default)

**What Counts as a Request:**
- Token validation calls
- User metadata fetches
- OAuth authentication flows
- Login attempts (varies by provider configuration)

**Rate Limit Exceeded:** Returns HTTP 429 error code

**Handling Rate Limits:**
```typescript
import { SDKError, ErrorCode } from '@magic-sdk/admin';

try {
  await magic.token.validate(didToken);
} catch (err) {
  if (err instanceof SDKError) {
    if (err.code === ErrorCode.ServiceError && err.data?.statusCode === 429) {
      // Rate limit exceeded
      // Implement exponential backoff or queue requests
    }
  }
}
```

**Considerations for Doji:**
- Safe deployment: 1 request per user (one-time)
- Token validation: 1 request per API call
- User metadata: 1 request per session (cache result)
- OAuth login: Multiple requests per login (varies by provider)

**Recommendations:**
1. **Cache user metadata** after validation to reduce API calls
2. **Implement request queuing** for high-traffic scenarios
3. **Monitor rate limit usage** in production
4. **Contact Magic sales** if expecting high-volume events (NFT drops, launches)
5. **Give 2-4 weeks notice** for planned high-traffic events

**Production Checklist:**
- [ ] Implement rate limit error handling (429 responses)
- [ ] Add exponential backoff for retries
- [ ] Cache user metadata in session/database
- [ ] Monitor API usage metrics
- [ ] Plan for traffic spikes (market events, viral markets)

### DID Token Methods

**Current Implementation:** Uses DID tokens for backend verification (OAuth `idToken`, Farcaster `didToken`).

**Available Methods:**
- `magic.user.getIdToken({ lifespan?: number })` — Get DID token for current session (default 15 min lifespan)
- `magic.user.generateIdToken({ lifespan?: number, attachment?: string })` — Generate DID token with optional serialized data signature

**Use Cases:**
- Backend verification of authenticated users
- Secure API calls to protected endpoints
- Session management with custom lifespan

**Current Usage:** Wallet Kit provides `idToken` in OAuth results. For other flows, explicitly call `getIdToken()`.

**Recommendation:** Document DID token usage in API authentication flow. Consider custom lifespan for long-running sessions.

### Error Handling Patterns
> Requirement 15: Error Handling Patterns

**Current Implementation:** Basic try-catch error handling.

**Magic SDK Error Types:**
1. **SDKError** — SDK-level errors (missing API key, modal not ready, etc.)
2. **RPCError** — Method-specific errors (user already logged in, rate limited, etc.)
3. **ExtensionError** — Extension-specific errors

**Recommended Pattern:**
```typescript
import { Magic, RPCError, RPCErrorCode, SDKError } from 'magic-sdk';

try {
  await magic.wallet.connectWithUI();
} catch (err) {
  if (err instanceof RPCError) {
    switch (err.code) {
      case RPCErrorCode.UserAlreadyLoggedIn:
        // Handle already logged in
        break;
      case RPCErrorCode.MagicLinkRateLimited:
        // Handle rate limiting
        break;
      default:
        // Handle other RPC errors
    }
  } else if (err instanceof SDKError) {
    // Handle SDK errors
  } else {
    // Handle unknown errors
  }
}
```

**Recommendation:** Implement structured error handling in auth hooks and components. Use error codes for deterministic error identification.

## Additional Considerations

### EIP-7702 Support (Future Enhancement)

Magic SDK v33.4.0+ supports EIP-7702, which allows EOAs to temporarily delegate to smart contract code. This enables account abstraction features like batched transactions and gas sponsorship.

**Current Implementation:** Doji uses Gnosis Safe for smart account functionality.

**EIP-7702 Alternative:** Instead of deploying a Safe, users could:
1. Sign an EIP-7702 authorization to delegate their Magic EOA to a smart contract implementation
2. Send Type-4 transactions that include the authorization
3. Gain smart account features without deploying a separate contract

**Key Differences:**
- **Safe:** Separate contract address, requires deployment, persistent smart account
- **EIP-7702:** Temporary delegation, no deployment needed, EOA retains same address

**Consideration for Future:** EIP-7702 could simplify onboarding by eliminating Safe deployment. However:
- Requires network support (Ethereum, Sepolia, Arbitrum, Base, Optimism)
- Delegation is temporary (per-transaction)
- Safe provides more mature tooling and multi-sig capabilities
- Polymarket Builder Program integration tested with Safe

**Recommendation:** Continue with Safe for now. Monitor EIP-7702 adoption and consider migration if it becomes standard for prediction market trading.

**SDK Methods:**
- `magic.wallet.sign7702Authorization({ contractAddress, chainId })` — Sign authorization
- `magic.wallet.send7702Transaction({ to, authorizationList, data })` — Send Type-4 transaction

**Note:** EIP-7702 operates headlessly (no UI confirmation prompt).

### Magic Widget UI Methods (Optional)

Magic provides additional wallet UI methods that could enhance the user experience:

```typescript
magic.wallet.showUI()           // Full wallet experience (address, balances, NFTs, send)
magic.wallet.showAddress()      // Display address as QR code
magic.wallet.showSendTokensUI() // Token transfer UI
magic.wallet.showBalances()     // Token balances
magic.wallet.showNFTs()         // NFT gallery (Ethereum, Polygon only)
magic.wallet.showOnRamp()       // Fiat on-ramp (requires KYB with provider)
```

**Current Implementation:** Doji has custom UI for wallet management and trading.

**Consideration:** These methods could supplement or replace custom UI components:
- `showAddress()` — Could replace custom address display/QR code
- `showBalances()` — Could supplement portfolio view
- `showSendTokensUI()` — Could be used for withdrawals

**Supported Blockchains:** Ethereum, Polygon, Base, Arbitrum, Optimism

**Dashboard Configuration:** NFT toggle in Widget UI settings controls visibility across all methods

**Recommendation:** Keep custom UI for now. These methods are useful for rapid prototyping but Doji's terminal-style interface requires custom components.

### OIDC Extension (Alternative to OAuth)

**Current Implementation:** Doji uses Wallet Kit for OAuth (Google, Apple, GitHub, etc.)

**Alternative Approach:** Magic's OIDC Extension (`@magic-ext/oidc`) enables custom authentication providers via OpenID Connect:

```typescript
import { OpenIdExtension } from '@magic-ext/oidc';

const magic = new Magic('PUBLISHABLE_API_KEY', {
  extensions: [new OpenIdExtension()],
});

// Login with custom OIDC provider
const DID = await magic.openid.loginWithOIDC({
  jwt: idToken,        // ID token from your auth provider
  providerId: '...',   // Provider ID from Magic API
});
```

**Use Cases:**
- Custom authentication providers (e.g., enterprise SSO)
- NextAuth integration (Google, GitHub, etc. via NextAuth)
- Existing OAuth infrastructure

**Setup Process:**
1. Register OIDC provider with Magic API (POST to `/v1/api/magic_client/federated_idp`)
2. Provide issuer, audience, display_name
3. Receive provider ID
4. Use provider ID in `loginWithOIDC` call

**Comparison with Wallet Kit:**

| Feature | Wallet Kit | OIDC Extension |
|---------|-----------|----------------|
| **OAuth Providers** | Pre-configured (Google, Apple, etc.) | Custom (any OIDC provider) |
| **Setup** | Dashboard configuration | API registration |
| **UI** | Pre-built widget | Custom UI required |
| **Use Case** | Standard OAuth | Custom auth providers |

**Recommendation:** Continue with Wallet Kit for standard OAuth providers. OIDC Extension is useful if:
- Need to integrate with existing enterprise SSO
- Want to use NextAuth for authentication
- Have custom OIDC provider requirements

**Note:** OIDC Extension and Wallet Kit can coexist, but Wallet Kit already handles standard OAuth providers more simply.

### OAuth Extension vs Wallet Kit

Magic provides two ways to implement OAuth:

1. **Wallet Kit** (`@magic-ext/wallet-kit`) — Pre-built UI component that handles OAuth flow internally
2. **OAuth Extension** (`@magic-ext/oauth2`) — Manual OAuth implementation with `loginWithRedirect()` and `getRedirectResult()`

**Current Decision:** Using Wallet Kit for simplified integration.

**OAuth Flow with Wallet Kit:**
- User clicks OAuth provider button in `<MagicWidget />`
- Widget calls `loginWithRedirect()` internally
- User redirects to provider (Google, GitHub, etc.)
- Provider redirects back to Magic's redirect URI (configured in dashboard)
- Widget calls `getRedirectResult()` internally
- `onSuccess` callback receives OAuth result

**Redirect URI Configuration:**
- When using Wallet Kit, Magic Dashboard provides a redirect URI under "Magic Login Widget" settings
- This redirect URI must be whitelisted in each OAuth provider's dashboard (Google, GitHub, etc.)
- The redirect goes to Magic's infrastructure, which then redirects back to your app
- No custom callback page needed in your app — Wallet Kit handles the entire flow

**OAuth Extension Not Required:** Since Wallet Kit includes OAuth functionality, `@magic-ext/oauth2` is not needed as a separate dependency.

### Google OAuth Setup Checklist

1. **Google Developer Console:**
   - Create OAuth 2.0 app at https://console.developers.google.com/
   - Obtain Client ID and Client Secret
   - Add Magic's redirect URI (from dashboard) to authorized redirect URIs
   - Set publishing status to "In production" (avoid "Access blocked" errors)
   - Remove app icons/logos to avoid Google verification process

2. **Magic Dashboard:**
   - Navigate to Social Login → Google / Gmail
   - Enter Client ID and Client Secret
   - Copy redirect URI from "Magic Login Widget" section
   - Test connection

3. **Common Issues:**
   - "Access blocked" error → Set Google app to "In production"
   - Verification required → Remove icons/logos from Google dashboard
   - Redirect mismatch → Ensure Magic's redirect URI is whitelisted in Google

### Magic Provider Pattern (Required)
> Requirement 11: Magic Provider Pattern

Magic's recommended Next.js integration uses a Context Provider pattern instead of a module-level singleton:

```typescript
// apps/web/src/lib/magic/provider.tsx
import { Magic } from 'magic-sdk';
import { WalletKitExtension } from '@magic-ext/wallet-kit';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type MagicContextType = {
  magic: Magic | null;
};

const MagicContext = createContext<MagicContextType>({ magic: null });

export const useMagic = () => useContext(MagicContext);

export function MagicProvider({ children }: { children: React.ReactNode }) {
  const [magic, setMagic] = useState<Magic | null>(null);

  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY) {
      const instance = new Magic(process.env.NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY, {
        network: {
          rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC_URL!,
          chainId: 137, // Polygon Mainnet
        },
        extensions: [
          new WalletKitExtension({
            projectId: process.env.NEXT_PUBLIC_REOWN_PROJECT_ID,
          }),
        ],
      });
      setMagic(instance);
    }
  }, []);

  const value = useMemo(() => ({ magic }), [magic]);

  return <MagicContext.Provider value={value}>{children}</MagicContext.Provider>;
}
```

**Polygon Network Configuration:**
- **Mainnet:** `rpcUrl: 'https://polygon-rpc.com/'`, `chainId: 137`
- **Testnet (Amoy):** `rpcUrl: 'https://rpc-amoy.polygon.technology/'`, `chainId: 80002`
- **Block Explorer:** https://polygonscan.com/ (mainnet), https://www.oklink.com/amoy (testnet)
- **Faucet:** https://faucet.polygon.technology/ (testnet)

**Benefits:**
- Prevents instance recreation on re-renders
- Better SSR compatibility (only initializes client-side)
- Follows Magic's official Next.js pattern
- Single source of truth for Magic instance

**Migration:** Replace all direct Magic imports with `useMagic()` hook calls.

**Ethers.js Integration:**
```typescript
import { ethers } from 'ethers';
import { useMagic } from '@/lib/magic/provider';

const { magic } = useMagic();
const provider = new ethers.providers.Web3Provider(magic.rpcProvider as never);
const signer = await provider.getSigner();
```

**Note:** Doji uses Ethers v5. The pattern is the same for v6 (`ethers.BrowserProvider` instead of `ethers.providers.Web3Provider`).

### Wallet Kit Configuration
> Requirement 10: Magic Wallet Kit Integration & Requirement 12: Dashboard Configuration

**Reown Project ID (Required for Production):**
- Get free project ID at https://dashboard.walletconnect.com
- Add to `apps/web/.env.local`: `NEXT_PUBLIC_REOWN_PROJECT_ID=...`
- Pass to `WalletKitExtension({ projectId: '...' })`
- Default project ID works for development but will hit rate limits

**Dashboard Configuration:**
- **Disable email authentication** in Magic Dashboard settings
- Enable desired OAuth providers (Google, Apple, GitHub, etc.)
- Configure OAuth Client ID and Client Secret for each provider
- **Redirect URI setup:**
  - If using Wallet Kit: Copy redirect URI from Magic Dashboard (under "Magic Login Widget")
  - Add redirect URI to each OAuth provider's dashboard (Google, GitHub, etc.)
- Set theme colors and branding (automatically applied to widget)
- **Google-specific:** Set publishing status to "In production" to avoid "Access blocked" errors
- **Widget UI Settings (Customization → Widget UI):**
  - Enable Transaction Signing UI for transaction confirmation prompts
  - Enable Personal Signature UI for message signing prompts (`personal_sign`, `signTypedData_v3/v4`)
  - **NFT toggle:** Hide or show collectibles (applies across all UI methods)
  - **Note:** Client must be reloaded/refreshed after toggling settings
  - **Supported blockchains:** Ethereum, Polygon, Base, Arbitrum, Optimism
- **Sign Confirmation (Settings → Sign Confirmation):**
  - **Recommended:** Enable "Enable confirmation in new tab" for additional security
  - Protects users from front-end attacks by opening confirmation in Magic-hosted browser window
  - Adds extra layer of security when signing transactions and messages
  - **Note:** Wallets are opted out by default; must be explicitly enabled
- **Content Security Policy (Settings → Content Security Policy):**
  - Add custom Polygon RPC URL to Magic's internal CSP whitelist
  - Required for Magic's iframe to connect to your RPC node

**Widget Props to Configure:**
```typescript
<MagicWidget
  displayMode="modal"              // or "inline"
  wallets={['metamask', 'coinbase', 'walletconnect']}
  enableFarcaster={true}
  closeOnSuccess={true}
  closeOnClickOutside={true}
  onSuccess={(result) => {
    // Handle email, oauth, farcaster, or wallet results
  }}
  onError={(error) => {
    // Handle errors
  }}
  onReady={() => {
    // Widget initialized, hide loading state
  }}
/>
```

### Result Type Handling

The widget returns different result structures based on auth method:

```typescript
// OAuth (Google, Apple, etc.)
{ method: 'oauth', oauth: {...}, magic: { idToken, userMetadata } }

// Farcaster
{ method: 'farcaster', didToken: string, farcaster: { fid, username, ... } }

// External wallet (MetaMask, etc.)
{ method: 'wallet', walletAddress: string }
```

**Implementation Note:** For OAuth, use `result.magic.idToken` for backend verification. For Farcaster, use `result.didToken`. External wallet connections don't create a Magic user — handle separately.

### Migration from Custom Login

**Components to Remove:**
- `apps/web/src/components/auth/login-form.tsx` (replaced by `<MagicWidget />`)
- Custom OAuth button components (if any)
- Email OTP input components (remove entirely — no longer supported)

**Components to Update:**
- `apps/web/src/app/layout.tsx` — wrap with `<MagicProvider>`
- `apps/web/src/app/login/page.tsx` — render `<MagicWidget />` instead of custom form
- `apps/web/src/app/login/callback/page.tsx` — evaluate if needed (Wallet Kit may handle OAuth redirect internally); simplify or remove
- All components using direct Magic imports — replace with `useMagic()` hook
- Remove any calls to `magic.auth.loginWithEmailOTP()` (no longer supported)
- Remove any calls to `magic.oauth2.loginWithRedirect()` (Wallet Kit handles OAuth internally)

**Store Updates:**
- Update auth store to handle different result types
- Store Farcaster profile data if using Farcaster login
- Handle external wallet connections (no Magic user created)

### Web3 Library Integration

Magic integrates with popular blockchain libraries (Web3.js, Ethers.js). Current implementation uses Ethers v5:

```typescript
// Current pattern (keep this)
const provider = new Web3Provider(magic.rpcProvider as never);
const signer = await provider.getSigner(address);
```

**Note:** Magic's docs show Web3.js examples, but Doji uses Ethers.js. The pattern is the same — wrap `magic.rpcProvider` with your chosen library's provider class.

