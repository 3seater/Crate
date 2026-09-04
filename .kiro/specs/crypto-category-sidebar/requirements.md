# Requirements Document

## Introduction

When the user navigates to the Crypto topic tab on the Explore page, a category sidebar appears on the left side of the content area. The sidebar provides time-based and asset-based filtering categories that mirror Polymarket's Crypto tab organization. The main market content (card grid or table) shifts to the right to accommodate the sidebar. The sidebar is only visible when the Crypto tab is active and disappears when any other tab or mode is selected.

## Glossary

- **Crypto_Sidebar**: The vertical navigation panel that appears on the left side of the explore content area when the Crypto topic tab is active. Contains time-based and asset-based category filters.
- **Category_Item**: A single row in the Crypto_Sidebar consisting of a Lucide icon, a label, and a count of matching markets.
- **Time_Category**: A category that filters crypto markets by their resolution timeframe (e.g. 5 Min, 1 Hour, Daily). Corresponds to Polymarket sub-tags or market question patterns.
- **Asset_Category**: A category that filters crypto markets by the underlying cryptocurrency asset (e.g. Bitcoin, Ethereum, Solana).
- **Active_Category**: The currently selected Category_Item in the Crypto_Sidebar, visually highlighted with the Doji green accent.
- **Market_Count**: The integer displayed beside each Category_Item label, representing the number of active crypto markets matching that category.
- **Explore_Content**: The main content area of the Explore page that renders either the events table or the card grid.
- **Category_Separator**: A horizontal divider line in the Crypto_Sidebar that visually separates Time_Categories from Asset_Categories.

## Requirements

### Requirement 1: Sidebar Visibility

**User Story:** As a user, I want the category sidebar to appear only when the Crypto tab is active, so that the sidebar does not clutter the interface for other topic categories.

#### Acceptance Criteria

1. WHEN the user selects the Crypto topic tab, THE Crypto_Sidebar SHALL render on the left side of the Explore_Content area.
2. WHEN the user selects any topic tab other than Crypto, THE Crypto_Sidebar SHALL not be rendered.
3. WHEN the user selects a mode category (Trending, New, or All), THE Crypto_Sidebar SHALL not be rendered.
4. WHEN the Crypto topic tab is deselected by clicking it again, THE Crypto_Sidebar SHALL not be rendered.

### Requirement 2: Layout Shift

**User Story:** As a user, I want the market content to shift right when the sidebar appears, so that both the sidebar and the market content are visible without overlap.

#### Acceptance Criteria

1. WHILE the Crypto_Sidebar is visible, THE Explore_Content SHALL shift to the right to accommodate the sidebar width.
2. WHILE the Crypto_Sidebar is visible AND the view mode is card grid, THE Explore_Content SHALL display the card grid to the right of the Crypto_Sidebar.
3. WHILE the Crypto_Sidebar is visible AND the view mode is table, THE Explore_Content SHALL display the table to the right of the Crypto_Sidebar.
4. WHEN the Crypto_Sidebar is hidden, THE Explore_Content SHALL occupy the full available width.

### Requirement 3: Time-Based Categories

**User Story:** As a user, I want to filter crypto markets by time-based categories, so that I can find markets matching my preferred resolution timeframe.

#### Acceptance Criteria

1. THE Crypto_Sidebar SHALL display the following Time_Categories in this exact order: All, 5 Min, 15 Min, 1 Hour, 4 Hours, Daily, Weekly, Monthly, Yearly, Pre-Market, ETF.
2. THE "All" Category_Item SHALL display a Market_Count equal to the total number of active crypto markets.
3. WHEN the user selects a Time_Category, THE Explore_Content SHALL display only crypto markets matching that time-based category.
4. WHEN the Crypto_Sidebar first renders, THE "All" Time_Category SHALL be the Active_Category.

### Requirement 4: Asset-Based Categories

**User Story:** As a user, I want to filter crypto markets by specific cryptocurrency assets, so that I can focus on markets for a particular coin.

#### Acceptance Criteria

1. THE Crypto_Sidebar SHALL display a Category_Separator between the Time_Categories and the Asset_Categories.
2. THE Crypto_Sidebar SHALL display the following Asset_Categories in this exact order after the separator: Bitcoin, Ethereum, Solana, XRP, Dogecoin, BNB, Microstrategy.
3. WHEN the user selects an Asset_Category, THE Explore_Content SHALL display only crypto markets matching that asset.
4. WHEN the user selects an Asset_Category, THE previously Active_Category SHALL be deselected.

