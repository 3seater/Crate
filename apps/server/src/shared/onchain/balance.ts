/**
 * On-chain balance reads and transfer history for Polygon.
 */

import { env } from "@doji/env/server";
import { logger } from "@doji/logger";
import {
  CONTRACTS,
  POLYMARKET_USDC_BELL_SETTLEMENT_COUNTERPARTIES,
  USDC_DECIMALS,
} from "@doji/types";
import {
  createPublicClient,
  formatUnits,
  getAddress,
  http,
  type Log,
  type PublicClient,
  parseAbiItem,
  slice,
} from "viem";
import { polygon } from "viem/chains";

import { getPolygonRpcUrlsToTry } from "./polygon-rpc-urls";

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const ERC1155_ABI = [
  {
    type: "function",
    name: "balanceOfBatch",
    inputs: [
      { name: "owners", type: "address[]" },
      { name: "ids", type: "uint256[]" },
    ],
    outputs: [{ type: "uint256[]" }],
    stateMutability: "view",
  },
] as const;

const TRANSFER_EVENT = parseAbiItem(
  "event Transfer(address indexed from, address indexed to, uint256 value)"
);

/** Try primary + fallback RPCs (e.g. dRPC free may reject eth_call). */
async function withPolygonRpcFallback<T>(
  label: string,
  fn: (client: PublicClient) => Promise<T>
): Promise<T | null> {
  const urls = getPolygonRpcUrlsToTry();
  let lastErr: unknown;
  for (let i = 0; i < urls.length; i++) {
    const rpcUrl = urls[i];
    if (!rpcUrl) {
      continue;
    }
    try {
      const client = createPublicClient({
        chain: polygon,
        transport: http(rpcUrl),
      });
      return await fn(client);
    } catch (err) {
      lastErr = err;
      if (i < urls.length - 1) {
        logger.warn(
          {
            label,
            rpcUrl,
            err: err instanceof Error ? err.message : String(err),
            fallbacksRemaining: urls.length - i - 1,
          },
          "Polygon RPC failed — trying fallback"
        );
      }
    }
  }
  logger.warn(
    {
      label,
      err:
        lastErr instanceof Error
          ? lastErr.message
          : String(lastErr ?? "unknown"),
    },
    "All Polygon RPCs failed"
  );
  return null;
}

/**
 * Fetch pUSD (trading collateral) balance for an address on Polygon.
 */
export async function getPusdBalanceOnPolygon(
  address: string
): Promise<string | null> {
  const result = await withPolygonRpcFallback(
    "getPusdBalanceOnPolygon",
    async (client) => {
      const balance = await client.readContract({
        address: CONTRACTS.PUSD as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });
      return balance.toString();
    }
  );
  if (result === null) {
    logger.warn(
      { address: `${address.slice(0, 6)}…${address.slice(-4)}` },
      "Failed to fetch USDC balance"
    );
  }
  return result;
}

/**
 * Fetch outcome token balances for an address from the CTF on Polygon.
 */
export async function getCtfTokenBalances(
  address: string,
  tokenIds: string[]
): Promise<Record<string, number>> {
  if (tokenIds.length === 0) {
    return {};
  }
  const owners = tokenIds.map(() => address as `0x${string}`);
  const ids = tokenIds.map((id) => BigInt(id));

  const result = await withPolygonRpcFallback(
    "getCtfTokenBalances",
    async (client) => {
      const raw = await client.readContract({
        address: CONTRACTS.CTF as `0x${string}`,
        abi: ERC1155_ABI,
        functionName: "balanceOfBatch",
        args: [owners, ids],
      });
      const out: Record<string, number> = {};
      for (let i = 0; i < tokenIds.length; i++) {
        const tokenId = tokenIds[i];
        if (!tokenId) {
          continue;
        }
        out[tokenId] =
          Number.parseFloat(formatUnits(raw[i] ?? 0n, USDC_DECIMALS)) ?? 0;
      }
      return out;
    }
  );

  if (result === null) {
    logger.warn(
      {
        address: `${address.slice(0, 6)}…${address.slice(-4)}`,
        tokenCount: tokenIds.length,
      },
      "Failed to fetch CTF token balances"
    );
  }
  return result ?? {};
}

/** Inbound USDC.e transfer for activity display. */
export interface InboundUsdcTransfer {
  amountUsd: number;
  timestamp: number;
  txHash: string;
}

/** ~2s per block on Polygon. */
const POLYGON_BLOCK_TIME_SEC = 2;
/** RPC getLogs limit; many providers reject >5k blocks. */
const CHUNK_BLOCKS = 2000;
/** Cap total blocks to scan (~55h). */
const MAX_BLOCKS = 100_000;
const BLOCK_LOOKUP_CONCURRENCY = 8;
const LOG_CHUNK_QUERY_CONCURRENCY = 4;

