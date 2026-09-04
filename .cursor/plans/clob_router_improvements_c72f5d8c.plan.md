---
name: CLOB Router Improvements
overview: "Implement six CLOB router improvements (validated against references/clob-openapi.md): trades only_first_page, price history date strings, fidelity validation mapping, no-orderbook 404 mapping, midpoints/spreads documentation, and CLOB health procedure."
todos:
  - id: error-mapping
    content: Add fidelity mapping in getPricesHistory body + handleClobProcedureError; no-orderbook in withTradeabilityCache
    status: completed
  - id: price-history-dates
    content: Add startDate/endDate to priceHistoryParamsSchema and convert to timestamps
    status: completed
  - id: trades-pagination
    content: Add only_first_page to getTrades; optionally getTradesPaginated (returns trades, limit, count; no cursor)
    status: completed
  - id: health-procedure
    content: Add getClobHealth public procedure; throw INTERNAL_SERVER_ERROR when CLOB unhealthy
    status: completed
  - id: midpoints-docs
    content: Add JSDoc for getMidpoints and getSpreads token-only usage
    status: completed
  - id: agents-md
    content: Update routers AGENTS.md with new procedures and params
    status: completed
isProject: false
---

# CLOB Router Improvements Plan

Implement the six improvements identified in the CLOB route audit comparing Doji with the Elysia-based reference implementation.

---

## Pending Diffs (Pre-Implementation)

**Status:** None of the six plan items are implemented. `apps/server/src/routers/clob.ts` has no uncommitted changes.

Uncommitted changes in related files (as of audit):

**clob-read.ts**

- `FeeRateSchema`: API field `fee_rate_bps` → `base_fee`; `getFeeRate` maps `result.base_fee` → `{ fee_rate_bps }` for compatibility. Verify Polymarket API returns `base_fee` before merging.
- New exports: `getMidpoints`, `getSpreads` with token-only `Array<{ token_id: string }>` (no side); `getLiquidityMetrics`, `getGeoblock`. Router still uses `getReadOnlyClient()` with `side: "BUY"`; plan section 5 can optionally switch to clob-read token-only variants if desired.
- `getMidpoint`/`getSpread`: added explicit object handling for `mid`/`spread` (router uses getReadOnlyClient, not these).

**rate-limit-config.ts**

- CLOB: `/midprice` → `/midpoint`, `/midprices` → `/midpoints`. Gamma: expanded with series, sports, teams, public-profile, public-search.

**health.ts**

- Gamma: `/tags` → `/status`; Data: `/v1/leaderboard?limit=1` → `/`. CLOB already used `GET /`.

**AGENTS.md**

- Health section added (Hono `/api/health` docs). Plan's getClobHealth, only_first_page, startDate/endDate docs still pending.

---

## Validation Against `references/clob-openapi.md`

Validated against the official Polymarket CLOB OpenAPI (references dir). Findings:


| Plan item         | OpenAPI spec                                                              | Validation                                                                                     |
| ----------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Trades pagination | GET /data/trades: id, taker, maker, market, before, after — **no cursor** | CLOB user-trades API does not support cursor pagination. Only `only_first_page` on getTrades.  |
| Price history     | market, startTs (number), endTs (number), interval, fidelity              | startDate/endDate strings are a convenience layer — convert to startTs/endTs in router. Valid. |
| No orderbook      | 404: `error: "No orderbook exists for the requested token id"`            | Confirmed. Map this exact message to NOT_FOUND.                                                |
| Health            | `getOk()` — health check endpoint                                         | Equivalent to getHeartbeat (GET /). Valid.                                                     |


**Note:** `getTradesPaginated` in the spec returns `{ trades, limit, count }` with **no next_cursor**. Cursor-based pagination exists only for `getBuilderTrades`, not user trades.

---

## 1. Trades Pagination (Revised)

**Current:** [apps/server/src/routers/clob.ts](apps/server/src/routers/clob.ts) `getTrades` uses `client.getTrades(input)` with no pagination support.

**Per [references/clob-openapi.md](references/clob-openapi.md):**

- `getTrades(params?, only_first_page?)` — second param limits to first page. Documented.
- `getTradesPaginated(params?)` — returns `{ trades, limit, count }` — **no cursor** for user trades.

**Revised approach:**

- Add `only_first_page?: boolean` to `tradeParamsSchema` for `getTrades`; pass as second argument to `client.getTrades`.
- **Optional:** Add `getTradesPaginated` procedure that returns `{ trades, limit, count }` (first-page style; no cursor for next page). Lower priority since the CLOB API does not expose cursor-based pagination for user trades.

---

## 2. Price History Date Strings

**Current:** [priceHistoryParamsSchema](apps/server/src/routers/clob.ts) (lines 374–380) accepts `startTs` and `endTs` as numbers only.

**Changes (router-only, no clob-read changes):**

- Add optional `startDate` and `endDate` (strings) to `priceHistoryParamsSchema`. Accept ISO 8601 (`"2025-08-13"`, `"2025-08-13T00:00:00.000Z"`) or epoch-second strings.
- Add helper `parseDateToEpochSeconds(value: string): number` — use `Date.parse()`; invalid input throws (caught as BAD_REQUEST).
- In the procedure: if `startDate`/`endDate` provided, parse and set `startTs`/`endTs`. If both numeric and date provided for the same bound, prefer explicit `startTs`/`endTs`.
- Invalid date strings → `createAppError` / `TRPCError` with `BAD_REQUEST` (not INTERNAL_SERVER_ERROR).

