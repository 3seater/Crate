# Bridge Implementation Audit - March 21, 2026

## Executive Summary

Comprehensive audit of the Doji bridge implementation against Polymarket's official Bridge API documentation. This audit identifies discrepancies, Trust Wallet dependencies, and areas requiring configuration improvements.

## Critical Issues Found

### 1. Trust Wallet Dependency (HIGH PRIORITY)
**Location**: `apps/web/src/lib/bridge/utils.ts`, `apps/web/next.config.ts`

**Issue**: The application uses Trust Wallet's GitHub repository for token logos:
```typescript
const TRUST_ASSETS_BASE = "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains";
```

**Problems**:
- External dependency on Trust Wallet's repo structure
- Not all Polymarket-supported chains are in Trust Wallet
- Hardcoded skip list: `["hyperliquid", "abstract", "ethereal"]`
- 404 errors for missing assets

**Recommendation**: 
- Remove Trust Wallet dependency entirely
- Use Polymarket's own asset URLs or local fallback icons
- Implement proper fallback system with letter avatars (already exists in `TokenLogo` component)

### 2. Supported Assets Validation (HIGH PRIORITY)
**Location**: `apps/web/src/components/bridge/bridge-asset-select.tsx`, deposit/withdraw flows

**Issue**: No validation that displayed assets match Polymarket's `/supported-assets` endpoint

**Official Supported Chains** (from docs):
- Ethereum (chainId: "1")
- Polygon (chainId: "137")
- Arbitrum (chainId: "42161")
- Base (chainId: "8453")
- Optimism (chainId: "10")
- BNB Smart Chain (chainId: "56")
- Solana (chainId: varies)
- Bitcoin (chainId: varies)
- Tron (chainId: varies)
- HyperEVM
- Abstract
- Monad
- Ethereal
- Katana
- Lighter

**Current Implementation**: Accepts whatever `/supported-assets` returns without validation

**Recommendation**:
- Create a whitelist/blacklist configuration
- Add admin toggle to enable/disable specific chains
- Validate against known chain IDs

### 3. Chain ID Mapping Issues (MEDIUM PRIORITY)
**Location**: `apps/web/src/lib/bridge/utils.ts`

**Issue**: Hardcoded chain ID mappings that may not match Polymarket's actual IDs:
```typescript
const CHAIN_ID_TO_TRUST_SLUG: Record<string, string> = {
  "1151111081099710": "solana",  // Non-standard
  "8253038": "bitcoin",           // Non-standard
  "728126428": "tron",            // Non-standard
  // ...
};
```

**Recommendation**:
- Remove Trust Wallet slug mapping entirely
- Use Polymarket's official chain IDs from `/supported-assets`
- Store chain metadata in database or config file

### 4. Deposit Address Generation (MEDIUM PRIORITY)
**Location**: `apps/web/src/components/bridge/deposit-flow.tsx`

**Current Flow**:
1. Calls `/deposit` endpoint once on wallet connect
2. Stores addresses in component state
3. Reuses same addresses for all deposits

**Issue**: Addresses are generated correctly per Polymarket API, but:
- No validation of address format per chain type
- No error handling for unsupported address types
- TVM (Tron) address is optional but not clearly communicated

**Recommendation**:
- Add address format validation (EVM: 0x..., BTC: bc1..., etc.)
- Show clear error messages for unsupported chains
- Document TVM availability

### 5. Withdraw Address Handling (MEDIUM PRIORITY)
**Location**: `apps/web/src/components/bridge/withdraw-flow.tsx`

**Current Flow**:
1. User fills form
2. Calls `/withdraw` to get one-time addresses
3. Executes USDC.e transfer via RelayClient
4. Tracks status

**Issues**:
- Fallback to manual send if RelayClient fails (good)
- Address type selection logic has fallback to EVM (lines 122-135)
- No validation that destination chain supports the selected token

**Recommendation**:
- Validate token availability on destination chain before allowing withdrawal
- Improve error messages for unsupported combinations
- Add confirmation dialog showing exact amounts and fees

### 6. Quote Breakdown Display (LOW PRIORITY)
**Location**: `apps/web/src/components/bridge/withdraw-quote-breakdown.tsx`

**Current Implementation**: Shows fee breakdown from `/quote` endpoint

**Issues**:
- Fee labels may not match Polymarket's terminology
- `appFeeLabel` is optional but not handled gracefully
- No explanation of what each fee means

**Recommendation**:
- Add tooltips explaining each fee type
- Use Polymarket's exact fee terminology
- Show total impact prominently

### 7. Minimum Deposit Amounts (LOW PRIORITY)
**Location**: `apps/web/src/components/bridge/bridge-asset-select.tsx`

**Current Implementation**: Shows `minCheckoutUsd` in network label

**Official Minimums** (from docs):
- Ethereum: $7
- Most L2s (Polygon, Arbitrum, Base, Optimism, BNB): $2
- Bitcoin: $9
- Tron: $9
- Solana: $2

**Issue**: Displayed correctly, but no validation preventing deposits below minimum

**Recommendation**:
- Add client-side validation
- Show warning if amount is below minimum
- Disable submit button if below minimum

## Configuration Requirements

### Proposed Configuration Structure

