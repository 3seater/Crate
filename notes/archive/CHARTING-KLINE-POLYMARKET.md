# Polymarket charting with KLineChart (v10)

Canonical notes for **price history**, **realtime updates**, **OHLC aggregation**, and **KLineChart** integration. Complements the executable checklist in [`.cursor/plans/klinechart_migration_plan_98ba1f15.plan.md`](../.cursor/plans/klinechart_migration_plan_98ba1f15.plan.md).

## Goals

- Render **probability prices** (roughly 0–1) with **KLineChart v10** using `setDataLoader` + optional `subscribeBar`.
- Treat CLOB **`{ t, p }`** samples as **close-like** measurements; build **OHLC bars** in app code when the chart needs candles.
- Avoid false precision: **long history** often requires **coarser fidelity**; **short windows** can use **finer** sampling.

---

## Polymarket REST: `prices-history`

**Official:** [Get prices history (CLOB timeseries)](https://docs.polymarket.com/developers/CLOB/timeseries) · [OpenAPI-style page](https://docs.polymarket.com/api-reference/markets/get-prices-history) · index [llms.txt](https://docs.polymarket.com/llms.txt).

| Topic | Detail |
|--------|--------|
| **Response shape** | `history: { t: number; p: number }[]`. No native OHLC — only time + price. |
| **`fidelity`** | Minutes between points (docs: default **1** when applicable). Too fine a fidelity for a long range yields **400** (invalid filters / minimum fidelity). **Preset floors** (CLOB-enforced): e.g. `1m` (month) **≥ 10**, `1w` **≥ 5** — see `CLOB_PRICE_HISTORY_MIN_FIDELITY_BY_INTERVAL` in `@doji/types`. |
| **`max` + fine `fidelity`** | With `interval=max`, **low** `fidelity` (e.g. **1**) often returns a **dense but short recent** window (~weeks), not the full multi-year series. **Daily** (`fidelity` **1440**) returns the long backfilled history. Doji’s `fetchPricesHistoryWithLadder` tries **coarse-first** for `max` so charts (1D/1W/1M) see full span. |
| **`interval` vs range** | `interval` presets (`max`, `all`, `1w`, `1d`, `6h`, `1h`, `1m`) vs explicit **`startTs` / `endTs`** — mutually exclusive per API contract. |
| **Long `startTs`/`endTs`** | CLOB may return **400** `interval is too long` for wide explicit windows (e.g. ~30 days) **even at coarse `fidelity`**. Chart loads should use **`interval` presets** for UI timeframes, not client-computed `startTs`/`endTs`. Doji: [`polymarket-kline-fetch.ts`](../apps/web/src/components/charts/polymarket-kline-fetch.ts) passes the selected chip (`1h` … `1m`, `max`) as CLOB `interval` and runs a **fidelity ladder** on empty/error. |
| **Implication** | **High/low inside a bar** only exist if **multiple samples** fall in that bar’s window. One sample per bar ⇒ **`open = high = low = close`** (doji). |

**Doji wiring today:** `clob.getPricesHistory` → `getPriceHistory` in [`apps/server/src/lib/polymarket/clob-read.ts`](../apps/server/src/lib/polymarket/clob-read.ts); defaults in [`resolvePriceHistoryRequest`](../apps/server/src/routers/clob.ts); fidelity constants in [`apps/server/src/constants.ts`](../apps/server/src/constants.ts).

---

## Polymarket WebSocket: market channel

**Official:** [Market channel](https://docs.polymarket.com/developers/CLOB/websocket/market-channel).

Endpoint: `wss://ws-subscriptions-clob.polymarket.com/ws/market`. Subscribe with `assets_ids` and `"type": "market"`. Set **`custom_feature_enabled: true`** to receive **`best_bid_ask`**, **`new_market`**, and **`market_resolved`**.

| `event_type` | Charting relevance |
|--------------|-------------------|
| **`last_trade_price`** | **Trade prints** — natural choice for “last traded” series (Doji: `subscribeBar` in [`polymarket-kline-chart-inner.tsx`](../apps/web/src/components/charts/polymarket-kline-chart-inner.tsx)). |
| **`price_change`** | Book updates (place/cancel). Can imply **price movement without a trade** — useful if the chart should feel alive in **illiquid** markets. |
| **`best_bid_ask`** | Explicit **best bid / best ask / spread** (requires `custom_feature_enabled`). Good for **mid** or **touch** synthetic series between trades. |
| **`book`** | Full L2 — heavier; use if building mid from depth. |
| **`tick_size_change`** | Tick size can change when price moves past **~0.96** or below **~0.04**. Align **axis precision** / formatting with book rules (see also `getTickSize`). |
| **`market_resolved`** | **Resolution** event — candidate for a vertical marker / overlay when `custom_feature_enabled` is on. |

**Design fork (document the product choice):**

- **Trade-only chart:** update on **`last_trade_price`** only — honest but **sparse** when nobody trades.
- **Market-implied chart:** also fold **`best_bid_ask`** (e.g. mid) or **`price_change`** — smoother but **not** the same as “last trade.”

---

## OHLC from granular closes (“friend recipe” + CLOB reality)

1. **Fetch the finest granularity the API allows** for the requested window (often **1-minute** fidelity for short spans; coarser for long `max` history).
2. Treat the series as **ordered measurements** `(t, p)`; `p` acts as **close** for that bucket.
3. **Resample** into chart period buckets (e.g. 1h, 1d):
   - **Week / month alignment:** Weekly bars use **UTC Monday 00:00** as bar open time; monthly bars use **UTC first-of-month 00:00**. Shorter periods (hour, day, etc.) use **fixed-width windows from the Unix epoch** via `periodToMs` (same as KLine’s internal step). Realtime `subscribeBar` uses **`periodBarStartMs`** so live updates land in the same bucket as history aggregation (`aggregatePricePointsForKlinePeriod` in `kline-aggregation.ts`).
   - **`open`:** usually **`previous bar’s close`** (carry) so the chain has **no artificial gaps** between consecutive bars you emit.
   - **Alternative `open`:** first sample in the bucket — better when **many** ticks exist inside the bucket (closer to classic candles).
   - **`high` / `low`:** min/max over **closes** in the bucket (include open/close of the bucket in the min/max).
   - **`close`:** last sample in the bucket.
4. **KLineChart:** `KLineData.timestamp` is **milliseconds**; CLOB `t` is typically **seconds** ⇒ multiply by `1000` where appropriate.
5. **Deduping:** same as line chart today — **sort by `t`**, collapse identical timestamps to **last** `p` (see [`toChartData`](../apps/web/src/components/charts/time-series-chart-utils.ts)).
6. **Wick / Y-scale:** Candle **high/low** are normally the min/max of every sample in the bar. A **single** bad or extreme CLOB print in that window becomes a **huge wick** and forces the price axis to zoom out (ugly pan/zoom). Doji applies a **Tukey fence** on in-bucket samples when building wicks (`filterSamplesForWickTukey` in `kline-aggregation.ts`); **open** and **close** are unchanged. Set `tukeyWickFilter: false` on `aggregatePricePointsToKLineData` if you need raw min/max.

**Limits:** If the stored history is **one point per day**, you **cannot** reconstruct true **hourly** OHLC for that era without **another data source** (e.g. trades API) or **accepting** single-point candles.

**Sparse / illiquid markets:** expect **few bars** or **doji-like** bars. Mitigations: **line / area** mode, copy that explains low liquidity, optional **synthetic mid** from WS (above).

**Viewport:** KLineChart’s default right offset leaves **empty space** after the last candle (x-axis can look like it extends into the “future”). Doji calls **`setOffsetRightDistance(0)`** after the first successful **`init`** load so the last bar sits at the visible edge when data exists.

**Timezone:** Bar times for **week** / **month** are **UTC** (Monday / 1st 00:00Z). KLineChart’s default axis uses the **browser locale TZ**, so e.g. **March 1 00:00 UTC** can render as **February** in US zones. Doji sets **`timezone: 'UTC'`** on `init` so month labels match the buckets (and the in-progress month is visible as **March**, not “missing”).

---

## UI timeframe semantics (product / team alignment)

Doji follows **Model A (TradingView-style)**: the chip is **candle period** — **1H** = one hour per bar, **1D** = one day per bar, etc. **Pan left** requests **older** history via KLineChart `getBars` **`type: "forward"`** (v10 prepends older bars; the name is easy to confuse with “scroll direction”).

**Data wiring** ([`polymarket-kline-bars.ts`](../apps/web/src/components/charts/polymarket-kline-bars.ts) + [`intervalToPeriod`](../apps/web/src/components/charts/kline-aggregation.ts)):

| Chip | KLine bar period | How history is loaded |
|------|------------------|------------------------|
| 15M | 15 minutes | Explicit `startTs`/`endTs` (~7d init, ~7d **`forward`** chunks); same paging pattern as 1H. |
| 1H | 1 hour | Explicit `startTs`/`endTs` (~7d init, ~7d **`forward`** chunks); skips empty chunks so sparse markets still reach older data. |
| 6H | 6 hours | Same pattern (~14d init, ~14d **`forward`** chunks). |
| 1D | 1 day | CLOB `interval: max` (full series), aggregated to daily candles. |
| 1W | 1 week | `max` → aggregate to weekly buckets. |
| 1M | ~1 month | `max` → aggregate to monthly buckets (30d period in KLine). |
| ALL | 1 day | `max` preset (optional prefetch seed); same daily resolution as 1D, full history. |

**API limits:** Long explicit `startTs`/`endTs` ranges can still **400**; short bars use **small windows + paging** instead of one huge range. **`max`** avoids that for coarse periods.

**Flat / empty-looking candles** on illiquid markets are **mostly honest data** (few prints → carry-open OHLC → thin bodies).

**Y-axis:** The default KLineChart range is **min/max of visible highs/lows**. One **historical spike** still on screen (e.g. after “Latest” with the oldest bar on the left) stretches the scale; **nudging scroll** drops that bar from the visible list and the axis tightens — same data, different visible window. Doji uses a **robust** candle-pane `createRange` (percentile band on visible OHLC + pad + pin last close) so a single edge outlier does not squash the rest while it remains in view.

**15M wicks:** Fine buckets can get **lone bad prints** → long downward wicks. After aggregation we **`clampKLineWicksNearBody`** (cents cap past open/close) for the 15M interval only.

**Don’t promise** to remove all flat regions without **extra series** (mid from book, or trade-derived bars) — widening bars only hides flatness by **coarsening** time, not inventing movement.

---

## KLineChart v10 (core library)

**Docs:** [klinecharts.com](https://www.klinecharts.com) · local clone [`references/KLineChart`](../references/KLineChart) (may differ slightly from published npm).

### Data model

- **`KLineData`:** `timestamp` (ms), `open`, `high`, `low`, `close`; optional `volume`, `turnover`.
- **v10 loading:** [`setDataLoader`](https://klinecharts.com/api/instance/setDataLoader) with:
  - **`getBars`** (required) — receives `type`, `timestamp`, `symbol`, `period`, `callback`.
  - **`subscribeBar` / `unsubscribeBar`** (optional) — realtime bar updates.

### React integration

- Pattern from docs: **`init`**(container id or element) → **`setSymbol`** → **`setPeriod`** → **`setDataLoader`** → **`dispose`** on unmount.
- Chart **fills the container** — parent needs a **real height** or the chart looks like “one line” (FAQ).

### Styling and behavior (FAQ-level)

| Issue | Doc / approach |
|--------|----------------|
| Flat candles | **`setSymbol({ ticker, pricePrecision, volumePrecision })`** — important for **0–1** prices. |
| “Realtime” smooth curve | **`setStyles({ candle: { type: 'area' } })`**. |
| Buy/sell / point labels | **`createOverlay({ name: 'simpleAnnotation', ... })`**. |
| Jump to latest | **`scrollToRealTime(animationDuration?)`**. |

### Indicators and overlays

- Many built-ins (MA, BOLL, MACD, RSI, …). Some overlay the candle pane via `createIndicator(..., true, { id: 'candle_pane' })` — see [Indicator guide](https://www.klinecharts.com/en-US/guide/indicator).
- Custom overlays: `registerOverlay` + `createOverlay`; see [Overlay guide](https://www.klinecharts.com/en-US/guide/overlay).

### Version and API truth

- **Pin an exact `klinecharts@10` version** on npm; use shipped **`d.ts`** when docs/changelog disagree.
- Breaking changes from 9→10: [v9 to v10](https://www.klinecharts.com/en-US/guide/v9-to-v10) (also under `references/KLineChart/docs/en-US/guide/v9-to-v10.md`).

### Known issue to regression-test

- [KLineChart #747](https://github.com/klinecharts/KLineChart/issues/747): **`getBars`** + **synchronous** `callback` + certain **`more` (`forward` / `backward`)** flags may interact badly with **drag-to-load** (auto scroll / load loops). Mitigations: **real async** fetches, conservative **`more`**, manual QA on **pan-left** after upgrade.

---

## KLineChart Pro (optional product layer)

- **Package:** `@klinecharts/pro` + `klinecharts`; ships **toolbar, periods, layout** and a **`DefaultDatafeed`** pattern aimed at **Polygon.io** ([getting started](https://pro.klinecharts.com/en-US/getting-started.html)).
- **Preview site:** [preview.klinecharts.com](https://preview.klinecharts.com) — UI from Pro, sample data from Polygon; source [klinecharts/preview](https://github.com/klinecharts/preview).
- **Gem:** Pro is a **shortcut for chrome**, not Polymarket data — you still implement a **Polymarket-shaped datafeed** (or use core `setDataLoader` only).

---

## Cross-cutting checklist

| Idea | Why |
|------|-----|
| Tiered fidelity | Fine for **visible** window; coarse for **deep** history — matches API limits. |
| Carry-open OHLC | Matches **close-only** upstream data; continuous visual chain. |
| WS beyond last trade | **`best_bid_ask` / mid** if charts must move without prints. |
| `tick_size_change` + precision | Keeps axis honest near **0** and **1**. |
| Resolution marker | **`market_resolved`** when subscribed with custom features. |
| Loader QA | Exercise **`callback(data, more)`** + drag after pinning v10. |

---

## Related repo files (pre-migration reference)

| Role | File |
|------|------|
| LWC line chart | [`apps/web/src/components/charts/time-series-chart.tsx`](../apps/web/src/components/charts/time-series-chart.tsx), [`time-series-chart-inner.tsx`](../apps/web/src/components/charts/time-series-chart-inner.tsx), [`time-series-chart-utils.ts`](../apps/web/src/components/charts/time-series-chart-utils.ts) |
| TV datafeed | [`apps/web/src/components/charts/polymarket-datafeed.ts`](../apps/web/src/components/charts/polymarket-datafeed.ts) |
| Trade markers (LWC) | [`apps/web/src/components/charts/use-trade-markers.ts`](../apps/web/src/components/charts/use-trade-markers.ts) |

---

## Maintenance

- When **Polymarket** or **KLineChart** APIs change, update this doc and the **migration plan** if scope shifts.
- Run **`pnpm fix`** after editing if any tooling touches the file indirectly.
