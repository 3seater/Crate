/**
 * WebSocket message fixtures derived from Polymarket official docs.
 * Source: docs/POLYMARKET.md (RTDS, CLOB, Sports sections).
 *
 * These fixtures represent real API payloads as documented. Tests use them
 * to verify schemas accept valid spec-compliant messages.
 */

// ---------------------------------------------------------------------------
// RTDS Comments (docs.polymarket.com/developers/RTDS/RTDS-comments)
// ---------------------------------------------------------------------------

/** Example from RTDS Comments docs - new comment created */
export const RTDS_COMMENT_CREATED_DOC = {
  topic: "comments",
  type: "comment_created",
  timestamp: 1_753_454_975_808,
  payload: {
    body: "do you know what the term encircle means?",
    createdAt: "2025-07-25T14:49:35.801298Z",
    id: "1763355",
    parentCommentID: "1763325",
    parentEntityID: 18_396,
    parentEntityType: "Event",
    profile: {
      baseAddress: "0xce533188d53a16ed580fd5121dedf166d3482677",
      displayUsernamePublic: true,
      name: "salted.caramel",
      proxyWallet: "0x4ca749dcfa93c87e5ee23e2d21ff4422c7a4c1ee",
      pseudonym: "Adored-Disparity",
    },
    reactionCount: 0,
    replyAddress: "0x0bda5d16f76cd1d3485bcc7a44bc6fa7db004cdd",
    reportCount: 0,
    userAddress: "0xce533188d53a16ed580fd5121dedf166d3482677",
  },
} as const;

/** Top-level comment: parentCommentID is null per docs */
export const RTDS_TOP_LEVEL_COMMENT_DOC = {
  topic: "comments",
  type: "comment_created",
  timestamp: 1_753_454_985_123,
  payload: {
    body: "Top-level comment",
    createdAt: "2025-07-25T14:49:45.120000Z",
    id: "1763356",
    parentCommentID: null,
    parentEntityID: 18_396,
    parentEntityType: "Event",
    profile: {
      baseAddress: "0x1234567890abcdef1234567890abcdef12345678",
      displayUsernamePublic: true,
      name: "trader",
      proxyWallet: "0x9876543210fedcba9876543210fedcba98765432",
      pseudonym: "Bright-Analysis",
    },
    reactionCount: 0,
    replyAddress: "0x0bda5d16f76cd1d3485bcc7a44bc6fa7db004cdd",
    reportCount: 0,
    userAddress: "0x1234567890abcdef1234567890abcdef12345678",
  },
} as const;

// ---------------------------------------------------------------------------
// RTDS Crypto Prices (docs.polymarket.com/developers/RTDS/RTDS-crypto-prices)
// ---------------------------------------------------------------------------

/** Binance source - lowercase symbol format (solusdt, btcusdt) */
export const RTDS_CRYPTO_BINANCE_DOC = {
  topic: "crypto_prices",
  type: "update",
  timestamp: 1_753_314_064_237,
  payload: {
    symbol: "solusdt",
    timestamp: 1_753_314_064_213,
    value: 189.55,
  },
} as const;

/** Chainlink source - slash-separated symbol (eth/usd, btc/usd) */
export const RTDS_CRYPTO_CHAINLINK_DOC = {
  topic: "crypto_prices_chainlink",
  type: "update",
  timestamp: 1_753_314_064_237,
  payload: {
    symbol: "eth/usd",
    timestamp: 1_753_314_064_213,
    value: 3456.78,
  },
} as const;

// ---------------------------------------------------------------------------
// CLOB Market Channel (docs.polymarket.com/developers/CLOB/websocket/market-channel)
// ---------------------------------------------------------------------------

/** book event - bids/asks format per docs */
export const CLOB_BOOK_DOC = {
  event_type: "book",
  asset_id:
    "65818619657568813474341868652308942079804919287380422192892211131408793125422",
  market: "0xbd31dc8a20211944f6b70f31557f1001557b59905b7738480ca09bd4532f84af",
  bids: [
    { price: ".48", size: "30" },
    { price: ".49", size: "20" },
    { price: ".50", size: "15" },
  ],
  asks: [
    { price: ".52", size: "25" },
    { price: ".53", size: "60" },
    { price: ".54", size: "10" },
  ],
  timestamp: "123456789000",
  hash: "0x0....",
} as const;

/** last_trade_price event per docs */
export const CLOB_LAST_TRADE_PRICE_DOC = {
  asset_id:
    "114122071509644379678018727908709560226618148003371446110114509806601493071694",
  event_type: "last_trade_price",
  fee_rate_bps: "0",
  market: "0x6a67b9d828d53862160e470329ffea5246f338ecfffdf2cab45211ec578b0347",
  price: "0.456",
  side: "BUY",
  size: "219.217767",
  timestamp: "1750428146322",
} as const;

