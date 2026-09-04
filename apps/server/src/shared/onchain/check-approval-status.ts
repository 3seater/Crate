/**
 * On-chain checks for Polymarket CLOB token approval status.
 *
 * Verifies whether a Safe has the required USDC.e and outcome token (CTF)
 * approvals for trading. Used to conditionally show the "Fix Approvals"
 * action in the user menu.
 *
 * Flow:
 *  1. Try primary RPC (POLYGON_RPC_URL, default polygon.drpc.org)
 *  2. On rate limit: retry once after RPC's "retry in Xs" (default 10s)
 *  3. On failure: try fallback RPCs (drpc, publicnode, tenderly)
 *  4. If all fail: return true (show Fix Approvals to be safe)
 */

import { type Logger, logger } from "@doji/logger";
import { CONTRACTS } from "@doji/types";
import { createPublicClient, http, maxUint256 } from "viem";
import { polygon } from "viem/chains";

import { getPolygonRpcUrlsToTry } from "./polygon-rpc-urls";

const log = logger.child({ component: "checkApprovalStatus" });

function truncateAddress(addr: string): string {
  return addr.length >= 10 ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "0x…";
}

const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const ERC1155_ABI = [
  {
    type: "function",
    name: "isApprovedForAll",
    inputs: [
      { name: "account", type: "address" },
      { name: "operator", type: "address" },
    ],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
] as const;

const RETRY_IN_PATTERN = /retry\s+in\s+(\d+)\s*s/i;

function formatErrorForLog(err: unknown): {
  message: string;
  code?: string | number;
  reason?: string;
  rpcRateLimited?: boolean;
} {
  if (err instanceof Error) {
    const out: {
      message: string;
      code?: string | number;
      reason?: string;
      rpcRateLimited?: boolean;
    } = { message: err.message };
    if ("code" in err && err.code !== undefined) {
      out.code = err.code as string | number;
    }
    if (
      "reason" in err &&
      typeof (err as { reason?: string }).reason === "string"
    ) {
      out.reason = (err as { reason: string }).reason;
    }
    if (isRateLimitError(err)) {
      out.rpcRateLimited = true;
    }
    return out;
  }
  return { message: String(err) };
}

function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const code =
    err && typeof err === "object" && "error" in err
      ? (err as { error?: { code?: number } }).error?.code
      : undefined;
  return (
    code === -32_090 ||
    msg.includes("rate limit") ||
    msg.includes("Too many requests")
  );
}

function parseRetrySeconds(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : String(err);
  const body =
    err &&
    typeof err === "object" &&
    "error" in err &&
    typeof (err as { error?: unknown }).error === "object"
      ? JSON.stringify((err as { error: unknown }).error)
      : msg;
  const combined = `${msg} ${body}`;
  const match = combined.match(RETRY_IN_PATTERN);
  const captured = match?.[1];
  if (captured) {
    const s = Math.min(30, Math.max(5, Number.parseInt(captured, 10)));
    return Number.isNaN(s) ? null : s;
  }
  return null;
}

async function runApprovalChecks(
  safeAddress: string,
  rpcUrl: string,
  reqLog: Logger
): Promise<boolean> {
  const safeShort = truncateAddress(safeAddress);
  const client = createPublicClient({
    chain: polygon,
    transport: http(rpcUrl),
  });
  const safe = safeAddress as `0x${string}`;

  const pusdSpenders = [
    CONTRACTS.CTF_EXCHANGE,
    CONTRACTS.NEG_RISK_CTF_EXCHANGE,
    CONTRACTS.NEG_RISK_ADAPTER,
    CONTRACTS.CTF_COLLATERAL_ADAPTER,
    CONTRACTS.NEG_RISK_CTF_COLLATERAL_ADAPTER,
  ];
  const usdcSpenders = [CONTRACTS.COLLATERAL_ONRAMP];
  const operators = [
    CONTRACTS.CTF_EXCHANGE,
    CONTRACTS.NEG_RISK_CTF_EXCHANGE,
    CONTRACTS.NEG_RISK_ADAPTER,
    CONTRACTS.CTF_COLLATERAL_ADAPTER,
    CONTRACTS.NEG_RISK_CTF_COLLATERAL_ADAPTER,
  ];

  const readAllowance = (token: string, spender: string) =>
    client.readContract({
      address: token as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [safe, spender as `0x${string}`],
    });

  const readApproval = (operator: string) =>
    client.readContract({
      address: CONTRACTS.CTF as `0x${string}`,
      abi: ERC1155_ABI,
      functionName: "isApprovedForAll",
      args: [safe, operator as `0x${string}`],
    });

  const [pusdAllowances, usdcAllowances, approvals] = await Promise.all([
    Promise.all(pusdSpenders.map((s) => readAllowance(CONTRACTS.PUSD, s))),
    Promise.all(usdcSpenders.map((s) => readAllowance(CONTRACTS.USDC_E, s))),
    Promise.all(operators.map(readApproval)),
  ]);

  for (const [i, spender] of pusdSpenders.entries()) {
    if ((pusdAllowances[i] ?? 0n) < maxUint256) {
      reqLog.info(
        { safeAddress: safeShort, spender: truncateAddress(spender) },
        "pUSD allowance missing or insufficient"
      );
      return true;
    }
  }
  for (const [i, spender] of usdcSpenders.entries()) {
    if ((usdcAllowances[i] ?? 0n) < maxUint256) {
      reqLog.info(
        { safeAddress: safeShort, spender: truncateAddress(spender) },
        "USDC.e allowance missing for CollateralOnramp"
      );
      return true;
    }
  }
  for (const [i, operator] of operators.entries()) {
    if (!approvals[i]) {
      reqLog.info(
        { safeAddress: safeShort, operator: truncateAddress(operator) },
        "CTF operator approval missing"
      );
      return true;
    }
  }
  reqLog.info(
    { safeAddress: safeShort },
    "All approvals set — no fix required"
  );
  return false;
}

