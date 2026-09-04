# Magic + Polymarket Builder Integration

Complete implementation guide for integrating Magic authentication with Polymarket's Builder Program for gasless prediction market trading.

## Overview

This integration enables:
- **Passwordless authentication** via Magic Link
- **Gasless Safe wallet deployment** with builder attribution
- **Non-custodial trading** on Polymarket
- **Order rewards** through Builder Program

## Architecture

### Client-Side Flow
1. User authenticates with Magic (email/social login)
2. Magic SDK creates EOA signer in browser
3. Client deploys Gnosis Safe using Builder Relayer
4. Client derives CLOB API credentials
5. Client initializes ClobClient for trading

### Server-Side Flow
1. Validate DID tokens from Magic
2. Sign builder requests via `/api/polymarket/sign`
3. Store Safe address in database
4. Store encrypted CLOB credentials

## Setup

### 1. Environment Variables

**Server** (`apps/server/.env`):
```bash
# Magic Authentication
MAGIC_SECRET_KEY=sk_live_...

# Polymarket Builder Program
POLYMARKET_BUILDER_ID=your-builder-id
POLYMARKET_BUILDER_SIGNING_KEY=your-builder-signing-key
```

**Web** (`apps/web/.env.local`):
```bash
# Magic Authentication
NEXT_PUBLIC_MAGIC_PUBLISHABLE_KEY=pk_live_...

# Polygon RPC
NEXT_PUBLIC_POLYGON_RPC_URL=https://polygon-rpc.com
```

### 2. Get Builder Credentials

1. Apply to [Polymarket Builder Program](https://docs.polymarket.com/builders)
2. Receive `BUILDER_ID` and `BUILDER_SIGNING_KEY`
3. Add to server environment variables

### 3. Dependencies

Already installed:
- `@polymarket/builder-relayer-client@^0.0.8`
- `@polymarket/builder-signing-sdk@^0.0.8`
- `@polymarket/clob-client@^4.22.8`
- `ethers@^5.8.0`
- `magic-sdk@^33.4.0`

## Usage

### Client-Side: Deploy Safe

```typescript
import { useDeploySafe } from "@/hooks/use-deploy-safe";
import { useMagic } from "@/hooks/use-magic";

function OnboardingFlow() {
  const { magic } = useMagic();
  const { deploySafe, isDeploying, error } = useDeploySafe();

  const handleDeploy = async () => {
    const { safeAddress, clobClient } = await deploySafe({
      magic,
      builderId: process.env.NEXT_PUBLIC_BUILDER_ID!,
      signingEndpoint: `${process.env.NEXT_PUBLIC_SERVER_URL}/api/polymarket/sign`,
      rpcUrl: process.env.NEXT_PUBLIC_POLYGON_RPC_URL!,
    });

    // Register Safe with server
    await trpc.auth.registerSafe.mutate({ safeAddress });

    // Store credentials
    await trpc.auth.storeCredentials.mutate({
      encryptedCredentials: "...", // Encrypt CLOB credentials
    });
  };

  return (
    <button onClick={handleDeploy} disabled={isDeploying}>
      {isDeploying ? "Deploying Safe..." : "Deploy Trading Wallet"}
    </button>
  );
}
```

### Server-Side: Validate & Store

```typescript
// Already implemented in apps/server/src/routers/auth.ts

// Register Safe address
auth.registerSafe.mutation(async ({ input, ctx }) => {
  // Validates address format
  // Stores in database
  // Returns success
});

// Store CLOB credentials
auth.storeCredentials.mutation(async ({ input, ctx }) => {
  // Stores encrypted credentials
  // Returns success
});
```

## Key Endpoints

### `/api/polymarket/sign` (Server)
- **Purpose**: Sign builder requests with HMAC
- **Method**: POST
- **Body**: `{ timestamp, method, requestPath, body? }`
- **Returns**: `{ signature, builderId }`
- **Security**: Builder credentials never exposed to client

## Trading Flow

Once Safe is deployed:

1. **Place Orders**:
```typescript
const order = {
  tokenID: "...",
  price: 0.55,
  size: 10,
  side: Side.BUY,
  feeRateBps: 0,
};

await clobClient.createAndPostOrder(order, {}, OrderType.GTC);
```

2. **Check Positions**:
```typescript
const positions = await fetch(
  `https://data-api.polymarket.com/positions?user=${safeAddress}`
);
```

3. **Cancel Orders**:
```typescript
await clobClient.cancelOrder({ orderID: "..." });
```

## Security

- ✅ **Non-custodial**: Users control private keys via Magic
- ✅ **Builder credentials**: Kept server-side only
- ✅ **HMAC signing**: Remote signing prevents credential exposure
- ✅ **Encrypted storage**: CLOB credentials encrypted at rest
- ✅ **DID tokens**: Cryptographic proof of authentication

## Important Addresses (Polygon)

```typescript
// USDC.e (Trading currency)
export const USDC_E_ADDRESS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174";

// Conditional Token Framework
export const CTF_ADDRESS = "0x4d97dcd97ec945f40cf65f87097ace5ea0476045";

// Exchanges
export const CTF_EXCHANGE = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";
export const NEG_RISK_CTF_EXCHANGE = "0xC5d563A36AE78145C45a50134d48A1215220f80a";
```

## Troubleshooting

### Safe deployment fails
- Verify builder credentials are correct
- Check RPC URL is accessible
- Ensure Magic user is authenticated

### Orders not appearing
- Wait 2-3 seconds for CLOB sync
- Verify USDC.e balance in Safe wallet
- Check browser console for errors

### Balance shows $0.00
- Fund the **Safe wallet**, not the EOA
- Verify on [Polygonscan](https://polygonscan.com)
- Check RPC endpoint is working

## Resources

- [Magic Polymarket Integration](https://docs.magic.link/home/integrations/embedded-wallets/polymarket)
- [Polymarket Builder Docs](https://docs.polymarket.com/builders)
- [CLOB Client Docs](https://docs.polymarket.com/developers/CLOB/clients)
- [Magic Safe Builder Example](https://github.com/Polymarket/magic-safe-builder-example)

## Next Steps

1. Implement onboarding UI in web app
2. Add Safe deployment to user registration flow
3. Create trading interface components
4. Add position management views
5. Implement order history tracking
