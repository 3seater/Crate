# API Endpoint Mapping

**Generated:** 2026-02-09  
**Status:** 🟡 In Progress

## Gamma API Endpoints

### Events

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `getEvents()` | `EventSchema` | `events.list` | ✅ Used in pages | ✅ Complete |
| `getEventById()` | `EventSchema` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getEventBySlug()` | `EventSchema` | `events.getBySlug` | ✅ Used in pages | ✅ Complete |
| `getEventTags()` | `TagSchema[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |

### Markets

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `getMarkets()` | `MarketSchema` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getMarketById()` | `MarketSchema` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getMarketBySlug()` | `MarketSchema` | `markets.getBySlug` | ✅ Used in pages | ✅ Complete |
| `getMarketTags()` | `TagSchema[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |

### Tags

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `getTags()` | `TagSchema[]` | `events.tags` | ✅ Used in filters | ✅ Complete |
| `getTagById()` | `TagSchema` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getTagBySlug()` | `TagSchema` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getRelatedTagsById()` | `number[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getRelatedTagsBySlug()` | `number[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getTagsRelatedToTagById()` | `TagSchema[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getTagsRelatedToTagBySlug()` | `TagSchema[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |

### Series

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `getSeries()` | `SeriesSchema[]` | `events.series` | ✅ Used in pages | ✅ Complete |
| `getSeriesById()` | `SeriesSchema` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |

### Comments

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `getComments()` | `CommentSchema[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getCommentsById()` | `CommentSchema[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getCommentsByUserAddress()` | `CommentSchema[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |

### Search & Other

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `publicSearch()` | `SearchSchema` | `events.search` | ✅ Used in search | ✅ Complete |
| `searchMarkets()` | `SearchResult` | ❌ Deprecated | ❌ Use publicSearch | ⚠️ Deprecated |
| `getPublicProfile()` | `PublicProfileSchema` | `events.publicProfile` | ✅ Used in profile | ✅ Complete |
| `getSportsMetadata()` | `SportMetadataSchema[]` | `events.sports` | ✅ Used in sports | ✅ Complete |
| `getSportsMarketTypes()` | `SportsMarketTypesSchema` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getTeams()` | `TeamSchema[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getStatus()` | `string` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |

## Data API Endpoints

### Positions

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `getPositions()` | `PositionSchema[]` | `data.positions` | ✅ Used in portfolio | ✅ Complete |
| `getClosedPositions()` | `ClosedPositionSchema[]` | `data.closedPositions` | ✅ Used in portfolio | ✅ Complete |
| `getValue()` | `UserValueSchema[]` | `data.value` | ✅ Used in portfolio | ✅ Complete |

### Trades & Activity

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `getTrades()` | `TradeSchema[]` | `data.trades` | ✅ Used in history | ✅ Complete |
| `getActivity()` | `ActivityItemSchema[]` | `data.activity` | ✅ Used in feed | ✅ Complete |

### Analytics

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `getDataApiHealth()` | `HealthResponseSchema` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getTraded()` | `TradedSchema` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getOpenInterest()` | `OpenInterestItemSchema[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getLiveVolume()` | `LiveVolumeSchema` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getHolders()` | `MetaHolderSchema[]` | `data.holders` | ❌ Not used yet | ⚠️ No frontend usage |

### Leaderboards

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `getLeaderboard()` | `TraderLeaderboardEntrySchema[]` | `data.leaderboard` | ✅ Used in leaderboard | ✅ Complete |
| `getBuilderLeaderboard()` | `BuilderLeaderboardEntrySchema[]` | `data.builderLeaderboard` | ✅ Used in leaderboard | ✅ Complete |
| `getBuilderVolume()` | `BuilderVolumeEntrySchema[]` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |

### Other

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `getAccountingSnapshot()` | `Blob` | `data.snapshot` | ✅ Download util | ✅ Complete |

## CLOB API Endpoints

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `getBook()` | `OrderBookSnapshot` | `clob.getOrderBook` | ✅ use-orderbook | ✅ Complete |
| `getPriceHistory()` | `PriceHistory[]` | `clob.getPricesHistory` | ✅ price-chart | ✅ Complete |
| `getMidpoint()` | `string` | `clob.getMidpoint` | ✅ Used in trading | ✅ Complete |
| `getSpread()` | `string` | `clob.getSpread` | ✅ Used in trading | ✅ Complete |
| `getTickSize()` | `string` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getTraded()` | `{ traded: boolean }` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getHeartbeat()` | `string` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |
| `getFeeRate()` | `FeeRate` | ❌ Missing | ❌ Not exposed | 🔴 Missing tRPC |

**Note:** CLOB router has many additional endpoints (`getMarket`, `getMarkets`, `getSimplifiedMarket`, etc.) that may be duplicates or use different underlying APIs. Need to verify.

## Bridge API Endpoints

| API Client | Schema | tRPC Endpoint | Frontend Hook | Status |
|------------|--------|---------------|---------------|--------|
| `createDepositAddresses()` | `DepositAddress` | `bridge.deposit` | ❌ Not used yet | ⚠️ No frontend usage |
| `createWithdrawalAddresses()` | `WithdrawalAddress` | `bridge.withdraw` | ❌ Not used yet | ⚠️ No frontend usage |
| `getQuote()` | `QuoteSchema` | `bridge.quote` | ❌ Not used yet | ⚠️ No frontend usage |
| `getSupportedAssets()` | `SupportedAssetSchema[]` | `bridge.supportedAssets` | ❌ Not used yet | ⚠️ No frontend usage |
| `getTransactionStatus()` | `TransactionStatus` | `bridge.status` | ❌ Not used yet | ⚠️ No frontend usage |

## Summary Statistics

### Coverage by API

| API | Total Endpoints | With tRPC | With Frontend | Complete |
|-----|----------------|-----------|---------------|----------|
| **Gamma** | 27 | 7 (26%) | 7 (26%) | 7 (26%) |
| **Data** | 14 | 8 (57%) | 7 (50%) | 7 (50%) |
| **CLOB** | 9 | 7 (78%) | 4 (44%) | 4 (44%) |
| **Bridge** | 5 | 5 (100%) | 0 (0%) | 0 (0%) |
| **Total** | 55 | 27 (49%) | 18 (33%) | 18 (33%) |

### Issues Found

#### 🔴 Critical (Missing tRPC Endpoints)

**Gamma API:**
1. `getEventById()` - Need for direct event access
2. `getEventTags()` - Need for event tag filtering
3. `getMarkets()` - Need for market listing
4. `getMarketById()` - Need for direct market access
5. `getMarketTags()` - Need for market tag filtering
6. `getTagById()` - Need for tag details
7. `getSeriesById()` - Need for series details
8. `getComments()` - Need for comment threads
9. `getSportsMarketTypes()` - Need for sports filtering
10. `getTeams()` - Need for team filtering

**Data API:**
11. `getDataApiHealth()` - Need for health checks
12. `getTraded()` - Need for user trading stats
13. `getOpenInterest()` - Need for market analytics
14. `getLiveVolume()` - Need for event analytics
15. `getBuilderVolume()` - Need for builder analytics

**CLOB API:**
16. `getTickSize()` - Need for order validation
17. `getTraded()` - Need for market status
18. `getHeartbeat()` - Need for health checks
19. `getFeeRate()` - Need for fee calculation

#### ⚠️ Warning (No Frontend Usage)

1. `data.holders` - Exposed but not used
2. All Bridge API endpoints - Exposed but not used

#### 🟡 Info (Deprecated)

1. `searchMarkets()` - Use `publicSearch()` instead

## Next Steps

1. **Add Missing tRPC Endpoints** - Priority: High
   - Add 19 missing tRPC endpoints
   - Ensure proper input validation
   - Add error handling

2. **Create Frontend Hooks** - Priority: Medium
   - Create hooks for newly exposed endpoints
   - Add loading/error states
   - Add proper TypeScript types

3. **Verify Field Consistency** - Priority: High
   - Check all parameters match between layers
   - Verify response fields match schemas
   - Test with real API data

4. **Clean Up Unused Code** - Priority: Low
   - Remove deprecated `searchMarkets()` if not used
   - Document Bridge API usage or remove if not needed
   - Consolidate duplicate CLOB endpoints

5. **Add Integration Tests** - Priority: Medium
   - Test critical paths end-to-end
   - Verify schema validation
   - Test error handling
