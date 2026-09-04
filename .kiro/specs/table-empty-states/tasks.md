# Implementation Plan: Table Empty States

## Overview

Replace all plain-text empty states across trading terminal tabs and portfolio tables with polished compositions using the existing `Empty` primitives from `@/components/ui/empty`. The implementation starts by refactoring the shared `EmptyState` in `trade-utils.tsx`, then updates all trading terminal call sites, then all portfolio call sites, and finishes with property-based tests for correctness properties.

## Tasks

- [x] 1. Refactor shared EmptyState in trade-utils.tsx
  - [x] 1.1 Update the `EmptyState` component in `apps/web/src/components/market/tabs/trade-utils.tsx`
    - Change the interface from `{ message: string }` to `{ icon: LucideIcon; title: string; description: string }`
    - Replace the `<div><span>` markup with `Empty > EmptyHeader > EmptyMedia(variant="icon") + EmptyTitle + EmptyDescription` composition
    - Import `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, `EmptyDescription` from `@/components/ui/empty`
    - Import `type LucideIcon` from `lucide-react`
    - Add `className="py-8"` on the `Empty` root and `className="size-4 text-text-muted"` on the icon
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Update trading terminal tab call sites
  - [x] 2.1 Update `positions-tab.tsx` empty states
    - Import `BarChart3` and `Wallet` from `lucide-react`
    - Update the empty/disconnected `EmptyState` calls to pass `icon`, `title`, `description` per the icon mapping
    - Connected empty: `icon={BarChart3}`, title "No open positions", description "Your positions for this market will appear here"
    - Disconnected: `icon={Wallet}`, title "Connect wallet to see positions", description "Log in to view your positions for this market"
    - _Requirements: 2.1, 2.2_

  - [x] 2.2 Update `orders-tab.tsx` empty state
    - Import `ClipboardList` from `lucide-react`
    - Update `EmptyState` call: `icon={ClipboardList}`, title "No open orders", description "Your limit orders for this market will appear here"
    - _Requirements: 3.1_

  - [x] 2.3 Update `history-tab.tsx` empty states
    - Import `Clock` and `Wallet` from `lucide-react`
    - Connected empty: `icon={Clock}`, title "No history yet", description "Your trades and activity for this market will appear here"
    - Disconnected: `icon={Wallet}`, title "Connect wallet to see history", description "Log in to view your trade history for this market"
    - _Requirements: 4.1, 4.2_

  - [x] 2.4 Update `trades-tab.tsx` empty state
    - Import `ArrowLeftRight` from `lucide-react`
    - Update `EmptyState` call: `icon={ArrowLeftRight}`, title "No trades yet", description "Trades for this market will appear here"
    - _Requirements: 5.1_

  - [x] 2.5 Update `holders-tab.tsx` empty state
    - Import `Users` from `lucide-react`
    - Update `EmptyState` call: `icon={Users}`, title "No holders data", description "Holder information for this market will appear here"
    - _Requirements: 6.1_

  - [x] 2.6 Update `open-orders.tsx` sidebar panel empty state
    - Replace inline empty state with `Empty` primitive composition or import the shared `EmptyState`
    - Use `icon={ClipboardList}`, title "No open orders", description "Orders you place will appear here"
    - _Requirements: 12.1_

- [x] 3. Checkpoint — Verify trading terminal empty states
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Update portfolio table empty states
  - [x] 4.1 Update `position-table.tsx` empty states
    - Replace inline `EmptyState` with `Empty` primitive composition
    - Import `BarChart3` and `Search` from `lucide-react`
    - Default empty: `icon={BarChart3}`, title "No open positions", description "Markets you hold positions in will appear here"
    - Search filter empty: `icon={Search}`, title "No positions match your search", description "Try adjusting your search terms"
    - _Requirements: 7.1, 7.2_

  - [x] 4.2 Update `closed-positions.tsx` empty states
    - Replace inline `EmptyState` with `Empty` primitive composition
    - Default empty: `icon={BarChart3}`, title "No closed positions", description "Resolved or sold positions will appear here"
    - Search filter empty: `icon={Search}`, title "No positions match your search", description "Try adjusting your search terms"
    - _Requirements: 8.1, 8.2_

  - [x] 4.3 Update `orders-table.tsx` empty states
    - Replace inline `EmptyState` with `Empty` primitive composition
    - Default empty: `icon={ClipboardList}`, title "No open orders", description "Your pending limit orders will appear here"
    - Search filter empty: `icon={Search}`, title "No orders match your search", description "Try adjusting your search terms"
    - _Requirements: 9.1, 9.2_

  - [x] 4.4 Update `activity-history.tsx` empty state
    - Replace inline `EmptyState` with `Empty` primitive composition
    - Use `icon={Clock}`, title "No history found", description "Your trade activity and transactions will appear here"
    - _Requirements: 10.1_

  - [x] 4.5 Update `redeem-tab.tsx` empty state
    - Replace inline empty state with `Empty` primitive composition
    - Use `icon={Gift}`, title "No positions eligible to redeem", description "Resolved winning positions will appear here for redemption"
    - _Requirements: 11.1_

- [x] 5. Checkpoint — Verify portfolio empty states
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Property-based tests for empty state correctness
  - [ ]* 6.1 Write property test for structural composition (Property 1)
    - **Property 1: Empty state structural composition**
    - **Validates: Requirements 1.1**
    - Create `tests/unit/table-empty-states.property.test.ts`
    - Use `fast-check` to generate arbitrary non-empty title and description strings, pick a random Lucide icon from a set
    - Render the `EmptyState` composition with `@testing-library/react`
    - Assert the DOM contains `data-slot="empty-icon"`, `data-slot="empty-title"`, `data-slot="empty-description"` in that order
    - Run minimum 100 iterations

  - [ ]* 6.2 Write property test for no action elements (Property 2)
    - **Property 2: No action elements in empty states**
    - **Validates: Requirements 1.5**
    - Use `fast-check` to generate arbitrary title/description strings
    - Render the empty state and assert no `button`, `a`, `[role="button"]`, or `[role="link"]` elements exist within the container

  - [ ]* 6.3 Write property test for design token compliance (Property 3)
    - **Property 3: Design token compliance**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.4**
    - Use `fast-check` to generate arbitrary title/description strings
    - Render the empty state, extract all class names from the container and descendants
    - Verify: no hardcoded hex colors, font sizes only from sanctioned set, weights only `font-normal`/`font-medium`, icon uses `text-text-muted` or `text-muted-foreground`

- [x] 7. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The design uses TypeScript throughout — all code examples use TypeScript/TSX
- The existing `Empty` primitives already have the correct `data-slot` attributes and styling classes
- Each task references specific requirements for traceability
- Property tests use `fast-check` with Vitest (already in the project's test setup)
