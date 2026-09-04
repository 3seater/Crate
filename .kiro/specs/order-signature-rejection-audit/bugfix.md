# Bugfix Requirements Document

## Introduction

Users receive "Order signature was rejected" errors when placing buy or sell orders through the Instant Trade popup. The quick-sell modal and the standard order form both work correctly. The root cause is that the Instant Trade popup omits the `hasCredentialsStored` parameter when calling `useClobClient`, causing the hook to default to `true` and skip credential persistence for users whose credentials are stale or not yet stored. A secondary inconsistency in the `enabled` condition further narrows the window in which the client initializes.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user places a buy or sell order via the Instant Trade popup AND their CLOB credentials are not yet persisted in the wallet store THEN the system sends an order signed with stale or missing credentials, resulting in a "Order signature was rejected" TRPCClientError.

1.2 WHEN a user opens the Instant Trade popup AND has a valid `safeAddress` but `magic` is momentarily null (e.g. during provider initialization) THEN the CLOB client is not created because the `enabled` condition requires both `magic` AND `safeAddress`, unlike the other trading surfaces which only require `safeAddress`.

### Expected Behavior (Correct)

2.1 WHEN a user places a buy or sell order via the Instant Trade popup AND their CLOB credentials are not yet persisted THEN the system SHALL derive fresh credentials, persist them via `storeCredentials`, and sign the order with valid credentials so the CLOB API accepts it.

2.2 WHEN a user opens the Instant Trade popup AND has a valid `safeAddress` THEN the CLOB client SHALL initialize using `enabled: Boolean(safeAddress)`, consistent with the quick-sell modal and order form, so that the client is ready as soon as the Safe address is available.

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user places a buy or sell order via the quick-sell modal THEN the system SHALL CONTINUE TO pass `hasCredentialsStored` from the wallet store and sign orders with valid credentials.

3.2 WHEN a user places a buy or sell order via the standard order form THEN the system SHALL CONTINUE TO pass `hasCredentialsStored` from the wallet store and sign orders with valid credentials.

3.3 WHEN a user has valid persisted credentials and uses any trading surface (Instant Trade, quick-sell, or order form) THEN the system SHALL CONTINUE TO reuse the existing credentials without re-deriving them.

3.4 WHEN `safeAddress` is null or undefined on any trading surface THEN the system SHALL CONTINUE TO disable the CLOB client and not attempt order placement.
