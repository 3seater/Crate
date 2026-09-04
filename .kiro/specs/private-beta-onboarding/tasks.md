# Implementation Plan: Private Beta Onboarding

## Overview

Incremental implementation of the private beta onboarding flow for Doji. Starts with infrastructure changes (store, routing, AppShell), then builds UI components bottom-up (pure logic utilities → step components → modal provider → landing page), then wires everything together in the provider tree and route config. Property-based tests validate pure logic; unit tests cover component behavior.

## Tasks

- [x] 1. Extend wallet store and add pure utility functions
  - [x] 1.1 Add `onboardingCompleted` field and `setOnboardingCompleted` action to the wallet store
    - Add `onboardingCompleted: boolean` to `WalletState` interface
    - Add `setOnboardingCompleted: (completed: boolean) => void` to `WalletActions` interface
    - Set initial value to `false` in `initialState`
    - Add to `partialize` so it persists in localStorage
    - Ensure `setDisconnected` and `clearAuthSession` reset it to `false` (via `initialState`)
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 1.2 Create onboarding utility functions module at `apps/web/src/lib/onboarding-utils.ts`
    - `validateReferralCode(code: string): { valid: boolean; error?: string }` — returns valid if trimmed code is non-empty, otherwise error "Please enter a referral code"
    - `getPostAuthRedirectPath(safeAddress: string | null): string` — returns `/explore?onboarding=true` if safeAddress is null, `/explore` otherwise
    - `getNextOnboardingStep(current: OnboardingStep): OnboardingStep` — pure state machine: welcome → wallet-setup → fund → invite-friends → complete
    - `formatWalletSetupProgress(completedCount: number, total: number, tasks: SubTask[]): string` — returns `"{n}/{total} {currentTaskLabel}..."` or completion message
    - `generateReferralCode(userId: string): string` — returns `doji-${userId.slice(0, 8)}`
    - `buildTwitterShareUrl(referralCode: string, baseUrl?: string): string` — returns Twitter intent URL with referral link in tweet text
    - `shouldOpenOnboarding(onboardingFlag: boolean, onboardingCompleted: boolean): boolean` — returns true only if flag is set and not completed
    - `shouldHideChrome(pathname: string): boolean` — returns true for `/` and `/unlock` only
    - Export `OnboardingStep` type and `SubTask` interface
    - _Requirements: 1.6, 1.7, 2.1, 2.2, 4.4, 6.1, 6.4, 7.1, 7.2, 9.4, 10.2_

  - [ ]* 1.3 Write property tests for onboarding utility functions
    - Create test file at `tests/unit/onboarding/onboarding-utils.test.ts`
    - Use Vitest + fast-check with minimum 100 iterations per property
    - **Property 1: Non-empty referral codes pass mock validation** — Generate random non-empty strings (at least one non-whitespace char), verify `validateReferralCode` returns `{ valid: true }`
    - **Validates: Requirements 1.6**
    - **Property 2: Post-auth redirect is determined by safeAddress presence** — Generate random `{ safeAddress: string | null }`, verify `getPostAuthRedirectPath` returns correct path
    - **Validates: Requirements 2.1, 2.2**
    - **Property 3: Onboarding step machine transitions are deterministic** — Generate random sequences of advance actions from `welcome`, verify step order is always welcome → wallet-setup → fund → invite-friends → complete
    - **Validates: Requirements 3.3, 4.7, 5.3, 9.4**
    - **Property 4: Wallet setup progress counter is accurate** — Generate random completed counts (0–6), verify `formatWalletSetupProgress` output format matches `"{n}/{total} {label}..."` or completion message
    - **Validates: Requirements 4.4**
    - **Property 5: Referral code generation produces valid codes** — Generate random userId strings, verify `generateReferralCode` output is non-empty and deterministic (same input → same output)
    - **Validates: Requirements 6.1**
    - **Property 7: Twitter share URL contains referral link** — Generate random referral code strings, verify `buildTwitterShareUrl` output contains `twitter.com/intent/tweet` or `x.com/intent/tweet` and includes the referral code
    - **Validates: Requirements 6.4**
    - **Property 8: Onboarding completion flag round-trip** — Generate random boolean pairs `(flag, completed)`, verify `shouldOpenOnboarding` returns `flag && !completed`
    - **Validates: Requirements 7.1, 7.2, 7.3**
    - **Property 9: AppShell hideChrome includes landing page route** — Generate random pathname strings plus `/` and `/unlock`, verify `shouldHideChrome` returns true only for `/` and `/unlock`
    - **Validates: Requirements 10.2**

