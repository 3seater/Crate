# Requirements Document

## Introduction

Wallet Tracking enables authenticated Doji users to save Polymarket wallet addresses to their account and subscribe to activity from those wallets. The current implementation stores tracked wallets in browser localStorage with no backend persistence. This feature replaces that with server-side storage in PostgreSQL, exposes CRUD operations via tRPC, and provides activity feeds (trades, positions, portfolio value) for all tracked wallets. Wallet tracking is an authenticated-only feature; users must be logged in to track wallets.

## Glossary

- **Wallet_Tracker**: The Doji subsystem responsible for persisting, retrieving, and managing tracked wallet records and their associated activity data.
- **Tracked_Wallet**: A database record associating a Doji user with an external Polymarket wallet address and a user-assigned label.
- **Activity_Feed**: An aggregated, chronologically sorted stream of trades, positions, and value changes across all of a user's tracked wallets.
- **Data_API_Proxy**: The existing tRPC data router that proxies Polymarket Data API endpoints (trades, positions, activity, value) through the Doji server.
- **Wallet_Address**: A valid Ethereum address (0x followed by 40 hexadecimal characters) representing a Polymarket user's onchain identity.
- **User**: An authenticated Doji user identified by a JWT session containing userId and issuer fields.

## Requirements

### Requirement 1: Persist Tracked Wallets in PostgreSQL

**User Story:** As a Doji user, I want my tracked wallets saved to the database, so that they persist across devices and browser sessions.

#### Acceptance Criteria

1. THE Wallet_Tracker SHALL store each Tracked_Wallet as a database record containing a unique ID, the owning user's ID, a user-assigned label, the Wallet_Address, and created/updated timestamps.
2. THE Wallet_Tracker SHALL enforce a unique constraint on the combination of user ID and Wallet_Address, preventing duplicate tracking of the same address by the same user.
3. THE Wallet_Tracker SHALL enforce a foreign key relationship between the Tracked_Wallet's user ID and the users table.

### Requirement 2: Add a Tracked Wallet

**User Story:** As a Doji user, I want to add a Polymarket wallet address to my tracking list, so that I can monitor its activity.

#### Acceptance Criteria

1. WHEN an authenticated user submits a valid Wallet_Address and an optional label, THE Wallet_Tracker SHALL create a new Tracked_Wallet record and return the created record.
2. WHEN the submitted Wallet_Address does not match the Ethereum address format (0x followed by 40 hex characters), THE Wallet_Tracker SHALL reject the request with a validation error.
3. WHEN the submitted Wallet_Address is already tracked by the same user, THE Wallet_Tracker SHALL reject the request with a conflict error indicating the address is already tracked.
4. WHEN no label is provided, THE Wallet_Tracker SHALL assign a default label using the truncated address format (first 6 and last 4 characters).
5. THE Wallet_Tracker SHALL enforce a maximum of 50 tracked wallets per user.
6. WHEN a user attempts to add a wallet beyond the 50-wallet limit, THE Wallet_Tracker SHALL reject the request with an error indicating the limit has been reached.

### Requirement 3: List Tracked Wallets

**User Story:** As a Doji user, I want to see all wallets I am tracking, so that I can manage my watchlist.

#### Acceptance Criteria

1. WHEN an authenticated user requests their tracked wallets, THE Wallet_Tracker SHALL return all Tracked_Wallet records belonging to that user, ordered by creation date descending.
2. THE Wallet_Tracker SHALL return each Tracked_Wallet with its ID, label, Wallet_Address, and timestamps.

### Requirement 4: Update a Tracked Wallet

**User Story:** As a Doji user, I want to rename a tracked wallet, so that I can organize my watchlist with meaningful labels.

#### Acceptance Criteria

