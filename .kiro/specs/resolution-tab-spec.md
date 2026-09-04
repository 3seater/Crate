# Resolution Tab Spec

> Add a **Resolution** tab on the market trading page that replicates Polymarket's "About" tab content and integrates UMA resolution details.

## Reference: Polymarket About Tab Structure

From Polymarket's UI, the About tab contains:

### 1. Rules Section
- **Heading:** "Rules"
- **Content:** Market description (resolution rules, edge cases, resolution source narrative)
- **Market Dates:**
  - **End Date:** e.g. "Mar 19, 2026"
  - **Market Opened:** e.g. "Mar 10, 2026, 12:00 PM ET"

### 2. Sources Section
- **Heading:** "Sources"
- Two cards side-by-side:
  - **Resolution Source:** Link icon + label "Resolution Source" + blue hyperlink URL (e.g. `https://www.wtatennis.com/...`)
  - **Resolver:** UMA logo + label "Resolver" + blue hex address (e.g. `0x65070BE91...`)

### 3. Resolution Section
- **Heading:** "Resolution"
- **Propose resolution** button (outline style, links to UMA propose flow)
- **View details** link with external-link icon (links to UMA request/explorer)

### 4. UMA Details (Extended — beyond Polymarket)
- Proposal status (if any): Proposed, Challenged, Resolved
- Vote outcome (if disputed): e.g. "Proposer wins" / "Disputer wins" / "Too Early" / "Unknown"
- Timer: Challenge period countdown or DVM vote deadline
- Proposal history / bond info

---

## Data Sources

### Gamma API (what we have)

| Field | Source | Notes |
|-------|--------|-------|
| `description` | Market / Event | Resolution rules text. We validate this in MarketSchema. |
| `question_id` / `questionId` | Market | Links to UMA. In our schema as `question_id`. Gamma returns it; we use `.loose()` so it passes through. |
| `endDate` / `endDateIso` | Market / Event | End date. **Unreliable for GMP** — see AGENTS.md. Use `extractDateFromText` as fallback. |
| `resolutionSource` | Market / Event | Per Gamma OpenAPI. **Not in our MarketSchema** — add if Gamma returns it. |
| `umaResolutionStatus` | Market | Filter param + possibly on response. **Not in our schema** — add. |
| `umaEndDate` | Market | UMA-specific end. Add to schema. |
| `creationDate` / `createdAt` | Event | For "Market Opened". |
| Sports `resolution` URL | GET /sports | Per-sport resolution source. Use when market has `gameId` / sports type. |

### UMA / On-chain (what we need)

| Data | Source | Notes |
|------|--------|------|
| Propose flow | https://oracle.uma.xyz/propose?project=Polymarket | Users propose here. |
| Request details | oracle.uma.xyz or UMA adapter contract | Need `questionId` → request mapping. Polymarket conditionId is derived from questionId + oracle + outcomeSlotCount. |
| Proposal status | Contract reads or UMA indexer | `hasPrice`, proposal timestamp, dispute status. |
| Vote result | DVM / UMA subgraph | If disputed and resolved. |
| Timer | Proposal timestamp + liveness (e.g. 2h) | Challenge period; 24–48h debate if disputed. |

**UMA adapter addresses (Polygon):**
- v3: `0x157Ce2d672854c848c9b79C49a8Cc6cc89176a49`
- v2: `0x6A9D222616C90FcA5754cd1333cFD9b7fb6a4F74`
- v1: `0xCB1822859cEF82Cd2Eb4E6276e692995130`

---

## Current Codebase

- **MarketTabs** (`apps/web/src/components/market/market-tabs.tsx`): Tabs = Positions, Orders, History, Trades, Holders, [Comments]. Add **Resolution**.
- **ResolutionModal** (`resolution-modal.tsx`): Shows description + "View on Polymarket" + "Done". Content can be reused/refactored for tab.
- **Market** type: Has `description`, `question_id`. Missing: `resolutionSource`, `umaResolutionStatus`, `umaEndDate`, `creationDate` (event-level).
- **Gamma schema** (`apps/server/src/lib/polymarket/schemas/gamma.ts`): Uses `.loose()` — extra fields pass through. Explicitly add `resolutionSource`, `question_id` (already present), `umaResolutionStatus`, `umaEndDate` if we want typed access.

---

## Implementation Plan

