# 08 — Dependency Migrations

> **Phase 5** · Risk: Medium · Status: 🔴 Not started
>
> Three dependency migrations: ethers v5 → viem, date-fns → Temporal, nuqs adoption.
> ethers is the only high-effort migration; the other two are small or optional.

## Current State (2026-05-02 survey)

| Dependency | Files | Bundle impact | Effort |
|-----------|-------|--------------|--------|
| ethers v5 | 18 (10 full + 8 type-only) | ~1.7 MB removable | 2–3 weeks |
| date-fns | 3 | ~5 KB (tree-shaken) | 1 day or skip |
| nuqs | 3 candidates | +12 KB (new) | 2 days |

---

## Section 1: ethers v5 → viem

viem is already a transitive dependency (pinned `2.47.16` in root `package.json` overrides). Migrating removes ethers (~1.7 MB across `ethers`, `@ethersproject/providers`, `@ethersproject/wallet`) and unifies on a single EVM library.

### 1a. API Mapping Table

| ethers v5 | viem | Notes |
|-----------|------|-------|
| `new ethers.Contract(addr, abi, provider)` | `getContract({ address, abi, client })` | viem uses typed ABIs — define as `const abi = [...] as const` |
| `new ethers.providers.JsonRpcProvider(url)` | `createPublicClient({ transport: http(url) })` | Read-only; for signing use `createWalletClient` |
| `ethers.BigNumber.from(x)` | `BigInt(x)` | Native BigInt; no library needed |
| `ethers.constants.MaxUint256` | `maxUint256` from `viem` | `import { maxUint256 } from "viem"` |
| `new ethers.utils.Interface(abi)` | `encodeFunctionData` / `decodeFunctionResult` | No Interface object; encode/decode directly |
| `iface.encodeFunctionData("fn", args)` | `encodeFunctionData({ abi, functionName, args })` | Import from `viem` |
| `ethers.utils.parseUnits(val, dec)` | `parseUnits(val, dec)` | Same name — `import { parseUnits } from "viem"` |
| `ethers.utils.formatUnits(val, dec)` | `formatUnits(val, dec)` | Same name — `import { formatUnits } from "viem"` |
| `ethers.utils.hexZeroPad(hex, 32)` | `pad(hex, { size: 32 })` | `import { pad } from "viem"` |
| `ethers.utils.solidityPack(types, vals)` | `encodePacked(types, vals)` | `import { encodePacked } from "viem"` |
| `ethers.utils.keccak256(data)` | `keccak256(data)` | Same name — `import { keccak256 } from "viem"` |
| `ethers.utils.id(str)` | `keccak256(toBytes(str))` | `import { keccak256, toBytes } from "viem"` |
| `ethers.utils.verifyMessage(msg, sig)` | `verifyMessage({ message, signature })` | Returns `address`; `import { verifyMessage } from "viem"` |
| `ethers.utils.getAddress(addr)` | `getAddress(addr)` | Same name — `import { getAddress } from "viem"` |
| `ethers.utils.hexDataSlice(data, offset)` | `slice(data, offset)` | `import { slice } from "viem"` |
| `new Web3Provider(provider)` | `createWalletClient({ transport: custom(provider) })` | For browser wallets (Magic, MetaMask) |
| `provider.getSigner(addr)` | `walletClient` (is the signer) | viem WalletClient = signer |
| `JsonRpcSigner` (type) | `WalletClient` or `Account` | **SDK blocker** — see §1c |
| `Wallet` (type) | `WalletClient` or `PrivateKeyAccount` | `import { privateKeyToAccount } from "viem/accounts"` |
| `provider.getBlockNumber()` | `client.getBlockNumber()` | Returns `bigint` in viem |
| `provider.getBlock(n)` | `client.getBlock({ blockNumber: BigInt(n) })` | |
| `contract.queryFilter(filter, from, to)` | `client.getLogs({ address, event, fromBlock, toBlock })` | No filter objects; pass params directly |
| `contract.filters.Transfer(...)` | Event ABI + topics in `getLogs` | viem handles topic encoding |

