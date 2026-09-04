# Magic SDK Node Error Handling Audit

**Status:** ⚠️ PARTIAL — Using Node SDK but not leveraging error codes

---

## What You're Using

**Server:** `@magic-sdk/admin` (Node.js SDK)  
**File:** `apps/server/src/features/auth/router.ts`

**Methods called:**
- ✅ `magic.token.validate(didToken)` — validates DID token
- ✅ `magic.token.decode(didToken)` — extracts claim/proof
- ✅ `magic.token.getIssuer(didToken)` — extracts issuer (DID)
- ✅ `magic.users.getMetadataByToken(didToken)` — fetches user metadata

---

## Current Error Handling

### ✅ What's Good

**Generic error mapping:**
```typescript
function handleTokenValidationError(err: unknown): never {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (msg.includes("expired")) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "DID token expired" });
  }
  if (msg.includes("malformed") || msg.includes("parse")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid DID token format",
    });
  }
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Invalid or expired DID token",
  });
}
```

**Metadata error handling:**
```typescript
function handleMetadataError(err: unknown): never {
  const statusCode = err instanceof Error && "data" in err 
    ? (err as { data: { statusCode: number } }).data.statusCode 
    : undefined;
  if (statusCode === 429) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limited by Magic API. Please try again shortly.",
    });
  }
  // ... generic fallback
}
```

---

## ❌ Gaps

### Gap 1: Not Using `SDKError` Type Guard

**Node SDK exports `SDKError` and `ErrorCode` enum:**

```typescript
import { Magic, SDKError, ErrorCode } from '@magic-sdk/admin';
```

**Your code:** Uses string matching on `err.message` instead of checking error codes.

**Problem:** String matching is fragile and doesn't catch all error types.

**Example from docs:**
```typescript
try {
  await magic.token.validate(didToken);
} catch (err) {
  if (err instanceof SDKError) {
    switch (err.code) {
      case ErrorCode.TokenExpired:
        // Handle specifically
        break;
      case ErrorCode.MalformedTokenError:
        // Handle specifically
        break;
      case ErrorCode.IncorrectSignerAddress:
        // Handle specifically
        break;
    }
  }
}
```

### Gap 2: Missing Error Codes

**Node SDK Error Codes NOT handled:**

| Code | Enum Key | Your Status |
|------|----------|-------------|
| `TokenExpired` | ✅ Detected via string match |
| `TokenCannotBeUsedYet` | ❌ Missing |
| `IncorrectSignerAddress` | ❌ Missing |
| `FailedRecoveryProof` | ❌ Missing |
| `ApiKeyMissing` | ❌ Missing |
| `MalformedTokenError` | ✅ Detected via string match |
| `ServiceError` | ❌ Missing (has `.data` property) |
| `ExpectedBearerString` | ❌ Missing |
| `AudienceMismatch` | ❌ Missing |

### Gap 3: `ServiceError` Not Handled

**Node SDK docs:**
> `ServiceError` — An error occurred while communicating with the Magic API. Be sure to check the `data` property of the error object for additional context.

**Your code:** Only checks for `statusCode === 429`, but `ServiceError` can have other status codes.

### Gap 4: No Type Safety

**Current:**
```typescript
const [, claim] = magic.token.decode(input.didToken) as [
  string,
  { tid: string; ext: number },
];
```

**Problem:** Manual type assertion. Node SDK exports `Claim` interface:

```typescript
import { Claim } from '@magic-sdk/admin';
```

---

## Recommendations

### 1. Import Error Types

**Update `apps/server/src/features/auth/router.ts`:**

```typescript
import { Magic, SDKError, ErrorCode } from "@magic-sdk/admin";
import type { Claim } from "@magic-sdk/admin";
```

### 2. Replace String Matching with Error Codes

**Before:**
```typescript
function handleTokenValidationError(err: unknown): never {
  const msg = err instanceof Error ? err.message.toLowerCase() : "";
  if (msg.includes("expired")) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "DID token expired" });
  }
  if (msg.includes("malformed") || msg.includes("parse")) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Invalid DID token format",
    });
  }
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Invalid or expired DID token",
  });
}
```

**After:**
```typescript
function handleTokenValidationError(err: unknown): never {
  if (err instanceof SDKError) {
    switch (err.code) {
      case ErrorCode.TokenExpired:
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "DID token expired",
        });
      case ErrorCode.TokenCannotBeUsedYet:
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "DID token not yet valid",
        });
      case ErrorCode.MalformedTokenError:
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid DID token format",
        });
      case ErrorCode.IncorrectSignerAddress:
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "DID token signature verification failed",
        });
      case ErrorCode.FailedRecoveryProof:
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "DID token recovery failed",
        });
      case ErrorCode.AudienceMismatch:
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "DID token audience mismatch",
        });
      default:
        logger.warn(
          { code: err.code, message: err.message },
          "Unexpected SDKError in token validation"
        );
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired DID token",
        });
    }
  }

  // Non-SDKError (shouldn't happen, but fallback)
  logger.error(
    {
      errorType: err instanceof Error ? err.constructor.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
    },
    "Unexpected error in token validation"
  );
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Invalid or expired DID token",
  });
}
```