### Phase 1: Add Resolution Tab (Gamma-only)

1. **Extend MarketSchema** (optional): Add `resolutionSource`, `umaResolutionStatus`, `umaEndDate` for typed access. Or rely on `(market as Record<string, unknown>).resolutionSource` until we confirm Gamma returns them.
2. **Add Resolution tab** to `MarketTabs` (alongside Comments).
3. **Create ResolutionTab component:**
   - **Rules:** Render `market.description` or `event.description`, fallback `"No resolution information available."`
   - **Dates:** End Date (`endDate` or `extractDateFromText(question)`), Market Opened (from event `creationDate`/`createdAt`)
   - **Sources:** 
     - Resolution Source card: if `resolutionSource` URL exists, show link. For sports, consider `GET /sports` → `resolution` by sport.
     - Resolver card: UMA adapter address (derive which v1/v2/v3 from market or default v3), link to Polygonscan
   - **Resolution actions:**
     - "Propose resolution" button → `https://oracle.uma.xyz/propose?project=Polymarket` (or UMA’s Polymarket-specific URL if different)
     - "View details" link → UMA oracle request page. URL format TBD — likely `oracle.uma.xyz` with identifier/conditionId or questionId.

### Phase 2: UMA Integration (Proposal Status, Vote, Timer)

1. **QuestionId / ConditionId:** Ensure we pass `question_id` from market. ConditionId is computed from questionId + oracle + outcomeSlotCount — we may need to reverse or use a known mapping.
2. **UMA API / indexer:** Research:
   - UMA subgraph (The Graph) for Polymarket
   - oracle.uma.xyz request URL by identifier
   - Contract reads via viem: `hasPrice`, `getRequest`, proposal/dispute events
3. **ResolutionTab enhancements:**
   - If proposal exists: show "Proposed" + proposed outcome + timer (e.g. "1h 23m left to dispute")
   - If disputed: show "In DVM vote" + vote deadline
   - If resolved: show vote result (Proposer wins, Disputer wins, etc.)

### Phase 3: Polish

- Match Polymarket visual layout (cards, spacing, typography).
- Handle edge cases: no description, no resolution source, neg-risk markets.
- Ensure "View details" deep-links to the correct UMA request.

---

## URLs to Document

- **Propose:** https://oracle.uma.xyz/propose?project=Polymarket
- **UMA docs:** https://docs.uma.xyz/
- **Polymarket resolution docs:** https://docs.polymarket.com/developers/resolution/UMA
- **Polygonscan:** Resolver address links, e.g. `https://polygonscan.com/address/0x157Ce2d672854c848c9b79C49a8Cc6cc89176a49`

---

## Open Questions

1. **Resolution source URL:** Does Gamma return `resolutionSource` on market/event? If not, is it only in sports metadata per sport?
2. **UMA request URL:** Exact format for "View details" (e.g. by conditionId or questionId).
3. **Resolver address:** RESOLVED — Polymarket uses v1, v2, or v3 per market. We derive the correct one via `getResolverAddress(conditionId, questionId)` by trying each adapter with the Gnosis CTF formula `keccak256(encodePacked(oracle, questionId, 2))` and returning the match. Implemented in `apps/web/src/lib/resolution/get-resolver-address.ts`.

4. **Resolution timeline UI** (Polymarket-style): "Outcome proposed: Yes", "Disputed", "Final review 46m 25s" with icons and countdown. **Data source:** No public REST API. Options: (a) Read UMA OptimisticOracleV2 contract state (questionId → proposal timestamps, dispute status), (b) UMA subgraph if available, (c) Link to Polymarket or oracle.uma.xyz for full timeline. Gamma's `umaResolutionStatus` may give high-level status; not sufficient for detailed timeline.
4. **Event vs market description:** For GMP, use event description or first market description?

---

## File Changes

| File | Change |
|------|--------|
| `market-tabs.tsx` | Add "Resolution" to tabs; render `ResolutionTab` when active |
| `resolution-tab.tsx` (new) | Rules, Sources, Resolution sections; consume `market` + optional `event` |
| `resolution-modal.tsx` | Optionally reuse rules block or link to Resolution tab |
| Gamma schema | Add `resolutionSource`, `umaResolutionStatus`, `umaEndDate` if needed |
| `market-urls.ts` or new `uma-urls.ts` | Helper for UMA propose URL, view-details URL |
