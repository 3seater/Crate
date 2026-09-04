# Implementation Tasks: Magic-Safe Audit

## Task 1: Extract Shared Magic Signer Helper
> Requirement 1: Extract Shared Magic Signer Helper

- [ ] 1.1 Create `apps/web/src/lib/magic/signer.ts` with `getMagicSigner(magic, walletAddress?)` that returns `{ signer, address }`
  - Accept a Magic SDK instance and optional wallet address
  - Call `magic.user.getInfo()` to resolve address from `wallets.ethereum.publicAddress` or `publicAddress` fallback when no address provided
  - Call `eth_requestAccounts` on the provider before creating the signer
  - Throw a descriptive error when no address can be resolved
  - Return the ethers `Signer` and resolved EOA address string
- [ ] 1.2 Refactor `apps/web/src/hooks/use-deploy-safe.ts` to use `getMagicSigner` instead of inline signer creation
- [ ] 1.3 Refactor `apps/web/src/hooks/use-clob-client.ts` to use `getMagicSigner` instead of inline signer creation
- [ ] 1.4 Refactor `apps/web/src/hooks/use-set-token-approvals.ts` to use `getMagicSigner` instead of inline signer creation
- [ ] 1.5 Refactor `apps/web/src/lib/polymarket/place-order-client.ts` to use `getMagicSigner` instead of inline signer creation
- [ ] 1.6 Write unit tests for `getMagicSigner` in `apps/web/src/lib/magic/signer.test.ts`
  - Test: returns signer and address when walletAddress is provided
  - Test: resolves address from `magic.user.getInfo()` when walletAddress is not provided
  - Test: throws descriptive error when no address can be resolved

## Task 2: Extract Shared CLOB Credential Derivation Helper
> Requirement 2: Extract Shared CLOB Credential Derivation Helper

- [ ] 2.1 Create `apps/web/src/lib/magic/clob-credentials.ts` with `getOrCreateClobCredentials(signer)` that returns `ApiKeyCreds`
  - Create a temporary `ClobClient` with `useServerTime: true`
  - Call `deriveOrCreateApiKey` and return the result
- [ ] 2.2 Refactor `apps/web/src/hooks/use-deploy-safe.ts` to use `getOrCreateClobCredentials` instead of inline credential derivation
- [ ] 2.3 Refactor `apps/web/src/hooks/use-clob-client.ts` to use `getOrCreateClobCredentials` instead of inline credential derivation
- [ ] 2.4 Refactor `apps/web/src/lib/polymarket/place-order-client.ts` to use `getOrCreateClobCredentials` instead of inline credential derivation
- [ ] 2.5 Write unit tests for `getOrCreateClobCredentials` in `apps/web/src/lib/magic/clob-credentials.test.ts`
  - Test: creates a ClobClient with useServerTime and calls deriveOrCreateApiKey
  - Test: returns the credentials from deriveOrCreateApiKey

## Task 3: Add Content Security Policy Headers for Magic SDK
> Requirement 3: Add Content Security Policy Headers for Magic SDK

- [ ] 3.1 Add `Content-Security-Policy` header to `apps/web/vercel.json` alongside existing security headers
  - Allow `frame-src 'self' https://auth.magic.link`
  - Allow `connect-src 'self' https://*.magic.link https://*.polygon-rpc.com https://polygon-rpc.com https://*.polymarket.com wss://*.polymarket.com`
- [ ] 3.2 Add CSP meta tag or Next.js middleware fallback for local development (vercel.json headers only apply in production)

## Task 4: Add Magic SDK Type Augmentation
> Requirement 4: Add Magic SDK Type Augmentation

- [ ] 4.1 Create `apps/web/src/types/magic.d.ts` that augments `magic-sdk` module to add `wallets` property to `UserInfo`
  - Shape: `wallets?: { ethereum?: { publicAddress?: string } }`
- [ ] 4.2 Ensure `apps/web/tsconfig.json` includes the type augmentation file (check `include` or `typeRoots`)
- [ ] 4.3 Remove `as` type casts for `magic.user.getInfo()` results in `use-deploy-safe.ts`, `use-clob-client.ts`, `use-set-token-approvals.ts`, and `place-order-client.ts`
  - Note: The shared `getMagicSigner` helper from Task 1 should already use the augmented type; verify the casts are gone from all call sites

## Task 5: Harden OAuth Callback Error Handling
> Requirement 5: Harden OAuth Callback Error Handling

