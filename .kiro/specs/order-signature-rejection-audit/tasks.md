# Implementation Plan

- [ ] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** — Instant Trade popup omits `hasCredentialsStored` and over-constrains `enabled`
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to the concrete failing cases:
    - Case A: `hasCredentials: false` in wallet store → `useClobClient` should receive `hasCredentialsStored: false` (unfixed code omits it, defaulting to `true`)
    - Case B: `magic: null`, `safeAddress: "0x1234..."` → `useClobClient` should receive `enabled: true` (unfixed code passes `false` because it requires both `magic && safeAddress`)
  - Test file: `tests/unit/instant-trade-popup-bug-condition.test.ts`
  - Mock `useMagic`, `useWalletStore`, `useOrderbookStore`, `useMarketTrading`, `useClobClient`, and `useQuery`
  - Assert `useClobClient` is called with `hasCredentialsStored: false` when wallet store has `hasCredentials: false`
  - Assert `useClobClient` is called with `enabled: true` when `safeAddress` is set but `magic` is `null`
  - The test assertions match the Expected Behavior Properties from design (Reqs 2.1, 2.2)
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the bug exists)
  - Document counterexamples: `useClobClient` called without `hasCredentialsStored` (defaults to `true`), and `enabled` is `false` when `magic` is null
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [ ] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** — Quick-sell modal and order form `useClobClient` calls unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Test file: `tests/unit/instant-trade-popup-preservation.test.ts`
  - Observe on UNFIXED code:
    - Quick-sell modal (`quick-sell-modal.tsx`) calls `useClobClient` with `hasCredentialsStored: hasCredentials` and `enabled: Boolean(safeAddress)` — this is correct and must not change
    - Order form (`order-form.hooks.ts`) calls `useClobClient` with `hasCredentialsStored: hasCredentials` and `enabled: Boolean(safeAddress)` — this is correct and must not change
    - When `hasCredentials` is `true` on any surface, `persistCredentialsIfNeeded` returns early (no re-derivation)
    - When `safeAddress` is null/undefined, `useClobClient` receives `enabled: false` on all surfaces
  - Write property-based tests (using `fast-check`) generating random wallet states (`hasCredentials: boolean`, `safeAddress: string | null`, `magic: object | null`) and verifying:
    - Quick-sell modal always passes `hasCredentialsStored` matching the store value
    - Order form always passes `hasCredentialsStored` matching the store value
    - Both surfaces use `enabled: Boolean(safeAddress)` regardless of `magic` state
    - When `safeAddress` is null, all surfaces pass `enabled: false`
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 3. Fix for Instant Trade popup order signature rejection

  - [x] 3.1 Implement the fix in `useInstantTradeData`
    - File: `apps/web/src/components/market/instant-trade-popup.tsx`
    - Add `hasCredentials` to the existing `useWalletStore(useShallow(...))` selector alongside `safeAddress`, `address`, and `funderAddress`
    - Pass `hasCredentialsStored: hasCredentials` to the `useClobClient` call
    - Change `enabled: Boolean(magic && safeAddress)` to `enabled: Boolean(safeAddress)` to match quick-sell modal and order form
    - No other files are modified; `useClobClient` hook itself is unchanged
    - _Bug\_Condition: isBugCondition(input) where input.surface == "instant-trade-popup" AND (input.hasCredentials == false OR (input.magic == null AND input.safeAddress != null))_
    - _Expected\_Behavior: useClobClient receives hasCredentialsStored matching wallet store value, and enabled: Boolean(safeAddress)_
    - _Preservation: Quick-sell modal and order form useClobClient calls are untouched_
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4_

  - [ ] 3.2 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** — Instant Trade popup passes correct `hasCredentialsStored` and `enabled`
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run: `pnpm vitest --run tests/unit/instant-trade-popup-bug-condition.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2_

  - [ ] 3.3 Verify preservation tests still pass
    - **Property 2: Preservation** — Quick-sell modal and order form unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run: `pnpm vitest --run tests/unit/instant-trade-popup-preservation.test.ts`
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 4. Checkpoint — Ensure all tests pass
  - Run full test suite: `pnpm vitest --run tests/unit/instant-trade-popup-*.test.ts`
  - Ensure all tests pass, ask the user if questions arise.
