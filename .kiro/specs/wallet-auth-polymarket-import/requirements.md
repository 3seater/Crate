# Requirements Document

## Introduction

Allow users to connect external wallets (MetaMask or Phantom) via Magic Wallet Kit to sign in and trade on Doji. When a connected wallet already has an existing Polymarket account (a deployed Gnosis Safe derived from that EOA), the system detects and imports it so the user lands on the trading page with their real Polymarket positions and balances — essentially signing into their everyday Polymarket account through Doji.

The existing Magic Link email auth and Safe onboarding flows remain unchanged. This feature extends the wallet login path (`method: "wallet"`) to detect, import, and configure existing Polymarket Safes. The supported external wallets are MetaMask and Phantom only.

## Glossary

- **Doji_App**: The Doji web application (Next.js frontend at `apps/web`).
- **Auth_Server**: The Doji tRPC server handling authentication, Safe registration, and credential storage (`apps/server`).
- **Wallet_Kit**: The Magic SDK Wallet Kit extension that handles external wallet connections (MetaMask and Phantom).
- **EOA**: Externally Owned Account — the user's standard Ethereum wallet address controlled by a private key.
- **Safe**: A Gnosis Safe smart contract wallet deployed on Polygon, deterministically derived from an EOA via the Polymarket Builder Relayer.
- **Builder_Relayer**: The Polymarket Builder Relayer service that deploys Safes and executes gasless transactions.
- **CLOB**: Polymarket's Central Limit Order Book for off-chain order matching.
- **CLOB_Credentials**: API key, secret, and passphrase derived from a signer, required to place orders on the CLOB.
- **Signature_Type**: Identifies the wallet type when signing orders — `0` (EOA), `1` (Magic proxy), `2` (Gnosis Safe).
- **Approval**: On-chain token allowance (USDC.e and CTF outcome tokens) that a Safe must grant to the CLOB exchange contracts before trading.
- **Import**: The process of detecting an existing Polymarket Safe for a connected EOA and registering it in Doji without deploying a new one.

## Requirements

### Requirement 1: Supported External Wallets

**User Story:** As a user, I want to connect my MetaMask or Phantom wallet to Doji, so that I can sign in using my preferred wallet.

#### Acceptance Criteria

1. THE Wallet_Kit SHALL be configured with exactly `["metamask", "phantom"]` as the supported wallets list, replacing the current `["metamask", "coinbase", "walletconnect"]`.
2. WHEN a user connects via MetaMask or Phantom, THE Doji_App SHALL authenticate the user using the same `handleWalletKitLogin` flow.

### Requirement 2: External Wallet Authentication

**User Story:** As a user, I want to connect my MetaMask or Phantom wallet to sign in, so that I can use Doji without needing an email.

#### Acceptance Criteria

1. WHEN a user connects an external wallet via Wallet_Kit, THE Doji_App SHALL obtain a DID token and the wallet's EOA address from Magic SDK.
2. WHEN a DID token and EOA address are obtained, THE Doji_App SHALL send them to the Auth_Server `login` procedure for validation and session creation.
3. WHEN the Auth_Server receives a valid DID token and wallet address, THE Auth_Server SHALL upsert the user record and return a session token and AuthUser object.
4. WHEN authentication succeeds, THE Doji_App SHALL persist the session token, user ID, EOA address, and Safe address (if any) in the wallet store.

### Requirement 3: Existing Safe Detection

**User Story:** As a user with an existing Polymarket account, I want Doji to detect my deployed Safe when I connect my wallet, so that I can use my real Polymarket positions and balances.

#### Acceptance Criteria

1. WHEN a user authenticates via an external wallet, THE Doji_App SHALL derive the deterministic Safe address from the EOA using `deriveSafe` and the Polymarket Safe factory address.
2. WHEN a derived Safe address is computed, THE Doji_App SHALL query the Builder_Relayer `/deployed` endpoint to check if the Safe is deployed on-chain.
3. WHEN the Builder_Relayer confirms the Safe is deployed, THE Doji_App SHALL mark the Safe as an existing Polymarket Safe and skip the Safe deployment step.
4. WHEN the Builder_Relayer indicates the Safe is not deployed, THE Doji_App SHALL proceed with the standard Safe deployment flow via the existing onboarding process.
5. IF the Builder_Relayer `/deployed` check fails due to a network error, THEN THE Doji_App SHALL fall back to the standard onboarding flow rather than blocking the user.

### Requirement 4: Existing Safe Import

**User Story:** As a user with an existing Polymarket Safe, I want Doji to import my Safe so I can trade with my existing positions and balances without deploying a new wallet.

#### Acceptance Criteria

