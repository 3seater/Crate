# Field Inconsistency Report

**Generated:** 2026-02-09  
**Status:** 🔴 Issues Found

## Critical Issues

### 1. Parameter Name Mismatch: `address` vs `user`

**Location:** `apps/server/src/routers/data.ts`

**Issue:** tRPC endpoints use `address` parameter but API clients expect `user`

**Affected Endpoints:**
- `data.positions` - Uses `address`, converts to `user`
- `data.closedPositions` - Likely same issue
- `data.activity` - Likely same issue
- `data.value` - Likely same issue

**Current Code:**
```typescript
positions: publicProcedure
  .input(z.object({
    address: z.string(),  // ❌ Wrong parameter name
    // ...
  }))
  .query(({ input }) => {
    return getPositions({ user: input.address, ...input });  // Manual conversion
  }),
```

**Expected Code:**
```typescript
positions: publicProcedure
  .input(z.object({
    user: z.string(),  // ✅ Correct parameter name
    // ...
  }))
  .query(({ input }) => {
    return getPositions(input);  // Direct pass-through
  }),
```

**Impact:** 
- Frontend must use `address` instead of `user`
- Inconsistent with API documentation
- Extra conversion logic needed
- Confusing for developers

**Fix Priority:** 🔴 High - Breaking change for frontend

---

## Verification Needed

### 2. Missing Parameters in tRPC

Need to verify these API client parameters are exposed in tRPC:

**getPositions()** - API Client has 11 params:
- ✅ user (as `address`)
- ✅ market[]
- ✅ eventId[]
- ✅ sizeThreshold
- ✅ redeemable
- ✅ mergeable
- ✅ limit
- ✅ offset
- ✅ sortBy
- ✅ sortDirection
- ✅ title

**getTrades()** - API Client has 9 params:
- Need to verify: limit, offset, takerOnly, filterType, filterAmount, market[], eventId[], user, side

**getActivity()** - API Client has 11 params:
- Need to verify: user, limit, offset, market[], eventId[], type[], start, end, sortBy, sortDirection, side

**getLeaderboard()** - API Client has 7 params:
- Need to verify: category, timePeriod, orderBy, limit, offset, user, userName

---

## Schema Validation Issues

### 3. Response Field Validation

Need to verify these response fields match actual API responses:

**BuilderLeaderboardEntry:**
- `rank` - Confirmed as `string` (was `number`, fixed)
- `builder` - Need to verify field name
- `builderLogo` - Need to verify field name (was `logo`?)
- `verified` - Need to verify field name
- `activeUsers` - Need to verify field name (was `users`?)

**MetaHolder:**
- Grouped by `token` - Need to verify structure
- Contains `holders[]` array - Need to verify nesting

**UserValue:**
- Returns array `UserValue[]` - Need to verify (was single object?)
- Contains `user` and `value` fields - Need to verify

---

## Type Export Issues

### 4. Missing Type Exports

Check if these types are properly exported from `@doji/types`:

**Gamma Types:**
- ✅ Event
- ✅ Market
- ✅ Tag
- ✅ Series
- ✅ Comment
- ✅ Search
- ✅ PublicProfileResponse
- ❓ Team
- ❓ SportMetadataItem
- ❓ SportsMarketTypesResponse

**Data Types:**
- ✅ Position
- ✅ ClosedPosition
- ✅ Trade
- ✅ ActivityItem
- ✅ UserValue
- ✅ MetaHolder
- ✅ TraderLeaderboardEntry
- ✅ BuilderLeaderboardEntry
- ✅ BuilderVolumeEntry
- ❓ OpenInterestItem
- ❓ LiveVolume
- ❓ Traded
- ❓ HealthResponse

**CLOB Types:**
- ✅ OrderBookSnapshot
- ✅ PriceHistory
- ❓ FeeRate
- ❓ TickSize

---

## Enum Consistency

### 5. Enum Value Verification

Need to verify these enums match API exactly (case-sensitive):

**Position sortBy:**
```typescript
enum: ["CURRENT", "INITIAL", "TOKENS", "CASHPNL", "PERCENTPNL", "TITLE", "RESOLVING", "PRICE", "AVGPRICE"]
```
- Need to verify with actual API

**Trade side:**
```typescript
enum: ["BUY", "SELL"]
```
- Need to verify with actual API

**Activity type:**
```typescript
enum: ["TRADE", "SPLIT", "MERGE", "REDEEM"]
```
- Need to verify with actual API

**Leaderboard category:**
```typescript
enum: ["POLITICS", "CRYPTO", "SPORTS"]
```
- Need to verify with actual API

**Leaderboard timePeriod:**
```typescript
enum: ["DAY", "WEEK", "MONTH", "ALL"]
```
- Need to verify with actual API

**Leaderboard orderBy:**
```typescript
enum: ["VOLUME", "PNL"]
```
- Need to verify with actual API

---

## Optional vs Required

### 6. Parameter Optionality

Need to verify which parameters are truly optional:

**getPositions():**
- `user` - Required ✅
- `market[]` - Optional ✅
- `eventId[]` - Optional ✅
- All others - Optional ✅

**getTrades():**
- All parameters optional? Need to verify

**getActivity():**
- `user` - Required? Need to verify
- All others - Optional? Need to verify

---

## Array Parameter Handling

### 7. Array Parameter Consistency

Verify array parameters are handled consistently:

**market[] parameter:**
- Used in: getPositions, getClosedPositions, getTrades, getActivity, getValue, getHolders
- Format: `z.array(z.string())`
- API expects: Comma-separated string or array?

**eventId[] parameter:**
- Used in: getPositions, getClosedPositions, getTrades, getActivity
- Format: `z.array(z.number())`
- API expects: Comma-separated string or array?

**type[] parameter:**
- Used in: getActivity
- Format: `z.array(z.enum([...]))`
- API expects: Comma-separated string or array?

---

## Timestamp Format

### 8. Timestamp Consistency

Verify timestamp format across endpoints:

**Activity timestamps:**
- `start` - Unix timestamp (number)?
- `end` - Unix timestamp (number)?

**Event dates:**
- `start_date_min` - ISO string?
- `start_date_max` - ISO string?
- `end_date_min` - ISO string?
- `end_date_max` - ISO string?

**Builder volume:**
- `dt` - Date string format?

---

## Next Actions

### Immediate Fixes Required

1. **Fix `address` → `user` parameter name** (Breaking change)
   - Update all data router endpoints
   - Update frontend to use `user` instead of `address`
   - Update documentation

2. **Verify all tRPC input schemas match API client params**
   - Check getTrades parameters
   - Check getActivity parameters
   - Check getLeaderboard parameters

3. **Test response schemas with real API data**
   - Make actual API calls
   - Validate responses against Zod schemas
   - Document any mismatches

4. **Add missing type exports**
   - Export Team, SportMetadataItem, etc.
   - Export OpenInterestItem, LiveVolume, etc.
   - Update index files

### Testing Strategy

1. **Unit Tests:** Verify schema validation with mock data
2. **Integration Tests:** Test with real API responses
3. **Property Tests:** Generate random valid inputs
4. **E2E Tests:** Test full data flow from API to frontend

### Documentation Updates

1. Update AGENTS.md files with findings
2. Document parameter naming conventions
3. Document array parameter handling
4. Document timestamp formats
5. Add examples for each endpoint
