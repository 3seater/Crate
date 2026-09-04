# Requirements Document

## Introduction

The Watchlist System replaces the current hardcoded WatchlistProvider with a server-persisted, user-scoped watchlist. It lives in the top bar area (the WatchlistBar below the SiteHeader) and supports two viewing modes: Position Mode (shows only markets where the user holds positions) and Favorites Mode (shows user-starred markets). Both modes can display position value inline when the user has an active position. A settings dialog controls display preferences including position value visibility and sort order. The system follows the same DB-backed tRPC pattern established by wallet tracking.

## Glossary

- **Watchlist_System**: The Doji subsystem responsible for persisting, retrieving, and displaying a user's watchlisted markets in the top bar.
- **Watchlist_Item**: A database record associating a Doji user with a Polymarket market identified by its condition ID.
- **Watchlist_Bar**: The horizontal UI strip rendered below the SiteHeader that displays watchlisted markets with prices and optional position values.
- **Position_Mode**: A viewing filter that restricts the Watchlist_Bar to markets where the authenticated user holds an active position (size > 0).
- **Favorites_Mode**: A viewing filter that shows all markets the user has explicitly starred/favorited in the Watchlist_System.
- **Position_Value**: The computed dollar value of a user's holding in a market, calculated as position size multiplied by current price.
- **Condition_ID**: The unique onchain identifier for a Polymarket market, used as the key to link watchlist items to market data and positions.
- **Data_API_Proxy**: The existing tRPC data router that proxies Polymarket Data API endpoints (positions, value, trades) through the Doji server.
- **User**: An authenticated Doji user identified by a JWT session containing userId and issuer fields.
- **Safe_Address**: The user's Gnosis Safe wallet address used to query positions from the Polymarket Data API.
- **Watchlist_Widget**: A draggable, floating panel opened from the Bottom_Bar that displays the user's watchlisted markets with prices and position data, following the same widget pattern as the Wallet Tracker widget.
- **Bottom_Bar**: The fixed footer bar at the bottom of the application that contains shortcut buttons for opening widgets (Wallet Tracker, Calendar, Watchlist).

## Requirements

### Requirement 1: Persist Watchlist Items in PostgreSQL

**User Story:** As a Doji user, I want my watchlisted markets saved to the database, so that they persist across devices and browser sessions.

#### Acceptance Criteria

1. THE Watchlist_System SHALL store each Watchlist_Item as a database record containing a unique ID, the owning user's ID, the market Condition_ID, and created/updated timestamps.
2. THE Watchlist_System SHALL enforce a unique constraint on the combination of user ID and Condition_ID, preventing duplicate entries for the same market by the same user.
3. THE Watchlist_System SHALL enforce a foreign key relationship between the Watchlist_Item's user ID and the users table, with cascade delete.
4. THE Watchlist_System SHALL enforce a maximum of 200 watchlist items per user.

### Requirement 2: Add a Market to the Watchlist

**User Story:** As a Doji user, I want to star a market to add it to my watchlist, so that I can track its price in the top bar.

#### Acceptance Criteria

1. WHEN an authenticated user submits a valid Condition_ID, THE Watchlist_System SHALL create a new Watchlist_Item record and return the created record.
2. WHEN the submitted Condition_ID is already in the user's watchlist, THE Watchlist_System SHALL reject the request with a conflict error indicating the market is already watchlisted.
3. WHEN a user attempts to add a market beyond the 200-item limit, THE Watchlist_System SHALL reject the request with an error indicating the limit has been reached.

### Requirement 3: Remove a Market from the Watchlist

**User Story:** As a Doji user, I want to unstar a market to remove it from my watchlist, so that I no longer see it in the top bar.

#### Acceptance Criteria

1. WHEN an authenticated user requests removal of a Watchlist_Item by Condition_ID, THE Watchlist_System SHALL delete the record and confirm deletion.
2. WHEN the specified Condition_ID does not exist in the user's watchlist, THE Watchlist_System SHALL return a success response without error (idempotent delete).

### Requirement 4: Toggle Watchlist Item

**User Story:** As a Doji user, I want to toggle a market's watchlist status with a single action, so that starring and unstarring is seamless.

#### Acceptance Criteria

