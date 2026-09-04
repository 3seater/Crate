/**
 * Optional Discord webhook for internal ops notifications (signups, trades, …).
 * Fire-and-forget: failures are logged only; never blocks user-facing procedures.
 *
 * Configure via `DISCORD_OPS_WEBHOOK_URL`.
 */

import { env } from "@doji/env/server";
import { logger } from "@doji/logger";

const EMBED_COLOR_SIGNUP = 0xdb_ff_55; // Doji green
const EMBED_COLOR_SESSION = 0x3b_82_f6; // blue — returning login
const EMBED_COLOR_LOGOUT = 0x6b_72_80; // slate
const EMBED_COLOR_TRADE = 0x58_65_f2; // indigo
const EMBED_COLOR_MILESTONE = 0x2e_cc_71; // green
/** Discord embed field value limit; longer strings are split into multiple fields. */
const FIELD_VALUE_MAX = 1024;
const MAX_EMBED_FIELDS = 25;

export interface DiscordOpsUserLoginPayload {
  authMethod: "magic" | "wallet";
  email?: string;
  hasCredentials?: boolean;
  isNewUser: boolean;
  /** When `isNewUser` and `createUserWithReferral` succeeded. */
  referralCodeUsed?: string;
  safeAddress?: string;
  type: "user_login";
  userId: string;
  walletPreview: string;
}

export interface DiscordOpsUserLogoutPayload {
  authMethod: "magic" | "wallet";
  email?: string;
  type: "user_logout";
  userId: string;
  walletPreview: string;
}

export interface DiscordOpsSafeRegisteredPayload {
  email?: string;
  safePreview: string;
  type: "safe_registered";
  userId: string;
  walletPreview: string;
}

export interface DiscordOpsFirstCredentialsPayload {
  email?: string;
  safePreview?: string;
  type: "first_credentials_stored";
  userId: string;
  walletPreview: string;
}

export interface DiscordOpsTradePayload {
  makerAmount: string;
  /** Best-effort from Gamma (question + slug) — omitted if lookup fails. */
  marketLabel?: string;
  orderId?: string;
  orderType: string;
  /** Gnosis Safe funder address used for the order. */
  safeAddress: string;
  side: string;
  takerAmount: string;
  /** Full CLOB outcome token id (numeric string). */
  tokenId: string;
  type: "trade_placed";
  userId: string;
}

export interface DiscordOpsBatchTradePayload {
  count: number;
  firstMarketLabel?: string;
  /** USDC notional for the first order in the batch (same rules as single orders). */
  firstNotionalUsd?: string;
  firstSummary?: string;
  firstTokenId?: string;
  orderType: string;
  /** Gnosis Safe funder address. */
  safeAddress: string;
  type: "batch_trades_placed";
  userId: string;
}

export type DiscordOpsPayload =
  | DiscordOpsUserLoginPayload
  | DiscordOpsUserLogoutPayload
  | DiscordOpsSafeRegisteredPayload
  | DiscordOpsFirstCredentialsPayload
  | DiscordOpsTradePayload
  | DiscordOpsBatchTradePayload;

interface DiscordEmbed {
  color: number;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  timestamp?: string;
  title: string;
}

/**
 * Adds one or more embed fields. Values longer than Discord's 1024-char field limit
 * are split across fields named e.g. `Token (1/3)`, `Token (2/3)`.
 * Stops at {@link MAX_EMBED_FIELDS} total fields (Discord limit).
 */
function addFieldValue(
  fields: NonNullable<DiscordEmbed["fields"]>,
  name: string,
  value: string,
  inline?: boolean
): void {
  if (fields.length >= MAX_EMBED_FIELDS) {
    return;
  }
  if (value.length === 0) {
    fields.push({ name, value: "—", inline });
    return;
  }
  const chunks: string[] = [];
  for (let i = 0; i < value.length; i += FIELD_VALUE_MAX) {
    chunks.push(value.slice(i, i + FIELD_VALUE_MAX));
  }
  for (let i = 0; i < chunks.length; i++) {
    if (fields.length >= MAX_EMBED_FIELDS) {
      return;
    }
    const partName =
      chunks.length === 1
        ? name
        : `${name} (${i + 1}/${String(chunks.length)})`;
    const c = chunks[i] ?? "";
    const isFirst = i === 0;
    fields.push({ name: partName, value: c, inline: isFirst ? inline : false });
  }
}

