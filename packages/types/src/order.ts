/** @deprecated V1 order type — use SignedOrderV2 for CLOB V2. Retained for reference only. */
export interface SignedOrder {
  expiration: string;
  feeRateBps: string;
  maker: string;
  makerAmount: string;
  nonce: string;
  salt: string;
  side: 0 | 1;
  signature: string;
  signatureType: number;
  signer: string;
  taker: string;
  takerAmount: string;
  tokenId: string;
}

export interface SignedOrderV2 {
  builder?: string;
  // Retained from V1
  expiration: string;
  maker: string;
  makerAmount: string;
  metadata?: string;
  salt: string;
  side: 0 | 1;
  signature: string;
  signatureType: number;
  signer: string;
  takerAmount: string;

  // NEW in V2
  timestamp: string;
  tokenId: string;
}

export interface OpenOrder {
  asset_id: string;
  associate_trades: string[];
  created_at: string;
  expiration: string;
  id: string;
  maker_address: string;
  market: string;
  original_size: string;
  outcome: string;
  owner: string;
  price: string;
  side: "BUY" | "SELL";
  size_matched: string;
  status: string;
  type: "GTC" | "GTD" | "FOK" | "FAK";
}

import type { OrderStatus } from "./clob";

export interface OrderResponse {
  errorMsg: string;
  makingAmount?: string;
  orderID: string;
  status: OrderStatus;
  success: boolean;
  takingAmount?: string;
  transactionsHashes: string[];
}

export interface OrderFormState {
  expiration?: number;
  negRisk: boolean;
  orderType: "GTC" | "GTD" | "FOK" | "FAK";
  postOnly: boolean;
  price: number;
  side: "BUY" | "SELL";
  size: number;
  tokenId: string;
}

export interface UserOrder {
  asset_id: string;
  created_at: string;
  expiration: string;
  id: string;
  market: string;
  original_size: string;
  price: string;
  side: "BUY" | "SELL";
  size_matched: string;
  status: string;
  type: "GTC" | "GTD" | "FOK" | "FAK";
}

export interface UserMarketOrder {
  conditionId: string;
  orders: UserOrder[];
}
