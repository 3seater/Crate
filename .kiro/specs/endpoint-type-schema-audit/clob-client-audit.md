# CLOB Client Implementation Audit

## Summary

Your custom CLOB client in `packages/clob/` has most core methods implemented. This document tracks what needs validation against the official Polymarket CLOB API.

## ✅ Implemented Methods

### Public Methods (No Auth Required)
- ✅ `getServerTime()`
- ✅ `getGeoRestriction()`
- ✅ `getOrderBook(tokenID)`
- ✅ `getOrderBooks(params)`
- ✅ `getMidpoint(tokenID)`
- ✅ `getPrice(tokenID, side)`
- ✅ `getSpread(tokenID)`
- ✅ `getLastTradePrice(tokenID)`
- ✅ `getTickSize(tokenID)`
- ✅ `getNegRisk(tokenID)`
- ✅ `getFeeRateBps(tokenID)`
- ✅ `getPricesHistory(params)`
- ✅ `calculateMarketPrice(tokenID, side, amount, orderType?)`

### L1 Methods (Wallet Required)
- ✅ `createApiKey(nonce?)`
- ✅ `deriveApiKey(nonce?)`
- ✅ `createOrDeriveApiKey(nonce?)`
- ✅ `createOrder(userOrder, options?)`
- ✅ `createMarketOrder(userMarketOrder, options?)`

### L2 Methods (API Creds Required)
- ✅ `postOrder(order, orderType?, postOnly?)`
- ✅ `postOrders(args)`
- ✅ `cancelOrder(orderID)`
- ✅ `cancelOrders(orderIDs)`
- ✅ `getOpenOrders(params?)`
- ✅ `getTrades(params?)`
- ✅ `getTradesPaginated(params?)`

## ❓ Methods to Verify

### Public Methods
- ❓ `getOk()` - Health check endpoint
- ❓ `getMarket(conditionId)` - Single market details
- ❓ `getMarkets()` - Paginated markets
- ❓ `getSimplifiedMarkets()` - Simplified market data
- ❓ `getSamplingMarkets()` - Sampling markets
- ❓ `getSamplingSimplifiedMarkets()` - Sampling simplified
- ❓ `getPrices(params)` - Batch prices
- ❓ `getMidpoints(params)` - Batch midpoints
- ❓ `getSpreads(params)` - Batch spreads
- ❓ `getLastTradesPrices(params)` - Batch last trade prices
- ❓ `getMarketTradesEvents(conditionID)` - Market trade events

### L2 Methods
- ❓ `createAndPostOrder(userOrder, options?, orderType?)` - Convenience method
- ❓ `createAndPostMarketOrder(userMarketOrder, options?, orderType?)` - Convenience method
- ❓ `cancelAll()` - Cancel all orders
- ❓ `cancelMarketOrders(payload)` - Cancel by market
- ❓ `getOrder(orderID)` - Single order details
- ❓ `getBalanceAllowance(params?)` - Balance and allowance
- ❓ `updateBalanceAllowance(params?)` - Update cached balance
- ❓ `getApiKeys()` - List API keys
- ❓ `deleteApiKey()` - Revoke current API key
- ❓ `getNotifications()` - Get event notifications
- ❓ `dropNotifications(params?)` - Mark notifications as read
- ❓ `isOrderScoring(params)` - Check single order scoring
- ❓ `areOrdersScoring(params)` - Check multiple orders scoring

### Builder Methods
- ❓ `getBuilderTrades(params?)` - Builder-attributed trades
- ❓ `revokeBuilderApiKey()` - Revoke builder API key

### WebSocket Support
- ❓ WebSocket connection handling for market channel
- ❓ WebSocket connection handling for user channel
- ❓ PING/PONG heartbeat implementation
- ❓ Message type discrimination (book, price_change, trade, order, etc.)
- ❓ Subscription/unsubscription to assets_ids and markets
- ❓ WebSocket authentication for user channel
- ❓ Sports WebSocket connection (`wss://sports-api.polymarket.com/ws`)
- ❓ Sports WebSocket PING/PONG handling (5s interval, 10s timeout)

## 🔍 Type Validation Needed

### Request Types
- [ ] `UserOrder` - matches official interface?
- [ ] `UserMarketOrder` - matches official interface?
- [ ] `CreateOrderOptions` - matches official interface?
- [ ] `BookParams` - **MUST have `token_id` and optional `side` ("BUY" | "SELL")**
- [ ] `OpenOrderParams` - matches official interface?
- [ ] `TradeParams` - matches official interface?
- [ ] `BalanceAllowanceParams` - matches official interface?
- [ ] `OrderMarketCancelParams` - matches official interface?
- [ ] `PriceHistoryFilterParams` - **MUST have `market` (token_id), optional `startTs`, `endTs`, `interval` ("1m"|"1w"|"1d"|"6h"|"1h"|"max"), `fidelity`**

