# Hooks Audit Report

## Overview

Audited 5 custom hooks in `apps/web/src/hooks/`:

1. `use-notifications.ts` - Toast & browser notifications
2. `use-orderbook.ts` - WebSocket orderbook integration
3. `use-trading-init.ts` - Trading infrastructure setup
4. `use-comments.ts` - RTDS comment subscriptions
5. `use-crypto-prices.ts` - RTDS crypto price feeds

Plus 1 utility hook:
6. `use-mobile.ts` - Mobile breakpoint detection

## Status: ✅ All Hooks Well-Implemented

### Quality Metrics

| Hook | Lines | Complexity | Type Safety | Tests | Status |
|------|-------|------------|-------------|-------|--------|
| use-notifications | 200 | High | ✅ Strong | ✅ Yes | ✅ Good |
| use-orderbook | 110 | Medium | ✅ Strong | ❌ No | ✅ Good |
| use-trading-init | 120 | Medium | ✅ Strong | ✅ Yes | ✅ Good |
| use-comments | 115 | Medium | ✅ Strong | ❌ No | ✅ Good |
| use-crypto-prices | 95 | Low | ✅ Strong | ❌ No | ✅ Good |
| use-mobile | 25 | Low | ✅ Strong | ❌ No | ✅ Good |

### Strengths

1. **Proper Cleanup** ✅
   - All hooks return cleanup functions from `useEffect`
   - WebSocket subscriptions properly unsubscribed
   - Event handlers properly removed

2. **Type Safety** ✅
   - All hooks use TypeScript types from `@poly/types`
   - Proper return type interfaces defined
   - No `any` types (except intentional casts)

3. **Performance** ✅
   - `useCallback` used appropriately for event handlers
   - `useRef` used to avoid unnecessary re-renders
   - Stable references maintained

4. **Error Handling** ✅
   - `use-trading-init` has comprehensive error handling
   - `use-orderbook` catches fetch errors gracefully
   - WebSocket hooks handle disconnections

5. **Documentation** ✅
   - All hooks have JSDoc comments
   - Requirements referenced where applicable
   - Clear parameter and return type documentation

## Detailed Analysis

### 1. use-notifications.ts

**Purpose**: Wire WebSocket events to toast notifications and browser notifications

**Strengths**:
- Comprehensive notification system
- Handles trade fills, cancellations, and price alerts
- Browser notification permission management
- Preference-based filtering

**Potential Issues**:
- ⚠️ **Store access in helper functions**: `useNotificationsStore.getState()` called in non-hook functions
  - This works but could cause stale reads if store updates during execution
  - Consider passing store state as parameters

**Recommendation**: Minor refactor to pass store state explicitly

```typescript
// Current (works but not ideal)
function processPriceAlertTriggers(...) {
  const store = useNotificationsStore.getState(); // Could be stale
}

// Better
function processPriceAlertTriggers(store: NotificationsStore, ...) {
  // Use passed store
}
```

### 2. use-orderbook.ts

**Purpose**: Fetch initial orderbook and subscribe to WebSocket updates

**Strengths**:
- Fetches initial snapshot via tRPC
- Subscribes to multiple event types (book, price_change, last_trade_price, best_bid_ask)
- Filters events by asset ID
- Handles connection state

**Potential Issues**:
- ⚠️ **Store access pattern**: `useOrderbookStore.getState()` called outside component
  - Should use `useOrderbookStore()` hook or pass functions as props
  - Current pattern works but bypasses React's reactivity

**Recommendation**: Use hook pattern

```typescript
// Current
const { setBook, applyPriceChange, ... } = useOrderbookStore.getState();

// Better
const setBook = useOrderbookStore((s) => s.setBook);
const applyPriceChange = useOrderbookStore((s) => s.applyPriceChange);
// etc.
```

### 3. use-trading-init.ts

**Purpose**: Manage Safe deployment and CLOB credential derivation

**Strengths**:
- Clear state machine (checking → deploying → deriving → complete)
- Comprehensive error handling
- Proper loading states
- Clear return interface

**Issues**: None - well implemented ✅

### 4. use-comments.ts

**Purpose**: Subscribe to RTDS comment events for a market

**Strengths**:
- Proper subscription management
- Connection status tracking
- Comment state management
- Cleanup on unmount

**Potential Issues**:
- ℹ️ **Filter logic**: Comment filtering done client-side after server-side filtering
  - Redundant but harmless
  - Could be simplified

**Recommendation**: Trust server-side filtering

```typescript
// Current - redundant check
if (String(payload.parentEntityID) !== conditionId && ...) {
  // Skip
}

// Better - trust RTDS server-side filtering
// Just process all events since they're already filtered
```

