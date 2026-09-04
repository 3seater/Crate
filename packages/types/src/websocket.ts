export interface BookEvent {
  asks: Array<{ price: string; size: string }>;
  asset_id: string;
  bids: Array<{ price: string; size: string }>;
  event_type: "book";
  hash?: string;
  market: string;
  timestamp: string;
}

export interface PriceChangeEvent {
  event_type: "price_change";
  market: string;
  price_changes: Array<{
    asset_id: string;
    price: string;
    size: string;
    side: "BUY" | "SELL";
    hash?: string;
    best_bid?: string;
    best_ask?: string;
  }>;
  timestamp: string;
}

export interface LastTradePriceEvent {
  asset_id: string;
  event_type: "last_trade_price";
  fee_rate_bps: string;
  market: string;
  price: string;
  side: "BUY" | "SELL";
  size: string;
  timestamp: string;
}

export interface BestBidAskEvent {
  asset_id: string;
  best_ask: string;
  best_bid: string;
  event_type: "best_bid_ask";
  market: string;
  spread: string;
  timestamp: string;
}

export interface UserTradeEvent {
  asset_id: string;
  event_type: "trade";
  /** Optional; some API responses include top-level fee rate. */
  fee_rate_bps?: string;
  id: string;
  last_update: string;
  maker_orders: Array<{
    order_id: string;
    owner: string;
    matched_amount: string;
    price: string;
    asset_id: string;
    outcome: string;
    maker_address?: string;
    fee_rate_bps?: string;
    side?: string;
  }>;
  market: string;
  /** Polymarket may omit in some early/edge trade events. */
  matchtime?: string;
  outcome: string;
  owner: string;
  price: string;
  side: "BUY" | "SELL";
  size: string;
  status: "MATCHED" | "MINED" | "CONFIRMED" | "RETRYING" | "FAILED";
  taker_order_id: string;
  timestamp: string;
  trade_owner: string;
  /** Transaction hash for Polygonscan link. Polymarket may include in trade events. */
  transaction_hash?: string;
  type: "TRADE";
}

export interface UserOrderEvent {
  asset_id: string;
  associate_trades: string[] | null;
  created_at?: string;
  event_type: "order";
  expiration?: string;
  id: string;
  maker_address?: string;
  market: string;
  order_owner: string;
  order_type?: string;
  original_size: string;
  outcome: string;
  owner: string;
  price: string;
  side: "BUY" | "SELL";
  size_matched: string;
  /** Optional; used in tests and some API responses. */
  status?: string;
  timestamp: string;
  type: "PLACEMENT" | "UPDATE" | "CANCELLATION";
}

export interface TickSizeChangeEvent {
  asset_id: string;
  event_type: "tick_size_change";
  market?: string;
  new_tick_size: string;
  old_tick_size?: string;
  side?: string;
  timestamp?: string;
}

export interface EventMessage {
  description?: string;
  id: string;
  slug?: string;
  ticker?: string;
  title?: string;
}

export interface NewMarketEvent {
  assets_ids?: string[];
  description?: string;
  event_message?: EventMessage | null;
  event_type: "new_market";
  id: string;
  market: string;
  outcomes?: string[];
  question?: string;
  slug?: string;
  timestamp: string;
}

export interface MarketResolvedEvent {
  assets_ids?: string[];
  description?: string;
  event_message?: EventMessage | null;
  event_type: "market_resolved";
  id: string;
  market: string;
  outcomes?: string[];
  question?: string;
  slug?: string;
  timestamp: string;
  winning_asset_id?: string;
  winning_outcome?: string;
}

/** Type guards for market channel WebSocket events */
export function isBookEvent(e: { event_type?: string }): e is BookEvent {
  return e.event_type === "book";
}

export function isLastTradePriceEvent(e: {
  event_type?: string;
}): e is LastTradePriceEvent {
  return e.event_type === "last_trade_price";
}

export function isPriceChangeEvent(e: {
  event_type?: string;
}): e is PriceChangeEvent {
  return e.event_type === "price_change";
}

export function isTickSizeChangeEvent(e: {
  event_type?: string;
}): e is TickSizeChangeEvent {
  return e.event_type === "tick_size_change";
}

export function isBestBidAskEvent(e: {
  event_type?: string;
}): e is BestBidAskEvent {
  return e.event_type === "best_bid_ask";
}
