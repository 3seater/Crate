/**
 * Preservation property tests for sports live status (Property 2).
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.6**
 *
 * These tests verify that existing correct behavior is preserved BEFORE
 * implementing the bugfix. All tests MUST PASS on unfixed code to establish
 * the baseline behavior that must not regress.
 *
 * Properties:
 *   2a. WS Live Preservation — WS live:true + ended:false → resolveSportsLiveStatus returns { live: true }
 *   2b. WS Ended Preservation — WS ended:true → resolveSportsLiveStatus returns { live: false }
 *   2c. Closed Market Preservation — market.closed:true → isEventLive returns false
 *   2d. UMA Resolved Preservation — umaResolutionStatus proposed/resolved → isEventLive returns false
 *   2e. WS gameId Match Preservation — WS gameId match with live:true + ended:false → isEventLive returns true
 */
import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import {
  isEventLive,
  isMarketResolved,
} from "../../apps/web/src/features/explore/components/event-card-sports-utils";
import { resolveSportsLiveStatus } from "../../apps/web/src/features/trading/hooks/sports/use-sports-live";
import type { Event } from "../../apps/web/src/shared/lib/trpc/types";
import type { SportsChannel } from "../../apps/web/src/shared/lib/websocket/sports-channel";
import { sportsChannel } from "../../apps/web/src/shared/lib/websocket/sports-channel";
import type { SportResult } from "../../apps/web/src/shared/lib/websocket/sports-schemas";

// ── Generators ────────────────────────────────────────────────────────────────

/** Generate a random score string like "3-1", "0-0", "21-17". */
const scoreArb = fc
  .tuple(fc.integer({ min: 0, max: 50 }), fc.integer({ min: 0, max: 50 }))
  .map(([a, b]) => `${a}-${b}`);

/** Generate a random period string. */
const periodArb = fc.oneof(
  fc.constant("1st Half"),
  fc.constant("2nd Half"),
  fc.constant("Q1"),
  fc.constant("Q2"),
  fc.constant("Q3"),
  fc.constant("Q4"),
  fc.constant("OT"),
  fc.constant("1st Period"),
  fc.constant("2nd Period"),
  fc.constant("3rd Period")
);

/** Generate a random elapsed string like "45:00", "12:34". */
const elapsedArb = fc
  .tuple(fc.integer({ min: 0, max: 90 }), fc.integer({ min: 0, max: 59 }))
  .map(([m, s]) => `${m}:${String(s).padStart(2, "0")}`);

/** Generate a positive gameId. */
const gameIdArb = fc.integer({ min: 1, max: 999_999 });

/** Generate a SportResult with live:true and ended:false (confirmed live). */
const liveSportResultArb = fc
  .record({
    slug: fc.constant("nba-cle-lal-2025-01-26"),
    live: fc.constant(true as const),
    ended: fc.constant(false),
    score: scoreArb,
    period: periodArb,
    elapsed: elapsedArb,
    gameId: gameIdArb,
  })
  .map((r) => r as SportResult);

/** Generate a SportResult with ended:true (game over). */
const endedSportResultArb = fc
  .record({
    slug: fc.constant("nba-cle-lal-2025-01-26"),
    live: fc.oneof(fc.constant(true), fc.constant(false)),
    ended: fc.constant(true),
    score: scoreArb,
    period: fc.constant("Final"),
    elapsed: fc.constant(""),
    gameId: gameIdArb,
  })
  .map((r) => r as SportResult);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Create a mock SportsChannel with a populated results map.
 * Used for isEventLive tests (2c, 2d, 2e) which accept a channel parameter.
 */
function createChannel(entries: [string, SportResult][]): SportsChannel {
  const results = new Map<string, SportResult>(entries);
  return {
    results,
    hasReceivedData: true,
    getByGameId(gameId: number): SportResult | null {
      for (const result of results.values()) {
        if (result.gameId === gameId) {
          return result;
        }
      }
      return null;
    },
    getByAbbrevs(): SportResult | null {
      return null;
    },
    getByTeamNames(): SportResult | null {
      return null;
    },
    getByEventSlug(): SportResult | null {
      return null;
    },
  } as unknown as SportsChannel;
}

/** Create an empty channel where all lookups return null. */
function createEmptyChannel(): SportsChannel {
  return createChannel([]);
}

/**
 * Create a minimal Event fixture with a sports market.
 * The market has condition_id and active=true to pass filterDiscoverableMarkets.
 */
