# Polymarket Glossary

> Key terms and concepts for Polymarket development. See [notes/POLYMARKET-FULL.md](notes/POLYMARKET-FULL.md) and the glossary below for orderbook mirror, effective prices, token IDs, and CTF/collateral.

## Markets & Events

| Term | Definition |
|------|------------|
| **Event** | A collection of related markets grouped under a common topic. Example: "2024 US Presidential Election" contains markets for each candidate. |
| **Market** | A single tradeable outcome within an event. Each market has a Yes and No side. Corresponds to a condition ID, question ID, and pair of token IDs. |
| **Token** | Represents a position in a specific outcome (Yes or No). Prices range from 0.00 to 1.00. Winning tokens redeem for $1 pUSD. |
| **Token ID** | The unique identifier for a specific outcome token. Required when placing orders or querying prices. |
| **Condition ID** | Onchain identifier for a market's resolution condition. Used in CTF operations. |
| **Question ID** | Identifier linking a market to its resolution oracle (UMA). |
| **Slug** | Human-readable URL identifier. **Events** and **markets** each have their own slug (e.g. event `where-will-barron-attend-college`, market `will-barron-attend-georgetown`). Do not use condition ID as a slug—Gamma resolves by slug only. |

### Gamma Structure

Gamma provides organizational models; the most fundamental element is markets; events and other models add organization.

- **Market**: Data for a traded market. Maps onto a pair of CLOB token IDs, a market address, a question ID, and a condition ID.
- **Event**: A set of markets. Variants:
  - Event with **1 market** → Single Market Product (SMP)
  - Event with **2+ markets** → Group Market Product (GMP)

**Example:**

- **[Event]** Where will Barron Trump attend College?
  - **[Market]** Will Barron attend Georgetown?
  - **[Market]** Will Barron attend NYU?
  - **[Market]** Will Barron attend UPenn?
  - **[Market]** Will Barron attend Harvard?
  - **[Market]** Will Barron attend another college?

### Gamma structure and routes

- **Event** = container (title, description). Has 1 market (SMP) or 2+ markets (GMP).
- **Market** = single tradeable unit (question, condition ID, token IDs). Belongs to an event.
- **Routes:** `/explore` and `/events` = discovery lists. `/event/[slug]` = event page (EventHeader + markets). `/market/[slug]` = market page (MarketHeader + TradingLayout). Home (`/`) redirects to `/explore`. If `/market/[slug]` resolves to an event (no market with that slug), redirect to `/event/[slug]`.
- **Links:** Use event slug for `/event/` and market slug (or `market_slug`) for `/market/`. Never use condition ID in `/market/`—Gamma `getMarketBySlug` expects a slug.

## Trading

| Term | Definition |
|------|------------|
| **CLOB** | Central Limit Order Book. Polymarket's off-chain order matching system. Orders are matched here before onchain settlement. |
| **Tick Size** | The minimum price increment for a market. Usually `0.01` (1 cent) or `0.001` (0.1 cent). |
| **Fill** | When an order is matched and executed. Orders can be partially or fully filled. |

## Order Types

| Term | Definition |
|------|------------|
| **GTC** | Good-Til-Cancelled. An order that remains open until filled or manually cancelled. |
| **GTD** | Good-Til-Date. An order that expires at a specified time if not filled. |
| **FOK** | Fill-Or-Kill. An order that must be filled entirely and immediately, or it's cancelled. No partial fills. |
| **FAK** | Fill-And-Kill. An order that fills as much as possible immediately, then cancels any remaining unfilled portion. |

## Market Types

| Term | Definition |
|------|------------|
| **Binary Market** | A market with exactly two outcomes: Yes and No. The prices always sum to approximately $1. |
| **Negative Risk (NegRisk)** | A multi-outcome event where only one outcome can resolve Yes. Requires `negRisk: true` in order parameters. |

## Wallets

| Term | Definition |
|------|------------|
| **EOA** | Externally Owned Account. A standard Ethereum wallet controlled by a private key. |
| **Funder Address** | The wallet address that holds funds and tokens for trading. |
| **Signature Type** | Identifies wallet type when trading. `0` = EOA, `1` = Magic Link proxy, `2` = Gnosis Safe proxy. |

## Token Operations (CTF)

| Term | Definition |
|------|------------|
| **CTF** | Conditional Token Framework. The onchain smart contracts that manage outcome tokens. |
| **Split** | Convert pUSD into a complete set of outcome tokens (one Yes + one No) via CtfCollateralAdapter (or NegRiskCtfCollateralAdapter for NegRisk markets). |
| **Merge** | Convert a complete set of outcome tokens back into pUSD via CtfCollateralAdapter. |
| **Redeem** | After resolution, exchange winning tokens for $1 pUSD each via CtfCollateralAdapter. |

## Infrastructure

| Term | Definition |
|------|------------|
| **Polygon** | The blockchain network where Polymarket operates. Chain ID: `137`. |
| **USDCe** | Bridged USDC on Polygon. Used for bridge deposits/withdrawals. Trading collateral is **pUSD** (Polymarket USD). |

## Market Status & Dates

> ⚠️ **`endDate` / `endDateIso` / `end_date_iso` are unreliable for multi-market events (GMP).** They reflect the event-level date, not the per-market resolution date. All markets in a GMP share the same `endDate` regardless of their individual outcome dates. For example, in "US strikes Iran by...?" every market (Feb 26 through Dec 31) has `endDate: "2026-01-31"`.

**Reliable status fields:**

| Field | Meaning | Use for |
|-------|---------|---------|
| `closed` | Market has resolved (boolean) | Gating orderbook fetches, hiding trading UI, marking inactive |
| `active` | Market is live (boolean) | Filtering discovery queries |
| `acceptingOrders` | CLOB is taking orders (boolean) | Enabling/disabling order placement |

**Unreliable date fields:**

| Field | What it actually is | Gotcha |
|-------|-------------------|--------|
| `endDate` / `endDateIso` | Event-level "eligible for resolution" date | Shared across all markets in a GMP; often stale or predates market creation |
| `umaEndDate` / `closedTime` | When resolution actually happened | Only populated *after* resolution; null while market is open |

**Fallback for display dates:** Use `extractDateFromText(market.question)` (in `utils/extract-date-from-text.ts`) to parse dates like "February 28, 2026" from the question string. Used by the market selector, markets table, and trading header when `endDate` is stale.

**Rules:**

- Never use `endDate` to determine if a market is open/closed — use `closed` field only.
- Never skip orderbook/CLOB fetches based on `endDate` — use `market.closed`.
- For display (expires column, header label): trust `endDate` only if it's in the future; otherwise fall back to `extractDateFromText`.

**Full Documentation:** <https://docs.polymarket.com/llms.txt>