```typescript
// apps/server/src/config/bridge.ts
export interface BridgeChainConfig {
  chainId: string;
  chainName: string;
  enabled: boolean;
  minDepositUsd: number;
  addressType: "evm" | "svm" | "btc" | "tvm";
  logoUrl?: string; // Optional custom logo
}

export interface BridgeTokenConfig {
  symbol: string;
  name: string;
  enabled: boolean;
  supportedChains: string[]; // Chain IDs
}

export const BRIDGE_CONFIG = {
  chains: {
    ethereum: {
      chainId: "1",
      chainName: "Ethereum",
      enabled: true,
      minDepositUsd: 7,
      addressType: "evm",
    },
    polygon: {
      chainId: "137",
      chainName: "Polygon",
      enabled: true,
      minDepositUsd: 2,
      addressType: "evm",
    },
    // ... other chains
  },
  tokens: {
    USDC: {
      symbol: "USDC",
      name: "USD Coin",
      enabled: true,
      supportedChains: ["1", "137", "42161", "8453", "10", "56"],
    },
    // ... other tokens
  },
};
```

### Environment Variables

```env
# Enable/disable entire bridge feature
BRIDGE_ENABLED=true

# Enable/disable specific chains (comma-separated chain IDs)
BRIDGE_DISABLED_CHAINS=999,2741

# Enable/disable specific tokens (comma-separated symbols)
BRIDGE_DISABLED_TOKENS=

# Minimum deposit override (USD)
BRIDGE_MIN_DEPOSIT_USD=2
```

## Implementation Plan

### Phase 1: Remove Trust Wallet Dependency (2-3 hours)
1. Remove `getTokenLogoUrl` function
2. Remove Trust Wallet image domain from `next.config.ts`
3. Update all components to use fallback icons only
4. Test that TokenLogo component handles missing images gracefully

### Phase 2: Add Configuration System (3-4 hours)
1. Create `apps/server/src/config/bridge.ts` with chain/token config
2. Add environment variable support
3. Filter `/supported-assets` response based on config
4. Add admin API endpoint to toggle chains/tokens (future)

### Phase 3: Improve Validation (2-3 hours)
1. Add minimum deposit validation
2. Add address format validation
3. Add token/chain compatibility validation
4. Improve error messages

### Phase 4: Fix Transaction Breakdown (1-2 hours)
1. Add tooltips to fee breakdown
2. Use Polymarket's exact terminology
3. Add "You will receive" summary

### Phase 5: Testing (2-3 hours)
1. Test deposit flow for each supported chain
2. Test withdraw flow for each supported chain
3. Test error scenarios
4. Test with disabled chains/tokens

## Testing Checklist

### Deposit Flow
- [ ] Ethereum → Polygon (USDC, ETH, USDT)
- [ ] Polygon → Polygon (USDC, POL)
- [ ] Arbitrum → Polygon (USDC, ARB)
- [ ] Base → Polygon (USDC, ETH)
- [ ] Optimism → Polygon (USDC, OP)
- [ ] BNB Chain → Polygon (USDC, BNB)
- [ ] Solana → Polygon (SOL, USDC)
- [ ] Bitcoin → Polygon (BTC)
- [ ] Tron → Polygon (USDT)

### Withdraw Flow
- [ ] Polygon → Ethereum (USDC)
- [ ] Polygon → Arbitrum (USDC)
- [ ] Polygon → Base (USDC)
- [ ] Polygon → Optimism (USDC)
- [ ] Polygon → Solana (USDC)

### Error Scenarios
- [ ] Deposit below minimum amount
- [ ] Unsupported token
- [ ] Invalid recipient address
- [ ] Insufficient balance for withdraw
- [ ] Network error during address generation
- [ ] Failed transaction

### Configuration
- [ ] Disable chain via config
- [ ] Disable token via config
- [ ] Override minimum deposit
- [ ] Verify disabled assets don't appear in UI

## Files Requiring Changes

### High Priority
1. `apps/web/src/lib/bridge/utils.ts` - Remove Trust Wallet, add validation
2. `apps/web/next.config.ts` - Remove Trust Wallet domain
3. `apps/server/src/config/bridge.ts` - NEW: Configuration file
4. `apps/server/src/routers/bridge.ts` - Add config filtering
5. `apps/web/src/components/bridge/bridge-asset-select.tsx` - Add validation
6. `apps/web/src/components/bridge/deposit-flow.tsx` - Add validation
7. `apps/web/src/components/bridge/withdraw-flow.tsx` - Add validation

### Medium Priority
8. `apps/web/src/components/bridge/withdraw-quote-breakdown.tsx` - Improve display
9. `apps/web/src/components/bridge/deposit-notification-card.tsx` - Remove logo dependency
10. `apps/web/src/components/bridge/withdraw-notification-card.tsx` - Remove logo dependency

### Low Priority
11. `apps/web/src/components/bridge/token-logo.tsx` - Already handles fallbacks well
12. Documentation updates

## Estimated Total Time
- Phase 1: 2-3 hours
- Phase 2: 3-4 hours
- Phase 3: 2-3 hours
- Phase 4: 1-2 hours
- Phase 5: 2-3 hours
**Total: 10-15 hours**

## Next Steps
1. Review and approve audit findings
2. Prioritize phases based on business needs
3. Begin Phase 1 implementation
4. Set up staging environment for testing
5. Document configuration options for ops team