/** best_bid_ask event per docs */
export const CLOB_BEST_BID_ASK_DOC = {
  event_type: "best_bid_ask",
  market: "0x0005c0d312de0be897668695bae9f32b624b4a1ae8b140c49f08447fcc74f442",
  asset_id:
    "85354956062430465315924116860125388538595433819574542752031640332592237464430",
  best_bid: "0.73",
  best_ask: "0.77",
  spread: "0.04",
  timestamp: "1766789469958",
} as const;

/** price_change event per docs */
export const CLOB_PRICE_CHANGE_DOC = {
  market: "0x5f65177b394277fd294cd75650044e32ba009a95022d88a0c1d565897d72f8f1",
  price_changes: [
    {
      asset_id:
        "71321045679252212594626385532706912750332728571942532289631379312455583992563",
      price: "0.5",
      size: "200",
      side: "BUY",
      hash: "56621a121a47ed9333273e21c83b660cff37ae50",
      best_bid: "0.5",
      best_ask: "1",
    },
  ],
  timestamp: "1757908892351",
  event_type: "price_change",
} as const;

/** tick_size_change event per docs */
export const CLOB_TICK_SIZE_CHANGE_DOC = {
  event_type: "tick_size_change",
  asset_id:
    "65818619657568813474341868652308942079804919287380422192892211131408793125422",
  market: "0xbd31dc8a20211944f6b70f31557f1001557b59905b7738480ca09bd4532f84af",
  old_tick_size: "0.01",
  new_tick_size: "0.001",
  side: "buy",
  timestamp: "100000000",
} as const;

// ---------------------------------------------------------------------------
// CLOB User Channel (docs.polymarket.com/developers/CLOB/websocket/user-channel)
// ---------------------------------------------------------------------------

/** trade event - maker_orders format from docs (no maker_address, fee_rate_bps, side in maker) */
export const CLOB_TRADE_DOC = {
  asset_id:
    "52114319501245915516055106046884209969926127482827954674443846427813813222426",
  event_type: "trade",
  id: "28c4d2eb-bbea-40e7-a9f0-b2fdb56b2c2e",
  last_update: "1672290701",
  maker_orders: [
    {
      asset_id:
        "52114319501245915516055106046884209969926127482827954674443846427813813222426",
      matched_amount: "10",
      order_id:
        "0xff354cd7ca7539dfa9c28d90943ab5779a4eac34b9b37a757d7b32bdfb11790b",
      outcome: "YES",
      owner: "9180014b-33c8-9240-a14b-bdca11c0a465",
      price: "0.57",
    },
  ],
  market: "0xbd31dc8a20211944f6b70f31557f1001557b59905b7738480ca09bd4532f84af",
  matchtime: "1672290701",
  outcome: "YES",
  owner: "9180014b-33c8-9240-a14b-bdca11c0a465",
  price: "0.57",
  side: "BUY",
  size: "10",
  status: "MATCHED",
  taker_order_id:
    "0x06bc63e346ed4ceddce9efd6b3af37c8f8f440c92fe7da6b2d0f9e4ccbc50c42",
  timestamp: "1672290701",
  trade_owner: "9180014b-33c8-9240-a14b-bdca11c0a465",
  type: "TRADE",
} as const;

/** order PLACEMENT event per docs */
export const CLOB_ORDER_PLACEMENT_DOC = {
  asset_id:
    "52114319501245915516055106046884209969926127482827954674443846427813813222426",
  associate_trades: null,
  event_type: "order",
  id: "0xff354cd7ca7539dfa9c28d90943ab5779a4eac34b9b37a757d7b32bdfb11790b",
  market: "0xbd31dc8a20211944f6b70f31557f1001557b59905b7738480ca09bd4532f84af",
  order_owner: "9180014b-33c8-9240-a14b-bdca11c0a465",
  original_size: "10",
  outcome: "YES",
  owner: "9180014b-33c8-9240-a14b-bdca11c0a465",
  price: "0.57",
  side: "SELL",
  size_matched: "0",
  timestamp: "1672290687",
  type: "PLACEMENT",
} as const;

// ---------------------------------------------------------------------------
// Sports WebSocket (docs.polymarket.com/developers/sports-websocket/message-format)
// ---------------------------------------------------------------------------

/** NFL sport_result in progress per docs */
export const SPORTS_NFL_IN_PROGRESS_DOC = {
  gameId: 19_439,
  leagueAbbreviation: "nfl",
  homeTeam: "LAC",
  awayTeam: "BUF",
  status: "InProgress",
  score: "3-16",
  period: "Q4",
  elapsed: "5:18",
  live: true,
  ended: false,
  turn: "lac",
} as const;

/** Esports CS2 finished per docs */
export const SPORTS_CS2_FINISHED_DOC = {
  gameId: 1_317_359,
  leagueAbbreviation: "cs2",
  homeTeam: "ARCRED",
  awayTeam: "The glecs",
  status: "finished",
  score: "000-000|2-0|Bo3",
  period: "2/3",
  live: false,
  ended: true,
} as const;
