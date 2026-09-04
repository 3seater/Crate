# Types Package

> Scope: `packages/types` (inherits root [AGENTS.md](../../AGENTS.md) unless noted)

Shared TypeScript types for non-Polymarket entities (`@doji/types`).

## Quick Facts

- **Package:** `@doji/types`
- **Commands:** `pnpm check-types`, `pnpm test`

## Purpose

Type definitions and shared constants for:

- **CLOB API** - Orders, trades, orderbooks
- **WebSocket APIs** - CLOB, Sports, RTDS message types
- **Primitives** - Address, Hash64, common types
- **Auth** - Authentication types
- **Sports** - Sports metadata
- **Constants** - CLOB/order/Polymarket values in `constants.ts` (see § Constants below)

**Note:** Polymarket Gamma API types (Market, Event, Tag) are now defined in server schemas and inferred via tRPC. See `apps/web/src/lib/trpc/types.ts`.

## Structure

```
src/
├── index.ts              # Main exports
├── primitives.ts         # Address, Hash64 types
├── common.ts             # ErrorResponse, Pagination
├── clob.ts               # CLOB API types
├── constants.ts          # Shared CLOB/order/Polymarket constants (see below)
├── polymarket.ts         # Polymarket types
├── order.ts              # Order types
├── websocket.ts          # WebSocket types
├── auth.ts               # Authentication types
├── geoblock.ts           # Geoblocking types, blocked countries/regions, isGeoBlocked()
├── sports.ts             # Sports metadata
└── branded.ts            # Branded types (TokenId, etc.)
```

## Constants (`constants.ts`)

Shared constants used by web and server: CLOB price/tick/size limits, order batch bounds, GTD buffer, USDC decimals, contract addresses, Polymarket geoblock URLs. All are documented with JSDoc in the file. Prices are decimal 0–1 (e.g. 1¢ = 0.01). Do not duplicate these in app code; import from `@doji/types`.

## Installation

```bash
pnpm add @doji/types
```

## Usage

### CLOB Types

```typescript
import type { OpenOrder, OrderBookSummary } from "@doji/types";

const order: OpenOrder = {
  id: "123",
  market: "0x...",
  asset_id: "token123",
  side: "BUY",
  size: "100",
  price: "0.5",
  // ... more fields
};
```

### Primitives

```typescript
import type { Address, Hash64 } from "@doji/types";

// Flexible types that accept both strict and loose formats
const address: Address = "0x1234..."; // or `0x${string}`
const conditionId: Hash64 = "0xabcd..."; // or `0x${string}`
```

### Sports Types

```typescript
import type { SportsMetadata } from "@doji/types";

const sports: SportsMetadata = {
  teams: [{ name: "Team A", image: "url" }],
  market_types: ["MONEYLINE"],
  game_start_time: "2024-01-01T00:00:00Z",
};
```

## Branded Types

Type-safe wrappers for domain identifiers:

```typescript
import { tokenId, conditionId, walletAddress } from "@doji/types";

const token = tokenId("abc123");
const condition = conditionId("def456");
const wallet = walletAddress("0x...");

// TypeScript prevents mixing different ID types
function getOrderbook(id: TokenId) { ... }
getOrderbook(token);      // ✓
getOrderbook(condition);  // ✗ Type error
```

## Testing

- **Vitest** for unit tests
- **Property-based testing** with fast-check
- Test files in `__tests__/` directories
- 12 tests covering branded types and validation

```bash
pnpm check-types          # Verify types compile
pnpm test                 # Run tests (CI mode)
pnpm test:watch           # Run tests in watch mode
```

## Finish the Task

- [ ] Run `pnpm fix` before committing.
- [ ] Update this AGENTS.md if you added or renamed major type groups.
- [ ] Summarize changes in conventional commit form (e.g. `feat(types): ...`).

## Related

- [tRPC Types](../../apps/web/src/lib/trpc/types.ts) - Inferred Polymarket types
- [Server Schemas](../../apps/server/src/lib/polymarket/schemas/AGENTS.md) - Zod schemas
- [Database Package](../db/AGENTS.md)
- [API Package](../api/AGENTS.md)
