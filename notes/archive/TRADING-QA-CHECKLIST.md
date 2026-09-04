# Trading Experience — QA / UX / UI Checklist

> Use this checklist to audit and test the full trading flow: market buy/sell, limit buy/sell, split, and merge.  
> **Entry points:** Order form (market page, event page), Instant Trade Popup, Quick Sell Modal.

---

## 1. Pre-Trade State

### 1.1 Authentication & Wallet

- [ ] **Logged out:** Order form shows sign-in CTA, not disabled inputs
- [ ] **Logged in, no Safe:** Redirect to onboarding or clear CTA to deploy Safe
- [ ] **Logged in, Safe deployed:** Form enabled, balance visible
- [ ] **Geoblocked region:** Trading disabled with `geoblockMessage`; no order placement
- [ ] **Restricted regions:** `RestrictedRegionButton` behaves correctly in Quick Sell Modal and elsewhere

### 1.2 Balance & Allowance

- [ ] USDC balance displays correctly (cash available for buys/splits)
- [ ] Allowance error surfaced with "Fix Trading" or similar CTA
- [ ] Position size (Yes/No shares) updates after orders without page refresh
- [ ] Mergeable shares (full sets) shown correctly for merge tab
- [ ] Balance updates feel timely after fills (no long stale state)

### 1.3 Market State

- [ ] **Closed market:** Trading disabled; clear messaging (e.g. resolution outcome)
- [ ] **No orderbook:** Fallback messaging for market orders ("Market price unavailable; connect orderbook or use Limit")
- [ ] **Empty orderbook (no bids/asks):** Orderbook shows "No bids" / "No asks" per design

---

## 2. Market Buy

### 2.1 Order Form (Market tab)

- [ ] Side = BUY selected
- [ ] Amount = USDC (not shares)
- [ ] Quick amount buttons (25%, 50%, 100%) apply correct USD
- [ ] Estimated shares/computed shares display updates as amount changes
- [ ] Estimated fill price uses orderbook avg when available; fallback to best ask
- [ ] Min amount validation (e.g. $0.01 or market min)
- [ ] Max amount capped by `cashBalance`; clear error if over
- [ ] Submit button disabled when invalid; enabled when valid
- [ ] Loading state: "Placing Order..." during submission
- [ ] Success: toast with side, amount, outcome; order appears in Open Orders or fills immediately
- [ ] Error: user-friendly toast (no raw API error); form stays editable

### 2.2 Instant Trade Popup

- [ ] Opens from market tab / header (Instant Trade button)
- [ ] Amount inputs (preset USD amounts) work
- [ ] Balance check: blocks buy if amount > `cashBalance`; shows toast
- [ ] Execute: `executeMarketBuy` runs; success/error toasts
- [ ] Query invalidation: positions/balance refresh after fill

### 2.3 FOK/FAK

- [ ] Settings: FOK vs FAK choice persists
- [ ] FOK: full fill or cancel (thin book may fail more)
- [ ] FAK: partial fill allowed; remaining cancelled
- [ ] User understands difference (tooltip or docs if needed)

---

## 3. Market Sell

### 3.1 Order Form (Market tab)

- [ ] Side = SELL selected
- [ ] Amount = shares (not USD)
- [ ] Quick amounts (25%, 50%, 100%) use `positionSize` correctly
- [ ] Slider: 0%–100% maps to shares; "Max" sells all shares including fractional
- [ ] Dust: max sell works for fractional shares (e.g. 0.001+); no "won't let me sell max"
- [ ] Estimated proceeds = shares × best bid (or orderbook avg)
- [ ] Validation: min shares (e.g. 0.001); max = position size
- [ ] Submit, loading, success, error flows same as buy

### 3.2 Quick Sell Modal

- [ ] Opens from Positions tab or portfolio row (Sell button)
- [ ] Slider: 0–100%; 100% = full position
- [ ] Shares calculation: `floorSharesToChainPrecision`; no oversell
- [ ] Best bid from orderbook (sorted descending); fallback when no orderbook
- [ ] `negRisk` from orderbook when available (avoids invalid signature)
- [ ] Geoblocked: `RestrictedRegionButton` or disabled with message
- [ ] Success: modal closes; positions table updates

### 3.3 Instant Trade Popup (Sell)

- [ ] Sell path uses `executeMarketSell` with `sellPercent`
- [ ] Shares computed from position; validation vs balance

---

## 4. Limit Buy

### 4.1 Order Form (Limit tab)

- [ ] Side = BUY
- [ ] Limit price control: step up/down respects `tickSize`
- [ ] Price snaps to tick (0.01 or 0.001 from orderbook)
- [ ] Size = shares (computed from USD if needed)
- [ ] Quick amounts (25%, 50%, 100%) and slider work
- [ ] Expiration: GTC vs GTD; custom date when GTD
- [ ] Post-only option (if exposed) behaves correctly

### 4.2 Orderbook Click-to-Prefill

- [ ] Click ask row → prefill limit price (and switch to Limit if needed)
- [ ] Click bid row → prefill limit price for sell
- [ ] Prefill clears after form applies it
- [ ] Token ID match: only apply when orderbook token matches form token

### 4.3 Validation & Placement

- [ ] Min order size from CLOB orderbook enforced
- [ ] Price within 0.01–0.99 (or market-specific range)
- [ ] GTD: expiration in future
- [ ] Success: order in Open Orders; fill appears in History/Trades

---

## 5. Limit Sell