### Response Types (from OpenAPI specs)

#### OrderBookSummary (CRITICAL - verify all fields)
```typescript
interface OrderBookSummary {
  market: string;           // Market identifier
  asset_id: string;         // Token ID
  timestamp: string;        // ISO 8601 date-time
  hash: string;             // Order book state hash
  bids: OrderLevel[];       // Bid levels
  asks: OrderLevel[];       // Ask levels
  min_order_size: string;   // Minimum order size
  tick_size: string;        // "0.1" | "0.01" | "0.001" | "0.0001"
  neg_risk: boolean;        // Negative risk enabled
}

interface OrderLevel {
  price: string;  // Price as string for precision
  size: string;   // Size as string for precision
}
```

#### PriceResponse
```typescript
interface PriceResponse {
  price: string;  // Market price as string
}
```

#### PricesResponse (nested map structure)
```typescript
type PricesResponse = {
  [tokenId: string]: {
    BUY?: string;
    SELL?: string;
  };
};
```

#### MidpointResponse
```typescript
interface MidpointResponse {
  mid: string;  // Midpoint price as string
}
```

#### PriceHistoryResponse
```typescript
interface PriceHistoryResponse {
  history: Array<{
    t: number;  // UTC timestamp
    p: number;  // Price
  }>;
}
```

#### SpreadsResponse
```typescript
type SpreadsResponse = {
  [tokenId: string]: string;  // token_id -> spread value
};
```

#### OrderResponse (POST /order, POST /orders)
```typescript
interface OrderResponse {
  success: boolean;           // Server-side success indicator
  errorMsg: string;           // Error message if unsuccessful
  orderID: string;            // Order ID
  transactionsHashes: string[]; // Settlement transaction hashes if matched
  status: "matched" | "live" | "delayed" | "unmatched";
  takingAmount: string;       // Amount taken
  makingAmount: string;       // Amount made
}
```

#### OpenOrder (GET /data/order, GET /data/orders)
```typescript
interface OpenOrder {
  id: string;                 // Order ID (hash)
  status: string;             // Order status
  owner: string;              // API key
  maker_address: string;      // Maker address (funder)
  market: string;             // Market ID (condition ID)
  asset_id: string;           // Token ID
  side: string;               // "BUY" or "SELL"
  original_size: string;      // Original order size at placement
  size_matched: string;       // Size matched/filled
  price: string;              // Price
  associate_trades: string[]; // Trade IDs order was included in
  outcome: string;            // Human-readable outcome
  created_at: number;         // Unix timestamp when created
  expiration: string;         // Unix timestamp when expires (0 if no expiration)
  order_type: string;         // "GTC" | "FOK" | "GTD" | "FAK"
}
```

#### CancelOrdersResponse (DELETE /order, /orders, /cancel-all, /cancel-market-orders)
```typescript
interface CancelOrdersResponse {
  canceled: string[];         // List of canceled order IDs
  not_canceled: Record<string, string>; // order_id -> reason map
}
```

#### OrderScoring (GET /order-scoring, POST /orders-scoring)
```typescript
interface OrderScoring {
  scoring: boolean;  // Single order scoring status
}

type OrdersScoring = Record<string, boolean>; // order_id -> scoring status
```

#### Trade (GET /data/trades)
```typescript
interface Trade {
  id: string;                 // Trade ID
  taker_order_id: string;     // Hash of taker order (market order)
  market: string;             // Market ID (condition ID)
  asset_id: string;           // Asset ID (token ID) of taker order
  side: string;               // "BUY" or "SELL"
  size: string;               // Size
  fee_rate_bps: string;       // Fees in basis points
  price: string;              // Limit price of taker order
  status: "MATCHED" | "MINED" | "CONFIRMED" | "RETRYING" | "FAILED";
  match_time: string;         // Time trade was matched
  last_update: string;        // Timestamp of last status update
  outcome: string;            // Human-readable outcome
  maker_address: string;      // Funder address of taker
  owner: string;              // API key of taker
  transaction_hash: string;   // Transaction hash where executed
  bucket_index: number;       // Bucket index for multi-tx trades
  maker_orders: MakerOrder[]; // Maker orders filled against
  trader_side: "TAKER" | "MAKER"; // Side of the trade
}

interface MakerOrder {
  order_id: string;       // Maker order ID
  maker_address: string;  // Maker address
  owner: string;          // API key of owner
  matched_amount: string; // Size consumed in this trade
  fee_rate_bps: string;   // Fees in basis points
  price: string;          // Price of maker order
  asset_id: string;       // Token/asset ID
  outcome: string;        // Human-readable outcome
  side: string;           // "BUY" or "SELL"
}
```