### Requirement 5: Category Icons

**User Story:** As a user, I want each category to have a recognizable icon, so that I can quickly scan the sidebar visually.

#### Acceptance Criteria

1. THE Crypto_Sidebar SHALL display a Lucide icon to the left of each Category_Item label.
2. THE icon for each Category_Item SHALL be contextually appropriate (e.g. a clock variant for time-based categories, a coin or currency icon for asset-based categories).
3. THE icons SHALL use the design system text color tokens (text-text-secondary for inactive, text-text-primary or Doji green for active).

### Requirement 6: Market Counts

**User Story:** As a user, I want to see how many markets exist in each category, so that I can gauge the depth of each filter before selecting it.

#### Acceptance Criteria

1. THE Crypto_Sidebar SHALL display a Market_Count to the right of each Category_Item label.
2. THE Market_Count for each Category_Item SHALL reflect the number of active crypto markets that match that category.
3. WHEN the market data updates (e.g. new markets added or markets resolved), THE Market_Count SHALL reflect the current count.

### Requirement 7: Active State Styling

**User Story:** As a user, I want clear visual feedback for the selected category, so that I know which filter is currently applied.

#### Acceptance Criteria

1. WHEN a Category_Item is the Active_Category, THE Crypto_Sidebar SHALL highlight the Category_Item row with a background tint derived from the Doji green color token.
2. WHEN a Category_Item is the Active_Category, THE Category_Item label and icon SHALL use the text-text-primary color token.
3. WHEN a Category_Item is not the Active_Category, THE Category_Item label SHALL use the text-text-secondary color token.
4. WHEN the user hovers over an inactive Category_Item, THE Category_Item row SHALL display a subtle hover background using the surface-2 or market-list-hover token.

### Requirement 8: Single Selection

**User Story:** As a user, I want only one category to be active at a time, so that the filtering behavior is predictable.

#### Acceptance Criteria

1. THE Crypto_Sidebar SHALL allow only one Active_Category at a time across both Time_Categories and Asset_Categories.
2. WHEN the user selects a new Category_Item, THE previously Active_Category SHALL be deselected.
3. WHEN the user selects the currently Active_Category (other than "All"), THE Active_Category SHALL reset to "All".

### Requirement 9: Design System Compliance

**User Story:** As a developer, I want the sidebar to follow the project design system, so that the UI is consistent with the rest of the application.

#### Acceptance Criteria

1. THE Crypto_Sidebar SHALL use only font sizes from the 6-size type scale (text-sm for category labels, text-xs for counts or section headers).
2. THE Crypto_Sidebar SHALL use only font-normal (400) and font-medium (500) weights.
3. THE Crypto_Sidebar SHALL use design system color tokens (text-text-primary, text-text-secondary, bg-surface-1, bg-surface-2, border-default) and not hardcoded color values.
4. THE Crypto_Sidebar background SHALL use the surface-0 or surface-1 token to match the dark theme.
5. THE Crypto_Sidebar SHALL use a border-default right border to separate the sidebar from the Explore_Content.

### Requirement 10: Filtering Mechanism

**User Story:** As a developer, I want the sidebar categories to filter markets using the existing tag and sub-tag system, so that the implementation integrates with the current data architecture.

#### Acceptance Criteria

1. THE Crypto_Sidebar SHALL filter markets by applying sub-tag slugs or client-side filtering on the crypto-tagged event results already fetched by the Explore page.
2. WHEN a Time_Category is selected, THE filtering logic SHALL match crypto markets whose tags or question text correspond to that timeframe.
3. WHEN an Asset_Category is selected, THE filtering logic SHALL match crypto markets whose tags or question text reference that specific cryptocurrency asset.
4. IF no markets match the selected category, THEN THE Explore_Content SHALL display an empty state message.

### Requirement 11: Responsive Behavior

**User Story:** As a user on a smaller screen, I want the sidebar to adapt gracefully, so that the content remains usable.

#### Acceptance Criteria

1. WHILE the viewport width is below the small breakpoint (sm), THE Crypto_Sidebar SHALL be hidden and the Explore_Content SHALL occupy the full width.
2. WHILE the viewport width is at or above the small breakpoint, THE Crypto_Sidebar SHALL be visible when the Crypto tab is active.