1. WHEN an authenticated user toggles a Condition_ID that is not in the watchlist, THE Watchlist_System SHALL add the market to the watchlist.
2. WHEN an authenticated user toggles a Condition_ID that is already in the watchlist, THE Watchlist_System SHALL remove the market from the watchlist.
3. THE Watchlist_System SHALL return the resulting state (added or removed) after the toggle operation.

### Requirement 5: List Watchlist Items

**User Story:** As a Doji user, I want to retrieve all my watchlisted markets, so that the Watchlist_Bar can display them.

#### Acceptance Criteria

1. WHEN an authenticated user requests their watchlist, THE Watchlist_System SHALL return all Watchlist_Item records belonging to that user, ordered by creation date descending.
2. THE Watchlist_System SHALL return each Watchlist_Item with its ID, Condition_ID, and timestamps.

### Requirement 6: Enrich Watchlist Items with Market Data

**User Story:** As a Doji user, I want to see market titles and current prices in my watchlist, so that I can monitor markets at a glance.

#### Acceptance Criteria

1. WHEN the Watchlist_Bar renders, THE Watchlist_System SHALL fetch market metadata (title, current Yes price, current No price, slug, event slug, icon) from the Gamma API for all watchlisted Condition_IDs.
2. IF the Gamma API returns an error for a batch of markets, THEN THE Watchlist_System SHALL display the available data and omit markets that failed to load.
3. THE Watchlist_System SHALL cache enriched market data using TanStack Query with a stale time appropriate for price freshness (30 seconds).

### Requirement 7: Position Mode Display

**User Story:** As a Doji user, I want a Position Mode that shows only markets where I hold positions, so that I can focus on my active holdings.

#### Acceptance Criteria

1. WHEN Position_Mode is active, THE Watchlist_Bar SHALL display only markets where the user's position size is greater than zero, as determined by the Data_API_Proxy positions endpoint.
2. WHEN Position_Mode is active and the user has no positions in any watchlisted market, THE Watchlist_Bar SHALL display a message indicating no markets with active positions.
3. WHEN Position_Mode is activated, THE Watchlist_Bar SHALL deactivate Favorites_Mode.

### Requirement 8: Favorites Mode Display

**User Story:** As a Doji user, I want a Favorites Mode that shows all my starred markets, so that I can see everything I'm tracking.

#### Acceptance Criteria

1. WHEN Favorites_Mode is active, THE Watchlist_Bar SHALL display all markets in the user's watchlist regardless of position status.
2. WHEN Favorites_Mode is active and the user holds a position in a favorited market, THE Watchlist_Bar SHALL display the Position_Value for that market when the "Show position value" setting is enabled.
3. WHEN Favorites_Mode is activated, THE Watchlist_Bar SHALL deactivate Position_Mode.

### Requirement 9: Position Value Display

**User Story:** As a Doji user, I want to see my position value next to market prices in the watchlist, so that I can monitor my holdings without navigating to the portfolio.

#### Acceptance Criteria

1. WHEN the "Show position value" setting is enabled and the user holds a position in a displayed market, THE Watchlist_Bar SHALL render the Position_Value formatted as a dollar amount (e.g. "$12.50") next to the Yes/No prices.
2. WHEN the "Show position value" setting is enabled and the user does not hold a position in a displayed market, THE Watchlist_Bar SHALL omit the Position_Value for that market.
3. THE Watchlist_System SHALL compute Position_Value as the product of position size and current price from the positions data.

### Requirement 10: Watchlist Settings Dialog

**User Story:** As a Doji user, I want a settings dialog to configure my watchlist display preferences, so that I can customize the information shown.

#### Acceptance Criteria

1. WHEN the user opens the settings dialog, THE Watchlist_System SHALL display a "Sort watchlist by" selector with options: Price, Volume, and Expiration.
2. WHEN the user opens the settings dialog, THE Watchlist_System SHALL display a "Show position value" checkbox that toggles Position_Value visibility in the Watchlist_Bar.
3. WHEN the user changes a setting, THE Watchlist_Bar SHALL reflect the change immediately without requiring a page reload.
4. THE Watchlist_System SHALL persist display preferences in browser localStorage so they survive page refreshes.