export function maskEmailForOps(
  email: string | null | undefined
): string | undefined {
  if (!email?.includes("@")) {
    return;
  }
  const [local, domain] = email.split("@");
  if (!(local && domain)) {
    return;
  }
  const masked = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${masked}@${domain}`;
}

export function shortWallet(addr: string): string {
  const a = addr.trim().toLowerCase();
  if (a.length < 12) {
    return a;
  }
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function shortTokenId(tokenId: string): string {
  const t = tokenId.trim();
  if (t.length <= 16) {
    return t;
  }
  return `${t.slice(0, 8)}…${t.slice(-6)}`;
}

/**
 * USDC notional of a CLOB order (raw 1e6 micro-units).
 * BUY: maker pays USDC → `makerAmount`. SELL: taker pays USDC → `takerAmount`.
 * @see `calculateAmounts` in `apps/web/src/domains/trading/lib/order-utils.ts`
 */
export function formatClobOrderNotionalUsd(
  side: string,
  makerAmount: string,
  takerAmount: string
): string {
  const s = String(side).toUpperCase();
  const isSell = s === "SELL" || s === "1";
  // BUY (and unknown): USDC is maker leg; SELL: USDC is taker leg.
  const usdcRaw = isSell ? takerAmount : makerAmount;
  try {
    const micros = BigInt(usdcRaw);
    if (micros < 0n) {
      return "—";
    }
    const usd = Number(micros) / 1e6;
    if (!Number.isFinite(usd)) {
      return "—";
    }
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(usd);
  } catch {
    return "—";
  }
}

/**
 * Effective price of a CLOB order: USDC / tokens.
 * BUY: price = makerAmount / takerAmount. SELL: price = takerAmount / makerAmount.
 */
export function formatClobOrderPrice(
  side: string,
  makerAmount: string,
  takerAmount: string
): string {
  try {
    const maker = Number(BigInt(makerAmount)) / 1e6;
    const taker = Number(BigInt(takerAmount)) / 1e6;
    if (maker <= 0 || taker <= 0) {
      return "—";
    }
    const s = String(side).toUpperCase();
    const isSell = s === "SELL" || s === "1";
    const price = isSell ? taker / maker : maker / taker;
    if (!Number.isFinite(price) || price <= 0 || price > 1) {
      return "—";
    }
    return `${(price * 100).toFixed(1)}¢`;
  } catch {
    return "—";
  }
}

function tradePlacedToEmbed(
  p: DiscordOpsTradePayload,
  ts: string
): DiscordEmbed {
  const fields: DiscordEmbed["fields"] = [];
  addFieldValue(fields, "User ID", p.userId, true);
  addFieldValue(fields, "Safe (funder)", p.safeAddress, true);
  addFieldValue(fields, "Type", p.orderType, true);
  addFieldValue(fields, "Side", p.side, true);
  addFieldValue(
    fields,
    "Notional (USDC)",
    formatClobOrderNotionalUsd(p.side, p.makerAmount, p.takerAmount),
    true
  );
  addFieldValue(
    fields,
    "Price",
    formatClobOrderPrice(p.side, p.makerAmount, p.takerAmount),
    true
  );
  if (p.marketLabel) {
    addFieldValue(fields, "Market", p.marketLabel, false);
  }
  addFieldValue(fields, "Token", p.tokenId, false);
  addFieldValue(
    fields,
    "Maker / taker amount",
    `${p.makerAmount} / ${p.takerAmount}`,
    false
  );
  if (p.orderId) {
    addFieldValue(fields, "Order ID", p.orderId, false);
  }
  return {
    title: "Order placed",
    color: EMBED_COLOR_TRADE,
    fields,
    timestamp: ts,
  };
}

function batchTradesToEmbed(
  p: DiscordOpsBatchTradePayload,
  ts: string
): DiscordEmbed {
  const fields: DiscordEmbed["fields"] = [];
  addFieldValue(fields, "User ID", p.userId, true);
  addFieldValue(fields, "Safe (funder)", p.safeAddress, true);
  addFieldValue(fields, "Orders", String(p.count), true);
  addFieldValue(fields, "Type", p.orderType, true);
  if (p.firstMarketLabel) {
    addFieldValue(fields, "First market", p.firstMarketLabel, false);
  }
  if (p.firstTokenId) {
    addFieldValue(fields, "First token", p.firstTokenId, false);
  }
  if (p.firstNotionalUsd) {
    addFieldValue(fields, "First notional (USDC)", p.firstNotionalUsd, false);
  }
  if (p.firstSummary) {
    addFieldValue(fields, "First order", p.firstSummary, false);
  }
  return {
    title: "Batch orders placed",
    color: EMBED_COLOR_TRADE,
    fields,
    timestamp: ts,
  };
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: switch over payload types
function payloadToEmbed(payload: DiscordOpsPayload): DiscordEmbed {
  const ts = new Date().toISOString();
  switch (payload.type) {
    case "user_login": {
      const fields: DiscordEmbed["fields"] = [];
      addFieldValue(fields, "User ID", payload.userId, true);
      addFieldValue(fields, "Auth", payload.authMethod, true);
      addFieldValue(
        fields,
        "Account",
        payload.isNewUser ? "New" : "Returning",
        true
      );
      addFieldValue(fields, "Wallet", payload.walletPreview, true);
      if (payload.email) {
        addFieldValue(fields, "Email", payload.email, true);
      }
      if (payload.safeAddress) {
        addFieldValue(fields, "Safe", payload.safeAddress, true);
      }
      if (payload.hasCredentials !== undefined) {
        addFieldValue(
          fields,
          "Credentials",
          payload.hasCredentials ? "✓" : "✗",
          true
        );
      }
      if (payload.referralCodeUsed) {
        addFieldValue(fields, "Referral code", payload.referralCodeUsed, true);
      }
      return {
        title: payload.isNewUser ? "User login (new account)" : "User login",
        color: payload.isNewUser ? EMBED_COLOR_SIGNUP : EMBED_COLOR_SESSION,
        fields,
        timestamp: ts,
      };
    }
    case "user_logout": {
      const fields: DiscordEmbed["fields"] = [];
      addFieldValue(fields, "User ID", payload.userId, true);
      addFieldValue(fields, "Auth", payload.authMethod, true);
      addFieldValue(fields, "Wallet", payload.walletPreview, true);
      if (payload.email) {
        addFieldValue(fields, "Email", payload.email, true);
      }
      return {
        title: "User logout",
        color: EMBED_COLOR_LOGOUT,
        fields,
        timestamp: ts,
      };
    }
    case "safe_registered": {
      const fields: DiscordEmbed["fields"] = [];
      addFieldValue(fields, "User ID", payload.userId, true);
      addFieldValue(fields, "Safe", payload.safePreview, true);
      addFieldValue(fields, "Wallet", payload.walletPreview, true);
      if (payload.email) {
        addFieldValue(fields, "Email", payload.email, true);
      }
      return {
        title: "Safe registered",
        color: EMBED_COLOR_MILESTONE,
        fields,
        timestamp: ts,
      };
    }
    case "first_credentials_stored": {
      const fields: DiscordEmbed["fields"] = [];
      addFieldValue(fields, "User ID", payload.userId, true);
      addFieldValue(fields, "Wallet", payload.walletPreview, true);
      if (payload.safePreview) {
        addFieldValue(fields, "Safe", payload.safePreview, true);
      }
      if (payload.email) {
        addFieldValue(fields, "Email", payload.email, true);
      }
      return {
        title: "First CLOB credentials stored",
        description: "User can trade with server-stored API keys.",
        color: EMBED_COLOR_MILESTONE,
        fields,
        timestamp: ts,
      };
    }
    case "trade_placed": {
      return tradePlacedToEmbed(payload, ts);
    }
    case "batch_trades_placed": {
      return batchTradesToEmbed(payload, ts);
    }
    default: {
      logger.warn(
        { payload },
        "discord_ops_webhook: unhandled payload — add a switch case"
      );
      return {
        title: "Ops notification",
        color: EMBED_COLOR_TRADE,
        description: "Unhandled payload shape.",
        timestamp: ts,
      };
    }
  }
}

async function postToDiscord(
  webhookUrl: string,
  embed: DiscordEmbed
): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [embed],
    }),
  });
  if (!res.ok) {
    logger.warn(
      { status: res.status, statusText: res.statusText },
      "discord_ops_webhook: non-ok response"
    );
  }
}

/**
 * Sends one Discord embed asynchronously. No-op if webhook URL is unset.
 */
export function notifyDiscordOps(payload: DiscordOpsPayload): void {
  const url = env.DISCORD_OPS_WEBHOOK_URL;
  if (!url) {
    return;
  }

  const embed = payloadToEmbed(payload);
  postToDiscord(url, embed).catch((err) => {
    logger.warn(
      { err: err instanceof Error ? err.message : String(err) },
      "discord_ops_webhook: fetch failed"
    );
  });
}

export function formatSideForOps(side: unknown): string {
  if (side === 0 || side === "BUY") {
    return "BUY";
  }
  if (side === 1 || side === "SELL") {
    return "SELL";
  }
  return String(side);
}

export function extractOrderIdFromPostResult(
  result: unknown
): string | undefined {
  if (result == null || typeof result !== "object") {
    return;
  }
  const r = result as Record<string, unknown>;
  const id = r.orderId ?? r.orderID ?? r.order_id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

export function tradeSummaryFromSignedOrder(order: {
  side: unknown;
  tokenId: string;
  makerAmount: string;
  takerAmount: string;
}): string {
  return `${formatSideForOps(order.side)} · token ${order.tokenId} · ${order.makerAmount} / ${order.takerAmount}`;
}

/** Best-effort summary for SDK `SignedOrder` objects (camelCase or snake_case fields). */
export function summarizeUnknownSignedOrder(
  order: unknown
): string | undefined {
  if (order == null || typeof order !== "object") {
    return;
  }
  const o = order as Record<string, unknown>;
  const tokenId = o.tokenId ?? o.token_id;
  const makerAmount = o.makerAmount ?? o.maker_amount;
  const takerAmount = o.takerAmount ?? o.taker_amount;
  if (
    typeof tokenId !== "string" ||
    typeof makerAmount !== "string" ||
    typeof takerAmount !== "string"
  ) {
    return;
  }
  return tradeSummaryFromSignedOrder({
    side: o.side,
    tokenId,
    makerAmount,
    takerAmount,
  });
}
