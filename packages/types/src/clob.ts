// ─── Enum-like Constants ─────────────────────────────────────────────────────

export const Side = {
  BUY: "BUY",
  SELL: "SELL",
} as const;
export type Side = (typeof Side)[keyof typeof Side];

export const OrderType = {
  GTC: "GTC",
  FOK: "FOK",
  GTD: "GTD",
  FAK: "FAK",
} as const;
export type OrderType = (typeof OrderType)[keyof typeof OrderType];

export const Chain = {
  POLYGON: 137,
  AMOY: 80_002,
} as const;
export type Chain = (typeof Chain)[keyof typeof Chain];

export const AssetType = {
  COLLATERAL: "COLLATERAL",
  CONDITIONAL: "CONDITIONAL",
} as const;
export type AssetType = (typeof AssetType)[keyof typeof AssetType];

export const PriceHistoryInterval = {
  MAX: "max",
  ONE_WEEK: "1w",
  ONE_DAY: "1d",
  SIX_HOURS: "6h",
  ONE_HOUR: "1h",
} as const;
export type PriceHistoryInterval =
  (typeof PriceHistoryInterval)[keyof typeof PriceHistoryInterval];

export const TradeStatus = {
  MATCHED: "MATCHED",
  MINED: "MINED",
  CONFIRMED: "CONFIRMED",
  RETRYING: "RETRYING",
  FAILED: "FAILED",
} as const;
export type TradeStatus = (typeof TradeStatus)[keyof typeof TradeStatus];

// ─── Core Types ──────────────────────────────────────────────────────────────

export type TickSize = "0.1" | "0.01" | "0.001" | "0.0001";

export interface RoundConfig {
  readonly amount: number;
  readonly price: number;
  readonly size: number;
}

export interface OrderSummary {
  price: string;
  size: string;
}

export interface OrderBookSummary {
  asks: OrderSummary[];
  asset_id: string;
  bids: OrderSummary[];
  hash: string;
  last_trade_price: string;
  market: string;
  min_order_size: string;
  neg_risk: boolean;
  tick_size: string;
  timestamp: string;
}

export type OrderStatus = "matched" | "live" | "delayed" | "unmatched";

// ─── Auth Types ──────────────────────────────────────────────────────────────

export interface ApiKeyCreds {
  key: string;
  passphrase: string;
  secret: string;
}

export interface L1PolyHeader {
  POLY_ADDRESS: string;
  POLY_NONCE: string;
  POLY_SIGNATURE: string;
  POLY_TIMESTAMP: string;
}

export interface L2PolyHeader {
  POLY_ADDRESS: string;
  POLY_API_KEY: string;
  POLY_PASSPHRASE: string;
  POLY_SIGNATURE: string;
  POLY_TIMESTAMP: string;
}

export interface L2HeaderArgs {
  body?: string;
  method: string;
  requestPath: string;
}

// ─── Order Types ─────────────────────────────────────────────────────────────

/** @deprecated V1 type — use UserOrderV2 for CLOB V2. */
export interface ClobUserOrder {
  expiration?: number;
  feeRateBps?: number;
  nonce?: number;
  price: number;
  side: Side;
  size: number;
  taker?: string;
  tokenID: string;
}

/** @deprecated V1 type — use UserMarketOrderV2 for CLOB V2. */
export interface ClobUserMarketOrder {
  amount: number;
  feeRateBps?: number;
  nonce?: number;
  orderType?: typeof OrderType.FOK | typeof OrderType.FAK;
  price?: number;
  side: Side;
  taker?: string;
  tokenID: string;
}

export interface CreateOrderOptions {
  negRisk?: boolean;
  tickSize: TickSize;
}

/** @deprecated V1 type — use SignedOrderV2 for CLOB V2. */
export interface ClobSignedOrder {
  expiration: string;
  feeRateBps: string;
  maker: string;
  makerAmount: string;
  nonce: string;
  salt: string;
  side: number;
  signature: string;
  signatureType: number;
  signer: string;
  taker: string;
  takerAmount: string;
  tokenId: string;
}

export interface OrderData {
  expiration: string;
  feeRateBps: string;
  maker: string;
  makerAmount: string;
  nonce: string;
  side: number;
  signer: string;
  taker: string;
  takerAmount: string;
  tokenId: string;
}

export interface NewOrder {
  deferExec?: boolean;
  order: ClobSignedOrder;
  orderType: OrderType;
  owner: string;
  postOnly?: boolean;
}

// ─── Response Types ──────────────────────────────────────────────────────────

export interface ClobOrderResponse {
  errorMsg: string;
  makingAmount: string;
  orderID: string;
  status: string;
  success: boolean;
  takingAmount: string;
  tradeIDs?: string[];
  transactionsHashes: string[];
}

export interface BalanceAllowanceResponse {
  allowance: string;
  balance: string;
}

export interface HeartbeatResponse {
  readonly error?: string;
  readonly heartbeat_id: string;
}

export interface MarketPrice {
  p: number;
  t: number;
}

export interface PriceHistoryResponse {
  history: MarketPrice[];
}

export interface PaginationPayload {
  readonly count: number;
  readonly data: unknown[];
  readonly limit: number;
  readonly next_cursor: string;
}

export interface CancelOrdersResponse {
  canceled: string[];
  not_canceled: Record<string, string>;
}

// ─── Contract Config ─────────────────────────────────────────────────────────

export interface ContractConfig {
  collateral: string;
  conditionalTokens: string;
  exchange: string;
  negRiskAdapter: string;
  negRiskExchange: string;
}

// ─── Params ──────────────────────────────────────────────────────────────────

