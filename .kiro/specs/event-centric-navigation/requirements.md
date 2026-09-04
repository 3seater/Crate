# Requirements Document

## Introduction

Restructure the Poly app's navigation and data organization to align with Polymarket's canonical Event → Market → Token hierarchy. The current implementation treats individual Markets as the primary entity, causing broken links (event slugs used in market routes), lost multi-outcome context (events flattened into individual markets), and confusing naming (components called "Market*" while operating on Event data). This feature introduces event-centric routing, component naming, and data flow while preserving the existing trading UI.

## Glossary

- **Event**: Top-level Polymarket entity identified by a slug. Contains a title, description, image, and one or more Markets. Example: "Presidential Election Winner 2024".
- **Market**: A prediction market within an Event. Identified by a condition_id. Contains a question, tokens, and trading parameters. Example: "Will Trump win?" within the election event.
- **Token**: A tradeable outcome share within a Market. Identified by a token_id. Has an outcome name and price. Example: "Yes" at 65¢.
- **Tag**: A category label used for filtering Events on the home page. Example: "Politics", "Sports".
- **Event_Slug**: The URL-safe identifier for an Event, used in Polymarket URLs (e.g., `presidential-election-winner-2024`).
- **Binary_Event**: An Event containing exactly one Market with two tokens (Yes/No).
- **Multi_Outcome_Event**: An Event containing multiple Markets, each representing a different outcome.
- **EventCard**: A UI component that displays an Event summary on the home page.
- **EventList**: A UI component that renders a scrollable grid of EventCards.
- **EventDiscovery**: A UI component that composes EventList with filtering and sorting controls.
- **Gamma_API**: Polymarket's REST API for fetching Events, Markets, Tags, and search results.
- **CLOB_API**: Polymarket's Central Limit Order Book API, which operates on token IDs for trading.
- **tRPC_Router**: The server-side router that exposes Gamma_API and CLOB_API data to the frontend via type-safe RPC calls.

## Requirements

### Requirement 1: Event-Centric Home Page

**User Story:** As a user, I want to browse prediction markets organized by Event, so that I can see the full context of multi-outcome events without losing grouping information.

#### Acceptance Criteria

1. WHEN the home page loads, THE EventList SHALL render one EventCard per Event without flattening Events into individual Markets.
2. WHEN an EventCard is displayed for a Binary_Event, THE EventCard SHALL show the Event title, image, and the Yes/No token prices from its single Market.
3. WHEN an EventCard is displayed for a Multi_Outcome_Event, THE EventCard SHALL show the Event title, image, and a summary of outcome prices across its Markets.
4. WHEN a user clicks an EventCard, THE EventCard SHALL navigate to `/event/{Event_Slug}`.
5. WHEN the home page applies tag filtering, THE EventList SHALL display only Events matching the selected Tag.
6. WHEN the home page applies sorting, THE EventList SHALL order Events according to the selected sort criterion.
7. WHEN the user scrolls to the bottom of the EventList, THE EventList SHALL load the next page of Events using infinite scroll.

### Requirement 2: Event Detail Page

**User Story:** As a user, I want to view a dedicated Event detail page, so that I can see all Markets and outcomes within an Event and trade on them.

#### Acceptance Criteria

1. WHEN a user navigates to `/event/{Event_Slug}`, THE Event_Detail_Page SHALL fetch and display the Event data including title, description, image, and all contained Markets.
2. WHEN the Event is a Binary_Event, THE Event_Detail_Page SHALL display the trading UI (orderbook, price chart, order form) directly for the single Market.
3. WHEN the Event is a Multi_Outcome_Event, THE Event_Detail_Page SHALL display a selectable list of Markets and show the trading UI for the currently selected Market.
4. WHEN a user selects a different Market within a Multi_Outcome_Event, THE Event_Detail_Page SHALL update the trading UI (orderbook, price chart, order form) to reflect the selected Market's token.
5. WHEN the Event contains metadata (volume, end date, resolution criteria), THE Event_Detail_Page SHALL display the metadata in a header section.
6. IF the Event_Slug does not match any Event in the Gamma_API, THEN THE Event_Detail_Page SHALL return a 404 Not Found response.