### 1b. File-by-File Migration

#### Group A: Server on-chain reads (no SDK dependency)

**1. `apps/server/src/shared/onchain/balance.ts`**

Current imports:
```ts
import { ethers } from "ethers";
```

APIs used: `ethers.providers.JsonRpcProvider`, `ethers.Contract`, `ethers.BigNumber.from`, `ethers.utils.formatUnits`, `ethers.utils.getAddress`, `ethers.utils.hexDataSlice`

New imports:
```ts
import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  parseAbiItem,
  slice,
} from "viem";
import { polygon } from "viem/chains";
```

Key changes:
```ts
// Before
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const contract = new ethers.Contract(CONTRACTS.PUSD, ERC20_ABI, provider);
const balance = await contract.balanceOf(address);
return balance.toString();

// After
const client = createPublicClient({ chain: polygon, transport: http(rpcUrl) });
const balance = await client.readContract({
  address: CONTRACTS.PUSD as `0x${string}`,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [address as `0x${string}`],
});
return balance.toString();
```

```ts
// Before
const ids = tokenIds.map((id) => ethers.BigNumber.from(id));
const rawNum = ethers.BigNumber.from(raw[i]);
out[tokenId] = Number.parseFloat(ethers.utils.formatUnits(rawNum.toString(), USDC_DECIMALS));

// After
const ids = tokenIds.map((id) => BigInt(id));
out[tokenId] = Number.parseFloat(formatUnits(raw[i], USDC_DECIMALS));
```

```ts
// Before (parseTransferLogAddresses)
const from = ethers.utils.getAddress(ethers.utils.hexDataSlice(topicFrom, 12)).toLowerCase();

// After
const from = getAddress(slice(topicFrom as `0x${string}`, 12)).toLowerCase();
```

ABI format change — use typed const ABIs:
```ts
// Before
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
];

// After
const ERC20_ABI = [
  { type: "function", name: "balanceOf", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
] as const;
```

Note: The `withPolygonRpcFallback` helper changes signature from `(label, fn: (provider) => T)` to `(label, fn: (client) => T)` where client is a `PublicClient`. The `fetchIndexedPartyUsdcTransfersWithProvider` function replaces `contract.queryFilter` with `client.getLogs`.

---

**2. `apps/server/src/shared/onchain/check-approval-status.ts`**

Current imports:
```ts
import { ethers } from "ethers";
```

APIs used: `ethers.providers.JsonRpcProvider`, `ethers.Contract` (×3), `ethers.constants.MaxUint256`

New imports:
```ts
import { createPublicClient, http, maxUint256 } from "viem";
import { polygon } from "viem/chains";
```

Key changes:
```ts
// Before
const MAX_UINT256 = ethers.constants.MaxUint256;
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const pusd = new ethers.Contract(CONTRACTS.PUSD, ERC20_ABI, provider);
const [pusdAllowances, ...] = await Promise.all([
  Promise.all(pusdSpenders.map((s) => pusd.allowance(safeAddress, s))),
]);
if (pusdAllowances[i].lt(MAX_UINT256)) { ... }

// After
const client = createPublicClient({ chain: polygon, transport: http(rpcUrl) });
const pusdAllowances = await Promise.all(
  pusdSpenders.map((s) =>
    client.readContract({
      address: CONTRACTS.PUSD as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [safeAddress as `0x${string}`, s as `0x${string}`],
    })
  )
);
if (pusdAllowances[i] < maxUint256) { ... }  // native BigInt comparison
```

---

**3. `apps/server/src/features/trading/lib/uma-propose-url.ts`**

Current imports:
```ts
import { ethers } from "ethers";
```

APIs used: `ethers.utils.id`, `ethers.providers.JsonRpcProvider`, `ethers.Contract`

New imports:
```ts
import { createPublicClient, http, keccak256, toBytes } from "viem";
import { polygon } from "viem/chains";
```

