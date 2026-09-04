# Requirements Document

## Introduction

This document specifies the requirements for auditing and fixing the Magic Link + Gnosis Safe integration in the Doji monorepo. The existing `magic-auth-integration` spec was implemented but a subsequent audit (`docs/magic-safe-builder-audit.md`) identified gaps between the reference implementation and Doji. Some issues have since been resolved (OAuth callback page exists, `initializeTrading` dead code removed, sign route uses `buildHmacSignature`, session token wired in tRPC client). This spec addresses the remaining gaps: duplicated credential derivation logic, missing CSP headers, missing Magic SDK type augmentation, missing wallet management features (key export, transaction signing UI), and token approval/signing hardening.

## Glossary

- **Magic_Signer_Helper**: A shared utility module that creates an ethers signer from a Magic SDK instance and resolves the user's EOA address, eliminating duplicated signer creation logic across hooks.
- **CLOB_Credential_Helper**: A shared utility function (`getOrCreateClobCredentials`) that derives or creates CLOB API credentials from a Magic signer, replacing duplicated `deriveOrCreateApiKey` flows in `useDeploySafe`, `useClobClient`, and `place-order-client.ts`.
- **CSP_Headers**: Content Security Policy HTTP response headers that control which origins can load resources (scripts, frames, connections) in the browser. Magic SDK requires `frame-src https://auth.magic.link` to function.
- **Magic_Type_Augmentation**: A TypeScript declaration file that extends the Magic SDK's `UserInfo` type to include the `wallets` property, which exists at runtime but is missing from the published type definitions.
- **Signer_Pattern**: The repeated code pattern across `useDeploySafe`, `useClobClient`, `useSetTokenApprovals`, and `place-order-client.ts` that creates a `Web3Provider` from `magic.rpcProvider`, calls `eth_requestAccounts`, resolves the EOA address, and returns an ethers `Signer`.
- **Key_Export**: Magic SDK's `magic.user.requestExport()` method that allows users to export their embedded wallet's private key for backup or migration to an external wallet.
- **Transaction_Signing_UI**: Magic SDK's built-in UI components for displaying transaction details and requesting user confirmation before signing blockchain transactions.
- **Token_Approval_Transaction**: An on-chain transaction that grants a smart contract (e.g. Polymarket Exchange, Neg Risk Exchange) permission to spend a user's tokens (USDC.e, CTF outcome tokens).

## Requirements

### Requirement 1: Extract Shared Magic Signer Helper

**User Story:** As a developer, I want a single shared utility for creating an ethers signer from Magic's provider, so that the duplicated signer creation pattern across four files is consolidated and consistent.

#### Acceptance Criteria

1. THE Magic_Signer_Helper SHALL accept a Magic SDK instance and an optional wallet address, and return an ethers `Signer` and the resolved EOA address.
2. WHEN the optional wallet address is not provided, THE Magic_Signer_Helper SHALL retrieve the address from `magic.user.getInfo()` using the `wallets.ethereum.publicAddress` or `publicAddress` fallback.
3. THE Magic_Signer_Helper SHALL call `eth_requestAccounts` on the provider before creating the signer, matching the current pattern in all four call sites.
4. WHEN `magic.user.getInfo()` returns no usable address and no wallet address was provided, THE Magic_Signer_Helper SHALL throw a descriptive error.
5. WHEN the Magic_Signer_Helper is integrated, THE `useDeploySafe`, `useClobClient`, `useSetTokenApprovals`, and `place-order-client.ts` modules SHALL use the shared helper instead of inline signer creation.

### Requirement 2: Extract Shared CLOB Credential Derivation Helper

**User Story:** As a developer, I want a single shared utility for deriving CLOB API credentials from a Magic signer, so that the duplicated `deriveOrCreateApiKey` flow is consolidated.

#### Acceptance Criteria

