# Gamma API Type Requirements Summary

## Overview

The Gamma API (`https://gamma-api.polymarket.com`) provides market metadata, event organization, and discovery. This document summarizes the key type requirements based on the OpenAPI specifications.

## Core Data Model

```
Event (collection of markets)
  └─> Market[] (tradeable outcomes)
       └─> Tags, Categories, Series
```

## Key Endpoints

### Status & Discovery
- `GET /status` - Health check
- `GET /sports` - Sports metadata (images, resolution sources, tags, series)
- `GET /sports/market-types` - Valid sports market types
- `GET /teams` - List teams with league, record, logo

### Tags & Categories
- `GET /tags` - List all tags
- `GET /tags/{id}` - Get tag by ID
- `GET /tags/slug/{slug}` - Get tag by slug
- `GET /tags/{id}/related-tags` - Get related tag relationships
- `GET /tags/{id}/related-tags/tags` - Get actual related tags

### Events
- `GET /events` - List events (paginated, filterable)
- `GET /events/{id}` - Get event by ID
- `GET /events/slug/{slug}` - Get event by slug
- `GET /events/{id}/tags` - Get event tags

### Markets
- `GET /markets` - List markets (paginated, filterable)
- `GET /markets/{id}` - Get market by ID
- `GET /markets/slug/{slug}` - Get market by slug

## Critical Type Structures

### Event (100+ fields)
Key fields from OpenAPI:
- `id`, `ticker`, `slug`, `title`, `subtitle`, `description`
- `startDate`, `endDate`, `creationDate`, `closedTime`
- `active`, `closed`, `archived`, `featured`, `restricted`
- `liquidity`, `volume`, `openInterest`
- `volume24hr`, `volume1wk`, `volume1mo`, `volume1yr`
- `negRisk`, `negRiskMarketID`, `negRiskFeeBips`
- `enableNegRisk`, `enableOrderBook`
- `markets[]`, `tags[]`, `series[]`, `categories[]`, `collections[]`
- `live`, `ended`, `score`, `period`, `elapsed` (sports)
- `imageOptimized`, `iconOptimized`, `featuredImageOptimized`

### Market (150+ fields)
Key fields from OpenAPI:
- `id`, `question`, `conditionId`, `slug`
- `outcomes` (JSON string), `outcomePrices` (JSON string)
- `clobTokenIds` (JSON string)
- `active`, `closed`, `archived`, `featured`
- `volume`, `liquidity`, `volumeNum`, `liquidityNum`
- `volume24hr`, `volume1wk`, `volume1mo`, `volume1yr`
- `volumeAmm`, `volumeClob`, `liquidityAmm`, `liquidityClob`
- `startDate`, `endDate`, `endDateIso`, `startDateIso`
- `enableOrderBook`, `acceptingOrders`, `acceptingOrdersTimestamp`
- `orderPriceMinTickSize`, `orderMinSize`
- `makerBaseFee`, `takerBaseFee`
- `questionID`, `umaEndDate`, `umaResolutionStatus`
- `spread`, `bestBid`, `bestAsk`, `lastTradePrice`
- `oneDayPriceChange`, `oneHourPriceChange`, `oneWeekPriceChange`
- `gameId`, `gameStartTime`, `sportsMarketType`, `line`
- `negRiskOther`, `automaticallyResolved`, `automaticallyActive`
- `events[]`, `tags[]`, `categories[]`

### Tag
- `id`, `label`, `slug`
- `forceShow`, `forceHide`, `isCarousel`
- `publishedAt`, `createdAt`, `updatedAt`

### Series
- `id`, `ticker`, `slug`, `title`, `subtitle`
- `seriesType`, `recurrence`, `description`
- `active`, `closed`, `archived`, `featured`
- `volume`, `liquidity`, `volume24hr`
- `events[]`, `tags[]`, `categories[]`, `collections[]`

### Category
- `id`, `label`, `slug`, `parentCategory`

### Team
- `id`, `name`, `league`, `record`, `logo`, `abbreviation`, `alias`

### SportsMetadata
- `sport`, `image`, `resolution`, `ordering`, `tags`, `series`

### ImageOptimization
- `imageUrlSource`, `imageUrlOptimized`
- `imageSizeKbSource`, `imageSizeKbOptimized`
- `imageOptimizedComplete`

## Query Parameters

### Common Pagination
- `limit` (integer, min: 0)
- `offset` (integer, min: 0)
- `order` (string, comma-separated fields)
- `ascending` (boolean)

### Event Filters
- `id[]`, `slug[]`, `tag_id`, `tag_slug`, `exclude_tag_id[]`
- `active`, `closed`, `archived`, `featured`, `cyom`
- `liquidity_min`, `liquidity_max`
- `volume_min`, `volume_max`
- `start_date_min`, `start_date_max`
- `end_date_min`, `end_date_max`
- `related_tags`, `include_chat`, `include_template`
- `recurrence`

### Market Filters
Similar to events plus:
- `sportsMarketTypes[]`
- Market-specific filters

## Key Type Requirements

### Requirement 37: Type Gamma API Structures

1. **Event interface** - All 100+ fields with proper nullability
2. **Market interface** - All 150+ fields with proper nullability
3. **JSON string fields** - `outcomes`, `outcomePrices`, `clobTokenIds` should be typed as strings that parse to arrays
4. **Nested arrays** - `markets[]`, `tags[]`, `series[]`, `categories[]`, `collections[]`
5. **Image optimization** - Separate interface for optimized image metadata
6. **Sports fields** - `live`, `ended`, `score`, `period`, `elapsed`, `gameId`, `sportsMarketType`, `line`
7. **Negative risk fields** - `negRisk`, `negRiskMarketID`, `negRiskFeeBips`, `enableNegRisk`, `negRiskOther`
8. **Volume breakdown** - Separate AMM vs CLOB volume/liquidity fields
9. **Timestamp fields** - ISO 8601 strings with proper date-time format
10. **Query parameter types** - Interfaces for all filter combinations

### Requirement 38: Normalize Gamma API Field Names

1. **Snake_case to camelCase** - Transform all snake_case fields from API to camelCase in types
2. **Consistent naming** - `end_date_iso` → `endDateIso`, `clob_token_ids` → `clobTokenIds`
3. **Array fields** - Handle JSON string arrays: `outcomes`, `outcomePrices`, `clobTokenIds`
4. **Nested objects** - Proper typing for `imageOptimized`, `iconOptimized`, `featuredImageOptimized`

### Requirement 39: Type Gamma API Query Parameters

1. **Pagination params** - `limit`, `offset`, `order`, `ascending`
2. **Event filters** - All filter combinations properly typed
3. **Market filters** - All filter combinations properly typed
4. **Tag filters** - `include_template`, `is_carousel`, `omit_empty`, `status`
5. **Array parameters** - Proper typing for `id[]`, `slug[]`, `exclude_tag_id[]`

## Implementation Notes

1. **All fields nullable** - OpenAPI marks most fields as `nullable: true`
2. **String vs Number** - Some fields like `volume`, `liquidity` are strings in API, numbers in computed fields
3. **Date formats** - Mix of ISO 8601 strings and Unix timestamps
4. **Nested relationships** - Events contain Markets, Markets reference Events (circular)
5. **Pagination** - All list endpoints support `limit`/`offset`
6. **Slug-based access** - Most entities accessible by ID or slug
7. **Tag relationships** - Complex related tag system with rankings
8. **Sports-specific** - Many sports-only fields on events/markets