- [x] 2. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Update AppShell chrome hiding and WalletKitLogin redirect
  - [x] 3.1 Update `hideChrome` condition in `apps/web/src/components/layout/app-shell.tsx`
    - Change `const hideChrome = pathname === "/unlock";` to `const hideChrome = pathname === "/unlock" || pathname === "/";`
    - Import and use `shouldHideChrome` from `@/lib/onboarding-utils` if preferred, or inline the condition
    - _Requirements: 10.2_

  - [x] 3.2 Update post-auth redirect in `apps/web/src/components/auth/wallet-kit-login.tsx`
    - Import `getPostAuthRedirectPath` from `@/lib/onboarding-utils`
    - Replace the existing redirect logic (`let nextPath = "/onboarding"; if (u.safeAddress) { nextPath = "/"; }`) with `const nextPath = getPostAuthRedirectPath(u.safeAddress);`
    - This changes new users from `/onboarding` → `/explore?onboarding=true` and existing users from `/` → `/explore`
    - _Requirements: 2.1, 2.2_

- [x] 4. Build onboarding modal step components
  - [x] 4.1 Create WelcomeStep component at `apps/web/src/components/onboarding/steps/welcome-step.tsx`
    - Accept `onContinue: () => void` prop
    - Render welcome heading (`text-2xl font-medium text-text-primary`), message (`text-sm text-text-secondary`), and `Button` (variant `default`) labeled "Continue"
    - Use only design tokens and `Button` component
    - _Requirements: 3.1, 3.2, 3.3, 8.1, 8.2, 8.3_

  - [x] 4.2 Create WalletSetupStep component at `apps/web/src/components/onboarding/steps/wallet-setup-step.tsx`
    - Accept `onNext: () => void` prop
    - Define 6 sub-tasks array using `SubTask` type from onboarding-utils
    - Auto-initiate wallet setup on mount using `useDeploySafe` and `useSetTokenApprovals` hooks
    - Display task list with status icons (pending/in-progress/complete/error) for each sub-task
    - Display progress counter using `formatWalletSetupProgress`
    - On all complete: show checkmark icon and `Button` (variant `default`) labeled "Next"
    - On error: show error message and `Button` (variant `outline`) labeled "Retry"
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 8.1, 8.3_

  - [x] 4.3 Create FundWalletStep component at `apps/web/src/components/onboarding/steps/fund-wallet-step.tsx`
    - Accept `onNext: () => void` prop
    - Render heading, description, `Button` (variant `default`) labeled "Deposit", and `Button` (variant `ghost`) labeled "Skip for now"
    - "Deposit" calls `useBridgeModal().openBridge("deposit")`
    - "Skip for now" calls `onNext`
    - After bridge modal closes, advance to next step
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.1, 8.3_

  - [x] 4.4 Create InviteFriendsStep component at `apps/web/src/components/onboarding/steps/invite-friends-step.tsx`
    - Accept `onComplete: () => void` prop
    - Generate referral code using `generateReferralCode` with userId from wallet store
    - Display referral code in read-only input with "Edit" `Button` (variant `ghost`) to toggle editable mode
    - "Share to X" `Button` (variant `outline`) opens Twitter intent URL via `buildTwitterShareUrl` in new tab
    - "Copy Link" `Button` (variant `outline`) copies referral link to clipboard, shows "Copied" confirmation
    - "Start Trading" `Button` (variant `default`) calls `onComplete`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.1, 8.3_

  - [ ]* 4.5 Write property test for referral code editing
    - Add to `tests/unit/onboarding/onboarding-utils.test.ts` or create `tests/unit/onboarding/invite-friends.test.ts`
    - **Property 6: Editing referral code updates displayed value** — Generate random strings, verify that setting referral code state to a new value results in the displayed value matching exactly
    - **Validates: Requirements 6.3**

