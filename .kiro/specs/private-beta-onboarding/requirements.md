# Requirements Document

## Introduction

Private beta onboarding flow for Doji, a Polymarket prediction market app. The feature introduces a gated landing page at `/` (the site root) with referral code entry, sign up and login options, Magic Link authentication, and a multi-step post-signup modal sequence that walks new users through wallet setup, funding, and referral sharing before they begin trading on `/explore`.

## Glossary

- **Landing_Page**: The public-facing beta entry page at `/` (site root) that collects referral codes and provides both sign up and login options. Renders without AppShell chrome (no SiteHeader, WatchlistBar, BottomBar).
- **Onboarding_Modal**: A multi-step Dialog-based modal sequence shown on `/explore` after a new user's first authenticated session. Uses the existing `Dialog` component from `@/components/ui/dialog.tsx`.
- **Referral_Code**: An alphanumeric code that serves dual purpose: (1) grants access to the private beta when entered by a new user during sign up, and (2) is auto-generated for each new user to share with friends to invite them. Editable by the user. For the initial release, validation is mocked (any non-empty string is accepted). A bypass mode allows signup without a code for testing. All referral data is mocked (client-side only, no server persistence).
- **Wallet_Setup**: The process of deploying a Gnosis Safe, setting token approvals (USDC for CTF Exchange, Neg Risk CTF Exchange, Neg Risk Adapter), deriving CLOB credentials, and registering with the server. Orchestrated by the existing `useDeploySafe` and `useSetTokenApprovals` hooks.
- **Bridge_Flow**: The existing deposit/withdraw flow provided by `BridgeModalProvider` and `useBridgeModal()`.
- **Design_Token**: CSS custom properties defined in `apps/web/src/index.css` (e.g., `--doji-green`, `--surface-0` through `--surface-4`, `--text-primary` through `--text-muted`, `--border-subtle`/`--border-default`/`--border-strong`). All UI must reference these tokens, never hardcoded color values.
- **Button_Component**: The `Button` from `@/components/ui/button.tsx` with variants `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`, `positive`, `negative`.
- **Dialog_Component**: The `Dialog` and related primitives from `@/components/ui/dialog.tsx`, built on Base-UI.
- **AppShell**: The layout wrapper at `apps/web/src/components/layout/app-shell.tsx` that renders SiteHeader, WatchlistBar, and BottomBar. Supports `hideChrome` for specific routes.

## Requirements

### Requirement 1: Beta Landing Page

**User Story:** As a prospective beta user, I want to see a landing page that communicates Doji's brand and lets me enter a referral code or log in, so that I can gain access to the private beta or return to my existing account.

#### Acceptance Criteria

1. WHEN a user navigates to `/`, THE Landing_Page SHALL render a full-screen page using Doji Design_Tokens (`bg-surface-0`, `text-text-primary`, `text-doji-green`) without AppShell chrome (no SiteHeader, WatchlistBar, or BottomBar).
2. THE Landing_Page SHALL display the Doji logo, a headline, a brief tagline, a Referral_Code text input field, and both a "Sign Up" flow and a "Login" option.
3. THE Landing_Page SHALL include a Button_Component (variant `default`) labeled "Sign Up" that submits the Referral_Code and initiates the sign-up flow for new users.
4. THE Landing_Page SHALL include a Button_Component (variant `outline`) labeled "Login" that directs returning users to the Magic Link authentication flow without requiring a Referral_Code.
5. THE Landing_Page SHALL include a secondary link or Button_Component (variant `ghost` or `link`) labeled "Continue without code" that bypasses Referral_Code entry for testing purposes and proceeds to the sign-up flow.
6. WHEN a user submits a non-empty Referral_Code via the "Sign Up" button, THE Landing_Page SHALL accept the code (mock validation: any non-empty string passes) and redirect the user to the sign-up flow.
7. WHEN a user submits an empty Referral_Code via the "Sign Up" button, THE Landing_Page SHALL display an inline validation message "Please enter a referral code" below the input field.
8. WHEN a user clicks "Continue without code", THE Landing_Page SHALL redirect the user to the sign-up flow without requiring a Referral_Code.
9. WHEN a user clicks "Login", THE Landing_Page SHALL redirect the user to the Magic Link authentication flow.
10. THE Landing_Page SHALL use only the six approved typography sizes (`text-3xl`, `text-2xl`, `text-lg`, `text-sm`, `text-xs`, `text-[10px]`) and only `font-normal` or `font-medium` weights.