Key changes:
```ts
// Before
const QUESTION_INITIALIZED_TOPIC = ethers.utils.id(
  "QuestionInitialized(bytes32,uint256,address,bytes,address,uint256,uint256)"
);

// After
const QUESTION_INITIALIZED_TOPIC = keccak256(
  toBytes("QuestionInitialized(bytes32,uint256,address,bytes,address,uint256,uint256)")
);
```

---

**4. `apps/server/src/features/auth/router.ts`**

Current usage (dynamic import):
```ts
const ethers = await import("ethers");
ethers.utils.verifyMessage(message, input.signature);
// ...
const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
const safeContract = new ethers.Contract(addr, abi, provider);
```

New imports (top-level):
```ts
import { createPublicClient, http, verifyMessage } from "viem";
import { polygon } from "viem/chains";
```

Key changes:
```ts
// Before
const ethers = await import("ethers");
const recovered = ethers.utils.verifyMessage(message, input.signature);

// After
const recovered = await verifyMessage({
  message,
  signature: input.signature as `0x${string}`,
});
```

Note: `verifyMessage` in viem is async (returns a Promise). The ethers version is sync.


#### Group B: Web transaction builders (no SDK dependency)

These files only use `ethers.utils.Interface`, `parseUnits`, `hexZeroPad`, `solidityPack`, `keccak256`, and `MaxUint256` — no signers or providers. Straightforward migration.

**5. `apps/web/src/features/auth/lib/approval-txs.ts`**

Current imports:
```ts
import { ethers } from "ethers";
```

APIs used: `ethers.utils.Interface`, `ethers.constants.MaxUint256`

New imports:
```ts
import { encodeFunctionData, maxUint256 } from "viem";
```

Key changes:
```ts
// Before
const approveInterface = new ethers.utils.Interface(erc20ApproveAbi);
function createErc20ApprovalTransaction(tokenAddress: string, spenderAddress: string): Transaction {
  const data = approveInterface.encodeFunctionData("approve", [spenderAddress, ethers.constants.MaxUint256]);
  return { to: tokenAddress, data, value: "0" };
}

// After
const erc20ApproveAbi = [
  { type: "function", name: "approve", inputs: [{ name: "_spender", type: "address" }, { name: "_value", type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

function createErc20ApprovalTransaction(tokenAddress: string, spenderAddress: string): Transaction {
  const data = encodeFunctionData({
    abi: erc20ApproveAbi,
    functionName: "approve",
    args: [spenderAddress as `0x${string}`, maxUint256],
  });
  return { to: tokenAddress, data, value: "0" };
}
```

---

**6. `apps/web/src/features/bridge/lib/transfer-txs.ts`**

Current imports:
```ts
import { ethers } from "ethers";
```

APIs used: `ethers.utils.Interface`, `ethers.utils.parseUnits`

New imports:
```ts
import { encodeFunctionData, parseUnits } from "viem";
```

Key changes:
```ts
// Before
const transferInterface = new ethers.utils.Interface(ERC20_TRANSFER_ABI);
const amountBaseUnits = ethers.utils.parseUnits(amountUsd.toFixed(USDC_DECIMALS), USDC_DECIMALS);
const data = transferInterface.encodeFunctionData("transfer", [to, amountBaseUnits]);

// After
const amountBaseUnits = parseUnits(amountUsd.toFixed(USDC_DECIMALS) as `${number}`, USDC_DECIMALS);
const data = encodeFunctionData({
  abi: ERC20_TRANSFER_ABI,
  functionName: "transfer",
  args: [to as `0x${string}`, amountBaseUnits],
});
```

---

**7. `apps/web/src/features/bridge/lib/wrap-txs.ts`**

Current imports:
```ts
import { ethers } from "ethers";
```

APIs used: `ethers.utils.Interface` (×2), `ethers.utils.parseUnits` (×2)

New imports:
```ts
import { encodeFunctionData, parseUnits } from "viem";
```

Same pattern as transfer-txs — replace `Interface` + `encodeFunctionData` with viem's `encodeFunctionData`, replace `ethers.utils.parseUnits` with viem's `parseUnits`.

---

**8. `apps/web/src/features/portfolio/lib/redeem-txs.ts`**

