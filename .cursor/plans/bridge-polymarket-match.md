# Bridge Configuration - Match Polymarket Frontend Exactly

**Date**: 2026-03-21  
**Status**: ✅ Complete

## Objective

Update bridge configuration to match Polymarket's frontend exactly, based on screenshots provided by user.

## Changes Made

### Networks (13 total)

Updated `BRIDGE_CHAINS` to match Polymarket's UI order and minimum deposits:

1. Ethereum (Min $10) - order 1
2. Solana (Min $3) - order 2
3. BSC (Min $3) - order 3
4. Base (Min $3) - order 4
5. Polygon (Min $3) - order 5
6. Arbitrum (Min $3) - order 6
7. Tron (Min $10) - order 7
8. Bitcoin (Min $10) - order 8
9. Optimism (Min $3) - order 9
10. Monad (Min $3) - order 10
11. HyperEVM (Min $3) - order 11
12. Abstract (Min $3) - order 12
13. Ethereal (Min $3) - order 13

**Key Changes:**
- Re-enabled Monad, HyperEVM, Abstract, Ethereal (they ARE on Polymarket's frontend)
- Updated minimum deposits to match Polymarket ($10 for Ethereum/Tron/Bitcoin, $3 for others)
- Reordered chains to match Polymarket's display order
- Changed "BNB Smart Chain" to "BSC" to match their UI

### Tokens (21 total)

Updated `BRIDGE_TOKENS` to match Polymarket's UI order (USDC first, WETH last):

1. USDC - order 1
2. USDC.e - order 2
3. ARB - order 3
4. BNB - order 4
5. BTC - order 5
6. BTCB - order 6
7. BUSD - order 7
8. DAI - order 8
9. ETH - order 9
10. HYPE - order 10
11. MATIC - order 11
12. MON - order 12
13. POL - order 13
14. SOL - order 14
15. TRUMP - order 15
16. U - order 16
17. UBTC - order 17
18. USDe - order 18
19. USDT - order 19
20. WBNB - order 20
21. WETH - order 21

**Key Changes:**
- Reordered to match Polymarket's display order (USDC first, WETH last)
- Removed CBBTC (not on Polymarket's frontend)
- Added tokens that were previously removed: HYPE, MON, UBTC, MATIC, U, WBNB, WETH, USDC.e
- Removed tokens NOT on Polymarket's frontend: USDS, WBTC, cbBTC, CBBTC, OP, AAVE, UNI, LINK, AERO, SAND
- Added special handling for "USDC.e" (dot in symbol name)

### Code Improvements

1. **Chain Name Aliasing**: Added logic to handle "BNB Smart Chain" vs "BSC" naming differences
2. **Token Symbol Normalization**: Improved handling of special characters in token symbols (e.g., "USDC.e")
3. **Strict Mode**: Maintained strict filtering - only explicitly listed chains/tokens are shown

## Files Modified

- `apps/server/src/config/bridge.ts` - Updated chains, tokens, and helper functions
- `apps/server/src/config/BRIDGE_CONFIG.md` - Updated documentation to reflect exact match

## Testing

✅ Type check passed for server package:
```bash
pnpm --filter server check-types
```

## Next Steps

1. Start dev server and test bridge UI
2. Verify all 13 chains appear in correct order (Ethereum first, Ethereal last)
3. Verify all 21 tokens appear in correct order (USDC first, WETH last)
4. Test deposit flow with various chain/token combinations
5. Verify minimum deposit amounts are enforced
6. Confirm cbBTC does not appear in dropdown

## Notes

- Configuration now matches Polymarket's frontend as of 2026-03-21
- If Polymarket updates their frontend, we'll need to update our config accordingly
- Strict mode ensures no extra tokens/chains leak through from API
- Environment variables can still be used to disable specific chains/tokens if needed
