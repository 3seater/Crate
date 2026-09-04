# Type Misalignment Report

## Critical Issues Found

### 1. Missing Schema: ClosedPositionSchema ❌

**Location**: `apps/server/src/lib/polymarket/data.ts:130`

```typescript
export async function getClosedPositions(
	address: string
): Promise<ClosedPosition[]> {
	return await fetchJson("/closed-positions", z.array(ClosedPositionSchema), {
		//                                                  ^^^^^^^^^^^^^^^^^^^^
		//                                                  UNDEFINED - NOT IMPORTED
		user: address,
	});
}
```

**Problem**: 
- Code references `ClosedPositionSchema` but it doesn't exist
- Not defined in `apps/server/src/lib/polymarket/schemas/data.ts`
- Not imported in `data.ts`
- This will cause a runtime error when called

**Fix Required**: Create `ClosedPositionSchema` in `schemas/data.ts`

---

### 2. Type Duplication: Position vs DataPosition ⚠️

**Current State**:
- `Position` in `packages/types/src/trade.ts` - **8 fields** (used everywhere)
- `DataPosition` in `packages/types/src/data/positions.ts` - **23 fields** (unused)

**Fields in DataPosition but NOT in Position**:
- `proxyWallet` (Address)
- `avgPrice`, `initialValue`, `currentValue`
- `cashPnl`, `percentPnl`
- `totalBought`, `realizedPnl`, `percentRealizedPnl`
- `redeemable`, `mergeable`
- `title`, `slug`, `icon`, `eventSlug`
- `outcomeIndex`, `oppositeOutcome`, `oppositeAsset`
- `endDate`, `negativeRisk`

**Impact**: Frontend/backend missing access to 15+ important fields from Data API

---

### 3. Type Duplication: Trade vs DataTrade ⚠️

**Current State**:
- `Trade` in `packages/types/src/trade.ts` - **18 fields** (used everywhere)
- `DataTrade` in `packages/types/src/data/trades.ts` - **20 fields** (unused)

**Fields in DataTrade but NOT in Trade**:
- `proxyWallet` (Address)
- `title`, `slug`, `icon`, `eventSlug`
- `outcomeIndex`
- `name`, `pseudonym`, `bio`
- `profileImage`, `profileImageOptimized`

**Fields in Trade but NOT in DataTrade**:
- `id`, `market`, `fee_rate_bps`, `status`
- `match_time`, `transaction_hash`, `trader_side`
- `taker_order_id`, `last_update`, `bucket_index`
- `owner`, `maker_address`, `type`, `maker_orders`

**Problem**: These appear to be from **different APIs**:
- `Trade` = CLOB API trade format
- `DataTrade` = Data API trade format

---

### 4. Missing ClosedPosition Fields ⚠️

**Current State**:
```typescript
// packages/types/src/trade.ts
export interface ClosedPosition extends Position {
	exitPrice: number;
	closedAt: string;
}
```

**DataClosedPosition has 17 fields**:
```typescript
// packages/types/src/data/positions.ts
export interface DataClosedPosition {
	proxyWallet: Address;
	asset: string;
	conditionId: Hash64;
	size: number;
	avgPrice: number;
	exitPrice: number;
	cashPnl: number;
	percentPnl: number;
	totalBought: number;
	totalSold: number;
	realizedPnl: number;
	percentRealizedPnl: number;
	closedAt: string;
	title: string;
	slug: string;
	icon: string;
	eventSlug: string;
}
```

**Missing from ClosedPosition**: 13 fields including `proxyWallet`, `avgPrice`, `cashPnl`, `percentPnl`, `totalBought`, `totalSold`, `title`, `slug`, etc.

---

## Schema Coverage Gaps

### Data API Schemas (schemas/data.ts)

| Type | Schema Exists | Fields Validated | Total Fields | Coverage |
|------|---------------|------------------|--------------|----------|
| Position | ✅ PositionSchema | 8 | 23 (DataPosition) | 35% |
| ClosedPosition | ❌ **MISSING** | 0 | 17 (DataClosedPosition) | 0% |
| Trade | ✅ TradeSchema | 17 | 20 (DataTrade) | 85% |
| Activity | ❌ Missing | 0 | 22 | 0% |
| Holder | ✅ HolderEntrySchema | 4 | 4 | 100% |
| Leaderboard | ✅ LeaderboardEntrySchema | 13 | 13 | 100% |

