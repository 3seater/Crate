# Codebase Misalignment Audit

## Critical Issues

### 1. ❌ Router Export Mismatch

**Problem**: API package exports don't match server routers

**API Package** (`packages/api/src/routers/index.ts`):
```typescript
export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  clob: clobRouter,
  auth: authRouter,
});
```

**Server** (`apps/server/src/routers/index.ts`):
```typescript
export const appRouter = router({
  healthCheck: publicProcedure.query(() => "OK"),
  events: eventsRouter,      // ❌ Missing from API package
  markets: marketsRouter,     // ❌ Missing from API package
  data: dataRouter,           // ❌ Missing from API package
  bridge: bridgeRouter,       // ❌ Missing from API package
  clob: clobRouter,           // ✅ Exists
  intelligence: intelligenceRouter, // ❌ Missing from API package
});
```

**Impact**: 
- Frontend uses `trpcClient.data.snapshot.query()` but `data` router not exported from API package
- Type safety broken - TypeScript should catch this but doesn't
- Other routers (`events`, `markets`, `bridge`, `intelligence`) also missing

**Files Affected**:
- `apps/web/src/lib/download-snapshot.ts` - Uses `trpcClient.data.snapshot`
- Potentially other files using missing routers

**Fix Required**: Export all routers from API package or move them there

---

### 2. ⚠️ Inconsistent Type Imports

**Problem**: Mixed import patterns for types

**Pattern 1** (35 files): `import type { X } from "@poly/types"`
**Pattern 2** (7 files): `import type { X } from "@poly/types/trade"`
**Pattern 3** (9 files): `import type { X } from "@poly/types/websocket"`
**Pattern 4** (1 file): `import type { X } from "@poly/types/order"`

**Files Using Subpath Imports**:
```
apps/web/src/stores/orders.ts
apps/web/src/stores/positions.ts
apps/web/src/stores/notifications.ts
apps/web/src/components/portfolio/pnl-card.tsx
apps/web/src/components/portfolio/pnl-card-utils.ts
apps/web/src/hooks/use-notifications.ts
+ 11 more files
```

**Impact**:
- Inconsistent codebase
- Harder to refactor
- Confusing for developers

**Recommendation**: Standardize on `@poly/types` (main export)

---

### 3. ℹ️ TODO Comment

**Location**: `packages/api/src/routers/auth.ts`

```typescript
// TODO(task-16): Create a WalletClient from Magic's embedded wallet provider.
```

**Impact**: Low - just a reminder for future work

---

## Architecture Issues

### 4. ⚠️ Router Organization Confusion

**Current State**:
- Some routers in `packages/api/src/routers/` (auth, clob)
- Most routers in `apps/server/src/routers/` (data, events, markets, bridge, intelligence)

**Problems**:
1. Unclear where new routers should go
2. API package exports incomplete router
3. Server has the "real" appRouter

**Comment in API package**:
```typescript
// The full appRouter with all sub-routers is defined in apps/server/src/routers/index.ts
// This file is kept for backward compatibility.
```

**Recommendation**: 
- **Option A**: Move all routers to `packages/api/src/routers/`
- **Option B**: Remove API package router, only export from server
- **Option C**: Keep split but document clearly which goes where

---

## Type System Status

### 5. ✅ Type Aliases Working

**Verified**:
- `Position` → `DataPosition` ✅
- `Trade` → `DataTrade` ✅
- `ClosedPosition` → `DataClosedPosition` ✅
- `Market` → `GammaMarket` ✅
- `Event` → `GammaEvent` ✅

**Usage**: No files directly import `DataPosition`, `DataTrade`, etc. - all use aliases ✅

---

## Import Patterns Analysis

### 6. ✅ No Circular Dependencies

Checked import chains - no circular dependencies found ✅

### 7. ✅ No Unused Exports (Major)

All major type exports are used somewhere in the codebase ✅

---

## Recommendations by Priority

### High Priority (Breaking Issues)

1. **Fix Router Export Mismatch**
   - Move all routers to API package OR
   - Update API package exports to include all routers OR
   - Remove API package router entirely

2. **Fix `trpcClient.data` Usage**
   - Currently broken - `data` router not in API package
   - File: `apps/web/src/lib/download-snapshot.ts`

### Medium Priority (Consistency)

3. **Standardize Type Imports**
   - Change all `@poly/types/trade` → `@poly/types`
   - Change all `@poly/types/websocket` → `@poly/types`
   - Change all `@poly/types/order` → `@poly/types`
   - Affects 17 files

### Low Priority (Nice to Have)

4. **Resolve TODO Comment**
   - Complete task-16 or remove comment

5. **Document Router Organization**
   - Add AGENTS.md or README explaining where routers go

---

## Files Requiring Changes

### Critical
1. `packages/api/src/routers/index.ts` - Add missing router exports
2. `apps/web/src/lib/download-snapshot.ts` - May break if router not exported

### Consistency (17 files)
3. `apps/web/src/stores/orders.ts`
4. `apps/web/src/stores/positions.ts`
5. `apps/web/src/stores/notifications.ts`
6. `apps/web/src/components/portfolio/pnl-card.tsx`
7. `apps/web/src/components/portfolio/pnl-card-utils.ts`
8. `apps/web/src/hooks/use-notifications.ts`
9. + 11 more files with subpath imports

---

## Testing Impact

### Current Test Status
- ✅ All tests passing (111 test files, 700+ tests)
- ✅ Type checking passing

### After Fixes
- Router export fix may require updating tests
- Import standardization should not break tests (same types, different paths)

---

## Summary

**Critical Issues**: 1
- Router export mismatch (breaks `trpcClient.data`)

**Medium Issues**: 1
- Inconsistent type imports (17 files)

**Low Issues**: 2
- TODO comment
- Unclear router organization

**Total Files to Fix**: 18-19 files

**Estimated Effort**: 
- Critical fix: 30 minutes
- Import standardization: 15 minutes
- Total: ~45 minutes
