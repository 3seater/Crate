# Table Design System

> Guidelines for data tables with sortable headers (Market, Type, Outcome, Shares, Date, etc.). Excludes holders, comments, and non-tabular layouts.

## Core Principles

1. **No wrapping** — Nothing should break to a second line. Use `whitespace-nowrap` on date/time cells and compact formats.
2. **Smart truncation** — Long content (market names, wallet addresses, names) truncates only when needed. Use `min-w-0` on flex/grid parents and `truncate` on the text element.
3. **Consistent spacing** — Same logical padding across similar table types.

## Date & Time Formatting

Use `formatCompactDateTime` from `@/lib/table-formats` for table date+time cells:

```ts
import { formatCompactDateTime } from "@/lib/table-formats";

// Output: "Dec 25, 14:30" (compact, 24h, never wraps)
<span className="whitespace-nowrap text-muted-foreground">
  {formatCompactDateTime(timestamp)}
</span>
```

For order expiration strings, use `formatCompactExpiration`:

```ts
import { formatCompactExpiration } from "@/lib/table-formats";
const display = formatCompactExpiration(rawExpiration);
```

Relative time (e.g. "2m ago") is already compact — keep `whitespace-nowrap` on the container.

## Truncation Rules

| Content type      | Truncate? | Notes                                                |
|-------------------|-----------|------------------------------------------------------|
| Market/question   | Yes       | `min-w-0 flex-1` + `truncate` on inner element       |
| Wallet address    | Yes       | Use `truncateAddress()` or `truncate` with tooltip  |
| Trader name       | Yes       | `min-w-0 truncate` when in constrained column        |
| Dates/times       | No        | Use compact format + `whitespace-nowrap`             |
| Numbers/prices     | No        | Tabular-nums; fixed-width formats                    |
| Yes/No, BUY/SELL  | No        | Short fixed strings                                  |

## Spacing Standards

### Portfolio-style tables (Position, Orders, Trades, Activity, Closed)

- Header row: `min-h-[42px] px-6 py-3`
- Body row: `min-h-[56px] px-6 py-4`
- Column gap: `gap-3`

### Explore tables (Markets, Events)

- Uses `DataTable` or custom table with `table-fixed`
- Cell padding: `py-3` body, `py-3` header; horizontal via `px-5` / `px-6` per column
- Ensure `whitespace-nowrap` on date columns

### Trading terminal (Open Orders, Trades tab)

- Compact: `px-3 py-1.5` or `px-4 py-2` for dense layouts

### Leaderboard

- Uses `LeaderboardDataTable`: `py-4` body, `py-2` header; `pr-6 pl-4` first col, `px-6` middle, `pr-8 pl-6` last col

## Tables Covered

| Location              | Component                   | Date col                 | Notes                      |
|-----------------------|-----------------------------|--------------------------|----------------------------|
| Portfolio             | PositionTable               | —                        | Grid layout                |
| Portfolio             | OrdersTable                 | Expiration               | formatCompactDateTime      |
| Portfolio             | TradeHistory                | Date                     | formatCompactDateTime      |
| Portfolio             | ActivityHistory             | Date                     | formatCompactDateTime      |
| Portfolio             | ClosedPositionsTable         | —                        | Grid layout                |
| Explore               | MarketsTable                | Expires                  | "Today"/"X days" (short)   |
| Explore               | EventsTable                 | Expires                  | "Today"/"X days" (short)   |
| Market page           | AllMarketTradesTab          | Time                     | RelativeTime (already ok)  |
| Market page           | UserTradesHistoryTab        | Time                     | formatCompactDateTime     |
| Leaderboard           | LeaderboardDataTable        | Active                   | formatRelativeTime (ok)    |
| Profile               | ProfilePositionsTable       | —                        | Native table               |
| Trading               | OpenOrders                  | Expiration               | GTC/GTD label (short)      |
