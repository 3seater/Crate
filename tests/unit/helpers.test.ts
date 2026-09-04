/**
 * Smoke test: verifies test setup and shared helpers.
 */
import { describe, expect, it } from "vitest";
import { createId } from "../helpers";

describe("createId", () => {
  it("returns deterministic id with default prefix", () => {
    expect(createId()).toBe("test_000001");
    expect(createId("test", 2)).toBe("test_000002");
  });

  it("accepts custom prefix and number", () => {
    expect(createId("user", 42)).toBe("user_000042");
    expect(createId("order", 1)).toBe("order_000001");
  });
});