async function tryWithRateLimitRetry(
  safeAddress: string,
  rpcUrl: string,
  reqLog: Logger,
  err: unknown
): Promise<boolean> {
  const retrySec = parseRetrySeconds(err) ?? 10;
  reqLog.info(
    { safeAddress: truncateAddress(safeAddress), rpcUrl, retrySec },
    "RPC rate limited — retrying once after delay"
  );
  await new Promise((r) => setTimeout(r, retrySec * 1000));
  return runApprovalChecks(safeAddress, rpcUrl, reqLog);
}

export type ApprovalCheckOutcome =
  | { verified: true; needsApproval: boolean }
  | {
      verified: false;
      reason: "invalid_address" | "rpc_exhausted" | "no_rpc_urls";
    };

export async function getApprovalCheckOutcome(
  safeAddress: string,
  requestLog?: Logger
): Promise<ApprovalCheckOutcome> {
  const reqLog = requestLog ?? log;
  const safeShort = truncateAddress(safeAddress);
  reqLog.debug({ safeAddress: safeShort }, "Checking approval status");

  if (!safeAddress || safeAddress.length < 42) {
    reqLog.warn(
      { safeAddress: safeShort },
      "Invalid safeAddress — cannot verify on-chain"
    );
    return { verified: false, reason: "invalid_address" };
  }

  const urlsToTry = getPolygonRpcUrlsToTry();

  for (let i = 0; i < urlsToTry.length; i++) {
    const rpcUrl = urlsToTry[i];
    if (!rpcUrl) {
      continue;
    }
    try {
      const missing = await runApprovalChecks(safeAddress, rpcUrl, reqLog);
      return { verified: true, needsApproval: missing };
    } catch (err) {
      const isPrimary = i === 0;
      if (isPrimary && isRateLimitError(err)) {
        try {
          const missing = await tryWithRateLimitRetry(
            safeAddress,
            rpcUrl,
            reqLog,
            err
          );
          return { verified: true, needsApproval: missing };
        } catch (retryErr) {
          reqLog.warn(
            { ...formatErrorForLog(retryErr), safeAddress: safeShort, rpcUrl },
            "Retry failed — trying fallback"
          );
          continue;
        }
      }
      if (i < urlsToTry.length - 1) {
        reqLog.warn(
          {
            ...formatErrorForLog(err),
            safeAddress: safeShort,
            rpcUrl,
            fallbacksRemaining: urlsToTry.length - i - 1,
          },
          "RPC failed — trying fallback"
        );
      } else {
        reqLog.error(
          {
            ...formatErrorForLog(err),
            safeAddress: safeShort,
            rpcUrl,
            urlsTried: urlsToTry.length,
          },
          "All RPCs failed — cannot verify approval status"
        );
        return { verified: false, reason: "rpc_exhausted" };
      }
    }
  }

  reqLog.warn(
    { safeAddress: safeShort },
    "No RPC URLs to try — cannot verify approval status"
  );
  return { verified: false, reason: "no_rpc_urls" };
}

export async function needsApproval(
  safeAddress: string,
  requestLog?: Logger
): Promise<boolean> {
  const reqLog = requestLog ?? log;
  const outcome = await getApprovalCheckOutcome(safeAddress, reqLog);
  if (!outcome.verified) {
    if (outcome.reason === "invalid_address") {
      reqLog.warn(
        { safeAddress: truncateAddress(safeAddress) },
        "Invalid safeAddress — treating as needs approval"
      );
    }
    return true;
  }
  return outcome.needsApproval;
}