function parseTransferLogAddresses(
  log: Log
): { fromLower: string; toLower: string } | null {
  const topics = log.topics;
  if (!topics || topics.length < 3) {
    return null;
  }
  const topicFrom = topics[1];
  const topicTo = topics[2];
  if (!(topicFrom && topicTo)) {
    return null;
  }
  try {
    const from = getAddress(slice(topicFrom, 12)).toLowerCase();
    const to = getAddress(slice(topicTo, 12)).toLowerCase();
    return { fromLower: from, toLower: to };
  } catch {
    return null;
  }
}

/** Drop CLOB / CTF collateral flows; keep bridge + external USDC movements. */
function isBellExcludedSettlementCounterparty(
  indexedParty: "to" | "from",
  fromLower: string,
  toLower: string
): boolean {
  if (indexedParty === "to") {
    return POLYMARKET_USDC_BELL_SETTLEMENT_COUNTERPARTIES.has(fromLower);
  }
  return POLYMARKET_USDC_BELL_SETTLEMENT_COUNTERPARTIES.has(toLower);
}

/** Resolve block timestamps for a set of logs in batches. */
async function resolveBlockTimestamps(
  client: PublicClient,
  logs: Log[]
): Promise<Map<bigint, number>> {
  const cache = new Map<bigint, number>();
  const uniqueBlocks = [
    ...new Set(
      logs.map((l) => l.blockNumber).filter((n): n is bigint => n != null)
    ),
  ];
  for (let s = 0; s < uniqueBlocks.length; s += BLOCK_LOOKUP_CONCURRENCY) {
    const blockBatch = uniqueBlocks.slice(s, s + BLOCK_LOOKUP_CONCURRENCY);
    const tsBatch = await Promise.all(
      blockBatch.map(async (bn) => {
        const block = await client.getBlock({ blockNumber: bn });
        return { blockNumber: bn, timestamp: Number(block.timestamp) };
      })
    );
    for (const { blockNumber, timestamp } of tsBatch) {
      cache.set(blockNumber, timestamp);
    }
  }
  return cache;
}

/** Convert raw logs into InboundUsdcTransfer items, filtering settlement counterparties. */
function logsToTransfers(
  logs: Log[],
  blockCache: Map<bigint, number>,
  indexedParty: "to" | "from"
): InboundUsdcTransfer[] {
  const items: InboundUsdcTransfer[] = [];
  for (const log of logs) {
    const parties = parseTransferLogAddresses(log);
    if (!parties) {
      continue;
    }
    if (
      isBellExcludedSettlementCounterparty(
        indexedParty,
        parties.fromLower,
        parties.toLower
      )
    ) {
      continue;
    }
    const value = log.data ? BigInt(log.data) : 0n;
    const amountUsd = Number.parseFloat(formatUnits(value, USDC_DECIMALS));
    if (amountUsd <= 0) {
      continue;
    }
    const ts =
      log.blockNumber == null ? 0 : (blockCache.get(log.blockNumber) ?? 0);
    items.push({ timestamp: ts, amountUsd, txHash: log.transactionHash ?? "" });
  }
  items.sort((a, b) => b.timestamp - a.timestamp);
  return items;
}

async function fetchIndexedPartyUsdcTransfersWithClient(
  client: PublicClient,
  normalizedAddress: string,
  windowSeconds: number,
  indexedParty: "to" | "from"
): Promise<InboundUsdcTransfer[]> {
  const currentBlock = await client.getBlockNumber();
  const requestedBlocks = Math.floor(windowSeconds / POLYGON_BLOCK_TIME_SEC);
  const windowBlocks = Math.min(requestedBlocks, MAX_BLOCKS);
  const startBlock = currentBlock - BigInt(windowBlocks);
  const fromBlock = startBlock > 0n ? startBlock : 0n;

  const allLogs: Log[] = [];
  const chunkRanges: Array<{ start: bigint; end: bigint }> = [];
  for (
    let start = fromBlock;
    start <= currentBlock;
    start += BigInt(CHUNK_BLOCKS)
  ) {
    const end =
      start + BigInt(CHUNK_BLOCKS) - 1n > currentBlock
        ? currentBlock
        : start + BigInt(CHUNK_BLOCKS) - 1n;
    chunkRanges.push({ start, end });
  }

  for (let ci = 0; ci < chunkRanges.length; ci += LOG_CHUNK_QUERY_CONCURRENCY) {
    const batch = chunkRanges.slice(ci, ci + LOG_CHUNK_QUERY_CONCURRENCY);
    const logsBatch = await Promise.all(
      batch.map(({ start, end }) =>
        client.getLogs({
          address: CONTRACTS.USDC_E as `0x${string}`,
          event: TRANSFER_EVENT,
          args:
            indexedParty === "to"
              ? { to: normalizedAddress as `0x${string}` }
              : { from: normalizedAddress as `0x${string}` },
          fromBlock: start,
          toBlock: end,
        })
      )
    );
    for (const logs of logsBatch) {
      allLogs.push(...logs);
    }
  }

  const blockCache = await resolveBlockTimestamps(client, allLogs);
  return logsToTransfers(allLogs, blockCache, indexedParty);
}

