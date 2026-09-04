# Requirements Document

## Introduction

Redesign the empty states across all tables in the trading terminal and portfolio pages. The current empty states are plain text strings (e.g. "No open positions") rendered in a simple `<span>`. The goal is to replace them with polished empty states following the shadcn/ui Empty component pattern: a contextual Lucide icon, a title with primary text emphasis, and a supporting description with muted text. No action buttons (no "Explore Markets" CTAs). The existing `Empty`, `EmptyHeader`, `EmptyMedia`, `EmptyTitle`, and `EmptyDescription` primitives in `@/components/ui/empty` serve as the foundation.

## Glossary

- **Empty_State_Component**: The reusable UI primitive composed of `Empty`, `EmptyHeader`, `EmptyMedia` (icon variant), `EmptyTitle`, and `EmptyDescription` from `@/components/ui/empty`
- **Trading_Terminal**: The market/event detail page workspace containing tabs for Positions, Orders, History, Trades, Holders, and Comments
- **Portfolio_Page**: The `/portfolio` route containing tabs for open positions, closed positions, open orders, activity history, and redeemable positions
- **Design_Token_System**: The project's design system defined in `apps/web/src/index.css` — text colors (`text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-muted`), the 6-size type scale (`text-3xl` through `text-[10px]`), and weight constraints (`font-normal`, `font-medium` only)

## Requirements

### Requirement 1: Reusable Table Empty State Composition

**User Story:** As a developer, I want a consistent empty state composition for tables, so that all table empty states share the same visual structure without duplicating layout code.

#### Acceptance Criteria

1. THE Empty_State_Component SHALL render a vertically centered layout containing an icon area, a title, and a description in that order
2. WHEN the `variant` prop of EmptyMedia is set to `"icon"`, THE Empty_State_Component SHALL render the Lucide icon inside a rounded container with a muted background
3. THE EmptyTitle SHALL use `text-sm` size and `font-medium` weight with `text-text-primary` color
4. THE EmptyDescription SHALL use `text-xs` size and `font-normal` weight with `text-text-muted` color
5. THE Empty_State_Component SHALL NOT render any action buttons or call-to-action links

### Requirement 2: Trading Terminal Positions Tab Empty State

**User Story:** As a logged-in trader viewing a market, I want to see a polished empty state in the Positions tab when I have no positions, so that the interface feels intentional rather than broken.

#### Acceptance Criteria

1. WHEN the logged-in user has no positions for the current market, THE Trading_Terminal Positions tab SHALL display the Empty_State_Component with a contextual icon, the title "No open positions", and a description "Your positions for this market will appear here"
2. WHEN the user is not connected, THE Trading_Terminal Positions tab SHALL display the Empty_State_Component with the title "Connect wallet to see positions" and an appropriate description

### Requirement 3: Trading Terminal Orders Tab Empty State

**User Story:** As a logged-in trader viewing a market, I want to see a polished empty state in the Orders tab when I have no open orders, so that the tab feels complete.

#### Acceptance Criteria

1. WHEN the logged-in user has no open orders for the current market, THE Trading_Terminal Orders tab SHALL display the Empty_State_Component with a contextual icon, the title "No open orders", and a description "Your limit orders for this market will appear here"

### Requirement 4: Trading Terminal History Tab Empty State

**User Story:** As a logged-in trader viewing a market, I want to see a polished empty state in the History tab when I have no trade history, so that the tab communicates clearly.

#### Acceptance Criteria

1. WHEN the logged-in user has no trade history for the current market, THE Trading_Terminal History tab SHALL display the Empty_State_Component with a contextual icon, the title "No history yet", and a description "Your trades and activity for this market will appear here"
2. WHEN the user is not connected, THE Trading_Terminal History tab SHALL display the Empty_State_Component with the title "Connect wallet to see history" and an appropriate description

### Requirement 5: Trading Terminal Trades Tab Empty State

**User Story:** As a user viewing a market, I want to see a polished empty state in the Trades tab when there are no trades, so that the tab looks intentional.

#### Acceptance Criteria

1. WHEN there are no trades for the current market, THE Trading_Terminal Trades tab SHALL display the Empty_State_Component with a contextual icon, the title "No trades yet", and a description "Trades for this market will appear here"

### Requirement 6: Trading Terminal Holders Tab Empty State

