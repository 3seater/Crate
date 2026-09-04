# Bugfix Requirements Document

## Introduction

The orderbook scroll pinning has three related bugs that cause the spread bar to lose its pinned position. The orderbook should always keep the lowest ask and highest bid pinned to the spread bar (midpoint), unless the user has intentionally scrolled away. Three defects break this contract: (1) returning from a browser tab switch leaves the orderbook unpinned, (2) `applySpreadScrollSync` short-circuits both sides when only one side is scrolled away, and (3) incremental WebSocket updates cause the best ask to drift away from the spread even when the user hasn't scrolled.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN the user switches to another browser tab and returns THEN the orderbook scroll position is not restored to the spread, leaving asks and/or bids unpinned from the spread bar

1.2 WHEN the user has scrolled away on one side only (e.g. asks) and `applySpreadScrollSync` is called THEN the function short-circuits with an early return, preventing the other side (e.g. bids) from being pinned even though that side's `userHasScrolled` flag is false

1.3 WHEN the user is at the spread position (has not scrolled away) and new price levels arrive via WebSocket `price_change` events THEN the asks panel's `scrollHeight` grows without `scrollTop` adjustment, causing the best ask to drift away from the spread bar

### Expected Behavior (Correct)

2.1 WHEN the user switches to another browser tab and returns THEN the system SHALL detect the visibility change and re-pin both asks and bids to the spread bar (respecting each side's independent `userHasScrolled` flag)

2.2 WHEN the user has scrolled away on one side only (e.g. asks) and scroll sync is triggered THEN the system SHALL independently evaluate each side, pinning the non-scrolled side (e.g. bids) to the spread while leaving the scrolled side (e.g. asks) at the user's chosen position

2.3 WHEN the user is at the spread position and new price levels arrive via WebSocket `price_change` events THEN the system SHALL adjust the asks panel `scrollTop` to keep the best ask pinned at the bottom of the asks container, maintaining spread alignment

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the user has intentionally scrolled away from the spread on a given side THEN the system SHALL CONTINUE TO respect that choice and not auto-scroll them back on that side

3.2 WHEN the user scrolls back to the bottom of asks or top of bids THEN the system SHALL CONTINUE TO re-enable auto-pinning for that side by resetting the `userHasScrolled` flag

3.3 WHEN the user switches markets or tokens THEN the system SHALL CONTINUE TO reset scroll flags and re-pin the orderbook to the spread for the new market

3.4 WHEN programmatic scrolling occurs (via `isProgrammaticScrollRef`) THEN the system SHALL CONTINUE TO suppress scroll event handlers so they do not falsely mark the user as having scrolled away

3.5 WHEN the orderbook transitions from empty to populated (initial load) THEN the system SHALL CONTINUE TO pin both sides to the spread via the existing `useLayoutEffect` + `requestAnimationFrame` pattern

3.6 WHEN the spread bar labels update THEN the system SHALL CONTINUE TO debounce midpoint/spread display values to avoid label flicker
