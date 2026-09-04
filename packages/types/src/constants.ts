/**
 * Shared CLOB, order, and Polymarket constants.
 *
 * Used by web and server. Naming: CLOB_* (order book/protocol), ORDER_* (order lifecycle),
 * USDC_* / CONTRACTS (chain), POLYMARKET_* (external URLs). Prices are decimal 0–1 (1¢ = 0.01).
 */

import type { TickSize } from "./clob";

// ─── CLOB price and tick ─────────────────────────────────────────────────────

/** CLOB tradeable price floor (1¢). Decimal 0.01. */
export const CLOB_PRICE_MIN = 0.01;

/** CLOB tradeable price ceiling (99.99¢). Decimal 0.9999; 100¢ (1.0) is not tradeable. */
export const CLOB_PRICE_MAX = 0.9999;

/** Default tick size when API does not specify. Use for fallbacks and Zod defaults. */
export const CLOB_TICK_SIZE_DEFAULT: TickSize = "0.01";

/** All allowed tick size values. Single source of truth for Zod schema and validation. */
export const CLOB_TICK_SIZES: readonly TickSize[] = [
  "0.1",
  "0.01",
  "0.001",
  "0.0001",
];

// ─── CLOB size and display ───────────────────────────────────────────────────

/** Size below which we hide/suppress display (align with Polymarket sizeThreshold). */
export const CLOB_SIZE_DISPLAY_THRESHOLD = 0.01;

/** Min shares for market SELL. Same rule used for redeemable min (Polymarket protocol). */
export const CLOB_MARKET_SELL_MIN_SHARES = 0.001;

/** Default min order size in shares when market does not specify (Polymarket default). */
export const CLOB_MIN_ORDER_SIZE_SHARES_DEFAULT = 5;

/** Min notional for market BUY (USD). */
export const CLOB_MARKET_BUY_MIN_USD = 1;

// ─── CLOB order batch ───────────────────────────────────────────────────────

/** Min order count per batch. */
export const CLOB_ORDER_BATCH_MIN = 1;

/** Max order count per batch (CLOB limit). */
export const CLOB_ORDER_BATCH_MAX = 15;

// ─── Order lifecycle (GTD, post-only) ────────────────────────────────────────

/** Order types allowed for post-only. GTC and GTD only; not FOK/FAK. */
export const ORDER_POST_ONLY_TYPES: readonly ["GTC", "GTD"] = ["GTC", "GTD"];

/** GTD expiration buffer in seconds (Polymarket 1-min security). */
export const ORDER_GTD_BUFFER_SECONDS = 60;

// ─── Chain / token ───────────────────────────────────────────────────────────

/** USDC decimals (chain standard). */
export const USDC_DECIMALS = 6;

// ─── Contract addresses ──────────────────────────────────────────────────────

/**
 * Polymarket contract addresses (Polygon mainnet) — V2.
 *
 * - USDC_E: Bridged USDC (legacy collateral, still used for wrapping into pUSD).
 * - PUSD: Polymarket USD — the V2 trading collateral (ERC-20, backed by USDC).
 * - COLLATERAL_ONRAMP / COLLATERAL_OFFRAMP: wrap USDC.e → pUSD / unwrap pUSD → USDC.e.
 * - CTF: Conditional Tokens Framework (ERC-1155 outcome tokens) — unchanged.
 * - CTF_EXCHANGE / NEG_RISK_CTF_EXCHANGE: V2 exchange contracts.
 * - CTF_COLLATERAL_ADAPTER / NEG_RISK_CTF_COLLATERAL_ADAPTER: V2 collateral adapters for split/merge/redeem.
 * - NEG_RISK_ADAPTER: neg-risk adapter — unchanged.
 */
