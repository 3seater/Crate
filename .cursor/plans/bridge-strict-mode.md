# Bridge Strict Mode Implementation

**Date**: 2026-03-21  
**Status**: ✅ Complete

## Problem

User noticed many unusual token variants appearing in the bridge UI that weren't in Polymarket's official documentation:

- Wrapped tokens: WETH, WBTC
- Staked tokens: stHYPE
- Synthetic tokens: WUSDe, UETH, UBTC
- Undocumented tokens: AUSD, MON, HYPE

These tokens were coming directly from Polymarket's `/supported-assets` API endpoint, but they're not listed in the official docs at https://docs.polymarket.com/trading/bridge/supported-assets.

## Root Cause

The bridge configuration was using "forward compatibility mode" where any chain or token NOT in the config would be allowed by default:

```typescript
// OLD CODE (forward compatibility)
if (!config) {
    return true; // Allow unknown tokens/chains
}
```

This meant all the wrapped/staked variants from Polymarket's API were passing through the filter.

## Solution

Switched to **STRICT MODE** where only explicitly listed chains and tokens are allowed:

```typescript
// NEW CODE (strict mode)
if (!config) {
    return false; // Block unknown tokens/chains
}
```

### Changes Made

1. **`apps/server/src/config/bridge.ts`**:
   - Updated `isChainEnabled()` to return `false` for unknown chains
   - Updated `isTokenEnabled()` to return `false` for unknown tokens
   - Added comments explaining strict mode
   - Updated header documentation

2. **`apps/server/src/config/BRIDGE_CONFIG.md`**:
   - Added "STRICT MODE" explanation in overview
   - Removed Tier 3 chains section (HyperEVM, Abstract, Monad, etc.)
   - Removed undocumented tokens from lists
   - Added "Removed Chains" and "Removed Tokens" sections
   - Updated "Forward Compatibility" section to explain strict mode

## Current Configuration

### Chains (9 total)
- **Tier 1**: Ethereum, Polygon, Arbitrum, Base, Optimism
- **Tier 2**: BNB Smart Chain, Solana, Bitcoin, Tron

### Tokens (26 total)
- **Stablecoins**: USDC, USDT, DAI, USDe, USDS, BUSD
- **Major cryptos**: ETH, WETH, BTC, WBTC, cbBTC, BTCB, SOL
- **Network tokens**: POL, ARB, OP, BNB
- **DeFi**: AAVE, UNI, LINK, AERO, SAND
- **Political**: TRUMP

### Blocked Chains
- HyperEVM, Abstract, Monad, Ethereal, Katana, Lighter (unverified chain IDs)

### Blocked Tokens
- AUSD, UBTC, HYPE, stHYPE, MON, WUSDe, UETH (not in official docs)

## Why Keep WETH and WBTC?

While WETH and WBTC are wrapped versions, they ARE listed in Polymarket's official documentation and are commonly used for bridging. Users expect to see these options.

## Environment Variable Override

Users can still disable any chain or token via environment variables:

```env
BRIDGE_DISABLED_CHAINS=1,137  # Disable Ethereum and Polygon
BRIDGE_DISABLED_TOKENS=TRUMP,WETH  # Disable specific tokens
```

## Testing

Type check passed:
```bash
pnpm check-types
✓ All packages passed type checking
```

## Next Steps

1. Test bridge UI to verify only correct tokens/chains appear
2. Monitor Polymarket API responses to see what tokens are being filtered
3. If Polymarket adds new officially documented tokens, add them to `BRIDGE_TOKENS`

## Files Modified

- `apps/server/src/config/bridge.ts` - Strict mode logic
- `apps/server/src/config/BRIDGE_CONFIG.md` - Documentation update