#### TradeParams (GET /data/trades)
```typescript
interface TradeParams {
  id?: string;            // Trade ID to fetch
  taker?: string;         // Address as taker
  maker?: string;         // Address as maker (use maker_address in query)
  market?: string;        // Market condition ID
  before?: string;        // Unix timestamp cutoff (before)
  after?: string;         // Unix timestamp cutoff (after)
  asset_id?: string;      // Token ID filter
}
```

#### Error Response (all endpoints)
```typescript
interface ErrorResponse {
  error: string;  // Error message
}
```

#### Order Error Messages (from POST /order, POST /orders)
```typescript
type OrderErrorCode = 
  | "INVALID_ORDER_MIN_TICK_SIZE"      // Price breaks tick size rules
  | "INVALID_ORDER_MIN_SIZE"           // Size below minimum
  | "INVALID_ORDER_DUPLICATED"         // Order already placed
  | "INVALID_ORDER_NOT_ENOUGH_BALANCE" // Insufficient balance/allowance
  | "INVALID_ORDER_EXPIRATION"         // Expiration in the past
  | "INVALID_ORDER_ERROR"              // System error inserting order
  | "INVALID_POST_ONLY_ORDER_TYPE"     // Post-only with market order type
  | "INVALID_POST_ONLY_ORDER"          // Post-only order crosses book
  | "EXECUTION_ERROR"                  // System error executing trade
  | "ORDER_DELAYED"                    // Order delayed due to market conditions
  | "DELAYING_ORDER_ERROR"             // System error delaying order
  | "FOK_ORDER_NOT_FILLED_ERROR"       // FOK order not fully filled
  | "MARKET_NOT_READY";                // Market not accepting orders yet
```

#### Trade Status (state machine)
```typescript
type TradeStatus = 
  | "MATCHED"    // Matched, sent to executor (non-terminal)
  | "MINED"      // Mined into chain, no finality (non-terminal)
  | "CONFIRMED"  // Strong finality, successful (terminal)
  | "RETRYING"   // Failed, being retried (non-terminal)
  | "FAILED";    // Failed, not retrying (terminal)
```

### Other Response Types (not yet documented)
- [ ] `Market` - all 30+ fields present?
- [ ] `SimplifiedMarket` - matches official structure?
- [ ] `BalanceAllowanceResponse` - matches official structure?
- [ ] `Notification` - matches official structure?
- [ ] `BuilderTrade` - matches official structure?

### Authentication Types
- [ ] `ApiKeyCreds` - has `apiKey`, `secret`, `passphrase`?
- [ ] L1 headers - `POLY_ADDRESS`, `POLY_SIGNATURE`, `POLY_TIMESTAMP`, `POLY_NONCE`?
- [ ] L2 headers - `POLY_ADDRESS`, `POLY_SIGNATURE`, `POLY_TIMESTAMP`, `POLY_API_KEY`, `POLY_PASSPHRASE`?
- [ ] EIP-712 domain and types - match official structure?

### Order Types
- [ ] `SignedOrder` - all fields: `salt`, `maker`, `signer`, `taker`, `tokenId`, `makerAmount`, `takerAmount`, `side`, `expiration`, `nonce`, `feeRateBps`, `signatureType`, `signature`?
- [ ] `OrderType` enum - GTC, GTD, FOK, FAK?
- [ ] `Side` enum - BUY, SELL?
- [ ] `TickSize` type - "0.1" | "0.01" | "0.001" | "0.0001"?

## 🎯 Priority Actions

1. **Verify OrderBookSummary Type** - CRITICAL: Must have exactly these fields:
   - `market`, `asset_id`, `timestamp` (ISO 8601), `hash`
   - `bids`, `asks` (arrays of `{price: string, size: string}`)
   - `min_order_size`, `tick_size`, `neg_risk`

2. **Validate Price Response Types**:
   - `PriceResponse` → `{ price: string }`
   - `PricesResponse` → `{ [tokenId]: { BUY?: string, SELL?: string } }`
   - `MidpointResponse` → `{ mid: string }`
   - `PriceHistoryResponse` → `{ history: Array<{ t: number, p: number }> }`

3. **Check Request Parameter Types**:
   - `BookParams` → Must have `token_id: string` and optional `side?: "BUY" | "SELL"`
   - `PriceHistoryFilterParams` → Must have `market` (not `token_id`), optional `startTs`, `endTs`, `interval`, `fidelity`

4. **Add Missing Methods** - Implement the convenience methods and batch operations

5. **Test Authentication** - Ensure L1/L2 headers match the official format exactly

6. **Validate Order Structure** - Confirm `SignedOrder` has all required fields including `feeRateBps`

7. **Check Market Types** - Ensure `Market` interface has all 30+ fields from the CLOB API

## 📝 Notes

- Your client uses `viem` instead of `ethers` - this is fine as long as signing produces identical results
- Constructor pattern is different (config object vs positional params) - this is fine for internal use
- Method signatures should match return types exactly to ensure type safety across the monorepo