### Requirement 2: Post-Signup Redirect

**User Story:** As a new user who just signed up, I want to be redirected to the explore page with the onboarding flow, so that I can set up my account before trading.

#### Acceptance Criteria

1. WHEN a new user completes Magic Link authentication (via `handleWalletKitLogin`) and the user has no existing `safeAddress`, THE WalletKitLogin component SHALL redirect the user to `/explore` with a query parameter or state flag indicating onboarding is needed (e.g., `/explore?onboarding=true`).
2. WHEN an existing user with a `safeAddress` completes authentication, THE WalletKitLogin component SHALL redirect the user to `/explore` without triggering the Onboarding_Modal.

### Requirement 3: Welcome Modal (Step 1)

**User Story:** As a new user arriving on the explore page, I want to see a welcome message, so that I know I have successfully joined the beta.

#### Acceptance Criteria

1. WHEN a new user lands on `/explore` with the onboarding flag set, THE Onboarding_Modal SHALL open automatically displaying a "Welcome to Doji" step.
2. THE Welcome step SHALL display a welcome heading (using `text-2xl font-medium`), a brief welcome message (using `text-sm text-text-secondary`), and a Button_Component (variant `default`) labeled "Continue".
3. WHEN the user clicks "Continue", THE Onboarding_Modal SHALL advance to the Wallet Setup step.
4. THE Onboarding_Modal SHALL render using the Dialog_Component with `showCloseButton` set to `false` to prevent skipping the onboarding flow.

### Requirement 4: Wallet Setup Modal (Step 2)

**User Story:** As a new user, I want to see the progress of my trading wallet being set up, so that I understand what is happening and can wait with confidence.

#### Acceptance Criteria

1. WHEN the Onboarding_Modal advances to the Wallet Setup step, THE Onboarding_Modal SHALL automatically initiate the Wallet_Setup process (deploying Gnosis Safe, setting token approvals, deriving CLOB credentials, registering with server).
2. WHILE the Wallet_Setup is in progress, THE Onboarding_Modal SHALL display a loading indicator (spinner or progress bar) and a task list showing each sub-task with its current status (pending, in-progress, or complete).
3. THE Onboarding_Modal SHALL display the following Wallet_Setup sub-tasks in order: "Deploying Gnosis Safe", "Approving USDC for CTF Exchange", "Approving USDC for Neg Risk CTF Exchange", "Approving USDC for Neg Risk Adapter", "Deriving CLOB credentials", "Registering with server".
4. WHILE the Wallet_Setup is in progress, THE Onboarding_Modal SHALL display a progress counter (e.g., "3/6 Approving USDC for Neg Risk Adapter...") that updates as each sub-task completes.
5. WHEN all Wallet_Setup sub-tasks complete successfully, THE Onboarding_Modal SHALL display a success state with a checkmark icon and a Button_Component (variant `default`) labeled "Next".
6. IF the Wallet_Setup encounters an error during any sub-task, THEN THE Onboarding_Modal SHALL display the error message and a Button_Component (variant `outline`) labeled "Retry" that re-initiates the failed sub-task.
7. WHEN the user clicks "Next" after successful Wallet_Setup, THE Onboarding_Modal SHALL advance to the Fund Your Wallet step.

### Requirement 5: Fund Your Wallet Modal (Step 3)

**User Story:** As a new user with a trading wallet, I want the option to deposit funds or skip funding, so that I can choose when to add money.

#### Acceptance Criteria

1. WHEN the Onboarding_Modal advances to the Fund Your Wallet step, THE Onboarding_Modal SHALL display two options: a Button_Component (variant `default`) labeled "Deposit" and a Button_Component (variant `ghost`) labeled "Skip for now".
2. WHEN the user clicks "Deposit", THE Onboarding_Modal SHALL open the existing Bridge_Flow (via `useBridgeModal().openBridge("deposit")`) for the user to complete a deposit.
3. WHEN the user clicks "Skip for now", THE Onboarding_Modal SHALL advance to the Invite Friends step.
4. WHEN the user completes or closes the Bridge_Flow after clicking "Deposit", THE Onboarding_Modal SHALL advance to the Invite Friends step.

### Requirement 6: Invite Friends Modal (Step 4)

**User Story:** As a new user, I want to see my referral code and share it with friends, so that I can invite others to the beta.

