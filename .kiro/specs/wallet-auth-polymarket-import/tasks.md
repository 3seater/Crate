# Implementation Plan: Wallet Auth & Polymarket Safe Import

## Overview

Extend Doji's Magic-based auth to support MetaMask and Phantom wallet connections via Wallet Kit. Detect existing Polymarket Safes for connected EOAs, import them (register, derive credentials, check approvals), and bypass onboarding for seamless trading. Implementation touches the wallet store, a new import helper, the login component, and onboarding bypass logic.

## Tasks

- [x] 1. Extend wallet store with `authMethod` field
  - [x] 1.1 Add `authMethod` field and `setAuthMethod` action to `apps/web/src/stores/wallet.ts`
    - Add `authMethod: "email" | "wallet" | null` to `WalletState` (default `null`)
    - Add `setAuthMethod` action: `(method: "email" | "wallet") => set({ authMethod })`
    - Reset `authMethod` to `null` in `setDisconnected` / `clearAuthSession`
    - Add `authMethod` to the `partialize` persistence config
    - _Requirements: 8.1, 8.4_

  - [ ]* 1.2 Write property test for authMethod round-trip persistence
    - **Property 8: authMethod round-trip persistence**
    - **Validates: Requirements 8.4**

  - [ ]* 1.3 Write property test for authMethod reflects login method
    - **Property 7: authMethod reflects login method**
    - **Validates: Requirements 8.2, 8.3**

  - [ ]* 1.4 Write property test for auth session persistence
    - **Property 9: Auth session persistence**
    - **Validates: Requirements 2.4**

- [x] 2. Create `importExistingSafe` helper
  - [x] 2.1 Create `apps/web/src/lib/magic/import-safe.ts` with `importExistingSafe` function
    - Define `ImportSafeResult` interface: `{ imported: boolean; safeAddress: string | null }`
    - Implement steps: derive Safe address via `deriveSafe`, check `/deployed` endpoint, call `registerSafe`, derive CLOB credentials via `getOrCreateClobCredentials`, call `storeCredentials`, check approval status, execute approvals if needed
    - Handle errors per design: relayer failure → `{ imported: false }`, registration failure → throw, credential failure → log + return `{ imported: true }` without creds, approval failure → proceed (fail-open)
    - Add structured logging with `eoaPrefix`, `step`, `errorType`, `message`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 9.1, 9.2, 9.3, 9.4_

  - [ ]* 2.2 Write property test for Safe derivation determinism
    - **Property 1: Safe derivation is deterministic**
    - **Validates: Requirements 3.1**

  - [ ]* 2.3 Write property test for import result mirrors deployment status
    - **Property 2: Import result mirrors deployment status**
    - **Validates: Requirements 3.3, 3.4, 3.5**

  - [ ]* 2.4 Write property test for approval execution matches approval status
    - **Property 4: Approval execution matches approval status**
    - **Validates: Requirements 5.2, 5.3, 5.4**

  - [ ]* 2.5 Write unit tests for `importExistingSafe` edge cases
    - Test network error during `/deployed` check returns `{ imported: false }`
    - Test registration failure (EOA not owner) throws descriptive error
    - Test credential derivation failure still returns `{ imported: true, safeAddress }`
    - Test user signature rejection during credential derivation
    - Test structured error logging includes correct context fields
    - _Requirements: 3.5, 9.1, 9.2, 9.3, 9.4_

- [x] 3. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update `wallet-kit-login.tsx` with wallet list and import orchestration
  - [x] 4.1 Change `wallets` prop to `["metamask", "phantom"]` in `apps/web/src/components/auth/wallet-kit-login.tsx`
    - Replace `wallets={["metamask", "coinbase", "walletconnect"]}` with `wallets={["metamask", "phantom"]}`
    - _Requirements: 1.1_

  - [x] 4.2 Add import orchestration to `handleSuccess` callback
    - After `handleWalletKitLogin` succeeds, check `result.method === "wallet"`
    - Call `setAuthMethod("wallet")` or `setAuthMethod("email")` based on `result.method`
    - If wallet method and no `safeAddress` from server, call `importExistingSafe(magic, auth.user.walletAddress)`
    - On successful import: set `safeAddress`, set `onboardingCompleted(true)`, redirect to `/explore`
    - On import failure or no Safe found: fall through to `getPostAuthRedirectPath`
    - _Requirements: 1.2, 2.1, 2.2, 2.4, 4.3, 7.1, 7.2, 8.2, 8.3_

  - [ ]* 4.3 Write property test for post-import wallet store invariant
    - **Property 3: Post-import wallet store invariant**
    - **Validates: Requirements 4.3, 7.2**

  - [ ]* 4.4 Write property test for successful import bypasses onboarding
    - **Property 6: Successful import bypasses onboarding**
    - **Validates: Requirements 7.1**

  - [ ]* 4.5 Write unit tests for wallet-kit-login component integration
    - Test wallet list is exactly `["metamask", "phantom"]`
    - Test `authMethod` is set to `"wallet"` for external wallet login
    - Test `authMethod` is set to `"email"` for email login
    - Test import is called when method is wallet and no safeAddress
    - Test redirect to `/explore` on successful import
    - Test fallback to standard redirect when import fails
    - _Requirements: 1.1, 7.1, 8.2, 8.3, 9.1_

- [x] 5. Verify ClobClient configuration for imported Safes
  - [ ]* 5.1 Write property test for ClobClient configuration
    - **Property 5: ClobClient configuration for imported Safe**
    - **Validates: Requirements 6.3**

- [x] 6. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- No server-side changes needed — existing `registerSafe`, `storeCredentials`, and `checkApprovalStatus` procedures handle the import use case
- Test files go in `tests/unit/` per project convention: `import-safe.test.ts`, `wallet-store-auth.test.ts`, `wallet-kit-login.test.ts`
