/**
 * Integration tests for Data API
 * Validates implementation against OpenAPI specification
 *
 * Skipped in CI: calls live Polymarket APIs (rate limits, network required).
 */

import { describe, expect, it } from "vitest";
import {
  getActivity,
  getDataApiHealth,
  getLeaderboard,
  getLiveVolume,
  getOpenInterest,
  getPositions,
  getTraded,
  getTrades,
} from "../../apps/server/src/lib/polymarket/data";
import { hasServerEnv } from "../helpers";

// Use a real active address for meaningful tests
// This is a public address from the leaderboard
const getTestAddress = async (): Promise<string> => {
  const leaderboard = await getLeaderboard({ limit: 1 });
  return (
    leaderboard[0]?.proxyWallet || "0x0000000000000000000000000000000000000000"
  );
};

describe.skipIf(!hasServerEnv)("Data API", () => {
  describe("Health Check", () => {
    it("returns OK status", async () => {
      const health = await getDataApiHealth();
      expect(health.data).toBe("OK");
    });
  });

  describe("User Data", () => {
    it("fetches markets traded count with valid structure", async () => {
      const testAddress = await getTestAddress();
      const traded = await getTraded(testAddress);

      expect(traded).toHaveProperty("user");
      expect(traded).toHaveProperty("traded");
      expect(typeof traded.traded).toBe("number");
      expect(traded.user).toBe(testAddress);
    });

    it("fetches positions with required fields per OpenAPI spec", async () => {
      const testAddress = await getTestAddress();
      const positions = await getPositions({
        user: testAddress,
        limit: 5,
      });

      expect(Array.isArray(positions)).toBe(true);
      if (positions.length > 0) {
        const pos = positions[0];
        // Validate required fields from OpenAPI spec
        expect(pos).toHaveProperty("proxyWallet");
        expect(pos).toHaveProperty("asset");
        expect(pos).toHaveProperty("conditionId");
        expect(pos).toHaveProperty("size");
        expect(typeof pos.size).toBe("number");
      }
    });

    it("respects position filters and sorting", async () => {
      const testAddress = await getTestAddress();
      const positions = await getPositions({
        user: testAddress,
        limit: 10,
        sortBy: "TOKENS",
        sortDirection: "DESC",
      });

      // If we have multiple positions, verify sorting
      if (positions.length > 1) {
        const sizes = positions.map((p) => p.size);
        const sorted = [...sizes].sort((a, b) => b - a);
        expect(sizes).toEqual(sorted);
      }
    });
  });

  describe("Trading Data", () => {
    it("fetches trades with complete structure", async () => {
      const trades = await getTrades({ limit: 5 });

      expect(Array.isArray(trades)).toBe(true);
      expect(trades.length).toBeGreaterThan(0);

      const trade = trades[0];
      expect(trade).toHaveProperty("side");
      expect(["BUY", "SELL"]).toContain(trade.side);
      expect(trade).toHaveProperty("size");
      expect(trade).toHaveProperty("price");
      expect(typeof trade.size).toBe("number");
      expect(typeof trade.price).toBe("number");
    });

    it("filters trades by side", async () => {
      const buyTrades = await getTrades({
        limit: 10,
        side: "BUY",
      });

      if (buyTrades.length > 0) {
        for (const trade of buyTrades) {
          expect(trade.side).toBe("BUY");
        }
      }
    });

    it("fetches activity with type validation", async () => {
      const testAddress = await getTestAddress();
      const activity = await getActivity({
        user: testAddress,
        limit: 10,
      });

      expect(Array.isArray(activity)).toBe(true);
      if (activity.length > 0) {
        const act = activity[0];
        expect(act).toHaveProperty("type");
        expect([
          "TRADE",
          "SPLIT",
          "MERGE",
          "REDEEM",
          "REWARD",
          "CONVERSION",
          "MAKER_REBATE",
        ]).toContain(act.type);
      }
    });
  });

  describe("Market Data", () => {
    it("fetches open interest with valid structure", async () => {
      const oi = await getOpenInterest();

      expect(Array.isArray(oi)).toBe(true);
      if (oi.length > 0) {
        expect(oi[0]).toHaveProperty("market");
        expect(oi[0]).toHaveProperty("value");
        expect(typeof oi[0].value).toBe("number");
      }
    });

    it("fetches live volume with market breakdown", async () => {
      const volume = await getLiveVolume(1);

      expect(Array.isArray(volume)).toBe(true);
      if (volume.length > 0) {
        expect(volume[0]).toHaveProperty("total");
        expect(volume[0]).toHaveProperty("markets");
        expect(Array.isArray(volume[0].markets)).toBe(true);
      }
    });
  });

  describe("Leaderboards", () => {
    it("fetches trader leaderboard with rankings", async () => {
      const leaderboard = await getLeaderboard({
        category: "OVERALL",
        timePeriod: "DAY",
        limit: 10,
      });

      expect(Array.isArray(leaderboard)).toBe(true);
      expect(leaderboard.length).toBeGreaterThan(0);

      const entry = leaderboard[0];
      expect(entry).toHaveProperty("rank");
      expect(entry).toHaveProperty("proxyWallet");
      expect(entry).toHaveProperty("vol");
      expect(entry).toHaveProperty("pnl");
      expect(typeof entry.vol).toBe("number");
      expect(typeof entry.pnl).toBe("number");
    });

    it("respects leaderboard category filter", async () => {
      const politics = await getLeaderboard({
        category: "POLITICS",
        timePeriod: "DAY",
        limit: 5,
      });

      expect(Array.isArray(politics)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("rejects invalid address format", async () => {
      await expect(getTraded("invalid-address")).rejects.toThrow();
    });

    it("handles non-existent event ID gracefully", async () => {
      const volume = await getLiveVolume(999_999_999);
      expect(Array.isArray(volume)).toBe(true);
      // Returns array with zero volume, not empty array
      if (volume.length > 0) {
        expect(volume[0].total).toBe(0);
      }
    });
  });
});