### 3. Improve Metadata Error Handling

**Before:**
```typescript
function handleMetadataError(err: unknown): never {
  const statusCode =
    err instanceof Error &&
    "data" in err &&
    typeof (err as { data?: { statusCode?: number } }).data?.statusCode ===
      "number"
      ? (err as { data: { statusCode: number } }).data.statusCode
      : undefined;
  if (statusCode === 429) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limited by Magic API. Please try again shortly.",
    });
  }
  // ...
}
```

**After:**
```typescript
function handleMetadataError(err: unknown): never {
  if (err instanceof SDKError) {
    if (err.code === ErrorCode.ServiceError) {
      const statusCode = (err.data as Array<{ statusCode?: number }>)?.[0]?.statusCode;
      if (statusCode === 429) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limited by Magic API. Please try again shortly.",
        });
      }
      logger.warn(
        { statusCode, message: err.message },
        "Magic API service error"
      );
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch user metadata",
      });
    }
    
    logger.warn(
      { code: err.code, message: err.message },
      "SDKError in metadata fetch"
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch user metadata",
    });
  }

  logger.error(
    {
      errorType: err instanceof Error ? err.constructor.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
    },
    "Unexpected error in metadata fetch"
  );
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to fetch user metadata",
  });
}
```

### 4. Use Typed `Claim` Interface

**Before:**
```typescript
const [, claim] = magic.token.decode(input.didToken) as [
  string,
  { tid: string; ext: number },
];
```

**After:**
```typescript
const [, claim] = magic.token.decode(input.didToken) as [string, Claim];
const nonceTid = claim.tid;
const nonceExpiresAt = new Date(claim.ext * 1000);
```

### 5. Create Error Handler Utilities

**New file: `apps/server/src/features/auth/lib/magic-errors.ts`:**

```typescript
import { SDKError, ErrorCode } from "@magic-sdk/admin";
import { TRPCError } from "@trpc/server";
import { logger } from "@doji/logger";

export function isMagicSDKError(err: unknown): err is SDKError {
  return err instanceof SDKError;
}

export function mapTokenValidationError(err: unknown): never {
  if (isMagicSDKError(err)) {
    switch (err.code) {
      case ErrorCode.TokenExpired:
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "DID token expired",
        });
      case ErrorCode.TokenCannotBeUsedYet:
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "DID token not yet valid",
        });
      case ErrorCode.MalformedTokenError:
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid DID token format",
        });
      case ErrorCode.IncorrectSignerAddress:
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "DID token signature verification failed",
        });
      case ErrorCode.FailedRecoveryProof:
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "DID token recovery failed",
        });
      case ErrorCode.AudienceMismatch:
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "DID token audience mismatch",
        });
      default:
        logger.warn(
          { code: err.code, message: err.message },
          "Unexpected SDKError in token validation"
        );
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired DID token",
        });
    }
  }

  logger.error(
    {
      errorType: err instanceof Error ? err.constructor.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
    },
    "Unexpected error in token validation"
  );
  throw new TRPCError({
    code: "UNAUTHORIZED",
    message: "Invalid or expired DID token",
  });
}

export function mapMetadataError(err: unknown): never {
  if (isMagicSDKError(err)) {
    if (err.code === ErrorCode.ServiceError) {
      const statusCode = (err.data as Array<{ statusCode?: number }>)?.[0]?.statusCode;
      if (statusCode === 429) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "Rate limited by Magic API. Please try again shortly.",
        });
      }
    }
    logger.warn(
      { code: err.code, message: err.message },
      "SDKError in metadata fetch"
    );
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch user metadata",
    });
  }

  logger.error(
    {
      errorType: err instanceof Error ? err.constructor.name : typeof err,
      message: err instanceof Error ? err.message : String(err),
    },
    "Unexpected error in metadata fetch"
  );
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Failed to fetch user metadata",
  });
}
```

---

## Action Items

- [ ] Import `SDKError`, `ErrorCode`, `Claim` from `@magic-sdk/admin`
- [ ] Replace string matching with error code checks
- [ ] Handle all 9 error codes from Node SDK
- [ ] Extract error handlers to utility file
- [ ] Use typed `Claim` interface
- [ ] Test all error paths (expired, malformed, rate limit, etc.)

---

## Testing Checklist

- [ ] Expired DID token
- [ ] Malformed DID token
- [ ] Token not yet valid (nbf in future)
- [ ] Incorrect signer address
- [ ] Audience mismatch
- [ ] Magic API rate limit (429)
- [ ] Magic API service error
- [ ] Network timeout

