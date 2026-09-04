# Order Signature Rejection on Instant Trade Modal — Bugfix Design

## Overview

The Instant Trade popup (`instant-trade-popup.tsx`) fails to pass `hasCredentialsStored` to `useClobClient`, causing the hook to default it to `true`. When a user's CLOB credentials are stale or missing, the hook skips credential derivation and persistence, producing orders signed with invalid credentials that the CLOB API rejects with "Order signature was rejected." A secondary issue is the `enabled` condition requiring both `magic` AND `safeAddress`, whereas the quick-sell modal and order form only require `safeAddress`, delaying client initialization when `magic` is momentarily null.

The fix is surgical: read `hasCredentials` from the wallet store and pass it through, and align the `enabled` condition to `Boolean(safeAddress)`.

## Glossary

- **Bug_Condition (C)**: An order placed via the Instant Trade popup when the user's CLOB credentials are not persisted in the wallet store, or when `magic` is momentarily null while `safeAddress` is available.
- **Property (P)**: The Instant Trade popup derives fresh credentials, persists them, and signs orders correctly — matching the behavior of the quick-sell modal and order form.
- **Preservation**: The quick-sell modal, order form, and all non-Instant-Trade flows continue to function identically. Users with valid persisted credentials are not forced to re-derive.
- **`useClobClient`**: Hook in `apps/web/src/hooks/use-clob-client.ts` that creates a persistent CLOB client, derives L2 API credentials, and optionally persists them via `storeCredentials` when `hasCredentialsStored` is `false`.
- **`hasCredentialsStored`**: Parameter on `useClobClient` (default `true`). When `false`, the hook derives credentials and persists them. The Instant Trade popup omits this, so it always defaults to `true`.
- **`useInstantTradeData`**: Internal hook in `instant-trade-popup.tsx` that wires up wallet state, orderbook data, and the CLOB client for the popup.

## Bug Details

### Bug Condition

The bug manifests when a user places an order through the Instant Trade popup and their CLOB credentials are not yet persisted in the wallet store. The `useClobClient` hook receives `hasCredentialsStored` as its default value (`true`), so `persistCredentialsIfNeeded` exits early and no fresh credentials are derived or stored. The resulting order is signed with stale or absent credentials, which the CLOB API rejects.

A secondary trigger occurs when `magic` is momentarily `null` during provider initialization: the `enabled: Boolean(magic && safeAddress)` condition prevents client creation even though `safeAddress` is available, unlike the other trading surfaces.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { surface: TradingSurface, hasCredentials: boolean, magic: Magic | null, safeAddress: string | null }
  OUTPUT: boolean

  RETURN input.surface == "instant-trade-popup"
         AND (
           input.hasCredentials == false
           OR (input.magic == null AND input.safeAddress != null)
         )
