import { AppError } from "@doji/api";
import type { TxBundle } from "./schemas";

const ENSO_BASE_URL = "https://api.enso.finance/api/v1";
const ROBINHOOD_CHAIN_ID = 4663;

/** Sentinel address for native ETH in Enso routing */
const ETH_ADDRESS = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;

export interface EnsoSwapAction {
  action: "route";
  args: {
    tokenIn: `0x${string}`;
    tokenOut: `0x${string}`;
    /** Amount in wei as a decimal string */
    amountIn: string;
    slippage?: number;
  };
  protocol: "enso";
}

/**
 * Builds a buy-into-basket transaction bundle.
 * Splits inputAmountWei across constituent tokens proportionally by weight
 * using BigInt arithmetic to avoid floating-point precision loss.
 *
 * Requirements: 11.1, 11.2
 */
export function buildBuyBundle(params: {
  fromAddress: `0x${string}`;
  constituents: Array<{ address: `0x${string}`; weight: number }>;
  inputAmountWei: bigint;
  tokenIn?: `0x${string}`;
  apiKey: string;
}): Promise<TxBundle> {
  const {
    fromAddress,
    constituents,
    inputAmountWei,
    tokenIn = ETH_ADDRESS,
    apiKey,
  } = params;

  const actions: EnsoSwapAction[] = constituents.map((c) => ({
    protocol: "enso",
    action: "route",
    args: {
      tokenIn,
      tokenOut: c.address,
      amountIn: (
        (inputAmountWei * BigInt(Math.round(c.weight * 1e6))) /
        BigInt(1e6)
      ).toString(),
      slippage: 50, // 0.5% slippage tolerance in basis points
    },
  }));

  return callEnsoBundle({ fromAddress, actions, apiKey });
}

/**
 * Builds an exit-basket transaction bundle.
 * Swaps all non-zero constituent token balances back to ETH.
 *
 * Requirements: 11.3, 11.4
 */
export function buildExitBundle(params: {
  fromAddress: `0x${string}`;
  exitBalances: Array<{ address: `0x${string}`; balanceWei: string }>;
  apiKey: string;
}): Promise<TxBundle> {
  const { fromAddress, exitBalances, apiKey } = params;

  const actions: EnsoSwapAction[] = exitBalances
    .filter((b) => BigInt(b.balanceWei) > 0n)
    .map((b) => ({
      protocol: "enso",
      action: "route",
      args: {
        tokenIn: b.address,
        tokenOut: ETH_ADDRESS,
        amountIn: b.balanceWei,
        slippage: 100, // 1% slippage on exit
      },
    }));

  if (actions.length === 0) {
    throw new AppError({
      code: "BAD_REQUEST",
      message: "No token balances to exit",
      why: "All constituent token balances are zero",
      fix: "Buy into the basket first before attempting to exit",
    });
  }

  return callEnsoBundle({ fromAddress, actions, apiKey });
}

/**
 * POSTs a bundle of swap actions to the Enso Finance API and returns the
 * resulting transaction object ready to be sent on-chain.
 *
 * Enso's bundle endpoint takes chainId, fromAddress, and routingStrategy
 * as URL query parameters, with only the actions array in the request body.
 */
async function callEnsoBundle(params: {
  fromAddress: `0x${string}`;
  actions: EnsoSwapAction[];
  apiKey: string;
}): Promise<TxBundle> {
  const searchParams = new URLSearchParams({
    chainId: String(ROBINHOOD_CHAIN_ID),
    fromAddress: params.fromAddress,
    routingStrategy: "router",
    receiver: params.fromAddress,
  });

  const url = `${ENSO_BASE_URL}/shortcuts/bundle?${searchParams.toString()}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: JSON.stringify(params.actions),
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    throw new AppError({
      code: res.status === 400 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR",
      message: `Enso API error (${res.status})`,
      why: errorBody || "The routing API returned a non-2xx response",
      fix: "Check input amounts are above the minimum and try again",
    });
  }

  const json = (await res.json()) as { tx: TxBundle };
  return json.tx;
}
