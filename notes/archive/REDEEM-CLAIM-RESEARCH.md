# Position Redemption (Claim) — Research Summary

## Problem

When a market resolves and the user holds **winning** outcome tokens, the position remains in "Active Positions" with a "Sell" button. Selling is not possible for resolved markets (orderbook is closed). The user needs to **claim/redeem** their winning tokens for USDC.e ($1 per share).

## Detection: When Is a Position Claimable?

The **Data API** `GET /positions` returns a `redeemable` boolean on each position:

- `redeemable: true` — Market is resolved, user holds winning tokens, can redeem
- `redeemable: false` — Either market not resolved, or user holds losing tokens (no payout)

**Position schema** (`apps/server/src/lib/polymarket/schemas/data.ts`):

```ts
redeemable: z.boolean().optional(),
mergeable: z.boolean().optional(),
```

**Data API** supports filtering: `redeemable: true` to fetch only claimable positions.

## How Redemption Works

1. **CTF contract** — `redeemPositions(collateralToken, parentCollectionId, conditionId, indexSets)`
   - Burns winning tokens and returns USDC.e at $1 per share
   - Losing tokens burn for $0
   - Binary markets: `indexSets = [1, 2]` (both YES and NO; only winning pays)

2. **Contract addresses** (Polygon):
   - CTF: `0x4D97DCd97eC945f40cF65F87097ACe5EA0476045`
   - USDC.e: `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174`
   - parentCollectionId: `0x0000...0000` (32 zero bytes) for standard Polymarket markets

3. **Negative risk (multi-outcome) markets** — Use different contracts:
   - NEG_RISK_ADAPTER: `0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296`
   - NEG_RISK_CTF_EXCHANGE: `0xC5d563A36AE78145C45a50134d48A1215220f80a`
   - Position has `negativeRisk: boolean` to detect

## Execution: RelayClient (Gasless)

Polymarket’s Builder Relayer supports **redeem** as a gasless CTF operation. Same flow as Safe deploy and token approvals.

