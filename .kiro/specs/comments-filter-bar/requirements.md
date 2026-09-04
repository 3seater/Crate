# Requirements Document

## Introduction

Add a filter/sort toolbar and position badges to the Comments tab on market pages. The toolbar allows users to sort comments by recency or popularity and filter to only show comments from position holders. Position badges display next to commenter names to indicate their market position (outcome and size), similar to Polymarket's native UI.

## Glossary

- **Filter_Bar**: A horizontal toolbar rendered at the top of the comments section containing sort and filter controls.
- **Comments_Component**: The existing `Comments` React component at `apps/web/src/domains/trading/components/market/comments.tsx`.
- **Position_Badge**: A pill-shaped inline element displayed next to a commenter's display name showing their position size and held outcome.
- **Gamma_API**: Polymarket's backend API that serves comments with optional position enrichment via `get_positions` and `holders_only` query parameters.
- **Market_Trading_Context**: The React context providing current market data (token IDs, outcome labels, condition ID) to child components.
- **Sort_Mode**: An enumeration of comment ordering strategies: "Newest" (by `createdAt` descending) or "Most Liked" (by `reactionCount` descending).
- **Holders_Filter**: A boolean toggle that, when active, restricts displayed comments to users who hold a position in the current market.

## Requirements

### Requirement 1: Sort Dropdown

**User Story:** As a user viewing market comments, I want to sort comments by newest or most liked, so that I can find the most relevant or recent discussion.

#### Acceptance Criteria

1. THE Filter_Bar SHALL display a dropdown control with the options "Newest" and "Most Liked".
2. WHEN the user selects "Newest", THE Comments_Component SHALL order comments by `createdAt` descending.
3. WHEN the user selects "Most Liked", THE Comments_Component SHALL order comments by `reactionCount` descending.
4. THE Filter_Bar SHALL default the sort dropdown to "Newest" on initial render.
5. WHEN the sort mode changes, THE Comments_Component SHALL re-fetch comments from the Gamma_API with the corresponding `order` parameter.

### Requirement 2: Holders Filter

**User Story:** As a user viewing market comments, I want to filter comments to only show those from users who hold a position, so that I can focus on opinions from people with skin in the game.

#### Acceptance Criteria

1. THE Filter_Bar SHALL display a "Holders" checkbox control.
2. WHEN the "Holders" checkbox is checked, THE Comments_Component SHALL pass `holders_only: true` to the Gamma_API query.
3. WHEN the "Holders" checkbox is unchecked, THE Comments_Component SHALL display all comments without holder filtering.
4. THE Filter_Bar SHALL default the "Holders" checkbox to unchecked on initial render.
5. WHEN the holders filter state changes, THE Comments_Component SHALL re-fetch comments from the Gamma_API with the updated `holders_only` parameter.

### Requirement 3: Position Badge Display

**User Story:** As a user reading market comments, I want to see each commenter's position size and outcome, so that I can understand their financial stake and potential bias.

#### Acceptance Criteria

1. THE Comments_Component SHALL pass `get_positions: true` to the Gamma_API query to request position data with comments.
2. WHEN a commenter holds a position in the current market, THE Comments_Component SHALL display a Position_Badge next to the commenter's display name.
3. WHEN a commenter does not hold a position in the current market, THE Comments_Component SHALL not display a Position_Badge for that commenter.
4. THE Position_Badge SHALL display the position size formatted with appropriate suffixes (e.g. "354.8K", "1.2M") followed by the outcome label (e.g. "Yes", "No").
5. WHEN the held position corresponds to the Yes outcome token, THE Position_Badge SHALL render with a green background color.
6. WHEN the held position corresponds to the No outcome token, THE Position_Badge SHALL render with a red background color.
7. THE Position_Badge SHALL always be visible for holders regardless of the Holders_Filter state.

### Requirement 4: Filter Bar Layout and Styling

**User Story:** As a user, I want the filter bar to match the existing design system, so that the UI feels consistent with the rest of the trading interface.

#### Acceptance Criteria

1. THE Filter_Bar SHALL render as a horizontal bar at the top of the comments section, above the comment list.
2. THE Filter_Bar SHALL use the project design tokens: `bg-surface-2`, `border-border`, `text-xs`, `font-medium` for labels.
3. THE Filter_Bar SHALL use the same pill/chip pattern as the Trades tab toolbar (`rounded-md`, `h-8`, `border-border`).
4. THE Filter_Bar SHALL remain visible while the comment list scrolls.
5. WHILE the comments are loading, THE Filter_Bar SHALL remain interactive and retain its current filter state.

### Requirement 5: Position Badge Matching

**User Story:** As a developer, I want position badges to correctly match positions to the current market's token IDs, so that badges only appear for relevant positions.

#### Acceptance Criteria

1. THE Comments_Component SHALL match position `tokenId` from the Gamma_API response against the current market's Yes and No token IDs from the Market_Trading_Context.
2. WHEN a position's `tokenId` matches the market's Yes token ID, THE Position_Badge SHALL display the Yes outcome label.
3. WHEN a position's `tokenId` matches the market's No token ID, THE Position_Badge SHALL display the No outcome label.
4. IF a position's `tokenId` does not match either of the current market's token IDs, THEN THE Comments_Component SHALL not display a Position_Badge for that position.

### Requirement 6: Real-Time Comment Integration

**User Story:** As a user, I want new real-time comments to respect the current filter and sort settings, so that the comment list stays consistent.

#### Acceptance Criteria

1. WHEN a new comment arrives via RTDS while the Holders_Filter is active, THE Comments_Component SHALL only display the comment if the commenter holds a position in the current market.
2. WHEN a new comment arrives via RTDS, THE Comments_Component SHALL insert the comment according to the current Sort_Mode ordering.
3. IF a new comment arrives via RTDS without position data, THEN THE Comments_Component SHALL treat the commenter as a non-holder for filtering purposes.
