# Frontend Type Usage Audit

## Issue: Duplicate Type Definitions

The codebase has **two sets of types** for the same entities:

### Old Types (Currently Used)
- Location: `packages/types/src/market.ts`
- Types: `Market`, `Event`, `Tag`, `Series`, `MarketToken`, `MarketRewards`, `SportsMetadata`
- Usage: **Used throughout frontend** (50+ files in `apps/web`)
- Status: ⚠️ Less comprehensive than new types

### New Types (Not Used)
- Location: `packages/types/src/gamma/`, `packages/types/src/data/`
- Types: `GammaMarket`, `GammaEvent`, `GammaTag`, `GammaSeries`, `DataPosition`, `DataTrade`
- Usage: **Not used anywhere** (only in documentation)
- Status: ✅ More comprehensive (150+ fields for GammaMarket vs ~50 for Market)

## Frontend Usage Analysis

### Files Using Old Types (50+ files)

**Components:**
- `apps/web/src/components/event/event-card.tsx` - `Event`, `Market`
- `apps/web/src/components/event/event-list.tsx` - `Event`
- `apps/web/src/components/event/event-filters.tsx` - `Tag`
- `apps/web/src/components/market/series-group.tsx` - `Market`, `Series`
- `apps/web/src/components/trading/order-form.tsx` - `Market`, `OrderFormState`, `OrderResponse`
- `apps/web/src/components/trading/trading-layout.tsx` - `Market`, `MarketToken`, `OpenOrder`
- `apps/web/src/components/trading/activity-feed.tsx` - `Trade`
- `apps/web/src/components/portfolio/position-table.tsx` - `Position`
- `apps/web/src/components/portfolio/closed-positions.tsx` - `ClosedPosition`

**Stores:**
- `apps/web/src/stores/orders.ts` - `OpenOrder`, `UserOrderEvent`
- `apps/web/src/stores/positions.ts` - `Position`, `UserTradeEvent`
- `apps/web/src/stores/notifications.ts` - `LastTradePriceEvent`

**Lib:**
- `apps/web/src/lib/market-utils.ts` - `Market`, `Series`
- `apps/web/src/lib/events.ts` - `Event`
- `apps/web/src/lib/polymarket/order-validation.ts` - `Market`, `OrderFormState`
- `apps/web/src/lib/websocket/market-channel.ts` - WebSocket types

### Files Using New Types

**None** - The new `GammaMarket`, `GammaEvent`, `DataPosition`, etc. types are not imported anywhere.

## Problems

### 1. Type Duplication
- `Market` (old) vs `GammaMarket` (new) - same entity, different definitions
- `Event` (old) vs `GammaEvent` (new) - same entity, different definitions
- `Tag` (old) vs `GammaTag` (new) - same entity, different definitions

### 2. Incomplete Types
Old types are less comprehensive:
- `Market`: ~50 fields
- `GammaMarket`: 150+ fields (includes `id`, `live`, `ended`, `negRisk`, `series`, etc.)

### 3. Naming Confusion
- Old types use generic names: `Market`, `Event`, `Position`, `Trade`
- New types use prefixed names: `GammaMarket`, `GammaEvent`, `DataPosition`, `DataTrade`
- Frontend doesn't know which to use

## Recommendations

### Option 1: Migrate to New Types (Recommended)

**Pros:**
- More comprehensive field definitions
- Clear API source naming (Gamma vs Data)
- Aligns with backend schemas

**Cons:**
- Requires updating 50+ frontend files
- Breaking change for existing code

**Steps:**
1. Deprecate old types in `market.ts`
2. Re-export new types with old names for compatibility:
   ```typescript
   // packages/types/src/index.ts
   export { GammaMarket as Market } from "./gamma/market";
   export { GammaEvent as Event } from "./gamma/event";
   export { GammaTag as Tag } from "./gamma/nested";
   export { GammaSeries as Series } from "./gamma/nested";
   ```
3. Update frontend imports gradually
4. Remove old `market.ts` file

### Option 2: Keep Old Types, Delete New Types

**Pros:**
- No frontend changes needed
- Simpler type structure

**Cons:**
- Loses comprehensive field definitions
- Misalignment with backend schemas
- Wastes work on new types

### Option 3: Merge Types

**Pros:**
- Best of both worlds
- Single source of truth

**Cons:**
- Requires careful merging
- May break existing code

## Immediate Actions Required

### Critical Issues

1. **Unused Code**: New types in `gamma/` and `data/` directories are not used
2. **Type Mismatch**: Frontend uses `Market` but backend schemas validate against different field sets
3. **Missing Fields**: Frontend may not have access to important fields like:
   - `GammaMarket.id` (only has `condition_id`)
   - `GammaMarket.live`, `GammaMarket.ended`
   - `GammaEvent.series[]`
   - `DataPosition.proxyWallet`, `DataPosition.avgPrice`

### Non-Critical Issues

1. **Import Inconsistency**: Some files import from `@poly/types`, others from `@poly/types/trade`
2. **WebSocket Types**: Using old `Position`, `Trade` types instead of `DataPosition`, `DataTrade`

## Proposed Solution

### Phase 1: Compatibility Layer (Immediate)

Create type aliases in `packages/types/src/index.ts`:

```typescript
// Backward compatibility - map old names to new comprehensive types
export type { GammaMarket as Market } from "./gamma/market";
export type { GammaEvent as Event } from "./gamma/event";
export type { GammaTag as Tag } from "./gamma/nested";
export type { GammaSeries as Series } from "./gamma/nested";

// Keep exporting new names for explicit usage
export * from "./gamma";
export * from "./data";
```

### Phase 2: Deprecate Old Types (Next Sprint)

Add deprecation notices to `market.ts`:

```typescript
/**
 * @deprecated Use GammaMarket from @poly/types/gamma instead
 */
export interface Market { ... }
```

### Phase 3: Remove Old Types (Future)

After frontend migration, delete `packages/types/src/market.ts`.

## Testing Impact

All tests currently use old types:
- `apps/web/src/__tests__/properties/market.prop.test.ts`
- `apps/web/src/components/event/__tests__/event-card.property.test.tsx`
- `apps/web/src/components/trading/__tests__/order-form.test.ts`

These will need updates if types change.

## Conclusion

**Status**: ⚠️ **Type system is fragmented**

The frontend is using old, less comprehensive types while new, better types exist but are unused. This creates:
- Maintenance burden (two sets of types)
- Potential bugs (missing fields)
- Confusion for developers

**Recommended Action**: Implement Phase 1 compatibility layer immediately to unify the type system without breaking existing code.