- [ ] 5.1 Update `apps/web/src/app/login/callback/page.tsx` to detect direct navigation (no OAuth query params) and show error with link back to `/login`
- [ ] 5.2 Add a loading indicator while Magic SDK is initializing during the callback
- [ ] 5.3 Add a 30-second timeout that shows a timeout message with a retry option
- [ ] 5.4 Add structured error logging on callback failure (provider, error type, timestamp)

## Task 6: Wallet Key Export
> Requirement 6: Wallet Key Export

- [ ] 6.1 Add "Export Private Key" menu item to `apps/web/src/components/auth/user-menu.tsx`
  - Add a `Key` icon menu item in the Wallets group
  - Show a confirmation warning dialog before calling `magic.user.requestExport()`
  - Handle rejection/cancellation gracefully without disrupting page state

## Task 7: Transaction Signing Confirmation UI
> Requirement 7: Transaction Signing Confirmation UI

- [ ] 7.1 Update `apps/web/src/components/onboarding/safe-onboarding.tsx` to show descriptive transaction context at each step
  - "Deploying your trading wallet (gasless)..." instead of generic "Deploying Safe..."
  - "Approving USDC.e and outcome tokens for trading..." with per-approval step indicators
- [ ] 7.2 Add a loading/pending state indicator when a transaction is awaiting user confirmation in the Magic wallet UI
- [ ] 7.3 Handle user rejection of transaction signing with a descriptive cancellation message

## Task 8: Token Approval Status and Recovery
> Requirement 8: Token Approval Status and Recovery

- [ ] 8.1 Add approval status detection logic that checks if a user with a deployed Safe has missing or insufficient token approvals
- [ ] 8.2 Add a "Fix Approvals" action in `apps/web/src/components/auth/user-menu.tsx` (visible when Safe exists but approvals may be missing)
  - Use the existing `useSetTokenApprovals` hook to re-run approvals
- [ ] 8.3 Add progress feedback UI showing which approval step is in progress (USDC.e for CTF Exchange, USDC.e for Neg Risk Exchange, CTF for Exchange, CTF for Neg Risk Exchange)
- [ ] 8.4 Handle approval transaction failures with specific error display and retry option
- [ ] 8.5 Update UI to reflect "ready to trade" state when all approvals are confirmed on-chain

## Task 9: Clean Up Redundant CLOB Auth Utilities
> Requirement 9: Clean Up Redundant CLOB Auth Utilities

- [ ] 9.1 Audit `apps/web/src/lib/auth/clob-auth.ts` for functions that duplicate the shared helpers or `@polymarket/builder-signing-sdk`
  - Check import references for `hmacSha256`, `signBuilderRequest`, `getSignatureType`, `ApiCredentials`, `BuilderCredentials`, `BuilderL2Headers`
- [ ] 9.2 Remove functions with zero import references
- [ ] 9.3 Add explanatory comments to any retained functions explaining why they are still needed
- [ ] 9.4 Verify no runtime breakage after cleanup by running `pnpm check-types` and `pnpm build` for the web app

## Task 10: Implement Magic Wallet Kit Integration
> Requirement 10: Magic Wallet Kit Integration

- [ ] 10.1 Install `@magic-ext/wallet-kit` package in `apps/web`
- [ ] 10.2 Create Reown (WalletConnect) project at https://dashboard.walletconnect.com and obtain project ID
- [ ] 10.3 Add `NEXT_PUBLIC_REOWN_PROJECT_ID` to `apps/web/.env.local`
- [ ] 10.4 Replace custom login components with `<MagicWidget />` in `apps/web/src/app/login/page.tsx`
  - Configure `displayMode`, `wallets`, `enableFarcaster`, `closeOnSuccess`, `closeOnClickOutside`
  - Implement `onSuccess` handler for OAuth, Farcaster, and external wallet results
  - Implement `onError` handler
  - Implement `onReady` handler to hide loading state
- [ ] 10.5 Remove deprecated custom login components (`apps/web/src/components/auth/login-form.tsx`)
- [ ] 10.6 Update auth store to handle different result types (OAuth `idToken`, Farcaster `didToken`, external wallet address)
- [ ] 10.7 Disable email authentication in Magic Dashboard settings

## Task 11: Implement Magic Provider Pattern
> Requirement 11: Magic Provider Pattern

- [ ] 11.1 Create `apps/web/src/lib/magic/provider.tsx` with `MagicProvider` component
  - Initialize Magic in `useEffect` with network config (Polygon mainnet, chainId 137)
  - Initialize with `WalletKitExtension` passing Reown project ID
  - Use `useMemo` for context value
  - Export `useMagic()` hook
