# Doji Green & Red Usage Audit

**Date:** March 2026  
**Scope:** Entire site — modals, toasts, notifications, widgets, tables, links, buttons

---

## Design principles

1. **Reserve accent for meaning** — Green = buy, success, positive PnL; Red = sell, danger, negative PnL. Use sparingly for semantic states.
2. **Neutral for chrome** — Navigation, labels, secondary actions, hovers on non-primary links should be grey/white.
3. **Avoid accent fatigue** — Too much green dilutes its impact. Primary actions and key numbers should stand out; everything else should recede.

---

## KEEP (Semantic — green/red makes sense)

| Area | Usage | Rationale |
|------|-------|-----------|
| **Trading** | `text-positive` / `text-negative` on BUY/SELL, PnL, outcome | Universal: green = buy/profit, red = sell/loss |
| **Orderbook** | Bid/ask colors, depth bars | Trading convention |
| **Order form** | Buy/Sell button variants | Primary action distinction |
| **Event cards** | Yes/No resolution badges (`border-positive/30`, `border-negative/30`) | Outcome semantics |
| **Toasts** | Success icon `text-positive` | Semantic feedback |
| **Bridge** | CheckCircle for success state | Semantic |
| **Logo** | Doji logo fill | Brand identity |
| **Primary CTA** | Header "Connect", modal confirms | Reserved for main action |

---

## CHANGE TO GREY/WHITE (Reduce green overload)

### 1. Link/name hover states — **high impact**

**Current:** `hover:text-primary` on virtually every clickable name/link (profile, market title, wallet address).  
**Files (30+):** holders-tab, whale-tracker, top-holders, orders-table, closed-positions, activity-history, trade-history, position-table, leaderboard-table, trader-columns, wallet-tracker-content, event-card, events-table, market-header-trading, profile-positions-table, comments, global-search, calendar-widget, etc.

**Recommendation:** Change to `hover:text-foreground` or `hover:text-text-secondary`. Only use `hover:text-primary` for primary actions (e.g. main CTA, "Add Wallet").  
**Design rule:** Links that navigate (profile, market) = neutral hover. Primary actions = green hover.

---

### 2. Copy/Star/Track icon hovers — **medium impact**

**Current:** Copy address, Track wallet, Watchlist star use `hover:text-primary`.  
**Files:** leaderboard-table, trader-card, event-table-cells (star), trades-tab edit icon.

**Recommendation:** Use `hover:text-foreground`. These are secondary actions, not primary CTAs.

---

### 3. Leaderboard rank 1–3 — **optional**

**Current:** Top 3 ranks use `text-primary` (green).  
**File:** leaderboard-table.tsx.

**Recommendation:** Consider gold/silver/bronze (`text-amber-400`, `text-slate-400`, `text-amber-700`) for podium, or keep green for “top performer” if that’s the brand. Alternatively: `text-text-primary` for emphasis without green.

---

### 4. Sort column indicators — **low impact**

**Current:** Sorted column arrow uses `text-positive`.  
**Files:** leaderboard-table (ArrowDown/ArrowUp), data-table-column-header.

**Recommendation:** Use `text-text-secondary` or `text-muted-foreground`. Sort state is secondary UI, not buy/sell.

---

### 5. SelectorChip (timescale, filters) active state — **medium impact**

**Current:** Active = `bg-primary/15 text-primary ring-primary/40` (e.g. leaderboard-page, market-filters).  
**Files:** selector-chip.tsx, leaderboard-page, explore/market-filters.

**Recommendation:** Use `bg-muted text-foreground ring-border` or `text-text-primary` for active. Reserve green for primary actions, not filter toggles.

---

### 6. Tabs underline — **keep**

**Current:** Active tab underline `bg-primary`.  
**Rationale:** Nav active state is a core brand usage. KEEP.

---

### 7. Notification dot — **optional**

**Current:** `bg-[var(--doji-green)]` on notifications bell.  
**File:** notifications-bell.tsx.

**Recommendation:** Keep for “you have updates.” Consider `bg-positive` for consistency.

---

### 8. Input focus ring — **optional**

**Current:** `focus:border-primary focus:ring-primary/40` on modals, add-track-wallet, wallet-tracker.  
**Files:** add-track-wallet-modal-provider, wallet-tracker-content, market-filters.

**Recommendation:** Consider `focus:border-ring focus:ring-ring/30` for neutral focus. Green focus can feel heavy on every input.

---

### 9. Activity widget “Live” badge — **keep**

**Current:** `bg-buy` dot for live trades.  
**Rationale:** Live = active/green makes sense. KEEP.

---

### 10. Bottom bar “STABLE” — **optional**

**Current:** `bg-primary` pulse + `text-primary` “STABLE”.  
**File:** bottom-bar.tsx.

**Recommendation:** Consider `text-text-secondary` + `bg-text-muted` pulse. “Stable” is status, not a CTA.

---

### 11. Crypto price direction — **keep**

**Current:** Up = `text-buy`, down = `text-sell`.  
**Rationale:** Semantic. KEEP.

---

### 12. Global search highlights — **medium impact**

**Current:** Match highlight `text-primary`, `text-primary/70`.  
**File:** global-search.tsx.

**Recommendation:** Use `text-foreground` or `text-text-primary` for matches. Search results are informational, not actions.

---

### 13. Empty state links — **low impact**

**Current:** `[&>a:hover]:text-primary` in Empty component.  
**File:** ui/empty.tsx.

**Recommendation:** Use `[&>a:hover]:text-foreground` unless the link is the primary CTA.

---

### 14. Event list “resolved” indicator — **keep**

**Current:** `bg-positive` / `bg-negative` on event cards for Yes/No.  
**Rationale:** Outcome semantics. KEEP.

---

### 15. Trading selector card — **keep**

**Current:** Yes = green, No = red on outcome toggles.  
**Rationale:** Trading semantics. KEEP.

---

### 16. Market list “selected” — **keep**

**Current:** `border-buy/20 bg-buy/10 text-buy` when selected.  
**Rationale:** Selection + outcome. KEEP.

---

## Summary: what to change

| Priority | Change | Scope |
|----------|--------|-------|
| **High** | `hover:text-primary` → `hover:text-foreground` on links/names | 30+ files |
| **Medium** | Copy/Star/Track icon hovers → `hover:text-foreground` | 5 files |
| **Medium** | SelectorChip active → `text-text-primary` + `bg-muted` | selector-chip, leaderboard, market-filters |
| **Medium** | Global search match highlight → `text-foreground` | global-search |
| **Low** | Sort arrow → `text-text-secondary` | leaderboard-table, data-table-column-header |
| **Low** | Bottom bar STABLE → `text-text-secondary` | bottom-bar |
| **Optional** | Input focus → `ring-ring` instead of `ring-primary` | modals, forms |
| **Optional** | Leaderboard top 3 → grey or gold/silver/bronze | leaderboard-table |

---

## Red usage (minimal changes)

Red is used mainly for:
- Sell / negative PnL / danger — **keep**
- Error states, destructive actions — **keep**
- Comments connected dot `bg-buy` — actually green; `bg-muted-foreground` when disconnected. **Keep as-is**.

No strong case for reducing red; it’s already scoped to semantic states.

---

## Implementation order

1. Create a shared class or token for “link hover” (e.g. `hover:text-foreground`).
2. Bulk replace `hover:text-primary` with `hover:text-foreground` on ProfileHoverCard wrappers, table links, and similar navigation links.
3. Update Copy/Star/Track icon hovers.
4. Update SelectorChip and related filter chips.
5. Tackle the remaining low-priority items as time allows.