Current imports:
```ts
import { ethers } from "ethers";
```

APIs used: `ethers.utils.Interface`, `ethers.utils.hexZeroPad`

New imports:
```ts
import { encodeFunctionData, pad } from "viem";
```

Key changes:
```ts
// Before
function toBytes32(conditionId: string): string {
  const hex = conditionId.startsWith("0x") ? conditionId : `0x${conditionId}`;
  return ethers.utils.hexZeroPad(hex, 32);
}

// After
function toBytes32(conditionId: string): `0x${string}` {
  const hex = (conditionId.startsWith("0x") ? conditionId : `0x${conditionId}`) as `0x${string}`;
  return pad(hex, { size: 32 });
}
```

---

**9. `apps/web/src/features/trading/lib/split-merge-txs.ts`**

Current imports:
```ts
import { ethers } from "ethers";
```

APIs used: `ethers.utils.Interface` (×2), `ethers.utils.hexZeroPad`, `ethers.utils.parseUnits`

New imports:
```ts
import { encodeFunctionData, pad, parseUnits } from "viem";
```

Same patterns as redeem-txs (pad) and transfer-txs (encodeFunctionData + parseUnits).

---

**10. `apps/web/src/features/trading/lib/resolution/get-resolver-address.ts`**

Current imports:
```ts
import { ethers } from "ethers";
```

APIs used: `ethers.utils.solidityPack`, `ethers.utils.keccak256`

New imports:
```ts
import { encodePacked, keccak256 } from "viem";
```

Key changes:
```ts
// Before
function computeConditionId(oracle: `0x${string}`, questionId: `0x${string}`, outcomeSlotCount = 2): string {
  const packed = ethers.utils.solidityPack(
    ["address", "bytes32", "uint256"],
    [oracle, questionId, outcomeSlotCount]
  );
  return normalizeConditionId(ethers.utils.keccak256(packed));
}

// After
function computeConditionId(oracle: `0x${string}`, questionId: `0x${string}`, outcomeSlotCount = 2): string {
  const packed = encodePacked(
    ["address", "bytes32", "uint256"],
    [oracle, questionId, BigInt(outcomeSlotCount)]
  );
  return normalizeConditionId(keccak256(packed));
}
```

---

**11. `apps/web/src/layout/header-wrap-button.tsx`** and **12. `apps/web/src/features/bridge/hooks/use-auto-wrap.ts`**

These use `ethers.providers.JsonRpcProvider`, `ethers.Contract`, and `ethers.utils.formatUnits` for reading USDC.e balance on Polygon.

New imports:
```ts
import { createPublicClient, formatUnits, http } from "viem";
import { polygon } from "viem/chains";
```

Same pattern as server balance.ts — replace `new Contract` + `balanceOf` with `client.readContract`.


#### Group C: Auth/Magic signer files (SDK dependency — blocked)

These files depend on `@ethersproject/providers` types (`JsonRpcSigner`, `Web3Provider`) because the Polymarket CLOB SDK (`@polymarket/clob-client-v2`) requires them in its constructor signature.

**13. `apps/web/src/features/auth/lib/magic/signer.ts`**

Current imports:
```ts
import { Web3Provider } from "@ethersproject/providers";
```

Target (post-SDK-update):
```ts
import { createWalletClient, custom } from "viem";
import { polygon } from "viem/chains";
```

```ts
// Before
const provider = new Web3Provider(magic.rpcProvider as never);
const signer = provider.getSigner(account);
return { signer, address: account };

// After
const walletClient = createWalletClient({
  chain: polygon,
  transport: custom(magic.rpcProvider as never),
  account: account as `0x${string}`,
});
return { walletClient, address: account };
```

**Blocked** until CLOB SDK accepts viem `WalletClient` — see §1c.

---

**14. `apps/web/src/features/auth/lib/magic/external-signer.ts`**

Current imports:
```ts
import { Web3Provider } from "@ethersproject/providers";
```

Same pattern — `new Web3Provider(eth as never).getSigner(walletAddress)` becomes `createWalletClient({ transport: custom(eth), account })`. **Blocked** on SDK.