- [x] 5. Create OnboardingModalProvider and trigger
  - [x] 5.1 Create OnboardingModalProvider at `apps/web/src/components/onboarding/onboarding-modal-provider.tsx`
    - Follow `BridgeModalProvider` pattern exactly
    - Create `OnboardingModalContext` with `openOnboarding()` function
    - Export `useOnboardingModal()` hook (throws if used outside provider)
    - Manage internal state: `open: boolean`, `step: OnboardingStep`
    - Use `getNextOnboardingStep` for transitions
    - Render `Dialog` with `showCloseButton={false}` (non-dismissible)
    - Render appropriate step component based on current `step` state
    - On final step completion (`onComplete`): set `onboardingCompleted` to `true` in wallet store, close dialog
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 3.4, 8.4_

  - [x] 5.2 Create OnboardingTrigger at `apps/web/src/components/onboarding/onboarding-trigger.tsx`
    - Client component that reads `?onboarding=true` from URL via `useSearchParams`
    - Checks `onboardingCompleted` from wallet store via `shouldOpenOnboarding`
    - If onboarding needed: calls `openOnboarding()` from `useOnboardingModal()`
    - Removes `?onboarding=true` query param via `router.replace` to clean up URL
    - _Requirements: 3.1, 7.2, 7.3_

  - [ ]* 5.3 Write property test for authenticated user redirect from landing page
    - Add to `tests/unit/onboarding/onboarding-utils.test.ts`
    - **Property 10: Authenticated users are redirected from landing page** — Generate random wallet states with/without `sessionToken`, verify that users with a sessionToken should be redirected (pure logic test on presence of sessionToken)
    - **Validates: Requirements 10.3**

- [x] 6. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Build Beta Landing Page and wire route
  - [x] 7.1 Create BetaLandingPage component at `apps/web/src/components/landing/beta-landing-page.tsx`
    - Client component with `"use client"` directive
    - Check auth via `useWalletStore` `sessionToken` — if present, redirect to `/explore` via `router.replace`
    - Render full-screen layout using `bg-surface-0`, `text-text-primary`, `text-doji-green` tokens
    - Display Doji logo, headline (`text-2xl font-medium`), tagline (`text-sm text-text-secondary`)
    - Referral code `Input` component with validation error display
    - "Sign Up" `Button` (variant `default`) — validates non-empty referral code, stores in sessionStorage, navigates to `/login`
    - "Login" `Button` (variant `outline`) — navigates to `/login` directly
    - "Continue without code" `Button` (variant `ghost`) — navigates to `/login` without code
    - Empty code submission shows inline error "Please enter a referral code" using `validateReferralCode`
    - Use only approved typography sizes and design tokens
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 8.1, 8.2, 8.3, 8.5, 10.3_

  - [x] 7.2 Create landing page route at `apps/web/src/app/page.tsx`
    - Replace the current server-side `redirect("/explore")` with a component that renders `BetaLandingPage`
    - No `AuthGuard` wrapper — this is a public route
    - _Requirements: 10.1_

- [x] 8. Integrate OnboardingModalProvider into provider tree and explore route
  - [x] 8.1 Add OnboardingModalProvider to `apps/web/src/components/providers.tsx`
    - Import `OnboardingModalProvider`
    - Nest inside `BridgeModalProvider` and outside `ProfileModalProvider` (so it can access `useBridgeModal`)
    - _Requirements: 9.3_

  - [x] 8.2 Add OnboardingTrigger to the explore page layout or page component
    - Place `OnboardingTrigger` inside the explore page so it reads the query param and triggers the modal
    - Wrap in `Suspense` since it uses `useSearchParams`
    - _Requirements: 3.1_

- [x] 9. Checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Final integration tests
  - [ ]* 10.1 Write unit tests for landing page and modal components
    - Create `tests/unit/onboarding/landing-page.test.tsx`
    - Test: landing page renders logo, headline, input, all three buttons
    - Test: empty referral code submission shows validation error
    - Test: authenticated user state triggers redirect logic
    - Create `tests/unit/onboarding/onboarding-modal.test.tsx`
    - Test: modal opens when onboarding flag is set and not completed
    - Test: modal does not open when completion flag is set
    - Test: Welcome step renders heading, message, Continue button
    - Test: Start Trading closes modal and sets completion flag
    - _Requirements: 1.1, 1.2, 1.7, 3.1, 3.2, 6.7, 7.1, 7.2_

- [x] 11. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document (Properties 1–10)
- All pure logic is extracted into `onboarding-utils.ts` for easy testing without component rendering
- The wallet store extension (task 1.1) is the foundation — everything else depends on it
- Step components (task 4) are independent of each other and can be built in parallel