### 5. use-crypto-prices.ts

**Purpose**: Subscribe to Binance and Chainlink crypto price feeds

**Strengths**:
- Subscribes to multiple topics
- Updates prices in Map for efficient lookups
- Sorts prices for display
- Connection status tracking

**Issues**: None - well implemented ✅

### 6. use-mobile.ts

**Purpose**: Detect mobile breakpoint

**Strengths**:
- Uses `matchMedia` API
- Handles SSR (returns `undefined` initially)
- Proper cleanup

**Issues**: None - standard implementation ✅

## Common Patterns (Good)

### 1. WebSocket Hook Pattern ✅

All WebSocket hooks follow consistent pattern:
```typescript
useEffect(() => {
  // 1. Connect if needed
  if (!client.isConnected()) {
    client.connect();
  }
  
  // 2. Subscribe
  client.subscribe(subscriptions);
  
  // 3. Add handler
  const removeHandler = client.addHandler(handleEvent);
  
  // 4. Track status
  const removeStatus = client.onStatusChange(setConnected);
  
  // 5. Cleanup
  return () => {
    removeHandler();
    removeStatus();
    client.unsubscribe(subscriptions);
  };
}, [dependencies]);
```

### 2. Stable References ✅

Proper use of `useRef` to avoid unnecessary re-renders:
```typescript
const stableIds = useRef(assetIds);
useEffect(() => {
  stableIds.current = assetIds;
}, [assetIds]);
```

### 3. Memoized Callbacks ✅

Event handlers wrapped in `useCallback`:
```typescript
const handleEvent = useCallback((event) => {
  // Handler logic
}, [dependencies]);
```

## Test Coverage

### Tested Hooks ✅
- `use-notifications.ts` - Has test file
- `use-trading-init.ts` - Has test file

### Untested Hooks ⚠️
- `use-orderbook.ts` - No tests
- `use-comments.ts` - No tests
- `use-crypto-prices.ts` - No tests
- `use-mobile.ts` - No tests

**Recommendation**: Add tests for WebSocket hooks to verify:
- Subscription/unsubscription
- Event handling
- Cleanup
- Error cases

## Type Usage

### Correct Type Imports ✅

All hooks import types from `@poly/types`:
```typescript
import type { LastTradePriceEvent } from "@poly/types/websocket";
import type { MarketChannelEvent } from "@/lib/websocket/market-channel";
import type { UserChannelEvent } from "@/lib/websocket/user-channel";
```

### No Type Issues ✅

- No `any` types (except intentional casts)
- All parameters typed
- All return types defined
- Proper use of `type` imports

## Performance Considerations

### Good Practices ✅

1. **Stable refs**: `useRef` for values that shouldn't trigger re-renders
2. **Memoized callbacks**: `useCallback` for event handlers
3. **Efficient state updates**: Using functional updates `setState(prev => ...)`
4. **Cleanup**: All subscriptions cleaned up

### Potential Optimizations

1. **use-orderbook**: Could debounce price change events if they're too frequent
2. **use-notifications**: Could batch multiple alerts if many trigger at once

## Security Considerations

### Good Practices ✅

1. **Browser API checks**: All hooks check for `typeof window !== "undefined"`
2. **Permission checks**: Notification permission properly requested
3. **Input validation**: Event types validated before processing

### No Issues Found ✅

## Recommendations

### High Priority

None - all hooks are well-implemented

### Medium Priority

1. **Add tests** for untested hooks (especially WebSocket hooks)
2. **Refactor store access** in `use-notifications` and `use-orderbook` to use hook pattern

### Low Priority

1. **Simplify filtering** in `use-comments` (trust server-side filtering)
2. **Add debouncing** to `use-orderbook` if price updates are too frequent

## Conclusion

✅ **All hooks are well-implemented and production-ready**

The hooks follow React best practices:
- Proper cleanup
- Type safety
- Performance optimization
- Error handling
- Documentation

Minor improvements suggested but no critical issues found.

## Files Reviewed

1. `apps/web/src/hooks/use-notifications.ts` (200 lines)
2. `apps/web/src/hooks/use-orderbook.ts` (110 lines)
3. `apps/web/src/hooks/use-trading-init.ts` (120 lines)
4. `apps/web/src/hooks/use-comments.ts` (115 lines)
5. `apps/web/src/hooks/use-crypto-prices.ts` (95 lines)
6. `apps/web/src/hooks/use-mobile.ts` (25 lines)

**Total**: 665 lines of hook code, all well-structured and maintainable.