---

**15. `apps/web/src/features/auth/lib/magic/get-signer.ts`**
**16. `apps/web/src/features/auth/lib/magic/clob-credentials.ts`**
**17. `apps/web/src/features/auth/lib/magic/derive-credentials-l1.ts`**

These use `type JsonRpcSigner` in function signatures. Once signer.ts and external-signer.ts return `WalletClient`, these change their type annotations. **Blocked** on SDK.

---

**18. `packages/api/src/lib/clob-factory.ts`**, **`packages/api/src/lib/clob/address-signer.ts`**, **`packages/api/src/lib/clob/client.ts`**

These import `type JsonRpcSigner` and `type Wallet` from `@ethersproject/providers` and `@ethersproject/wallet` for the CLOB client constructor. The `AddressOnlySigner` class implements `Pick<Wallet, "getAddress">`.

Post-migration these would use `WalletClient` or a custom `Signer` interface. **Blocked** on SDK.


---

### 1c. Polymarket SDK Blocker

The CLOB SDK (`@polymarket/clob-client`) types use `@ethersproject/providers` `JsonRpcSigner` and `@ethersproject/wallet` `Wallet` in its constructor signatures. This affects 8 files (the type-only imports listed above).

**Options:**
1. **Wrap viem WalletClient** to satisfy `JsonRpcSigner` interface — adapter pattern, ~50 lines
2. **Wait for SDK update** — Polymarket may ship viem-compatible types (check their repo)
3. **Use type assertion** — `walletClient as unknown as JsonRpcSigner` — ugly but works

**Recommendation:** Option 1 (adapter). Create `lib/viem-ethers-adapter.ts` that wraps a viem `WalletClient` to expose the `JsonRpcSigner` interface the SDK expects. This unblocks the migration without waiting on Polymarket.

### 1d. Migration Order

1. **Server on-chain reads** (2 files, simplest, no SDK dependency): `balance.ts`, `check-approval-status.ts`
2. **Web transaction builders** (5 files, no SDK dependency): `approval-txs.ts`, `transfer-txs.ts`, `wrap-txs.ts`, `redeem-txs.ts`, `split-merge-txs.ts`
3. **Server auth + UMA** (2 files): `auth/router.ts` (verifyMessage), `uma-propose-url.ts`
4. **Web bridge + layout** (2 files): `use-auto-wrap.ts`, `header-wrap-button.tsx`
5. **Web resolution** (1 file): `get-resolver-address.ts`
6. **Auth/Magic signer** (2 files, SDK dependency): `signer.ts`, `external-signer.ts`
7. **SDK type adapters** (6 files, blocked on adapter): `clob-factory.ts`, `address-signer.ts`, `client.ts`, `clob-credentials.ts`, `get-signer.ts`, `derive-credentials-l1.ts`
8. **Remove ethers** from `package.json`

Each step is a separate PR. Steps 1-5 can proceed immediately. Steps 6-7 need the adapter.

### 1e. Bundle Impact

| Package | Size | Action |
|---------|------|--------|
| `ethers` | ~1.1 MB | Remove |
| `@ethersproject/providers` | ~340 KB | Remove |
| `@ethersproject/wallet` | ~270 KB | Remove |
| `viem` | Already transitive dep | Add as direct dep |

**Net savings:** ~1.7 MB from client bundle (ethers tree-shakes poorly).

---

## Section 2: date-fns → Temporal

### 2a. Scope Assessment

Only **3 files** use date-fns, all calendar-related. 12 unique functions used.

### 2b. Replacement Table