END FUNCTION
```

### Examples

- User with no persisted credentials clicks "$25 Buy" on the Instant Trade popup → order signed with stale credentials → CLOB returns "Order signature was rejected." Expected: fresh credentials derived, persisted, order accepted.
- User opens Instant Trade popup while `magic` is still initializing but `safeAddress` is set → CLOB client is `null`, buy button effectively no-ops. Expected: client initializes as soon as `safeAddress` is available, matching quick-sell modal behavior.
- User with no persisted credentials clicks "Sell 50%" on the quick-sell modal → credentials derived and persisted, order succeeds. This is the correct behavior that the Instant Trade popup should match.
- User with valid persisted credentials uses the Instant Trade popup → order succeeds (no bug, `hasCredentialsStored` defaults to `true` which happens to be correct for this user).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Quick-sell modal continues to pass `hasCredentialsStored: hasCredentials` and sign orders with valid credentials (Req 3.1).
- Standard order form continues to pass `hasCredentialsStored: hasCredentials` and sign orders with valid credentials (Req 3.2).
- Users with valid persisted credentials on any trading surface continue to reuse existing credentials without re-deriving (Req 3.3).
- When `safeAddress` is null or undefined on any trading surface, the CLOB client remains disabled (Req 3.4).

**Scope:**
All inputs that do NOT involve the Instant Trade popup's `useClobClient` call should be completely unaffected by this fix. This includes:
- Orders placed via the quick-sell modal
- Orders placed via the standard order form
- The `useClobClient` hook's internal logic (no changes to the hook itself)
- All other wallet store consumers

## Hypothesized Root Cause

Based on the bug description and code analysis, the root causes are:

1. **Missing `hasCredentialsStored` parameter**: The `useInstantTradeData` hook in `instant-trade-popup.tsx` does not read `hasCredentials` from the wallet store and does not pass it to `useClobClient`. The hook's default (`true`) causes `persistCredentialsIfNeeded` to return early, skipping credential derivation for users who need it.

2. **Inconsistent `enabled` condition**: The Instant Trade popup uses `enabled: Boolean(magic && safeAddress)`, requiring both values. The quick-sell modal and order form use `enabled: Boolean(safeAddress)`. The `useClobClient` hook's `init` function already guards on `magic` internally (`if (!(magic && safeAddress && signingEndpoint && enabled))`), so the outer `enabled` check on `magic` is redundant and delays initialization.

## Correctness Properties

Property 1: Bug Condition — Instant Trade orders use valid credentials

_For any_ order placed via the Instant Trade popup where the user's CLOB credentials are not yet persisted (`hasCredentials === false`), the fixed `useInstantTradeData` hook SHALL pass `hasCredentialsStored: false` to `useClobClient`, causing the hook to derive fresh credentials, persist them via `storeCredentials`, and produce a validly-signed order that the CLOB API accepts.

**Validates: Requirements 2.1, 2.2**

Property 2: Preservation — Non-Instant-Trade surfaces unchanged

_For any_ order placed via the quick-sell modal or standard order form, the fixed code SHALL produce exactly the same `useClobClient` call arguments as before, preserving credential handling, client initialization timing, and order signing behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `apps/web/src/components/market/instant-trade-popup.tsx`

**Function**: `useInstantTradeData`

**Specific Changes**:

1. **Read `hasCredentials` from wallet store**: Add `hasCredentials` to the existing `useWalletStore(useShallow(...))` selector that already reads `safeAddress`, `address`, and `funderAddress`.
   ```typescript
   const {
     safeAddress,
     address: walletAddress,
     funderAddress,
     hasCredentials,
   } = useWalletStore(
     useShallow((s) => ({
       safeAddress: s.safeAddress,
       address: s.address,
       funderAddress: s.funderAddress,
       hasCredentials: s.hasCredentials,
     }))
   );
   ```

2. **Pass `hasCredentialsStored` and fix `enabled`**: Update the `useClobClient` call to pass the credential flag and align the enabled condition with the other trading surfaces.
   ```typescript
   const { client: clobClient, reset: resetClobClient } = useClobClient({
     magic: magic ?? null,
     signingEndpoint: getSigningEndpointUrl(),
     safeAddress: safeAddress ?? "",
     walletAddress,
     enabled: Boolean(safeAddress),
     hasCredentialsStored: hasCredentials,
   });
   ```

No other files are modified. The `useClobClient` hook itself is unchanged.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write unit tests that render the `useInstantTradeData` hook (or inspect the `useClobClient` call arguments) and assert that `hasCredentialsStored` is passed through from the wallet store. Run these tests on the UNFIXED code to observe failures.

**Test Cases**:
1. **Missing hasCredentialsStored test**: Assert that `useClobClient` is called with `hasCredentialsStored: false` when wallet store has `hasCredentials: false` (will fail on unfixed code — parameter is omitted)
2. **Enabled condition test**: Assert that `useClobClient` is called with `enabled: true` when `safeAddress` is set but `magic` is null (will fail on unfixed code — `enabled` evaluates to `false`)
3. **Combined condition test**: Assert that with `hasCredentials: false` and `magic: null` but `safeAddress` set, the client still initializes correctly (will fail on unfixed code)

**Expected Counterexamples**:
- `useClobClient` is called without `hasCredentialsStored`, defaulting to `true`
- `enabled` is `false` when `magic` is null despite `safeAddress` being available

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := useInstantTradeData_fixed(input)
  ASSERT result.clobClientArgs.hasCredentialsStored == input.hasCredentials
  ASSERT result.clobClientArgs.enabled == Boolean(input.safeAddress)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT quickSellModal_useClobClient_args(input) == quickSellModal_useClobClient_args_fixed(input)
  ASSERT orderForm_useClobClient_args(input) == orderForm_useClobClient_args_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many combinations of wallet state (`hasCredentials`, `safeAddress`, `magic`) automatically
- It catches edge cases like `safeAddress` being empty string vs null
- It provides strong guarantees that the quick-sell modal and order form are completely unaffected

**Test Plan**: Observe behavior on UNFIXED code first for the quick-sell modal and order form, then write property-based tests capturing that behavior remains identical after the fix.

**Test Cases**:
1. **Quick-sell modal preservation**: Verify the quick-sell modal's `useClobClient` call arguments are unchanged after the fix
2. **Order form preservation**: Verify the order form's `useClobClient` call arguments are unchanged after the fix
3. **Persisted credentials preservation**: Verify that when `hasCredentials` is `true`, no credential re-derivation occurs on any surface
4. **Null safeAddress preservation**: Verify that when `safeAddress` is null, the CLOB client remains disabled on all surfaces

### Unit Tests

- Test that `useInstantTradeData` passes `hasCredentialsStored` from wallet store to `useClobClient`
- Test that `useInstantTradeData` uses `enabled: Boolean(safeAddress)` without requiring `magic`
- Test edge case: `hasCredentials` is `undefined` in wallet store (should still pass through)

### Property-Based Tests

- Generate random wallet states (`hasCredentials: boolean`, `safeAddress: string | null`, `magic: Magic | null`) and verify the Instant Trade popup's `useClobClient` call always includes `hasCredentialsStored` matching the store value
- Generate random wallet states and verify the `enabled` condition is `Boolean(safeAddress)` regardless of `magic` state
- Generate random wallet states and verify quick-sell modal and order form call arguments are identical before and after the fix

### Integration Tests

- Test full buy flow on Instant Trade popup with `hasCredentials: false` — order should succeed after fix
- Test full sell flow on Instant Trade popup with `hasCredentials: false` — order should succeed after fix
- Test that quick-sell modal buy/sell flows continue to work identically after the fix