1. WHEN an existing deployed Safe is detected for the connected EOA, THE Doji_App SHALL register the Safe address with the Auth_Server via the `registerSafe` procedure.
2. WHEN registering an imported Safe, THE Auth_Server SHALL verify on-chain that the Safe has bytecode and that the user's EOA is an owner of the Safe.
3. WHEN an imported Safe is successfully registered, THE Doji_App SHALL update the wallet store with the Safe address and set the Signature_Type to `GNOSIS_SAFE` (2).
4. WHEN an imported Safe is successfully registered, THE Doji_App SHALL derive CLOB_Credentials from the external wallet's signer and persist them via the `storeCredentials` procedure.

### Requirement 5: Approval Status Check for Imported Safes

**User Story:** As a user importing an existing Polymarket Safe, I want Doji to check my approval status rather than blindly re-approving, so that unnecessary transactions are avoided.

#### Acceptance Criteria

1. WHEN an existing Safe is imported, THE Doji_App SHALL query the Auth_Server `checkApprovalStatus` procedure to determine if USDC.e and CTF token approvals are already set.
2. WHEN the approval check indicates approvals are already set, THE Doji_App SHALL skip the approval transaction step.
3. WHEN the approval check indicates approvals are missing, THE Doji_App SHALL execute the approval transactions via the Builder_Relayer before proceeding.
4. IF the approval status check fails, THEN THE Doji_App SHALL proceed with running approvals as a safe default.

### Requirement 6: External Wallet Signer for Credential Derivation

**User Story:** As a user who connected an external wallet, I want my CLOB credentials derived from my wallet's signer, so that I can place orders authenticated by my own wallet.

#### Acceptance Criteria

1. WHEN an external wallet is connected, THE Doji_App SHALL create an ethers signer from the external wallet's provider (via Magic's `rpcProvider` bridge) rather than from Magic's embedded wallet.
2. WHEN deriving CLOB_Credentials for an external wallet user, THE Doji_App SHALL use the external wallet signer to call `getOrCreateClobCredentials`.
3. WHEN creating a ClobClient for an external wallet user with an imported Safe, THE Doji_App SHALL set the `funderAddress` to the imported Safe address and the `signatureType` to `GNOSIS_SAFE` (2).

### Requirement 7: Seamless Post-Import Redirect

**User Story:** As a user who connected a wallet with an existing Polymarket account, I want to land on the trading page with my positions visible, so that the experience feels seamless.

#### Acceptance Criteria

1. WHEN Safe detection, import, and credential derivation complete successfully, THE Doji_App SHALL redirect the user to the trading page without requiring manual onboarding steps.
2. WHEN an imported Safe is fully configured, THE Doji_App SHALL set `onboardingCompleted` to true in the wallet store so the onboarding flow is bypassed.
3. WHEN the user lands on the trading page after import, THE Doji_App SHALL initialize the CLOB client with the imported Safe's credentials so positions and balances are immediately available.

### Requirement 8: Wallet Store State for External Wallet Users

**User Story:** As a developer, I want the wallet store to distinguish between Magic embedded wallet users and external wallet users, so that the correct signer and signature type are used throughout the app.

#### Acceptance Criteria

1. THE Doji_App wallet store SHALL include an `authMethod` field that distinguishes between `"email"` (Magic embedded wallet) and `"wallet"` (external wallet connection).
2. WHEN a user authenticates via an external wallet, THE Doji_App SHALL set `authMethod` to `"wallet"` in the wallet store.
3. WHEN a user authenticates via email (Magic Link), THE Doji_App SHALL set `authMethod` to `"email"` in the wallet store.
4. THE Doji_App SHALL persist the `authMethod` field across page reloads via the wallet store's persistence configuration.

### Requirement 9: Error Handling During Import

**User Story:** As a user, I want clear feedback if something goes wrong during Safe import, so that I understand what happened and can take corrective action.

#### Acceptance Criteria

1. IF Safe detection succeeds but registration fails (e.g., EOA is not an owner), THEN THE Doji_App SHALL display a descriptive error message and fall back to the standard onboarding flow.
2. IF credential derivation fails after Safe import, THEN THE Doji_App SHALL register the Safe without credentials and allow the user to derive credentials later via the existing recovery path (useClobClient auto-derives when Safe exists but credentials are missing).
3. IF the user rejects a wallet signature prompt during credential derivation, THEN THE Doji_App SHALL treat the import as partially complete (Safe registered, credentials pending) and redirect to the trading page where useClobClient will retry.
4. WHEN any error occurs during the import flow, THE Doji_App SHALL log the error with structured context (EOA address prefix, step name, error type) for debugging.
