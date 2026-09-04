# 17 — API Schema Audit

> **Phase:** 0–2 · **Risk:** Low · **Status:** 🔴 Not started
>
> Gaps between Polymarket API schemas and our typed Zod schemas / tRPC procedures.
> Source: V2.md §5 (Domain Model), §7 (Router Contract), and Appendix (API Schema Audit).

---

## Table of Contents

- [Gamma Market Schema Fields](#gamma-market-schema-fields)
- [Gamma Event Schema Sports Fields](#gamma-event-schema-sports-fields)
- [Keyset Pagination Filter Parameters](#keyset-pagination-filter-parameters)
- [New Rewards Router Procedures](#new-rewards-router-procedures)
- [CLOB API Fields Not Yet Surfaced](#clob-api-fields-not-yet-surfaced)
- [Deferred Items](#deferred-items)
- [Implementation Priority](#implementation-priority)

---

## Gamma Market Schema Fields

Fields from the Gamma API market response that need to be typed in our Zod schemas and consumed in the UI. Currently either missing from our schemas or present but unused.

### Fields to Add

| Field | Type | UI Use | Priority |
|-------|------|--------|----------|
| `feeSchedule` | `{ exponent: number, rate: number, takerOnly: boolean, rebateRate: number }` | Fee curve display in order form, order cost estimation | High |
| `competitive` | `number` | Market competitiveness score — rewards eligibility indicator | Medium |
| `rewardsMinSize` | `number` | Minimum order size for rewards eligibility — display in order form | Medium |
| `rewardsMaxSpread` | `number` | Maximum spread for rewards eligibility — display in order form | Medium |
| `spread` | `number` | Current bid-ask spread — orderbook header, market cards | High |
| `oneDayPriceChange` | `number` | Price change badges on explore cards, market header | High |
| `oneHourPriceChange` | `number` | Price change badges (short timeframe) | Medium |
| `oneWeekPriceChange` | `number` | Price change badges, sparkline direction | Medium |
| `oneMonthPriceChange` | `number` | Price change badges (long timeframe) | Low |
| `oneYearPriceChange` | `number` | Price change badges (long timeframe) | Low |
| `lastTradePrice` | `number` | Pre-hydrated price before WS connects — market cards, header | High |
| `bestBid` | `number` | Pre-hydrated bid before WS — order form default price | High |
| `bestAsk` | `number` | Pre-hydrated ask before WS — order form default price | High |
| `rfqEnabled` | `boolean` | Feature flag per market — RFQ UI toggle | Low |
| `feesEnabled` | `boolean` | Feature flag per market — fee display gating | Medium |
| `pendingDeployment` | `boolean` | Disable trading UI when market is deploying | High |
| `deploying` | `boolean` | Disable trading UI when market is deploying | High |
| `gameStatus` | `string` | Sports: current game state (e.g. "in_progress", "final") | Medium |
| `acceptingOrders` | `boolean` | Whether CLOB accepts new orders — trading guard | High |

### Zod Schema Updates

**Primary schema file:** `apps/server/src/features/markets/schemas/gamma.ts`

Add a `feeScheduleSchema` and extend the market schema:

```ts
const feeScheduleSchema = z.object({
  exponent: z.number(),
  rate: z.number(),
  takerOnly: z.boolean(),
  rebateRate: z.number(),
}).nullable();

// Add to existing market schema
const gammaMarketSchema = z.object({
  // ... existing fields ...
  feeSchedule: feeScheduleSchema.optional(),
  competitive: z.number().optional(),
  rewardsMinSize: z.number().optional(),
  rewardsMaxSpread: z.number().optional(),
  spread: z.number().optional(),
  oneDayPriceChange: z.number().optional(),
  oneHourPriceChange: z.number().optional(),
  oneWeekPriceChange: z.number().optional(),
  oneMonthPriceChange: z.number().optional(),
  oneYearPriceChange: z.number().optional(),
  lastTradePrice: z.number().optional(),
  bestBid: z.number().optional(),
  bestAsk: z.number().optional(),
  rfqEnabled: z.boolean().optional(),
  feesEnabled: z.boolean().optional(),
  pendingDeployment: z.boolean().optional(),
  deploying: z.boolean().optional(),
  gameStatus: z.string().optional(),
  acceptingOrders: z.boolean().optional(),
});
```

### UI Consumers

| Field(s) | Component | File |
|----------|-----------|------|
| `lastTradePrice`, `bestBid`, `bestAsk` | Market header, order form price defaults | `trading/components/market-header/`, `trading/components/order-form/` |
| `oneDayPriceChange`, `oneWeekPriceChange` | Event card badges, explore table | `explore/components/event-card.tsx`, `explore/components/events-table.tsx` |
| `spread` | Orderbook spread bar | `trading/components/orderbook/` |
| `feeSchedule` | Order form cost estimation | `trading/components/order-form/order-form-hooks.ts` |
| `rewardsMinSize`, `rewardsMaxSpread`, `competitive` | Liquidity rewards badge | `trading/components/market-header/liquidity-rewards-badge.tsx` |
| `pendingDeployment`, `deploying`, `acceptingOrders` | Trading guard (disable order form) | `trading/lib/trading-guard.ts` |
| `gameStatus` | Sports market header | `trading/components/sports/` |

---

## Gamma Event Schema Sports Fields

Fields on the Gamma event response for live sports state. These drive the sports UI and are currently untyped.

### Fields to Add

| Field | Type | UI Use |
|-------|------|--------|
| `negRiskFeeBips` | `integer` | NegRisk fee in basis points — fee display for neg-risk events |
| `gameStatus` | `string` | Current game state (e.g. "in_progress", "final", "scheduled") |
| `score` | `string` | Live score (e.g. "3-1") |
| `elapsed` | `string` | Time elapsed in current period |
| `period` | `string` | Current period (e.g. "Q3", "2nd Half") |
| `live` | `boolean` | Is the game currently live |
| `ended` | `boolean` | Has the game ended |
| `finishedTimestamp` | `datetime` | When the game finished |
| `gmpChartMode` | `string` | Chart display mode for GMP events (e.g. "line", "candle") |
| `spreadsMainLine` | `number` | Sports betting spread line |
| `totalsMainLine` | `number` | Sports betting totals line |
| `eventCreators` | `EventCreator[]` | Who created the event (for CYOM — Create Your Own Market) |
| `chats` | `array` | Optional: chat threads (include via query flag) |
| `templates` | `array` | Optional: market templates (include via query flag) |
| `bestLines` | `array` | Optional: best betting lines (include via `include_best_lines` flag) |

### Zod Schema Updates

**Primary schema file:** `apps/server/src/features/events/` or `apps/server/src/features/markets/schemas/gamma.ts`

```ts
const eventCreatorSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  slug: z.string().optional(),
});

const gammaEventSchema = z.object({
  // ... existing fields ...
  negRiskFeeBips: z.number().optional(),
  gameStatus: z.string().optional(),
  score: z.string().optional(),
  elapsed: z.string().optional(),
  period: z.string().optional(),
  live: z.boolean().optional(),
  ended: z.boolean().optional(),
  finishedTimestamp: z.string().datetime().optional(),
  gmpChartMode: z.string().optional(),
  spreadsMainLine: z.number().optional(),
  totalsMainLine: z.number().optional(),
  eventCreators: z.array(eventCreatorSchema).optional(),
  chats: z.array(z.unknown()).optional(),
  templates: z.array(z.unknown()).optional(),
  bestLines: z.array(z.unknown()).optional(),
});
```

### UI Consumers

| Field(s) | Component | File |
|----------|-----------|------|
| `gameStatus`, `score`, `elapsed`, `period`, `live`, `ended` | Sports live indicator, sports selector card | `trading/components/sports/`, `trading/components/market-selector/sports-selector-card.tsx` |
| `spreadsMainLine`, `totalsMainLine` | Sports betting lines display | `trading/components/sports/` |
| `gmpChartMode` | Chart mode selector for GMP events | `trading/components/chart/` |
| `eventCreators` | CYOM attribution badge | `explore/components/event-card.tsx` |
| `negRiskFeeBips` | Fee display for neg-risk events | `trading/components/order-form/` |

---

## Keyset Pagination Filter Parameters

The Gamma keyset endpoints (`/events/keyset`, `/markets/keyset`) support rich filtering beyond what V1 exposes. These should be typed as Zod input schemas on our `events.list` and `markets.list` procedures.

### Events Keyset Filters

| Parameter | Type | Description | Priority |
|-----------|------|-------------|----------|
| `after_cursor` | `string` | Cursor for next page (already implemented) | — |
| `limit` | `number` | Page size (already implemented) | — |
| `title_search` | `string` | Full-text search across event titles | High |
| `live` | `boolean` | Filter to live (in-progress) events only | High |
| `featured` | `boolean` | Filter to featured/promoted events | Medium |
| `cyom` | `boolean` | Filter to Create Your Own Market events | Low |
| `tag_match` | `string` | Filter by tag name (exact match) | High |
| `tag_slug` | `string` | Filter by tag slug | High |
| `exclude_tag_id` | `string` | Exclude events with this tag | Medium |
| `series_id` | `string` | Filter to events in a recurring series | Medium |
| `game_id` | `string` | Filter to events for a specific sports game | Medium |
| `event_date` | `string` | Filter by event date (ISO date) | Medium |
| `event_week` | `string` | Filter by event week | Low |
| `partner_slug` | `string` | Filter by partner/sponsor | Low |
| `include_best_lines` | `boolean` | Include best betting lines in response | Medium |
| `include_children` | `boolean` | Include child markets in response | High |
| `parent_event_id` | `string` | Filter to child events of a parent | Low |
| `created_by` | `string` | Filter by creator address | Low |
| `locale` | `string` | Filter by locale | Low |
| `recurrence` | `string` | Filter by recurrence pattern | Low |

### Markets Keyset Filters

| Parameter | Type | Description | Priority |
|-----------|------|-------------|----------|
| `after_cursor` | `string` | Cursor for next page (already implemented) | — |
| `limit` | `number` | Page size (already implemented) | — |
| `tag_match` | `string` | Filter by tag name | High |
| `rfq_enabled` | `boolean` | Filter to RFQ-enabled markets | Low |
| `decimalized` | `boolean` | Filter to decimalized markets | Low |
| `locale` | `string` | Filter by locale | Low |
| `condition_ids` | `string[]` | Filter by specific condition IDs | Medium |
| `question_ids` | `string[]` | Filter by specific question IDs | Low |
| `clob_token_ids` | `string[]` | Filter by specific CLOB token IDs | Medium |
| `sports_market_types` | `string[]` | Filter by sports market type (spread, total, moneyline) | Medium |
| `game_id` | `string` | Filter to markets for a specific sports game | Medium |

### Implementation Plan

1. **Define Zod input schemas** for both endpoints in `apps/server/src/features/markets/schemas/gamma.ts`:

```ts
const eventsKeysetInputSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  after_cursor: z.string().optional(),
  title_search: z.string().optional(),
  live: z.boolean().optional(),
  featured: z.boolean().optional(),
  tag_match: z.string().optional(),
  tag_slug: z.string().optional(),
  include_children: z.boolean().optional(),
  include_best_lines: z.boolean().optional(),
  series_id: z.string().optional(),
  game_id: z.string().optional(),
  event_date: z.string().optional(),
  // ... remaining filters
});
```

2. **Update `events.list` and `markets.list` procedures** to accept and forward these filters to the Gamma API
3. **Update explore UI** to use the new filter params via `nuqs` URL state (see doc 09)

---

## New Rewards Router Procedures

V2 introduces a dedicated `rewards` router (V2.md §7). Currently, rewards data is scattered across `clob.getLiquidityRewards` and `data.lpRewardsTotal`. The new router consolidates all rewards and maker rebate functionality.

### Procedure Inventory

#### `rewards.activeConfigs` — Public

**Source:** Polymarket Rewards API `GET /active-configs`

**Returns:** All active reward configs grouped by market. Each config includes:
- `sponsored_daily_rate`, `sponsors_count`, `native_daily_rate`, `total_daily_rate`
- Market condition ID, token IDs
- Config start/end dates

**Implementation:**
```ts
activeConfigs: publicProcedure.query(async () => {
  return fetchRewardsApi("/active-configs");
}),
```

**UI:** Explore page rewards filter, liquidity rewards badge on market cards.

#### `rewards.marketsWithRewards` — Public

**Source:** Polymarket Rewards API `GET /markets-with-rewards`

**Returns:** Markets list with reward configs attached. Supports text search, tag filter, numeric filter, sorting.

**Implementation:**
```ts
marketsWithRewards: publicProcedure
  .input(z.object({
    search: z.string().optional(),
    tag: z.string().optional(),
    sortBy: z.enum(["total_daily_rate", "native_daily_rate", "sponsored_daily_rate"]).optional(),
    limit: z.number().min(1).max(100).default(20),
    after_cursor: z.string().optional(),
  }))
  .query(async ({ input }) => {
    return fetchRewardsApi("/markets-with-rewards", input);
  }),
```

**UI:** Dedicated rewards discovery page or explore filter.

#### `rewards.rawForMarket` — Public

**Source:** Polymarket Rewards API `GET /raw-for-market/{conditionId}`

**Returns:** Present + future rewards configured on a specific market.

**Implementation:**
```ts
rawForMarket: publicProcedure
  .input(z.object({ conditionId: z.string() }))
  .query(async ({ input }) => {
    return fetchRewardsApi(`/raw-for-market/${input.conditionId}`);
  }),
```

**UI:** Market page rewards detail panel, liquidity rewards badge tooltip.

#### `rewards.earningsByDate` — Protected

**Source:** Polymarket Rewards API `GET /earnings-by-date`

**Returns:** User earnings per market for a given day.

**Implementation:**
```ts
earningsByDate: protectedProcedure
  .input(z.object({ date: z.string().date() }))
  .query(async ({ ctx, input }) => {
    return fetchRewardsApi(`/earnings-by-date`, {
      address: ctx.session.safeAddress,
      date: input.date,
    });
  }),
```

**UI:** Portfolio rewards tab, PnL calendar rewards overlay.

#### `rewards.totalEarnings` — Protected

**Source:** Polymarket Rewards API `GET /total-earnings`

**Returns:** Summed total reward earnings for a user on a given day.

**Implementation:**
```ts
totalEarnings: protectedProcedure
  .input(z.object({ date: z.string().date() }))
  .query(async ({ ctx, input }) => {
    return fetchRewardsApi(`/total-earnings`, {
      address: ctx.session.safeAddress,
      date: input.date,
    });
  }),
```

**UI:** Portfolio rewards summary card.

#### `rewards.percentages` — Protected

**Source:** Polymarket Rewards API `GET /percentages`

**Returns:** Real-time percentage of rewards user is earning per market.

**Implementation:**
```ts
percentages: protectedProcedure.query(async ({ ctx }) => {
  return fetchRewardsApi(`/percentages`, {
    address: ctx.session.safeAddress,
  });
}),
```

**UI:** Open orders table rewards column, market page rewards indicator.

#### `rewards.userEarnings` — Protected

**Source:** Combined: earnings + live percentages per market.

**Returns:** Merged view of historical earnings and current earning rate.

**Implementation:**
```ts
userEarnings: protectedProcedure
  .input(z.object({ date: z.string().date().optional() }))
  .query(async ({ ctx, input }) => {
    const [earnings, pcts] = await Promise.all([
      fetchRewardsApi("/earnings-by-date", {
        address: ctx.session.safeAddress,
        date: input.date ?? new Date().toISOString().split("T")[0],
      }),
      fetchRewardsApi("/percentages", {
        address: ctx.session.safeAddress,
      }),
    ]);
    return mergeEarningsWithPercentages(earnings, pcts);
  }),
```

**UI:** Unified rewards dashboard widget.

#### `rewards.makerRebates` — Protected

**Source:** Polymarket Rewards API `GET /maker-rebates`

**Returns:** Current rebated fees for the authenticated maker address.

**Implementation:**
```ts
makerRebates: protectedProcedure.query(async ({ ctx }) => {
  return fetchRewardsApi(`/maker-rebates`, {
    address: ctx.session.safeAddress,
  });
}),
```

**UI:** Portfolio fee summary, order form fee estimation.

### New Files

| File | Purpose |
|------|---------|
| `apps/server/src/features/rewards/router.ts` | Router with all 8 procedures |
| `apps/server/src/features/rewards/lib/rewards-api.ts` | Polymarket Rewards API client (`fetchRewardsApi`) |
| `apps/server/src/features/rewards/schemas/rewards.ts` | Zod schemas for rewards responses |

### Wiring

Add to `apps/server/src/routers/index.ts`:

```ts
import { rewardsRouter } from "../features/rewards/router";
// ...
rewards: rewardsRouter,
```

---

## CLOB API Fields Not Yet Surfaced

Fields from the CLOB API that are documented in V2.md §7 but not yet typed or consumed in our codebase.

### `clobInfo` Response Shape

The `markets.clobInfo` procedure wraps the CLOB's `/clob-markets/{condition_id}` endpoint. The response uses abbreviated field names that need a Zod schema and human-readable mapping.

```ts
// apps/server/src/features/markets/schemas/clob.ts (new file)

const clobTokenSchema = z.object({
  t: z.string(),                    // tokenId
  o: z.enum(["Yes", "No"]),         // outcome
});

const feeDetailsSchema = z.object({
  r: z.number().nullable(),         // fee rate
  e: z.number().nullable(),         // fee curve exponent
  to: z.boolean().nullable(),       // taker-only fees
}).nullable();

const clobMarketDetailsSchema = z.object({
  t: z.array(clobTokenSchema),      // tokens
  mts: z.number(),                  // minimum tick size (e.g. 0.01)
  mos: z.number(),                  // minimum order size (e.g. 5)
  mbf: z.number(),                  // maker base fee (bps)
  tbf: z.number(),                  // taker base fee (bps)
  rfqe: z.boolean(),                // RFQ enabled
  itode: z.boolean(),               // taker order delay enabled
  ibce: z.boolean(),                // Blockaid check enabled
  oas: z.number(),                  // min order age (seconds) before scoring
  gst: z.string().nullable(),       // game start time (ISO 8601, sports only)
  fd: feeDetailsSchema,             // fee details (fee curve params)
  r: z.unknown(),                   // rewards config (dynamic shape)
});
```

**UI use:** The `matchingEngineActive` boolean (not in the abbreviated response but available via a separate endpoint or derived) gates order form submission. When `false`, show maintenance notice.

**Mapping helper** (for human-readable access):

```ts
function mapClobInfo(raw: ClobMarketDetails) {
  return {
    tokens: raw.t.map((t) => ({ tokenId: t.t, outcome: t.o })),
    minTickSize: raw.mts,
    minOrderSize: raw.mos,
    makerBaseFee: raw.mbf,
    takerBaseFee: raw.tbf,
    rfqEnabled: raw.rfqe,
    takerOrderDelayEnabled: raw.itode,
    blockaidCheckEnabled: raw.ibce,
    minOrderAgeForScoring: raw.oas,
    gameStartTime: raw.gst,
    feeDetails: raw.fd ? { rate: raw.fd.r, exponent: raw.fd.e, takerOnly: raw.fd.to } : null,
    rewards: raw.r,
  };
}
```

### Order Response Statuses

`orders.place` returns a `SendOrderResponse` with one of three statuses:

| Status | Meaning | UI Handling |
|--------|---------|-------------|
| `live` | Order placed on the book, waiting for match | Show in open orders table |
| `matched` | Order immediately filled | Trigger post-trade invalidation, show success toast |
| `delayed` | Order deferred (`deferExec: true` or system-initiated) | Show pending state with polling |

**Zod schema:**

```ts
const sendOrderResponseSchema = z.object({
  orderID: z.string(),
  status: z.enum(["live", "matched", "delayed"]),
  transactionsHashes: z.array(z.string()).optional(),
  tradeIDs: z.array(z.string()).optional(),
});
```

**Current gap:** The order form likely treats all responses as success. Need to branch on `status` for correct UI feedback.

### Trade Schema Fields

Fields on the CLOB trade response not surfaced in V1:

| Field | Type | UI Use |
|-------|------|--------|
| `fee_rate_bps` | `number` | Fee rate in basis points for this trade — trades tab, fee analytics |
| `trader_side` | `"TAKER" \| "MAKER"` | Which side the user was on — trades tab indicator |
| `maker_orders` | `Array<{ order_id, matched_amount, price, fee_rate_bps }>` | Maker orders matched against — trade detail view |
| `match_time_nano` | `number` | Nanosecond-precision match timestamp — ordering trades within same second |

**Zod schema addition** (extend existing trade schema):

```ts
const tradeSchema = z.object({
  // ... existing fields ...
  fee_rate_bps: z.number().optional(),
  trader_side: z.enum(["TAKER", "MAKER"]).optional(),
  maker_orders: z.array(z.object({
    order_id: z.string(),
    matched_amount: z.number(),
    price: z.number(),
    fee_rate_bps: z.number(),
  })).optional(),
  match_time_nano: z.number().optional(),
});
```

### Heartbeat V1 Session Tracking

The `/v1/heartbeats` endpoint uses a `heartbeat_id` chain:
1. First call sends empty `heartbeat_id`
2. Response includes a `heartbeat_id`
3. Subsequent calls must echo the `heartbeat_id` from the previous response
4. Mismatch = 400 error

**Current state:** `use-clob-heartbeat.ts` exists but may not implement the ID chain correctly. Verify and update.

### Matching Engine Maintenance

The CLOB matching engine can enter maintenance. `markets.clobInfo` (or a dedicated endpoint) returns `matchingEngineActive: boolean`.

**When `false`:**
- Order form disables submission
- Show maintenance notice banner
- Open orders and cancellations still work

**Implementation:** Add `matchingEngineActive` check to `trading-guard.ts` alongside `market.acceptingOrders`.

---

## Deferred Items

Items from the V2.md Appendix noted for future consideration. Not blocked, but lower priority than the items above.

### Notifications Inbox

**Endpoint:** `GET /notifications`, `DELETE /notifications`

**6 event types:** Order cancellation, order fill (taker/maker), market registered, market resolved, reward payout, child comment created.

**Why deferred:** The WebSocket user channel already delivers order/trade events in real-time. Notifications for market resolution, reward payouts, and comments are NOT covered by the WS channel. Implement when building the notification bell/inbox feature (`shell/notifications-bell.tsx` already exists as a placeholder).

**When to implement:** After the rewards router and comments feature are stable.

### Neg-Risk Flag Query

**Endpoint:** `GET /neg-risk/{token_id}`

**Why deferred:** Redundant with `clobInfo` which includes neg-risk information. Only useful for a lightweight single-field check. Not worth a dedicated procedure.

### Live Activity Markets

**Endpoint:** `POST /markets/live-activity`

**Why deferred:** Optimized for mobile widgets (iOS Live Activities). Useful if we build a mobile companion app or a dock widget with minimal data payload. Not needed for the web terminal.

### Simplified / Sampling Markets

**Endpoints:** `GET /simplified-markets`, `GET /sampling-markets`, `GET /sampling-simplified-markets`

**Why deferred:** Lightweight market list variants with fewer fields. May be useful for explore page performance if full market objects prove too heavy for initial page load. Evaluate after implementing `"use cache"` on explore — caching may eliminate the need for lighter payloads.

### Builder API Key CRUD

**Endpoints:** `GET /auth/builder-api-key`, `POST /auth/builder-api-key`, `DELETE /auth/builder-api-key`

**Why deferred:** We use server-side builder keys configured via env vars. Only needed if we expose builder key management to end users (unlikely for a consumer trading app).

### Relayer API Keys and Transaction States

**Endpoints:** `GET /relayer/api/keys`, `POST /relayer/api/keys`, `DELETE /relayer/api/keys`

**Transaction states:** `STATE_NEW → STATE_EXECUTED → STATE_MINED → STATE_CONFIRMED | STATE_INVALID | STATE_FAILED`

**Why deferred:** We use Builder API keys, not relayer keys. The transaction states are relevant for bridge/onboarding flows that submit relayer transactions — should be typed in Zod schemas when implementing Safe deployment polling, but not as a standalone router.

### Books GET Variant

**Endpoint:** `GET /books?token_ids=...`

**Why deferred:** V2 uses `POST /books` (request body) for batch orderbook fetches. The GET variant with query params is available as an alternative for simpler cases but adds no new capability.

### Quote Fee Breakdown

**Response field:** `QuoteResponse.estFeeBreakdown`

**Shape:** `{ gas, slippage, swapImpact, fillCost, minReceived }`

**Why deferred:** Rich fee breakdown for bridge quotes. Should be displayed in the bridge UI's withdraw flow. Currently the bridge shows a single fee number. Implement when polishing the bridge UX.

**When to implement:** During bridge UI polish (Phase 5).

---

## Implementation Priority

Ordered by user impact and dependency chain.

### Tier 1 — High Impact, Low Effort (do first)

| Item | Why | Effort | Depends On |
|------|-----|--------|------------|
| Market schema: `acceptingOrders`, `pendingDeployment`, `deploying` | Trading guard correctness — prevents orders on non-tradeable markets | 1 hour | Nothing |
| Market schema: `lastTradePrice`, `bestBid`, `bestAsk` | Pre-hydrated prices eliminate flash of stale data on market page load | 1 hour | Nothing |
| Market schema: `spread` | Orderbook spread display without waiting for WS | 30 min | Nothing |
| Market schema: `oneDayPriceChange` | Price change badges on explore cards — most requested missing feature | 1 hour | Nothing |
| Order response statuses (`live`/`matched`/`delayed`) | Correct post-trade UI feedback | 2 hours | Nothing |
| `clobInfo` Zod schema + mapping helper | Foundation for fee display and matching engine check | 2 hours | Nothing |

**Subtotal: ~1 day**

### Tier 2 — Medium Impact, Medium Effort

| Item | Why | Effort | Depends On |
|------|-----|--------|------------|
| Market schema: `feeSchedule` | Order cost estimation in order form | 2 hours | Nothing |
| Trade schema: `fee_rate_bps`, `trader_side` | Fee analytics in trades tab | 2 hours | Nothing |
| Events keyset filters: `title_search`, `live`, `tag_match`, `tag_slug` | Explore page filtering — currently limited | 3 hours | Nothing |
| Markets keyset filters: `tag_match`, `condition_ids`, `sports_market_types` | Market discovery filtering | 2 hours | Nothing |
| Event sports fields: `gameStatus`, `score`, `live`, `ended` | Sports live indicator | 2 hours | Nothing |
| Matching engine maintenance check | Prevent orders during CLOB maintenance | 1 hour | `clobInfo` schema |
| Heartbeat V1 ID chain verification | Prevent 400 errors on heartbeat | 1 hour | Nothing |

**Subtotal: ~2 days**

### Tier 3 — New Feature (rewards router)

| Item | Why | Effort | Depends On |
|------|-----|--------|------------|
| Rewards API client (`rewards-api.ts`) | Foundation for all rewards procedures | 3 hours | Nothing |
| `rewards.activeConfigs` + `rewards.marketsWithRewards` | Rewards discovery — explore page integration | 3 hours | API client |
| `rewards.rawForMarket` | Market page rewards detail | 1 hour | API client |
| `rewards.percentages` + `rewards.earningsByDate` | Portfolio rewards tracking | 3 hours | API client |
| `rewards.totalEarnings` + `rewards.userEarnings` | Rewards summary dashboard | 2 hours | API client |
| `rewards.makerRebates` | Fee rebate display | 1 hour | API client |

**Subtotal: ~2 days**

### Tier 4 — Low Priority / Deferred

| Item | Why | When |
|------|-----|------|
| Remaining price change fields (`oneHour`, `oneWeek`, `oneMonth`, `oneYear`) | Nice-to-have for explore cards | When polishing explore |
| `rfqEnabled`, `feesEnabled` | Per-market feature flags | When building RFQ UI |
| Event: `eventCreators`, `gmpChartMode` | CYOM attribution, chart mode | When building CYOM support |
| Event: `chats`, `templates`, `bestLines` | Optional relations | When building those features |
| Quote fee breakdown | Bridge UX polish | Phase 5 |
| Notifications inbox | Notification bell feature | After rewards + comments stable |
| Remaining deferred items | See Deferred Items section | As needed |

### Total Estimated Effort

| Tier | Effort | Phase |
|------|--------|-------|
| Tier 1 | ~1 day | 0 (foundations) |
| Tier 2 | ~2 days | 1 (alongside router renames) |
| Tier 3 | ~2 days | 2 (new feature) |
| Tier 4 | Ongoing | 3+ (as needed) |

**Total: ~5 days of active work**, spread across phases.

### Dependencies on Other V2 Docs

| Doc | Dependency |
|-----|-----------|
| [01 — Procedure Mapping](./01-procedure-mapping.md) | Router renames affect where these schemas live |
| [02 — Router Split Plan](./02-router-split-plan.md) | Rewards router is a new addition to the router tree |
| [05 — Error Model](./05-error-model.md) | Rewards API errors should use `AppError` |
| [09 — Domain Restructure](./09-domain-restructure.md) | Schema files may move during restructure |
