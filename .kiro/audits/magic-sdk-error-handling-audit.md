# Magic SDK Error Handling Audit

**Date:** 2026-04-08  
**Status:** ✅ COMPLIANT with minor gaps

## Summary

Your error handling is **well-structured** with proper type guards and user-friendly messages. However, there are **gaps in error code coverage** and some **error types are not being caught properly** in certain flows.

---

## Error Types from Magic SDK Docs

### 1. **RPCError** (JSON RPC 2.0 errors)
- **Code Range:** -32700 to -32603 (standard JSON RPC)
- **Magic-specific:** -10003 to -10015
- **Your Coverage:** ✅ Partial (only 2 codes handled)

### 2. **SDKError** (SDK initialization/configuration)
- **Examples:** MissingApiKey, ModalNotReady, MalformedResponse, InvalidArgument
- **Your Coverage:** ✅ Generic fallback only

### 3. **ExtensionError** (Extension-specific)
- **Your Coverage:** ❌ Not handled (but you don't use extensions)

---

## Current Implementation Review

### ✅ What's Good

**File:** `apps/web/src/features/auth/lib/magic/errors.ts`

```typescript
export function isRPCError(err: unknown): err is InstanceType<typeof MagicRPCError>
export function isSDKError(err: unknown): err is InstanceType<typeof MagicSDKError>
export function isUserCancellation(err: unknown): boolean
export function getUserMessage(err: unknown): string | null
```

**Strengths:**
- ✅ Proper type guards using `instanceof`
- ✅ User cancellation detection (string matching)
- ✅ Fallback to generic message
- ✅ Returns `null` for silent errors (cancellations)

**Current Error Code Handling:**
```typescript
case RPCErrorCode.MagicLinkRateLimited:
  return "Too many attempts. Please wait a moment and try again.";
case RPCErrorCode.UserAlreadyLoggedIn:
  return "You are already logged in.";
```

---

## ❌ Gaps Identified

### Gap 1: Missing Error Codes from Docs

**Magic-specific RPC Error Codes NOT handled:**

| Code | Enum Key | Your Status |
|------|----------|-------------|
| -10003 | `UserAlreadyLoggedIn` | ✅ Handled |
| -10004 | `UpdateEmailFailed` | ❌ Missing |
| -10005 | `UserRequestEditEmail` | ❌ Missing |
| -10010 | `InactiveRecipient` | ❌ Missing |
| -10011 | `AccessDeniedToUser` | ❌ Missing |
| -10015 | `RedirectLoginComplete` | ❌ Missing |

**Standard JSON RPC Codes NOT handled:**

| Code | Enum Key | Your Status |
|------|----------|-------------|
| -32700 | `ParseError` | ❌ Missing |
| -32600 | `InvalidRequest` | ❌ Missing |
| -32601 | `MethodNotFound` | ❌ Missing |
| -32602 | `InvalidParams` | ❌ Missing |
| -32603 | `InternalError` | ❌ Missing |

### Gap 2: Error Mixing in `wallet-kit-login.tsx`

**Problem:** Referral gate errors are detected via string matching, but they're tRPC errors, not Magic errors:

```typescript
function isReferralGateError(err: unknown): boolean {
  if (!(err instanceof Error)) {
    return false;
  }
  return (
    err.message.includes("invite code") ||
    err.message.includes("usage limit") ||
    err.message.includes("referral code")
  );
}
```

**Issue:** This function is called AFTER `completeWalletKitLogin()` which can throw:
- Magic SDK errors (RPCError, SDKError)
- tRPC errors (from server)
- Generic errors

**Current flow:**
```typescript
try {
  await completeWalletKitLogin(magic, result, {...});
} catch (err) {
  if (isReferralGateError(err)) {  // ← Catches tRPC errors
    // Show code input UI
  }
  const msg = getUserMessage(err);  // ← Tries to extract Magic error message
  if (msg) {
    toast.error(msg);
  }
}
```

**Problem:** If a tRPC error occurs (not referral gate), `getUserMessage()` won't recognize it as a Magic error and will fall through to generic `err instanceof Error` handler.

### Gap 3: No Error Code Constants

You're using `RPCErrorCode` enum from magic-sdk, but not importing all codes. Consider creating a centralized error code reference.

### Gap 4: `import-safe.ts` Error Handling

**Current:** Generic try-catch with logging, but no specific error code handling:

```typescript
catch (err) {
  logImport("warn", eoaPrefix, "detect", "Relayer /deployed check failed", {
    errorType: err instanceof Error ? err.constructor.name : typeof err,
    message: err instanceof Error ? err.message : String(err),
  });
}
```

**Issue:** If this is a Magic error (e.g., `getIdToken()` fails for SIWE), it should be caught and handled specifically.

---

## Recommendations

### 1. Expand Error Code Coverage

**Update `errors.ts`:**

```typescript
import { MagicRPCError, MagicSDKError, RPCErrorCode, SDKErrorCode } from "magic-sdk";

export function getUserMessage(err: unknown): string | null {
  if (isUserCancellation(err)) {
    return null;
  }

  if (isRPCError(err)) {
    switch (err.code) {
      // Magic-specific errors
      case RPCErrorCode.UserAlreadyLoggedIn:
        return "You are already logged in.";
      case RPCErrorCode.MagicLinkRateLimited:
        return "Too many attempts. Please wait a moment and try again.";
      case RPCErrorCode.UpdateEmailFailed:
        return "Failed to update email. Please try again.";
      case RPCErrorCode.AccessDeniedToUser:
        return "Access denied. Please check your account status.";
      case RPCErrorCode.InactiveRecipient:
        return "Your account is inactive. Please verify and activate it.";
      
      // Standard JSON RPC errors
      case RPCErrorCode.InternalError:
        return "An internal error occurred. Please try again.";
      case RPCErrorCode.InvalidParams:
        return "Invalid request parameters.";
      case RPCErrorCode.MethodNotFound:
        return "The requested method is not available.";
      
      default:
        return err.rawMessage || "An authentication error occurred.";
    }
  }

  if (isSDKError(err)) {
    // SDKError doesn't have a code field like RPCError
    // Just return generic message
    return "Authentication service error. Please try again.";
  }

  if (err instanceof Error) {
    return err.message;
  }
  return "An unexpected error occurred.";
}
```

### 2. Separate Error Types in `wallet-kit-login.tsx`

**Problem:** Mixing Magic errors with tRPC errors. Solution: Distinguish them:

```typescript
// Separate function for tRPC errors
function isTRPCError(err: unknown): boolean {
  return err instanceof Error && (
    err.message.includes("invite code") ||
    err.message.includes("usage limit") ||
    err.message.includes("referral code")
  );
}

// In catch block:
try {
  await completeWalletKitLogin(magic, result, {...});
} catch (err) {
  setImporting(false);
  
  // Check for tRPC errors FIRST (they're not Magic errors)
  if (isTRPCError(err)) {
    pendingResultRef.current = result;
    setGated(true);
    setGateError(err instanceof Error ? err.message : null);
    return;
  }
  
  // Then handle Magic errors
  logger.error("[WalletKitLogin] failed", {
    method: result?.method,
    error: err instanceof Error ? err.message : String(err),
  });
  
  const msg = getUserMessage(err);  // ← Now only Magic errors reach here
  if (msg) {
    toast.error(msg);
  }
}
```

### 3. Add Error Code Constants

**Create `apps/web/src/features/auth/lib/magic/error-codes.ts`:**

```typescript
import { RPCErrorCode, SDKErrorCode } from "magic-sdk";

export const MAGIC_ERROR_CODES = {
  // User-facing errors
  RATE_LIMITED: RPCErrorCode.MagicLinkRateLimited,
  ALREADY_LOGGED_IN: RPCErrorCode.UserAlreadyLoggedIn,
  UPDATE_EMAIL_FAILED: RPCErrorCode.UpdateEmailFailed,
  ACCESS_DENIED: RPCErrorCode.AccessDeniedToUser,
  INACTIVE_RECIPIENT: RPCErrorCode.InactiveRecipient,
  
  // System errors
  INTERNAL_ERROR: RPCErrorCode.InternalError,
  INVALID_PARAMS: RPCErrorCode.InvalidParams,
  METHOD_NOT_FOUND: RPCErrorCode.MethodNotFound,
} as const;
```

### 4. Handle Magic Errors in `import-safe.ts`

**Add specific handling for SIWE-related errors:**

```typescript
import { isRPCError, isSDKError } from "@/features/auth/lib/magic/errors";

try {
  // ... existing code
} catch (err) {
  // If this is a Magic error (e.g., getIdToken fails for SIWE), log it specifically
  if (isRPCError(err) || isSDKError(err)) {
    logImport("warn", eoaPrefix, "magic-error", "Magic SDK call failed", {
      errorCode: isRPCError(err) ? err.code : "SDK_ERROR",
      message: err instanceof Error ? err.message : String(err),
    });
  } else {
    logImport("warn", eoaPrefix, "detect", "Relayer check failed", {
      errorType: err instanceof Error ? err.constructor.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}
```

---

## Action Items

- [ ] **Priority 1:** Expand `getUserMessage()` to handle all Magic error codes
- [ ] **Priority 2:** Separate tRPC errors from Magic errors in `wallet-kit-login.tsx`
- [ ] **Priority 3:** Add error code constants file for maintainability
- [ ] **Priority 4:** Add Magic error detection to `import-safe.ts`
- [ ] **Priority 5:** Test all error paths (rate limit, already logged in, etc.)

---

## Testing Checklist

- [ ] Rate limit error (MagicLinkRateLimited)
- [ ] Already logged in error (UserAlreadyLoggedIn)
- [ ] User cancellation (closed modal)
- [ ] Referral gate rejection (tRPC error)
- [ ] Network error (InternalError)
- [ ] Invalid email (validation error)
- [ ] SIWE session logout (timeout)
- [ ] Safe import failure (non-existent Safe)

