/**
 * Unit tests for getTrpcDisplayMessage, getTrpcDisplayDetails, isInputValidationError.
 */
import { describe, expect, it } from "vitest";
import {
  getTrpcDisplayDetails,
  getTrpcDisplayMessage,
  getTrpcProcedurePathFromQueryKey,
  isInputValidationError,
  TRPC_QUERY_SILENT_NOT_FOUND_PATHS,
} from "../../apps/web/src/lib/trpc/errors";

describe("getTrpcDisplayMessage", () => {
  it("returns error.data.message when present", () => {
    const err = {
      message: "Internal",
      data: { message: "User-friendly message", code: "BAD_REQUEST" },
    };
    expect(getTrpcDisplayMessage(err)).toBe("User-friendly message");
  });

  it("returns generic message for zodError (input validation)", () => {
    const err = {
      message: "Validation failed",
      data: {
        zodError: { formErrors: ["Email is required"], fieldErrors: {} },
      },
    };
    expect(getTrpcDisplayMessage(err)).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("returns generic message for zodError with field errors", () => {
    const err = {
      message: "Validation failed",
      data: {
        zodError: {
          formErrors: [],
          fieldErrors: { price: ["Price must be between 0 and 1"] },
        },
      },
    };
    expect(getTrpcDisplayMessage(err)).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("returns generic message for empty zodError", () => {
    const err = {
      message: "Bad",
      data: { zodError: { formErrors: [], fieldErrors: {} } },
    };
    expect(getTrpcDisplayMessage(err)).toBe(
      "Something went wrong. Please try again."
    );
  });

  it("returns error.message for plain Error", () => {
    expect(getTrpcDisplayMessage(new Error("Something broke"))).toBe(
      "Something broke"
    );
  });

  it("returns Something went wrong for null/undefined", () => {
    expect(getTrpcDisplayMessage(null)).toBe("Something went wrong");
    expect(getTrpcDisplayMessage(undefined)).toBe("Something went wrong");
  });

  it("handles axios-style response.data.error", () => {
    const err = { response: { data: { error: "Server rejected request" } } };
    expect(getTrpcDisplayMessage(err)).toBe("Server rejected request");
  });

  it("handles data.error (no response)", () => {
    const err = { data: { error: "Direct error" } };
    expect(getTrpcDisplayMessage(err)).toBe("Direct error");
  });
});

describe("isInputValidationError", () => {
  it("returns true for errors with zodError", () => {
    const err = {
      message: "Bad",
      data: {
        zodError: {
          formErrors: ["Invalid input: expected array, received undefined"],
          fieldErrors: {},
        },
      },
    };
    expect(isInputValidationError(err)).toBe(true);
  });

  it("returns false for errors without zodError", () => {
    const err = { message: "Not found", data: { code: "NOT_FOUND" } };
    expect(isInputValidationError(err)).toBe(false);
  });

  it("returns false for non-tRPC errors", () => {
    expect(isInputValidationError(new Error("nope"))).toBe(false);
    expect(isInputValidationError(null)).toBe(false);
  });
});

describe("getTrpcDisplayDetails", () => {
  it("returns why, fix, link when present", () => {
    const err = {
      data: {
        why: "Region restricted",
        fix: "Use a VPN or different region",
        link: "https://docs.example.com",
      },
    };
    expect(getTrpcDisplayDetails(err)).toEqual({
      why: "Region restricted",
      fix: "Use a VPN or different region",
      link: "https://docs.example.com",
    });
  });

  it("returns null when no trpc data", () => {
    expect(getTrpcDisplayDetails(null)).toBeNull();
    expect(getTrpcDisplayDetails(new Error("x"))).toBeNull();
  });

  it("returns null when data has no why/fix/link", () => {
    const err = { data: {} };
    expect(getTrpcDisplayDetails(err)).toBeNull();
  });
});

describe("getTrpcProcedurePathFromQueryKey", () => {
  it("parses tRPC TanStack query key shape", () => {
    const key = [
      ["clob", "getMidpoint"],
      { type: "query", input: { tokenId: "1" } },
    ] as const;
    expect(getTrpcProcedurePathFromQueryKey(key)).toBe("clob.getMidpoint");
  });

  it("returns null when no path tuple is present", () => {
    expect(getTrpcProcedurePathFromQueryKey(["x", "y"])).toBeNull();
  });
});

describe("TRPC_QUERY_SILENT_NOT_FOUND_PATHS", () => {
  it("includes soft CLOB price procedures", () => {
    expect(TRPC_QUERY_SILENT_NOT_FOUND_PATHS.has("clob.getMidpoint")).toBe(
      true
    );
    expect(
      TRPC_QUERY_SILENT_NOT_FOUND_PATHS.has("clob.calculateMarketPrice")
    ).toBe(true);
    expect(TRPC_QUERY_SILENT_NOT_FOUND_PATHS.has("clob.getTickSize")).toBe(
      true
    );
  });
});