- [ ] 11.2 Update `apps/web/src/app/layout.tsx` to wrap app with `<MagicProvider>`
- [ ] 11.3 Refactor all components using direct Magic imports to use `useMagic()` hook
  - `use-deploy-safe.ts`
  - `use-clob-client.ts`
  - `use-set-token-approvals.ts`
  - `place-order-client.ts`
  - `user-menu.tsx`
  - `safe-onboarding.tsx`
- [ ] 11.4 Remove old Magic singleton initialization from `apps/web/src/lib/magic/index.ts`
- [ ] 11.5 Update `apps/web/src/lib/magic/index.ts` to re-export `useMagic` hook

## Task 12: Configure Magic Dashboard
> Requirement 12: Dashboard Configuration

- [ ] 12.1 Disable email authentication in Magic Dashboard → Authentication settings
- [ ] 12.2 Enable OAuth providers (Google, Apple, GitHub) in Magic Dashboard → Social Login
  - Create OAuth apps in Google/Apple/GitHub developer consoles
  - Obtain Client ID and Client Secret for each provider
  - Configure Client ID and Client Secret in Magic Dashboard
  - Set Google app publishing status to "In production"
- [ ] 12.3 Configure OAuth redirect URI in Magic Dashboard → Social Login → Magic Login Widget
  - Copy redirect URI from dashboard
  - Add redirect URI to each OAuth provider's authorized redirect URIs
- [ ] 12.4 Enable Transaction Signing UI in Magic Dashboard → Customization → Widget UI
- [ ] 12.5 Enable Personal Signature UI in Magic Dashboard → Customization → Widget UI
- [ ] 12.6 Enable Sign Confirmation in Magic Dashboard → Settings → Sign Confirmation
- [ ] 12.7 Add Polygon RPC URL to Magic Dashboard → Settings → Content Security Policy
- [ ] 12.8 Configure theme colors and branding in Magic Dashboard → Customization → Brand and Theme

## Task 13: Implement Server-Side DID Token Verification
> Requirement 13: Server-Side DID Token Verification

- [ ] 13.1 Ensure `@magic-sdk/admin` is installed in `apps/server`
- [ ] 13.2 Initialize Magic Admin SDK in `apps/server/src/lib/magic/index.ts` with `MAGIC_SECRET_KEY`
- [ ] 13.3 Create tRPC auth middleware that validates DID tokens
  - Parse `Authorization` header using `magic.utils.parseAuthorizationHeader()`
  - Validate token using `magic.token.validate(didToken)`
  - Fetch user metadata using `magic.users.getMetadataByToken(didToken)`
  - Attach user metadata to tRPC context
- [ ] 13.4 Implement structured error handling for Magic SDK errors
  - Handle `TokenExpired` → return 401 with "Token expired" message
  - Handle `IncorrectSignerAddress` → return 401 with "Invalid signature" message
  - Handle `MalformedTokenError` → return 400 with "Invalid token format" message
- [ ] 13.5 Update tRPC routers to use auth middleware for protected procedures
- [ ] 13.6 Add server-side tests for token validation and error handling

## Task 14: Implement Rate Limiting Handling
> Requirement 14: Rate Limiting Handling

- [ ] 14.1 Implement rate limit error detection (HTTP 429) in server Magic SDK calls
- [ ] 14.2 Implement exponential backoff retry logic for rate-limited requests
- [ ] 14.3 Implement user metadata caching in database/session to reduce Magic API calls
  - Cache metadata after successful validation
  - Set cache TTL to match token lifespan (15 minutes default)
- [ ] 14.4 Add Magic API usage monitoring/logging
  - Log each Magic API call with timestamp
  - Track daily/hourly request counts
- [ ] 14.5 Implement request queuing for high-traffic scenarios
- [ ] 14.6 Document rate limit monitoring and escalation process in runbook

## Task 15: Implement Error Handling Patterns
> Requirement 15: Error Handling Patterns

- [ ] 15.1 Create error handling utility in `apps/web/src/lib/magic/errors.ts`
  - Export error type guards (`isRPCError`, `isSDKError`)
  - Export error code enums (`RPCErrorCode`, `SDKErrorCode`)
  - Export error message mapping function
- [ ] 15.2 Implement structured error handling in auth hooks
  - `use-deploy-safe.ts` — handle UserAlreadyLoggedIn, rate limiting
  - `use-clob-client.ts` — handle token errors, rate limiting
  - `use-set-token-approvals.ts` — handle transaction errors
- [ ] 15.3 Implement error logging with context
  - Log error code, message, timestamp, user context
  - Use structured logging format (JSON)
- [ ] 15.4 Create user-friendly error messages component
  - Map error codes to user-friendly messages
  - Display actionable error messages in UI
- [ ] 15.5 Add error boundary for Magic-related errors in app layout