1. WHEN an authenticated user submits an updated label for an existing Tracked_Wallet, THE Wallet_Tracker SHALL update the label and the updated timestamp, then return the modified record.
2. WHEN the specified Tracked_Wallet does not exist or does not belong to the requesting user, THE Wallet_Tracker SHALL reject the request with a not-found error.
3. THE Wallet_Tracker SHALL validate that the updated label is a non-empty string with a maximum length of 100 characters.

### Requirement 5: Remove a Tracked Wallet

**User Story:** As a Doji user, I want to remove a wallet from my tracking list, so that I no longer see its activity.

#### Acceptance Criteria

1. WHEN an authenticated user requests removal of a Tracked_Wallet by its ID, THE Wallet_Tracker SHALL delete the record and confirm deletion.
2. WHEN the specified Tracked_Wallet does not exist or does not belong to the requesting user, THE Wallet_Tracker SHALL reject the request with a not-found error.

### Requirement 6: Aggregate Activity Feed

**User Story:** As a Doji user, I want to see a combined feed of trades from all my tracked wallets, so that I can monitor activity in one place.

#### Acceptance Criteria

1. WHEN an authenticated user requests the activity feed, THE Wallet_Tracker SHALL fetch trades for each of the user's tracked wallets from the Data_API_Proxy.
2. THE Wallet_Tracker SHALL merge trades from all tracked wallets into a single list sorted by timestamp descending.
3. THE Wallet_Tracker SHALL enrich each trade with the Tracked_Wallet label and Gamma market metadata (title, icon, slug, event slug) using the existing tradesWithMarkets pattern.
4. THE Wallet_Tracker SHALL support pagination via limit and offset parameters, with a default limit of 100 and a maximum limit of 500.
5. IF the Data_API_Proxy returns an error for one wallet, THEN THE Wallet_Tracker SHALL continue fetching data for the remaining wallets and include a partial-failure indicator in the response.

### Requirement 7: Portfolio Value per Tracked Wallet

**User Story:** As a Doji user, I want to see the portfolio value of each tracked wallet, so that I can assess their holdings at a glance.

#### Acceptance Criteria

1. WHEN an authenticated user requests portfolio values, THE Wallet_Tracker SHALL fetch the current position value for each tracked wallet from the Data_API_Proxy value endpoint.
2. THE Wallet_Tracker SHALL return a list mapping each Tracked_Wallet ID to its current portfolio value.
3. IF the Data_API_Proxy returns an error for a specific wallet, THEN THE Wallet_Tracker SHALL return null for that wallet's value and continue processing the remaining wallets.

### Requirement 8: tRPC Router Integration

**User Story:** As a developer, I want wallet tracking exposed as a tRPC router, so that it follows the existing server architecture patterns.

#### Acceptance Criteria

1. THE Wallet_Tracker SHALL expose add, list, update, and remove operations as tRPC procedures under a dedicated `wallets` namespace in the app router.
2. THE Wallet_Tracker SHALL use protectedProcedure for all mutation and query procedures, requiring a valid JWT session.
3. THE Wallet_Tracker SHALL validate all inputs using Zod schemas consistent with the existing router patterns.
4. IF a database operation fails unexpectedly, THEN THE Wallet_Tracker SHALL return a tRPC INTERNAL_SERVER_ERROR with a generic message and log the detailed error server-side.

### Requirement 9: Frontend Server-Backed State

**User Story:** As a Doji user, I want the wallet tracker UI to use server data, so that my tracked wallets are consistent across sessions.

#### Acceptance Criteria

1. THE Wallet_Tracker frontend SHALL fetch tracked wallets from the tRPC wallets.list endpoint.
2. THE Wallet_Tracker frontend SHALL call tRPC wallets.add, wallets.update, and wallets.remove for all CRUD operations.
3. THE Wallet_Tracker frontend SHALL use TanStack Query cache invalidation to refresh the wallet list after mutations.
4. THE Wallet_Tracker frontend SHALL display loading and error states during server communication using the existing UI patterns (skeleton loaders, toast notifications).