**User Story:** As a user viewing a market, I want to see a polished empty state in the Holders tab when there are no holders, so that the tab looks complete.

#### Acceptance Criteria

1. WHEN there are no holders for the current market, THE Trading_Terminal Holders tab SHALL display the Empty_State_Component with a contextual icon, the title "No holders data", and a description "Holder information for this market will appear here"

### Requirement 7: Portfolio Open Positions Table Empty State

**User Story:** As a logged-in user on the portfolio page, I want to see a polished empty state when I have no open positions, so that the page feels designed rather than empty.

#### Acceptance Criteria

1. WHEN the logged-in user has no open positions, THE Portfolio_Page open positions table SHALL display the Empty_State_Component with a contextual icon, the title "No open positions", and a description "Markets you hold positions in will appear here"
2. WHEN a search query is active and no positions match, THE Portfolio_Page open positions table SHALL display the Empty_State_Component with the title "No positions match your search" and a description indicating the filter returned no results

### Requirement 8: Portfolio Closed Positions Table Empty State

**User Story:** As a logged-in user on the portfolio page, I want to see a polished empty state when I have no closed positions, so that the section communicates clearly.

#### Acceptance Criteria

1. WHEN the logged-in user has no closed positions, THE Portfolio_Page closed positions table SHALL display the Empty_State_Component with a contextual icon, the title "No closed positions", and a description "Resolved or sold positions will appear here"
2. WHEN a search query is active and no closed positions match, THE Portfolio_Page closed positions table SHALL display the Empty_State_Component with the title "No positions match your search" and a description indicating the filter returned no results

### Requirement 9: Portfolio Orders Table Empty State

**User Story:** As a logged-in user on the portfolio page, I want to see a polished empty state when I have no open orders, so that the section looks polished.

#### Acceptance Criteria

1. WHEN the logged-in user has no open orders, THE Portfolio_Page orders table SHALL display the Empty_State_Component with a contextual icon, the title "No open orders", and a description "Your pending limit orders will appear here"
2. WHEN a search query is active and no orders match, THE Portfolio_Page orders table SHALL display the Empty_State_Component with the title "No orders match your search" and a description indicating the filter returned no results

### Requirement 10: Portfolio Activity History Table Empty State

**User Story:** As a logged-in user on the portfolio page, I want to see a polished empty state when I have no activity history, so that the section feels intentional.

#### Acceptance Criteria

1. WHEN the logged-in user has no activity history, THE Portfolio_Page activity history table SHALL display the Empty_State_Component with a contextual icon, the title "No history found", and a description "Your trade activity and transactions will appear here"

### Requirement 11: Portfolio Redeem Tab Empty State

**User Story:** As a logged-in user on the portfolio page, I want to see a polished empty state when I have no redeemable positions, so that the section communicates clearly.

#### Acceptance Criteria

1. WHEN the logged-in user has no positions eligible to redeem, THE Portfolio_Page redeem tab SHALL display the Empty_State_Component with a contextual icon, the title "No positions eligible to redeem", and a description "Resolved winning positions will appear here for redemption"

### Requirement 12: Trading Terminal Open Orders Panel Empty State

**User Story:** As a logged-in trader, I want to see a polished empty state in the sidebar open orders panel when I have no orders, so that the panel looks complete.

#### Acceptance Criteria

1. WHEN the logged-in user has no open orders in the trading terminal sidebar panel, THE open orders panel SHALL display the Empty_State_Component with a contextual icon, the title "No open orders", and a description "Orders you place will appear here"

### Requirement 13: Design Token Compliance

**User Story:** As a designer, I want all empty states to use the project's design token system, so that the UI remains consistent with the rest of the application.

#### Acceptance Criteria

1. THE Empty_State_Component SHALL use only colors from the Design_Token_System (`text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `text-text-muted`) and SHALL NOT use hardcoded color values
2. THE Empty_State_Component SHALL use only font sizes from the 6-size type scale (`text-3xl`, `text-2xl`, `text-lg`, `text-sm`, `text-xs`, `text-[10px]`) and SHALL NOT use unsanctioned sizes such as `text-base` or `text-xl`
3. THE Empty_State_Component SHALL use only `font-normal` or `font-medium` weights and SHALL NOT use `font-semibold` or `font-bold`
4. THE Empty_State_Component icon color SHALL use `text-text-muted` or `text-muted-foreground` to maintain visual hierarchy
