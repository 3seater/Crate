/** Smoke test: integration suite and env setup run. */
import { describe, expect, it } from "vitest";

describe("integration suite", () => {
  it("runs integration config and env setup", () => {
    expect(process.env).toBeDefined();
  });
});