---

## 3. Fidelity Validation Mapping

**Current:** [handleClobProcedureError](apps/server/src/routers/clob.ts) (lines 242–293) maps regional restriction (403) and invalid signature (400). CLOB can return 400 for "invalid filters", "minimum fidelity", or "fidelity" when price-history params are invalid.

**Critical:** `getPricesHistory` is a **public** procedure and does NOT use handleClobProcedureError. Add fidelity mapping in **both** places:

- **handleClobProcedureError** — for protected procedures (consistency).
- **getPricesHistory procedure body** — wrap `getPriceHistory` call in try/catch; on fidelity-match, throw BAD_REQUEST.

**Changes:**

- Use regex `/invalid filters|minimum fidelity|fidelity.*invalid/i`. Match against `msg` (from `err.response?.data?.error ?? err.message`).
- Map to `createAppError({ code: "BAD_REQUEST", message: "Invalid price history parameters. Check date range and fidelity.", ... })`.

---

## 4. "No Orderbook Exists" → NOT_FOUND (404)

**Per [references/clob-openapi.md](references/clob-openapi.md):** 404 response for GET /book (and related endpoints) includes `error: "No orderbook exists for the requested token id"`.

**Changes (in `withTradeabilityCache` catch block):**

- Before rethrowing, check `err?.message` (and `err.response?.data?.error`) for the spec message: `/no orderbook exists|no orderbook.*token/i`.
- When matched: call `markInvalidTokenId(tokenId)` (tokenId is in scope), then throw `TRPCError NOT_FOUND` with message "Market not found".
- This covers both HTTP 404 responses and errors thrown with this message when status is absent.

---

## 5. Midpoints/Spreads Input Documentation

**Current:** `getMidpoints` and `getSpreads` accept `bookParamsSchema` (token_id + side). The CLOB API effectively uses token_id; `side` is optional or unused for these endpoints.

**Changes:**

- Add JSDoc to `getMidpoints` and `getSpreads` procedures clarifying that `side` is optional and that token-only lookups are sufficient.
- Optionally: introduce a simpler `tokenIds: z.array(z.string())` input for midpoints/spreads when `side` is never needed, or document the existing schema. Minimize breaking changes — documentation first; schema simplification only if it does not break callers.

---

## 6. CLOB Health Procedure

**Current:** [apps/server/src/routers/health.ts](apps/server/src/routers/health.ts) exposes Hono `/api/health` which checks CLOB (and other services) and returns 503 when degraded. There is no tRPC procedure for CLOB-only health (useful for frontend "trading unavailable" checks).

**Changes:**

- Add `getClobHealth` as a **public** procedure in the CLOB router.
- Call `getHeartbeat()` from [clob-read.ts](apps/server/src/lib/polymarket/clob-read.ts).
- On success: return `{ status: "healthy" }`.
- On failure: throw `TRPCError` with `code: "INTERNAL_SERVER_ERROR"` and message `"CLOB API unavailable"`. (tRPC has no built-in `SERVICE_UNAVAILABLE`; HTTP adapters typically map INTERNAL_SERVER_ERROR to 500. For true 503, the existing Hono `/api/health` remains the primary endpoint.)

---

## Implementation Order

1. **Error handling (3, 4)** — Fidelity mapping and no-orderbook mapping. Low risk, improves UX immediately.
2. **Price history dates (2)** — Add `startDate`/`endDate`; backward compatible; parse in router only.
3. **Trades (1)** — Add `only_first_page` to `getTrades`. Optionally add `getTradesPaginated` returning `{ trades, limit, count }` (no cursor).
4. **Health procedure (6)** — Straightforward addition.
5. **Documentation (5)** — JSDoc for midpoints/spreads; can be done in parallel or last.

---

## Files to Modify


| File                                                                   | Changes                                                                                                                                                                                                                                                                                                                                           |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [apps/server/src/routers/clob.ts](apps/server/src/routers/clob.ts)     | `tradeParamsSchema` (+`only_first_page`), optional `getTradesPaginated`, `priceHistoryParamsSchema` (+`startDate`/`endDate`), `parseDateToEpochSeconds`, `getPricesHistory` try/catch + fidelity mapping, `handleClobProcedureError` (fidelity), `withTradeabilityCache` (404 + no-orderbook), `getMidpoints`/`getSpreads` JSDoc, `getClobHealth` |
| [apps/server/src/routers/AGENTS.md](apps/server/src/routers/AGENTS.md) | Document `getClobHealth`, trades params (`only_first_page`), price history date params                                                                                                                                                                                                                                                            |


---

## Testing

- Unit tests for `parseDateToEpochSeconds` (valid ISO, YYYY-MM-DD; invalid strings → BAD_REQUEST).
- Unit tests for error mapping (fidelity regex; no-orderbook per spec message → NOT_FOUND).
- Integration test: `getTrades` with `only_first_page`; `getClobHealth` when CLOB up/down.

---

## Key Concerns (Alignment Audit)

- **rate-limit-config.ts** — Ensure CLOB paths use `/midpoint` and `/midpoints` (not `/midprice`/`/midprices`) per Polymarket API; Gamma expanded paths (series, sports, teams, public-profile, public-search) must match client usage.
- **clob-read.ts FeeRateSchema** — API may return `base_fee` instead of `fee_rate_bps`; verify against live responses before assuming schema stability.
- **health.ts** — Gamma health uses `GET /status`, Data uses `GET /`; do not conflate with other endpoints.