| date-fns | Temporal / Intl equivalent |
|----------|---------------------------|
| `format(date, "MMM d, yyyy")` | `new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date)` |
| `addDays(date, n)` | `Temporal.PlainDate.from(date).add({ days: n })` |
| `addMonths(date, n)` | `Temporal.PlainDate.from(date).add({ months: n })` |
| `subMonths(date, n)` | `Temporal.PlainDate.from(date).subtract({ months: n })` |
| `startOfMonth(date)` | `Temporal.PlainDate.from(date).with({ day: 1 })` |
| `endOfMonth(date)` | `Temporal.PlainDate.from(date).with({ day: date.daysInMonth })` |
| `startOfWeek(date)` | Manual: subtract `date.dayOfWeek - 1` days |
| `startOfDay(date)` | `Temporal.PlainDate.from(date)` (PlainDate has no time) |
| `isSameDay(a, b)` | `Temporal.PlainDate.compare(a, b) === 0` |
| `isSameMonth(a, b)` | `a.month === b.month && a.year === b.year` |
| `isBefore(a, b)` | `Temporal.PlainDate.compare(a, b) < 0` |
| `eachDayOfInterval({start, end})` | Loop: `while (Temporal.PlainDate.compare(current, end) <= 0) { ... current = current.add({ days: 1 }) }` |

### 2c. Recommendation: Keep date-fns

**Rationale:**
- Only 3 files, all calendar-specific
- date-fns tree-shakes well (~5KB for these 12 functions)
- Temporal API for calendar iteration is verbose (no `eachDayOfInterval` equivalent)
- Migration effort not justified for 3 files
- **Decision: keep date-fns for existing calendar code, use Temporal for new date/time code**

If you do want to migrate later, the 3 files are self-contained and can be done in a single PR.

---

## Section 3: nuqs Adoption

### 3a. What nuqs Replaces

Manual `useSearchParams()` + `router.push()` patterns for URL-persisted state. nuqs provides type-safe, serialized URL state with shallow routing (no full page re-render).

### 3b. Installation

```bash
pnpm add nuqs --filter=web
```

### 3c. File-by-File Migration

**File 1: `features/explore/components/use-explore-url-state.ts`** (highest value)

Current: manual `useSearchParams()` reads + `router.push()` writes for search, category, sort, filters.

```ts
// Before
const searchParams = useSearchParams();
const search = searchParams.get("search") ?? "";
const category = searchParams.get("category") ?? "all";

// After
import { useQueryState, parseAsString } from "nuqs";
const [search, setSearch] = useQueryState("search", parseAsString.withDefault(""));
const [category, setCategory] = useQueryState("category", parseAsString.withDefault("all"));
```

**File 2: `features/trading/components/market/market-trading-context.tsx`**

Current: reads `?side=` param to sync Yes/No side selection.

```ts
// Before
const searchParams = useSearchParams();
const sideParam = searchParams.get("side");

// After
import { useQueryState, parseAsStringLiteral } from "nuqs";
const [side] = useQueryState("side", parseAsStringLiteral(["yes", "no"]).withDefault("yes"));
```

**File 3: `features/profile/components/profile-modal-provider.tsx`**

Current: reads `?profile=` param to open profile modal.

```ts
// Before
const searchParams = useSearchParams();
const profileAddress = searchParams.get("profile");

// After
import { useQueryState, parseAsString } from "nuqs";
const [profileAddress, setProfileAddress] = useQueryState("profile", parseAsString);
```

### 3d. Benefits

- **Type safety:** parsers enforce types at read time
- **Shallow routing:** URL updates without full page re-render
- **Serialization:** handles arrays, numbers, booleans automatically
- **SSR-safe:** works with Next.js App Router
- **Suspense-compatible:** doesn't cause CSR bailout like raw `useSearchParams()`

---

## Section 4: Timeline

| Migration | Files | Effort | Phase | Can Parallelize? |
|-----------|-------|--------|-------|-----------------|
| ethers → viem (steps 1-5) | 12 | 1.5 weeks | 5 | Yes (per file) |
| ethers → viem (steps 6-7, SDK) | 8 | 1 week | 5 | After adapter |
| date-fns | 3 | Skip (keep) | — | — |
| nuqs | 3 | 2 days | 5 | Yes |
| **Total** | **23** | **~3 weeks** | **5** | |

**Start with nuqs** (2 days, immediate value, no blockers). Then ethers steps 1-5 (no SDK dependency). Then ethers steps 6-7 (after adapter written).
