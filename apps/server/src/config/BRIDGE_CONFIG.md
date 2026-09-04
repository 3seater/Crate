# Bridge Configuration Guide

This document explains how to configure which chains and tokens are available in the Doji bridge.

## Overview

The bridge configuration system allows you to:
- Enable/disable specific blockchain networks
- Enable/disable specific tokens
- Control display order of chains and tokens
- Set minimum deposit amounts per chain
- Override configuration via environment variables

**STRICT MODE**: Only chains and tokens explicitly listed in the configuration will be shown to users. This configuration matches Polymarket's frontend exactly (as of 2026-03-21).

## Configuration Files

### `apps/server/src/config/bridge.ts`

Main configuration file containing:
- `BRIDGE_CHAINS`: 13 supported blockchain networks (matches Polymarket UI)
- `BRIDGE_TOKENS`: 21 supported tokens (matches Polymarket UI)
- Helper functions for filtering and sorting

## Supported Chains

Matches Polymarket's frontend exactly (as of 2026-03-21):

| Chain | Chain ID | Min Deposit | Address Type | Order |
|-------|----------|-------------|--------------|-------|
| Ethereum | 1 | $10 | EVM | 1 |
| Solana | 1151111081099710 | $3 | SVM | 2 |
| BSC | 56 | $3 | EVM | 3 |
| Base | 8453 | $3 | EVM | 4 |
| Polygon | 137 | $3 | EVM | 5 |
| Arbitrum | 42161 | $3 | EVM | 6 |
| Tron | 728126428 | $10 | TVM | 7 |
| Bitcoin | 8253038 | $10 | BTC | 8 |
| Optimism | 10 | $3 | EVM | 9 |
| Monad | 41454 | $3 | EVM | 10 |
| HyperEVM | 998 | $3 | EVM | 11 |
| Abstract | 2741 | $3 | EVM | 12 |
| Ethereal | 1234 | $3 | EVM | 13 |

## Supported Tokens

Matches Polymarket's frontend exactly (as of 2026-03-21), in display order (USDC first, WETH last):

| Token | Order | Notes |
|-------|-------|-------|
| USDC | 1 | USD Coin (primary) |
| USDC.e | 2 | Bridged USDC |
| ARB | 3 | Arbitrum network token |
| BNB | 4 | Binance network token |
| BTC | 5 | Bitcoin |
| BTCB | 6 | Binance-pegged Bitcoin |
| BUSD | 7 | Binance USD stablecoin |
| DAI | 8 | MakerDAO stablecoin |
| ETH | 9 | Ethereum |
| HYPE | 10 | Hyperliquid token |
| MATIC | 11 | Polygon (old name) |
| MON | 12 | Monad token |
| POL | 13 | Polygon network token |
| SOL | 14 | Solana |
| TRUMP | 15 | Political token |
| U | 16 | Unknown token |
| UBTC | 17 | Wrapped Bitcoin variant |
| USDe | 18 | Ethena stablecoin |
| USDT | 19 | Tether stablecoin |
| WBNB | 20 | Wrapped BNB |
| WETH | 21 | Wrapped ETH |

## How to Disable Chains or Tokens

### Method 1: Environment Variables (Recommended for Production)

Add to your `.env` file:

```env
# Disable specific chains (comma-separated chain IDs)
BRIDGE_DISABLED_CHAINS=999,2741

# Disable specific tokens (comma-separated symbols, case-insensitive)
BRIDGE_DISABLED_TOKENS=TRUMP,MEME
```

**Advantages**:
- No code changes required
- Can be changed without redeployment (restart required)
- Different per environment (dev/staging/prod)

### Method 2: Configuration File (Permanent Changes)

Edit `apps/server/src/config/bridge.ts`:

```typescript
// Disable a chain
abstract: {
  chainId: "2741",
  chainName: "Abstract",
  enabled: false, // ← Set to false
  minDepositUsd: 2,
  addressType: "evm",
  order: 11,
},

// Disable a token
TRUMP: { 
  symbol: "TRUMP", 
  enabled: false, // ← Set to false
  order: 100 
},
```

**Advantages**:
- Permanent change across all environments
- Version controlled
- Clear intent in code

## Display Order

Chains and tokens are sorted by their `order` value (lower = higher priority).

