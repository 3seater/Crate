# On-Chain Dust Cleanup Guide

How to merge and redeem Polymarket positions directly on Polygon when Doji/Polymarket UIs fail.

---

## Contract Addresses (Polygon)

| Contract | Address |
|----------|---------|
| **CTF** (binary markets) | `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` |
| **Neg Risk Adapter** (multi-outcome markets) | `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296` |
| **USDC.e** | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |

---

## 1. Merge (Yes + No → USDC)

**Use when:** You have **both** Yes and No tokens for the same market. Burns them and returns USDC.e.

### Binary markets (standard CTF)

```
Contract: 0x4D97DCd97eC945f40cF65F87097ACe5EA0476045
Function: mergePositions
```

| Param | Type | Value |
|-------|------|-------|
| collateralToken | address | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| parentCollectionId | bytes32 | `0x0000000000000000000000000000000000000000000000000000000000000000` |
| conditionId | bytes32 | Your market's condition ID (0x-prefixed, 32 bytes) |
| partition | uint256[] | `[1, 2]` |
| amount | uint256 | Shares in 6 decimals (e.g. `1000000` = 1 share) |

**Amount:** `shares * 1e6`. Example: 0.01 shares = `10000`.

### Neg-risk markets (multi-outcome)

```
Contract: 0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296
Function: mergePositions
```

| Param | Type | Value |
|-------|------|-------|
| conditionId | bytes32 | Your market's condition ID |
| amount | uint256 | Shares in 6 decimals |

---

## 2. Redeem (resolved markets)

**Use when:** Market has **resolved**. Burns all tokens; winning outcome pays $1/share, losing pays $0.

### Binary markets

```
Contract: 0x4D97DCd97eC945f40cF65F87097ACe5EA0476045
Function: redeemPositions
```

| Param | Type | Value |
|-------|------|-------|
| collateralToken | address | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| parentCollectionId | bytes32 | `0x0000000000000000000000000000000000000000000000000000000000000000` |
| conditionId | bytes32 | Your market's condition ID |
| indexSets | uint256[] | `[1, 2]` |

### Neg-risk markets

```
Contract: 0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296
Function: redeemPositions
```

| Param | Type | Value |
|-------|------|-------|
| conditionId | bytes32 | Your market's condition ID |
| amounts | uint256[] | Per-outcome amounts in 6 decimals (e.g. `[yesAmount, noAmount]`) |

---

## How to Execute

### A. Polygonscan Write Contract (EOA or proxy wallet)