#### Acceptance Criteria

1. WHEN the Onboarding_Modal advances to the Invite Friends step, THE Onboarding_Modal SHALL display the user's auto-generated Referral_Code in a read-only input field.
2. THE Onboarding_Modal SHALL provide an "Edit" Button_Component (variant `ghost`) that toggles the Referral_Code input to editable mode, allowing the user to customize the code.
3. WHEN the user edits the Referral_Code and confirms, THE Onboarding_Modal SHALL update the displayed code (mock: client-side state only, no server persistence).
4. THE Onboarding_Modal SHALL display a Button_Component (variant `outline`) labeled "Share to X" that opens a new browser tab with a pre-filled tweet containing the referral link.
5. THE Onboarding_Modal SHALL display a Button_Component (variant `outline`) labeled "Copy Link" that copies the referral link to the clipboard and shows a brief "Copied" confirmation.
6. THE Onboarding_Modal SHALL display a Button_Component (variant `default`) labeled "Start Trading" that closes the Onboarding_Modal.
7. WHEN the user clicks "Start Trading", THE Onboarding_Modal SHALL close and the user SHALL remain on `/explore` ready to trade.

### Requirement 7: Onboarding State Persistence

**User Story:** As a user who has completed onboarding, I want the onboarding modal to not appear again, so that I can use the app without interruption.

#### Acceptance Criteria

1. WHEN the user completes the final step of the Onboarding_Modal (clicks "Start Trading"), THE Onboarding_Modal SHALL persist a completion flag (e.g., in localStorage or the Zustand wallet store) so the modal does not reappear on subsequent visits.
2. WHEN a user with a persisted onboarding completion flag navigates to `/explore`, THE Onboarding_Modal SHALL not open.
3. IF the persisted onboarding completion flag is cleared (e.g., user clears localStorage or logs out), THEN THE Onboarding_Modal SHALL reappear on the next authenticated visit to `/explore` if the onboarding flag is set.

### Requirement 8: Design System Compliance

**User Story:** As a designer, I want the onboarding flow to use Doji's design system consistently, so that the experience feels cohesive with the rest of the app.

#### Acceptance Criteria

1. THE Landing_Page and Onboarding_Modal SHALL use only Design_Tokens from `apps/web/src/index.css` for all colors, surfaces, borders, and text colors. No hardcoded hex values (e.g., no `text-[#F5F5F5]`, no `bg-[#1e1e1e]`).
2. THE Landing_Page and Onboarding_Modal SHALL use only the six approved typography sizes and only `font-normal` or `font-medium` weights.
3. THE Landing_Page and Onboarding_Modal SHALL use the Button_Component for all interactive actions. No raw `<button>` elements.
4. THE Onboarding_Modal SHALL use the Dialog_Component for all modal rendering. No custom modal implementations.
5. THE Landing_Page and Onboarding_Modal SHALL use surface tokens (`bg-surface-0` through `bg-surface-4`) for background layering and border tokens (`border-subtle`, `border-default`, `border-strong`) for borders.

### Requirement 9: Onboarding Modal Provider

**User Story:** As a developer, I want the onboarding modal to follow the existing modal provider pattern, so that it integrates cleanly with the app architecture.

#### Acceptance Criteria

1. THE Onboarding_Modal SHALL be implemented as a context-based provider (e.g., `OnboardingModalProvider`) following the same pattern as `BridgeModalProvider`.
2. THE OnboardingModalProvider SHALL expose a `useOnboardingModal()` hook that provides an `openOnboarding()` function.
3. THE OnboardingModalProvider SHALL be added to the provider tree in `apps/web/src/components/providers.tsx`, nested inside `MagicProvider` and `BridgeModalProvider`.
4. THE OnboardingModalProvider SHALL manage the current step state internally (welcome → wallet-setup → fund → invite-friends → complete).

### Requirement 10: Landing Page Route Configuration

**User Story:** As a developer, I want the landing page to be a public route without authentication, so that unauthenticated users can access it.

#### Acceptance Criteria

1. THE Landing_Page route (`/`) SHALL be accessible without authentication (no `AuthGuard` wrapper).
2. THE AppShell SHALL hide chrome (SiteHeader, WatchlistBar, BottomBar) when the pathname is `/`, following the same pattern used for `/unlock`.
3. WHEN an authenticated user navigates to `/`, THE Landing_Page SHALL redirect the user to `/explore`.