function makeEvent(overrides: {
  gameStartTime?: string;
  closed?: boolean;
  umaResolutionStatus?: string;
  gameId?: number;
}): Event {
  const pastTime = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  return {
    id: "test-event-preservation",
    slug: "nba-cle-lal-2025-01-26",
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
        closed: overrides.closed ?? false,
        archived: false,
        condition_id: "0xabc123",
        image: "",
        icon: "",
        game_start_time: overrides.gameStartTime ?? pastTime,
        gameId: overrides.gameId,
        umaResolutionStatus: overrides.umaResolutionStatus,
        tokens: [
          { token_id: "t1", outcome: "Cavaliers", price: 0.5, winner: false },
          { token_id: "t2", outcome: "Lakers", price: 0.5, winner: false },
        ],
      },
    ],
  } as unknown as Event;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Property 2: Preservation — WS-Confirmed Live and Non-Live Games Unchanged", () => {
  beforeEach(() => {
    sportsChannel.results.clear();
    sportsChannel.hasReceivedData = true;
  });

  /**
   * Property 2a — WS Live Preservation
   *
   * For events where WS has live:true AND ended:false,
   * resolveSportsLiveStatus() returns { live: true } with score/period/elapsed from WS.
   *
   * **Validates: Requirements 3.1, 3.6**
   */
  it("2a: resolveSportsLiveStatus returns { live: true } with WS data when WS has live:true + ended:false", () => {
    fc.assert(
      fc.property(liveSportResultArb, (sportResult) => {
        // Populate the singleton with the sport result keyed by slug
        sportsChannel.results.clear();
        sportsChannel.results.set(sportResult.slug, sportResult);

        // Call resolveSportsLiveStatus with a matching gameId
        const result = resolveSportsLiveStatus(
          null, // abbrevA
          null, // abbrevB
          null, // nameA
          null, // nameB
          sportResult.gameId ?? null, // gameId — direct match
          new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // pastGameStartTime
          false // marketClosed
        );

        expect(result).not.toBeNull();
        expect(result?.live).toBe(true);
        expect(result?.score).toBe(sportResult.score);
        expect(result?.period).toBe(sportResult.period);
        expect(result?.elapsed).toBe(sportResult.elapsed);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property 2b — WS Ended Preservation
   *
   * For events where WS has ended:true, resolveSportsLiveStatus() returns { live: false }.
   *
   * **Validates: Requirements 3.2**
   */
  it("2b: resolveSportsLiveStatus returns { live: false } when WS has ended:true", () => {
    fc.assert(
      fc.property(endedSportResultArb, (sportResult) => {
        // Populate the singleton with the ended sport result
        sportsChannel.results.clear();
        sportsChannel.results.set(sportResult.slug, sportResult);

        // Call resolveSportsLiveStatus with a matching gameId
        const result = resolveSportsLiveStatus(
          null,
          null,
          null,
          null,
          sportResult.gameId ?? null,
          new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          false
        );

        expect(result).not.toBeNull();
        expect(result?.live).toBe(false);
      }),
      { numRuns: 10 }
    );
  });

  /**
   * Property 2c — Closed Market Preservation
   *
   * For events where market.closed === true, isEventLive() returns false
   * regardless of WS data or game_start_time.
   *
   * **Validates: Requirements 3.3**
   */
  it("2c: isEventLive returns false when all markets are closed", () => {
    fc.assert(
      fc.property(
        liveSportResultArb,
        fc.integer({ min: 1, max: 48 }),
        (sportResult, hoursAgo) => {
          const pastTime = new Date(
            Date.now() - hoursAgo * 60 * 60 * 1000
          ).toISOString();

          // Create event with closed market
          const event = makeEvent({
            gameStartTime: pastTime,
            closed: true,
            gameId: sportResult.gameId,
          });

          // Even with WS data showing live, closed market should return false
          const channel = createChannel([[sportResult.slug, sportResult]]);

          const result = isEventLive(event, channel);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 2d — UMA Resolved Preservation
   *
   * For events where market has umaResolutionStatus "proposed" or "resolved",
   * isEventLive() returns false.
   *
   * **Validates: Requirements 3.4**
   */
  it("2d: isEventLive returns false when market has umaResolutionStatus proposed or resolved", () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant("proposed"), fc.constant("resolved")),
        fc.integer({ min: 1, max: 48 }),
        (umaStatus, hoursAgo) => {
          const pastTime = new Date(
            Date.now() - hoursAgo * 60 * 60 * 1000
          ).toISOString();

          // Create event with UMA-resolved market
          const event = makeEvent({
            gameStartTime: pastTime,
            umaResolutionStatus: umaStatus,
          });

          // isMarketResolved should return true for these statuses
          const market = (event.markets ?? [])[0];
          expect(isMarketResolved(market)).toBe(true);

          // isEventLive should return false for resolved markets
          const channel = createEmptyChannel();
          const result = isEventLive(event, channel);
          expect(result).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 2e — WS gameId Match Preservation
   *
   * For events matched by gameId with live:true + ended:false,
   * isEventLive() returns true.
   *
   * **Validates: Requirements 3.1, 3.6**
   */
  it("2e: isEventLive returns true when WS gameId match has live:true + ended:false", () => {
    fc.assert(
      fc.property(liveSportResultArb, (sportResult) => {
        const pastTime = new Date(
          Date.now() - 2 * 60 * 60 * 1000
        ).toISOString();

        // Create event with a gameId that matches the WS data
        const event = makeEvent({
          gameStartTime: pastTime,
          gameId: sportResult.gameId,
        });

        // Create channel with the live sport result accessible by gameId
        const channel = createChannel([[sportResult.slug, sportResult]]);

        const result = isEventLive(event, channel);
        expect(result).toBe(true);
      }),
      { numRuns: 10 }
    );
  });
});