### Requirement 11: Watchlist Bar Interaction

**User Story:** As a Doji user, I want to click a market in the watchlist bar to navigate to its trading page, so that I can quickly trade markets I'm watching.

#### Acceptance Criteria

1. WHEN the user clicks a market item in the Watchlist_Bar, THE Watchlist_System SHALL navigate to the market's trading page using the market slug (e.g. `/market/{slug}`).
2. THE Watchlist_Bar SHALL support horizontal scrolling via mouse wheel when the list overflows the available width.
3. THE Watchlist_Bar SHALL display a green dot indicator, the market title (truncated if needed), Yes price in profit color, and No price in loss color for each market item.

### Requirement 12: tRPC Router Integration

**User Story:** As a developer, I want watchlist operations exposed as a tRPC router, so that it follows the existing server architecture patterns.

#### Acceptance Criteria

1. THE Watchlist_System SHALL expose add, remove, toggle, and list operations as tRPC procedures under a dedicated `watchlist` namespace in the app router.
2. THE Watchlist_System SHALL use protectedProcedure for all mutation and query procedures, requiring a valid JWT session.
3. THE Watchlist_System SHALL validate all inputs using Zod schemas consistent with the existing router patterns.
4. IF a database operation fails unexpectedly, THEN THE Watchlist_System SHALL return a tRPC INTERNAL_SERVER_ERROR with a generic message and log the detailed error server-side.

### Requirement 13: Frontend Server-Backed State

**User Story:** As a Doji user, I want the watchlist UI to use server data, so that my watchlist is consistent across sessions and devices.

#### Acceptance Criteria

1. THE Watchlist_System frontend SHALL fetch watchlist items from the tRPC watchlist.list endpoint on mount.
2. THE Watchlist_System frontend SHALL call tRPC watchlist.toggle for star/unstar operations from market pages and the Watchlist_Bar.
3. THE Watchlist_System frontend SHALL use TanStack Query cache invalidation to refresh the watchlist after mutations.
4. THE Watchlist_System frontend SHALL display loading states using skeleton loaders consistent with the existing UI patterns.
5. WHILE the user is not authenticated, THE Watchlist_Bar SHALL display an empty state and disable star/toggle interactions.

### Requirement 14: Unauthenticated Fallback

**User Story:** As an unauthenticated visitor, I want to see the watchlist bar area without errors, so that the layout remains stable.

#### Acceptance Criteria

1. WHILE the user is not authenticated, THE Watchlist_Bar SHALL render the bar chrome (settings icon, mode toggles) in a disabled state without fetching server data.
2. WHILE the user is not authenticated, THE Watchlist_Bar SHALL not display any market items or position data.

### Requirement 15: Watchlist Widget in Bottom Bar

**User Story:** As a Doji user, I want a Watchlist widget accessible from the bottom bar, so that I can view and interact with my watchlisted markets in a floating panel without leaving my current page, similar to the Wallet Tracker widget.

#### Acceptance Criteria

1. THE Bottom_Bar SHALL display a "Watchlist" button alongside the existing Wallet Tracker and Calendar buttons in the left-side button group.
2. WHEN the user clicks the Watchlist button in the Bottom_Bar, THE Watchlist_Widget SHALL open as a draggable, floating panel positioned at the center of the viewport.
3. THE Watchlist_Widget SHALL display a title bar with a drag handle, the label "Watchlist", and a close button, consistent with the Wallet Tracker widget layout.
4. THE Watchlist_Widget SHALL render the user's watchlisted markets with market title, Yes price, No price, and optional Position_Value, reusing the same data and display logic as the Watchlist_Bar.
5. THE Watchlist_Widget SHALL support the same mode toggles (Position_Mode and Favorites_Mode) available in the Watchlist_Bar.
6. WHEN the user presses the Escape key while the Watchlist_Widget is open, THE Watchlist_Widget SHALL close.
7. WHEN the user clicks a market item in the Watchlist_Widget, THE Watchlist_System SHALL navigate to the market's trading page using the market slug.
8. WHILE the user is not authenticated, THE Bottom_Bar SHALL display the Watchlist button in a disabled state and THE Watchlist_Widget SHALL not open.
