# Withdraw Flow UX Audit

Full audit of Doji's withdrawal flow vs Polymarket's native withdraw UI and the Bridge API.

## Polymarket Native Withdraw UX (Reference)

| Element | Polymarket |
|---------|------------|
| Recipient address | Input field with **"Use connected"** (MetaMask icon) to auto-fill connected wallet |
| Amount | Input with **Max** button; shows "$X.XX" and "Balance: X USDC" |
| Receive token | Dropdown (USDC, etc.) |
| Receive chain | Dropdown (Polygon, Ethereum, etc.) |
| Summary | **"You will receive"** — estimated amount after fees (e.g. 9.98618 USDC $9.99) |
| Fee breakdown | **"Transaction breakdown"** — expandable, shows 0.08% fee |
| Primary action | Single **"Withdraw"** button — one click, one sign, done |

**Polymarket flow:** User fills form → clicks **Withdraw** → signs once → funds are sent and bridge processes. No manual "generate address" or copying.

---

## Doji Current Withdraw Flow

| Element | Doji |
|---------|------|
| Recipient address | Input with **"Use connected"** button |
| Amount | Input with **Max** button; shows "Available: $X" |
| Receive token/chain | `BridgeAssetSelect` — Token + Network dropdowns |
| Summary | **"You will receive"** — quote + expandable fee breakdown |
| Fee breakdown | **WithdrawQuoteBreakdown** — network cost, price impact, max slippage, app fee, fill cost, total impact, min received |
| Primary action | **"Withdraw"** — one-click (RelayClient transfer) or fallback to show address |
| Post-click | Magic: transfer executes → "Track status". No Magic: show address → user sends manually → "Track status" |

**Doji flow:** Form → **Withdraw** → (one-click transfer when Magic available) → Track status. Fallback: show address for manual send.

---

## Gap Analysis

### 1. Button Label & Flow

| Issue | Polymarket | Doji |
|-------|------------|------|
| Primary action | "Withdraw" — implies single action | "Generate Address" — unclear; suggests extra step |
| User expectations | One-click withdraw | Two-step: generate, then send manually |

**Root cause:** The Bridge API `POST /withdraw` returns a **deposit address** for the user to send TO. Polymarket likely:

- Calls the same Bridge API internally
- Immediately triggers a Safe/Proxy transaction to transfer USDC.e to that address
- User signs once; the app handles both steps

**Recommendation:** Implement **one-click Withdraw** — when user clicks "Withdraw":

1. Call `bridge.withdraw` to get send-to address
2. Create ERC-20 `transfer(to, amount)` transaction
3. Execute via RelayClient (gasless)
4. User signs once
5. Show "Track status"

This matches Polymarket's UX.

### 2. Recipient — "Use Connected"

| Issue | Polymarket | Doji |
|-------|------------|------|
| Recipient UX | "Use connected" fills wallet address | Manual paste only |

**Recommendation:** Add a "Use connected" button next to the recipient input that fills `safeAddress || address`. Useful for withdrawing to your own address on another chain.

### 3. Amount Field

| Issue | Polymarket | Doji |
|-------|------------|------|
| Max button | ✅ | ❌ |
| Balance display | "Balance: X USDC" | "Available: $X" |

**Recommendation:** Add **Max** button to fill available balance.

### 4. Quote & Fee Estimate

| Issue | Polymarket | Doji |
|-------|------------|------|
| "You will receive" | ✅ Shows net amount | ❌ |
| Fee breakdown | ✅ Expandable (0.08%) | ❌ |
| Quote API | Used | Exists (`bridge.quote`) but not called |

**Recommendation:** Call `bridge.quote` when amount/destination changes; show "You will receive ~$X.XX" and optional fee breakdown. Improves trust and matches Polymarket.

### 5. Field Order

Polymarket: Recipient → Amount → Receive token → Receive chain  
Doji: Token + Network (top) → Recipient → Amount

**Recommendation:** Consider aligning order: Recipient → Amount → Token/Network. Minor; current order is workable.

---

## Bridge API Constraints

The Bridge API **POST /withdraw** does **not** take an amount:

```ts
// Current params
{ address, toChainId, toTokenAddress, recipientAddr }
```

The amount is determined by what the user sends to the generated address. So:

- We **can** implement one-click: generate address → execute transfer(to, amount) → done
- The bridge receives the exact amount we send; it routes to `recipientAddr` on the destination chain

---

## Implementation Checklist

### Phase 1 — Quick wins (no RelayClient changes)

- [x] Add **"Use connected"** button for recipient field
- [x] Add **Max** button for amount
- [x] Rename button: "Generate Address" → **"Withdraw"** (one-click implemented)
- [ ] Add helper text: "You'll send USDC.e from your Safe to a bridge address. Funds will then be delivered to the recipient." (optional)

### Phase 2 — One-click Withdraw (Polymarket parity)

- [x] Create `createTransferTransaction(to, amountBaseUnits)` in `packages/api` (`createUsdcTransferTransaction` in `transfer-txs.ts`)
- [x] On "Withdraw" click: call `bridge.withdraw` → get address → create transfer tx → `RelayClient.execute()`
- [x] Change button label to **"Withdraw"**
- [x] Keep "show-address" step as fallback when RelayClient fails or no Magic
- [x] Go directly to "Track status" after successful execution

### Phase 3 — Quote & estimates

- [x] Call `bridge.quote` when amount, recipient, token, network are valid
- [x] Display "You will receive" with amount and USD (from `estOutputUsd`)
- [x] Expandable "Transaction breakdown" with `estFeeBreakdown` (network cost, price impact, max slippage, app fee, fill cost, total impact, min received)

---

## Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/components/bridge/withdraw-flow.tsx` | Use connected, Max, button label, one-click flow, quote display |
| `packages/api/src/lib/transfer-txs.ts` | **New** — `createTransferTransaction(to, amountBaseUnits)` for USDC.e |
| `apps/web/src/hooks/use-withdraw.ts` | **New** (optional) — encapsulate withdraw logic with RelayClient |

---

## References

- [BRIDGE-AUDIT.md](./BRIDGE-AUDIT.md) — Bridge API alignment
- [Polymarket Bridge API](https://docs.polymarket.com/api-reference/bridge/create-withdrawal-addresses)
- `apps/server/src/lib/polymarket/bridge.ts` — `createWithdrawalAddresses`, `getQuote`
