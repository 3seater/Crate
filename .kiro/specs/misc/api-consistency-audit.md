# API Consistency Audit

**Status:** 🔴 Not Started  
**Created:** 2026-02-09  
**Priority:** High

## Objective

Audit all API routes, tRPC endpoints, types, schemas, and frontend hooks to ensure complete consistency and alignment across the stack. Verify that every endpoint has proper type definitions, schema validation, and corresponding frontend hooks.

## Scope

### Backend Layer
- **Polymarket API Clients** (`apps/server/src/lib/polymarket/`)
  - `gamma.ts` - Gamma API endpoints
  - `data.ts` - Data API endpoints
  - `clob-read.ts` - CLOB read operations
  - `bridge.ts` - Bridge API
  
- **Zod Schemas** (`apps/server/src/lib/polymarket/schemas/`)
  - `gamma.ts` - Gamma response schemas
  - `data.ts` - Data response schemas
  - `clob.ts` - CLOB schemas
  
- **tRPC Routers** (`apps/server/src/routers/`)
  - `events.ts` - Event endpoints
  - `markets.ts` - Market endpoints
  - `data.ts` - Data endpoints (positions, trades, activity, leaderboards)
  - `clob.ts` - CLOB endpoints
  - `auth.ts` - Authentication endpoints

### Type Layer
- **Shared Types** (`packages/types/src/`)
  - `gamma/` - Gamma API types
  - `data/` - Data API types
  - `clob.ts` - CLOB types
  - `trade.ts` - Trade types
  - `websocket.ts` - WebSocket types

### Frontend Layer
- **Hooks** (`apps/web/src/hooks/`)
  - `use-orderbook.ts`
  - `use-notifications.ts`
  - `use-deploy-safe.ts`
  
- **Stores** (`apps/web/src/stores/`)
  - `orders.ts`
  - `positions.ts`
  - `notifications.ts`
  - `user-store.ts`
  
- **WebSocket Channels** (`apps/web/src/lib/websocket/`)
  - `market-channel.ts`
  - `user-channel.ts`
  - `sports-channel.ts`

## Audit Checklist

### For Each Endpoint

#### 1. Gamma API Endpoints

**Events**
- [ ] `getEvents()` - Check params, response schema, tRPC endpoint, frontend usage
- [ ] `getEventById()` - Verify ID type, include_chat param, response fields
- [ ] `getEventBySlug()` - Check slug validation, response consistency
- [ ] `getEventTags()` - Verify tag array structure

**Markets**
- [ ] `getMarkets()` - Check filter params, pagination, response schema
- [ ] `getMarketById()` - Verify include_tag param, response fields
- [ ] `getMarketBySlug()` - Check slug validation, response consistency
- [ ] `getMarketTags()` - Verify tag array structure

**Tags**
- [ ] `getTags()` - Check filter params, response schema
- [ ] `getTagById()` - Verify include_template param
- [ ] `getTagBySlug()` - Check slug validation
- [ ] `getRelatedTagsById()` - Verify related tags structure

**Series**
- [ ] `getSeries()` - Check filter params, response schema
- [ ] `getSeriesById()` - Verify include_chat param

**Comments**
- [ ] `getComments()` - Check parent_entity_type, get_positions param
- [ ] `getCommentsById()` - Verify comment thread structure
- [ ] `getCommentsByUserAddress()` - Check user address validation

**Search & Other**
- [ ] `publicSearch()` - Verify multi-type search, limit_per_type
- [ ] `searchMarkets()` - Check backward compatibility
- [ ] `getPublicProfile()` - Verify profile fields match schema
- [ ] `getTeams()` - Check league filter
- [ ] `getSportsMetadata()` - Verify sports data structure

#### 2. Data API Endpoints

**Positions**
- [ ] `getPositions()` - Check all 11 params, response schema, frontend usage
- [ ] `getClosedPositions()` - Verify 8 params, realizedPnl field
- [ ] `getValue()` - Check user + market[] params, UserValue[] response
- [ ] `getHolders()` - Verify MetaHolder structure, grouped by token

**Trades**
- [ ] `getTrades()` - Check all 9 params, limit 10000, response schema
- [ ] `getActivity()` - Verify 11 params, type[] enum, timestamp fields

**Analytics**
- [ ] `getTraded()` - Check address param, traded count response
- [ ] `getOpenInterest()` - Verify market[] array, OpenInterestItem[] response
- [ ] `getLiveVolume()` - Check eventId param, total + markets[] structure

**Leaderboards**
- [ ] `getLeaderboard()` - Verify 7 params, category/timePeriod enums
- [ ] `getBuilderLeaderboard()` - Check timePeriod param, rank as string
- [ ] `getBuilderVolume()` - Verify time-series structure, dt field

