# Polymarket Order Flow: Deep Audit

Audit of Polymarket docs vs Doji implementation for order placement, balance display, and dust prevention.

## 1. Polymarket Official Rules (from docs.polymarket.com)

### Order Types (from Create Order docs)

| Type | Behavior | Use Case |
|------|----------|----------|
| **GTC** | Good-Til-Cancelled — rests on book until filled or cancelled | Limit orders |
| **GTD** | Good-Til-Date — active until specified expiration | Time-bound limit |
| **FOK** | Fill-Or-Kill — must fill entirely immediately or cancel | Market orders (all-or-nothing) |
| **FAK** | Fill-And-Kill — fills what's available, cancels rest | Market orders (partial OK) |

### Market vs Limit

- **Limit (GTC/GTD)**: `size` = **number of shares** (both BUY and SELL)
- **Market (FOK/FAK)**:
  - **BUY**: `amount` = **dollars (USDC)** to spend
  - **SELL**: `amount` = **number of shares** to sell

### Order Book Constraints (GET /book)

| Field | Type | Description |
|-------|------|-------------|
| `min_order_size` | string | Minimum order size (often `"5"` for limit orders) |
| `tick_size` | string | Price increment: `"0.1"`, `"0.01"`, `"0.001"`, `"0.0001"` |

### makerAmount / takerAmount

- Raw integer strings (6 decimals: 1 unit = 1e-6)
- **BUY**: maker = USDC, taker = shares → `makerAmount = price * size` (USDC), `takerAmount = size` (shares)
- **SELL**: maker = shares, taker = USDC → `makerAmount = size` (shares), `takerAmount = price * size` (USDC)
- Both must be > 0 (amounts rounding to 0 cause "invalid amounts")

### CLOB Error Messages

| Error | Meaning |
|-------|---------|
| `INVALID_ORDER_MIN_TICK_SIZE` | Price not a multiple of `tick_size` |
| `INVALID_ORDER_MIN_SIZE` | Size below market's `min_order_size` |
| `FOK_ORDER_NOT_FILLED_ERROR` | FOK couldn't fill entirely |
| `INVALID_ORDER_NOT_ENOUGH_BALANCE` | Insufficient balance or allowance |

### Data API Positions (GET /positions)

- `sizeThreshold`: Filters positions by size; Polymarket uses `0.01` by default
- When `sizeThreshold: 0`, returns all positions including dust
- Data API can lag behind on-chain; on-chain is source of truth

---

## 2. Doji vs Polymarket Alignment

### ✅ Correct

| Area | Doji | Polymarket |
|------|------|------------|
| Limit order size | shares | shares |
| Market BUY amount | USDC (dollars) | USDC |
| Market SELL amount | shares | shares |
| Price tick | From orderbook `tick_size` | Required |
| Min limit size | From orderbook `min_order_size` (5) | Required |
| Raw units | 6 decimals | 6 decimals |
| Balance source | On-chain first, Data API fallback | On-chain is truth |

### ⚠️ Gaps / Fixes Needed

| Gap | Impact | Fix |
|-----|--------|-----|
| Balance row uses `toLocaleString(2 decimals)` | 0.0001 shows as "0 Shares" | Use `formatSharesDisplay` (shows exact for < 0.01) |
| Merge/Yes|No row uses 2 decimals | Same dust hide | Use `formatSharesDisplay` |
| Slider at 100% used `formatSharesDisplay(positionSize)` | OK if positionSize is exact | Ensure positionSize is from chain |
| Positions tab | Already uses `formatSharesDisplay` | — |
| "0 shares but position there" | Dust (0.0001–0.0099) rounded to "0" | Use formatSharesDisplay everywhere |

---

## 3. Data Flow: Where Does positionSize Come From?

```
positionSizeForToken(tokenId)
  ├─ 1. onChainBalances[tokenId]  ← ctfTokenBalances (RPC balanceOf) — SOURCE OF TRUTH
  └─ 2. positions.find(p => p.asset === tokenId)?.size  ← Data API (can be stale)
```

