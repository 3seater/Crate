# Schema Audit Report

Comparing Zod schemas in `apps/server/src/lib/polymarket/schemas/` with TypeScript types in `packages/types/src/`.

## Status: ✅ ALIGNED

The schemas and types are properly separated by design:

### Architecture

1. **Types Package** (`packages/types/src/`)
   - Pure TypeScript interfaces
   - Comprehensive field definitions
   - Used for type safety across the codebase
   - No runtime validation

2. **Schemas** (`apps/server/src/lib/polymarket/schemas/`)
   - Zod schemas for runtime validation
   - Flexible with `.passthrough()` for API compatibility
   - Accept both camelCase (API) and snake_case (internal)
   - Coerce numbers from strings
   - Mark fields optional to handle API variations

### Key Differences (By Design)

| Aspect | Types | Schemas |
|--------|-------|---------|
| Purpose | Compile-time type safety | Runtime validation |
| Strictness | Comprehensive field definitions | Flexible, validates only critical fields |
| Field Names | Consistent naming (snake_case preferred) | Accept both camelCase & snake_case |
| Optional Fields | Explicit optionality | Liberal use of `.optional()` |
| Passthrough | N/A | `.passthrough()` allows extra fields |
| Number Handling | `number` type | `z.coerce.number()` for string→number |

## Gamma API

### GammaMarket Type vs MarketSchema

**Type** (`packages/types/src/gamma/market.ts`):
- 150+ fields comprehensively defined
- Includes: `id`, `question`, `conditionId`, `outcomes`, `volume`, `liquidity`, `active`, `closed`, `enableOrderBook`, `negRiskOther`, etc.

**Schema** (`schemas/gamma.ts`):
- ~40 validated fields
- Uses `.passthrough()` to allow additional fields
- Accepts both `conditionId` and `condition_id`
- Coerces numeric fields from strings

**Status**: ✅ Compatible - Schema validates subset, type provides full definition

### GammaEvent Type vs EventSchema

**Type** (`packages/types/src/gamma/event.ts`):
- 100+ fields including `markets[]`, `series[]`, `tags[]`
- Comprehensive event metadata

**Schema** (`schemas/gamma.ts`):
- ~20 validated fields
- Accepts both `startDate`/`start_date`, `endDate`/`end_date`
- Validates nested `markets` array with MarketSchema

**Status**: ✅ Compatible

### GammaTag, GammaSeries

**Types**: Defined in `packages/types/src/gamma/nested.ts`
**Schema**: `TagSchema` in `schemas/gamma.ts` validates `id`, `label`, `slug`

**Status**: ✅ Compatible

## Data API

### DataPosition Type vs PositionSchema

**Type** (`packages/types/src/data/positions.ts`):
- 23 fields: `proxyWallet`, `asset`, `conditionId`, `size`, `avgPrice`, `cashPnl`, `percentPnl`, `redeemable`, `mergeable`, etc.

**Schema** (`schemas/data.ts`):
- 8 validated fields: `asset`, `conditionId`, `size`, `curPrice`, `outcome`, `market`, `unrealizedPnl`, `realizedPnl`
- Uses `.passthrough()` for additional fields

**Status**: ✅ Compatible - Schema validates core fields

### DataTrade Type vs TradeSchema

**Type** (`packages/types/src/data/trades.ts`):
- Comprehensive trade fields

**Schema** (`schemas/data.ts`):
- Validates: `id`, `market`, `asset_id`, `side`, `size`, `price`, `fee_rate_bps`, `status`, `match_time`, `outcome`, `transaction_hash`, `trader_side`

**Status**: ✅ Compatible

### Leaderboard Types

**Types**: `TraderLeaderboardEntry`, `BuilderLeaderboardEntry` in `packages/types/src/data/leaderboard.ts`
**Schema**: `LeaderboardEntrySchema` accepts both `proxyWallet`/`address`, `userName`/`username`, `vol`/`volume`

**Status**: ✅ Compatible

## CLOB API

### OrderBook Types vs Schema

**Type** (`packages/types/src/clob/orderbook.ts`):
- `OrderBookSummary` with comprehensive fields

**Schema** (`schemas/clob.ts`):
- `OrderBookSnapshotSchema` validates core fields
- Includes `bids`, `asks`, `hash`, `timestamp`, `min_order_size`, `tick_size`, `neg_risk`

**Status**: ✅ Compatible

## Recommendations

### Current State: GOOD ✅

The separation between types and schemas is intentional and beneficial:

1. **Types** provide comprehensive compile-time safety
2. **Schemas** provide flexible runtime validation
3. Both handle API inconsistencies (camelCase vs snake_case)
4. Schemas use `.passthrough()` to avoid breaking on new API fields

### No Changes Required

The current architecture is sound. The schemas are intentionally more permissive than the types to handle:
- API field name variations
- Optional/missing fields in responses
- String-to-number coercion
- Future API additions without breaking validation

### Future Considerations

If stricter validation is needed:
1. Create separate "strict" schemas that match types exactly
2. Use for internal data structures
3. Keep current schemas for API responses
4. Consider using `z.infer<>` types from schemas where appropriate

## Conclusion

✅ **Schemas and types are properly aligned**

The flexible schema approach with `.passthrough()` and optional fields is the correct design for handling real-world API responses. The comprehensive types provide full type safety in the codebase. No changes needed.