---

## Recommendations

### Immediate Fixes (Critical)

1. **Create ClosedPositionSchema**
   ```typescript
   // apps/server/src/lib/polymarket/schemas/data.ts
   export const ClosedPositionSchema = PositionSchema.extend({
     exitPrice: z.coerce.number(),
     closedAt: z.string(),
   }).passthrough();
   ```

2. **Import ClosedPositionSchema in data.ts**
   ```typescript
   import {
     ClosedPositionSchema, // ADD THIS
     PositionSchema,
     TradeSchema,
     // ...
   } from "./schemas/data";
   ```

### Type System Cleanup (Recommended)

#### Option A: Alias Data Types (Like Market/Event)

```typescript
// packages/types/src/index.ts
export type { DataPosition as Position } from "./data/positions";
export type { DataClosedPosition as ClosedPosition } from "./data/positions";
export type { DataTrade as Trade } from "./data/trades";
```

**Pros**: 
- Frontend gets comprehensive types automatically
- Consistent with Market/Event approach
- No code changes needed

**Cons**:
- Breaks CLOB Trade type usage
- Position/Trade are used in multiple contexts

#### Option B: Keep Separate, Document Usage

Keep both sets of types but document when to use each:
- `Position`/`Trade` = Simple types for internal use
- `DataPosition`/`DataTrade` = Full Data API response types

**Pros**:
- No breaking changes
- Clear separation of concerns

**Cons**:
- Duplicate definitions
- Frontend missing fields

#### Option C: Merge Types

Merge all fields from both types into one comprehensive type.

**Pros**:
- Single source of truth
- All fields available

**Cons**:
- Large interfaces
- Some fields may be mutually exclusive

---

## Usage Analysis

### Position Type Usage

**Files using `Position` from `trade.ts`**: 7 files
- `apps/web/src/stores/positions.ts`
- `apps/web/src/components/portfolio/pnl-card.tsx`
- `apps/web/src/components/portfolio/pnl-card-utils.ts`
- `apps/web/src/components/portfolio/position-table.tsx`
- Tests: 3 files

**Files using `DataPosition`**: 0 files

### Trade Type Usage

**Files using `Trade` from `trade.ts`**: 5+ files
- `apps/web/src/components/trading/activity-feed.tsx`
- `apps/web/src/components/portfolio/trade-history.tsx`
- Tests: 3+ files

**Files using `DataTrade`**: 0 files

---

## Impact Assessment

### High Priority

1. ❌ **ClosedPositionSchema missing** - Will cause runtime error
2. ⚠️ **Position missing 15 fields** - Frontend can't access important data
3. ⚠️ **ClosedPosition missing 13 fields** - Portfolio analytics incomplete

### Medium Priority

4. ⚠️ **Trade type confusion** - CLOB vs Data API trades
5. ⚠️ **Activity type unused** - No schema or usage

### Low Priority

6. ℹ️ **Type duplication** - Maintenance burden but not breaking

---

## Proposed Action Plan

### Phase 1: Fix Critical Bug (Immediate)

1. Create `ClosedPositionSchema` in `schemas/data.ts`
2. Import and use in `data.ts`
3. Test `/closed-positions` endpoint

### Phase 2: Enhance Schemas (Next)

1. Expand `PositionSchema` to validate more fields (use `.passthrough()` for flexibility)
2. Create `ActivitySchema` for activity endpoint
3. Document which fields are validated vs passed through

### Phase 3: Type System Decision (Future)

Decide on Option A, B, or C for Position/Trade types based on:
- Are CLOB trades and Data API trades the same thing?
- Do we need both Position types?
- What does the actual API return?

---

## Files Requiring Changes

### Immediate (Phase 1)
1. `apps/server/src/lib/polymarket/schemas/data.ts` - Add ClosedPositionSchema
2. `apps/server/src/lib/polymarket/data.ts` - Import ClosedPositionSchema

### Recommended (Phase 2)
3. `apps/server/src/lib/polymarket/schemas/data.ts` - Expand PositionSchema
4. `apps/server/src/lib/polymarket/schemas/data.ts` - Add ActivitySchema

### Optional (Phase 3)
5. `packages/types/src/index.ts` - Type aliases decision
6. `packages/types/src/trade.ts` - Potentially merge or deprecate
