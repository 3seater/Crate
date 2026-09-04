/**
 * Fixture helpers: factory, ids, auth.
 */
import { describe, expect, it } from "vitest";

const HEX40 = /^0x[0-9a-fA-F]{40}$/;
const HEX64 = /^0x[0-9a-f]{64}$/;
const SLUG = /^market-[a-z0-9-]+$/;

import {
  createAddress,
  createAuthSession,
  createAuthUser,
  createConditionId,
  createFixture,
  createFixtureList,
  createMarketSlug,
  createOrderId,
  createTokenId,
} from "../fixtures";

describe("createFixture", () => {
  it("returns defaults when no overrides", () => {
    const def = { a: 1, b: "x" };
    expect(createFixture(def)).toEqual({ a: 1, b: "x" });
  });

  it("merges overrides onto defaults", () => {
    const def = { a: 1, b: "x" };
    expect(createFixture(def, { b: "y" })).toEqual({ a: 1, b: "y" });
  });
});

describe("createFixtureList", () => {
  it("returns count items with overrideFn", () => {
    const list = createFixtureList(3, { id: 0 }, (i) => ({ id: i }));
    expect(list).toHaveLength(3);
    expect(list.map((x) => x.id)).toEqual([0, 1, 2]);
  });
});

describe("ids", () => {
  it("createAddress returns 0x + 40 hex chars", () => {
    const a = createAddress(1);
    expect(a).toMatch(HEX40);
  });

  it("createTokenId is deterministic", () => {
    expect(createTokenId(1)).toBe("tok_000001");
  });

  it("createConditionId is 0x + 64 hex chars", () => {
    const c = createConditionId(1);
    expect(c).toMatch(HEX64);
  });

  it("createMarketSlug is slug-like", () => {
    expect(createMarketSlug(1)).toMatch(SLUG);
  });

  it("createOrderId is deterministic", () => {
    expect(createOrderId(1)).toBe("order_000001");
  });
});

describe("auth fixtures", () => {
  it("createAuthUser returns user-shaped object", () => {
    const u = createAuthUser();
    expect(u).toHaveProperty("id");
    expect(u).toHaveProperty("email", "test@example.com");
    expect(u.walletAddress).toMatch(HEX40);
    expect(typeof u.hasCredentials).toBe("boolean");
  });

  it("createAuthUser accepts overrides", () => {
    const u = createAuthUser({ email: "custom@test.com" });
    expect(u.email).toBe("custom@test.com");
  });

  it("createAuthSession returns session-shaped object", () => {
    const s = createAuthSession();
    expect(s).toHaveProperty("userId");
    expect(s).toHaveProperty("issuer");
  });
});