export interface BookParams {
  side: Side;
  token_id: string;
}

export interface TokenPrices {
  BUY?: string;
  SELL?: string;
}

export type PricesResponse = Record<string, TokenPrices>;

export interface TradeParams {
  after?: string;
  asset_id?: string;
  before?: string;
  id?: string;
  maker_address?: string;
  market?: string;
  taker?: string;
}

export interface OpenOrderParams {
  asset_id?: string;
  id?: string;
  market?: string;
}

export interface BalanceAllowanceParams {
  asset_type: AssetType;
  token_id?: string;
}

export interface PriceHistoryFilterParams {
  endTs?: number;
  fidelity?: number;
  interval?: PriceHistoryInterval;
  market?: string;
  startTs?: number;
}

export interface OrderMarketCancelParams {
  asset_id?: string;
  market?: string;
}

// ─── Simplified Market ───────────────────────────────────────────────────────

export interface SimplifiedMarket {
  active: boolean;
  closed: boolean;
  condition_id: string;
  description?: string;
  end_date_iso?: string;
  min_order_size?: number;
  neg_risk?: boolean;
  question: string;
  tick_size?: string;
  tokens: Array<{
    token_id: string;
    outcome: string;
    price: number;
    winner: boolean;
  }>;
}

// ─── Notification Types ──────────────────────────────────────────────────────

export interface Notification {
  created_at: string;
  id: string;
  message: string;
  metadata?: Record<string, unknown>;
  read: boolean;
  type: string;
}

// ─── Order Scoring Types ─────────────────────────────────────────────────────

export interface OrderScoring {
  scoring: boolean;
}

export interface OrdersScoringResponse {
  [orderId: string]: boolean;
}

// ─── Builder Operation Types ─────────────────────────────────────────────────

export interface BuilderOperation {
  condition_id?: string;
  created_at?: string;
  id?: string;
  operation_type: string;
  params: Record<string, unknown>;
  status?: string;
}

// ─── Builder Config Types ────────────────────────────────────────────────────

export interface BuilderApiKeyCreds {
  key: string;
  passphrase: string;
  secret: string;
}

export interface RemoteBuilderConfig {
  token?: string;
  url: string;
}

export interface BuilderConfig {
  localBuilderCreds?: BuilderApiKeyCreds;
  remoteBuilderConfig?: RemoteBuilderConfig;
}

// ─── Order Insert Error ──────────────────────────────────────────────────────

export interface OrderInsertError {
  error: string;
  order?: Record<string, unknown>;
}

// ─── RFQ Types ───────────────────────────────────────────────────────────────

export interface RfqRequest {
  price?: string;
  side: Side;
  size: string;
  token_id: string;
}

export interface RfqQuote {
  expiration: string;
  price: string;
  quote_id: string;
  side: Side;
  size: string;
  token_id: string;
}

export interface RfqRequestParams {
  side: Side;
  size: string;
  token_id: string;
}

export interface RfqRequestResponse {
  quotes: RfqQuote[];
  request_id: string;
  status: string;
}

export interface RfqQuoteParams {
  quote_id: string;
  request_id: string;
}

export interface RfqQuoteResponse {
  error?: string;
  order_id?: string;
  success: boolean;
}

// ─── V2 Types ────────────────────────────────────────────────────────────────

export interface UserOrderV2 {
  builderCode?: string;
  expiration?: number;
  price: number;
  side: Side;
  size: number;
  tokenID: string;
}

/**
 * CLOB market info — mirrors the SDK's `MarketDetails` type.
 * Returned by `getClobMarketInfo(conditionId)`.
 */
export interface ClobMarketInfo {
  /** Condition ID. */
  c: string;
  /** Fee details (platform fees). */
  fd?: {
    /** Fee rate. */
    r?: number;
    /** Fee exponent. */
    e?: number;
    /** Taker only — makers are never charged. */
    to: boolean;
  };
  /** Game start time — ISO 8601 timestamp for sports markets, null otherwise. */
  gst?: string | null;
  /** Blockaid check enabled. */
  ibce?: boolean;
  /** Taker order delay enabled. */
  itode?: boolean;
  /** V1 maker base fee (deprecated in V2). */
  mbf?: number;
  /** Minimum order size (e.g. 5 = $5 minimum). */
  mos?: number;
  /** Minimum tick size. */
  mts: number;
  /** Neg risk flag. */
  nr: boolean;
  /** Minimum order age in seconds before matching. */
  oas?: number;
  /** Rewards configuration (liquidity rewards). */
  r?: {
    /** Maximum spread for reward eligibility. */
    max_spread?: number;
    /** Minimum size for reward eligibility. */
    min_size?: number;
    /** Reward rates. */
    rates?: unknown;
  };
  /** RFQ (Request for Quote) enabled. */
  rfqe?: boolean;
  /** YES and NO tokens. */
  t: [ClobToken | null, ClobToken | null];
  /** V1 taker base fee (deprecated in V2). */
  tbf?: number;
}

export interface ClobToken {
  /** Outcome label (e.g. "Yes", "No"). */
  o: string;
  /** Token ID. */
  t: string;
}

export interface BuilderConfigV2 {
  builderCode: string;
}

/** Regex for a valid bytes32 hex string: 0x prefix + 64 hex characters. */
const BUILDER_CODE_REGEX = /^0x[a-fA-F0-9]{64}$/;

/** Validates that a string is a valid builder code (bytes32 hex: `0x` + 64 hex chars). */
export const isValidBuilderCode = (code: string): boolean =>
  BUILDER_CODE_REGEX.test(code);
