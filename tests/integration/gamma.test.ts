/**
 * Comprehensive integration tests for Gamma API
 * Validates implementation against OpenAPI specification
 *
 * Skipped in CI: calls live Polymarket APIs (rate limits, network required).
 */

import { describe, expect, it } from "vitest";
import {
  getActiveEvents,
  getActiveMarkets,
  getClosedEvents,
  getClosedMarkets,
  getComments,
  getCommentsByUserAddress,
  getEventById,
  getEventBySlug,
  getEvents,
  getEventsPaginated,
  getFeaturedEvents,
  getMarketById,
  getMarketBySlug,
  getMarkets,
  getPublicProfile,
  getRelatedTagsById,
  getSeries,
  getSeriesById,
  getSportsMarketTypes,
  getSportsMetadata,
  getStatus,
  getTagById,
  getTags,
  getTagsRelatedToTagById,
  getTeams,
  publicSearch,
} from "../../apps/server/src/lib/polymarket/gamma";
import {
  EventSchema,
  MarketSchema,
  TagSchema,
} from "../../apps/server/src/lib/polymarket/schemas/gamma";
import { hasServerEnv } from "../helpers";

describe.skipIf(!hasServerEnv)("Gamma API", () => {
  describe("Basic Functionality", () => {
    it("fetches API status", async () => {
      const status = await getStatus();
      expect(status).toBe("OK");
    });

    it("fetches markets list", async () => {
      const markets = await getMarkets({ limit: 5 });
      expect(Array.isArray(markets)).toBe(true);
      expect(markets.length).toBeGreaterThan(0);
      expect(markets[0]).toHaveProperty("id");
      expect(markets[0]).toHaveProperty("question");
      expect(markets[0]).toHaveProperty("slug");
    });

    it("fetches single market by slug", async () => {
      const markets = await getMarkets({ limit: 1 });
      const slug = markets[0]?.slug;
      expect(slug).toBeDefined();
      if (!slug) {
        return;
      }

      const market = await getMarketBySlug(slug);
      expect(market.slug).toBe(slug);
      expect(market).toHaveProperty("id");
      expect(market).toHaveProperty("question");
    });

    it("fetches events list", async () => {
      const events = await getEvents({ limit: 5 });
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBeGreaterThan(0);
      expect(events[0]).toHaveProperty("id");
      expect(events[0]).toHaveProperty("slug");
      expect(events[0]).toHaveProperty("title");
    });

    it("fetches single event by slug", async () => {
      const events = await getEvents({ limit: 1 });
      const slug = events[0]?.slug;
      expect(slug).toBeDefined();
      if (!slug) {
        return;
      }

      const event = await getEventBySlug(slug);
      expect(event.slug).toBe(slug);
      expect(event).toHaveProperty("id");
      expect(event).toHaveProperty("title");
    });

    it("fetches tags", async () => {
      const tags = await getTags({ limit: 10 });
      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThan(0);
      expect(tags[0]).toHaveProperty("id");
      expect(tags[0]).toHaveProperty("label");
    });

    it("searches across entities", async () => {
      const results = await publicSearch({ q: "trump", limit_per_type: 5 });
      expect(results).toHaveProperty("events");
      expect(results).toHaveProperty("pagination");
    });
  });

  describe("Schema Validation", () => {
    it("validates market response schema", async () => {
      const markets = await getMarkets({ limit: 1 });
      const result = MarketSchema.safeParse(markets[0]);

      expect(result.success).toBe(true);
      if (!result.success) {
        console.error("Market schema validation errors:", result.error.issues);
      }
    });

    it("parses JSON string fields in market data", async () => {
      const markets = await getMarkets({ limit: 1 });
      const market = markets[0];

      // API returns these as JSON strings, schema should parse them to arrays
      expect(Array.isArray(market?.outcomes)).toBe(true);
      expect(Array.isArray(market?.outcomePrices)).toBe(true);
      expect(Array.isArray(market?.clobTokenIds)).toBe(true);
    });

    it("validates event response schema", async () => {
      const events = await getEvents({ limit: 1 });
      const result = EventSchema.safeParse(events[0]);

      expect(result.success).toBe(true);
      if (!result.success) {
        console.error("Event schema validation errors:", result.error.issues);
      }
    });

    it("parses JSON string fields in nested market data", async () => {
      const events = await getEvents({ limit: 1 });
      const event = events[0];

      if (event?.markets && event.markets.length > 0) {
        const market = event.markets[0];
        // Nested markets should also have parsed arrays
        expect(Array.isArray(market?.outcomes)).toBe(true);
        expect(Array.isArray(market?.outcomePrices)).toBe(true);
        expect(Array.isArray(market?.clobTokenIds)).toBe(true);
      }
    });

    it("validates tag response schema", async () => {
      const tags = await getTags({ limit: 1 });
      const result = TagSchema.safeParse(tags[0]);

      expect(result.success).toBe(true);
      if (!result.success) {
        console.error("Tag schema validation errors:", result.error.issues);
      }
    });

    it("handles negative risk fields on events", async () => {
      const events = await getEvents({ limit: 10 });

      // Schema should handle these fields whether they're present or not
      for (const event of events) {
        // Fields should be defined (even if false/null)
        expect(event).toHaveProperty("enableNegRisk");
        expect(event).toHaveProperty("negRiskAugmented");

        // If enableNegRisk is true, check augmented field
        if (event.enableNegRisk) {
          expect(typeof event.negRiskAugmented).toBe("boolean");
        }
      }
    });

    it("validates market has required fields per OpenAPI spec", async () => {
      const markets = await getMarkets({ limit: 1 });
      const market = markets[0];

      expect(market).toHaveProperty("id");
      expect(market).toHaveProperty("question");
      expect(market).toHaveProperty("slug");
      expect(market).toHaveProperty("active");
      expect(market).toHaveProperty("closed");
      expect(market).toHaveProperty("archived");
    });

    it("validates event has required fields per OpenAPI spec", async () => {
      const events = await getEvents({ limit: 1 });
      const event = events[0];

      expect(event).toHaveProperty("id");
      expect(event).toHaveProperty("slug");
      expect(event).toHaveProperty("title");
      expect(event).toHaveProperty("active");
      expect(event).toHaveProperty("closed");
      expect(event).toHaveProperty("archived");
    });
  });

  describe("Endpoint Coverage", () => {
    it("GET /markets with pagination", async () => {
      const page1 = await getMarkets({ limit: 2, offset: 0 });
      const page2 = await getMarkets({ limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      expect(page1[0]?.id).not.toBe(page2[0]?.id);
    });

    it("GET /markets with filters", async () => {
      // Gamma GET /markets supports closed (not active); closed:false yields active markets
      const active = await getMarkets({ closed: false, limit: 5 });
      expect(active.every((m) => m.active)).toBe(true);
    });

    it("GET /events with pagination", async () => {
      const page1 = await getEvents({ limit: 2, offset: 0 });
      const page2 = await getEvents({ limit: 2, offset: 2 });

      expect(page1.length).toBe(2);
      expect(page2.length).toBe(2);
      expect(page1[0]?.id).not.toBe(page2[0]?.id);
    });

    it("GET /events/pagination with metadata", async () => {
      const result = await getEventsPaginated({ limit: 5, offset: 0 });

      expect(result).toHaveProperty("data");
      expect(result).toHaveProperty("pagination");
      expect(Array.isArray(result.data)).toBe(true);
      expect(typeof result.pagination.hasMore).toBe("boolean");
      expect(typeof result.pagination.totalResults).toBe("number");
    });

    it("GET /comments - SPEC BUG: requires parent_entity_type and parent_entity_id", async () => {
      const events = await getEvents({ limit: 1 });
      const firstEvent = events[0];
      if (!firstEvent) {
        return;
      }
      const eventId = Number(firstEvent.id);

      const comments = await getComments({
        parent_entity_type: "Event",
        parent_entity_id: eventId,
        limit: 10,
      });
      expect(Array.isArray(comments)).toBe(true);
    });

    it("GET /comments - SPEC BUG: parent_entity_type 'market' is invalid", async () => {
      const events = await getEvents({ limit: 1 });
      const firstEvent = events[0];
      if (!firstEvent) {
        return;
      }

      await expect(
        getComments({
          parent_entity_type: "market",
          parent_entity_id: Number(firstEvent.id),
          limit: 10,
        })
      ).rejects.toThrow();
    });
  });

  describe("Sports API", () => {
    it("fetches teams list", async () => {
      const teams = await getTeams({ limit: 5 });
      expect(Array.isArray(teams)).toBe(true);
    });

    it("fetches teams with league filter", async () => {
      const teams = await getTeams({
        limit: 3,
        league: ["NFL"],
      });
      expect(Array.isArray(teams)).toBe(true);
    });

    it("fetches sports metadata", async () => {
      const metadata = await getSportsMetadata();
      expect(Array.isArray(metadata)).toBe(true);
    });

    it("fetches sports market types", async () => {
      const types = await getSportsMarketTypes();
      expect(types).toBeDefined();
    });
  });

  describe("Series API", () => {
    it("fetches series list", async () => {
      const series = await getSeries({ limit: 5 });
      expect(Array.isArray(series)).toBe(true);
      if (series.length > 0) {
        expect(series[0]).toHaveProperty("id");
        expect(series[0]).toHaveProperty("title");
        expect(series[0]).toHaveProperty("slug");
      }
    });

    it("fetches series by ID", async () => {
      const seriesList = await getSeries({ limit: 1 });
      const first = seriesList[0];
      if (first) {
        const seriesId = Number(first.id);
        const series = await getSeriesById(seriesId);
        expect(series).toBeDefined();
        expect(Number(series?.id)).toBe(seriesId);
      }
    });

    it("throws error for invalid series ID", async () => {
      await expect(getSeriesById(999_999_999)).rejects.toThrow();
    });
  });

  describe("Related Tags", () => {
    it("fetches related tags by tag ID", async () => {
      const tags = await getRelatedTagsById(1);
      expect(Array.isArray(tags)).toBe(true);
    });

    it("fetches tags related to tag by ID", async () => {
      const tags = await getTagsRelatedToTagById(1);
      expect(Array.isArray(tags)).toBe(true);
    });
  });

  describe("Comments by User", () => {
    it("fetches comments by user address", async () => {
      const comments = await getCommentsByUserAddress(
        "0x0000000000000000000000000000000000000000",
        { limit: 5 }
      );
      expect(Array.isArray(comments)).toBe(true);
    });
  });

  describe("Public Profiles", () => {
    it("handles public profile request", async () => {
      try {
        const profile = await getPublicProfile(
          "0x0000000000000000000000000000000000000000"
        );
        if (profile) {
          expect(profile).toHaveProperty("address");
        }
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("Active/Closed Filtering", () => {
    it("fetches active events using convenience function", async () => {
      const events = await getActiveEvents({ limit: 3 });
      expect(Array.isArray(events)).toBe(true);
      for (const event of events) {
        expect(event.active).toBe(true);
      }
    });

    it("fetches closed events using convenience function", async () => {
      const events = await getClosedEvents({ limit: 3 });
      expect(Array.isArray(events)).toBe(true);
      for (const event of events) {
        expect(event.closed).toBe(true);
      }
    });

    it("fetches featured events using convenience function", async () => {
      const events = await getFeaturedEvents({ limit: 3 });
      expect(Array.isArray(events)).toBe(true);
    });

    it("fetches active markets using convenience function", async () => {
      const markets = await getActiveMarkets({ limit: 3 });
      expect(Array.isArray(markets)).toBe(true);
      for (const market of markets) {
        expect(market.active).toBe(true);
      }
    });

    it("fetches closed markets using convenience function", async () => {
      const markets = await getClosedMarkets({ limit: 3 });
      expect(Array.isArray(markets)).toBe(true);
      for (const market of markets) {
        expect(market.closed).toBe(true);
      }
    });
  });

  describe("Error Handling", () => {
    it("throws error for non-existent event ID", async () => {
      await expect(getEventById(999_999_999)).rejects.toThrow();
    });

    it("throws error for non-existent market ID", async () => {
      await expect(getMarketById(999_999_999)).rejects.toThrow();
    });

    it("throws error for non-existent tag ID", async () => {
      await expect(getTagById(999_999_999)).rejects.toThrow();
    });

    it("throws error for non-existent series ID", async () => {
      await expect(getSeriesById(999_999_999)).rejects.toThrow();
    });
  });

  describe("Query Parameter Edge Cases", () => {
    it("handles negative limit gracefully", async () => {
      const events = await getEvents({ limit: -1 });
      expect(Array.isArray(events)).toBe(true);
    });

    it("handles zero limit gracefully", async () => {
      const markets = await getMarkets({ limit: 0 });
      expect(Array.isArray(markets)).toBe(true);
    });

    it("handles very large limit", async () => {
      const tags = await getTags({ limit: 10_000 });
      expect(Array.isArray(tags)).toBe(true);
    });

    it("handles negative offset gracefully", async () => {
      const events = await getEvents({ offset: -1 });
      expect(Array.isArray(events)).toBe(true);
    });

    it("handles array parameters", async () => {
      const teams = await getTeams({
        league: ["NFL"],
        limit: 5,
      });
      expect(Array.isArray(teams)).toBe(true);
    });

    it("handles boolean parameters", async () => {
      const events = await getEvents({
        active: true,
        featured: false,
        limit: 3,
      });
      expect(Array.isArray(events)).toBe(true);
    });

    it("handles undefined parameters", async () => {
      const markets = await getMarkets({
        limit: 3,
        active: undefined,
        closed: undefined,
      });
      expect(Array.isArray(markets)).toBe(true);
    });

    it("handles offset beyond available results", async () => {
      const events = await getEvents({
        limit: 10,
        offset: 999_999,
      });
      expect(Array.isArray(events)).toBe(true);
      expect(events.length).toBe(0);
    });

    it("handles pagination with filters", async () => {
      const markets = await getMarkets({
        active: true,
        limit: 5,
        offset: 10,
      });
      expect(Array.isArray(markets)).toBe(true);
    });

    it("handles conflicting filters gracefully", async () => {
      const events = await getEvents({
        active: true,
        closed: true,
        limit: 5,
      });
      expect(Array.isArray(events)).toBe(true);
    });

    it("handles multiple filter combinations", async () => {
      const markets = await getMarkets({
        closed: false,
        limit: 5,
      });
      expect(Array.isArray(markets)).toBe(true);
    });
  });
});