From [Gasless Transactions](https://docs.polymarket.com/developers/builders/relayer-client):

```typescript
import { encodeFunctionData } from "viem";

const redeemTx = {
  to: CTF_ADDRESS,
  data: encodeFunctionData({
    abi: [{
      name: "redeemPositions",
      type: "function",
      inputs: [
        { name: "collateralToken", type: "address" },
        { name: "parentCollectionId", type: "bytes32" },
        { name: "conditionId", type: "bytes32" },
        { name: "indexSets", type: "uint256[]" },
      ],
      outputs: [],
    }],
    functionName: "redeemPositions",
    args: [
      "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC.e
      "0x0000000000000000000000000000000000000000000000000000000000000000", // parentCollectionId
      conditionId, // from position.conditionId
      [1, 2],     // binary: both outcomes
    ],
  }),
  value: "0",
};

const response = await relayerClient.execute([redeemTx], "Redeem positions");
await response.wait();
```

**Note:** For neg-risk markets, redeem may use a different path (adapter). Standard binary markets use the CTF address above.

## Implementation Plan

### 1. Position table (`position-table.tsx`)

- **Condition:** `position.redeemable === true` → show "Claim" instead of "Sell".
- **Action:** Call redeem flow on click (disabled if `redeemable` is false or `size <= 0`).
- **Selling:** Keep "Sell" for non-redeemable positions (open markets).

### 2. Redeem flow (client-side, like deploy)

**Option A: New hook `useRedeemPositions`**

- Similar to `useDeploySafe`: Magic signer + RelayClient + remote Builder signing.
- Inputs: `conditionId`, optional `negativeRisk`.
- Output: `redeem(conditionId) => Promise<void>` plus loading/error state.

**Option B: Utility + inline flow**

- `createRedeemTransaction(conditionId, negativeRisk)` — returns tx for `relayerClient.execute`.
- Call from position table via a shared redeem handler that constructs RelayClient and runs the tx.

### 3. RelayClient setup

Reuse the same pattern as `useDeploySafe`:

```ts
const relayerClient = new RelayClient(
  RELAYER_URL,
  POLYGON_CHAIN_ID,
  signer,
  builderConfig, // remoteBuilderConfig: { url: signingEndpoint }
);
const response = await relayerClient.execute([redeemTx], "Redeem winning tokens");
await response.wait();
```

### 4. Neg-risk markets

- Check `position.negativeRisk` or market `neg_risk`.
- If true, confirm correct contract and redeem encoding for neg-risk (may differ from standard CTF).

### 5. Post-redeem

- Invalidate `trpc.data.positions` and `trpc.data.value` so portfolio updates.
- Optionally show a success toast.

## Existing Code References

| File | Relevance |
|------|-----------|
| `apps/web/src/components/portfolio/position-table.tsx` | Renders positions; "Sell" button; needs Claim path |
| `apps/web/src/hooks/use-deploy-safe.ts` | RelayClient usage for gasless tx |
| `packages/api/src/lib/approval-txs.ts` | CTF_ADDRESS, USDC_E, tx encoding style |
| `apps/server/src/lib/check-approval-status.ts` | Contract addresses |
| `docs/POLYMARKET.md` (Redeeming After Resolution) | redeemPositions example |
| [docs.polymarket.com/developers/builders/relayer-client](https://docs.polymarket.com/developers/builders/relayer-client) | Redeem via RelayClient |
| [docs.polymarket.com/developers/CTF/redeem](https://docs.polymarket.com/developers/CTF/redeem) | redeemPositions params |

## Open Questions

1. **Neg-risk redeem** — Exact flow/encoding for multi-outcome markets (indexSets, adapter vs CTF).
2. **Multiple positions same condition** — Redeem burns *all* tokens for that condition. A single redeem covers all winning shares for that market.
3. **Transaction from Safe** — RelayClient with Safe type uses the user’s signer (Magic EOA) as Safe owner; relayer submits the tx and the Safe executes it.

---

## Troubleshooting: Redeem Shows 0 Shares / $0 in Activity

When a REDEEM appears in activity history with `size: 0` and `usdcSize: 0`, the transaction succeeded on-chain but no tokens were actually redeemed. Possible causes:

### 1. Zero winning tokens (most likely)

- **Cause:** `redeemPositions()` burns your *entire* token balance for the condition. If you held only **losing** tokens (e.g. No when Yes won), the call succeeds but transfers $0.
- **Cause:** You had already redeemed that market; a second redeem is a no-op.
- **Check:** Before claiming, confirm the position shows `redeemable: true` and `size > 0`. The Data API only marks `redeemable` for winning positions.

### 2. Wrong wallet / address mismatch

- **Cause:** Activity is indexed by **proxy wallet** (Safe for Builder/Doji users). If you traded on Polymarket.com with a different proxy, our app shows activity for your Safe, which may have different positions.
- **Check:** Ensure positions and activity are queried with the same address (`safeAddress` for Builder users).

### 3. Neg-risk market (FIXED)

- **Cause:** Neg-risk (multi-outcome) events use one condition with N outcome slots. Standard `indexSets [1, 2]` only covers binary; for N outcomes we need `[1, 2, 4, 8, ..., 2^(N-1)]`.
- **Fix:** When `negativeRisk: true`, we fetch `data.getEventOutcomeCount` (event slug or conditionId) and pass `outcomeSlotCount` to `createRedeemTransaction`. The tx uses the full partition for the condition.

### 4. Polymarket Data API indexing

- **Cause:** The Data API sometimes returns `size: 0` and `usdcSize: 0` for REDEEM events even when the on-chain transfer was non-zero (indexing delay or bug).
- **Check:** If Polymarket.com also shows 0 for the same redeem, it is likely an API/indexing issue. If Polymarket.com shows correct values, compare request params (user address, etc.).

### 5. ConditionId format

- **Cause:** Wrong `conditionId` encoding could cause the contract to operate on a different (empty) condition.
- **Check:** `conditionId` from the Data API should be 0x-prefixed 32-byte hex. Our `toBytes32()` normalizes this; verify the position `conditionId` matches the market on-chain condition.
