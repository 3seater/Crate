/**
 * Bug condition exploration test for sports live status (Property 1).
 *
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.4, 2.5**
 *
 * Bug: `resolveSportsLiveStatus()`, `isEventLive()`, and `exploreSportsRowShowsLive()`
 * incorrectly return live=true when `game_start_time` is in the past but NO Sports
 * WebSocket data exists. Absence of WS data should mean "not live", not "confirmed live".
 *
 * This test encodes the EXPECTED (correct) behavior. It MUST FAIL on unfixed code
 * to confirm the bug exists across all 4 dimensions:
 *   1a. resolveSportsLiveStatus returns { live: true } instead of null
 *   1b. isEventLive returns true instead of false
 *   1c. isEventLive returns true via slug date fallback instead of false
 *   1d. exploreSportsRowShowsLive returns true instead of false
 */
import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import {
  exploreSportsRowShowsLive,
  isEventLive,
} from "../../apps/web/src/features/explore/components/event-card-sports-utils";
import { resolveSportsLiveStatus } from "../../apps/web/src/features/trading/hooks/sports/use-sports-live";
import type { Event } from "../../apps/web/src/shared/lib/trpc/types";
import type { SportsChannel } from "../../apps/web/src/shared/lib/websocket/sports-channel";
import { sportsChannel } from "../../apps/web/src/shared/lib/websocket/sports-channel";

/**
 * Create a minimal empty SportsChannel mock where all lookups return null.
 * Used for isEventLive and exploreSportsRowShowsLive which accept a channel parameter.
 */
function createEmptyChannel(): SportsChannel {
  return {
    results: new Map(),
    hasReceivedData: true,
    getByGameId: () => null,
    getByAbbrevs: () => null,
    getByTeamNames: () => null,
    getByEventSlug: () => null,
  } as unknown as SportsChannel;
}

/**
 * Create a minimal Event fixture with a sports market that has game_start_time in the past.
 * The market must have condition_id and active=true to pass filterDiscoverableMarkets.
 */
function makeEventWithPastStartTime(gameStartTime: string): Event {
  return {
    id: "test-event-1",
    slug: "nba-cle-lal-2024-01-15",
    title: "Cavaliers vs Lakers",
    description: "",
    active: true,
    closed: false,
    archived: false,
    markets: [
      {
        question: "Who will win Cavaliers vs Lakers?",
        description: "",
        active: true,
        closed: false,
        archived: false,
        condition_id: "0xabc123",
        image: "",
        icon: "",
        game_start_time: gameStartTime,
        tokens: [
          { token_id: "t1", outcome: "Cavaliers", price: 0.5, winner: false },
          { token_id: "t2", outcome: "Lakers", price: 0.5, winner: false },
        ],
      },
    ],
  } as unknown as Event;
}

/**
 * Create an Event fixture with a slug date of today but no game_start_time.
 * Tests the slug date fallback path in isEventLive.
 */
function makeEventWithTodaySlug(): Event {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: "test-event-slug",
    slug: `nba-cle-lal-${today}`,
    title: "Cavaliers vs Lakers",
    description: "",
    active: true,
    closed: false,
    archived: false,
    markets: [
      {
        question: "Who will win Cavaliers vs Lakers?",
        description: "",
        active: true,
        closed: false,
        archived: false,
        condition_id: "0xdef456",
        image: "",
        icon: "",
        // No game_start_time — forces slug date fallback
        tokens: [
          { token_id: "t1", outcome: "Cavaliers", price: 0.5, winner: false },
          { token_id: "t2", outcome: "Lakers", price: 0.5, winner: false },
        ],
      },
    ],
  } as unknown as Event;
}

/**
 * fast-check arbitrary: generates a game_start_time ISO string between
 * 7 hours and 48 hours in the past (outside the 6-hour game duration window).
 */
const pastGameStartTimeArb = fc
  .integer({ min: 7 * 60 * 60 * 1000, max: 48 * 60 * 60 * 1000 })
  .map((msAgo) => new Date(Date.now() - msAgo).toISOString());

describe("Property 1: Bug Condition — No WS Data Falsely Returns Live", () => {
  const emptyChannel = createEmptyChannel();

  beforeEach(() => {
    // Ensure the singleton sportsChannel has no results,
    // so resolveSportsLiveStatus (which uses the singleton internally) finds nothing.
    sportsChannel.results.clear();
    // Simulate WS being active (has received data from other games) —
    // the bug condition is: WS is active but has no data for THIS game.
    sportsChannel.hasReceivedData = true;
  });

  /**
   * Property 1a: resolveSportsLiveStatus with no WS data should return null.
   *
   * When all WS lookup params are null and game_start_time is in the past,
   * the function should return null (no data) — NOT { live: true }.
   *
   * **Validates: Requirements 2.1, 2.4**
   */
  it("1a: resolveSportsLiveStatus(null, null, null, null, null, pastTime, false) returns null, not { live: true }", () => {
    fc.assert(
      fc.property(pastGameStartTimeArb, (gameStartTime) => {
        const result = resolveSportsLiveStatus(
          null,
          null,
          null,
          null,
          null,
          gameStartTime,
          false
        );

        // Expected: null (no WS data means unknown/not live)
        // Bug: returns { live: true } because of game_start_time fallback
        expect(result).toBeNull();
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property 1b: isEventLive with past game_start_time and empty channel returns false.
   *
   * When an event has game_start_time in the past but the SportsChannel has no data,
   * isEventLive should return false — NOT true.
   *
   * **Validates: Requirements 1.2, 2.1**
   */
  it("1b: isEventLive(eventWithPastStartTime, emptyChannel) returns false, not true", () => {
    fc.assert(
      fc.property(pastGameStartTimeArb, (gameStartTime) => {
        const event = makeEventWithPastStartTime(gameStartTime);
        const result = isEventLive(event, emptyChannel);

        // Expected: false (no WS confirmation means not live)
        // Bug: returns true ("No WS data to contradict — trust the date signal")
        expect(result).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property 1c: isEventLive with slug date today but no WS data returns false.
   *
   * When an event's slug contains today's date but no WS data exists,
   * isEventLive should return false — NOT true via slug date fallback.
   *
   * **Validates: Requirements 1.3, 2.5**
   */
  it("1c: isEventLive with today slug date and no WS data returns false, not true", () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const event = makeEventWithTodaySlug();
        const result = isEventLive(event, emptyChannel);

        // Expected: false (no WS data, slug date alone is not sufficient)
        // Bug: returns true via slug date fallback
        expect(result).toBe(false);
      }),
      { numRuns: 5 }
    );
  });

  /**
   * Property 1d: exploreSportsRowShowsLive with past start time and empty channel returns false.
   *
   * This function compounds both isEventLive and resolveSportsLiveStatus.
   * With no WS data, it should return false.
   *
   * **Validates: Requirements 2.1, 2.4, 2.5**
   */
  it("1d: exploreSportsRowShowsLive(eventWithPastStartTime, emptyChannel) returns false", () => {
    fc.assert(
      fc.property(pastGameStartTimeArb, (gameStartTime) => {
        const event = makeEventWithPastStartTime(gameStartTime);
        const result = exploreSportsRowShowsLive(event, emptyChannel);

        // Expected: false (no WS confirmation means not live)
        // Bug: returns true because isEventLive or resolveSportsLiveStatus returns live
        expect(result).toBe(false);
      }),
      { numRuns: 10 }
    );
  });
});