### Requirement 3: Market Detail Route Cleanup

**User Story:** As a developer, I want the `/market/[slug]` route to perform clean market-only lookups, so that the routing logic is predictable and free of hacky fallbacks.

#### Acceptance Criteria

1. WHEN a user navigates to `/market/{slug}` with a valid market slug or condition_id, THE Market_Detail_Page SHALL fetch and display that specific Market.
2. WHEN a user navigates to `/market/{slug}` where the slug matches an Event_Slug rather than a Market, THE Market_Detail_Page SHALL redirect to `/event/{slug}` with an HTTP 308 permanent redirect.
3. THE Gamma_API_Wrapper `getMarketBySlug` function SHALL perform a market-only lookup without falling back to event lookup.
4. IF the slug does not match any Market or Event, THEN THE Market_Detail_Page SHALL return a 404 Not Found response.

### Requirement 4: Component Renaming

**User Story:** As a developer, I want component names to reflect the data they operate on, so that the codebase is clear about the Event → Market → Token hierarchy.

#### Acceptance Criteria

1. THE MarketDiscovery component SHALL be renamed to EventDiscovery and accept Event data as its primary input.
2. THE MarketList component SHALL be renamed to EventList and render EventCards instead of MarketCards.
3. THE MarketCard component SHALL be renamed to EventCard and display Event-level information with links to `/event/{Event_Slug}`.
4. THE `flattenMarkets` function SHALL be removed from the codebase since EventList renders Events directly.
5. THE MarketFilters component SHALL be renamed to EventFilters to reflect that filtering operates on Events.

### Requirement 5: tRPC Router Restructuring

**User Story:** As a developer, I want the tRPC router to clearly separate Event operations from Market operations, so that the API surface matches the data model hierarchy.

#### Acceptance Criteria

1. THE tRPC_Router SHALL expose an `events` router with procedures for listing Events, fetching an Event by slug, fetching Tags, searching, and fetching Series.
2. THE tRPC_Router SHALL expose a `markets` router with procedures for fetching a single Market by slug or condition_id.
3. WHEN the `events.list` procedure is called, THE tRPC_Router SHALL return Event objects with their nested Markets intact.
4. WHEN the `events.getBySlug` procedure is called, THE tRPC_Router SHALL return a single Event with all its Markets and Tokens.
5. WHEN the `markets.getBySlug` procedure is called, THE tRPC_Router SHALL return a single Market without event fallback logic.

### Requirement 6: Search Integration

**User Story:** As a user, I want search results to link to the correct routes, so that clicking a search result takes me to the right page.

#### Acceptance Criteria

1. WHEN search returns Event results, THE search UI SHALL link each Event result to `/event/{Event_Slug}`.
2. WHEN search returns Market results that belong to an Event, THE search UI SHALL link each Market result to `/event/{Event_Slug}` with the Market pre-selected.
3. WHEN search is performed from the home page, THE EventList SHALL display matching Events from the search results.

### Requirement 7: Backward Compatibility

**User Story:** As a user, I want existing bookmarks and shared links to continue working, so that I don't encounter broken pages.

#### Acceptance Criteria

1. WHEN a user visits `/market/{Event_Slug}` (an event slug used in the old market route), THE application SHALL redirect to `/event/{Event_Slug}`.
2. WHEN a user visits `/market/{condition_id}` (a valid market identifier), THE Market_Detail_Page SHALL continue to display the Market trading UI.
3. THE existing trading UI components (Orderbook, OrderForm, PriceChart, OpenOrders) SHALL continue to function without modification when rendered within the Event_Detail_Page.
4. THE tag filtering and sorting functionality on the home page SHALL continue to work after the component renaming.