1. Go to [Polygonscan Contract](https://polygonscan.com/address/0x4D97DCd97eC945f40cF65F87097ACe5EA0476045#writeContract)
2. Connect the wallet that holds the tokens (your funder/Safe owner)
3. Find `mergePositions` or `redeemPositions`, fill params, click Write
4. Approve and pay gas

**If your trading address is a Gnosis Safe:** Use Safe UI (app.safe.global) → New Transaction → Contract Interaction → paste the contract address, select function, enter params. The Safe executes the call.

### B. Foundry `cast send` (EOA or proxy wallet only)

Binary merge example:

```bash
# Replace <CONDITION_ID> with your market's condition ID (0x-prefixed hex, 66 chars)
# Amount: 0.01 shares = 10000 (6 decimals)
cast send 0x4D97DCd97eC945f40cF65F87097ACe5EA0476045 \
  "mergePositions(address,bytes32,bytes32,uint256[],uint256)" \
  0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174 \
  0x0000000000000000000000000000000000000000000000000000000000000000 \
  <CONDITION_ID> \
  "[1,2]" \
  10000 \
  --rpc-url https://polygon-rpc.com \
  --private-key $PRIVATE_KEY
```

**Note:** For Gnosis Safe, use the Safe UI (below); `cast send` signs from an EOA, not the Safe.

### C. Node/ts script (viem)

```typescript
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { polygon } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const CTF = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045" as const;
const USDC_E = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174" as const;
const PARENT = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

const conditionId = "0x..."; // your market condition ID
const amountWei = parseUnits("0.01", 6); // 0.01 shares

const hash = await walletClient.writeContract({
  address: CTF,
  abi: [{
    name: "mergePositions",
    type: "function",
    inputs: [
      { name: "collateralToken", type: "address" },
      { name: "parentCollectionId", type: "bytes32" },
      { name: "conditionId", type: "bytes32" },
      { name: "partition", type: "uint256[]" },
      { name: "amount", type: "uint256" },
    ],
  }],
  functionName: "mergePositions",
  args: [USDC_E, PARENT, conditionId as `0x${string}`, [1n, 2n], amountWei],
});
```

---

## Getting condition IDs

1. **From Doji:** Open market → devtools/network → tRPC `data.positions` or `clob.getOrderBook` → response includes `conditionId` or `condition_id`.
2. **From Polymarket:** Market URL or API `GET /markets` → `condition_id`.
3. **From Polygonscan:** Look at your ERC1155 token transfers for the CTF address; token IDs encode condition/collection.

---

## One-sided dust (only Yes OR only No)

**There is no on-chain function to burn one-sided dust.** The CTF only supports:

- **Merge** — requires 1 Yes + 1 No (full set)
- **Redeem** — requires a resolved market; burns all tokens (winning pays, losing = $0)

If you hold only 0.01 Yes or only 0.01 No and the market is open:

- You cannot merge (need both sides).
- You cannot redeem (market not resolved).
- CLOB may reject sells below min order size.

**Options:** Wait for resolution and redeem (losing tokens burn for $0; winning redeem for $1), or leave as untradeable dust.

---

## Gnosis Safe

If you trade from a Safe (Doji Builder Program flow):

1. Use [Safe Wallet](https://app.safe.global) (or your Safe admin UI).
2. Create Transaction → Contract Interaction.
3. Contract: `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045` (or Neg Risk Adapter for neg-risk).
4. Method: `mergePositions` or `redeemPositions`.
5. ABI and params: use the tables above.
6. Submit and sign (single owner or multisig).

# Dust & Position Mismatch — Debug Guide

## The Problem

You may see:

- **Polymarket frontend**: No shares, "bought 3.4, sold 3.4"
- **Doji Positions tab**: No positions
- **Doji Order form**: Shows 0.01 shares available to sell
- **CLOB error**: "invalid amounts, maker and taker amount must be higher than 0"

## Root Causes

### 1. Different Data Sources

| Component      | Source                      | Behavior |
|----------------|-----------------------------|----------|
| **Order form** | `ctfTokenBalances` (on-chain) | Uses RPC `balanceOf` — always has latest balance |
| **Positions tab** | Data API `/positions` + `ctfTokenBalances` | API filters by `sizeThreshold`; we now also include chain-only |
| **Polymarket UI** | Polymarket’s own indexing | May round or hide small positions |

### 2. Dust Creation

Dust is created when a 100% sell doesn’t exactly match the on-chain balance:

- **Buy rounding**: You buy 3.41 shares (rounded up or different precision).
- **Sell rounding**: You sell 3.4 (display rounded); actual balance is ~0.009835.
- **Result**: ~0.01 shares left on-chain that the CLOB may reject.

### 3. Polymarket’s Approach

Polymarket’s UI likely avoids dust by:

- Selling the exact on-chain balance for “100% sell”
- Not letting users enter amounts that would leave dust
- Hiding or rounding positions below a display threshold

### 4. CLOB Minimum

- Limit orders: Often `min_order_size` = 5 shares.
- Market FOK/FAK: Smaller amounts may work, but `makerAmount` and `takerAmount` must both be > 0.
- Raw units: 6 decimals; `1 unit = 1e-6` shares. Amounts that round to 0 cause “invalid amounts”.

## How We Fix It

1. **Hide dust (Polymarket-aligned)** — Positions with size < 0.01 shares are hidden everywhere (order form, positions tab, watchlist). Uses `DUST_DISPLAY_THRESHOLD = 0.01`. Matches Polymarket's `sizeThreshold: 0.01`. Dust remains on-chain but is never shown; UX is identical to Polymarket.
2. **100% sell uses exact balance** — When a position is shown, `formatSharesExact` floors to chain precision; we cap at `effectiveBalance` on submit.
3. **Guard before submit** — Orders that would produce 0 raw maker/taker amounts are rejected with a clear error.

## Debugging Steps

### 1. Compare balances

Open DevTools → Network and inspect:

- `ctfTokenBalances` (tRPC) — raw on-chain balance per token
- `positions` (tRPC) — Data API positions for the market

### 2. Check what the order form receives

`positionSize` in the order form comes from `positionSizeForToken(tokenId)`:

- First: `onChainBalances[tokenId]`
- Fallback: `positions.find(p => p.asset === tokenId)?.size`

### 3. Verify on-chain

Use Polygonscan and the CTF contract:

- Contract: `0xC5d563A36AE78145C45a50134d48A1215220f80a` (NegRisk) or `0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E` (binary)
- Call `balanceOf(safeAddress, tokenId)` to confirm balance.

### 4. When dust is unsellable

If the CLOB rejects dust (< 0.001 shares or amounts that round to 0):

- It cannot be sold via the CLOB API.
- It can remain until the market resolves (redeem if you hold the winning side).
- Or it stays as untradeable dust.

## Preventing Dust

- Always use exact balance for 100% sell (no display rounding in the submitted amount).
- Floor, never round up, when formatting shares.
- Cap sell size to `effectiveBalance` before submitting.
- Consider a “dust warning” when a 100% sell would leave < 0.001 shares.
