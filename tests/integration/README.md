# Integration Tests

Integration tests for the Gamma API and Data API clients. These tests make real API calls to validate the implementation against the OpenAPI specifications.

## Test Files

### gamma.test.ts (52 tests)
Comprehensive integration tests covering all Gamma API endpoints:

**Basic Functionality** (7 tests)
- API status, markets, events, tags, search

**Schema Validation** (5 tests)
- Market, event, tag schema validation
- Required fields per OpenAPI spec

**Endpoint Coverage** (6 tests)
- Pagination, filtering, comments (with spec bug documentation)

**Sports API** (4 tests)
- Teams, metadata, market types

**Series API** (3 tests)
- List, by ID, error handling

**Related Tags** (2 tests)
- Tag relationships

**Comments by User** (1 test)
- User-specific comments

**Public Profiles** (1 test)
- Profile retrieval

**Active/Closed Filtering** (4 tests)
- Event and market status filters

**Error Handling** (4 tests)
- Invalid IDs (404 errors)

**Query Parameter Edge Cases** (10 tests)
- Negative/zero/large limits, offsets, arrays, booleans, undefined values, pagination, filter combinations

### data.test.ts (15 tests)
Comprehensive integration tests covering all Data API endpoints:

**Health Check** (1 test)
- API status

**User Data** (3 tests)
- Markets traded with structure validation
- Current positions with OpenAPI spec validation
- Position sorting verification

**Trading Data** (3 tests)
- Trades with complete structure validation
- Side filtering
- Activity type validation

**Market Data** (2 tests)
- Open interest structure
- Live volume with market breakdown

**Leaderboards** (4 tests)
- Trader leaderboard with rankings
- Category filtering
- Builder leaderboard with volume
- Builder volume time-series with timestamps

**Error Handling** (2 tests)
- Invalid address rejection
- Non-existent event ID handling

### clob.test.ts (26 tests)
Integration tests for CLOB public endpoints (no authentication required):

**Health Check** (1 test)
- Heartbeat status

**Markets** (5 tests)
- Fetch markets list with pagination
- Fetch single market by condition ID
- Fetch simplified markets
- Fetch sampling markets
- Fetch sampling simplified markets

**Order Book** (4 tests)
- Fetch order book for active token
- Validate bid/ask structure
- Fetch batch order books
- Calculate liquidity metrics (health, spread, depth)

**Pricing** (10 tests)
- Tick size validation
- Best price for buy side
- Best price for sell side
- Batch prices for multiple tokens
- Midpoint price for active market
- Batch midpoints for multiple tokens
- Bid-ask spread calculation
- Batch spreads for multiple tokens
- Calculate market price for amount
- Price history with timestamps

**Trades** (2 tests)
- Last trade price with side validation
- Batch last trade prices

**Market Parameters** (2 tests)
- Fee rate (base_fee) validation
- Negative risk status check

**Server Info** (2 tests)
- Server timestamp validation
- Geoblock status check (blocked, ip, country, region)

**Note:** Tests use smart token selection - iterates through high-volume active markets to find one with an orderbook. Trading endpoints (place/cancel orders) and authenticated endpoints (getTrades, getMarketTradesEvents) require API keys and are not tested in integration tests.

### smoke.test.ts (1 test)
Basic sanity check

## Test Results

**Total: 94 tests passing (100%)**

| Test File | Tests | Status |
|-----------|-------|--------|
| gamma.test.ts | 52 | ✓ |
| data.test.ts | 15 | ✓ |
| clob.test.ts | 26 | ✓ |
| smoke.test.ts | 1 | ✓ |

## Running Tests

```bash
# Run all integration tests
pnpm test:integration

# Run gamma tests only
pnpm test:integration gamma

# Watch mode
pnpm test:integration --watch
```

## Rate Limits

### Gamma API (per 10 seconds)
- **General**: 4000 requests
- **Comments**: 200 requests
- **Events**: 500 requests
- **Markets**: 300 requests
- **Markets/Events listing**: 900 requests
- **Tags**: 200 requests
- **Search**: 350 requests

### Data API (per 10 seconds)
- **General**: 1000 requests
- **Trades**: 200 requests
- **Positions**: 150 requests
- **Closed Positions**: 150 requests

Our test suite makes ~78 requests total and completes in ~7-11 seconds, well within all rate limits. If running tests repeatedly, allow a few seconds between runs to avoid throttling.

## Test Coverage

The integration tests cover:

### Gamma API Endpoints
- ✓ Events (list, by ID, by slug, tags, active, closed, featured, paginated)
- ✓ Markets (list, by ID, by slug, tags, active, closed)
- ✓ Tags (list, by ID, by slug, related tags)
- ✓ Series (list, by ID)
- ✓ Comments (list, by entity, by user)
- ✓ Search (events, tags, profiles)
- ✓ Sports (teams, metadata, market types)
- ✓ Public profiles

### Data API Endpoints
- ✓ Health check
- ✓ User data (positions, closed positions, traded markets, value)
- ✓ Trading data (trades, activity)
- ✓ Market data (open interest, live volume, holders)
- ✓ Leaderboards (trader, builder, volume time-series)

### Features
- ✓ Pagination (limit, offset)
- ✓ Filtering (active, closed, featured, tag filters, type filters)
- ✓ Sorting (order, ascending, sortBy, sortDirection)
- ✓ Tag relationships
- ✓ Schema validation (Zod)
- ✓ Error handling (404, validation errors, invalid addresses)
- ✓ Query parameter edge cases
- ✓ Array/boolean/undefined parameter handling
- ✓ JSON string parsing (outcomes, outcomePrices, clobTokenIds)
- ✓ Negative risk fields (enableNegRisk, negRiskAugmented)

## Schema Fixes Applied

### 1. SearchSchema - Optional AND Nullable Fields
**Issue:** API omits `tags` and `profiles` fields when empty instead of returning null

**Fix:** Made fields both optional AND nullable:
```typescript
events: z.array(EventSchema).optional().nullable()
tags: z.array(SearchTagSchema).optional().nullable()
profiles: z.array(ProfileSchema).optional().nullable()
```

**File:** `apps/server/src/lib/polymarket/schemas/gamma.ts`

### 2. TeamSchema - Optional Alias Field
**Issue:** API response doesn't include `alias` field for all teams

**Fix:** Made `alias` field optional:
```typescript
alias: z.string().nullable().optional()
```

**File:** `apps/server/src/lib/polymarket/schemas/gamma.ts`

## Known API Behavior vs OpenAPI Spec

The tests expose some discrepancies between the OpenAPI specification and actual API behavior:

1. **Comments endpoint** - Requires `parent_entity_type` and `parent_entity_id` parameters despite spec marking them optional
2. **Comments parent_entity_type enum** - Spec includes "market" but only "Event" and "Series" work
3. **Search endpoint** - Omits `tags`/`profiles` fields when empty instead of returning null (fixed in schema)
4. **Teams endpoint** - `alias` field is not always present (fixed in schema)

## Next Steps

- Monitor API changes and update schemas as needed
- Add more edge case tests as new scenarios are discovered
- Consider adding performance/load tests for high-traffic endpoints