### Current Order:
1. **Stablecoins** (order 1-7): USDC, USDT, DAI, etc.
2. **Major Cryptos** (order 10-17): ETH, BTC, SOL, etc.
3. **Network Tokens** (order 20-26): POL, ARB, OP, etc.
4. **DeFi Tokens** (order 30-36): AAVE, UNI, LINK, etc.
5. **Meme/Political** (order 100+): TRUMP, etc.

To change order, edit the `order` field in the configuration.

## Forward Compatibility vs Strict Mode

The configuration system uses **STRICT MODE** by default:

- **Unknown chains**: If Polymarket adds a new chain not in our config, it will be **filtered out** until explicitly added to `BRIDGE_CHAINS`
- **Unknown tokens**: If Polymarket adds a new token not in our config, it will be **filtered out** until explicitly added to `BRIDGE_TOKENS`

This ensures only the exact chains and tokens shown on Polymarket's frontend appear in our UI.

### Why Match Polymarket Exactly?

By mirroring Polymarket's frontend configuration exactly, we ensure:
- Consistent user experience across platforms
- No confusion from extra/missing options
- Easier support and troubleshooting
- Automatic alignment with Polymarket's tested and verified assets

## Validation

The bridge router (`apps/server/src/routers/bridge.ts`) automatically:
1. Fetches supported assets from Polymarket's `/supported-assets` endpoint
2. Filters out disabled chains (config + env)
3. Filters out disabled tokens (config + env)
4. Sorts by display order
5. Returns filtered list to frontend

## Testing

### Test Disabling a Chain

1. Add to `.env`:
   ```env
   BRIDGE_DISABLED_CHAINS=2741
   ```

2. Restart server:
   ```bash
   pnpm dev:server
   ```

3. Open bridge UI - Abstract should not appear in network dropdown

### Test Disabling a Token

1. Add to `.env`:
   ```env
   BRIDGE_DISABLED_TOKENS=TRUMP
   ```

2. Restart server

3. Open bridge UI - TRUMP should not appear in token dropdown

## Production Deployment

### Vercel

Add environment variables in Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add `BRIDGE_DISABLED_CHAINS` and/or `BRIDGE_DISABLED_TOKENS`
3. Redeploy (or restart if using serverless functions)

### Self-hosted / container

Set the same variables in your process or orchestrator environment (e.g. `BRIDGE_DISABLED_CHAINS`, `BRIDGE_DISABLED_TOKENS`).

## Troubleshooting

### Chain/Token Still Appears After Disabling

1. Check environment variable is set correctly:
   ```bash
   echo $BRIDGE_DISABLED_CHAINS
   ```

2. Restart server (env changes require restart)

3. Clear browser cache (frontend may cache API response)

4. Check server logs for configuration loading

### Chain ID Mismatch

If a chain appears with wrong ID:
1. Check Polymarket's actual `/supported-assets` response
2. Update `BRIDGE_CHAINS` configuration with correct ID
3. Redeploy

### Token Logo Missing

Token logos are fetched from Trust Wallet's GitHub repository. If a logo is missing:
1. Check if token exists in Trust Wallet's repo
2. Fallback letter avatar will be shown automatically
3. No action required - this is expected for new/obscure tokens

## API Reference

### `isChainEnabled(chainId: string, chainName: string): boolean`
Checks if a chain is enabled (config + environment).

### `isTokenEnabled(symbol: string): boolean`
Checks if a token is enabled (config + environment).

### `getChainOrder(chainId: string, chainName: string): number`
Returns display order for a chain (lower = higher priority).

### `getTokenOrder(symbol: string): number`
Returns display order for a token (lower = higher priority).

### `getChainConfig(chainId: string, chainName: string): BridgeChainConfig | null`
Returns full configuration for a chain.

## Related Files

- `apps/server/src/config/bridge.ts` - Main configuration
- `apps/server/src/routers/bridge.ts` - Bridge API router with filtering
- `packages/env/src/server.ts` - Environment variable schema
- `apps/server/.env.example` - Example environment variables
- `apps/web/src/components/bridge/` - Frontend bridge components

## Support

For questions or issues:
1. Check Polymarket's official documentation: https://docs.polymarket.com
2. Review this configuration guide
3. Check server logs for errors
4. Contact team lead or DevOps