async function fetchIndexedPartyUsdcTransfersFromRpc(
  normalizedAddress: string,
  windowSeconds: number,
  indexedParty: "to" | "from"
): Promise<InboundUsdcTransfer[]> {
  const result = await withPolygonRpcFallback(
    `usdc-bell-transfer-${indexedParty}`,
    (client) =>
      fetchIndexedPartyUsdcTransfersWithClient(
        client,
        normalizedAddress,
        windowSeconds,
        indexedParty
      )
  );
  return result ?? [];
}

interface PolygonscanTokenTxRow {
  from?: string;
  hash?: string;
  timeStamp?: string;
  to?: string;
  value?: string;
}

async function fetchPolygonscanUsdcTokenTxPage(
  addressLower: string,
  offset: string
): Promise<PolygonscanTokenTxRow[]> {
  const apiKey = env.ETHERSCAN_API_KEY;
  const base = apiKey
    ? "https://api.etherscan.io/v2/api"
    : "https://api.polygonscan.com/api";
  const url = new URL(base);
  if (apiKey) {
    url.searchParams.set("chainid", "137");
    url.searchParams.set("apikey", apiKey);
  }
  url.searchParams.set("module", "account");
  url.searchParams.set("action", "tokentx");
  url.searchParams.set("address", addressLower);
  url.searchParams.set("contractaddress", CONTRACTS.USDC_E.toLowerCase());
  url.searchParams.set("page", "1");
  url.searchParams.set("offset", offset);
  url.searchParams.set("sort", "desc");

  const res = await fetch(url.toString());
  const json = (await res.json()) as {
    status: string;
    message?: string;
    result?: PolygonscanTokenTxRow[] | string;
  };
  if (json.status !== "1" || !Array.isArray(json.result)) {
    logger.warn(
      {
        addressLower,
        status: json.status,
        message: json.message,
        resultType: Array.isArray(json.result) ? "array" : typeof json.result,
      },
      "Polygonscan tokentx for USDC.e returned no rows"
    );
    return [];
  }
  return json.result;
}

async function polygonscanInboundUsdcTransfers(
  addressLower: string
): Promise<InboundUsdcTransfer[]> {
  try {
    const rows = await fetchPolygonscanUsdcTokenTxPage(addressLower, "100");
    const items: InboundUsdcTransfer[] = [];
    for (const tx of rows) {
      const to = tx.to?.toLowerCase();
      if (to !== addressLower) {
        continue;
      }
      const from = tx.from?.toLowerCase();
      if (from && POLYMARKET_USDC_BELL_SETTLEMENT_COUNTERPARTIES.has(from)) {
        continue;
      }
      const value = tx.value ? BigInt(tx.value) : 0n;
      const amountUsd = Number(value) / 1e6;
      if (amountUsd <= 0) {
        continue;
      }
      const ts = tx.timeStamp ? Number.parseInt(tx.timeStamp, 10) : 0;
      items.push({ timestamp: ts, amountUsd, txHash: tx.hash ?? "" });
    }
    items.sort((a, b) => b.timestamp - a.timestamp);
    return items;
  } catch (err) {
    logger.warn(
      {
        address: `${addressLower.slice(0, 6)}…${addressLower.slice(-4)}`,
        err: err instanceof Error ? err.message : String(err),
      },
      "Failed to fetch inbound USDC transfers (Polygonscan fallback)"
    );
    return [];
  }
}

/**
 * Fetch inbound USDC.e Transfer events to an address on Polygon.
 */
export async function getInboundUsdcTransfers(
  address: string,
  windowSeconds: number
): Promise<InboundUsdcTransfer[]> {
  const normalizedTo = getAddress(address);
  try {
    const rpc = await fetchIndexedPartyUsdcTransfersFromRpc(
      normalizedTo,
      windowSeconds,
      "to"
    );
    if (rpc.length > 0) {
      return rpc;
    }
  } catch (err) {
    logger.warn(
      {
        address: `${address.slice(0, 6)}…${address.slice(-4)}`,
        windowSeconds,
        err: err instanceof Error ? err.message : String(err),
      },
      "Failed to fetch inbound USDC transfers (RPC)"
    );
  }
  return await polygonscanInboundUsdcTransfers(normalizedTo.toLowerCase());
}
