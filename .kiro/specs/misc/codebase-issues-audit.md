# Codebase Issues Audit

**Date**: 2026-02-09  
**Status**: 42 lint errors, 1 TODO, multiple type safety issues

## Summary

- ✅ **Type Checks**: All passing (0 errors)
- ✅ **Tests**: All passing (7/7 packages)
- ❌ **Linting**: 42 Biome errors
- ⚠️ **Code Quality**: Multiple `any` types, 1 TODO comment

---

## 1. Biome Lint Errors (42 total)

### 1.1 Style Issues (FIXABLE)

**useBlockStatements** - Missing block statements for single-line conditionals:

```
apps/docs/src/app/docs/[[...slug]]/page.tsx:18:2
apps/docs/src/app/docs/[[...slug]]/page.tsx:62:2
apps/docs/src/app/llms.mdx/docs/[[...slug]]/route.ts:13:2
apps/docs/src/app/og/docs/[...slug]/route.tsx:15:2
apps/docs/src/components/ai/page-actions.tsx:33:3
```

**Example**:
```typescript
// Current
if (!page) notFound();

// Should be
if (!page) {
  notFound();
}
```

**Fix**: Run `pnpm fix` to auto-fix these.

---

### 1.2 Suspicious Code Issues

#### noExplicitAny (10 occurrences)

**apps/server/src/lib/polymarket/gamma.ts** (6 instances):
```typescript
Line 84:  const raw = (market as any).clobTokenIds;
Line 157: sanitizeImageUrls(event as any);
Line 160: synthesizeTokens(sanitizeImageUrls(m as any))
Line 195: return synthesizeTokens(sanitizeImageUrls(market as any));
Line 200: sanitizeImageUrls(event as any);
Line 203: synthesizeTokens(sanitizeImageUrls(m as any))
```

**packages/types/src/gamma/nested.ts** (2 instances):
```typescript
Line 60: [key: string]: any;  // in MarketSummary
Line 75: [key: string]: any;  // in Collection
```

**packages/types/src/gamma/search.ts** (2 instances):
```typescript
Line 8:  [key: string]: any;
Line 44: [key: string]: any;
```

**Impact**: Type safety compromised. These `any` types bypass TypeScript's type checking.

**Recommendation**: 
- For gamma.ts: Create proper type guards or use `unknown` with type narrowing
- For nested.ts/search.ts: Define explicit optional fields or use `Record<string, unknown>`

---

### 1.3 Accessibility Issues

**useButtonType** - Missing button type attribute:
```
apps/docs/src/components/ai/page-actions.tsx:54:3
```

**Fix**: Add `type="button"` to button elements that aren't submit buttons.

---

### 1.4 Async Issues

**useAwait** - Async function without await:
```
apps/docs/src/app/llms.txt/route.ts:5:8
```

**Fix**: Either add `await` or remove `async` keyword.

---

## 2. TODO Comments

### apps/server/src/routers/auth.ts:72

```typescript
// TODO(task-16): Create a WalletClient from Magic's embedded wallet provider.
// The server needs the user's Magic wallet to sign transactions for Safe
// deployment and CLOB credential derivation. This requires either:
//   a) A delegated signing flow where the client forwards signatures, or
```

**Status**: Unresolved implementation task  
**Priority**: Medium (functionality may be incomplete)

---

## 3. Code Quality Issues

### 3.1 Silent Error Suppression

**apps/web/src/app/profile/[address]/page.tsx:140**:
```typescript
serverTrpc.data.value.query({ address }).catch(() => undefined),
```

**Issue**: Errors are silently swallowed without logging.  
**Recommendation**: Log errors or handle them explicitly.

---

### 3.2 Test-Only Type Suppressions

**apps/web/src/lib/websocket/__tests__/rtds.test.ts:66**:
```typescript
// @ts-expect-error - test mock assignment
```

**Status**: Acceptable for test files.

---

### 3.3 Console Usage

**apps/server/src/lib/rate-limiter.ts:294**:
```typescript
console.warn(...)
```

**Status**: Acceptable - legitimate warning for unknown source fallback.

---

## 4. Environment Variable Access

All `process.env` accesses have proper fallbacks:

```typescript
// ✅ Good pattern - all have fallbacks
process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3001"
process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "placeholder"
process.env.NEXT_PUBLIC_WS_MARKET_URL ?? "..."
process.env.NEXT_PUBLIC_RTDS_URL ?? "wss://ws-live-data.polymarket.com"
process.env.NEXT_PUBLIC_WS_USER_URL ?? "..."
```

---

## 5. Import Patterns

✅ **No deep relative imports** (`../../../`)  
✅ **No subpath imports** (all using `@poly/types`)  
⚠️ **Default exports**: Used in Next.js pages (acceptable pattern)

---

## Recommendations

### Priority 1: Fix Lint Errors
```bash
pnpm fix  # Auto-fixes 6 style issues
```

Then manually fix:
- 10 `any` type issues
- 1 button type issue
- 1 async/await issue

### Priority 2: Improve Type Safety

**gamma.ts**: Replace `as any` with proper types:
```typescript
// Instead of
const raw = (market as any).clobTokenIds;

// Use
const raw = 'clobTokenIds' in market ? market.clobTokenIds : undefined;
```

**nested.ts/search.ts**: Replace index signatures:
```typescript
// Instead of
[key: string]: any;

// Use
[key: string]: unknown;
// or define explicit optional fields
```

### Priority 3: Address TODO

Resolve or document the Magic wallet implementation task.

---

## Metrics

| Category | Count | Status |
|----------|-------|--------|
| Type Errors | 0 | ✅ |
| Test Failures | 0 | ✅ |
| Lint Errors | 42 | ❌ |
| TODO Comments | 1 | ⚠️ |
| `any` Types | 10 | ⚠️ |
| Silent Catches | 1 | ⚠️ |

---

## Next Steps

1. Run `pnpm fix` to auto-fix style issues
2. Create type guards for gamma.ts
3. Replace `any` with `unknown` in type definitions
4. Add button types in docs components
5. Fix async/await in llms.txt route
6. Document or resolve TODO comment