1. THE CLOB_Credential_Helper SHALL accept an ethers `Signer` and return `ApiKeyCreds` (`{ key, secret, passphrase }`).
2. THE CLOB_Credential_Helper SHALL create a temporary `ClobClient` with `useServerTime: true`, call `deriveOrCreateApiKey`, and return the result.
3. WHEN the CLOB_Credential_Helper is integrated, THE `useDeploySafe`, `useClobClient`, and `place-order-client.ts` modules SHALL use the shared helper instead of inline credential derivation.
4. FOR ALL valid ethers Signers, calling the CLOB_Credential_Helper twice with the same signer SHALL return equivalent credentials (idempotence of derive).

### Requirement 3: Add Content Security Policy Headers for Magic SDK

**User Story:** As a platform operator, I want CSP headers configured to allow Magic SDK iframes and connections, so that authentication works correctly in production without browser security violations.

#### Acceptance Criteria

1. THE web application SHALL include a `Content-Security-Policy` header that allows `frame-src https://auth.magic.link`.
2. THE CSP header SHALL allow `connect-src` to Magic's API endpoints (`https://*.magic.link`) and the Polygon RPC URL.
3. THE CSP header SHALL be configured in `apps/web/vercel.json` alongside the existing security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`).
4. IF the CSP header blocks a required Magic SDK resource, THEN the browser console SHALL display a CSP violation report identifying the blocked resource.

### Requirement 4: Add Magic SDK Type Augmentation

**User Story:** As a developer, I want proper TypeScript type definitions for Magic SDK's `wallets` property on `UserInfo`, so that accessing `userInfo.wallets?.ethereum?.publicAddress` does not require unsafe type casts.

#### Acceptance Criteria

1. THE codebase SHALL include a TypeScript declaration file that augments the Magic SDK `UserInfo` type to include the `wallets` property with shape `{ ethereum?: { publicAddress?: string } }`.
2. WHEN the type augmentation is applied, THE existing `as` casts for `magic.user.getInfo()` results in `useDeploySafe`, `useClobClient`, `useSetTokenApprovals`, and `place-order-client.ts` SHALL be removed.
3. THE type augmentation file SHALL be included in the `apps/web/tsconfig.json` type roots or file includes so it is automatically picked up.

### Requirement 5: Harden OAuth Callback Error Handling

**User Story:** As a user, I want the OAuth callback page to handle edge cases gracefully, so that I am not stuck on a blank page if the callback fails.

#### Acceptance Criteria

1. WHEN the OAuth callback page loads without valid OAuth query parameters (e.g. user navigates directly to `/login/callback`), THE system SHALL display an error message and a link to return to the login page.
2. WHEN the Magic SDK is still loading during the OAuth callback, THE system SHALL display a loading indicator until the SDK is ready.
3. IF the OAuth callback processing takes longer than 30 seconds, THEN THE system SHALL display a timeout message with a retry option.
4. WHEN the OAuth callback fails, THE system SHALL log the error with sufficient context for debugging (provider, error type, timestamp).

### Requirement 6: Wallet Key Export

**User Story:** As a user, I want to export my embedded wallet's private key, so that I can back up my key or migrate to an external wallet if needed.

#### Acceptance Criteria

1. WHEN an authenticated user requests key export from the settings or user menu, THE system SHALL call `magic.user.requestExport()` to display Magic's built-in key export UI.
2. THE key export option SHALL be accessible from the user menu component (`user-menu.tsx`) as a clearly labeled action.
3. IF the key export request fails or the user cancels, THEN THE system SHALL handle the rejection gracefully without disrupting the current page state.
4. THE system SHALL display a warning to the user before initiating key export, explaining that the private key should be stored securely and never shared.

### Requirement 7: Transaction Signing Confirmation UI

**User Story:** As a trader, I want to see transaction details before signing, so that I can verify what I am approving before it executes on-chain.

#### Acceptance Criteria

1. WHEN a user initiates a Safe deployment, THE system SHALL display the transaction type and estimated gas cost before requesting the user's signature via Magic's signing flow.
2. WHEN a user initiates token approval transactions, THE system SHALL display which contracts are being approved and for which tokens (USDC.e, CTF) before requesting the signature.
3. WHEN a transaction signing request is pending, THE system SHALL display a loading state indicating the transaction is awaiting user confirmation in the Magic wallet UI.
4. IF the user rejects a transaction signing request in the Magic wallet UI, THEN THE system SHALL cancel the operation and display a descriptive message explaining the transaction was not signed.

### Requirement 8: Token Approval Status and Recovery

**User Story:** As a trader, I want to see the status of my token approvals and re-run them if needed, so that I can recover from failed or missing approvals without redeploying my Safe.

#### Acceptance Criteria

1. WHEN a user has a deployed Safe but token approvals are missing or insufficient, THE system SHALL detect the condition and prompt the user to run approvals.
2. THE system SHALL provide a UI action (button or link) in the onboarding or settings flow to re-run token approvals using the `useSetTokenApprovals` hook.
3. WHEN token approvals are being set, THE system SHALL display progress feedback indicating which approval step is in progress (USDC.e for CTF Exchange, USDC.e for Neg Risk Exchange, CTF for Exchange, CTF for Neg Risk Exchange).
4. IF a token approval transaction fails, THEN THE system SHALL display the specific error and allow the user to retry the failed approval.
5. WHEN all required token approvals are confirmed on-chain, THE system SHALL update the UI to reflect the user is ready to trade.

### Requirement 9: Clean Up Redundant CLOB Auth Utilities

**User Story:** As a developer, I want unused or redundant auth utilities removed, so that the codebase is lean and there is a single source of truth for each auth concern.

#### Acceptance Criteria

1. WHEN the shared Magic_Signer_Helper and CLOB_Credential_Helper are in place, THE `clob-auth.ts` module SHALL be reviewed for functions that duplicate functionality provided by the shared helpers or by `@polymarket/builder-signing-sdk`.
2. THE `hmacSha256` and `signBuilderRequest` functions in `clob-auth.ts` SHALL be evaluated for removal since builder signing is handled server-side via the `/sign` endpoint and `buildHmacSignature` from the SDK.
3. IF any function in `clob-auth.ts` is still referenced by active code, THEN THE function SHALL be retained with a comment explaining its purpose.
4. IF a function in `clob-auth.ts` has zero import references, THEN THE function SHALL be removed.

### Requirement 10: Magic Wallet Kit Integration

**User Story:** As a user, I want to authenticate using multiple methods (OAuth, Farcaster, external wallets) through a unified interface, so that I have flexibility in how I access the platform.

#### Acceptance Criteria

1. THE web application SHALL use Magic's Wallet Kit component (`@magic-ext/wallet-kit`) for authentication instead of custom login forms.
2. THE Wallet Kit SHALL be configured to support OAuth providers (Google, Apple, GitHub, etc.), Farcaster login, and external wallets (MetaMask, Coinbase, WalletConnect).
3. THE system SHALL disable email OTP authentication in the Magic Dashboard, supporting only OAuth, Farcaster, and external wallet authentication.
4. WHEN a user authenticates via OAuth, THE system SHALL receive an `idToken` for backend verification.
5. WHEN a user authenticates via Farcaster, THE system SHALL receive a `didToken` and Farcaster profile data.
6. WHEN a user connects an external wallet, THE system SHALL receive the wallet address without creating a Magic user.
7. THE Wallet Kit SHALL be configured with a Reown project ID for WalletConnect support.

### Requirement 11: Magic Provider Pattern

**User Story:** As a developer, I want Magic SDK initialized using React Context Provider pattern, so that the instance is properly managed across the application lifecycle and follows Next.js best practices.

#### Acceptance Criteria

1. THE Magic SDK instance SHALL be initialized in a React Context Provider component (`MagicProvider`) using `useEffect` and `useMemo`.
2. THE `MagicProvider` SHALL export a `useMagic()` hook that components use to access the Magic instance.
3. THE application root layout SHALL wrap the app with `<MagicProvider>` to make Magic available throughout the component tree.
4. ALL components that currently import Magic directly SHALL be refactored to use the `useMagic()` hook instead.
5. THE Magic instance SHALL only be created client-side (not during SSR) to avoid hydration issues.

### Requirement 12: Dashboard Configuration

**User Story:** As a platform operator, I want Magic Dashboard properly configured with all required settings, so that authentication, signing UIs, and security features work correctly in production.

#### Acceptance Criteria

1. THE Magic Dashboard SHALL have email authentication disabled under authentication settings.
2. THE Magic Dashboard SHALL have OAuth providers (Google, Apple, GitHub, etc.) enabled with Client ID and Client Secret configured for each.
3. THE Magic Dashboard SHALL have the OAuth redirect URI configured for Wallet Kit under "Magic Login Widget" settings.
4. THE Magic Dashboard SHALL have Transaction Signing UI enabled under Customization → Widget UI.
5. THE Magic Dashboard SHALL have Personal Signature UI enabled under Customization → Widget UI.
6. THE Magic Dashboard SHALL have Sign Confirmation enabled under Settings → Sign Confirmation for additional security.
7. THE Magic Dashboard SHALL have the custom Polygon RPC URL whitelisted under Settings → Content Security Policy.
8. THE Magic Dashboard SHALL have theme colors and branding configured under Customization → Brand and Theme.

### Requirement 13: Server-Side DID Token Verification

**User Story:** As a platform operator, I want DID tokens validated on the server, so that user authentication is secure and cannot be bypassed by client-side manipulation.

#### Acceptance Criteria

1. THE server SHALL use Magic Admin SDK (`@magic-sdk/admin`) to validate DID tokens received from the client.
2. WHEN a client sends a request with an `Authorization: Bearer <didToken>` header, THE server SHALL parse the header using `magic.utils.parseAuthorizationHeader()`.
3. THE server SHALL validate the DID token using `magic.token.validate(didToken)` before processing the request.
4. WHEN token validation succeeds, THE server SHALL fetch user metadata using `magic.users.getMetadataByToken(didToken)`.
5. WHEN token validation fails, THE server SHALL return an appropriate error response (401 Unauthorized) with error details.
6. THE server SHALL implement structured error handling for Magic SDK errors (TokenExpired, IncorrectSignerAddress, MalformedTokenError).

### Requirement 14: Rate Limiting Handling

**User Story:** As a platform operator, I want rate limiting properly handled, so that the application gracefully handles Magic API rate limits and doesn't fail during traffic spikes.

#### Acceptance Criteria

1. THE server SHALL detect Magic API rate limit errors (HTTP 429) and implement exponential backoff for retries.
2. THE server SHALL cache user metadata after validation to reduce Magic API calls.
3. THE system SHALL monitor Magic API usage metrics to track rate limit consumption.
4. WHEN rate limits are consistently approached, THE platform operator SHALL be notified to contact Magic sales for limit increases.
5. THE system SHALL implement request queuing for high-traffic scenarios to avoid exceeding rate limits.

### Requirement 15: Error Handling Patterns

**User Story:** As a developer, I want consistent error handling patterns for Magic SDK operations, so that errors are properly identified, logged, and handled across the application.

#### Acceptance Criteria

1. THE application SHALL use `instanceof` checks to identify Magic SDK error types (SDKError, RPCError, ExtensionError).
2. WHEN an RPCError occurs, THE system SHALL use error codes (RPCErrorCode enum) to deterministically identify the error type.
3. THE application SHALL implement structured error handling in auth hooks and components with specific handling for common errors (UserAlreadyLoggedIn, MagicLinkRateLimited, TokenExpired).
4. THE application SHALL log errors with sufficient context for debugging (error code, message, timestamp, user context).
5. THE application SHALL display user-friendly error messages based on error codes rather than raw error messages.
