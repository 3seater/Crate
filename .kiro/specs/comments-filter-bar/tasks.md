# Implementation Plan: Comments Filter Bar

## Overview

Add a filter/sort toolbar and position badges to the Comments tab. The implementation extends the existing `Comments` component and `useComments` hook with sort/filter state, adds a `CommentsFilterBar` component, a `PositionBadge` component, and pure utility functions (`matchPosition`, `formatPositionSize`) for position matching and formatting. RTDS real-time comments respect the active filter/sort state.

## Tasks

- [x] 1. Add pure utility functions for position matching and formatting
  - [x] 1.1 Create `matchPosition` and `formatPositionSize` in `apps/web/src/domains/trading/components/market/comments-utils.ts`
    - Add `CommentPosition` interface and `MatchedPosition` interface
    - Implement `matchPosition(positions, yesTokenId, noTokenId, yesOutcomeLabel, noOutcomeLabel)` — iterates positions, returns first match against market token IDs with side and outcomeLabel, or null
    - Implement `formatPositionSize(size: number)` — formats with compact suffixes (K, M) matching project patterns
    - Export `SortMode` type (`"newest" | "most_liked"`)
    - _Requirements: 3.4, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 1.2 Write property test for `matchPosition`
    - **Property 2: Position matching correctness**
    - **Validates: Requirements 3.2, 3.3, 5.1, 5.2, 5.3, 5.4**

  - [ ]* 1.3 Write property test for `formatPositionSize`
    - **Property 3: Position size formatting**
    - **Validates: Requirements 3.4**

- [x] 2. Update `useComments` hook to accept sort/filter params
  - [x] 2.1 Extend `useComments` to accept `UseCommentsOptions` (`sortMode`, `holdersOnly`)
    - Map `sortMode: "newest"` → `order: "createdAt"`, `sortMode: "most_liked"` → `order: "reactionCount"`
    - Pass `holders_only` and `get_positions: true` to the tRPC query
    - Ensure re-fetch triggers when sort/filter params change (query key includes params)
    - _Requirements: 1.5, 2.2, 2.3, 2.5, 3.1_

  - [x] 2.2 Update RTDS handler to respect filter state
    - When `holdersOnly` is true, only append RTDS comments whose positions match a market token ID
    - Insert RTDS comments according to current sort mode (newest: prepend; most_liked: append at correct position by reactionCount)
    - Treat comments without position data as non-holders for filtering
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 2.3 Write property test for RTDS holder filtering
    - **Property 4: RTDS holder filtering**
    - **Validates: Requirements 6.1, 6.3**

  - [ ]* 2.4 Write property test for RTDS insertion sort order
    - **Property 5: RTDS insertion maintains sort order**
    - **Validates: Requirements 6.2**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Create `CommentsFilterBar` component
  - [x] 4.1 Create `apps/web/src/domains/trading/components/market/comments-filter-bar.tsx`
    - Implement `CommentsFilterBar` with props: `sortMode`, `holdersOnly`, `onSortChange`, `onHoldersChange`
    - Render a horizontal bar with sort dropdown (Newest / Most Liked) using pill/chip pattern consistent with Trades tab toolbar
    - Render a "Holders" checkbox pill
    - Use design tokens: `bg-surface-2`, `border-border`, `text-xs`, `font-medium`
    - Default state: sort "Newest", holders unchecked
    - Bar remains interactive during loading (no disabled state)
    - _Requirements: 1.1, 1.4, 2.1, 2.4, 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 5. Create `PositionBadge` component
  - [x] 5.1 Create `apps/web/src/domains/trading/components/market/position-badge.tsx`
    - Implement `PositionBadge` with props: `positionSize`, `tokenId`, `yesTokenId`, `noTokenId`, `yesOutcomeLabel`, `noOutcomeLabel`
    - Use `matchPosition` to determine side and label
    - Render pill with formatted size + outcome label
    - Green background for Yes-side, red background for No-side
    - Return null if no position matches
    - Use `text-[10px]` for badge text per design system
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4_

- [x] 6. Integrate filter bar and badges into `Comments` component
  - [x] 6.1 Add filter state and wire `CommentsFilterBar` into `Comments`
    - Add `useState` for `sortMode` and `holdersOnly` with defaults ("newest", false)
    - Wrap state changes in `startTransition` per project conventions
    - Render `CommentsFilterBar` above the comment list, sticky while scrolling
    - Pass filter state to `useComments` hook
    - _Requirements: 1.2, 1.3, 1.4, 1.5, 2.2, 2.3, 2.4, 2.5, 4.1, 4.4_

  - [x] 6.2 Wire `PositionBadge` into comment bubbles
    - Update `Comment` type to include `positions: CommentPosition[]`
    - Update `fromGammaComment` and `toComment` to extract positions from `profile.positions`
    - Get `yesTokenId`, `noTokenId`, and outcome labels from `useMarketTrading()` context
    - Render `PositionBadge` next to commenter display name in the `Bubble` component header
    - Badge visible for holders regardless of holdersOnly filter state
    - _Requirements: 3.1, 3.2, 3.3, 3.7, 5.1, 5.2, 5.3, 5.4_

  - [ ]* 6.3 Write property test for sort order invariant
    - **Property 1: Sort order invariant**
    - **Validates: Requirements 1.2, 1.3**

- [x] 7. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- The tRPC `events.comments` procedure already supports `get_positions`, `holders_only`, `order`, and `ascending` params — no server changes needed
- The `useMarketTrading()` context provides `yesTokenId`, `noTokenId`, `yesOutcomeLabel`, and `noOutcomeLabel` for position matching
- Property tests use `fast-check` (already in the project) and target the pure utility functions
- Filter state is local to `Comments` via `useState` (not Zustand) since it doesn't need cross-component sharing