- **trading-layout**, **trading-workspace**: `tokenIdsForBalance = [yesTokenId, noTokenId]` → always fetch chain for current market
- **positions tab**: Merges API + chain; prefers chain when available
- **sizeThreshold**: trading-layout uses `0.01` for positions query (doesn't affect tokenIds — we only use yes/no from market). Positions tab uses `0` to include dust.

---

## 4. Slider / Submit Flow (Polymarket Compliant)

### Market BUY

- User enters **$** (e.g. $10)
- Submit: `amount` = floored to 2 decimals (USD), min $1
- CLOB: FOK/FAK with `amount` in dollars

### Market SELL

- User sees balance (must use exact for dust)
- Slider 100%: `formatSharesExact(maxShares)` → 6-decimal floor
- Submit: `amount` = shares, floored to 6 decimals, capped at `effectiveBalance`
- Min 0.001 shares (below = dust, can't sell)

### Limit BUY/SELL

- User enters **shares** and **price**
- Submit: `size` in shares, `price` rounded to tick
- Min `min_order_size` from orderbook (typically 5)

---

## 5. "0 Shares But Position Still There" — Root Cause

**Cause**: Display uses `toLocaleString` or `toFixed(2)` which rounds 0.0001 → "0.00" or "0".

**Fix**: Use `formatSharesDisplay` everywhere for share amounts:

- For `val >= 0.01`: 2 decimals (e.g. "1.05")
- For `0 < val < 0.01`: exact value (e.g. "0.0001") so user sees they have dust
- For `val === 0`: "0"

---

## 6. Checklist: Polymarket Compliance

- [x] Market BUY: amount in USD, min $1
- [x] Market SELL: amount in shares, min 0.001, floor to 6 decimals
- [x] Limit: size in shares, price in tick multiples
- [x] min_order_size from orderbook for limit
- [x] tick_size from orderbook for price
- [x] Balance from on-chain first
- [x] Never round shares to 2 decimals (creates dust)
- [ ] **Display**: All share amounts use formatSharesDisplay (Balance row, merge, etc.)
- [x] Positions with size < 0.001: disable Sell, show "(dust)"
- [x] sizeThreshold: 0 for positions tab to include dust

# Order Flow Audit: Buy, Sell, Limit, Market, Split, Merge

Audit of Doji's order placement against Polymarket CLOB/CTF specs to prevent dust and ensure correct amounts.

## Polymarket Requirements (from docs)

| Area | Requirement |
|------|-------------|
| **Raw units** | 6 decimals (`1 unit = 1e-6` shares or USDC). Amounts rounding to 0 cause "invalid amounts" |
| **Price tick** | From orderbook `tick_size` (0.1, 0.01, 0.001, 0.0001). Price must be a multiple |
| **Min order size** | From orderbook `min_order_size` (often 5 for limit). Market FOK/FAK may allow smaller |
| **Limit orders** | size = shares; min 5 shares typically |
| **Market BUY** | amount = USDC; min ~$1 for marketable fills |
| **Market SELL** | amount = shares; min 0.001 shares |
| **makerAmount/takerAmount** | CLOB uses raw 6-decimal integers (no 2-decimal constraint on shares) |

## Doji Implementation

### Order Form (`order-form.hooks.ts`)

| Flow | Amount handling |
|------|-----------------|
| **Market BUY** | `roundUsdToMakerPrecision` (2 decimals for USD) → min $1 |
| **Market SELL** | `floorSharesToChainPrecision` (6 decimals) → cap at `effectiveBalance` → min 0.001 |
| **Limit BUY/SELL** | No extra rounding; size in shares; uses `min_order_size` from CLOB (typically 5) |

- **positionSize** comes from `positionSizeForToken`: on-chain `ctfTokenBalances` first, fallback to Data API positions.
- **effectiveBalance** = `Math.floor(positionSize * 1e6) / 1e6` — never exceed on-chain balance.
- **Tick size** from CLOB orderbook via `marketToOrderConstraints`; applied to limit price.
- **Raw guards**: Reject if `rawShares < 1` or `rawUsdc < 1` to avoid "invalid amounts".

### Quick Sell Modal (`quick-sell-modal.tsx`)

- At 100%: uses `formatSharesExact(size)` for exact balance, then `floorSharesToChainPrecision(min(sharesToSellNum, size))` before submit.
- Prevents dust by never rounding shares to 2 decimals.

### Split (`packages/api/src/lib/split-merge-txs.ts`)

- `toWei(amountUsd)` floors to 6 decimals before `parseUnits` to avoid exceeding USDC balance from rounding up.
- Split amount (USD) is floored; user input or Max is capped by validation.

### Merge (`packages/api/src/lib/split-merge-txs.ts`)

- `toWei(amountShares)` floors to 6 decimals before encoding.
- Prevents attempting to merge more than balance (e.g. 1.9999999 → 2.0 would fail on-chain).
- Order form merge: uses `Math.floor(Math.min(amountShares, maxMerge) * 1e6) / 1e6` before calling `createMergeTransaction`.

## Dust Prevention Rules

1. **Sell shares**: Always floor to 6 decimals (chain precision). Never round to 2 decimals for shares.
2. **Buy USD**: 2 decimals is acceptable for dollar amounts.
3. **Cap sell at balance**: `sizeToUse = min(sizeNum, effectiveBalance)` with `effectiveBalance` floored to 6 decimals.
4. **Split/Merge**: Floor amounts before `toWei` to avoid round-up exceeding balance.
5. **Raw units**: Ensure `rawShares >= 1` and `rawUsdc >= 1` before submitting.

## Related Docs

- [dust-positions-debug.md](./dust-positions-debug.md) — Root causes and debugging
- [ON-CHAIN-DUST-CLEANUP.md](./ON-CHAIN-DUST-CLEANUP.md) — On-chain merge/redeem for unsellable dust
- [POLYMARKET-FULL.md](./POLYMARKET-FULL.md) — Polymarket API reference