export const CONTRACTS = {
  /** Bridged USDC on Polygon. Still used for deposits/withdrawals and wrapping into pUSD. */
  USDC_E: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  /** Polymarket USD — V2 trading collateral. Standard ERC-20, 6 decimals, backed by USDC. */
  PUSD: "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB",
  /** Wrap USDC.e → pUSD. Approve this contract to spend USDC.e before calling wrap(). */
  COLLATERAL_ONRAMP: "0x93070a847efEf7F70739046A929D47a521F5B8ee",
  /** Unwrap pUSD → USDC.e. Approve this contract to spend pUSD before calling unwrap(). */
  COLLATERAL_OFFRAMP: "0x2957922Eb93258b93368531d39fAcCA3B4dC5854",
  /** Conditional Tokens Framework (ERC-1155 outcome tokens) — unchanged in V2. */
  CTF: "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045",
  /** V2 CTF Exchange — EIP-712 domain version "2". */
  CTF_EXCHANGE: "0xE111180000d2663C0091e4f400237545B87B996B",
  /** V2 Neg Risk CTF Exchange — EIP-712 domain version "2". */
  NEG_RISK_CTF_EXCHANGE: "0xe2222d279d744050d28e00520010520000310F59",
  /** Neg Risk Adapter — unchanged in V2. */
  NEG_RISK_ADAPTER: "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296",
  /** V2 collateral adapter for split/merge/redeem (standard markets). */
  CTF_COLLATERAL_ADAPTER: "0xAdA100Db00Ca00073811820692005400218FcE1f",
  /** V2 collateral adapter for split/merge/redeem (neg-risk markets). */
  NEG_RISK_CTF_COLLATERAL_ADAPTER: "0xadA2005600Dec949baf300f4C6120000bDB6eAab",
  /** NegRisk wrapped-collateral vault — holds tokens on behalf of the protocol, not a real user. */
  NEG_RISK_VAULT: "0xa5ef39c3d3e10d0b270233af41cac69796b12966",
} as const;

/**
 * Addresses that belong to Polymarket protocol contracts, not real users.
 * Filter these out of holders lists, leaderboards, etc.
 */
export const SYSTEM_ADDRESSES: ReadonlySet<string> = new Set(
  Object.values(CONTRACTS).map((a) => a.toLowerCase())
);

/**
 * Collateral `Transfer` counterparties to omit from deposit/withdraw bell rows.
 * Matching these means collateral moved for CLOB settlement (buys/sells/splits),
 * not bridge or external wallet flows. Includes both USDC.e and pUSD flows.
 */
export const POLYMARKET_USDC_BELL_SETTLEMENT_COUNTERPARTIES: ReadonlySet<string> =
  new Set(
    [
      CONTRACTS.CTF,
      CONTRACTS.CTF_EXCHANGE,
      CONTRACTS.NEG_RISK_CTF_EXCHANGE,
      CONTRACTS.NEG_RISK_ADAPTER,
      CONTRACTS.NEG_RISK_VAULT,
      CONTRACTS.PUSD,
      CONTRACTS.COLLATERAL_ONRAMP,
      CONTRACTS.COLLATERAL_OFFRAMP,
      CONTRACTS.CTF_COLLATERAL_ADAPTER,
      CONTRACTS.NEG_RISK_CTF_COLLATERAL_ADAPTER,
    ].map((a) => a.toLowerCase())
  );

// ─── CLOB prices-history (GET /prices-history) ─────────────────────────────────

/**
 * Minimum `fidelity` (minutes between points) enforced by the CLOB for each `interval` preset.
 * Finer values return 400, e.g. `minimum 'fidelity' for '1m' range is 10`.
 *
 * Used to clamp client-supplied fidelity and to build chart fidelity ladders.
 */
export const CLOB_PRICE_HISTORY_MIN_FIDELITY_BY_INTERVAL = {
  "1h": 1,
  "6h": 1,
  "1d": 1,
  "1w": 5,
  /** UI "1M" month range — CLOB `interval` value `1m`. */
  "1m": 10,
  max: 1,
  all: 1,
} as const;

// ─── Polymarket URLs (non-env) ───────────────────────────────────────────────

/**
 * Polymarket geoblock API URL (upstream). Used by our Next.js proxy (/api/geoblock)
 * and server when fetching geoblock status. The client never calls this directly;
 * it calls our proxy so CORS and client IP forwarding work correctly.
 */
export const POLYMARKET_GEOBLOCK_URL = "https://polymarket.com/api/geoblock";

/** Geoblock docs (blocked countries). For restricted-region UI link. */
export const POLYMARKET_GEOBLOCK_DOCS_URL =
  "https://docs.polymarket.com/api-reference/geoblock#blocked-countries";