**Other**
- [ ] `getDataApiHealth()` - Check health endpoint response
- [ ] `getAccountingSnapshot()` - Verify ZIP download handling

#### 3. CLOB Endpoints

- [ ] `getOrderbook()` - Check tokenId param, bids/asks structure
- [ ] `getOrders()` - Verify market param, order array response
- [ ] Order signing - Check EIP-712 signature structure
- [ ] Order placement - Verify order builder params

#### 4. tRPC Router Consistency

For each tRPC endpoint:
- [ ] Input validation matches API client params
- [ ] Response type matches schema
- [ ] Error handling is consistent
- [ ] Frontend can call endpoint via `trpc.*.*.useQuery()`

#### 5. Type Consistency

For each type definition:
- [ ] Matches Zod schema exactly
- [ ] Used consistently across backend/frontend
- [ ] No duplicate or conflicting definitions
- [ ] Proper exports from index files

#### 6. Frontend Hook Consistency

For each hook:
- [ ] Uses correct tRPC endpoint
- [ ] Handles loading/error states
- [ ] Returns properly typed data
- [ ] Has corresponding test coverage

## Audit Process

### Step 1: Map All Endpoints

Create a comprehensive map of:
1. API client function → Zod schema → tRPC endpoint → Frontend hook
2. Identify missing links in the chain
3. Document parameter mismatches
4. Note response field inconsistencies

### Step 2: Verify Field Alignment

For each endpoint:
1. Compare API client params with OpenAPI spec
2. Verify Zod schema matches actual API response
3. Check tRPC input validation matches API params
4. Ensure frontend types match backend types

### Step 3: Test Data Flow

1. Make actual API calls and capture responses
2. Validate responses against Zod schemas
3. Test tRPC endpoints with various inputs
4. Verify frontend hooks receive correct data

### Step 4: Document Findings

Create detailed report with:
- Missing endpoints
- Parameter mismatches
- Type inconsistencies
- Schema validation failures
- Unused types/schemas
- Deprecated endpoints

## Known Issues

### From Previous Audits

1. **Builder Leaderboard** - Fixed: rank field was number, now string
2. **Event Filters** - Fixed: Added closed, featured, volume_min, liquidity_min params
3. **Holders Endpoint** - Fixed: Now accepts market[] array, returns MetaHolder[]
4. **Value Endpoint** - Fixed: Now accepts optional market[] filter

### Potential Issues to Check

1. **Pagination Consistency** - Do all paginated endpoints use same limit/offset pattern?
2. **Sort Parameters** - Are sortBy/sortDirection consistent across endpoints?
3. **Filter Arrays** - Do market[], eventId[], type[] arrays work consistently?
4. **Optional Parameters** - Are optional params properly typed with `?` or `.optional()`?
5. **Enum Values** - Do string enums match API exactly (case-sensitive)?
6. **Timestamp Fields** - Are timestamps consistently number (Unix) or string (ISO)?
7. **Address Validation** - Are Ethereum addresses validated consistently?
8. **Error Responses** - Do all endpoints handle errors the same way?

## Success Criteria

- [ ] All API endpoints have corresponding Zod schemas
- [ ] All Zod schemas have corresponding TypeScript types
- [ ] All API clients have tRPC endpoints
- [ ] All tRPC endpoints have frontend hooks (where needed)
- [ ] No parameter mismatches between layers
- [ ] No field name inconsistencies
- [ ] All responses validate against schemas
- [ ] All types are properly exported and imported
- [ ] No duplicate type definitions
- [ ] All tests pass with real API data

## Deliverables

1. **Endpoint Mapping Document** - Complete map of all endpoints across layers
2. **Inconsistency Report** - Detailed list of mismatches and issues
3. **Fix Implementation** - PRs to resolve all inconsistencies
4. **Test Suite** - Integration tests for critical paths
5. **Documentation Update** - Updated AGENTS.md files with findings

## Timeline

- **Phase 1:** Endpoint mapping (2-3 hours)
- **Phase 2:** Field verification (3-4 hours)
- **Phase 3:** Data flow testing (2-3 hours)
- **Phase 4:** Fix implementation (4-6 hours)
- **Phase 5:** Documentation (1-2 hours)

**Total Estimated Time:** 12-18 hours

## Related Specs

- [Endpoint Type Schema Audit](./endpoint-type-schema-audit/) - Previous audit that fixed many issues
- [Magic Safe Implementation](./magic-safe-implementation.md) - Authentication flow
- [Codebase Issues Audit](./codebase-issues-audit.md) - General codebase issues

## Notes

- Focus on data consistency first, then performance optimization
- Use property-based testing where possible
- Document any API quirks or undocumented behavior
- Consider creating automated consistency checks in CI