- [ ] Same as Limit Buy but side = SELL
- [ ] Size max = position size; slider/quick amounts respect it
- [ ] Orderbook click on bid prefills sell limit price

---

## 6. Split

### 6.1 Order Form (Split tab)

- [ ] Split tab visible when market supports it
- [ ] Explainer: "You'll receive 1 Yes share and 1 No share for each USDC spent"
- [ ] Amount = USDC to split
- [ ] Quick amounts use `cashBalance`; slider 0–100%
- [ ] Min $0.01; max = cash balance
- [ ] NegRisk: uses Neg Risk Adapter for multi-outcome markets

### 6.2 Execution

- [ ] `createSplitTransaction` + RelayClient executes
- [ ] Success: balance and positions refresh (USDC down; Yes+No up)
- [ ] Both Yes and No show in positions shortly after (no long delay)
- [ ] Portfolio: Yes and No shown separately, not duplicated

### 6.3 Error Handling

- [ ] Insufficient balance: clear error
- [ ] Allowance: "Fix Trading" flow
- [ ] Relayer/network errors: user-friendly message

---

## 7. Merge

### 7.1 Order Form (Merge tab)

- [ ] Merge tab visible when `mergeableShares` > 0
- [ ] Explainer: "You'll receive 1 USDC for each pair of shares merged"
- [ ] Amount = full sets to merge (min of Yes, No)
- [ ] Quick amounts use `mergeableShares`; slider 0–100%
- [ ] NegRisk: uses Neg Risk Adapter when applicable

### 7.2 Execution

- [ ] `createMergeTransaction` + RelayClient executes
- [ ] Success: positions and balance refresh
- [ ] No phantom duplicate positions (e.g. two "Yes" rows)

### 7.3 Edge Cases

- [ ] Zero mergeable shares: merge tab disabled or hidden
- [ ] After merge: if position goes to 0, row removed/updated correctly

---

## 8. UX / UI Quality

### 8.1 Design System

- [ ] Buttons: use `Button` from `@/components/ui/button`; no raw `<button>` for CTAs
- [ ] Typography: only `text-3xl`, `text-2xl`, `text-lg`, `text-sm`, `text-xs`, `text-[10px]`
- [ ] Font weights: `font-normal` and `font-medium` only
- [ ] Text colors: `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-muted`
- [ ] Numbers: Inter proportional figures only (no `tabular-nums`; it swaps to tabular glyph shapes in Inter)
- [ ] Doji green (`--doji-green`) for active states, primary actions

### 8.2 Form UX

- [ ] Labels clear (Buy/Sell, Market/Limit, Amount/Shares)
- [ ] Tab order logical; keyboard navigable
- [ ] Focus states visible
- [ ] No nested ternaries or unclear labels in UI

### 8.3 Feedback & Errors

- [ ] Loading: spinner or "Placing Order..." / "Splitting..." / "Merging..."
- [ ] Success: toast with key info (side, amount, outcome)
- [ ] Error: toast with `getTrpcDisplayMessage`-style message (no raw stack traces)
- [ ] Warning before market sell if price below cost (losing money)

### 8.4 Orderbook

- [ ] Real-time updates (WebSocket)
- [ ] Flash/subtle animation on new orders (if implemented)
- [ ] Font: `font-variant-numeric` for alignment
- [ ] Precision matches market (0.01 vs 0.001)

---

## 9. Data Freshness & Consistency

- [ ] After buy: position appears in Positions tab without refresh
- [ ] After sell: position decreases or disappears
- [ ] After split: Yes+No both show; no duplicate "Yes" or "No" rows
- [ ] Shares rounded to 2 decimals in tables (per TODO)
- [ ] Balance/allowance invalidated after orders
- [ ] Activity/History updates for new trades

---

## 10. NegRisk (Multi-Outcome) Markets

- [ ] `negRisk` passed correctly to order placement (from orderbook when available)
- [ ] Split/merge use Neg Risk Adapter
- [ ] Wrong `negRisk` does not cause "invalid signature"

---

## 11. Accessibility

- [ ] Form inputs have labels (including order amount/shares)
- [ ] Error messages associated with inputs
- [ ] Buttons have descriptive labels
- [ ] Focus management in modals (trap, return on close)

---

## 12. Cross-Entry Consistency

| Action        | Order Form       | Instant Trade | Quick Sell Modal |
|---------------|------------------|---------------|------------------|
| Market Buy    | ✓                | ✓             | —                |
| Market Sell   | ✓                | ✓             | ✓                |
| Limit Buy     | ✓                | —             | —                |
| Limit Sell    | ✓                | —             | —                |
| Split         | ✓                | —             | —                |
| Merge         | ✓                | —             | —                |

- [ ] Behavior identical across surfaces (e.g. market sell from form vs Quick Sell)
- [ ] Shared execution logic (`executeMarketBuy`, `executeMarketSell`, `placeLimitOrderClient`, etc.)

---

## Quick Reference — Key Files

| Area            | File(s) |
|-----------------|---------|
| Order form      | `order-form.hooks.ts`, `order-form-ui.tsx` |
| Market execution| `execute-market-order.ts`, `place-order-client.ts` |
| Quick sell      | `quick-sell-modal.tsx` |
| Instant trade   | `instant-trade-popup.tsx` |
| Split/merge     | `use-split-merge.ts`, `split-merge-txs.ts` |
| Orderbook       | `orderbook.tsx`, `use-orderbook.ts`, `orderbook.ts` (store) |
| Geoblock        | `use-geoblock.ts`, `RestrictedRegionButton` |
